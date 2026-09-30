import { sql } from 'drizzle-orm';
import { afterAll, beforeEach } from 'vitest';
import { client, db } from '$lib/server/db';

/** Every app table, emptied before each DB-backed test. Add new tables here. */
const TABLES = [
	'action_items',
	'ingest_runs',
	'projects',
	'planner_settings',
	'calendar_events',
	'email_messages',
	'email_batches',
	'sync_runs',
	'connections'
];

/** Call at the top of a DB-backed test file: empty tables before each test. */
export function useTestDb() {
	beforeEach(async () => {
		await db.execute(sql.raw(`truncate ${TABLES.join(', ')}`));
	});
	afterAll(async () => {
		await client.end();
	});
}
