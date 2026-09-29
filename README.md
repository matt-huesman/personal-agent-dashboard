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

The app applies migrations at startup. Without Google configured, it ingests
envelope JSON from `data/incoming/`. To connect Drive and the scheduled email
agent, follow [docs/google-setup.md](docs/google-setup.md).

New envelopes are picked up automatically when the board loads (at most once
every 10 minutes), or right away with **Check for new**.

## Develop

```sh
pnpm install
docker compose up -d db     # just Postgres
pnpm dev                    # http://localhost:5173
pnpm check                  # svelte-check / types (includes table ↔ schema drift)
pnpm test                   # vitest against the dashboard_test database
pnpm ingest                 # ingest from Drive (or data/incoming/) from the CLI
pnpm db:generate --name x   # new migration after changing a table
pnpm drive:auth             # one-time Google authorization (docs/google-setup.md)
pnpm producer start|publish # the email agent's CLI (agents/email-digest.md)
```

The dev server and the Docker app share the same database.

## How it works

```
 CLOUD (Claude Code routine, on a schedule)
 Gmail ──▶ Claude classifies ──▶ draft.json ──▶ pnpm producer publish ──▶ Google Drive
          (agents/email-digest.md)             (ids, window, Zod-checked)   "Agent Dashboard Inbox"
                                                                                  │
 LOCAL (Docker)                                                                   ▼
 UI ◀── page load / JSON API ◀── service.server.ts ◀── insert-or-ignore ◀── Zod ◀── DriveSource
```

- **The producer and the dashboard share one contract:** the producer builds
  its envelope with the same Zod schema the dashboard ingests with
  (`src/lib/ingest/envelope.ts`).
- **Windows chain:** each run reads mail from the end of the previous
  published run up to now, so no mail is missed or read twice, even if a run
  fails.

- **Board:** the pool beside a wrapping grid of day panels (today + six days,
  then "Later"). Each panel scrolls on its own. Drag cards between and within
  panels, or use a card's ⋯ menu. Click a title to edit; the circle marks it done.
- **Weekly tasks:** mark a task on a day "Repeat weekly" (⋯ menu or edit
  dialog). Checked off or not, it comes back on that weekday next week, and it
  never rolls into the following day. Weekly tasks stay pinned at the top of
  their day.
- **Completed tasks** are hidden unless **Show completed** is on (remembered
  per browser); checking one off offers Undo.
- **Estimates:** the clock chip on every card sets an estimate in one click
  (15m–4h or custom); day headers total them and flag unestimated items.
- **Projects:** colour-coded themes (stripe + dot on each task). The sidebar
  lists them with open counts; click one to filter the board. Manage at `/projects`.
- **Calendar:** a week view that time-blocks each day's tasks automatically.
  It batches tasks by project to minimise context switching, caps focus
  sessions (default 90 min) with breaks, puts urgent and deep work first,
  never plans in the past, and flags what won't fit instead of cramming it in.
  Tune it under **Planning**. Calendar integrations plug in as busy time
  (`features/calendar/source.ts`).
- **Digests:** each email-agent run as a morning/afternoon/evening briefing:
  FYIs, suggested replies (copyable), new tasks and possible spam, each linked
  to its email.
- **Roll-over:** unfinished items on a past day move to the top of today
  automatically. This happens on page load, with no background job.
- **Idempotent ingest:** a file that was already ingested is skipped. An item
  the producer sends again never overwrites your edits and never brings back
  one you deleted.

See [CONVENTIONS.md](CONVENTIONS.md) for structure, naming, the entity
pattern, and step-by-step recipes for adding features.
