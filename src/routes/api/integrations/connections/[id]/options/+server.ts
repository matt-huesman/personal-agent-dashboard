import { error, json } from '@sveltejs/kit';
import { options } from '$lib/integrations/service.server';
import type { RequestHandler } from './$types';

/** Choices for a config field, e.g. ?source=calendars → the account's calendars. */
export const GET: RequestHandler = async ({ params, url }) => {
	const source = url.searchParams.get('source');
	if (!source) error(400, 'Missing ?source=');
	return json(await options(params.id, source).catch((e: Error) => error(502, e.message)));
};
