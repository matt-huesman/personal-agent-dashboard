import { jsonb, pgTable, text } from 'drizzle-orm/pg-core';
import { isoTimestamp } from '$lib/server/columns';

// One row per settings profile (just 'default' for now). Stored as JSON so a
// new setting is a schema change in code, not a column migration; defaults
// fill in keys that older rows don't have.
export const plannerSettingsTable = pgTable('planner_settings', {
	id: text().primaryKey(),
	value: jsonb().$type<Partial<Record<string, unknown>>>().notNull(),
	updated_at: isoTimestamp().notNull()
});
