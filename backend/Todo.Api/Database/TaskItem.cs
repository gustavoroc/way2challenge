using Todo.Api.Tasks;

namespace Todo.Api.Database;

// Final state of a task. Written only by POST /task-events, which decides which event wins.
public class TaskItem
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }

    public string Title { get; set; } = "";
    public string? Description { get; set; }
    public DateOnly? DueDate { get; set; }
    public string Priority { get; set; } = "medium";
    public string Status { get; set; } = "pending";
    public string? Category { get; set; }
    public DateTimeOffset CreatedAt { get; set; }

    // occurredAt of the event that wrote the current state.
    public DateTimeOffset LastEventAt { get; set; }

    // Kept as a tombstone so a late create or update can never bring the task back.
    public bool Deleted { get; set; }

    public void MarkDeleted(DateTimeOffset occurredAt)
    {
        Deleted = true;
        LastEventAt = occurredAt;
    }

    public void CopyFields(TaskFields fields, DateTimeOffset occurredAt)
    {
        Title = fields.Title.Trim();
        Description = fields.Description;
        DueDate = fields.DueDate;
        Priority = fields.Priority;
        Status = fields.Status;
        Category = fields.Category;

        // First event of a new task: its time is the creation date.
        if (CreatedAt == default) CreatedAt = occurredAt;

        LastEventAt = occurredAt;
    }
}
