import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate as runMigrations } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');

// Single user: a handful of connections is plenty and keeps Postgres idle cost low.
export const client = postgres(url, { max: 5, onnotice: () => {} });
export const db = drizzle(client);

/** Apply pending migrations from ./drizzle. Every entry point calls this at startup. */
export async function migrate(): Promise<void> {
	await runMigrations(db, { migrationsFolder: 'drizzle' });
}

export type Db = typeof db;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
