import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { useTestDb } from '../../test/db';
import * as service from '$lib/features/action-items/service.server';
import { ingest } from './run.server';
import type { EnvelopeSource } from './source';

useTestDb();

const fixture = JSON.parse(await readFile('data/incoming/run-2026-09-24-0800.json', 'utf8')) as {
	run_id: string;
	action_items: { id: string }[];
};

/** An in-memory EnvelopeSource — the same seam the Drive adapter will plug into. */
function memorySource(files: Record<string, unknown>): EnvelopeSource {
	return {
		list: async () => Object.keys(files),
		read: async (ref) => files[ref]
	};
}

const board = () => service.listBoard('2026-09-24');

describe('ingest', () => {
	it('validates and inserts envelope items into the pool, in envelope order', async () => {
		const report = await ingest(memorySource({ 'run.json': fixture }));

		expect(report.ingested).toEqual([
			{ ref: 'run.json', run_id: fixture.run_id, items: 3, inserted: 3 }
		]);
		const items = await board();
		expect(items.map((i) => i.id)).toEqual(fixture.action_items.map((i) => i.id));
		expect(items.every((i) => i.status === 'pool' && i.source_message_id)).toBe(true);
	});

	it('is idempotent: a re-read file is skipped', async () => {
		const source = memorySource({ 'run.json': fixture });
		await ingest(source);
		const second = await ingest(source);

		expect(second).toEqual({ ingested: [], skipped: ['run.json'], failed: [] });
		expect(await board()).toHaveLength(3);
	});

	it('never overwrites user changes or resurrects deleted items', async () => {
		await ingest(memorySource({ 'run.json': fixture }));
		const [first, second] = fixture.action_items;
		await service.update(first.id, { title: 'my title' });
		await service.move(first.id, { scheduled_date: '2026-09-25', index: 0 });
		await service.remove(second.id);

		// A later run re-sends the same items.
		const later = { ...fixture, run_id: 'later-run' };
		const report = await ingest(memorySource({ 'run.json': fixture, 'later.json': later }));

		expect(report.ingested).toEqual([
			{ ref: 'later.json', run_id: 'later-run', items: 3, inserted: 0 }
		]);
		const items = await board();
		expect(items.find((i) => i.id === first.id)).toMatchObject({
			title: 'my title',
			scheduled_date: '2026-09-25'
		});
		expect(items.find((i) => i.id === second.id)).toBeUndefined();
	});

	it('reports invalid envelopes without blocking valid ones', async () => {
		const report = await ingest(
			memorySource({ 'bad.json': { ...fixture, schema_version: '2.0' }, 'good.json': fixture })
		);

		expect(report.failed).toHaveLength(1);
		expect(report.failed[0].ref).toBe('bad.json');
		expect(report.ingested.map((r) => r.ref)).toEqual(['good.json']);
	});
});
