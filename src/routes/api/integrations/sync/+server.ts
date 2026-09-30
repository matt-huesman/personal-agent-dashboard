// POST {}                 → sync every connection that's stale (freshness loop)
// POST { connection_id }  → sync that one now ("Sync now")
// POST { all: true }      → sync every connection now ("Check for new")

import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { parseBody } from '$lib/server/http';
import { connectors } from '$lib/integrations/connectors.server';
import { listConnections } from '$lib/integrations/service.server';
import { syncConnection, syncDue } from '$lib/integrations/sync.server';
import type { RequestHandler } from './$types';

const syncInput = z.object({
	connection_id: z.string().optional(),
	all: z.boolean().optional()
});

export const POST: RequestHandler = async ({ request }) => {
	const { connection_id, all } = await parseBody(request, syncInput);
	let synced: number;
	if (connection_id) {
		await syncConnection(connection_id);
		synced = 1;
	} else if (all) {
		const every = (await listConnections()).filter((c) => connectors[c.integration_id]);
		await Promise.all(every.map((c) => syncConnection(c.id)));
		synced = every.length;
	} else {
		synced = await syncDue();
	}
	return json({ synced, connections: await listConnections() });
};
