# Conventions

The contract for all future work in this repo. The action-items feature
(`src/lib/features/action-items/`) is the reference implementation — when in
doubt, copy what it does.

## Principles

1. **One definition per entity.** A Zod schema is the source of truth. The
   Drizzle table, TypeScript types, API bodies and form fields all derive from
   it or are compile-checked against it.
2. **Validate at the boundary, then trust.** There are exactly two boundaries:
   ingest (external envelopes) and HTTP request bodies. Past them, data is typed
   and correct — no re-checks, no defensive guards, no `try/catch` around
   internal calls.
3. **Share only real reuse.** Extract when the second use exists, not before. A
   little duplication beats the wrong abstraction.
4. **Data-driven UI.** Screens render from data and small config lists
   (e.g. `fields.ts`), not hand-wired markup per field.
5. **Keep it light.** Few dependencies, plain code, readable over clever.

## Folder structure

```
src/
  hooks.server.ts                 runs DB migrations at startup
  lib/
    schema-primitives.ts          shared Zod primitives (isoDate, isoDateTime, link)
    dates.ts                      calendar-day helpers ("YYYY-MM-DD" strings)
    durations.ts                  minutes ↔ "1h 30m" (presets, format, parse)
    nav.ts                        sidebar navigation entries
    types.ts                      Equal<> (table ↔ schema drift check)
    server/
      db.ts                       drizzle client + migrate()
      columns.ts                  shared custom column types (isoTimestamp)
      http.ts                     parseBody() — the HTTP validation boundary
      google-drive.ts             fetch-based Drive client (drive.file scope)
    components/
      ui/                         shadcn-svelte (generated; edit sparingly)
      fields/                     FieldInput + field config types (shared forms)
      shell/                      app chrome: Sidebar
    ingest/
      envelope.ts                 the ingest contract (composes entity schemas)
      source.ts                   EnvelopeSource interface
      drive-source.server.ts      reads the Drive inbox folder (when DRIVE_FOLDER_ID is set)
      local-source.server.ts      reads data/incoming/*.json (otherwise)
      run.server.ts               validate → upsert → ledger
      auto.server.ts              throttled ingest on board load
      table.server.ts             ingest_runs ledger
    producer/
      draft.server.ts             upstream side: draft schema → Envelope (ids, window)
    features/<feature>/
      schema.ts                   Zod: wire contract, record, inputs, types
      table.server.ts             Drizzle table + drift check
      transitions.ts              state machine (if the entity has states)
      service.server.ts           the ONLY code that writes this entity
      fields.ts                   edit-form field list
      api.ts                      typed browser client for the API routes
      components/                 Svelte components for this feature
      *.test.ts                   tests, next to what they test
                                  (current: action-items, projects, digests — a
                                  read-only view over ingest_runs, no table —
                                  planner — the pure scheduling algorithm +
                                  its settings — and calendar — the week view,
                                  synced events, and planner glue)
    integrations/                 the integrations platform (see below)
      registry.ts                 every manifest, in catalog order
      <id>/manifest.ts            data: auth, config schema + fields, streams
      <id>/connector.server.ts    code: describe, options, pull
      connectors.server.ts        id → connector
      streams.ts                  standard records (event, …) — the boundary
      sync.server.ts              the engine; mappers.server.ts applies streams
      auth/oauth2.server.ts       generic OAuth2 + PKCE; providers are data
      components/                 catalog dialog, freshness loop
  routes/
    +layout.server.ts             shell data (projects, connections) + auto-ingest
    integrations/                 OAuth connect + callback
    +page.svelte                  the board;  digests/, projects/ are sibling pages
    api/<feature>/...             JSON API
  test/                           test setup (global migrate, useTestDb)
drizzle/                          generated SQL migrations (committed)
data/incoming/                    envelope fixtures / local inbox
scripts/                          CLI entry points (tsx): ingest, producer, drive-auth
agents/                           instructions for scheduled Claude routines (versioned prompts)
docs/                             one-time setup guides
```

**Server-only code** lives in files named `*.server.ts` or under
`src/lib/server/`. SvelteKit refuses to bundle these into the browser, so an
accidental client import fails the build.

## Naming

