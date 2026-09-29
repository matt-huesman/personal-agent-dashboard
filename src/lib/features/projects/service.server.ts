// Every project write goes through here. Deleting a project leaves its tasks
// in place, unassigned (the foreign key is ON DELETE SET NULL).

import { error } from '@sveltejs/kit';
import { and, asc, count, eq, getTableColumns, isNull, ne } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { actionItems } from '$lib/features/action-items/table.server';
import { projects } from './table.server';
import type {
	CreateProjectInput,
	ProjectRecord,
	ProjectSummary,
	UpdateProjectInput
} from './schema';

const now = () => new Date().toISOString();
const newId = () => `pr_${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`;

/** All projects, alphabetically, with how many open tasks each has. */
export async function listProjects(): Promise<ProjectSummary[]> {
	return db
		.select({ ...getTableColumns(projects), open_count: count(actionItems.id) })
		.from(projects)
		.leftJoin(
			actionItems,
			and(
				eq(actionItems.project_id, projects.id),
				isNull(actionItems.deleted_at),
				ne(actionItems.status, 'done')
			)
		)
		.groupBy(projects.id)
		.orderBy(asc(projects.name));
}

export async function create(input: CreateProjectInput): Promise<ProjectRecord> {
	const timestamp = now();
	const [project] = await db
		.insert(projects)
		.values({ ...input, id: newId(), created_at: timestamp, updated_at: timestamp })
		.returning();
	return project;
}

export async function update(id: string, input: UpdateProjectInput): Promise<ProjectRecord> {
	const [project] = await db
		.update(projects)
		.set({ ...input, updated_at: now() })
		.where(eq(projects.id, id))
		.returning();
	if (!project) error(404, `No project ${id}`);
	return project;
}

export async function remove(id: string): Promise<void> {
	const deleted = await db.delete(projects).where(eq(projects.id, id)).returning();
	if (deleted.length === 0) error(404, `No project ${id}`);
}
