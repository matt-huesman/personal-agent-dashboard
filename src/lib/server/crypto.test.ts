import { describe, expect, it } from 'vitest';
import { decrypt, encrypt } from './crypto';

describe('credential encryption', () => {
	it('round-trips values and never stores them in the clear', () => {
		const secret = { kind: 'oauth2', refresh_token: '1//very-secret' };
		const sealed = encrypt(secret);
		expect(sealed).not.toContain('very-secret');
		expect(sealed.startsWith('v1.')).toBe(true);
		expect(decrypt(sealed)).toEqual(secret);
		expect(encrypt(secret)).not.toBe(sealed); // fresh IV every time
	});

	it('rejects tampered data', () => {
		const [v, iv, tag, data] = encrypt({ a: 1 }).split('.');
		const flipped = data.slice(0, -2) + (data.at(-2) === 'A' ? 'B' : 'A') + data.at(-1);
		expect(() => decrypt([v, iv, tag, flipped].join('.'))).toThrow();
	});
});
