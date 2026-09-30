import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { decrypt } from '$lib/server/crypto';
import { useTestDb } from '../../../test/db';
import { connections } from '$lib/integrations/table.server';
import type { MessageRecord } from '$lib/integrations/streams';
import { inboxBatch, type InboxBatchFile } from './batch';
import { consumeBatches, emailAgentStatus, publishInbox, storeMessages } from './service.server';
import { emailBatches, emailMessages } from './table.server';

useTestDb();

// The handoff needs these; tests supply their own uploader instead of Drive.
const saved = { folder: process.env.DRIVE_FOLDER_ID, key: process.env.INBOX_KEY };
beforeAll(() => {
	process.env.DRIVE_FOLDER_ID = 'test-folder';
	process.env.INBOX_KEY = 'test-inbox-key';
});
afterAll(() => {
	process.env.DRIVE_FOLDER_ID = saved.folder;
	process.env.INBOX_KEY = saved.key;
});

async function connection(id: string) {
	const t = new Date().toISOString();
	await db.insert(connections).values({
		id,
		integration_id: 'gmail',
		account_label: `${id}@example.com`,
		status: 'active',
		credentials: 'x',
		config: {},
		cursor: null,
		last_synced_at: null,
		last_attempt_at: null,
		last_error: null,
		created_at: t,
		updated_at: t
	});
}

const mail = (account: string, id: string): MessageRecord => ({
	external_id: id,
	thread_id: id,
	account,
	from: 'someone@example.com',
	to: account,
	subject: `Subject ${id}`,
	received_at: new Date().toISOString(),
	labels: ['INBOX'],
	snippet: '',
	body: `Body of ${id}`,
	url: `https://mail.google.com/mail/u/${account}/#all/${id}`
});

const store = (connectionId: string, messages: MessageRecord[]) =>
	db.transaction((tx) => storeMessages(tx, connectionId, messages, new Date().toISOString()));

describe('email handoff', () => {
	it('stores new mail once, however often it is re-sent', async () => {
		await connection('work');
		expect(
			await store('work', [mail('work@example.com', 'a'), mail('work@example.com', 'b')])
		).toBe(2);
		expect(
			await store('work', [mail('work@example.com', 'b'), mail('work@example.com', 'c')])
		).toBe(1);
	});

	it('hands every linked account’s new mail to the agent in one encrypted batch', async () => {
		await connection('work');
		await connection('home');
		await store('work', [mail('work@example.com', 'a')]);
		await store('home', [mail('home@example.com', 'a')]); // same Gmail id, other account

		const uploads: { name: string; file: InboxBatchFile }[] = [];
		const handed = await publishInbox(async (name, file) => {
			uploads.push({ name, file });
			return 'drive-file-1';
		});

		expect(handed).toBe(2);
		expect(uploads).toHaveLength(1);
		const { name, file } = uploads[0];
		expect(name).toMatch(/^inbox-\d{8}T\d{6}Z-ib_\w+\.json$/);
		expect(JSON.stringify(file)).not.toContain('Body of'); // sealed on Drive
		const batch = inboxBatch.parse(decrypt(file.sealed, 'INBOX_KEY'));
		expect(batch.messages.map((m) => m.id).sort()).toEqual([
			'home@example.com/a',
			'work@example.com/a'
		]);

		// Nothing new: nothing to hand over.
		expect(await publishInbox(async () => 'unused')).toBe(0);
		expect(await emailAgentStatus()).toMatchObject({ waiting: 2, handoffReady: true });
	});

	it('releases the mail for a retry when the upload fails', async () => {
		await connection('work');
		await store('work', [mail('work@example.com', 'a')]);

		await expect(
			publishInbox(async () => {
				throw new Error('Drive is down');
			})
		).rejects.toThrow('Drive is down');
		expect(await db.select().from(emailBatches)).toEqual([]);
		const [row] = await db.select().from(emailMessages);
		expect(row.batch_id).toBeNull();

		expect(await publishInbox(async () => 'drive-file-2')).toBe(1);
	});

	it('marks batches done when their digest is ingested, and deletes the Drive files', async () => {
		await connection('work');
		await store('work', [mail('work@example.com', 'a')]);
		await publishInbox(async () => 'drive-file-3');
		const [batch] = await db.select().from(emailBatches);

		const deleted: string[] = [];
		await consumeBatches([batch.id], async (id) => {
			deleted.push(id);
		});
		expect(deleted).toEqual(['drive-file-3']);
		const [after] = await db.select().from(emailBatches).where(eq(emailBatches.id, batch.id));
		expect(after.consumed_at).not.toBeNull();
		expect((await emailAgentStatus()).waiting).toBe(0);
	});
});
