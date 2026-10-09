using System.Text;
using Microsoft.EntityFrameworkCore;
using Todo.Api.Database;

namespace Todo.Api.Jobs;

// JOB, every 1 s: sends the pending outbox messages to the external consumer.
// At-least-once: a message is marked delivered only after a 2xx, so it may arrive twice.
// The consumer drops repeated eventIds.
public class DeliverOutboxJob(IServiceScopeFactory scopes, IHttpClientFactory httpClients, ILogger<DeliverOutboxJob> logger)
    : BackgroundService
{
    private static readonly TimeSpan Every1Second = TimeSpan.FromSeconds(1);
    private const int MessagesPerRound = 50;

    protected override async Task ExecuteAsync(CancellationToken stopping)
    {
        using var timer = new PeriodicTimer(Every1Second);

        while (await timer.WaitForNextTickAsync(stopping))
        {
            try
            {
                await DeliverPendingMessages(stopping);
            }
            catch (Exception error) when (!stopping.IsCancellationRequested)
            {
                logger.LogError(error, "Outbox round failed");
            }
        }
    }

    private async Task DeliverPendingMessages(CancellationToken stopping)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TodoDb>();
        var consumer = httpClients.CreateClient("consumer");

        await using var transaction = await db.Database.BeginTransactionAsync(stopping);

        // SKIP LOCKED: a second API instance takes other rows instead of sending the same ones.
        var pendingMessages = await db.Outbox.FromSql($"""
            SELECT * FROM outbox
            WHERE "DeliveredAt" IS NULL AND "GaveUpAt" IS NULL AND "NextAttemptAt" <= now()
            ORDER BY "CreatedAt"
            LIMIT {MessagesPerRound}
            FOR UPDATE SKIP LOCKED
            """).ToListAsync(stopping);

        foreach (var message in pendingMessages)
        {
            try
            {
                using var body = new StringContent(message.Payload, Encoding.UTF8, "application/json");
                using var response = await consumer.PostAsync("/events", body, stopping);

                response.EnsureSuccessStatusCode();
                message.DeliveredAt = DateTimeOffset.UtcNow;
            }
            catch (Exception error) when (error is HttpRequestException or TaskCanceledException && !stopping.IsCancellationRequested)
            {
                message.RegisterFailure(error.Message);

                if (message.GaveUpAt is null) logger.LogWarning("Outbox message {MessageId} failed, attempt {Attempts}", message.Id, message.Attempts);
                else logger.LogError("Outbox message {MessageId} gave up after {Attempts} attempts: {Error}", message.Id, message.Attempts, error.Message);
            }
        }

        await db.SaveChangesAsync(stopping);
        await transaction.CommitAsync(stopping);
    }
}
