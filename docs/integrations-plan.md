# Integrations platform: plan

Status: **phases 0–1 built**, plus the iCal feed from phase 2 and **Gmail
(multi-account) with the email agent moved onto the platform**. Code is in
`src/lib/integrations/`. Where the build differs from this plan:

- **Stream semantics decide storage.** `events` are **snapshots**: the
  complete set for a window (7 days back to 60 ahead), and storage is made to
  match. `messages` are **append**: new since the connector's cursor, stored
  insert-or-ignore and pruned after 14 days. Connectors can keep a cursor,
  which the engine stores and only advances when the data is stored.
- **Email is split into a deterministic source and an AI stage.** The
  `gmail` connector (one connection per account) syncs mail into the
  dashboard. New mail is handed to the scheduled Claude routine as inbox
  batches on Drive, encrypted with `INBOX_KEY`. The routine triages every
  pending batch across all accounts in one pass. Its envelope lists the
  batches it covered (`input_batches`); when that envelope is ingested, the
  batches are marked consumed and deleted from Drive. Message ids are
  `<account>/<id>`, so they stay unique and link to the right mailbox.
- **Background sync, where something depends on it.** Manifests can opt in
  (`backgroundSync`). Gmail does, so mail is ready before the routine's
  scheduled runs even with no page open: one 5-minute check in the server
  process.
- **Freshness is driven by the browser.** Page loads never wait on a
  provider. The browser syncs stale connections right after load, when the tab
  regains focus, and every minute, then refreshes the page's data.
  **Check for new** syncs everything, and each connection has **Sync now**.
- **Read-only is visible.** Each manifest declares `readOnly`, every stored
  event carries it, and the calendar marks those events with a lock.
- **Decisions made:** Google OAuth for Google Calendar, iCal as the generic
  fallback; credentials encrypted in Postgres with `APP_SECRET`; lazy sync
  plus Sync now plus the freshness loop; the platform first.

## Why

On its own, each part of the dashboard sees only a slice of the picture. The
board knows your tasks and the calendar knows your hours, but the rest is
elsewhere: meetings in Google Calendar, assignments in Canvas, requests in
email and Slack. The value is in putting them together: the planner can't
plan around a meeting it doesn't know about. So integrations shouldn't be
one-off features. They should be a platform, where each new source is filling
in a known template rather than new plumbing.

## Principles

1. **Every integration takes the same path:** manifest → connect (auth) →
   configure → sync (pull → validate → map → store) → show. There are no
   special cases; the email agent becomes one integration among others.
2. **Integrations produce standard records, never app rows.** A connector
   turns its source's data into a small set of canonical **streams**
   (`event`, `task`, `digest`). Mapping a stream into the app is written
   **once per stream**, not once per integration. A second calendar source
   is then a connector alone; the storage, display and planner wiring
   already exist.
3. **Validate once, at the connector boundary.** Each stream has a Zod
   schema, as the envelope does today. Everything after the connector trusts
   the data.
4. **Idempotent and incremental.** Every record has a stable
   `(connection, external_id)` key. Syncs use the provider's cursor (sync
   token, `updated_since`) when it has one. Running a sync twice changes
   nothing.
5. **The manifest is data.** An integration's name, category, auth type,
   config form and streams are a manifest, and the catalog UI renders from
   manifests. Adding an integration adds no UI code.
6. **Credentials stay on the server, encrypted, with the narrowest scope that
   works.** They never reach the browser, and each can be revoked on its own.
7. **Deterministic by default, an agent only for judgment.** Structured data
   (calendar events, assignments) uses a direct API connector, which is
   predictable, cheap and testable. Unstructured data that needs judgment
   (triaging email, summarising Slack threads) goes through a Claude routine.
   Both paths produce the same streams.

## Architecture

```
                  ┌──────────── Integration catalog (UI, from manifests) ────────────┐
                  │  browse · connect · configure · sync now · disconnect             │
                  └───────────────────────────────┬───────────────────────────────────┘
                                                  │
 ┌─ Auth ─────────────────┐   ┌─ Connectors ──────▼──────────────┐   ┌─ Stream mappers ────────┐
 │ oauth2 (Google, Slack) │   │ google-calendar  → event          │   │ event  → calendar_events│
 │ token  (Canvas)        │──▶│ canvas           → task, event    │──▶│ task   → action_items   │
 │ url    (ICS feeds)     │   │ ics              → event          │   │ digest → digests        │
 │ agent  (Claude routine)│   │ email-agent      → task, digest   │   └────────────┬────────────┘
 └───────────┬────────────┘   └──────────────────┬────────────────┘                │
             │                                   │ pull(ctx, cursor)               ▼
     connections (encrypted creds, config, cursors)   sync_runs ledger      Board · Calendar · Planner · Digests
```

