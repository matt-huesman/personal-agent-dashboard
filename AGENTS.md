# Agent handoff: personal-agent-dashboard

The starting point for any coding agent (Claude Code or otherwise) working in
this repo. Read this first, then **[CONVENTIONS.md](CONVENTIONS.md)**, which
is the binding contract for structure, naming and patterns. This file is the
map, the current state, and the lessons learned. When the two disagree,
CONVENTIONS.md wins, and this file should be fixed.

## What this is

A **single-user, local-first personal dashboard**. It runs continuously in
Docker on the owner's Mac (SvelteKit app + Postgres), built to become the hub
that combines email, calendar and tasks, and later school and messaging.
There's no auth and no multi-tenancy, but it is always on, so it has to be
cheap to run and safe with secrets.

**What works today:**

| Area | What it does |
|---|---|
| **Board** (`/`) | Action-item pool plus a grid of 7 day panels and a "Later" column. Drag and drop, a project filter, time estimates, weekly ("sticky") tasks pinned to the top of their day, and a "show completed" toggle |
| **Calendar** (`/calendar`) | A seven-day view starting today (`?from=` pages by 7 days) that time-blocks each day's tasks automatically with a pure planner (batching by context, focus limits, breaks, a daily cap). Shows synced events. **Dragging a task block pins it** to that day and time |
| **Digests** (`/digests`) | Each email-agent run as a morning or evening briefing: FYIs, suggested replies, tasks added, spam |
| **Projects** (`/projects`) | Colour-coded themes that tasks belong to |
| **Integrations** (sidebar → `?panel=integrations`) | A catalog that renders from manifests. Google Calendar (OAuth), iCal feeds (URL), Gmail (OAuth, several accounts), and the email-digest agent |
| **Email agent** | A scheduled **Claude Code routine** in the cloud (7am and 5pm Central) triages new mail from every linked Gmail account into one envelope, which the dashboard ingests |

Stack: SvelteKit 2 / Svelte 5 (runes) · TypeScript 6 · Tailwind v4 +
shadcn-svelte (copied into `src/lib/components/ui`) · Postgres 17 · Drizzle ·
Zod 4 · Vitest · pnpm 10 · Docker Compose (adapter-node image).

## Commands

```sh
export PATH="$HOME/.local/bin:$PATH"   # pnpm lives here on this machine; NOT on PATH by default
pnpm check                             # svelte-check: types + table↔schema drift checks
pnpm test                              # vitest (78 tests) against the dashboard_test DB
pnpm dev                               # http://localhost:5173 (needs: docker compose up -d db)
pnpm db:generate --name <change>       # new SQL migration after changing a table.server.ts
docker compose up -d --build           # rebuild/restart the always-on app at http://localhost:3000
pnpm ingest | producer | drive:auth    # CLIs (see README)
```

Migrations apply automatically on app start, `pnpm ingest`, and test runs
(`hooks.server.ts` `init` → `migrate()`). There are 7 so far (`drizzle/0000`–`0006`).

## Architecture map

```
                    ┌──────────── src/lib/features/<feature>/ ────────────┐
 routes (+page,     │ schema.ts (Zod: THE definition)  table.server.ts   │
 api/<feature>) ──▶ │ service.server.ts (only writer)  transitions.ts    │──▶ Postgres
                    │ fields.ts (form config)  api.ts  components/        │
                    └──────────────────────────────────────────────────────┘
 features: action-items · projects · planner (pure algorithm) · calendar · digests · email

 Integrations (src/lib/integrations/): manifest (data) + connector (pull) → streams (Zod, the boundary)
   → sync engine (cursor + transaction) → mappers (once per stream) → calendar_events / email_messages
   Freshness: browser loop (lazy) + opt-in background sync (Gmail). Credentials AES-GCM in DB (APP_SECRET).

 Email pipeline:
   Gmail accounts → gmail connector → email_messages → publishInbox → encrypted inbox batch (INBOX_KEY) → Drive
   → cloud routine: pnpm producer start → Claude triages (agents/email-digest.md) → pnpm producer publish
   → envelope on Drive (lists input_batches) → dashboard ingest (src/lib/ingest) → board + digests
   → consumeBatches deletes the processed batches from Drive
```

Where to read, by topic:

