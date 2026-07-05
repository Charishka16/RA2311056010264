# System Architecture

This diagram illustrates the high-level architecture of JobForge, showcasing how the frontend, backend APIs, real-time WebSockets, and background workers interact with the SQLite database.

```mermaid
flowchart TD
    %% Define Styles
    classDef frontend fill:#3b82f6,stroke:#1d4ed8,stroke-width:2px,color:#fff,rx:8px,ry:8px;
    classDef backend fill:#10b981,stroke:#047857,stroke-width:2px,color:#fff,rx:8px,ry:8px;
    classDef database fill:#6366f1,stroke:#4338ca,stroke-width:2px,color:#fff,rx:8px,ry:8px;
    classDef background fill:#f59e0b,stroke:#b45309,stroke-width:2px,color:#fff,rx:8px,ry:8px;
    
    %% Nodes
    subgraph Client [Client Tier]
        UI["💻 React Dashboard (Vite)"]:::frontend
    end

    subgraph Server [Backend Tier (Express.js)]
        API["🔌 REST API Routes (Auth, Jobs, Queues)"]:::backend
        WS["⚡ Socket.IO Server (Live Updates)"]:::backend
    end

    subgraph Engine [Background Services Tier]
        Worker["👷 Background Worker Engine"]:::background
        Cron["🕐 Cron Scheduler"]:::background
    end

    subgraph DB [Data Tier]
        SQLite[("🗄️ SQLite Database (Prisma ORM)")]:::database
    end

    %% Connections
    UI -- "HTTP Requests" --> API
    UI -- "WebSocket Connect" --> WS
    
    API -- "CRUD Operations" --> SQLite
    
    Worker -- "Optimistic Locking (Poll Jobs)" --> SQLite
    Worker -- "Update Job Status" --> SQLite
    
    Cron -- "Check Cron Expressions" --> SQLite
    Cron -- "Dispatch Scheduled Jobs" --> SQLite
    
    API -- "Emit Events" --> WS
    Worker -- "Emit Execution Events" --> WS
    
    WS -- "Real-time Broadcasts" --> UI
```

### Component Details
1. **React Dashboard**: Provides the user interface. Makes HTTP calls to the REST API and maintains a persistent WebSocket connection to receive live updates.
2. **REST API**: Built with Node.js & Express. Handles user authentication (JWT), resource management (Queues/Jobs), and metrics calculation.
3. **Socket.IO Server**: Broadcasts events like `job:created`, `job:running`, and `job:completed` to connected clients so the UI updates instantly without refreshing.
4. **Worker Engine**: A background loop running alongside the server. It polls the database every second using an **Optimistic Locking** SQL query (`version = version + 1`) to atomically claim jobs in a thread-safe manner, executes them, and logs the results.
5. **Cron Scheduler**: A background interval that checks the `ScheduledJob` table for due tasks (based on their parsed cron expression) and automatically spawns new `Job` rows for the worker to pick up.
6. **SQLite (Prisma)**: The central source of truth for the distributed system. (Can be swapped with PostgreSQL for multi-server horizontal scaling).
