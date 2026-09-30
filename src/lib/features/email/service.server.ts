// Mail from linked accounts, and its handoff to the email agent.
//
//   sync (gmail connector) → storeMessages → publishInbox: claim unbatched
//   messages into a batch, encrypt, upload to Drive → the cloud routine triages
//   every pending batch → its envelope lists `input_batches` → on ingest,
//   consumeBatches marks them done and deletes the Drive files.

import { and, count, eq, inArray, isNotNull, isNull, lt, max, or } from 'drizzle-orm';
import { db, type Tx } from '$lib/server/db';
import { encrypt } from '$lib/server/crypto';
import { deleteFile, uploadJson } from '$lib/server/google-drive';
import type { MessageRecord } from '$lib/integrations/streams';
import { ingestRuns } from '$lib/ingest/table.server';
import { batchFileName, qualifiedId, type InboxBatch, type InboxBatchFile } from './batch';
import { emailBatches, emailMessages } from './table.server';

/** How long mail is kept locally. The agent sees it within hours; this is slack. */
const RETAIN_DAYS = 14;

const now = () => new Date().toISOString();

/** Insert new messages (existing ids are ignored); returns how many were new. */
export async function storeMessages(
	tx: Tx,
	connectionId: string,
	messages: MessageRecord[],
	syncedAt: string
): Promise<number> {
	if (messages.length === 0) return 0;
	const inserted = await tx
		.insert(emailMessages)
		.values(
			messages.map((m) => ({
				...m,
				connection_id: connectionId,
				batch_id: null,
				synced_at: syncedAt
			}))
		)
		.onConflictDoNothing()
		.returning({ id: emailMessages.external_id });

	const cutoff = new Date(Date.now() - RETAIN_DAYS * 86_400_000).toISOString();
	await tx.delete(emailMessages).where(lt(emailMessages.received_at, cutoff));
	await tx
		.delete(emailBatches)
		.where(and(isNotNull(emailBatches.consumed_at), lt(emailBatches.consumed_at, cutoff)));
	return inserted.length;
}

export type Uploader = (name: string, file: InboxBatchFile) => Promise<string>; // → Drive file id

const driveUpload: Uploader = async (name, file) =>
	(await uploadJson(process.env.DRIVE_FOLDER_ID!, name, file)).id;

/** Whether mail can be handed to the agent at all (Drive + the shared key). */
export function handoffReady(): boolean {
	return Boolean(process.env.DRIVE_FOLDER_ID && process.env.INBOX_KEY);
}

/**
 * Hand every message not yet in a batch to the agent, as one encrypted batch.
 * Claiming is a single UPDATE, so two processes (dev + Docker) can't batch the
 * same mail twice. If the upload fails, the claim is released for next time.
 * Returns the number of messages handed over.
 */
export async function publishInbox(upload: Uploader = driveUpload): Promise<number> {
	if (!handoffReady()) return 0;

	const batchId = `ib_${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`;
	const created_at = now();
	const claimed = await db.transaction(async (tx) => {
		await tx.insert(emailBatches).values({
			id: batchId,
			created_at,
			message_count: 0,
			drive_file_id: null,
			published_at: null,
			consumed_at: null
		});
		const rows = await tx
			.update(emailMessages)
			.set({ batch_id: batchId })
			.where(isNull(emailMessages.batch_id))
			.returning();
		if (rows.length === 0) {
			await tx.delete(emailBatches).where(eq(emailBatches.id, batchId));
			return rows;
		}
		await tx
			.update(emailBatches)
			.set({ message_count: rows.length })
			.where(eq(emailBatches.id, batchId));
		return rows;
	});
	if (claimed.length === 0) return 0;

	const batch: InboxBatch = {
		batch_id: batchId,
		created_at,
		messages: claimed
			.sort((a, b) => a.received_at.localeCompare(b.received_at))
			.map((m) => ({
				id: qualifiedId(m.account, m.external_id),
				account: m.account,
				thread_id: m.thread_id,
				from: m.from,
				to: m.to,
				subject: m.subject,
				received_at: m.received_at,
				labels: m.labels,
				snippet: m.snippet,
				body: m.body,
				url: m.url
			}))
	};

	try {
		const fileId = await upload(batchFileName(batch), {
			schema_version: '1.0',
			kind: 'inbox-batch',
			batch_id: batchId,
			sealed: encrypt(batch, 'INBOX_KEY')
		});
		await db
			.update(emailBatches)
			.set({ drive_file_id: fileId, published_at: now() })
			.where(eq(emailBatches.id, batchId));
	} catch (e) {
		await db
			.update(emailMessages)
			.set({ batch_id: null })
			.where(eq(emailMessages.batch_id, batchId));
		await db.delete(emailBatches).where(eq(emailBatches.id, batchId));
		throw new Error(`Couldn't hand new mail to the email agent: ${(e as Error).message}`);
	}
	return claimed.length;
}

export type Remover = (fileId: string) => Promise<void>;

/** A digest covering these batches was ingested: mark them done and delete their Drive files. */
export async function consumeBatches(ids: string[], remove: Remover = deleteFile): Promise<void> {
	if (ids.length === 0) return;
	const batches = await db
		.update(emailBatches)
		.set({ consumed_at: now() })
		.where(and(inArray(emailBatches.id, ids), isNull(emailBatches.consumed_at)))
		.returning();
	for (const b of batches) {
		// Best effort: a leftover file is still encrypted and is ignored by the producer.
		if (b.drive_file_id) await remove(b.drive_file_id).catch(() => {});
	}
}

export type EmailAgentStatus = { lastRun: string | null; waiting: number; handoffReady: boolean };

/** For the catalog: when the agent last delivered, and how much mail is waiting for it. */
export async function emailAgentStatus(): Promise<EmailAgentStatus> {
	const [[{ lastRun }], [{ waiting }]] = await Promise.all([
		db.select({ lastRun: max(ingestRuns.ingested_at) }).from(ingestRuns),
		db
			.select({ waiting: count() })
			.from(emailMessages)
			.leftJoin(emailBatches, eq(emailBatches.id, emailMessages.batch_id))
			.where(or(isNull(emailMessages.batch_id), isNull(emailBatches.consumed_at)))
	]);
	return { lastRun, waiting, handoffReady: handoffReady() };
}
