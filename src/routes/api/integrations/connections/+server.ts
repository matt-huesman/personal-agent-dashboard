// Connect a URL-based integration (e.g. an iCal feed). OAuth integrations
// connect through /integrations/[id]/connect instead.

import { error, json } from '@sveltejs/kit';
import { parseBody } from '$lib/server/http';
import { manifestOf } from '$lib/integrations/registry';
import { connectUrlInput } from '$lib/integrations/schema';
import { connect, listConnections, summarize } from '$lib/integrations/service.server';
import { syncConnection } from '$lib/integrations/sync.server';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => json(await listConnections());

export const POST: RequestHandler = async ({ request }) => {
	const { integration_id, url } = await parseBody(request, connectUrlInput);
	if (manifestOf(integration_id)?.auth.kind !== 'url')
		error(400, `${integration_id} doesn't take a URL`);
	if (!URL.canParse(url) || !/^(https?|webcal):$/i.test(new URL(url).protocol)) {
		error(400, 'Use a link starting with https:// or webcal://');
	}

	// connect() asks the connector to name the source, so a bad link fails here, not later.
	const connection = await connect(integration_id, { kind: 'url', url }).catch((e: Error) =>
		error(400, e.message)
	);
	await syncConnection(connection.id);
	return json(summarize(connection), { status: 201 });
};
