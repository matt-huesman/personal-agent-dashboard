import { error, json } from '@sveltejs/kit';
import { ingest } from '$lib/ingest/run.server';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async () => {
	// The source is external (Drive, network); report why it's unreachable.
	const report = await ingest().catch((e: Error) => error(502, e.message));
	return json(report);
};
