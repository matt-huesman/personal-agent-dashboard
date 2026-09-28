// Upstream producer CLI, run by the scheduled Claude routine (agents/email-digest.md).
//
//   pnpm producer start                     decide this run's window; prints it + the Gmail query
//   pnpm producer publish <draft.json>      validate draft → build envelope → upload to Drive
//   pnpm producer publish <draft.json> --dry-run   print the envelope, upload nothing
//
// `start` saves the window to .producer/window.json so `publish` uses the exact
// same bounds, however long the agent spends reading mail in between.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { envelope, type Envelope } from '$lib/ingest/envelope';
import { env, listJsonFiles, readJson, uploadJson } from '$lib/server/google-drive';
import {
	buildEnvelope,
	envelopeDraft,
	envelopeFileName,
	gmailQuery,
	nextWindow,
	PRODUCER,
	type RunWindow
} from '$lib/producer/draft.server';

const WINDOW_FILE = '.producer/window.json';

async function latestPublished(folderId: string): Promise<Envelope | null> {
	const ours = (await listJsonFiles(folderId)).filter((f) => f.name.startsWith(`${PRODUCER}-`));
	const last = ours.at(-1);
	return last ? envelope.parse(await readJson(last.id)) : null;
}

async function start() {
	const window = nextWindow(await latestPublished(env('DRIVE_FOLDER_ID')), new Date());
	await mkdir('.producer', { recursive: true });
	await writeFile(WINDOW_FILE, JSON.stringify(window));
	console.log(JSON.stringify({ window, gmail_query: gmailQuery(window) }, null, 2));
}

async function publish(draftPath: string, dryRun: boolean) {
	const window = JSON.parse(await readFile(WINDOW_FILE, 'utf8')) as RunWindow;

	// The boundary: the draft is model output. Errors are printed for the agent to fix.
	const parsed = envelopeDraft.safeParse(JSON.parse(await readFile(draftPath, 'utf8')));
	if (!parsed.success) {
		console.error(`Draft is invalid — fix and re-run:\n${z.prettifyError(parsed.error)}`);
		process.exit(1);
	}

	const result = buildEnvelope(parsed.data, window, new Date());
	const name = envelopeFileName(window);
	if (dryRun) {
		console.log(`[dry run] would upload ${name}:\n${JSON.stringify(result, null, 2)}`);
		return;
	}
	const file = await uploadJson(env('DRIVE_FOLDER_ID'), name, result);
	console.log(
		`Published ${file.name} (${file.id}): ${result.action_items.length} action items, ` +
			`${result.suggested_replies.length} replies, ${result.spam_candidates.length} spam, ${result.fyi.length} fyi`
	);
}

const [command, arg, flag] = process.argv.slice(2);
if (command === 'start') await start();
else if (command === 'publish' && arg) await publish(arg, flag === '--dry-run');
else {
	console.error('Usage: pnpm producer start | pnpm producer publish <draft.json> [--dry-run]');
	process.exit(1);
}
