import { today } from '$lib/dates';
import { listBoard } from '$lib/features/action-items/service.server';
import type { PageServerLoad } from './$types';

// Calls the service directly — no HTTP round trip to our own API.
export const load: PageServerLoad = async ({ url, parent }) => {
	await parent(); // let the layout's auto-ingest land first, so new items show now
	const day = today();
	return {
		today: day,
		items: await listBoard(day),
		projectFilter: url.searchParams.get('project')
	};
};
