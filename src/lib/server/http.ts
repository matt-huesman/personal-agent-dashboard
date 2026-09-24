import { error } from '@sveltejs/kit';
import { z } from 'zod';

/** Validate a JSON request body — the HTTP boundary. Bad input is a 400, not a 500. */
export async function parseBody<T extends z.ZodType>(
	request: Request,
	schema: T
): Promise<z.output<T>> {
	const body = await request.json().catch(() => error(400, 'Request body must be JSON'));
	const result = schema.safeParse(body);
	if (!result.success) error(400, z.prettifyError(result.error));
	return result.data;
}