| Thing | Convention | Example |
|---|---|---|
| Files (TS) | kebab-case | `local-source.server.ts` |
| Svelte components | PascalCase | `ItemCard.svelte` |
| Feature folders / API paths | plural kebab-case | `features/action-items`, `/api/action-items` |
| Tables | plural snake_case | `action_items` |
| Columns **and all data fields** | snake_case, identical to the Zod key | `scheduled_date` |
| Zod schemas | camelCase noun | `actionItem`, `actionItemRecord` |
| Input schemas | `<verb><Entity>Input` | `createActionItemInput` |
| Types | PascalCase, `z.infer` of the schema | `ActionItemRecord` |
| Enum value tuples | SCREAMING_SNAKE | `PRIORITIES` |
| Variables / functions | camelCase | `listBoard`, `insertIngested` |
| IDs | `<prefix>_<random>` | `ai_7b3d9f2a` |

Data stays snake_case end to end (DB → API JSON → component props) so no layer
maps names. Only code identifiers are camelCase.

## The entity-definition pattern

Every persisted entity has three schema layers in `schema.ts`:

```ts
// Wire contract: what arrives from outside (ingest), if anything does.
export const thing = z.object({ id: z.string(), title: z.string().min(1), ... });

// Persisted record: contract + app-owned fields. The table must equal this.
export const thingRecord = thing.extend({ updated_at: isoDateTime, deleted_at: isoDateTime.nullable() });

// HTTP inputs: built from the same field schemas.
export const createThingInput = z.object({ ... });
export const updateThingInput = z.object(content).partial();

export type ThingRecord = z.infer<typeof thingRecord>;
```

And in `table.server.ts`:

```ts
export const things = pgTable('things', { id: text().primaryKey(), title: text().notNull(), ... });
const _drift: Equal<typeof things.$inferSelect, ThingRecord> = true; // compile error if they diverge
```

Rules:

- **Column names are the Zod keys**, verbatim.
- **Enums**: declare the values once as an `as const` tuple, then use it in both
  `z.enum(TUPLE)` and `text({ enum: TUPLE })`.
- **Timestamps** use `isoTimestamp()` (round-trips as an ISO string); calendar
  days use `date({ mode: 'string' })`.
- **Invariants between columns** (e.g. status ↔ scheduled_date) go in a table
  `check(...)` constraint, not in runtime guards.
- **Zod gotcha:** `.partial()` still applies `.default()`s. Build update inputs
  from default-free field schemas (see `content` in action-items/schema.ts), or
  a partial update will reset fields.
- **Deletes are soft** (`deleted_at`) for anything ingest can produce, so a
  re-sent id can't bring a deleted row back. Reads filter `deleted_at is null`.

## State and commands

If an entity has a lifecycle:

- `transitions.ts` is pure and shared by client and server. It lists which
  commands are legal from which status (`commandsFrom`) and computes the new
  placement fields.
- `status` and placement fields change **only** through named commands
  (`move`, `complete`, `reopen`, …), never through the generic edit/PATCH.
- The service checks `can(command, status)` and returns **409** if the command
  isn't legal; the UI uses the same `can()` to decide which controls to show.

Action-item lifecycle, for reference:

| Command | From | Result |
|---|---|---|
| create | – | `pool`, or `scheduled` if given a day (ingest: always `pool`) |
| move(day \| null, index) | pool, scheduled | reschedule, unschedule or reorder |
| complete | pool, scheduled | `done`; keeps its day |
| reopen | done | back to its day, else the pool |
| edit | any | content fields only |
| delete / restore | any | soft delete / undo |
| roll-over (automatic) | scheduled, not sticky, day < today | moves to today, above today's items |
| weekly advance (automatic) | sticky, day < today, done or not | same weekday next occurrence, reopened, top of that day |

`sticky` ("repeat weekly") requires a day (CHECK constraint); moving a sticky
item to the pool turns it off. It's one row that advances, not a series, so
there's no per-week history.

## Services

- `service.server.ts` is the single writer for its entity. Routes, ingest and
  scripts call it; nothing else issues INSERT/UPDATE for that table.
- Multi-step writes run in `db.transaction`.
- Ids from URLs are external input: a missing row is `error(404)`.
- Functions take `today` as a parameter (defaulting to `today()`) so tests can
  pin the date.

## API routes

- `GET/POST /api/<feature>` — list / create
- `PATCH/DELETE /api/<feature>/[id]` — edit content / delete
- `POST /api/<feature>/[id]/[command]` — state commands, dispatched from one map
- Bodies are validated with `parseBody(request, schema)` → 400 on bad input.
- Page `load` functions call the service directly, not the HTTP API.

