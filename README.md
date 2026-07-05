# JobForge — Distributed Job Scheduling Platform

> **JobForge** — A production-inspired distributed job scheduling platform built with React, Node.js, Express, Prisma & SQLite. Features JWT auth, multi-queue management with pause/resume, real-time job monitoring via Socket.IO, automatic retries with exponential backoff, dead letter queues, cron scheduling, and a live analytics dashboard.

---

## 🚀 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, Vite, React Router v6, Axios, Chart.js, Socket.IO Client |
| **Backend** | Node.js, Express.js, TypeScript, ts-node |
| **Database** | SQLite (via Prisma ORM) — PostgreSQL-ready |
| **Auth** | JWT + bcrypt password hashing |
| **Real-time** | Socket.IO (WebSockets) |
| **Scheduler** | node-cron |
| **Logging** | Winston |

---

## ✨ Features

- 🔐 **JWT Authentication** — Register/login with bcrypt-hashed passwords
- 🏢 **Organization & Project Management** — Multi-tenant structure
- 📋 **Queue Management** — Create queues with priority, concurrency limits, pause/resume
- ⚡ **Real-time Job Execution** — Worker polls and executes jobs atomically (optimistic locking)
- 🔁 **Auto Retry** — Exponential backoff retry on failure
- ☠️ **Dead Letter Queue** — Failed jobs moved to DLQ after max retries
- 🕐 **Cron Scheduler** — Schedule recurring jobs with cron expressions
- 📊 **Live Dashboard** — Chart.js throughput charts + Socket.IO live feed
- 🔍 **Job Explorer** — Search, filter by status, paginate, retry/cancel jobs
- 👷 **Worker Monitor** — Track active workers, heartbeats, processed/failed counts

---

## 🛠️ Getting Started

### Prerequisites
- Node.js 18+
- npm

### 1. Clone the repo
```bash
git clone https://github.com/Charishka16/RA2311056010264-Job-Scheduler.git
cd RA2311056010264-Job-Scheduler
```

### 2. Setup Backend
```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run seed       # Creates demo user + sample data
npm run dev        # Starts on http://localhost:3001
```

### 3. Setup Frontend
```bash
cd frontend
npm install
npm run dev        # Starts on http://localhost:5173
```

### 4. Open the app
Visit **http://localhost:5173** and log in with:
- **Email:** `demo@jobforge.dev`
- **Password:** `password123`

---

## 📁 Project Structure

```
JobForge-Pro/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma      # 13-table DB schema
│   │   └── seed.ts            # Demo data seeder
│   └── src/
│       ├── routes/            # Auth, Orgs, Queues, Jobs, Metrics
│       ├── services/          # Worker engine, Cron scheduler
│       ├── middleware/        # JWT auth, error handler
│       ├── lib/               # Prisma client, Socket.IO, Winston
│       └── index.ts           # Express server entry
└── frontend/
    └── src/
        ├── pages/             # Dashboard, Queues, Jobs, Workers, Logs
        ├── components/        # Sidebar
        ├── contexts/          # AuthContext
        └── lib/               # Axios API client, Socket.IO client
```

---

## 🎯 API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register user |
| POST | `/api/auth/login` | Login & get JWT |
| GET | `/api/orgs` | List organizations |
| GET | `/api/orgs/:id/projects` | List projects |
| GET | `/api/projects/:id/queues` | List queues with stats |
| POST | `/api/queues/:id/jobs` | Create a job |
| GET | `/api/queues/:id/jobs` | List jobs (paginated) |
| POST | `/api/jobs/:id/retry` | Retry failed job |
| POST | `/api/jobs/:id/cancel` | Cancel queued job |
| GET | `/api/metrics/overview` | System metrics |
| GET | `/api/metrics/throughput` | 24h throughput chart |
| GET | `/api/workers` | List workers |

---

## 👩‍💻 Author

**Charishka** — RA2311056010264

---

*Built as a production-inspired capstone project demonstrating distributed systems, real-time communication, and modern full-stack architecture.*
