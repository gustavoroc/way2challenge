using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Todo.Api.Database;
using Todo.Api.Tasks;

namespace Todo.Tests;

public class ReceiveEventsTests(TodoApiFactory api) : IClassFixture<TodoApiFactory>
{
    private static readonly DateTimeOffset TenOClock = new(2026, 10, 1, 10, 0, 0, TimeSpan.Zero);

    private readonly Guid taskId = Guid.CreateVersion7();

    private TaskEventInput Change(string type, DateTimeOffset occurredAt, string title = "Comprar café") =>
        new(Guid.CreateVersion7(), taskId, type, occurredAt, new TaskFields(title, null, null, "medium", "pending", null));

    private TaskEventInput Delete(DateTimeOffset occurredAt) =>
        new(Guid.CreateVersion7(), taskId, TaskEventTypes.Delete, occurredAt, null);

    private static async Task Send(HttpClient client, params TaskEventInput[] events)
    {
        var response = await client.PostAsJsonAsync("/task-events", new TaskEventsRequest([.. events]));
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    private async Task<TaskResponse?> FindTask(HttpClient client)
    {
        var tasksPage = await client.GetFromJsonAsync<TasksPage>("/tasks?pageSize=500");
        return tasksPage!.Tasks.SingleOrDefault(task => task.Id == taskId);
    }

    private async Task<T> QueryDatabase<T>(Func<TodoDb, Task<T>> query)
    {
        using var scope = api.Services.CreateScope();
        return await query(scope.ServiceProvider.GetRequiredService<TodoDb>());
    }

    [Fact]
    public async Task Late_older_event_in_another_request_is_ignored()
    {
        var alice = await api.SignedInClient("alice");
        await Send(alice, Change(TaskEventTypes.Create, TenOClock));
        await Send(alice, Change(TaskEventTypes.Update, TenOClock.AddMinutes(5), title: "10:05"));

        await Send(alice, Change(TaskEventTypes.Update, TenOClock.AddMinutes(2), title: "10:02 atrasado"));

        Assert.Equal("10:05", (await FindTask(alice))!.Title);
    }

    [Fact]
    public async Task Delete_wins_even_over_a_later_edit()
    {
        var alice = await api.SignedInClient("alice");
        await Send(alice, Change(TaskEventTypes.Create, TenOClock));
        await Send(alice, Delete(TenOClock.AddMinutes(1)));

        await Send(alice, Change(TaskEventTypes.Update, TenOClock.AddMinutes(10), title: "editado depois"));

        Assert.Null(await FindTask(alice));
    }

    [Fact]
    public async Task Delete_arriving_before_the_create_keeps_the_task_deleted()
    {
        var alice = await api.SignedInClient("alice");
        await Send(alice, Delete(TenOClock.AddMinutes(1)));

        await Send(alice, Change(TaskEventTypes.Create, TenOClock));

        Assert.Null(await FindTask(alice));
    }

    [Fact]
    public async Task Resending_the_same_events_changes_nothing()
    {
        var alice = await api.SignedInClient("alice");
        var create = Change(TaskEventTypes.Create, TenOClock);

        await Send(alice, create);
        await Send(alice, create);

        Assert.Equal(1, await QueryDatabase(db => db.TaskEvents.CountAsync(e => e.TaskId == taskId)));
        Assert.Equal(1, await QueryDatabase(db => db.Outbox.CountAsync(m => m.TaskId == taskId)));
    }

    [Fact]
    public async Task Only_a_winning_event_goes_to_the_consumer_outbox()
    {
        var alice = await api.SignedInClient("alice");
        await Send(alice, Change(TaskEventTypes.Create, TenOClock));
        await Send(alice, Change(TaskEventTypes.Update, TenOClock.AddMinutes(5)));

        await Send(alice, Change(TaskEventTypes.Update, TenOClock.AddMinutes(2)));

        Assert.Equal(3, await QueryDatabase(db => db.TaskEvents.CountAsync(e => e.TaskId == taskId)));
        Assert.Equal(2, await QueryDatabase(db => db.Outbox.CountAsync(m => m.TaskId == taskId)));
    }

    [Fact]
    public async Task Requests_from_the_same_user_at_the_same_time_wait_for_each_other()
    {
        var alice = await api.SignedInClient("alice");
        await Send(alice, Change(TaskEventTypes.Create, TenOClock));

        var simultaneousEdits = Enumerable.Range(1, 10)
            .Select(minute => Send(alice, Change(TaskEventTypes.Update, TenOClock.AddMinutes(minute), title: $"10:{minute:00}")));
        await Task.WhenAll(simultaneousEdits);

        Assert.Equal("10:10", (await FindTask(alice))!.Title);
        Assert.Equal(11, await QueryDatabase(db => db.TaskEvents.CountAsync(e => e.TaskId == taskId)));
    }

    [Fact]
    public async Task A_user_neither_sees_nor_changes_another_users_task()
    {
        var alice = await api.SignedInClient("alice");
        var bob = await api.SignedInClient("bob");
        await Send(alice, Change(TaskEventTypes.Create, TenOClock));

        await Send(bob, Change(TaskEventTypes.Update, TenOClock.AddMinutes(5), title: "do bob"));

        Assert.Null(await FindTask(bob));
        Assert.Equal("Comprar café", (await FindTask(alice))!.Title);
    }
}
