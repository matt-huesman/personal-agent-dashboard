import { z } from 'zod';
import { isoDateTime } from '$lib/schema-primitives';

export const CONNECTION_STATUSES = ['active', 'error'] as const;

/** One connected account or source. `credentials` is encrypted (server/crypto.ts). */
export const connectionRecord = z.object({
	id: z.string(),
	integration_id: z.string(),
	account_label: z.string(),
	status: z.enum(CONNECTION_STATUSES),
	credentials: z.string(),
	config: z.record(z.string(), z.unknown()),
	cursor: z.unknown(), // the connector's position (e.g. last mail fetched); null = start fresh
	last_synced_at: isoDateTime.nullable(), // last successful sync
	last_attempt_at: isoDateTime.nullable(),
	last_error: z.string().nullable(),
	created_at: isoDateTime,
	updated_at: isoDateTime
});

export const syncRunRecord = z.object({
	id: z.string(),
	connection_id: z.string(),
	started_at: isoDateTime,
	finished_at: isoDateTime,
	ok: z.boolean(),
	counts: z.record(z.string(), z.number()), // records stored per stream
	error: z.string().nullable()
});

export type ConnectionRecord = z.infer<typeof connectionRecord>;
export type SyncRunRecord = z.infer<typeof syncRunRecord>;

/** A connection as the browser sees it: never the credentials. */
export type ConnectionSummary = Omit<ConnectionRecord, 'credentials'> & {
	stale: boolean; // due for a sync (freshness window passed)
	next_sync_at: string | null;
};

// --- HTTP inputs -------------------------------------------------------------

export const connectUrlInput = z.object({
	integration_id: z.string(),
	url: z.string().trim().min(1)
});
export const updateConnectionInput = z.object({ config: z.record(z.string(), z.unknown()) });
