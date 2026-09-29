// Action item: the single definition every layer derives from.
//
//   actionItem        wire contract — what the upstream producer sends (ingest boundary)
//   actionItemRecord  persisted row — contract + app-owned fields; the Drizzle table must match it
//   *Input            request bodies — the HTTP boundary
//
// Shared by client and server; must not import anything server-only.

import { z } from 'zod';
import { isoDate, isoDateTime, link } from '$lib/schema-primitives';

// Enum values as tuples so the Drizzle columns get the same literal union.
export const PRIORITIES = ['low', 'normal', 'high'] as const;
export const priority = z.enum(PRIORITIES);

// Lifecycle status. The invariant between status and scheduled_date is enforced
// by a CHECK constraint (table.server.ts); legal transitions live in transitions.ts.
//   pool      -> unassigned (scheduled_date null)
//   scheduled -> assigned to a day (scheduled_date set)
//   done      -> completed (scheduled_date kept as it was)
export const ACTION_ITEM_STATUSES = ['pool', 'scheduled', 'done'] as const;
export const actionItemStatus = z.enum(ACTION_ITEM_STATUSES);

// User-editable content, without defaults. Zod applies defaults even inside
// .partial(), so edit inputs must be built from these, not from actionItem.
const content = {
	title: z.string().min(1),
	description: z.string().nullable(),
	due_date: isoDate.nullable(), // intrinsic deadline from the email ("reply by Fri")
	priority,
	links: z.array(link),
	estimate_minutes: z
		.number()
		.int()
		.min(1)
		.max(24 * 60)
		.nullable() // how long the user expects it to take
};

// --- Wire contract -----------------------------------------------------------
// Items arrive via ingest (source_message_id set) or are created in the UI (null).
export const actionItem = z.object({
	id: z.string(), // stable idempotent upsert key, e.g. "ai_7b3d9f2a"
	source_message_id: z.string().nullable(), // originating email, or null if user-created
	source_run_id: z.string().nullable(), // which ingest run introduced it (provenance)
	...content,
	priority: content.priority.default('normal'),
	links: content.links.default([]),
	estimate_minutes: content.estimate_minutes.default(null),
	status: actionItemStatus.default('pool'),
	scheduled_date: isoDate.nullable(), // the day the USER assigned it to (distinct from due_date)
	created_at: isoDateTime // when the item first entered the system
});

// --- Persisted record --------------------------------------------------------
export const actionItemRecord = actionItem.extend({
	project_id: z.string().nullable(), // the user's theme for this task (features/projects)
	sticky: z.boolean(), // repeats weekly on its day's weekday; see transitions.ts
	position: z.number().int(), // order within its container (the pool, or one day)
	completed_at: isoDateTime.nullable(),
	updated_at: isoDateTime,
	deleted_at: isoDateTime.nullable() // soft delete: keeps the id so ingest can't resurrect it
});

// --- HTTP inputs -------------------------------------------------------------
export const createActionItemInput = z.object({
	title: content.title,
	description: content.description.default(null),
	due_date: content.due_date.default(null),
	priority: content.priority.default('normal'),
	links: content.links.default([]),
	estimate_minutes: content.estimate_minutes.default(null),
	project_id: z.string().nullable().default(null),
	sticky: z.boolean().default(false),
	scheduled_date: isoDate.nullable().default(null) // create straight onto a day
});

export const updateActionItemInput = z
	.object({ ...content, project_id: z.string().nullable(), sticky: z.boolean() })
	.partial();

export const moveActionItemInput = z.object({
	scheduled_date: isoDate.nullable(), // null = the pool
	index: z.number().int().min(0) // position among the target container's open items
});

// --- Types -------------------------------------------------------------------
export type Priority = z.infer<typeof priority>;
export type ActionItemStatus = z.infer<typeof actionItemStatus>;
export type ActionItem = z.infer<typeof actionItem>;
export type ActionItemRecord = z.infer<typeof actionItemRecord>;
export type CreateActionItemInput = z.infer<typeof createActionItemInput>;
export type UpdateActionItemInput = z.infer<typeof updateActionItemInput>;
export type MoveActionItemInput = z.infer<typeof moveActionItemInput>;
