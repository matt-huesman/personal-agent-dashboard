import { json } from '@sveltejs/kit';
import { parseBody } from '$lib/server/http';
import { plannerSettings } from '$lib/features/planner/schema';
import { getSettings, saveSettings } from '$lib/features/planner/service.server';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => json(await getSettings());

export const PUT: RequestHandler = async ({ request }) =>
	json(await saveSettings(await parseBody(request, plannerSettings)));