| Topic | Read |
|---|---|
| Patterns, naming, recipes | `CONVENTIONS.md` |
| Integrations architecture and status | `docs/integrations-plan.md` |
| Google / Drive / Calendar / Gmail setup (the owner's manual steps) | `docs/google-setup.md` |
| The cloud agent's instructions (versioned prompt) | `agents/email-digest.md` |
| Planner principles (in the header comment) | `src/lib/features/planner/planner.ts` |
| Task lifecycle | `src/lib/features/action-items/transitions.ts` + CONVENTIONS "State and commands" |

## Rules that aren't negotiable

The full list is in CONVENTIONS.md. These are the ones most often broken:

1. **Zod is the single source of truth.** Tables are written by hand, with
   column names identical to the Zod keys (snake_case end to end, no mapping
   layer), and pinned by `const _drift: Equal<typeof table.$inferSelect,
   Record> = true`. `pnpm check` fails on drift.
2. **Validate once, at a boundary** (ingest, HTTP bodies via `parseBody`,
   connector output via `streams.ts`, the producer's draft). After that, trust
   the types: no defensive re-checks and no try/catch around internal calls.
   try/catch only belongs at external boundaries (network, files, providers).
3. **`service.server.ts` is the only writer for its feature.** Status and
   placement change only through named commands (`move`, `pin`, `complete`,
   …), never through a generic PATCH. Invariants between columns are
   Postgres `CHECK` constraints.
4. **Server-only code is `*.server.ts` or under `src/lib/server/`.** Type-only
   imports from them into client code are fine.
5. **UI is data-driven.** Forms come from `fields.ts` + `FieldInput`; the nav
   from `nav.ts`; the integration catalog from manifests. A new field or
   integration should need no new UI plumbing.
6. **No speculative abstractions and few dependencies.** Extract when the
   second use exists. Every dependency added so far was deliberate: ask
   whether one is needed.
7. **Keep the always-on footprint small.** No new background timers or
   polling unless something genuinely depends on them (see `backgroundSync`).
8. **Secrets:** never log them, never send them to the browser, and request
   the narrowest scopes. Integration credentials are `encrypt()`ed. Inbox
   batches are sealed with `INBOX_KEY`. `.env` is git-ignored, and the repo is
   **public**.

## Domain rules (quick reference)

- **Action item states:** `pool` (no day), `scheduled` (day), `done`.
  - Soft delete (`deleted_at`) keeps ingested ids from coming back.
  - Ingest is insert-or-ignore: once an item is in, the user owns it.
  - New items go to the top of their container. Weekly (`sticky`) items are
    always first in their day: order is `sticky desc, position asc`,
    enforced in the service.
- **Time passing** (applied lazily on board or calendar load; no cron):
  - Unfinished items from past days roll into today and **lose their pin**.
  - Sticky items (done or not) jump to the same weekday next week and
    **keep their pin**.
- **Pins:** `pinned_start` (minutes into the day) requires a day.
  - Kept when moving between days; dropped when moving to the pool.
  - The planner places pinned tasks exactly, never splits them, and counts
    them toward the daily cap.
- **Planner:** `planDay()` is pure: no I/O, no Dates, no app types. It runs
  in the browser (re-planned every minute) and on the server. Grouping
  policy (`contextOf`: project → email → other) lives in
  `features/calendar/plan.ts`, not in the algorithm. Every tunable is a
  `plannerSettings` field stored in the DB.
- **Streams:**
  - `events` are **snapshots**: storage is made to match each pull (7 days
    back to 60 ahead).
  - `messages` are **append**: insert-or-ignore, pruned after 14 days.
  - The engine saves a connector's `cursor` in the same transaction as its
    data.
- **Email ids** are `"<account>/<gmail id>"` everywhere after the connector,
  so they're unique across accounts and links open the right mailbox. Older
  digests use bare ids; `gmailLink()` handles both.

## How to verify work before handing back

1. `pnpm check`: zero errors and zero warnings (this has been kept clean).
2. `pnpm test`: all green. Tests hit the real Postgres test DB; add every new
   table to `TABLES` in `src/test/db.ts`. Fake external APIs **must enforce
   scopes**: see `fakeGoogle` in
   `integrations/google-calendar/connector.test.ts`. A real bug slipped
   through because an earlier fake didn't.
3. For UI changes, drive the real app in a browser. Use **the test database**,
   not the owner's data: `DATABASE_URL=…/dashboard_test pnpm dev --port 5174`,
   seed through the API, then screenshot or script it (headless Chrome via
   `playwright-core` in a scratch dir works). Tests truncate that DB, so
   re-seed after running them.
4. `docker compose up -d --build`, then check that the pages return 200. The
   owner uses the Docker app day to day.

## Gotchas and lessons learned

- **Don't touch the owner's real data.** Dev (`:5173`) and Docker (`:3000`)
  share the `dashboard` DB, which holds real tasks. A test-DB dev server still
  reads the **real Drive folder** through `.env` (it only reads Drive, but
  real digests appear in the test DB).
- **Zod 4 applies `.default()` inside `.partial()`.** Build edit/PATCH
  schemas from default-free field schemas (see `content` in
  `action-items/schema.ts`), or partial updates will reset fields.
- **Zod enum `.options` is typed as an array, not a tuple.** Declare the
  values `as const` and use them in both `z.enum()` and Drizzle's
  `text({ enum })`.
- **Zod schema types are invariant.** A heterogeneous registry erases the
  config type deliberately (`registry.ts` `erase`, `connectors.server.ts`).
- **SvelteKit forbids extra exports from `+page.server.ts`.** Put shared
  constants in a lib module.
- **Google scopes:** Calendars.get (`/calendars/primary`) is **not** covered
  by `calendar.calendarlist.readonly`; use `/users/me/calendarList/primary`.
  Check which scopes were actually granted (`missingScopes`), since consent
  screens let users untick them.
- **TypeScript is pinned to 6.x;** svelte-check doesn't support 7.
  `tsx` scripts resolve `$lib` through `.svelte-kit/tsconfig.json`, so run
  `svelte-kit sync` (the `prepare` script) on a fresh clone.
- **shadcn-svelte CLI:** `init` needs a preset **code**, not a name, and has
  interactive prompts. `add <component> -y` works non-interactively. The
  `cn` package is shadcn's own and intended.
- **Loading SvelteKit layouts and pages in parallel:** pages that depend on
  the layout's auto-ingest call `await parent()` first.
- **The Docker build** needs a placeholder `DATABASE_URL`; this is already
  handled in the Dockerfile.
- **The owner's `.env`** holds `APP_SECRET` and `INBOX_KEY`, generated by
  agents. Losing `APP_SECRET` means reconnecting integrations. Never
  regenerate existing values.

## External state (verify with the owner before assuming)

These live outside the repo and only the owner can change them:

- **Google Cloud project,** in production status, used by the dashboard's
  OAuth client. Enabled: Drive API, Calendar API, and (for the Gmail
  migration) the Gmail API. Scopes: `drive.file`, the two calendar read-only
  scopes, and `gmail.readonly`. An optional separate web client
  (`GOOGLE_INTEGRATIONS_CLIENT_*`) exists if the desktop client's redirect is
  rejected.
- **Drive:** the "Agent Dashboard Inbox" folder (`DRIVE_FOLDER_ID`) carries
  envelopes one way and inbox batches the other.
- **Cloud routine** (claude.ai/code/routines), "Email digest": runs on
  `main`. Its environment ("Default") holds `GOOGLE_CLIENT_ID/SECRET`,
  `GOOGLE_REFRESH_TOKEN`, `DRIVE_FOLDER_ID` and `INBOX_KEY`. Its prompt is in
  `docs/google-setup.md` step 5. The Gmail migration needs the owner to have
  linked accounts in the dashboard, added `INBOX_KEY` to that environment, and
  removed the routine's Gmail connector. Confirm this is done if email
  digests look wrong.
- **Portfolio site** (`../matthuesman.com`, GitHub Pages): hosts
  `/personal-dashboard`, `/privacy` and `/terms` for the OAuth consent screen.

## Roadmap and known gaps

From `docs/integrations-plan.md`, plus limitations noted along the way:

- **Next integrations:**
  - Canvas (a token → `task` stream: assignments with due dates, courses
    suggested as projects). The `task` stream and generic provenance columns
    on `action_items` get added when the second task source arrives.
  - Messaging summaries through the agent path.
  - Outbound actions (focus blocks to Google Calendar, sending approved
    replies), always as explicit user commands.
- **Known gaps:**
  - The phone layout is basic: the sidebar stacks above the content.
  - Weekly tasks have no per-week completion history; they're one row that
    advances.
  - The planner doesn't pull in pool tasks; weekends use weekday hours; no
    completed-task history view.
  - Moving synced events locally was considered and deliberately **not**
    built; only tasks are movable.

## Working with the owner

- **Plan before foundations.** For new subsystems, propose structure,
  decisions and trade-offs, then build once approved. Smaller features:
  state the design briefly and build.
- **Ask when a request is genuinely ambiguous** in a way that changes what
  gets built (for example "move events": synced events or tasks?). Otherwise
  choose sensibly and say so.
- **Manual steps get clear, numbered requests** (Google Cloud, routine
  settings), with the reason behind each one.
- **The owner commits and pushes themselves.** Don't commit or push without
  asking. Pushing changes what the cloud routine runs.
- **Report honestly** what was verified and how, and what wasn't (for
  example "OAuth not tested live").
