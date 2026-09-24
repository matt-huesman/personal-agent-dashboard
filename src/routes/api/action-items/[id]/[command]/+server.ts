// State commands: POST /api/action-items/:id/{move|complete|reopen|restore}

import { error, json } from '@sveltejs/kit';
import { parseBody } from '$lib/server/http';
import { moveActionItemInput, type ActionItemRecord } from '$lib/features/action-items/schema';
import * as service from '$lib/features/action-items/service.server';
import type { RequestHandler } from './$types';

const commands: Record<string, (id: string, request: Request) => Promise<ActionItemRecord>> = {
	move: async (id, request) => service.move(id, await parseBody(request, moveActionItemInput)),
	complete: (id) => service.complete(id),
	reopen: (id) => service.reopen(id),
	restore: (id) => service.restore(id)
};

export const POST: RequestHandler = async ({ params, request }) => {
	if (!Object.hasOwn(commands, params.command)) error(404, `Unknown command ${params.command}`);
	return json(await commands[params.command](params.id, request));
};
