import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { useTestDb } from '../../../test/db';
import { actionItems } from './table.server';
import { createActionItemInput } from './schema';
import * as service from './service.server';

useTestDb();

const TODAY = '2026-09-24';
const TOMORROW = '2026-09-25';

/** Titles of a container's open items, in board order. */
async function titlesIn(scheduled_date: string | null) {
	const items = await service.listBoard(TODAY);
	return items
		.filter((i) => i.status !== 'done' && i.scheduled_date === scheduled_date)
		.map((i) => i.title);
}

describe('action-item service', () => {
	it('creates into the pool or onto a day, newest on top', async () => {
		// Minimal bodies, filled in by the input schema exactly as the API does.
		await service.create(createActionItemInput.parse({ title: 'a' }));
		const b = await service.create(createActionItemInput.parse({ title: 'b' }));
		const c = await service.create(
			createActionItemInput.parse({ title: 'c', scheduled_date: TOMORROW })
		);

		expect(b.status).toBe('pool');
		expect(c).toMatchObject({ status: 'scheduled', scheduled_date: TOMORROW });
		expect(await titlesIn(null)).toEqual(['b', 'a']);
	});

	it('moves between containers and reorders within one', async () => {
		const a = await service.create(input('a'));
		const b = await service.create(input('b', TOMORROW));
		const c = await service.create(input('c', TOMORROW)); // tomorrow: c, b

		const movedA = await service.move(a.id, { scheduled_date: TOMORROW, index: 1 });
		expect(movedA.status).toBe('scheduled');
		expect(await titlesIn(TOMORROW)).toEqual(['c', 'a', 'b']);

		await service.move(b.id, { scheduled_date: TOMORROW, index: 0 });
		expect(await titlesIn(TOMORROW)).toEqual(['b', 'c', 'a']);

		const back = await service.move(c.id, { scheduled_date: null, index: 99 });
		expect(back).toMatchObject({ status: 'pool', scheduled_date: null });
		expect(await titlesIn(TOMORROW)).toEqual(['b', 'a']);
	});

	it('completes and reopens back to the same day, and rejects illegal commands', async () => {
		const item = await service.create(input('a', TOMORROW));

		const done = await service.complete(item.id);
		expect(done).toMatchObject({ status: 'done', scheduled_date: TOMORROW });
		expect(done.completed_at).not.toBeNull();

		await expect(service.complete(item.id)).rejects.toMatchObject({ status: 409 });
		await expect(service.move(item.id, { scheduled_date: null, index: 0 })).rejects.toMatchObject({
			status: 409
		});

		const reopened = await service.reopen(item.id);
		expect(reopened).toMatchObject({
			status: 'scheduled',
			scheduled_date: TOMORROW,
			completed_at: null
		});
	});

	it('edits content without touching placement', async () => {
		const item = await service.create(input('a', TOMORROW));
		const edited = await service.update(item.id, { title: 'renamed', priority: 'high' });
		expect(edited).toMatchObject({
			title: 'renamed',
			priority: 'high',
			status: 'scheduled',
			scheduled_date: TOMORROW,
			description: null
		});
	});

	it('rolls unfinished past items into today, ahead of today’s items', async () => {
		await service.create(input('today', TODAY));
		await service.create(input('old', '2026-09-20'));
		await service.create(input('older', '2026-09-19'));
		const finished = await service.create(input('finished', '2026-09-20'));
		await service.complete(finished.id);

		expect(await titlesIn(TODAY)).toEqual(['older', 'old', 'today']);

		const [stillDone] = await db.select().from(actionItems).where(eq(actionItems.id, finished.id));
		expect(stillDone.scheduled_date).toBe('2026-09-20'); // done items stay where they were
	});

	it('soft-deletes, hides from the board, and restores', async () => {
		const item = await service.create(input('a'));
		await service.remove(item.id);

		expect(await titlesIn(null)).toEqual([]);
		await expect(service.complete(item.id)).rejects.toMatchObject({ status: 404 });

		await service.restore(item.id);
		expect(await titlesIn(null)).toEqual(['a']);
	});
});

function input(title: string, scheduled_date: string | null = null) {
	return createActionItemInput.parse({ title, scheduled_date });
}
