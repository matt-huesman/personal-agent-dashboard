import { describe, expect, it } from 'vitest';
import type { ConnectorContext, Credentials } from '../types';
import { gmailConnector, htmlToText, inboxQuery, toMessageRecord } from './connector.server';
import { gmail, type GmailConfig } from './manifest';

const API = '/gmail/v1/users/me';
const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64url');

/** A fake Gmail that enforces the manifest's scopes, like the real one. */
function fakeGmail(messages: Record<string, unknown>) {
	const calls: string[] = [];
	const granted = gmail.auth.kind === 'oauth2' ? gmail.auth.scopes : [];
	const fetch = async (url: string) => {
		const u = new URL(url);
		calls.push(`${u.pathname}${u.search}`);
		if (!granted.includes('https://www.googleapis.com/auth/gmail.readonly')) {
			return Response.json({ error: { code: 403 } }, { status: 403 });
		}
		if (u.pathname === `${API}/profile`) return Response.json({ emailAddress: 'me@work.com' });
		if (u.pathname === `${API}/messages`) {
			return Response.json({ messages: Object.keys(messages).map((id) => ({ id })) });
		}
		const id = u.pathname.split('/').at(-1)!;
		return messages[id] ? Response.json(messages[id]) : new Response('nope', { status: 404 });
	};
	return { fetch, calls };
}

const ctx = (
	fetch: ConnectorContext<unknown>['fetch'],
	cursor: unknown,
	config: GmailConfig = { skip_promotions: true }
) =>
	({
		config,
		fetch,
		cursor,
		now: new Date('2026-09-29T12:00:00Z'),
		credentials: {} as Credentials
	}) satisfies ConnectorContext<GmailConfig>;

const raw = (id: string, payload: object) => ({
	id,
	threadId: `t-${id}`,
	labelIds: ['INBOX', 'UNREAD'],
	snippet: 'Quick question about Friday',
	internalDate: String(Date.parse('2026-09-29T11:30:00Z')),
	payload: {
		headers: [
			{ name: 'From', value: 'Advisor <advisor@uni.edu>' },
			{ name: 'To', value: 'me@work.com' },
			{ name: 'Subject', value: 'Friday meeting' }
		],
		...payload
	}
});

describe('Gmail connector', () => {
	it('prefers the plain-text part and links to the right account', () => {
		const m = toMessageRecord(
			raw('m1', {
				mimeType: 'multipart/alternative',
				parts: [
					{ mimeType: 'text/plain', body: { data: b64('Can we move to 3pm?\n') } },
					{ mimeType: 'text/html', body: { data: b64('<p>Can we move to <b>3pm</b>?</p>') } }
				]
			}),
			'me@work.com'
		);
		expect(m).toMatchObject({
			external_id: 'm1',
			thread_id: 't-m1',
			account: 'me@work.com',
			from: 'Advisor <advisor@uni.edu>',
			subject: 'Friday meeting',
			received_at: '2026-09-29T11:30:00.000Z',
			body: 'Can we move to 3pm?',
			url: 'https://mail.google.com/mail/u/me%40work.com/#all/m1'
		});
	});

	it('falls back to readable text from HTML-only mail, and trims long bodies', () => {
		const html = toMessageRecord(
			raw('m2', {
				mimeType: 'text/html',
				body: {
					data: b64('<style>p{}</style><p>Rent due&nbsp;<b>Friday</b></p><p>Thanks &amp; bye</p>')
				}
			}),
			'me@work.com'
		);
		expect(html.body).toBe('Rent due Friday\n\nThanks & bye');

		const long = toMessageRecord(
			raw('m3', { mimeType: 'text/plain', body: { data: b64('x'.repeat(9000)) } }),
			'a'
		);
		expect(long.body.length).toBeLessThan(8100);
		expect(long.body.endsWith('[…trimmed]')).toBe(true);
		expect(htmlToText('<script>evil()</script>Hi')).toBe('Hi');
	});

	it('starts from the moment it is connected, without backfilling', async () => {
		const { fetch, calls } = fakeGmail({});
		const result = (await gmailConnector.pull(ctx(fetch, null))) as {
			messages: unknown[];
			cursor: { after: number };
		};
		expect(result.messages).toEqual([]);
		expect(result.cursor.after).toBe(Date.parse('2026-09-29T12:00:00Z') / 1000);
		expect(calls).toEqual([]);
	});

	it('fetches inbox mail since the cursor, with overlap, and advances it', async () => {
		const { fetch, calls } = fakeGmail({
			m1: raw('m1', { mimeType: 'text/plain', body: { data: b64('hello') } })
		});
		const after = Date.parse('2026-09-29T11:00:00Z') / 1000;
		const result = (await gmailConnector.pull(ctx(fetch, { after }))) as {
			messages: { external_id: string; account: string }[];
			cursor: { after: number };
		};
		expect(result.messages.map((m) => [m.external_id, m.account])).toEqual([['m1', 'me@work.com']]);
		expect(result.cursor.after).toBe(Date.parse('2026-09-29T12:00:00Z') / 1000);
		const list = new URL(
			calls.find((c) => c.startsWith(`${API}/messages?`))!,
			'https://x'
		).searchParams.get('q')!;
		expect(list).toContain(`in:inbox after:${after - 3600}`); // an hour of overlap
		expect(list).toContain('-category:promotions -category:social');
	});

	it('includes Promotions and Social when the account is set to', () => {
		expect(inboxQuery(100, { skip_promotions: false })).toBe('in:inbox after:100');
	});
});
