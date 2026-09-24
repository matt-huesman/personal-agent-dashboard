import { sql } from 'drizzle-orm';
import { check, date, index, integer, jsonb, pgTable, text } from 'drizzle-orm/pg-core';
import { isoTimestamp } from '$lib/server/columns';
import type { Equal } from '$lib/types';
import type { Link } from '$lib/schema-primitives';
import { ACTION_ITEM_STATUSES, PRIORITIES, type ActionItemRecord } from './schema';

// Column names are the Zod keys, verbatim — no casing map anywhere.
export const actionItems = pgTable(
	'action_items',
	{
		id: text().primaryKey(),
		source_message_id: text(),
		source_run_id: text(),
		title: text().notNull(),
		description: text(),
		due_date: date({ mode: 'string' }),
		priority: text({ enum: PRIORITIES }).notNull(),
		links: jsonb().$type<Link[]>().notNull(),
		status: text({ enum: ACTION_ITEM_STATUSES }).notNull(),
		scheduled_date: date({ mode: 'string' }),
		created_at: isoTimestamp().notNull(),
		position: integer().notNull(),
		completed_at: isoTimestamp(),
		updated_at: isoTimestamp().notNull(),
		deleted_at: isoTimestamp()
	},
	(t) => [
		check(
			'action_items_status_placement',
			sql`(${t.status} = 'pool' and ${t.scheduled_date} is null and ${t.completed_at} is null)
			or (${t.status} = 'scheduled' and ${t.scheduled_date} is not null and ${t.completed_at} is null)
			or (${t.status} = 'done' and ${t.completed_at} is not null)`
		),
		index('action_items_container_idx').on(t.scheduled_date, t.position)
	]
);

// Compile-time guard: the table must match the Zod record exactly.
const _drift: Equal<typeof actionItems.$inferSelect, ActionItemRecord> = true;
