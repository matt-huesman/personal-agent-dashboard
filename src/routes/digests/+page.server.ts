import { listDigests } from '$lib/features/digests/service.server';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	await parent(); // let the layout's auto-ingest land first
	return { digests: await listDigests() };
};
