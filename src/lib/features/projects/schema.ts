// Project: a user-defined theme that tasks belong to ("Honors thesis",
// "TEL work", "Social"). App-owned: never ingested, so no wire contract.

import { z } from 'zod';
import { isoDateTime } from '$lib/schema-primitives';

// A fixed palette keeps the board calm and every colour distinguishable.
// Keys are stored; the swatch values live in colors.ts.
export const PROJECT_COLORS = [
	'slate',
	'red',
	'orange',
	'amber',
	'lime',
	'emerald',
	'teal',
	'sky',
	'indigo',
	'violet',
	'pink'
] as const;
export const projectColor = z.enum(PROJECT_COLORS);

const content = {
	name: z.string().trim().min(1).max(60),
	color: projectColor
};

export const projectRecord = z.object({
	id: z.string(),
	...content,
	created_at: isoDateTime,
	updated_at: isoDateTime
});

export const createProjectInput = z.object(content);
export const updateProjectInput = z.object(content).partial();

export type ProjectColor = z.infer<typeof projectColor>;
export type ProjectRecord = z.infer<typeof projectRecord>;
export type CreateProjectInput = z.infer<typeof createProjectInput>;
export type UpdateProjectInput = z.infer<typeof updateProjectInput>;

/** A project as the UI lists it: the record plus its open-task count. */
export type ProjectSummary = ProjectRecord & { open_count: number };
