import { ingestIfStale } from '$lib/ingest/auto.server';
import { emailAgentStatus } from '$lib/features/email/service.server';
import { listProjects } from '$lib/features/projects/service.server';
import { listConnections } from '$lib/integrations/service.server';
import type { LayoutServerLoad } from './$types';

// Shell data for every page. Any page load is also the moment to pick up new
// envelopes (throttled; see ingest/auto.server.ts). Integration syncs are not
// awaited here: the browser's freshness loop (and, for mail, the background
// sync) triggers them without holding up the page.
export const load: LayoutServerLoad = async () => {
	await ingestIfStale();
	const [projects, connections, emailAgent] = await Promise.all([
		listProjects(),
		listConnections(),
		emailAgentStatus()
	]);
	return { projects, integrations: { connections, emailAgent } };
};
