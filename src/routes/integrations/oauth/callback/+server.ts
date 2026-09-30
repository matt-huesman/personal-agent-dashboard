// The provider sends the user back here. Verify the flow, exchange the code,
// store the connection, run its first sync, and return to the catalog with
// the new connection open for configuration.

import { redirect } from '@sveltejs/kit';
import { decrypt } from '$lib/server/crypto';
import { exchangeCode, missingScopes, revoke } from '$lib/integrations/auth/oauth2.server';
import { manifestOf } from '$lib/integrations/registry';
import { connect } from '$lib/integrations/service.server';
import { syncConnection } from '$lib/integrations/sync.server';
import type { RequestHandler } from './$types';

const COOKIE = 'integration_oauth';

type Flow = { state: string; verifier: string; integration_id: string; returnTo: string };

export const GET: RequestHandler = async ({ url, cookies }) => {
	const sealed = cookies.get(COOKIE);
	cookies.delete(COOKIE, { path: '/integrations' });
	const flow = sealed ? decrypt<Flow>(sealed) : null;

	const back = (params: Record<string, string>) => {
		const target = new URL(flow?.returnTo ?? '/', url.origin);
		for (const [k, v] of Object.entries({ panel: 'integrations', ...params }))
			target.searchParams.set(k, v);
		return `${target.pathname}${target.search}`;
	};

	if (!flow || url.searchParams.get('state') !== flow.state) {
		// Usually: more than 10 minutes on the consent screen, a second Connect
		// click replacing the first attempt, a reload/Back on this page, or
		// starting at a different address (127.0.0.1 vs localhost).
		redirect(
			303,
			back({
				error:
					'That sign-in attempt expired or was replaced by a newer one. Click Connect once and finish within 10 minutes, using the same address (localhost:3000) throughout.'
			})
		);
	}
	const denied = url.searchParams.get('error');
	const code = url.searchParams.get('code');
	if (denied || !code)
		redirect(
			303,
			back({
				error:
					denied === 'access_denied' ? 'Access was not granted.' : `Sign-in failed (${denied}).`
			})
		);

	const manifest = manifestOf(flow.integration_id);
	if (manifest?.auth.kind !== 'oauth2') redirect(303, back({ error: 'Unknown integration.' }));

	let connectionId: string;
	try {
		const credentials = await exchangeCode(manifest.auth.provider, {
			code,
			verifier: flow.verifier,
			redirectUri: `${url.origin}/integrations/oauth/callback`
		});
		const missing = missingScopes(credentials.scope, manifest.auth.scopes);
		if (missing.length > 0) {
			await revoke(credentials);
			const names = missing.map((s) => s.split('/').at(-1)).join(', ');
			throw new Error(
				`Some permissions weren't granted (${names}). Connect again and leave every permission ticked on Google's screen.`
			);
		}
		connectionId = (await connect(manifest.id, credentials)).id;
	} catch (e) {
		redirect(303, back({ error: (e as Error).message }));
	}
	await syncConnection(connectionId);
	redirect(303, back({ connection: connectionId }));
};
