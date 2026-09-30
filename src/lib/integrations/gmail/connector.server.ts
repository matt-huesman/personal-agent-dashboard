// Gmail → message stream. Read-only scope. Each pull fetches inbox mail since
// the cursor (with an hour of overlap; duplicates are ignored on insert).
// A new connection starts from the moment it's connected: no backfill, so
// mail that an earlier digest already covered isn't triaged twice.

import { getJson } from '../http.server';
import type { MessageRecord } from '../streams';
import type { Connector, ConnectorContext } from '../types';
import type { GmailConfig } from './manifest';

const API = 'https://gmail.googleapis.com/gmail/v1/users/me';
const OVERLAP_SECONDS = 60 * 60;
const MAX_MESSAGES = 500; // per sync; an inbox flood waits for the next one
const BODY_LIMIT = 8000; // characters of body text the agent sees
const PARALLEL = 8;

type Ctx = ConnectorContext<GmailConfig>;
type Cursor = { after: number }; // epoch seconds

type Part = {
	mimeType?: string;
	body?: { data?: string };
	parts?: Part[];
};

type GmailMessage = {
	id: string;
	threadId: string;
	labelIds?: string[];
	snippet?: string;
	internalDate: string; // epoch ms
	payload: Part & { headers?: { name: string; value: string }[] };
};

const decode = (data: string) => Buffer.from(data, 'base64url').toString('utf8');

/** First part of the given type, depth-first (multipart/alternative puts plain text first). */
function findPart(part: Part, mimeType: string): Part | undefined {
	if (part.mimeType === mimeType && part.body?.data) return part;
	for (const child of part.parts ?? []) {
		const found = findPart(child, mimeType);
		if (found) return found;
	}
	return undefined;
}

/** Readable text from HTML: drop style/script, tags and common entities; collapse whitespace. */
export function htmlToText(html: string): string {
	return html
		.replace(/<(style|script)[\s\S]*?<\/\1>/gi, ' ')
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<\/(p|div|li|tr|h\d)>/gi, '\n\n')
		.replace(/<[^>]+>/g, ' ')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/[ \t]+/g, ' ')
		.replace(/ *\n */g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

export function toMessageRecord(m: GmailMessage, account: string): MessageRecord {
	const header = (name: string) =>
		m.payload.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';
	const plain = findPart(m.payload, 'text/plain');
	const html = findPart(m.payload, 'text/html');
	const body = plain?.body?.data
		? decode(plain.body.data).trim()
		: html?.body?.data
			? htmlToText(decode(html.body.data))
			: (m.snippet ?? '');

	return {
		external_id: m.id,
		thread_id: m.threadId,
		account,
		from: header('From'),
		to: header('To'),
		subject: header('Subject') || '(no subject)',
		received_at: new Date(Number(m.internalDate)).toISOString(),
		labels: m.labelIds ?? [],
		snippet: m.snippet ?? '',
		body: body.length > BODY_LIMIT ? `${body.slice(0, BODY_LIMIT)}\n[…trimmed]` : body,
		url: `https://mail.google.com/mail/u/${encodeURIComponent(account)}/#all/${m.id}`
	};
}

export function inboxQuery(after: number, config: GmailConfig): string {
	const skip = config.skip_promotions ? ' -category:promotions -category:social' : '';
	return `in:inbox after:${after}${skip}`;
}

async function account(ctx: Ctx): Promise<string> {
	return (await getJson<{ emailAddress: string }>(ctx, `${API}/profile`)).emailAddress;
}

async function listIds(ctx: Ctx, q: string): Promise<string[]> {
	const ids: string[] = [];
	let pageToken: string | undefined;
	do {
		const params = new URLSearchParams({ q, maxResults: '100', ...(pageToken && { pageToken }) });
		const page = await getJson<{ messages?: { id: string }[]; nextPageToken?: string }>(
			ctx,
			`${API}/messages?${params}`
		);
		ids.push(...(page.messages ?? []).map((m) => m.id));
		pageToken = page.nextPageToken;
	} while (pageToken && ids.length < MAX_MESSAGES);
	return ids.slice(0, MAX_MESSAGES);
}

export const gmailConnector: Connector<GmailConfig> = {
	describe: account,

	async pull(ctx) {
		const nowSeconds = Math.floor(ctx.now.getTime() / 1000);
		const cursor = ctx.cursor as Cursor | null;
		if (!cursor) return { messages: [], cursor: { after: nowSeconds } }; // first sync: start now

		const email = await account(ctx);
		const ids = await listIds(ctx, inboxQuery(cursor.after - OVERLAP_SECONDS, ctx.config));
		const messages: MessageRecord[] = [];
		for (let i = 0; i < ids.length; i += PARALLEL) {
			const chunk = await Promise.all(
				ids
					.slice(i, i + PARALLEL)
					.map((id) => getJson<GmailMessage>(ctx, `${API}/messages/${id}?format=full`))
			);
			messages.push(...chunk.map((m) => toMessageRecord(m, email)));
		}
		return { messages, cursor: { after: nowSeconds } satisfies Cursor };
	}
};
