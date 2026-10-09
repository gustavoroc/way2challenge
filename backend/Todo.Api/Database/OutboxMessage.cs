using System.Text.Json;
using Todo.Api.Tasks;

namespace Todo.Api.Database;

// A task change waiting to be sent to the external consumer.
// Saved in the same transaction as the task, so it exists only if the change was committed.
public class OutboxMessage
{
    private const int MaxAttempts = 8;
    private static readonly TimeSpan FirstRetryDelay = TimeSpan.FromSeconds(5);

    public Guid Id { get; set; }
    public Guid TaskId { get; set; }
    public string Payload { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; }

    public int Attempts { get; set; }
    public DateTimeOffset NextAttemptAt { get; set; }
    public DateTimeOffset? DeliveredAt { get; set; }
    public string? LastError { get; set; }

    // Set after MaxAttempts failures: the job stops sending it. The row stays for someone to look at.
    public DateTimeOffset? GaveUpAt { get; set; }

    // Carries the final state of the task after the server applied the events.
    public static OutboxMessage For(TaskItem task)
    {
        var messageId = Guid.CreateVersion7();
        var payload = new
        {
            eventId = messageId,
            taskId = task.Id,
            userId = task.UserId,
            type = task.Deleted ? "task.deleted" : "task.changed",
            occurredAt = task.LastEventAt,
            task = task.Deleted ? null : TaskResponse.From(task),
        };

        return new OutboxMessage
        {
            Id = messageId,
            TaskId = task.Id,
            Payload = JsonSerializer.Serialize(payload, JsonSerializerOptions.Web),
            CreatedAt = DateTimeOffset.UtcNow,
            NextAttemptAt = DateTimeOffset.UtcNow,
        };
    }

    // Up to 8 tries, waiting 5 s, 10 s, 20 s... 320 s between them (about 10 min in total).
    // After the 8th failure it gives up.
    public void RegisterFailure(string error)
    {
        Attempts++;
        LastError = error;

        if (Attempts >= MaxAttempts)
        {
            GaveUpAt = DateTimeOffset.UtcNow;
            return;
        }

        NextAttemptAt = DateTimeOffset.UtcNow + FirstRetryDelay * Math.Pow(2, Attempts - 1);
    }
}
