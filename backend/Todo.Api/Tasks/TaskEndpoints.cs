using System.Security.Claims;
using Todo.Api.Application;
using Todo.Api.Auth;

namespace Todo.Api.Tasks;

public static class TaskEndpoints
{
    public static void MapTaskEndpoints(this WebApplication app)
    {
        var tasks = app.MapGroup("").RequireAuthorization();

        tasks.MapPost("/task-events", ReceiveEvents);
        tasks.MapGet("/tasks", ListTasks);
    }

    private static async Task<IResult> ReceiveEvents(TaskEventsRequest request, ClaimsPrincipal user, TaskService taskService)
    {
        await taskService.ReceiveEvents(user.UserId(), request.Events);

        return Results.NoContent();
    }

    private static Task<TasksPage> ListTasks(ClaimsPrincipal user, TaskService taskService, int page = 1, int pageSize = 200) =>
        taskService.ListTasks(user.UserId(), page, pageSize);
}
