# Google setup (one time)

Connects the dashboard and the scheduled email agent to one Drive folder. The
app asks only for the `drive.file` scope, so it can see files it created
itself and nothing else in your Drive.

## 1. Create an OAuth client in Google Cloud (about 10 minutes)

1. Go to https://console.cloud.google.com/, create a project (e.g.
   "Personal Dashboard"), and select it.
2. **APIs & Services → Library**: search for **Google Drive API** and click
   **Enable**.
3. **APIs & Services → OAuth consent screen** (shown as "Google Auth Platform"):
   - User type: **External**. App name: "Personal Dashboard". Use your email
     for the support and developer contacts.
   - **Data access / Scopes**: add `.../auth/drive.file`. It's listed as
     non-sensitive.
   - **Audience**: click **Publish app** so the status is **In production**.
     *This matters:* in "Testing" status, Google expires refresh tokens after
     7 days and the pipeline would stop. `drive.file` needs no Google
     verification. You'll just see an "unverified app" notice once when you
     authorize.
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Desktop app**. Name: "dashboard".
   - Copy the **Client ID** and **Client secret** into `.env`:
     ```
     GOOGLE_CLIENT_ID=...
     GOOGLE_CLIENT_SECRET=...
     ```

## 2. Authorize and create the inbox folder

```sh
pnpm drive:auth
```

A browser window opens. Choose your account and approve (on the "Google
hasn't verified this app" screen, click **Advanced → Go to Personal Dashboard**).
The script then:

- creates a Drive folder named **Agent Dashboard Inbox**,
- writes `GOOGLE_REFRESH_TOKEN` and `DRIVE_FOLDER_ID` into `.env`,
- prints all four values for step 3.

Then restart the app: `docker compose up -d`. With `DRIVE_FOLDER_ID` set, the
dashboard reads from Drive instead of `data/incoming/`.

## 3. Give the cloud routine the same credentials

The routine runs in a cloud **environment**, a saved configuration of network
access, environment variables and a setup script. Onboarding creates one
called **Default**. You edit it from a selector that only appears once GitHub
is connected to Claude (web onboarding):

1. Go to https://claude.ai/code. If it asks you to connect GitHub, do that
   first (or run `/web-setup` in Claude Code).
2. In the row just above the message box, click the **cloud icon labelled
   "Default"**. There's no separate settings page for environments.
3. Hover over **Default** in the menu and click the **gear icon** on its right.
4. In **Environment variables**, paste the four lines `pnpm drive:auth`
   printed (`.env` format, one `KEY=value` per line):
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   GOOGLE_REFRESH_TOKEN=...
   DRIVE_FOLDER_ID=...
   ```
5. Leave **Network access** on **Trusted**. Its default allowlist already covers
   `*.googleapis.com` (Google sign-in and Drive) and `registry.npmjs.org`
   (`pnpm install`). Leave the setup script empty.
6. Save.

Why variables rather than the dialog's **API credentials** section? API
credentials attach a fixed header, but Google access tokens expire hourly and
must be refreshed with the refresh token. The routine has to hold the refresh
token itself. What it can reach is limited to files this app created, and you
can revoke it at any time (below).

## Revoking access

Remove "Personal Dashboard" at https://myaccount.google.com/permissions. That
kills the refresh token everywhere. Re-run `pnpm drive:auth` to issue a new
one.
