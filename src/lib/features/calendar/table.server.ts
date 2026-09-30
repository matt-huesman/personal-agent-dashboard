import { boolean, index, pgTable, primaryKey, text } from 'drizzle-orm/pg-core';
import { isoTimestamp } from '$lib/server/columns';
import { connections } from '$lib/integrations/table.server';
import type { Equal } from '$lib/types';
import type { StoredEventRecord } from './schema';

// Mirror of events from calendar integrations. The source owns them: each
// sync replaces a connection's events, and disconnecting removes them.
export const calendarEvents = pgTable(
	'calendar_events',
	{
		connection_id: text()
			.notNull()
			.references(() => connections.id, { onDelete: 'cascade' }),
		external_id: text().notNull(),
		calendar_id: text().notNull(),
		calendar_name: text().notNull(),
		title: text().notNull(),
		start: isoTimestamp().notNull(),
		end: isoTimestamp().notNull(),
		all_day: boolean().notNull(),
		busy: boolean().notNull(),
		url: text(),
		read_only: boolean().notNull(),
		synced_at: isoTimestamp().notNull()
	},
	(t) => [
		primaryKey({ columns: [t.connection_id, t.external_id] }),
		index('calendar_events_range_idx').on(t.start, t.end)
	]
);

const _drift: Equal<typeof calendarEvents.$inferSelect, StoredEventRecord> = true;
