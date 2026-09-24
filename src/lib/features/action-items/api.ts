// Typed client for /api/action-items. Bodies are the same schemas the server
// validates with, so a shape change surfaces here at compile time.

import type { z } from 'zod';
import type {
	ActionItemRecord,
	createActionItemInput,
	MoveActionItemInput,
	UpdateActionItemInput
} from './schema';

async function send<T = void>(path: string, method: string, body?: unknown): Promise<T> {
	const res = await fetch(`/api/action-items${path}`, {
		method,
		headers: body === undefined ? undefined : { 'content-type': 'application/json' },
		body: body === undefined ? undefined : JSON.stringify(body)
	});
	if (!res.ok) throw new Error((await res.json()).message ?? res.statusText);
	return res.status === 204 ? (undefined as T) : res.json();
}

type Item = Promise<ActionItemRecord>;

export const actionItemsApi = {
	create: (input: z.input<typeof createActionItemInput>): Item => send('', 'POST', input),
	update: (id: string, input: UpdateActionItemInput): Item => send(`/${id}`, 'PATCH', input),
	remove: (id: string) => send(`/${id}`, 'DELETE'),
	move: (id: string, input: MoveActionItemInput): Item => send(`/${id}/move`, 'POST', input),
	complete: (id: string): Item => send(`/${id}/complete`, 'POST'),
	reopen: (id: string): Item => send(`/${id}/reopen`, 'POST'),
	restore: (id: string): Item => send(`/${id}/restore`, 'POST')
};
