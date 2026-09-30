// The sync engine: the same steps for every integration.
//
//   pull (connector, from its cursor) → validate (streams.ts, once)
//     → apply (mappers) + save the new cursor, in one transaction → follow-ups → record
//
// The cursor only advances when the data it covers is stored. A failed sync
// never throws to the caller: it marks the connection "error" with the reason
// (shown in the catalog), keeps the last good data, and is retried when next due.

import { and, eq, lt } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '$lib/server/db';
import { connectors } from './connectors.server';
import { afterApply, applyPull } from './mappers.server';
import { manifestOf } from './registry';
import { contextOf, listConnections, load } from './service.server';
import { pullResult } from './streams';
import { connections, syncRuns } from './table.server';

const KEEP_RUNS_DAYS = 7;
const running = new Map<string, Promise<void>>();

/** Sync one connection. Concurrent calls for the same connection share one run. */
export function syncConnection(id: string): Promise<void> {
	const inFlight = running.get(id);
	if (inFlight) return inFlight;
	const run = syncOnce(id).finally(() => running.delete(id));
	running.set(id, run);
	return run;
}

/**
 * Sync every connection whose data is stale. With `background`, only those
 * whose manifest opts into background sync. Returns how many were synced.
 */
export async function syncDue({ background = false } = {}): Promise<number> {
	const due = (await listConnections()).filter(
		(c) =>
			c.stale &&
			connectors[c.integration_id] &&
			(!background || manifestOf(c.integration_id)?.backgroundSync)
	);
	await Promise.all(due.map((c) => syncConnection(c.id)));
	return due.length;
}

async function syncOnce(id: string): Promise<void> {
	const c = await load(id);
	const started = new Date().toISOString();
	let counts: Record<string, number> = {};
	let failure: string | null = null;

	try {
		const raw = await connectors[c.integration_id].pull(contextOf(c));
		const parsed = pullResult.safeParse(raw); // the integration boundary
		if (!parsed.success) throw new Error(`Unexpected data: ${z.prettifyError(parsed.error)}`);
		const { cursor, ...streams } = parsed.data;
		counts = await db.transaction(async (tx) => {
			const applied = await applyPull(tx, c, manifestOf(c.integration_id)!, streams, started);
			if (cursor !== undefined) {
				await tx.update(connections).set({ cursor }).where(eq(connections.id, id));
			}
			return applied;
		});
		await afterApply(counts);
	} catch (e) {
		failure = (e as Error).message;
	}

	const finished = new Date().toISOString();
	await db
		.update(connections)
		.set({
			status: failure ? 'error' : 'active',
			last_error: failure,
			last_attempt_at: started,
			...(failure ? {} : { last_synced_at: started }),
			updated_at: finished
		})
		.where(eq(connections.id, id));
	await db.insert(syncRuns).values({
		id: `sr_${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`,
		connection_id: id,
		started_at: started,
		finished_at: finished,
		ok: !failure,
		counts,
		error: failure
	});
	const cutoff = new Date(Date.now() - KEEP_RUNS_DAYS * 86_400_000).toISOString();
	await db
		.delete(syncRuns)
		.where(and(eq(syncRuns.connection_id, id), lt(syncRuns.started_at, cutoff)));
}
