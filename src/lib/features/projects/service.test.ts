import { describe, expect, it } from 'vitest';
import { useTestDb } from '../../../test/db';
import { createActionItemInput } from '$lib/features/action-items/schema';
import * as items from '$lib/features/action-items/service.server';
import * as projects from './service.server';

useTestDb();

const TODAY = '2026-09-24';

describe('projects', () => {
	it('lists projects alphabetically with their open-task counts', async () => {
		const thesis = await projects.create({ name: 'Thesis', color: 'indigo' });
		await projects.create({ name: 'Admin', color: 'slate' });
		await items.create(createActionItemInput.parse({ title: 'Outline', project_id: thesis.id }));
		const done = await items.create(
			createActionItemInput.parse({ title: 'Pick topic', project_id: thesis.id })
		);
		await items.complete(done.id);

		const list = await projects.listProjects();
		expect(list.map((p) => [p.name, p.open_count])).toEqual([
			['Admin', 0],
			['Thesis', 1]
		]);
	});

	it('tags tasks with a project and estimate, and deleting the project unassigns them', async () => {
		const social = await projects.create({ name: 'Social', color: 'pink' });
		const task = await items.create(createActionItemInput.parse({ title: 'RSVP' }));

		const edited = await items.update(task.id, { project_id: social.id, estimate_minutes: 15 });
		expect(edited).toMatchObject({ project_id: social.id, estimate_minutes: 15 });

		await projects.remove(social.id);
		const [after] = await items.listBoard(TODAY);
		expect(after).toMatchObject({ id: task.id, project_id: null, estimate_minutes: 15 });
	});
});