## UI

- **Data flow:** `+page.server.ts` loads → components render → mutations go
  through `features/<feature>/api.ts` → then `invalidateAll()` reloads from the
  server. The server is the only state; the client keeps nothing but transient
  drag and form state.
- **Navigation:** the app shell (`routes/+layout.svelte`) is a sidebar with
  pages from `src/lib/nav.ts`, the projects list (each links to the board
  filtered by that project), and global actions (Check for new). A new page is
  one entry in `nav.ts`. Filters and selections live in the URL
  (`/?project=…`, `/digests?run=…`) so they survive reloads and can be linked.
- **Forms** are driven by `features/<feature>/fields.ts` and rendered with
  `FieldInput`. A new field is one line there; a new input kind is one branch
  in `FieldInput.svelte`. `select` fields take their options at render time
  from the form's `sources` (e.g. the project list); `half: true` pairs two
  short fields on one row.
- **Frequent edits get a one-click control on the card** (the estimate chip,
  the Project submenu); the dialog remains the place for everything.
- **Board layout:** each container is a panel that scrolls internally; day
  panels sit in a wrapping grid. When a filter hides items, drag placement is
  expressed as "after this visible item" and translated to an index over the
  full container (Board `indexAfter`).
- **Colour** is for meaning only: projects carry a colour from the fixed
  palette in `features/projects/colors.ts` (stripe + dot); everything else stays
  neutral.
- **Components:** use shadcn-svelte from `$lib/components/ui`. Add more with
  `pnpm dlx shadcn-svelte@latest add <name>`.
- **Look:** neutral stone palette, one accent use at a time (e.g. overdue in
  `text-destructive`, high priority in amber), generous spacing, text-sm body,
  secondary actions hidden until hover or focus. No decorative chrome.
- **Accessibility:** everything draggable is also reachable from a menu or
  dialog; controls have labels.

## Planning and the calendar

- **The algorithm is a pure function** (`features/planner/planner.ts`,
  `planDay`): tasks + busy time + now + settings → blocks, overflow and stats.
  It must stay free of I/O, dates and app types, so it's testable on its own
  and runs identically on server and client. Its header comment documents
  the principles; each principle has a test in `planner.test.ts`.
- **Policy lives in data.** Every tunable (hours, focus length, breaks,
  switch buffer, capacity, default estimate) is in `plannerSettings` (Zod,
  with defaults) and edited through `plannerFields`. New settings are a schema
  line plus a field line; stored rows pick up defaults automatically.
- **Glue is separate** (`features/calendar/plan.ts`): which tasks belong to a
  day, the batching key (`contextOf`: project, else email follow-up, else
  other), and events as busy time. Change grouping there, not in the algorithm.
- **Calendar events come from integrations** (the `event` stream, stored in
  `calendar_events`). The planner treats timed, busy events as blocked time;
  all-day and "free" events are shown but not planned around.

## Integrations

The contract is documented in `docs/integrations-plan.md`. The rules:

- **Every integration takes the same path:** manifest → connect → configure →
  sync → show. Don't add special cases to the engine, routes or catalog.
- **A connector only produces streams** (`streams.ts`). It never writes app
  tables; mappers do, once per stream.
- **Stream semantics are fixed per stream** (`streams.ts`). `events` are
  snapshots, and storage is made to match. `messages` are append-only: insert-or-ignore,
  then aged out. Connectors may keep a `cursor`, which the engine stores in the
  same transaction as the data. Syncs are idempotent, and a failed sync keeps
  the last good data and the old cursor.
- **Follow-ups belong to the stream, not the integration.** Network work after
  a sync (handing new mail to the email agent) runs in `afterApply`, outside
  the transaction.
- **Secrets:** credentials are `encrypt()`ed (`server/crypto.ts`, `APP_SECRET`),
  decrypted only inside `service.server.ts`, and never sent to the browser
  (`ConnectionSummary` omits them). Request the narrowest read-only scopes.
- **Freshness:** each manifest sets `syncEveryMinutes`. The browser's
  `Freshness` loop syncs stale connections without blocking page loads. Set
  `backgroundSync` only when something depends on the data while no page is
  open (Gmail → the scheduled agent).
