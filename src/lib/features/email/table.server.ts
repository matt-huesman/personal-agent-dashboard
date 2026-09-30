import { index, integer, jsonb, pgTable, primaryKey, text } from 'drizzle-orm/pg-core';
import { isoTimestamp } from '$lib/server/columns';
import { connections } from '$lib/integrations/table.server';
import type { Equal } from '$lib/types';
import type { EmailBatchRecord, StoredMessageRecord } from './schema';

export const emailBatches = pgTable('email_batches', {
	id: text().primaryKey(),
	created_at: isoTimestamp().notNull(),
	message_count: integer().notNull(),
	drive_file_id: text(),
	published_at: isoTimestamp(),
	consumed_at: isoTimestamp()
});

// Recent mail from linked accounts, kept only as long as the agent needs it
// (see RETAIN_DAYS in service.server.ts). Removed with its connection.
export const emailMessages = pgTable(
	'email_messages',
	{
		connection_id: text()
			.notNull()
			.references(() => connections.id, { onDelete: 'cascade' }),
		external_id: text().notNull(),
		thread_id: text().notNull(),
		account: text().notNull(),
		from: text().notNull(),
		to: text().notNull(),
		subject: text().notNull(),
		received_at: isoTimestamp().notNull(),
		labels: jsonb().$type<string[]>().notNull(),
		snippet: text().notNull(),
		body: text().notNull(),
		url: text().notNull(),
		batch_id: text().references(() => emailBatches.id, { onDelete: 'set null' }),
		synced_at: isoTimestamp().notNull()
	},
	(t) => [
		primaryKey({ columns: [t.connection_id, t.external_id] }),
		index('email_messages_batch_idx').on(t.batch_id),
		index('email_messages_received_idx').on(t.received_at)
	]
);

const _batchesDrift: Equal<typeof emailBatches.$inferSelect, EmailBatchRecord> = true;
const _messagesDrift: Equal<typeof emailMessages.$inferSelect, StoredMessageRecord> = true;
