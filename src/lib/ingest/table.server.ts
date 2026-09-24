import { integer, jsonb, pgTable, text } from 'drizzle-orm/pg-core';
import { isoTimestamp } from '$lib/server/columns';
import type { Envelope } from './envelope';

// Ledger of ingested envelopes: makes ingest idempotent per file/run and keeps
// the full validated envelope (including display-only members) for later use.
// Infrastructure, not a domain entity — so no Zod record of its own.
export const ingestRuns = pgTable('ingest_runs', {
	run_id: text().primaryKey(),
	source_ref: text().notNull().unique(), // the EnvelopeSource's id for the file
	source: text().notNull(),
	generated_at: isoTimestamp().notNull(),
	ingested_at: isoTimestamp().notNull(),
	item_count: integer().notNull(),
	inserted_count: integer().notNull(),
	envelope: jsonb().$type<Envelope>().notNull()
});
