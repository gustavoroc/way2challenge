namespace Todo.Api.Database;

// One row per user, used only to lock: POST /task-events locks the user's row, so two requests
// from the same user never apply events at the same time.
public class UserSyncLock
{
    public Guid UserId { get; set; }
}
