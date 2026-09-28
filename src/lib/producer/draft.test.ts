import { describe, expect, it } from 'vitest';
import { envelope } from '$lib/ingest/envelope';
import {
	buildEnvelope,
	envelopeDraft,
	envelopeFileName,
	gmailQuery,
	itemId,
	nextWindow
} from './draft.server';

const now = new Date('2026-09-24T13:00:00.000Z');
const window = { since: '2026-09-24T01:00:00.000Z', until: now.toISOString() };

const draft = envelopeDraft.parse({
	action_items: [
		{
			source_message_id: 'msg_a',
			title: 'Sign lease',
			description: null,
			due_date: '2026-09-26',
			priority: 'high'
		},
		{ source_message_id: 'msg_a', title: 'Pay deposit', description: null, due_date: null },
		{
			source_message_id: 'msg_b',
			title: 'Reply to advisor',
			description: 'Pick a slot.',
			due_date: null
		}
	],
	fyi: [{ source_message_id: 'msg_c', summary: 'Power maintenance Saturday.' }]
});

describe('producer', () => {
	it('builds an envelope that satisfies the ingest contract', () => {
		const built = buildEnvelope(draft, window, now);

		// The dashboard will parse exactly this; it must pass unchanged.
		expect(envelope.parse(built)).toEqual(built);
		expect(built.action_items.every((i) => i.status === 'pool' && i.scheduled_date === null)).toBe(
			true
		);
		expect(built.action_items[0].source_run_id).toBe(built.run_id);
	});

	it('derives stable, distinct ids per email and position', () => {
		const ids = buildEnvelope(draft, window, now).action_items.map((i) => i.id);

		expect(ids).toEqual([itemId('msg_a', 0), itemId('msg_a', 1), itemId('msg_b', 0)]);
		expect(new Set(ids).size).toBe(3);
		expect(buildEnvelope(draft, window, new Date()).action_items.map((i) => i.id)).toEqual(ids);
	});

	it('starts each window where the previous envelope ended', () => {
		const previous = buildEnvelope(draft, window, now);
		const later = new Date('2026-09-25T01:00:00.000Z');

		expect(nextWindow(previous, later)).toEqual({
			since: window.until,
			until: later.toISOString()
		});
		expect(nextWindow(null, later).since).toBe('2026-09-24T01:00:00.000Z'); // first run: 24h back
	});

	it('names files chronologically and queries Gmail by epoch seconds', () => {
		expect(envelopeFileName(window)).toBe('email-digest-20260924T130000Z.json');
		expect(gmailQuery(window)).toBe('in:inbox after:1790211600 before:1790254800');
	});
});
