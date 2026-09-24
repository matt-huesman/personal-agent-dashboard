// pnpm ingest — run the same pipeline as POST /api/ingest from the command line.
import { ingest } from '$lib/ingest/run.server';
import { client, migrate } from '$lib/server/db';

await migrate();
console.log(JSON.stringify(await ingest(), null, 2));
await client.end();
