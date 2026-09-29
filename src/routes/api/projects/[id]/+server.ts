import { json } from '@sveltejs/kit';
import { parseBody } from '$lib/server/http';
import { updateProjectInput } from '$lib/features/projects/schema';
import { remove, update } from '$lib/features/projects/service.server';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async ({ params, request }) =>
	json(await update(params.id, await parseBody(request, updateProjectInput)));

export const DELETE: RequestHandler = async ({ params }) => {
	await remove(params.id);
	return new Response(null, { status: 204 });
};
