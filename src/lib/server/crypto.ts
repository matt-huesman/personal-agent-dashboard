// Encryption for secrets at rest. AES-256-GCM; the key comes from an env var
// and is hashed to 32 bytes, so any long random string works.
// Output: "v1.<iv>.<tag>.<ciphertext>" (base64url).
//
// Keys:
//   APP_SECRET  integration credentials in the database (never leaves this machine)
//   INBOX_KEY   inbox batches handed to the email agent through Drive (shared
//               with the cloud routine's environment, and nothing else)

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

export type KeyName = 'APP_SECRET' | 'INBOX_KEY';

function key(name: KeyName): Buffer {
	const secret = process.env[name];
	if (!secret) throw new Error(`${name} is not set (see .env.example)`);
	return createHash('sha256').update(secret).digest();
}

export function encrypt(value: unknown, keyName: KeyName = 'APP_SECRET'): string {
	const iv = randomBytes(12);
	const cipher = createCipheriv('aes-256-gcm', key(keyName), iv);
	const data = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
	return ['v1', iv, cipher.getAuthTag(), data]
		.map((p) => (typeof p === 'string' ? p : p.toString('base64url')))
		.join('.');
}

/** Decrypts what `encrypt` produced; throws if the data or key doesn't match. */
export function decrypt<T>(sealed: string, keyName: KeyName = 'APP_SECRET'): T {
	const [version, iv, tag, data] = sealed.split('.');
	if (version !== 'v1') throw new Error(`Unknown encryption format ${version}`);
	const decipher = createDecipheriv('aes-256-gcm', key(keyName), Buffer.from(iv, 'base64url'));
	decipher.setAuthTag(Buffer.from(tag, 'base64url'));
	const json = Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]);
	return JSON.parse(json.toString('utf8'));
}
