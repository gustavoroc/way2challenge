# Fluxo da sincronização offline

Da gravação local no dispositivo até a reconciliação no servidor.

## Geração de eventos no aparelho

```mermaid
sequenceDiagram
    autonumber
    actor U as Usuário
    participant UI as Tela (TaskStore)
    participant OB as IndexedDB (outbox)

    U->>UI: cria, edita, conclui ou remove
    UI->>OB: grava um evento (create, update ou delete)<br/>com occurredAt = hora do aparelho em UTC
    Note over OB: o outbox é a única coisa salva no aparelho
    OB-->>UI: tela = listão do servidor (memória)<br/>+ eventos do outbox aplicados por cima
    UI-->>U: tela pinta na hora (urgente sobe aqui)
```

Ao aplicar um evento, a tela faz assim: se a tarefa existe na lista, aplica a mudança; se não existe, cria. Entre eventos da mesma tarefa, vale o `occurredAt` mais recente. A remoção vence sempre.

## Envio do outbox: PublishOutboxJob, no login, a cada 5 s e quando a conexão volta

```mermaid
sequenceDiagram
    autonumber
    participant J as PublishOutboxJob
    participant OB as IndexedDB (outbox)
    participant API as Todo.Api
    participant PG as PostgreSQL

    J->>OB: lê o outbox inteiro (ordem de occurredAt)
    J->>API: POST /task-events { events }
    API->>PG: abre a transação e trava a linha do usuário (user_sync_locks)
    Note over API: descarta inválidos e eventId já recebido
    loop para cada evento novo, em ordem de occurredAt
        API->>PG: grava o evento no histórico
        alt tarefa já removida
            Note over API,PG: ignora: nada traz a tarefa de volta
        else delete
            API->>PG: tarefa removida (remoção vence sempre)
        else occurredAt mais recente que o da tarefa
            API->>PG: tarefa recebe esta versão
        else mais antigo
            Note over API,PG: fica só no histórico
        end
    end
    API->>PG: uma mensagem no outbox do servidor por tarefa que mudou
    API->>PG: commit (libera a linha do usuário)
    API-->>J: 204
    J->>J: guarda os eventos em sentEvents (memória),<br/>para a tarefa não sumir da tela até o próximo pull
    J->>OB: apaga do outbox os eventos enviados
```

## Busca do estado final: PullServerTasksJob, no login, a cada 15 s e quando a conexão volta

```mermaid
sequenceDiagram
    autonumber
    participant P as PullServerTasksJob
    participant OB as IndexedDB (outbox)
    participant API as Todo.Api
    participant UI as Tela (TaskStore)

    P->>OB: o outbox tem eventos?
    alt tem
        Note over P: espera a próxima rodada: os eventos sobem antes
    else vazio
        P->>API: GET /tasks?page=1&pageSize=200 ... até hasMore = false
        API-->>P: estado final das tarefas do usuário (sem as removidas)
        P->>UI: troca o listão em memória e limpa de sentEvents<br/>os eventos enviados antes deste pull
        Note over UI: eventos criados ou enviados nesse meio-tempo continuam aplicados por cima
    end
```

## Regras

- A tela nunca chama a API. Ela só grava eventos no outbox.
- O servidor só aceita eventos e decide o estado final sozinho: vale o `occurredAt` mais recente, e a remoção vence sempre. A hora do servidor não entra na decisão.
- Reenviar o mesmo evento não duplica nada, porque o servidor ignora `eventId` repetido.
- Um evento só sai do outbox quando o servidor responde 2xx.
- As tarefas vindas do servidor ficam só em memória, não no IndexedDB.

## Riscos e limitações assumidos

- O relógio do aparelho decide o conflito. Um celular com a hora errada pode ganhar ou perder indevidamente.
- Se o app for reaberto sem internet, a tela mostra só o que está no outbox. As tarefas já sincronizadas voltam no primeiro pull com conexão.
