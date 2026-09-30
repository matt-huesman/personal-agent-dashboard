import { json } from '@sveltejs/kit';
import { parseBody } from '$lib/server/http';
import { updateConnectionInput } from '$lib/integrations/schema';
import { configure, disconnect, load, summarize } from '$lib/integrations/service.server';
import { syncConnection } from '$lib/integrations/sync.server';
import type { RequestHandler } from './$types';

/** Save settings, then re-sync so the change shows immediately. */
export const PATCH: RequestHandler = async ({ params, request }) => {
	const { config } = await parseBody(request, updateConnectionInput);
	await configure(params.id, config);
	await syncConnection(params.id);
	return json(summarize(await load(params.id)));
};

export const DELETE: RequestHandler = async ({ params }) => {
	await disconnect(params.id);
	return new Response(null, { status: 204 });
};
