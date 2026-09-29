import { json } from '@sveltejs/kit';
import { parseBody } from '$lib/server/http';
import { createProjectInput } from '$lib/features/projects/schema';
import { create, listProjects } from '$lib/features/projects/service.server';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => json(await listProjects());

export const POST: RequestHandler = async ({ request }) =>
	json(await create(await parseBody(request, createProjectInput)), { status: 201 });
