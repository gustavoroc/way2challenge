using System.Security.Claims;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace Todo.Api.Auth;

public record LoginRequest(string Username, string Password);

public record Session(Guid UserId, string Username, string Token, DateTimeOffset ExpiresAt);

public static class AuthEndpoints
{
    private static readonly TimeSpan SessionDuration = TimeSpan.FromHours(8);

    // Mocked users: the challenge asks for simple auth, not a user store.
    private static readonly Dictionary<string, (Guid Id, string Password)> Users = new()
    {
        ["alice"] = (Guid.Parse("00000000-0000-0000-0000-00000000a11c"), "alice"),
        ["bob"] = (Guid.Parse("00000000-0000-0000-0000-000000000b0b"), "bob"),
    };

    public static void MapAuthEndpoints(this WebApplication app) => app.MapPost("/auth/login", Login);

    public static Guid UserId(this ClaimsPrincipal user) => Guid.Parse(user.FindFirstValue(JwtRegisteredClaimNames.Sub)!);

    private static IResult Login(LoginRequest request, SymmetricSecurityKey jwtKey)
    {
        if (!Users.TryGetValue(request.Username, out var user) || user.Password != request.Password)
        {
            return Results.Unauthorized();
        }

        var expiresAt = DateTimeOffset.UtcNow + SessionDuration;
        var token = new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
        {
            Claims = new Dictionary<string, object>
            {
                [JwtRegisteredClaimNames.Sub] = user.Id.ToString(),
                [JwtRegisteredClaimNames.Name] = request.Username,
            },
            Expires = expiresAt.UtcDateTime,
            SigningCredentials = new SigningCredentials(jwtKey, SecurityAlgorithms.HmacSha256),
        });

        return Results.Ok(new Session(user.Id, request.Username, token, expiresAt));
    }
}
