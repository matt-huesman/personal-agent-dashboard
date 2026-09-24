import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

// Bring the test database up to the latest migration before any test file runs.
export default async function setup() {
	const url = process.env.TEST_DATABASE_URL;
	if (!url) throw new Error('TEST_DATABASE_URL is not set (see .env.example)');
	const client = postgres(url, { max: 1, onnotice: () => {} });
	await migrate(drizzle(client), { migrationsFolder: 'drizzle' });
	await client.end();
}
