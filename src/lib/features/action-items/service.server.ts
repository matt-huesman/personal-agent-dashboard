// Every action-item write goes through here. Commands check legality against
// transitions.ts; the status/date invariant itself is a CHECK constraint.
//
// Ordering: `position` orders open items within a container (the pool, or one
// day). Writers either renumber a container 0..n-1 or insert above its current
// minimum, so positions may be negative or gapped — only their order matters.

import { error } from '@sveltejs/kit';
import { and, asc, eq, gte, inArray, isNotNull, isNull, lt, min, ne, or } from 'drizzle-orm';
import { db, type Tx } from '$lib/server/db';
import { startOf, today as localToday } from '$lib/dates';
import { actionItems } from './table.server';
import { can, completed, moved, reopened, type Command } from './transitions';
import type {
	ActionItem,
	ActionItemRecord,
	CreateActionItemInput,
	MoveActionItemInput,
	UpdateActionItemInput
} from './schema';

const live = isNull(actionItems.deleted_at);
const open = ne(actionItems.status, 'done');

const now = () => new Date().toISOString();
const newId = () => `ai_${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`;

// --- Reads -------------------------------------------------------------------

/**
 * What the board shows: every open item, plus done items whose day hasn't
 * passed (or, in the pool, that were completed today). Overdue items are
 * rolled forward first.
 */
export async function listBoard(today = localToday()): Promise<ActionItemRecord[]> {
	await rollOver(today);
	return db
		.select()
		.from(actionItems)
		.where(
			and(
				live,
				or(
					open,
					gte(actionItems.scheduled_date, today),
					and(isNull(actionItems.scheduled_date), gte(actionItems.completed_at, startOf(today)))
				)
			)
		)
		.orderBy(asc(actionItems.position));
}

// --- Commands ----------------------------------------------------------------

/** Unfinished items on a past day flow into today, ahead of today's own items. */
export async function rollOver(today = localToday()): Promise<number> {
	return db.transaction(async (tx) => {
		const overdue = await tx
			.select({ id: actionItems.id })
			.from(actionItems)
			.where(and(live, eq(actionItems.status, 'scheduled'), lt(actionItems.scheduled_date, today)))
			.orderBy(asc(actionItems.scheduled_date), asc(actionItems.position));
		if (overdue.length === 0) return 0;

		const todays = await openIn(tx, today);
		const ids = overdue.map((r) => r.id);
		await tx
			.update(actionItems)
			.set({ scheduled_date: today, updated_at: now() })
			.where(inArray(actionItems.id, ids));
		await renumber(tx, [...ids, ...todays]);
		return ids.length;
	});
}

export async function create(input: CreateActionItemInput): Promise<ActionItemRecord> {
	return db.transaction(async (tx) => {
		const timestamp = now();
		const [item] = await tx
			.insert(actionItems)
			.values({
				...input,
				...moved(input.scheduled_date),
				id: newId(),
				source_message_id: null,
				source_run_id: null,
				position: await topOf(tx, input.scheduled_date),
				created_at: timestamp,
				updated_at: timestamp,
				deleted_at: null
			})
			.returning();
		return item;
	});
}

/**
 * Insert freshly ingested items at the top of the pool, in envelope order.
 * Ids that already exist (including soft-deleted ones) are left untouched:
 * once an item is in, the user owns it.
 */
export async function insertIngested(tx: Tx, items: ActionItem[]): Promise<number> {
	if (items.length === 0) return 0;
	const top = await topOf(tx, null);
	const timestamp = now();
	const inserted = await tx
		.insert(actionItems)
		.values(
			items.map((item, i) => ({
				...item,
				...moved(null), // placement is the user's decision, never the producer's
				position: top - items.length + 1 + i,
				updated_at: timestamp,
				deleted_at: null
			}))
		)
		.onConflictDoNothing({ target: actionItems.id })
		.returning({ id: actionItems.id });
	return inserted.length;
}

