// The inbox batch: how new mail travels from the dashboard to the email agent.
// Shared by both sides (the dashboard writes it, `pnpm producer` reads it), so
// this is the one definition of the format.
//
// On Drive the payload is encrypted with INBOX_KEY; the file itself carries
// only the batch id, so the folder never holds readable mail.

import { z } from 'zod';
import { isoDateTime } from '$lib/schema-primitives';

export const INBOX_PREFIX = 'inbox-';

export const inboxMessage = z.object({
	id: z.string(), // "<account>/<message id>": unique across accounts; use as source_message_id
	account: z.string(),
	thread_id: z.string(),
	from: z.string(),
	to: z.string(),
	subject: z.string(),
	received_at: isoDateTime,
	labels: z.array(z.string()),
	snippet: z.string(),
	body: z.string(),
	url: z.string()
});

export const inboxBatch = z.object({
	batch_id: z.string(),
	created_at: isoDateTime,
	messages: z.array(inboxMessage)
});

/** The Drive file: metadata in the clear, messages sealed with INBOX_KEY. */
export const inboxBatchFile = z.object({
	schema_version: z.literal('1.0'),
	kind: z.literal('inbox-batch'),
	batch_id: z.string(),
	sealed: z.string()
});

export type InboxMessage = z.infer<typeof inboxMessage>;
export type InboxBatch = z.infer<typeof inboxBatch>;
export type InboxBatchFile = z.infer<typeof inboxBatchFile>;

/** Unique across every linked account. */
export function qualifiedId(account: string, messageId: string): string {
	return `${account}/${messageId}`;
}

/** "inbox-20260929T130000Z-ib_1a2b3c.json": sorts by time; the id is readable without downloading. */
export function batchFileName(batch: Pick<InboxBatch, 'batch_id' | 'created_at'>): string {
	const stamp = batch.created_at.replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
	return `${INBOX_PREFIX}${stamp}-${batch.batch_id}.json`;
}

export function batchIdFromFileName(name: string): string | null {
	const match = name.match(/^inbox-\d{8}T\d{6}Z-(.+)\.json$/);
	return match ? match[1] : null;
}
