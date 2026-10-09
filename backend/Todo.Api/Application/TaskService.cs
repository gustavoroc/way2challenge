using Microsoft.EntityFrameworkCore;
using Todo.Api.Database;
using Todo.Api.Tasks;

namespace Todo.Api.Application;

public class TaskService(TodoDb db, ILogger<TaskService> logger)
{
    private static readonly string[] Priorities = ["low", "medium", "high"];
    private static readonly string[] Statuses = ["pending", "done"];

    private enum EventDecision { Ignore, Delete, Apply }

    // Receives the device outbox and saves events, final task state and server outbox in one transaction.
    public async Task ReceiveEvents(Guid userId, List<TaskEventInput> events)
    {
        await using var transaction = await db.Database.BeginTransactionAsync();
        await LockUser(userId);

        var validEvents = DropInvalidAndSortByTime(events);
        var newEvents = await DropAlreadyReceived(validEvents);
        var tasksById = await LoadTasks(newEvents);
        var changedTasks = new HashSet<TaskItem>();

        foreach (var taskEvent in newEvents)
        {
            var task = FindOrCreateTask(tasksById, taskEvent.TaskId, userId);

            // A user can never touch another user's task.
            if (task.UserId != userId) continue;

            SaveToHistory(taskEvent, userId);

            var eventWon = ApplyIfWins(task, taskEvent);
            if (eventWon) changedTasks.Add(task);
        }

        AddToConsumerOutbox(changedTasks);

        // Events, tasks and outbox are saved together, and the commit releases the user's lock.
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
    }

    // Final state of the user's tasks, page by page. Deleted tasks are left out.
    public async Task<TasksPage> ListTasks(Guid userId, int page, int pageSize)
    {
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 500);

        var pageWithOneMore = await db.Tasks
            .Where(t => t.UserId == userId && !t.Deleted)
            .OrderBy(t => t.CreatedAt).ThenBy(t => t.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize + 1)
            .ToListAsync();

        var tasks = pageWithOneMore.Take(pageSize).Select(TaskResponse.From).ToList();

        return new TasksPage(tasks, pageWithOneMore.Count > pageSize);
    }

    // One request per user at a time. A second request from the same user (another tab, another
    // device) waits on this row until the first one commits, so both never read the same task state.
    // The insert creates the user's row the first time; FOR UPDATE takes the lock.
    private async Task LockUser(Guid userId)
    {
        await db.Database.ExecuteSqlAsync($"""INSERT INTO user_sync_locks ("UserId") VALUES ({userId}) ON CONFLICT DO NOTHING""");
        await db.Database.ExecuteSqlAsync($"""SELECT 1 FROM user_sync_locks WHERE "UserId" = {userId} FOR UPDATE""");
    }

    // An invalid event is skipped instead of rejecting the batch: a rejected batch would stay
    // in the device outbox forever. The rest is applied in the order it happened on the device.
    private List<TaskEventInput> DropInvalidAndSortByTime(List<TaskEventInput> events)
    {
        var validEvents = events.Where(IsValid).DistinctBy(e => e.EventId).OrderBy(e => e.OccurredAt).ToList();

        if (validEvents.Count < events.Count) logger.LogWarning("Skipped {Count} invalid events", events.Count - validEvents.Count);

        return validEvents;
    }

    // The device resends when it does not get the 2xx, so the same eventId may arrive twice
    // and must change nothing the second time.
    private async Task<List<TaskEventInput>> DropAlreadyReceived(List<TaskEventInput> events)
    {
        var eventIds = events.Select(e => e.EventId).ToList();
        var receivedEventIds = await db.TaskEvents.Where(e => eventIds.Contains(e.EventId)).Select(e => e.EventId).ToListAsync();

        return events.Where(e => !receivedEventIds.Contains(e.EventId)).ToList();
    }

    // The tasks these events talk about, in one query.
    private Task<Dictionary<Guid, TaskItem>> LoadTasks(List<TaskEventInput> events)
    {
        var taskIds = events.Select(e => e.TaskId).Distinct().ToList();

        return db.Tasks.Where(t => taskIds.Contains(t.Id)).ToDictionaryAsync(t => t.Id);
    }

    // Task not in the database yet: creates an empty one and the event fills it.
    private TaskItem FindOrCreateTask(Dictionary<Guid, TaskItem> tasksById, Guid taskId, Guid userId)
    {
        if (tasksById.TryGetValue(taskId, out var task)) return task;

        task = new TaskItem { Id = taskId, UserId = userId };
        tasksById[taskId] = task;
        db.Tasks.Add(task);

        return task;
    }

    // Every event goes to the history, even the ones that lose.
    private void SaveToHistory(TaskEventInput taskEvent, Guid userId)
    {
        db.TaskEvents.Add(TaskEventRecord.From(taskEvent, userId));
    }

    // Returns true when the event won and changed the task.
    private static bool ApplyIfWins(TaskItem task, TaskEventInput taskEvent)
    {
        switch (Decide(task, taskEvent))
        {
            case EventDecision.Delete:
                task.MarkDeleted(taskEvent.OccurredAt);
                return true;

            case EventDecision.Apply:
                task.CopyFields(taskEvent.Fields!, taskEvent.OccurredAt);
                return true;

            default:
                return false;
        }
    }

    // THE BUSINESS RULE, checked from top to bottom.
    private static EventDecision Decide(TaskItem task, TaskEventInput taskEvent) => taskEvent switch
    {
        // RULE 1: delete always wins. Already deleted: nothing brings it back, not even a later event.
        _ when task.Deleted => EventDecision.Ignore,

        // RULE 1: a delete wins whatever its time, even if an edit happened after it on another device.
        { Type: TaskEventTypes.Delete } => EventDecision.Delete,

        // RULE 2: the most recent wins. LastEventAt is saved in the database, so if the 10:05 event
        // arrived first and the 10:02 one arrives later, even in another request, the 10:02 one loses.
        _ when taskEvent.OccurredAt <= task.LastEventAt => EventDecision.Ignore,

        // More recent than the current state: its fields become the task.
        _ => EventDecision.Apply,
    };

    // Each task that really changed gets one message to the external consumer, with its final state.
    private void AddToConsumerOutbox(IEnumerable<TaskItem> changedTasks)
    {
        foreach (var task in changedTasks) db.Outbox.Add(OutboxMessage.For(task));
    }

    private static bool IsValid(TaskEventInput taskEvent)
    {
        if (taskEvent.EventId == Guid.Empty || taskEvent.TaskId == Guid.Empty) return false;
        if (taskEvent.Type == TaskEventTypes.Delete) return true;
        if (taskEvent.Type is not (TaskEventTypes.Create or TaskEventTypes.Update)) return false;

        var fields = taskEvent.Fields;

        return fields is not null
            && !string.IsNullOrWhiteSpace(fields.Title) && fields.Title.Length <= 200
            && (fields.Description?.Length ?? 0) <= 2000
            && (fields.Category?.Length ?? 0) <= 50
            && Priorities.Contains(fields.Priority)
            && Statuses.Contains(fields.Status);
    }
}
