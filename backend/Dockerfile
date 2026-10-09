# Builds either API: docker build --build-arg PROJECT=Todo.Api (or Consumer.Api)
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
ARG PROJECT
WORKDIR /src
COPY . .
RUN dotnet publish ${PROJECT}/${PROJECT}.csproj -c Release -o /app

FROM mcr.microsoft.com/dotnet/aspnet:10.0
ARG PROJECT
ENV DLL=${PROJECT}.dll
WORKDIR /app
COPY --from=build /app .
ENTRYPOINT ["sh", "-c", "dotnet $DLL"]
