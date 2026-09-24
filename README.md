# personal-agent-dashboard

Personal dashboard application running locally with an automatic email-to-task agentic pipeline. Additional features to come, agentic and non-agentic.

The first feature is an **action-item board**: an upstream scheduled Claude task
writes a JSON envelope of action items from email; the dashboard ingests it into
a pool, and you schedule items onto days, reorder them, and check them off.

**Stack:** SvelteKit (Svelte 5) · TypeScript · Tailwind v4 + shadcn-svelte ·
Postgres 17 · Drizzle · Zod · Docker Compose · pnpm

## Run it

```sh
cp .env.example .env        # set TZ to your timezone: it defines "today"
docker compose up -d        # app on http://localhost:3000, restarts with Docker
```

The app applies migrations at startup. Drop envelope JSON files into
`data/incoming/` and click **Check for new**, or run
`curl -X POST localhost:3000/api/ingest`.

## Develop

```sh
pnpm install
docker compose up -d db     # just Postgres
pnpm dev                    # http://localhost:5173
pnpm check                  # svelte-check / types (includes table ↔ schema drift)
pnpm test                   # vitest against the dashboard_test database
pnpm ingest                 # ingest data/incoming/*.json from the CLI
pnpm db:generate --name x   # new migration after changing a table
```

The dev server and the Docker app share the same database.

## How it works

```
data/incoming/*.json ──▶ EnvelopeSource ──▶ Zod (once) ──▶ insert-or-ignore ──▶ Postgres
   (Drive later)          (swap point)                     + ingest_runs ledger     │
                                                                                    ▼
                                            UI ◀── page load / JSON API ◀── service.server.ts
```

- **Board:** the pool, then today and the next six days, then a "Later" column
  for anything further out. Drag cards between and within columns, or use a
  card's ⋯ menu. Click a title to edit. The circle marks an item done.
- **Roll-over:** unfinished items on a past day move to the top of today
  automatically. This happens on page load, with no background job.
- **Idempotent ingest:** a file that was already ingested is skipped. An item
  the producer sends again never overwrites your edits and never brings back
  one you deleted.

See [CONVENTIONS.md](CONVENTIONS.md) for structure, naming, the entity
pattern, and step-by-step recipes for adding features.
