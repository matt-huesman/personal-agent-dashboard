// Start an OAuth connection: remember the flow in an encrypted, short-lived
// cookie (state + PKCE verifier + where to return), then go to the provider.
// The callback is /integrations/oauth/callback.

import { error, redirect } from '@sveltejs/kit';
import { encrypt } from '$lib/server/crypto';
import { authorizeUrl, newPkce } from '$lib/integrations/auth/oauth2.server';
import { manifestOf } from '$lib/integrations/registry';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ params, url, cookies }) => {
	const manifest = manifestOf(params.id);
	if (manifest?.auth.kind !== 'oauth2') error(404, `${params.id} doesn't connect with OAuth`);

	const state = crypto.randomUUID();
	const { verifier, challenge } = newPkce();
	const returnTo = url.searchParams.get('return') ?? '/';
	cookies.set(
		'integration_oauth',
		encrypt({ state, verifier, integration_id: manifest.id, returnTo }),
		{ path: '/integrations', httpOnly: true, sameSite: 'lax', maxAge: 600 }
	);

	redirect(
		303,
		authorizeUrl(manifest.auth.provider, {
			scopes: manifest.auth.scopes,
			redirectUri: `${url.origin}/integrations/oauth/callback`,
			state,
			challenge
		})
	);
};