### Pieces

| Piece | Where | What |
|---|---|---|
| Manifest | `src/lib/integrations/<id>/manifest.ts` | Data: id, name, description, category, icon, auth spec, config schema and fields, streams, sync interval |
| Connector | `src/lib/integrations/<id>/connector.server.ts` | Code: `options()` for config choices, `pull()` for records, and later `push()` |
| Registry | `src/lib/integrations/registry.ts` | The list of manifests; the only file touched to add one |
| Auth providers | `src/lib/integrations/auth/` | `oauth2.server.ts` (authorize, callback, refresh, revoke; generic) and `providers/google.ts` (endpoints). One Google client serves Drive, Calendar and Gmail |
| Credential store | `src/lib/integrations/credentials.server.ts` | AES-256-GCM encryption with `APP_SECRET` from `.env` |
| Streams | `src/lib/integrations/streams.ts` | Zod schemas for `event`, `task` and `digest` records |
| Sync engine | `src/lib/integrations/sync.server.ts` | Per connection: pull, validate, map, store the cursor, log to `sync_runs` |
| Mappers | `src/lib/integrations/mappers/<stream>.server.ts` | One per stream; they write through the owning feature's service |

### Contracts (sketch)

```ts
// A manifest is data; the catalog, connect flow and config form all render from it.
type IntegrationManifest<Config> = {
  id: string;                       // 'google-calendar'
  name: string;
  description: string;
  category: 'calendar' | 'email' | 'school' | 'messaging' | 'storage';
  icon: string;
  auth:
    | { kind: 'oauth2'; provider: 'google' | 'slack'; scopes: string[] }
    | { kind: 'token'; label: string; help: string }   // e.g. a Canvas access token
    | { kind: 'url'; label: string }                    // e.g. an ICS feed
    | { kind: 'agent'; routine: string };               // delivered by a Claude routine
  config: z.ZodType<Config>;        // what the user chooses, e.g. which calendars
  configFields: FieldConfig<Config>[];  // rendered by the existing FieldInput system
  streams: StreamKind[];            // what it produces
  syncEveryMinutes: number;
};

interface Connector<Config> {
  /** Choices for a config field, e.g. the account's calendars. */
  options?(ctx: ConnectorContext<Config>, field: keyof Config): Promise<Option[]>;
  /** Everything changed since `cursor`. Records are validated by the engine. */
  pull(ctx: ConnectorContext<Config>, cursor: unknown): Promise<{ records: unknown[]; cursor: unknown }>;
}

// Provided by the engine: config, an authenticated fetch that refreshes tokens, and the clock.
type ConnectorContext<Config> = { config: Config; fetch: typeof fetch; now: Date };
```

Streams (the standard records):

```ts
event  { external_id, calendar_id, title, start, end, all_day, status: 'confirmed' | 'cancelled', url? }
task   { external_id, title, description?, due_date?, url?, context_hint? }   // context_hint → suggested project
digest { external_id, kind: 'fyi' | 'reply' | 'spam', summary, url? }
```

### Data model

| Table | Purpose |
|---|---|
| `connections` | One per connected account: `integration_id`, `account_label`, `status` (active / error / revoked), `credentials` (encrypted), `config` (JSON), `cursor` (JSON), `last_synced_at`, `last_error`. Several per integration are allowed (two Google accounts, say). |
| `sync_runs` | Ledger per sync: connection, timings, counts, error. This generalises `ingest_runs`, which becomes the email agent's runs. |
| `calendar_events` | The `event` stream: unique `(connection_id, external_id)`. `CalendarSource` reads it, so the planner and week view already work. |
| `action_items` | Gains generic provenance (`source_connection_id`, `source_ref`, `source_url`) when the **second** task source arrives. Until then, the email-specific columns stay. |

Record ownership stays as it is today. For **tasks**, the first write wins:
once a task is on your board you own it, and later syncs don't overwrite
it. **Events** are mirrors: the source owns them, so syncs update them and
cancellations delete them.

### Sync scheduling

Same approach as ingest, keeping the always-on container cheap:

- **Lazy:** any page load syncs connections that are due (each has its own
  interval). Nothing runs while you're away.
- **Manual:** **Sync now** per connection, plus the existing **Check for
  new**, which syncs everything.
- **Later:** a background interval, if something needs to be fresh without a
  page open. Provider webhooks need a public URL, which this local app
  doesn't have, so they're out of scope unless a tunnel is added.

### Outbound (later)

