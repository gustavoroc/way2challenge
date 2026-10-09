using Todo.Api.Database;

namespace Todo.Api.Tasks;

public static class TaskEventTypes
{
    public const string Create = "create";
    public const string Update = "update";
    public const string Delete = "delete";
}

public record TaskFields(string Title, string? Description, DateOnly? DueDate, string Priority, string Status, string? Category);

public record TaskEventInput(Guid EventId, Guid TaskId, string Type, DateTimeOffset OccurredAt, TaskFields? Fields);

public record TaskEventsRequest(List<TaskEventInput> Events);

public record TaskResponse(
    Guid Id, string Title, string? Description, DateOnly? DueDate, string Priority, string Status, string? Category, DateTimeOffset CreatedAt)
{
    public static TaskResponse From(TaskItem task) =>
        new(task.Id, task.Title, task.Description, task.DueDate, task.Priority, task.Status, task.Category, task.CreatedAt);
}

public record TasksPage(List<TaskResponse> Tasks, bool HasMore);
