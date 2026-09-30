// Generic OAuth 2.0 (authorization code + PKCE) for every provider. A provider
// is only endpoints and client credentials; adding one (Slack, Microsoft) is
// an entry in `providers`, not new flow code.

import { createHash, randomBytes } from 'node:crypto';
import type { Credentials } from '../types';

type OAuthCredentials = Extract<Credentials, { kind: 'oauth2' }>;
type ProviderId = OAuthCredentials['provider'];

type Provider = {
	authorizeUrl: string;
	tokenUrl: string;
	revokeUrl?: string;
	extraParams: Record<string, string>;
	client(): { id: string; secret: string };
};

function required(name: string): string {
	const value = process.env[name];
	if (!value) throw new Error(`${name} is not set (see docs/google-setup.md)`);
	return value;
}

const providers: Record<ProviderId, Provider> = {
	google: {
		authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
		tokenUrl: 'https://oauth2.googleapis.com/token',
		revokeUrl: 'https://oauth2.googleapis.com/revoke',
		// Offline access for a refresh token; consent each time so Google re-issues it.
		extraParams: { access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true' },
		// Same client as Drive by default. If Google rejects the redirect URI for a
		// Desktop-type client, create a Web client and set the INTEGRATIONS pair.
		client: () => ({
			id: process.env.GOOGLE_INTEGRATIONS_CLIENT_ID || required('GOOGLE_CLIENT_ID'),
			secret: process.env.GOOGLE_INTEGRATIONS_CLIENT_SECRET || required('GOOGLE_CLIENT_SECRET')
		})
	}
};

export function newPkce() {
	const verifier = randomBytes(32).toString('base64url');
	return { verifier, challenge: createHash('sha256').update(verifier).digest('base64url') };
}

export function authorizeUrl(
	provider: ProviderId,
	{
		scopes,
		redirectUri,
		state,
		challenge
	}: { scopes: string[]; redirectUri: string; state: string; challenge: string }
): string {
	const p = providers[provider];
	return `${p.authorizeUrl}?${new URLSearchParams({
		client_id: p.client().id,
		redirect_uri: redirectUri,
		response_type: 'code',
		scope: scopes.join(' '),
		state,
		code_challenge: challenge,
		code_challenge_method: 'S256',
		...p.extraParams
	})}`;
}

async function tokenRequest(provider: ProviderId, params: Record<string, string>) {
	const p = providers[provider];
	const { id, secret } = p.client();
	const res = await fetch(p.tokenUrl, {
		method: 'POST',
		body: new URLSearchParams({ client_id: id, client_secret: secret, ...params })
	});
	const body = await res.json();
	if (!res.ok) {
		const reason =
			body.error === 'invalid_grant'
				? 'Access was revoked or expired. Reconnect.'
				: (body.error_description ?? body.error);
		throw new Error(`Sign-in failed: ${reason}`);
	}
	return body as {
		access_token: string;
		refresh_token?: string;
		expires_in: number;
		scope: string;
	};
}

export async function exchangeCode(
	provider: ProviderId,
	{ code, verifier, redirectUri }: { code: string; verifier: string; redirectUri: string }
): Promise<OAuthCredentials> {
	const t = await tokenRequest(provider, {
		grant_type: 'authorization_code',
		code,
		code_verifier: verifier,
		redirect_uri: redirectUri
	});
	if (!t.refresh_token) throw new Error('The provider did not return a refresh token.');
	return {
		kind: 'oauth2',
		provider,
		access_token: t.access_token,
		refresh_token: t.refresh_token,
		expires_at: Date.now() + t.expires_in * 1000,
		scope: t.scope
	};
}

export async function refresh(credentials: OAuthCredentials): Promise<OAuthCredentials> {
	const t = await tokenRequest(credentials.provider, {
		grant_type: 'refresh_token',
		refresh_token: credentials.refresh_token
	});
	return {
		...credentials,
		access_token: t.access_token,
		expires_at: Date.now() + t.expires_in * 1000,
		refresh_token: t.refresh_token ?? credentials.refresh_token
	};
}

/**
 * Scopes the user didn't grant. Consent screens can let people untick
 * individual permissions, so what was granted is checked, not assumed.
 */
export function missingScopes(granted: string, required: string[]): string[] {
	const have = new Set(granted.split(/\s+/));
	return required.filter((scope) => !have.has(scope));
}

/** Best effort: the connection is removed locally whether or not this succeeds. */
export async function revoke(credentials: OAuthCredentials): Promise<void> {
	const url = providers[credentials.provider].revokeUrl;
	if (!url) return;
	await fetch(url, {
		method: 'POST',
		body: new URLSearchParams({ token: credentials.refresh_token })
	}).catch(() => {});
}
