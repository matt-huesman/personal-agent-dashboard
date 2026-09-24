import { json } from '@sveltejs/kit';
import { parseBody } from '$lib/server/http';
import { createActionItemInput } from '$lib/features/action-items/schema';
import { create, listBoard } from '$lib/features/action-items/service.server';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => json(await listBoard());

export const POST: RequestHandler = async ({ request }) =>
	json(await create(await parseBody(request, createActionItemInput)), { status: 201 });
