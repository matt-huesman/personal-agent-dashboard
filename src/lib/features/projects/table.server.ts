import { pgTable, text } from 'drizzle-orm/pg-core';
import { isoTimestamp } from '$lib/server/columns';
import type { Equal } from '$lib/types';
import { PROJECT_COLORS, type ProjectRecord } from './schema';

export const projects = pgTable('projects', {
	id: text().primaryKey(),
	name: text().notNull(),
	color: text({ enum: PROJECT_COLORS }).notNull(),
	created_at: isoTimestamp().notNull(),
	updated_at: isoTimestamp().notNull()
});

// Compile-time guard: the table must match the Zod record exactly.
const _drift: Equal<typeof projects.$inferSelect, ProjectRecord> = true;