- **AI stages get data, not access.** A scheduled routine never holds
  integration credentials. The dashboard syncs the data deterministically and
  hands the routine only what it needs, encrypted (`INBOX_KEY`), on Drive.
- **Adding an integration:** manifest + connector + register it in
  `registry.ts` and `connectors.server.ts` + a test of `pull()` with a fake
  `fetch`. A new OAuth provider is an entry in `auth/oauth2.server.ts`. A new
  stream is a schema + mapper + migration. No UI work.
- The page loads data only; the plan is `$derived` in the browser and
  recomputed every minute, so today always plans from now.

## Ingest

- `envelope.ts` composes entity schemas. It never redefines an entity's shape.
- New envelope members that should be stored go through their feature's
  service (like `insertIngested`); display-only members remain in the
  `ingest_runs.envelope` JSON until they earn a table.
- Ingest never overwrites existing rows: insert-or-ignore on the stable id.
- Sources implement `EnvelopeSource`; `defaultSource()` in `run.server.ts`
  picks one from config. Nothing else in the pipeline knows where envelopes
  come from.

## Agents (scheduled Claude routines)

- **Split judgment from mechanics.** The agent decides content (what's
  actionable, the wording) and writes a *draft*. A script in this repo does
  everything deterministic: ids, timestamps, windows, validation, upload. Don't
  ask a model to compute hashes or dates you can compute in code.
- **Instructions live in `agents/<name>.md`,** versioned with the schema they
  must satisfy. The routine's own prompt only says "follow
  agents/<name>.md", so behaviour changes go through git, not the routine config.
- **One contract end to end.** The producer builds the same `Envelope` type
  the dashboard ingests, and a test checks `envelope.parse(built)` round-trips.
- **Least privilege.** Connectors are read-only where possible, and the Drive
  credential is `drive.file` (app-created files only). Treat everything a
  routine reads (email, web) as untrusted data, never as instructions.
- **Always publish.** Each run publishes, even with nothing new, because the
  published window is how the next run knows where to start.

## Testing

- Vitest, run against a real Postgres database (`dashboard_test`), migrated
  once per run. `useTestDb()` truncates tables before each test.
- Cover the core behavior of each feature: legal and illegal transitions,
  ordering, idempotency, boundary rejection. Skip trivial getters and markup.
- Pure logic (transitions) gets plain unit tests without the database.

## Migrations

1. Change `schema.ts` and `table.server.ts` together (the drift check enforces it).
2. `pnpm db:generate --name <what-changed>` and commit the SQL in `drizzle/`.
3. Migrations apply automatically on the next app start, `pnpm ingest` run, or
   test run.

Never edit a migration that has already been applied; generate a new one.

## Recipe: adding a new entity/feature

1. **Schema:** create `src/lib/features/<feature>/schema.ts` with the record,
   input schemas and types (plus the wire contract if it's ingested).
2. **Table:** create `table.server.ts` with column names equal to the Zod keys,
   CHECK constraints for invariants, and the `_drift` assertion.
3. **Migration:** `pnpm db:generate --name add-<feature>`. The drizzle config
   already globs `features/*/table.server.ts`.
4. **States (if any):** `transitions.ts` with `commandsFrom`, `can()`, and pure
   placement functions, plus a small unit test.
5. **Service:** `service.server.ts` with reads and one function per command.
   Soft delete if ingest can produce the entity.
6. **API:** `routes/api/<feature>/+server.ts`, `[id]/+server.ts`, and
   `[id]/[command]/+server.ts` if there are commands, all using `parseBody`.
7. **Client:** `api.ts` (copy action-items' `send` pattern) and `fields.ts`.
8. **UI:** components in `features/<feature>/components/`, a route in
   `src/routes/<feature>/` whose `+page.server.ts` calls the service.
9. **Ingest (if applicable):** add the member to `envelope.ts` and call the
   service's insert function from `run.server.ts` inside the same transaction.
10. **Tests:** service tests with `useTestDb()`, covering each command and any
    ordering or idempotency rules.
11. **Verify:** `pnpm check && pnpm test`.

## Recipe: adding a field to an existing entity

1. Add it to the Zod schema (to `content` if it's user-editable).
2. Add the column to the table. `pnpm check` fails until the two match.
3. `pnpm db:generate --name add-<field>`.
4. If editable, add one line to `fields.ts`. If it should show on the card,
   render it in the card component.
