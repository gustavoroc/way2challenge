using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Todo.Api.Auth;
using Todo.Api.Jobs;

namespace Todo.Tests;

// Runs Todo.Api in memory against the docker compose Postgres, in a separate todo_tests database.
// Needs: docker compose up -d postgres
public class TodoApiFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseSetting("ConnectionStrings:Todo", "Host=localhost;Port=5432;Database=todo_tests;Username=todo;Password=todo;GSS Encryption Mode=Disable");

        // These tests check what POST /task-events saves, not the delivery to the consumer.
        builder.ConfigureServices(services =>
        {
            var deliverOutboxJob = services.Single(service => service.ImplementationType == typeof(DeliverOutboxJob));
            services.Remove(deliverOutboxJob);
        });
    }

    public async Task<HttpClient> SignedInClient(string username)
    {
        var client = CreateClient();
        var response = await client.PostAsJsonAsync("/auth/login", new LoginRequest(username, username));
        var session = await response.Content.ReadFromJsonAsync<Session>();

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", session!.Token);

        return client;
    }
}