/** Content edits only; placement changes go through move/complete/reopen. */
export async function update(id: string, input: UpdateActionItemInput): Promise<ActionItemRecord> {
	return db.transaction((tx) => write(tx, id, input));
}

/** Schedule, unschedule, reschedule or reorder: place the item at `index` in a container. */
export async function move(
	id: string,
	{ scheduled_date, index }: MoveActionItemInput
): Promise<ActionItemRecord> {
	return db.transaction(async (tx) => {
		assertCan('move', await find(tx, id));
		const order = (await openIn(tx, scheduled_date)).filter((other) => other !== id);
		order.splice(index, 0, id); // an index past the end appends
		await renumber(tx, order);
		return write(tx, id, moved(scheduled_date));
	});
}

export async function complete(id: string): Promise<ActionItemRecord> {
	return db.transaction(async (tx) => {
		const item = await find(tx, id);
		assertCan('complete', item);
		return write(tx, id, completed(item, now()));
	});
}

/** Back to its day if it had one, else the pool — at the top either way. */
export async function reopen(id: string): Promise<ActionItemRecord> {
	return db.transaction(async (tx) => {
		const item = await find(tx, id);
		assertCan('reopen', item);
		return write(tx, id, { ...reopened(item), position: await topOf(tx, item.scheduled_date) });
	});
}

export async function remove(id: string): Promise<void> {
	await db.transaction((tx) => write(tx, id, { deleted_at: now() }));
}

/** Undo a delete. */
export async function restore(id: string): Promise<ActionItemRecord> {
	const [item] = await db
		.update(actionItems)
		.set({ deleted_at: null, updated_at: now() })
		.where(and(eq(actionItems.id, id), isNotNull(actionItems.deleted_at)))
		.returning();
	if (!item) error(404, `No deleted action item ${id}`);
	return item;
}

// --- Helpers -----------------------------------------------------------------

/** The pool (null) or one day. */
function container(scheduled_date: string | null) {
	return scheduled_date === null
		? isNull(actionItems.scheduled_date)
		: eq(actionItems.scheduled_date, scheduled_date);
}

/** Ids of a container's open items, in order. */
async function openIn(tx: Tx, scheduled_date: string | null): Promise<string[]> {
	const rows = await tx
		.select({ id: actionItems.id })
		.from(actionItems)
		.where(and(live, open, container(scheduled_date)))
		.orderBy(asc(actionItems.position));
	return rows.map((r) => r.id);
}

/** A position above everything currently open in the container. */
async function topOf(tx: Tx, scheduled_date: string | null): Promise<number> {
	const [{ top }] = await tx
		.select({ top: min(actionItems.position) })
		.from(actionItems)
		.where(and(live, open, container(scheduled_date)));
	return (top ?? 0) - 1;
}

async function renumber(tx: Tx, ids: string[]): Promise<void> {
	await Promise.all(
		ids.map((id, position) =>
			tx.update(actionItems).set({ position }).where(eq(actionItems.id, id))
		)
	);
}

/** Load a live item for a command. Ids come from the URL, so absence is a 404. */
async function find(tx: Tx, id: string): Promise<ActionItemRecord> {
	const [item] = await tx
		.select()
		.from(actionItems)
		.where(and(eq(actionItems.id, id), live))
		.for('update');
	if (!item) error(404, `No action item ${id}`);
	return item;
}

async function write(
	tx: Tx,
	id: string,
	fields: Partial<ActionItemRecord>
): Promise<ActionItemRecord> {
	const [item] = await tx
		.update(actionItems)
		.set({ ...fields, updated_at: now() })
		.where(and(eq(actionItems.id, id), live))
		.returning();
	if (!item) error(404, `No action item ${id}`);
	return item;
}

function assertCan(command: Command, item: ActionItemRecord): void {
	if (!can(command, item.status)) error(409, `Cannot ${command} an item that is ${item.status}`);
}
