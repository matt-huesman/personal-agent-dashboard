# CLAUDE.md

@AGENTS.md

## Claude Code specifics

- Run `export PATH="$HOME/.local/bin:$PATH"` before `pnpm` in each shell command; the shell doesn't keep it.
- The email-digest **routine** is a Claude Code cloud routine: manage it with `/schedule` (RemoteTrigger: `list`, `get`, `update`, `run`, `list_runs`, `get_run_log`). Updating it changes a live, scheduled job, so confirm with the owner first. It runs whatever is on `main`.
- For UI verification, use headless Chrome through `playwright-core` installed in the session scratchpad (the machine has Google Chrome; use `channel: 'chrome'`), against a dev server on the **test** database.