Some integrations will write back: planned focus blocks to Google Calendar,
drafted replies to Gmail. These are `push` actions declared in the manifest,
run only as explicit user commands, and never automatic.

## The catalog UI

- An **Integrations** entry in the sidebar opens a dialog. It's backed by
  `?panel=integrations` so it can be linked to.
- **Browse:** cards grouped by category, each showing name, description and
  what it adds ("Busy time for the planner", "Assignments as tasks"), plus a
  status: Not connected, Connected · synced 5 min ago, Needs attention.
- **Connect:** starts the auth flow the manifest declares. OAuth redirects
  away and back, a token integration shows a field, a URL integration shows
  a field.
- **Configure:** the manifest's config form, via `FieldInput`. It needs one
  new field kind, `multiselect`, whose options come from `connector.options()`,
  e.g. a checkbox for each calendar.
- **Manage:** Sync now, last sync result, Disconnect (revokes and deletes
  credentials, and removes that connection's mirrored events).

## Google Calendar, the first integration

| | |
|---|---|
| Auth | `oauth2`, Google, reusing the existing OAuth client. Scopes: `calendar.calendarlist.readonly` (list calendars to pick from) and `calendar.events.readonly` (read events). |
| Config | `calendar_ids: string[]`: a multiselect of your calendars, primary preselected. |
| Pull | For each selected calendar: `events.list` with `singleEvents=true`, first over a window (today −7 to +60 days), then incrementally with that calendar's `nextSyncToken`. A 410 from Google means "start over", handled by a fresh full sync. |
| Stream | `event`. Cancelled occurrences arrive as `status: 'cancelled'` and delete the mirror. |
| Result | The week view shows your meetings as busy blocks, and the planner schedules tasks around them. No planner or calendar-view code changes. |

**The trade-off to be aware of:** both calendar scopes are Google
"sensitive" scopes. `drive.file` isn't. For an app only you use, this means
the "unverified app" screen appears again when connecting. There's no 7-day
token expiry, because the app is already in production.

**Alternatives considered:**

- **Secret iCal address** (Calendar settings → "Secret address in iCal
  format"). No OAuth or scopes, but calendars are pasted one by one, Google
  refreshes these feeds slowly, and the URL is itself a secret. Still worth
  building as a generic `ics` integration later, since Canvas and Outlook
  also publish ICS feeds.
- **Through the Claude routine** (the claude.ai Google Calendar connector).
  No new Google scopes, but it only updates twice a day, and it puts a model
  in a path that should be deterministic. It suits judgment tasks, not a
  calendar mirror.

## How to add an integration

1. Create `src/lib/integrations/<id>/manifest.ts`: auth spec, config schema and fields, streams.
2. Create `connector.server.ts`: `pull()`, plus `options()` if the config needs choices.
3. Register it in `registry.ts`.
4. If it's OAuth with a new provider, add `auth/providers/<provider>.ts`, which is only the endpoints.
5. Test `pull()` against recorded provider responses with a fake `fetch`: mapping, cursor handling, cancellations.
6. If it introduces a new **stream** (rare), add the Zod schema, a mapper and a migration.

No UI work is needed: the catalog, connect flow and config form come from
the manifest.

## Roadmap

| Phase | Scope | Outcome |
|---|---|---|
| **0. Foundation** | Manifests and registry; `connections` and `sync_runs`; encrypted credentials; generic OAuth2 routes; sync engine; `event` stream and mapper; catalog dialog; `multiselect` field. Existing Drive and email-agent setup shown in the catalog as connected. | The platform exists, with nothing new connected yet |
| **1. Google Calendar** | Connector, config and incremental sync; DB-backed `CalendarSource` | Real meetings in the week view; the planner works around them |
| **2. School** | Canvas (API token): assignments become tasks with due dates, courses are suggested as projects. Generic `ics` feed. | Coursework arrives on its own |
| **3. Messaging** | Slack or iMessage summaries through the agent path, as `digest` and `task` streams | Nothing slips through chat |
| **4. Outbound** | Push planned focus blocks to Google Calendar; send approved reply drafts | The dashboard acts, not just shows |

## Decisions needed

1. **Google Calendar auth:** direct OAuth with the two read-only calendar
   scopes (recommended), or secret iCal URLs.
2. **Credential storage:** encrypted in Postgres with `APP_SECRET` in
   `.env` (recommended), or kept in `.env` as today. That doesn't scale past
   a couple of integrations.
3. **Sync cadence:** lazy on page load, per-connection intervals, plus Sync
   now (recommended), or a background interval from the start.
4. **Scope of phase 0:** build the whole foundation before Google Calendar
   (recommended; phase 1 is then small), or build Google Calendar directly
   and extract the platform from it afterwards.
