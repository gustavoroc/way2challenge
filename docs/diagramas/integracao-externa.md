# Fluxo da integração externa

Do servidor até o consumidor. Nada sai direto do aparelho: só sai o estado final, depois que o servidor aplicou os eventos.

```mermaid
sequenceDiagram
    autonumber
    participant API as Todo.Api (POST /task-events)
    participant PG as PostgreSQL
    participant J as DeliverOutboxJob (dentro da Todo.Api)
    participant C as Consumer.Api

    API->>PG: mesma transação: eventos + estado final da tarefa + 1 linha no outbox por tarefa que mudou
    API->>PG: COMMIT
    Note over PG: sem commit, sem mensagem.<br/>Com commit, a mensagem não se perde.

    loop a cada 1 s
        J->>PG: pega até 50 pendentes (FOR UPDATE SKIP LOCKED)
        J->>C: HTTP POST /events { eventId, taskId, userId, type, occurredAt, task }
        alt 2xx
            J->>PG: marca DeliveredAt
        else erro ou timeout
            J->>PG: Attempts + 1, próxima tentativa em 5 s, 10 s, 20 s...<br/>na 8ª falha: GaveUpAt (para de tentar, fica no banco)
        end
    end

    Note over C: at-least-once: pode chegar repetido ou fora de ordem.<br/>Ignora eventId já visto, occurredAt mais antigo<br/>que o último da tarefa e qualquer coisa depois do delete.
    C->>C: registra (GET /events mostra o que recebeu)
```

## Garantias

| Garantia | Como |
|---|---|
| Só propaga o que o servidor reconciliou | o outbox é escrito na mesma transação da tarefa, com o estado final |
| Não perde mensagem se a API cair | a linha pendente está no Postgres; o job continua ao subir |
| At-least-once | só marca `DeliveredAt` depois do 2xx |
| Idempotência no consumidor | `eventId` único por mensagem |
| Ordem por tarefa | o consumidor descarta `occurredAt` mais antigo e tudo depois do delete |
| Consumidor fora do ar | até 8 tentativas em ~10 min (5 s, 10 s... 320 s); depois marca `GaveUpAt` e a linha fica no banco com o último erro |
| Várias instâncias da API | `SKIP LOCKED`: cada instância pega linhas diferentes |
