using Microsoft.EntityFrameworkCore;

namespace Todo.Api.Database;

public class TodoDb(DbContextOptions<TodoDb> options) : DbContext(options)
{
    public DbSet<TaskItem> Tasks => Set<TaskItem>();
    public DbSet<TaskEventRecord> TaskEvents => Set<TaskEventRecord>();
    public DbSet<OutboxMessage> Outbox => Set<OutboxMessage>();
    public DbSet<UserSyncLock> UserSyncLocks => Set<UserSyncLock>();

    protected override void OnModelCreating(ModelBuilder model)
    {
        model.Entity<UserSyncLock>(userLock =>
        {
            userLock.ToTable("user_sync_locks");
            userLock.HasKey(l => l.UserId);
        });

        model.Entity<TaskItem>(task =>
        {
            task.ToTable("tasks");
            task.Property(t => t.Title).HasMaxLength(200);
            task.Property(t => t.Description).HasMaxLength(2000);
            task.Property(t => t.Category).HasMaxLength(50);
            task.HasIndex(t => new { t.UserId, t.CreatedAt });
        });

        model.Entity<TaskEventRecord>(taskEvent =>
        {
            taskEvent.ToTable("task_events");
            taskEvent.HasKey(e => e.EventId);
            taskEvent.Property(e => e.Fields).HasColumnType("jsonb");
            taskEvent.HasIndex(e => new { e.TaskId, e.OccurredAt });
        });

        model.Entity<OutboxMessage>(message =>
        {
            message.ToTable("outbox");
            message.Property(m => m.Payload).HasColumnType("jsonb");
            message.HasIndex(m => m.NextAttemptAt).HasFilter("\"DeliveredAt\" IS NULL AND \"GaveUpAt\" IS NULL");
        });
    }
}
