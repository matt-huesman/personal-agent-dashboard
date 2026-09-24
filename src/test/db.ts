import { sql } from 'drizzle-orm';
import { afterAll, beforeEach } from 'vitest';
import { client, db } from '$lib/server/db';

/** Call at the top of a DB-backed test file: empty tables before each test. */
export function useTestDb() {
	beforeEach(async () => {
		await db.execute(sql`truncate action_items, ingest_runs`);
	});
	afterAll(async () => {
		await client.end();
	});
}
