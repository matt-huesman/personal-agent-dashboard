import type { ServerInit } from '@sveltejs/kit';
import { migrate } from '$lib/server/db';
import { startBackgroundSync } from '$lib/integrations/background.server';

export const init: ServerInit = async () => {
	await migrate();
	startBackgroundSync();
};
