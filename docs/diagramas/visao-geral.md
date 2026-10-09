# Visão geral da solução

Quais são os componentes, onde cada um roda e como se comunicam.

```mermaid
flowchart LR
    subgraph maquina["Máquina do usuário (desktop ou celular)"]
        direction TB
        ui["Angular PWA<br/>telas + TaskStore (memória)"]
        sync["PublishOutboxJob (5 s)<br/>PullServerTasksJob (15 s)"]
        idb[("IndexedDB<br/>só o outbox de eventos")]
        sw["Service Worker<br/>guarda o app para abrir offline"]
        ui -- "grava eventos" --> idb
        sync -- "lê o outbox" --> idb
        sw -. "cache do HTML/JS" .- ui
    end

    subgraph compose["docker compose (máquina local)"]
        direction TB
        api["Todo.Api · .NET 10<br/>:8080<br/>login · eventos · DeliverOutboxJob"]
        pg[("PostgreSQL 16<br/>:5432<br/>tasks · task_events · outbox<br/>user_sync_locks")]
        consumer["Consumer.Api · .NET 10<br/>:8081<br/>registra o que recebeu"]
        api -- "SQL, uma transação por envio" --> pg
        api -- "HTTP POST /events<br/>depois do commit" --> consumer
    end

    sync -- "HTTP + JWT<br/>POST /auth/login<br/>POST /task-events<br/>GET /tasks (paginado)" --> api
```

| Componente | Roda onde | Faz o quê |
|---|---|---|
| Angular PWA | navegador do usuário | telas, regra do urgente; toda ação vira um evento no outbox |
| IndexedDB | navegador do usuário | só o outbox: eventos que o servidor ainda não recebeu |
| Service Worker | navegador do usuário | deixa o app abrir sem internet |
| Todo.Api | container `api` | login mockado (JWT), aceita os eventos, decide o estado final, lista as tarefas, entrega eventos aos consumidores |
| PostgreSQL | container `postgres` | fonte da verdade: tarefas e outbox de eventos |
| Consumer.Api | container `consumer` | consumidor externo simulado, só recebe e mostra |
