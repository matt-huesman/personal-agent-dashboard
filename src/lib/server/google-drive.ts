// Minimal Google Drive v3 client over fetch — no SDK. Used by the dashboard
// (DriveSource: list + read) and the producer script (find latest + upload).
//
// Auth: an OAuth "Desktop" client with the drive.file scope, i.e. access to
// files this app created and nothing else. A long-lived refresh token (from
// `pnpm drive:auth`) is exchanged for short-lived access tokens here.
//
// Env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN.

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
export const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';

export type DriveFile = { id: string; name: string };

export function env(name: string): string {
	const value = process.env[name];
	if (!value) throw new Error(`${name} is not set (see docs/google-setup.md)`);
	return value;
}

let token: { value: string; expires: number } | null = null;

async function accessToken(): Promise<string> {
	if (token && Date.now() < token.expires) return token.value;
	const res = await fetch(TOKEN_URL, {
		method: 'POST',
		body: new URLSearchParams({
			grant_type: 'refresh_token',
			client_id: env('GOOGLE_CLIENT_ID'),
			client_secret: env('GOOGLE_CLIENT_SECRET'),
			refresh_token: env('GOOGLE_REFRESH_TOKEN')
		})
	});
	if (!res.ok) throw new Error(`Google token refresh failed: ${res.status} ${await res.text()}`);
	const body = (await res.json()) as { access_token: string; expires_in: number };
	token = { value: body.access_token, expires: Date.now() + (body.expires_in - 60) * 1000 };
	return token.value;
}

async function drive(url: string, init: RequestInit = {}): Promise<Response> {
	const res = await fetch(url, {
		...init,
		headers: { ...init.headers, authorization: `Bearer ${await accessToken()}` }
	});
	if (!res.ok)
		throw new Error(`Drive ${init.method ?? 'GET'} ${url} → ${res.status} ${await res.text()}`);
	return res;
}

/** JSON files directly inside a folder, sorted by name. */
export async function listJsonFiles(folderId: string): Promise<DriveFile[]> {
	const files: DriveFile[] = [];
	let pageToken: string | undefined;
	do {
		const params = new URLSearchParams({
			q: `'${folderId}' in parents and trashed = false and mimeType = 'application/json'`,
			fields: 'nextPageToken, files(id, name)',
			orderBy: 'name',
			pageSize: '1000'
		});
		if (pageToken) params.set('pageToken', pageToken);
		const page = (await (await drive(`${API}/files?${params}`)).json()) as {
			files: DriveFile[];
			nextPageToken?: string;
		};
		files.push(...page.files);
		pageToken = page.nextPageToken;
	} while (pageToken);
	return files;
}

export async function readJson(fileId: string): Promise<unknown> {
	return (await drive(`${API}/files/${fileId}?alt=media`)).json();
}

export async function uploadJson(
	folderId: string,
	name: string,
	data: unknown
): Promise<DriveFile> {
	const boundary = `boundary-${crypto.randomUUID()}`;
	const metadata = { name, parents: [folderId], mimeType: 'application/json' };
	const body = [
		`--${boundary}`,
		'content-type: application/json; charset=UTF-8',
		'',
		JSON.stringify(metadata),
		`--${boundary}`,
		'content-type: application/json',
		'',
		JSON.stringify(data, null, 2),
		`--${boundary}--`
	].join('\r\n');
	const res = await drive(`${UPLOAD}/files?uploadType=multipart&fields=id,name`, {
		method: 'POST',
		headers: { 'content-type': `multipart/related; boundary=${boundary}` },
		body
	});
	return res.json();
}

export async function createFolder(name: string): Promise<DriveFile> {
	const res = await drive(`${API}/files?fields=id,name`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder' })
	});
	return res.json();
}
