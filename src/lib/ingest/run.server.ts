// source → validate (once) → idempotent upsert → ledger.
//
// Idempotency has two layers:
//   1. ingest_runs: a ref (or run_id) that was ingested before is skipped.
//   2. Item ids: insert-or-ignore, so an item re-sent by a later run never
//      overwrites the user's edits, schedule, or delete.

import { z } from 'zod';
import { db } from '$lib/server/db';
import { insertIngested } from '$lib/features/action-items/service.server';
import { envelope } from './envelope';
import { localSource } from './local-source.server';
import { ingestRuns } from './table.server';
import type { EnvelopeSource } from './source';

export type IngestReport = {
	ingested: { ref: string; run_id: string; items: number; inserted: number }[];
	skipped: string[];
	failed: { ref: string; error: string }[];
};

export async function ingest(source: EnvelopeSource = localSource()): Promise<IngestReport> {
	const report: IngestReport = { ingested: [], skipped: [], failed: [] };
	const seen = new Set(
		(await db.select({ ref: ingestRuns.source_ref }).from(ingestRuns)).map((r) => r.ref)
	);

	for (const ref of await source.list()) {
		if (seen.has(ref)) {
			report.skipped.push(ref);
			continue;
		}

		// The boundary: a bad file is reported and skipped; the rest still ingest.
		let raw: unknown;
		try {
			raw = await source.read(ref);
		} catch (e) {
			report.failed.push({ ref, error: `Unreadable: ${(e as Error).message}` });
			continue;
		}
		const parsed = envelope.safeParse(raw);
		if (!parsed.success) {
			report.failed.push({ ref, error: z.prettifyError(parsed.error) });
			continue;
		}
		const env = parsed.data;

		const inserted = await db.transaction(async (tx) => {
			const count = await insertIngested(tx, env.action_items);
			const recorded = await tx
				.insert(ingestRuns)
				.values({
					run_id: env.run_id,
					source_ref: ref,
					source: env.source,
					generated_at: env.generated_at,
					ingested_at: new Date().toISOString(),
					item_count: env.action_items.length,
					inserted_count: count,
					envelope: env
				})
				.onConflictDoNothing()
				.returning({ run_id: ingestRuns.run_id });
			return recorded.length > 0 ? count : null; // null: same run_id already ingested under another ref
		});

		if (inserted === null) report.skipped.push(ref);
		else
			report.ingested.push({ ref, run_id: env.run_id, items: env.action_items.length, inserted });
	}

	return report;
}
