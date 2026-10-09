// Simulated external system that receives task changes from Todo.Api.
// Delivery is at-least-once and may arrive out of order after a retry, so it:
// - ignores an eventId it already saw
// - ignores a change older than the last one applied to the same task
// - ignores anything after the task was deleted
// Consumer:FailureRate (0 to 1) makes it answer 503 on purpose, to watch Todo.Api retry.

var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

var failureRate = app.Configuration.GetValue<double>("Consumer:FailureRate");
var receivedLock = new object();
var seenEventIds = new HashSet<Guid>();
var lastOccurredAtByTask = new Dictionary<Guid, DateTimeOffset>();
var deletedTaskIds = new HashSet<Guid>();
var appliedEvents = new List<TaskChangedEvent>();

app.MapPost("/events", (TaskChangedEvent taskEvent, ILogger<Program> logger) =>
{
    if (Random.Shared.NextDouble() < failureRate) return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);

    lock (receivedLock)
    {
        if (!seenEventIds.Add(taskEvent.EventId)) return Results.Ok();
        if (deletedTaskIds.Contains(taskEvent.TaskId)) return Results.Ok();
        if (lastOccurredAtByTask.TryGetValue(taskEvent.TaskId, out var lastOccurredAt) && taskEvent.OccurredAt < lastOccurredAt) return Results.Ok();

        lastOccurredAtByTask[taskEvent.TaskId] = taskEvent.OccurredAt;
        if (taskEvent.Type == "task.deleted") deletedTaskIds.Add(taskEvent.TaskId);
        appliedEvents.Add(taskEvent);
    }

    logger.LogInformation("{Type} {TaskId} {Title}", taskEvent.Type, taskEvent.TaskId, taskEvent.Task?.Title);

    return Results.Ok();
});

app.MapGet("/events", () =>
{
    lock (receivedLock) return appliedEvents.ToList();
});

app.Run();

record TaskSnapshot(Guid Id, string Title, string? Description, DateOnly? DueDate, string Priority, string Status, string? Category);

record TaskChangedEvent(Guid EventId, Guid TaskId, Guid UserId, string Type, DateTimeOffset OccurredAt, TaskSnapshot? Task);
