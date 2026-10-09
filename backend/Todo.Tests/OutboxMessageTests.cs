using Todo.Api.Database;

namespace Todo.Tests;

public class OutboxMessageTests
{
    [Fact]
    public void Keeps_retrying_up_to_the_7th_failure_with_a_growing_wait()
    {
        var message = new OutboxMessage();

        for (var failure = 1; failure <= 7; failure++) message.RegisterFailure("503");

        Assert.Null(message.GaveUpAt);
        Assert.InRange(message.NextAttemptAt - DateTimeOffset.UtcNow, TimeSpan.FromSeconds(315), TimeSpan.FromSeconds(320));
    }

    [Fact]
    public void Gives_up_on_the_8th_failure_and_keeps_the_last_error()
    {
        var message = new OutboxMessage();

        for (var failure = 1; failure <= 8; failure++) message.RegisterFailure($"503 #{failure}");

        Assert.NotNull(message.GaveUpAt);
        Assert.Equal(8, message.Attempts);
        Assert.Equal("503 #8", message.LastError);
    }
}
