import { describe, expect, it } from 'vitest';
import type { InboxBatch, InboxMessage } from '$lib/features/email/batch';
import { envelope, type Envelope } from '$lib/ingest/envelope';
import { buildEnvelope, envelopeDraft, envelopeFileName, itemId } from './draft.server';
import { countByAccount, mergeBatches, pendingBatchFiles } from './inbox.server';

const now = new Date('2026-09-24T13:00:00.000Z');
const run = {
	window: { since: '2026-09-24T01:00:00.000Z', until: '2026-09-24T12:40:00.000Z' },
	input_batches: ['ib_1', 'ib_2']
};

// Source ids are "<account>/<message id>" once several accounts are linked.
const draft = envelopeDraft.parse({
	action_items: [
		{
			source_message_id: 'me@gmail.com/a',
			title: 'Sign lease',
			description: null,
			due_date: '2026-09-26',
			priority: 'high'
		},
		{
			source_message_id: 'me@gmail.com/a',
			title: 'Pay deposit',
			description: null,
			due_date: null
		},
		{
			source_message_id: 'me@work.com/a', // same Gmail id, different account
			title: 'Reply to advisor',
			description: 'Pick a slot.',
			due_date: null
		}
	],
	fyi: [{ source_message_id: 'me@gmail.com/c', summary: 'Power maintenance Saturday.' }]
});

const message = (account: string, id: string, received_at: string): InboxMessage => ({
	id: `${account}/${id}`,
	account,
	thread_id: id,
	from: 'someone@example.com',
	to: account,
	subject: id,
	received_at,
	labels: ['INBOX'],
	snippet: '',
	body: '',
	url: `https://mail.google.com/mail/u/${account}/#all/${id}`
});
const batch = (batch_id: string, messages: InboxMessage[]): InboxBatch => ({
	batch_id,
	created_at: now.toISOString(),
	messages
});

describe('producer', () => {
	it('builds an envelope that satisfies the ingest contract and records its batches', () => {
		const built = buildEnvelope(draft, run, now);

		// The dashboard will parse exactly this; it must pass unchanged.
		expect(envelope.parse(built)).toEqual(built);
		expect(built.input_batches).toEqual(['ib_1', 'ib_2']);
		expect(built.window).toEqual(run.window);
		expect(built.action_items.every((i) => i.status === 'pool' && i.scheduled_date === null)).toBe(
			true
		);
		expect(built.action_items[0].source_run_id).toBe(built.run_id);
	});

	it('derives stable ids that stay distinct across accounts', () => {
		const ids = buildEnvelope(draft, run, now).action_items.map((i) => i.id);
		expect(ids).toEqual([
			itemId('me@gmail.com/a', 0),
			itemId('me@gmail.com/a', 1),
			itemId('me@work.com/a', 0)
		]);
		expect(new Set(ids).size).toBe(3);
		expect(buildEnvelope(draft, run, new Date()).action_items.map((i) => i.id)).toEqual(ids);
	});

	it('names envelope files chronologically', () => {
		expect(envelopeFileName(now.toISOString())).toBe('email-digest-20260924T130000Z.json');
	});
});

describe('inbox batches', () => {
	const file = (name: string) => ({ id: name, name });

	it('treats a batch as pending until a published envelope lists it', () => {
		const files = [
			file('inbox-20260924T100000Z-ib_1.json'),
			file('inbox-20260924T120000Z-ib_2.json'),
			file('inbox-20260924T123000Z-ib_3.json'),
			file('notes.json')
		];
		const published = [{ input_batches: ['ib_1'] }, { input_batches: [] }] as unknown as Envelope[];
		expect(pendingBatchFiles(files, published).map((f) => f.name)).toEqual([
			'inbox-20260924T120000Z-ib_2.json',
			'inbox-20260924T123000Z-ib_3.json'
		]);
	});

	it('merges batches into one inbox across accounts: oldest first, each message once', () => {
		const merged = mergeBatches([
			batch('ib_1', [
				message('me@gmail.com', 'b', '2026-09-24T09:00:00.000Z'),
				message('me@work.com', 'a', '2026-09-24T08:00:00.000Z')
			]),
			batch('ib_2', [
				message('me@gmail.com', 'b', '2026-09-24T09:00:00.000Z'), // re-sent (sync overlap)
				message('me@gmail.com', 'c', '2026-09-24T11:00:00.000Z')
			])
		])!;
		expect(merged.messages.map((m) => m.id)).toEqual([
			'me@work.com/a',
			'me@gmail.com/b',
			'me@gmail.com/c'
		]);
		expect(merged.run).toEqual({
			window: { since: '2026-09-24T08:00:00.000Z', until: '2026-09-24T11:00:00.000Z' },
			input_batches: ['ib_1', 'ib_2']
		});
		expect(countByAccount(merged.messages)).toEqual({ 'me@work.com': 1, 'me@gmail.com': 2 });
	});

	it('has nothing to do when there is no pending mail', () => {
		expect(mergeBatches([])).toBeNull();
	});
});
