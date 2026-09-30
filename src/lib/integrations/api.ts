// Typed browser client for /api/integrations.

import type { Option } from '$lib/components/fields/fields';
import type { ConnectionSummary } from './schema';

async function send<T>(path: string, method: string, body?: unknown): Promise<T> {
	const res = await fetch(`/api/integrations${path}`, {
		method,
		headers: body === undefined ? undefined : { 'content-type': 'application/json' },
		body: body === undefined ? undefined : JSON.stringify(body)
	});
	if (!res.ok) throw new Error((await res.json()).message ?? res.statusText);
	return res.status === 204 ? (undefined as T) : res.json();
}

export const integrationsApi = {
	connectUrl: (integration_id: string, url: string) =>
		send<ConnectionSummary>('/connections', 'POST', { integration_id, url }),
	configure: (id: string, config: Record<string, unknown>) =>
		send<ConnectionSummary>(`/connections/${id}`, 'PATCH', { config }),
	disconnect: (id: string) => send<void>(`/connections/${id}`, 'DELETE'),
	options: (id: string, source: string) =>
		send<Option[]>(`/connections/${id}/options?source=${encodeURIComponent(source)}`, 'GET'),
	/** Sync one connection (`connection_id`), everything (`all`), or by default what's stale. */
	sync: (target: { connection_id?: string; all?: boolean } = {}) =>
		send<{ synced: number; connections: ConnectionSummary[] }>('/sync', 'POST', target)
};

/** Whether a connection's data is due for a refresh, at this moment. */
export function isStale(c: ConnectionSummary, now = Date.now()): boolean {
	return !c.next_sync_at || Date.parse(c.next_sync_at) <= now;
}
