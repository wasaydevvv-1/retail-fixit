# RetailFixIt

Operations platform for coordinating service jobs between customers and vendors. Dispatchers create jobs, review AI-suggested vendors, and assign work. The stack is a React SPA and Node.js API in one monorepo, with shared TypeScript types so the frontend and backend stay aligned.

---

## Assessment submission

| Deliverable | Location |
|-------------|----------|
| Part 1 — Architecture write-up & diagrams | Word document (submitted separately) |
| Part 2 — Code & README | This repository |
| Part 3 — Engineering reasoning | Word document (submitted separately) |
| Part 4 — Platform walkthrough | Loom video  |
| Azure deployment guide | Word document (submitted separately) |

---

## Architecture overview

The app is built around a few ideas: multi-tenant data isolation, event-driven AI so job creation stays fast, and human-in-the-loop dispatch (AI recommends, people decide).

Users sign in with Microsoft Entra ID. The SPA talks to a REST API under `/api/v1`. Job writes go to Cosmos DB, partitioned by `tenantId`. When a job is created, a message goes to Azure Service Bus; handlers in the API call Azure OpenAI asynchronously and push updates over Azure SignalR. List pages for jobs and vendors are cached in Redis for about a minute.

There are three tenants in the demo data: `tenant_platform` for platform operators, and `tenant_acme` / `tenant_beta` for business operations. A **platform admin** can provision tenant admins and manage users across tenants. Everyone else works inside their own tenant — queries always use the tenant from the JWT, never from the request body.

Roles include platform admin, tenant admin, dispatcher, vendor manager, and support agent. Permissions like `jobs:create` and `jobs:assign` are defined once in `packages/shared` and checked on both API routes and UI navigation.

Core entities: Tenant, UserAccount, Job, Vendor, Assignment, AIRecommendation, and AuditLog (`packages/shared/src/domain/`).

Azure pieces used in a full setup: Cosmos DB, Service Bus (queue `retailfixit-events`), Azure OpenAI, SignalR (hub `jobs`, tenant-scoped groups), Managed Redis, Entra ID, and optionally Application Insights.

---

## Setup instructions

You need Node 20+, Docker for local Redis, and Azure resources if you want the full path (Cosmos, Entra, Service Bus, OpenAI, SignalR).

Clone the repo and install:

```bash
npm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Fill in `apps/api/.env` — at minimum Cosmos credentials. For the full Azure demo, also set Service Bus, SignalR, OpenAI, and Entra variables (see `.env.example` for names). Use `EVENT_BUS_DRIVER=in-memory`, `REALTIME_DRIVER=local-ws`, and `AI_USE_MOCK=true` if you want to run without those services.

Web app needs `VITE_AZURE_AD_*` for Microsoft login. Leave them empty to use the dev role picker at `/login`.

Bootstrap Cosmos (containers + demo tenants):

```bash
npm run db:bootstrap --workspace apps/api
```

To seed a platform admin invite:

```bash
SEED_PLATFORM_ADMIN_LOGIN=you@yourtenant.onmicrosoft.com npm run db:seed-platform --workspace apps/api
```

Start Redis, then the apps:

```bash
docker compose up -d redis
npm run dev:api
npm run dev:web
```

API: http://localhost:4000 — Web: http://localhost:5173 — Health: `curl http://localhost:4000/health`

Quick check: sign in, create a job on the dispatch board, wait for the recommendation on the job detail page, assign a vendor, and open Admin → System health to see metrics.

---

## Example event flow

Creating a job is synchronous — the API saves it and returns right away. Everything after that runs through the bus.

1. Client calls `POST /jobs`. Job is stored in Cosmos and a `JobCreated` event is published.
2. Handler sets status to awaiting recommendation and publishes `AIRecommendationRequested`.
3. AI handler calls Azure OpenAI (or the rule-based fallback), saves the recommendation and optional summary, then emits `AIRecommendationGenerated`.
4. Job moves to recommendation ready; SignalR notifies connected clients in that tenant.
5. Dispatcher assigns a vendor via `POST /jobs/:id/assign`. If they pick someone other than the top AI pick, `overrodeAi` is recorded.
6. `JobAssigned` triggers audit logging, cache invalidation, and another realtime push.

Events share a common envelope: `id`, `type`, `tenantId`, `correlationId`, `occurredAt`, and `payload`. Shapes are validated with Zod in `packages/shared/src/events/schemas.ts` on publish and consume.

Handlers live under `apps/api/src/events/handlers/` — `on-job-created`, `on-ai-recommendation-requested`, `on-recommendation-generated`, `on-job-assigned`.

---

## AI integration

The AI piece does two things: rank vendors for a job and produce a short summary from the customer's raw description.

Inference never blocks the create-job request. It runs inside the `AIRecommendationRequested` handler after Service Bus delivers the message. The API calls Azure OpenAI with a structured JSON prompt; the SPA only sees the result on the job detail page.

If OpenAI is slow or down, the service times out (8 seconds by default), retries transient errors, and can open a circuit breaker. When all else fails, a deterministic fallback scores vendors by skills, rating, and workload so dispatch can continue.

AI never assigns automatically. The dispatcher always confirms. Overrides are tracked on the assignment, in audit logs, and in metrics (`ai_follow_total` / `ai_override_total`). Prompt and response text are not stored in full — only safe previews for audit.

To use live OpenAI, set in `apps/api/.env`:

```env
AI_USE_MOCK=false
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_API_KEY=your-key
AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini
```

Implementation: `apps/api/src/modules/ai/`.

---

## Performance considerations

Read-heavy screens (dispatch board, vendor directory) hit Redis first — list responses are cached for 60 seconds per tenant and invalidated when jobs change. Cosmos queries are paginated with server-side filters; the UI debounces search input.

Job creation and assignment feel instant on the client thanks to optimistic updates; the server remains the source of truth and rolls back on error.

AI latency is kept off the HTTP path. OpenAI slowness affects background handlers, not the initial POST. SignalR avoids polling — the SPA invalidates React Query caches when events arrive.

Useful metrics: `http_request_duration_ms`, `ai_latency_ms`, `event_publish_lag_ms`, `api_error_total`. Local snapshot at `/admin/observability`; production export via Application Insights if configured.

---

## Docker support

For day-to-day dev, Redis in Docker is enough:

```bash
docker compose up -d redis
```

To run API + web + Redis together:

```bash
docker compose up --build
```

Web on port 8080, API on 4000. Production Dockerfiles are at `apps/api/Dockerfile` and `apps/web/Dockerfile`.

---

## Structured logging

The API logs with Pino as JSON. Each request gets a trace id; events carry `correlationId` and `tenantId`. Set `LOG_LEVEL=debug` to see bus traffic in detail. Optional Application Insights connection string sends traces and custom metrics to Azure Monitor.

---

## Clean domain modeling

Shared types, event schemas, and RBAC live in `packages/shared`. The API is split into vertical modules under `apps/api/src/modules/` (routes → service → repository). The web app mirrors that layout under `apps/web/src/features/`. That way permissions, DTOs, and event types cannot drift between client and server.

---

## Project layout

```
apps/api/          Express API
apps/web/          React + Vite SPA
packages/shared/   Domain, events, RBAC
docker-compose.yml
```

---

## License

MIT
