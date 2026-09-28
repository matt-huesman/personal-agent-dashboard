// One-time Google setup (docs/google-setup.md, step 2):
//   1. Browser consent for this app's Drive access (drive.file scope only).
//   2. Creates the inbox folder in your Drive (skipped if DRIVE_FOLDER_ID is set).
//   3. Writes GOOGLE_REFRESH_TOKEN and DRIVE_FOLDER_ID into .env and prints them
//      for the cloud routine's environment.
//
// Needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.

import { execFile } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { createFolder, DRIVE_SCOPE, env, TOKEN_URL } from '$lib/server/google-drive';

const FOLDER_NAME = 'Agent Dashboard Inbox';

const clientId = env('GOOGLE_CLIENT_ID');
const clientSecret = env('GOOGLE_CLIENT_SECRET');

// Loopback redirect + PKCE, per Google's guidance for desktop apps.
const verifier = randomBytes(32).toString('base64url');
const challenge = createHash('sha256').update(verifier).digest('base64url');

const server = http.createServer();
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
const redirectUri = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
	client_id: clientId,
	redirect_uri: redirectUri,
	response_type: 'code',
	scope: DRIVE_SCOPE,
	access_type: 'offline',
	prompt: 'consent',
	code_challenge: challenge,
	code_challenge_method: 'S256'
})}`;

console.log(
	`Opening your browser to authorize Drive access. If it doesn't open, visit:\n\n${authUrl}\n`
);
execFile('open', [authUrl]);

const code = await new Promise<string>((resolve, reject) => {
	server.on('request', (req, res) => {
		const params = new URL(req.url ?? '/', redirectUri).searchParams;
		const code = params.get('code');
		res.end(
			code ? 'Authorized. You can close this tab.' : `Authorization failed: ${params.get('error')}`
		);
		if (code) resolve(code);
		else reject(new Error(`Authorization failed: ${params.get('error')}`));
	});
});
server.close();

const res = await fetch(TOKEN_URL, {
	method: 'POST',
	body: new URLSearchParams({
		grant_type: 'authorization_code',
		code,
		code_verifier: verifier,
		redirect_uri: redirectUri,
		client_id: clientId,
		client_secret: clientSecret
	})
});
if (!res.ok) throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
const { refresh_token } = (await res.json()) as { refresh_token: string };
process.env.GOOGLE_REFRESH_TOKEN = refresh_token;

const folderId = process.env.DRIVE_FOLDER_ID || (await createFolder(FOLDER_NAME)).id;

await upsertEnv('.env', { GOOGLE_REFRESH_TOKEN: refresh_token, DRIVE_FOLDER_ID: folderId });

console.log(`Done. Saved to .env. For the cloud routine's environment variables, use:

GOOGLE_CLIENT_ID=${clientId}
GOOGLE_CLIENT_SECRET=${clientSecret}
GOOGLE_REFRESH_TOKEN=${refresh_token}
DRIVE_FOLDER_ID=${folderId}
`);

async function upsertEnv(path: string, values: Record<string, string>) {
	let text = await readFile(path, 'utf8');
	for (const [key, value] of Object.entries(values)) {
		const line = `${key}=${value}`;
		const pattern = new RegExp(`^${key}=.*$`, 'm');
		text = pattern.test(text) ? text.replace(pattern, line) : `${text.trimEnd()}\n${line}\n`;
	}
	await writeFile(path, text);
}
