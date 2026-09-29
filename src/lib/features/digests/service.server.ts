import { desc } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { ingestRuns } from '$lib/ingest/table.server';
import type { Digest } from './digest';

/** Most recent digests first (about a month at two runs a day). */
export async function listDigests(limit = 60): Promise<Digest[]> {
	const runs = await db
		.select({ envelope: ingestRuns.envelope })
		.from(ingestRuns)
		.orderBy(desc(ingestRuns.generated_at))
		.limit(limit);

	return runs.map(({ envelope: e }) => ({
		id: e.run_id,
		generated_at: e.generated_at,
		window: e.window,
		fyi: e.fyi,
		suggested_replies: e.suggested_replies,
		spam_candidates: e.spam_candidates,
		action_items: e.action_items.map(({ id, title, source_message_id }) => ({
			id,
			title,
			source_message_id
		}))
	}));
}
