import { ingestIfStale } from '$lib/ingest/auto.server';
import { listProjects } from '$lib/features/projects/service.server';
import type { LayoutServerLoad } from './$types';

// Shell data for every page. Any page load is also the moment to pick up new
// envelopes (throttled; see ingest/auto.server.ts).
export const load: LayoutServerLoad = async () => {
	await ingestIfStale();
	return { projects: await listProjects() };
};
