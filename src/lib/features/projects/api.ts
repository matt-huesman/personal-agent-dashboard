// Typed client for /api/projects.

import type { CreateProjectInput, ProjectRecord, UpdateProjectInput } from './schema';

async function send<T = void>(path: string, method: string, body?: unknown): Promise<T> {
	const res = await fetch(`/api/projects${path}`, {
		method,
		headers: body === undefined ? undefined : { 'content-type': 'application/json' },
		body: body === undefined ? undefined : JSON.stringify(body)
	});
	if (!res.ok) throw new Error((await res.json()).message ?? res.statusText);
	return res.status === 204 ? (undefined as T) : res.json();
}

export const projectsApi = {
	create: (input: CreateProjectInput): Promise<ProjectRecord> => send('', 'POST', input),
	update: (id: string, input: UpdateProjectInput): Promise<ProjectRecord> =>
		send(`/${id}`, 'PATCH', input),
	remove: (id: string) => send(`/${id}`, 'DELETE')
};
