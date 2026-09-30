// The producer's view of inbox batches: which are still pending, and one
// combined, de-duplicated inbox across them. Pure, so it's tested directly.

import type { DriveFile } from '$lib/server/google-drive';
import { batchIdFromFileName, type InboxBatch, type InboxMessage } from '$lib/features/email/batch';
import type { Envelope } from '$lib/ingest/envelope';
import type { RunInputs } from './draft.server';

/**
 * Batches not yet triaged: every batch file on Drive whose id no published
 * envelope lists. (The dashboard deletes consumed batches, but may not have
 * ingested the latest envelope yet, so published envelopes are the record.)
 */
export function pendingBatchFiles(files: DriveFile[], published: Envelope[]): DriveFile[] {
	const done = new Set(published.flatMap((e) => e.input_batches));
	return files.filter((f) => {
		const id = batchIdFromFileName(f.name);
		return id !== null && !done.has(id);
	});
}

/** All pending mail as one inbox, oldest first, each message once. */
export function mergeBatches(
	batches: InboxBatch[]
): { messages: InboxMessage[]; run: RunInputs } | null {
	const byId = new Map(batches.flatMap((b) => b.messages).map((m) => [m.id, m]));
	const messages = [...byId.values()].sort((a, b) => a.received_at.localeCompare(b.received_at));
	if (messages.length === 0) return null;
	return {
		messages,
		run: {
			window: { since: messages[0].received_at, until: messages.at(-1)!.received_at },
			input_batches: batches.map((b) => b.batch_id)
		}
	};
}

/** Messages per account, for the run summary. */
export function countByAccount(messages: InboxMessage[]): Record<string, number> {
	const counts: Record<string, number> = {};
	for (const m of messages) counts[m.account] = (counts[m.account] ?? 0) + 1;
	return counts;
}
