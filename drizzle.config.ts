import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	dialect: 'postgresql',
	schema: ['./src/lib/features/*/table.server.ts', './src/lib/ingest/table.server.ts'],
	out: './drizzle',
	dbCredentials: { url: process.env.DATABASE_URL ?? '' }
});
