import { json } from '@sveltejs/kit';
import { ingest } from '$lib/ingest/run.server';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async () => json(await ingest());
