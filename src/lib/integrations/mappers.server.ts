// Stream → app storage, written once per stream (not per integration). Each
// stream's semantics are defined in streams.ts.

import { eq } from 'drizzle-orm';
import type { Tx } from '$lib/server/db';
import { calendarEvents } from '$lib/features/calendar/table.server';
import { publishInbox, storeMessages } from '$lib/features/email/service.server';
import type { ConnectionRecord } from './schema';
import type { PullResult } from './streams';
import type { IntegrationManifest } from './types';

/** Store one pull's streams (inside the sync transaction). Returns counts per stream. */
export async function applyPull(
	tx: Tx,
	connection: ConnectionRecord,
	manifest: IntegrationManifest,
	data: Omit<PullResult, 'cursor'>,
	syncedAt: string
): Promise<Record<string, number>> {
	const counts: Record<string, number> = {};

	if (data.events) {
		// Snapshot: events mirror the source, so replace this connection's set wholesale.
		const unique = [...new Map(data.events.map((e) => [e.external_id, e])).values()];
		await tx.delete(calendarEvents).where(eq(calendarEvents.connection_id, connection.id));
		if (unique.length > 0) {
			await tx.insert(calendarEvents).values(
				unique.map((e) => ({
					...e,
					connection_id: connection.id,
					read_only: manifest.readOnly,
					synced_at: syncedAt
				}))
			);
		}
		counts.events = unique.length;
	}

	if (data.messages) {
		// Append: only new mail is stored; old mail ages out.
		counts.messages = await storeMessages(tx, connection.id, data.messages, syncedAt);
	}

	return counts;
}

/** Follow-ups once a sync has committed (network work stays outside the transaction). */
export async function afterApply(counts: Record<string, number>): Promise<void> {
	if (counts.messages) await publishInbox(); // new mail → the email agent
}
