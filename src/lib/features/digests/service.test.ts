import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { useTestDb } from '../../../test/db';
import { ingest } from '$lib/ingest/run.server';
import { listDigests } from './service.server';

useTestDb();

const fixture = JSON.parse(await readFile('src/test/fixtures/envelope.json', 'utf8'));

describe('digests', () => {
	it('presents each ingested run as a digest, newest first', async () => {
		const evening = {
			...fixture,
			run_id: 'evening-run',
			generated_at: '2026-09-24T22:00:00Z',
			fyi: [],
			action_items: []
		};
		await ingest({
			list: async () => ['morning.json', 'evening.json'],
			read: async (ref) => (ref === 'morning.json' ? fixture : evening)
		});

		const digests = await listDigests();
		expect(digests.map((d) => d.id)).toEqual(['evening-run', fixture.run_id]);
		expect(digests[1]).toMatchObject({
			fyi: fixture.fyi,
			suggested_replies: fixture.suggested_replies,
			spam_candidates: fixture.spam_candidates
		});
		expect(digests[1].action_items.map((i) => i.title)).toHaveLength(3);
	});
});
