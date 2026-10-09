using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Todo.Api.Application;
using Todo.Api.Auth;
using Todo.Api.Database;
using Todo.Api.Jobs;
using Todo.Api.Tasks;

var builder = WebApplication.CreateBuilder(args);
var config = builder.Configuration;
var jwtKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config["Jwt:Key"]!));

builder.Services.AddDbContext<TodoDb>(options => options.UseNpgsql(config.GetConnectionString("Todo")));
builder.Services.AddScoped<TaskService>();

builder.Services.AddSingleton(jwtKey);
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(options =>
{
    options.MapInboundClaims = false;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = false,
        ValidateAudience = false,
        IssuerSigningKey = jwtKey,
        ClockSkew = TimeSpan.Zero,
    };
});
builder.Services.AddAuthorization();

builder.Services.AddCors(options => options.AddDefaultPolicy(policy =>
    policy.WithOrigins(config["Cors:Origin"]!).AllowAnyHeader().AllowAnyMethod()));

builder.Services.AddHttpClient("consumer", client =>
{
    client.BaseAddress = new Uri(config["Consumer:Url"]!);
    client.Timeout = TimeSpan.FromSeconds(10);
});
builder.Services.AddHostedService<DeliverOutboxJob>();

var app = builder.Build();

// No migrations: the schema is created on the first start.
using (var scope = app.Services.CreateScope())
{
    scope.ServiceProvider.GetRequiredService<TodoDb>().Database.EnsureCreated();
}

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

app.MapAuthEndpoints();
app.MapTaskEndpoints();

app.Run();

public partial class Program;
