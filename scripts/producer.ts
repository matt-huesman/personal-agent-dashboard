// Upstream producer CLI, run by the scheduled Claude routine (agents/email-digest.md).
//
//   pnpm producer start                     gather new mail from every linked account
//   pnpm producer publish <draft.json>      validate draft → build envelope → upload to Drive
//   pnpm producer publish <draft.json> --dry-run   print the envelope, upload nothing
//
// Mail arrives as inbox batches the dashboard puts on Drive (encrypted with
// INBOX_KEY). `start` decrypts every pending batch into .producer/inbox.json
// for the agent to read, and remembers which batches it used in
// .producer/run.json, so `publish` records exactly those as triaged.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { inboxBatch, inboxBatchFile, INBOX_PREFIX } from '$lib/features/email/batch';
import { envelope } from '$lib/ingest/envelope';
import { decrypt } from '$lib/server/crypto';
import { env, listJsonFiles, readJson, uploadJson } from '$lib/server/google-drive';
import {
	buildEnvelope,
	envelopeDraft,
	envelopeFileName,
	PRODUCER,
	type RunInputs
} from '$lib/producer/draft.server';
import { countByAccount, mergeBatches, pendingBatchFiles } from '$lib/producer/inbox.server';

const INBOX_FILE = '.producer/inbox.json';
const RUN_FILE = '.producer/run.json';
const RECENT_ENVELOPES = 20;

async function start() {
	const files = await listJsonFiles(env('DRIVE_FOLDER_ID'));
	const envelopes = files.filter((f) => f.name.startsWith(`${PRODUCER}-`)).slice(-RECENT_ENVELOPES);
	const published = await Promise.all(
		envelopes.map(async (f) => envelope.parse(await readJson(f.id)))
	);
	const pending = pendingBatchFiles(
		files.filter((f) => f.name.startsWith(INBOX_PREFIX)),
		published
	);

	const batches = await Promise.all(
		pending.map(async (f) => {
			const file = inboxBatchFile.parse(await readJson(f.id));
			return inboxBatch.parse(decrypt(file.sealed, 'INBOX_KEY'));
		})
	);
	const inbox = mergeBatches(batches);
	if (!inbox) {
		console.log('No new mail since the last run. Nothing to do; stop here without publishing.');
		return;
	}

	await mkdir('.producer', { recursive: true });
	await writeFile(INBOX_FILE, JSON.stringify(inbox.messages, null, 2));
	await writeFile(RUN_FILE, JSON.stringify(inbox.run));
	console.log(
		JSON.stringify(
			{
				messages: inbox.messages.length,
				by_account: countByAccount(inbox.messages),
				window: inbox.run.window,
				read_next: INBOX_FILE
			},
			null,
			2
		)
	);
}

async function publish(draftPath: string, dryRun: boolean) {
	const run = JSON.parse(await readFile(RUN_FILE, 'utf8')) as RunInputs;

	// The boundary: the draft is model output. Errors are printed for the agent to fix.
	const parsed = envelopeDraft.safeParse(JSON.parse(await readFile(draftPath, 'utf8')));
	if (!parsed.success) {
		console.error(`Draft is invalid — fix and re-run:\n${z.prettifyError(parsed.error)}`);
		process.exit(1);
	}

	const result = buildEnvelope(parsed.data, run, new Date());
	const name = envelopeFileName(result.generated_at);
	if (dryRun) {
		console.log(`[dry run] would upload ${name}:\n${JSON.stringify(result, null, 2)}`);
		return;
	}
	const file = await uploadJson(env('DRIVE_FOLDER_ID'), name, result);
	console.log(
		`Published ${file.name} (${file.id}) covering ${run.input_batches.length} batch(es): ` +
			`${result.action_items.length} action items, ${result.suggested_replies.length} replies, ` +
			`${result.spam_candidates.length} spam, ${result.fyi.length} fyi`
	);
}

const [command, arg, flag] = process.argv.slice(2);
if (command === 'start') await start();
else if (command === 'publish' && arg) await publish(arg, flag === '--dry-run');
else {
	console.error('Usage: pnpm producer start | pnpm producer publish <draft.json> [--dry-run]');
	process.exit(1);
}
