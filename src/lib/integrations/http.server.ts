import type { ConnectorContext } from './types';

/** GET JSON through the connection's fetch; a non-2xx is an error with the provider's message. */
export async function getJson<T>(ctx: ConnectorContext<unknown>, url: string): Promise<T> {
	const res = await ctx.fetch(url);
	if (!res.ok)
		throw new Error(`${res.status} from ${new URL(url).host}: ${(await res.text()).slice(0, 300)}`);
	return res.json() as Promise<T>;
}

/** The sync window every calendar connector uses: a week back, two months ahead. */
export function syncWindow(now: Date): { from: Date; to: Date } {
	const day = 24 * 60 * 60 * 1000;
	return { from: new Date(now.getTime() - 7 * day), to: new Date(now.getTime() + 60 * day) };
}
