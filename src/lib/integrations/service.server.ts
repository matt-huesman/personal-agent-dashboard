// Connections: create, configure, remove, and build the context a connector
// runs in. Credentials are decrypted only here, on the server, per call.

import { error } from '@sveltejs/kit';
import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Option } from '$lib/components/fields/fields';
import { db } from '$lib/server/db';
import { decrypt, encrypt } from '$lib/server/crypto';
import { refresh, revoke } from './auth/oauth2.server';
import { connectors } from './connectors.server';
import { manifestOf } from './registry';
import { connections } from './table.server';
import type { ConnectionRecord, ConnectionSummary } from './schema';
import type { ConnectorContext, Credentials } from './types';

type Config = Record<string, unknown>;

const now = () => new Date().toISOString();
const newId = () => `cn_${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`;

function manifest(integrationId: string) {
	const m = manifestOf(integrationId);
	if (!m) error(404, `No integration ${integrationId}`);
	return m;
}

function connector(integrationId: string) {
	const c = connectors[integrationId];
	if (!c) error(400, `${manifest(integrationId).name} isn't connected from here`);
	return c;
}

// --- Reads -----------------------------------------------------------------------

/** What the browser may see: freshness included, credentials never. */
export function summarize(c: ConnectionRecord, at = new Date()): ConnectionSummary {
	const { credentials: _secret, ...rest } = c;
	const every = manifest(c.integration_id).syncEveryMinutes * 60_000;
	const next = c.last_attempt_at ? new Date(Date.parse(c.last_attempt_at) + every) : null;
	return { ...rest, next_sync_at: next?.toISOString() ?? null, stale: !next || next <= at };
}

export async function listConnections(): Promise<ConnectionSummary[]> {
	const rows = await db.select().from(connections).orderBy(asc(connections.created_at));
	return rows.map((c) => summarize(c));
}

export async function load(id: string): Promise<ConnectionRecord> {
	const [c] = await db.select().from(connections).where(eq(connections.id, id));
	if (!c) error(404, `No connection ${id}`);
	return c;
}

// --- Connector context -------------------------------------------------------------

/**
 * Everything a connector needs, with auth applied. OAuth access tokens are
 * refreshed shortly before expiry and the new token is saved (encrypted).
 */
export function contextFor(
	integrationId: string,
	credentials: Credentials,
	config: Config,
	{ connectionId, cursor = null }: { connectionId?: string; cursor?: unknown } = {}
): ConnectorContext<Config> {
	let current = credentials;
	const authedFetch = async (url: string, init: RequestInit = {}) => {
		if (current.kind !== 'oauth2') return fetch(url, init);
		if (Date.now() > current.expires_at - 60_000) {
			current = await refresh(current);
			if (connectionId) {
				await db
					.update(connections)
					.set({ credentials: encrypt(current), updated_at: now() })
					.where(eq(connections.id, connectionId));
			}
		}
		return fetch(url, {
			...init,
			headers: { ...init.headers, authorization: `Bearer ${current.access_token}` }
		});
	};
	return {
		config: manifest(integrationId).config.parse(config) as Config, // fills newer defaults
		credentials,
		fetch: authedFetch,
		now: new Date(),
		cursor
	};
}

export function contextOf(c: ConnectionRecord): ConnectorContext<Config> {
	return contextFor(c.integration_id, decrypt<Credentials>(c.credentials), c.config, {
		connectionId: c.id,
		cursor: c.cursor
	});
}

// --- Commands ----------------------------------------------------------------------

/** A new connection with default config, labelled by the connector. */
export async function connect(
	integrationId: string,
	credentials: Credentials
): Promise<ConnectionRecord> {
	const config = manifest(integrationId).config.parse({}) as Config;
	const account_label = await connector(integrationId).describe(
		contextFor(integrationId, credentials, config)
	);
	const timestamp = now();
	const [c] = await db
		.insert(connections)
		.values({
			id: newId(),
			integration_id: integrationId,
			account_label,
			status: 'active',
			credentials: encrypt(credentials),
			config,
			cursor: null,
			last_synced_at: null,
			last_attempt_at: null,
			last_error: null,
			created_at: timestamp,
			updated_at: timestamp
		})
		.returning();
	return c;
}

/** Save new settings (validated by the integration's own schema) and mark for re-sync. */
export async function configure(id: string, config: Config): Promise<ConnectionRecord> {
	const c = await load(id);
	const parsed = manifest(c.integration_id).config.safeParse(config);
	if (!parsed.success) error(400, z.prettifyError(parsed.error));
	const [updated] = await db
		.update(connections)
		.set({ config: parsed.data as Config, last_attempt_at: null, updated_at: now() })
		.where(eq(connections.id, id))
		.returning();
	return updated;
}

/** Revoke access (best effort) and delete; mirrored data goes with it (cascade). */
export async function disconnect(id: string): Promise<void> {
	const c = await load(id);
	const credentials = decrypt<Credentials>(c.credentials);
	if (credentials.kind === 'oauth2') await revoke(credentials);
	await db.delete(connections).where(eq(connections.id, id));
}

export async function options(id: string, source: string): Promise<Option[]> {
	const c = await load(id);
	return (await connector(c.integration_id).options?.(contextOf(c), source)) ?? [];
}
