import { boolean, index, jsonb, pgTable, text } from 'drizzle-orm/pg-core';
import { isoTimestamp } from '$lib/server/columns';
import type { Equal } from '$lib/types';
import { CONNECTION_STATUSES, type ConnectionRecord, type SyncRunRecord } from './schema';

export const connections = pgTable('connections', {
	id: text().primaryKey(),
	integration_id: text().notNull(),
	account_label: text().notNull(),
	status: text({ enum: CONNECTION_STATUSES }).notNull(),
	credentials: text().notNull(),
	config: jsonb().$type<Record<string, unknown>>().notNull(),
	cursor: jsonb().$type<unknown>(),
	last_synced_at: isoTimestamp(),
	last_attempt_at: isoTimestamp(),
	last_error: text(),
	created_at: isoTimestamp().notNull(),
	updated_at: isoTimestamp().notNull()
});

export const syncRuns = pgTable(
	'sync_runs',
	{
		id: text().primaryKey(),
		connection_id: text()
			.notNull()
			.references(() => connections.id, { onDelete: 'cascade' }),
		started_at: isoTimestamp().notNull(),
		finished_at: isoTimestamp().notNull(),
		ok: boolean().notNull(),
		counts: jsonb().$type<Record<string, number>>().notNull(),
		error: text()
	},
	(t) => [index('sync_runs_connection_idx').on(t.connection_id, t.started_at)]
);

const _connectionsDrift: Equal<typeof connections.$inferSelect, ConnectionRecord> = true;
const _syncRunsDrift: Equal<typeof syncRuns.$inferSelect, SyncRunRecord> = true;
