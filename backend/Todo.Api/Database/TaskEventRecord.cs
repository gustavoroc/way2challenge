using System.Text.Json;
using Todo.Api.Tasks;

namespace Todo.Api.Database;

// Every event received, kept in order of occurredAt. History only: the screen reads TaskItem.
public class TaskEventRecord
{
    public Guid EventId { get; set; }
    public Guid TaskId { get; set; }
    public Guid UserId { get; set; }
    public string Type { get; set; } = "";
    public DateTimeOffset OccurredAt { get; set; }
    public string? Fields { get; set; }
    public DateTimeOffset ReceivedAt { get; set; }

    public static TaskEventRecord From(TaskEventInput taskEvent, Guid userId) => new()
    {
        EventId = taskEvent.EventId,
        TaskId = taskEvent.TaskId,
        UserId = userId,
        Type = taskEvent.Type,
        OccurredAt = taskEvent.OccurredAt,
        Fields = taskEvent.Fields is null ? null : JsonSerializer.Serialize(taskEvent.Fields, JsonSerializerOptions.Web),
        ReceivedAt = DateTimeOffset.UtcNow,
    };
}
