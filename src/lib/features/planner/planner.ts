// The day planner: a pure function from (tasks, busy time, now, settings) to a
// timeline. No I/O and no knowledge of where tasks or events come from, so it
// runs on the server and in the browser and is tested in isolation.
//
// Goal: finish the day's tasks with as few context switches as possible,
// inside human attention limits.
//
//   1. Batch by context. Tasks sharing a `context` (a project, say) run
//      back-to-back, so switches happen between batches, not between tasks.
//      Each switch costs a short buffer.
//   2. Respect attention spans. Focus sessions are capped (default 90 min, one
//      ultradian cycle) and followed by a break. Longer tasks are split into
//      balanced parts; a long gap (lunch, a meeting) also counts as a break.
//   3. Energy-aware order. Urgent batches first (due today or high priority),
//      then deep work (long tasks) while fresh, then shallow and low-priority
//      batches later in the day.
//   4. Fill gaps sensibly. When the next task won't fit before lunch or a
//      meeting, prefer a same-context task that fits, then splitting the
//      current task, and only then a task from another context.
//   5. Don't overcommit. Total focused work is capped per day; the rest is
//      returned as overflow instead of being crammed in.
//   6. The user's placements win. A pinned task sits exactly at its time,
//      whole, and counts toward the cap; everything else plans around it.
//
// All times are minutes since local midnight, in steps of 5.

import type { PlannerSettings } from './schema';

export type Priority = 'low' | 'normal' | 'high';

export type PlanTask = {
	id: string;
	minutes: number | null; // the estimate; null → settings.default_estimate_minutes
	context: string; // grouping key: tasks sharing it are batched together
	priority: Priority;
	due: boolean; // due on or before the planned day
	order: number; // the user's own order, the final tie-break
	pinned: number | null; // a start time the user chose; placed exactly there, never moved or split
};

/** Time that's already taken (calendar events). */
export type Busy = { id: string; title: string; start: number; end: number };

export type PlanInput = {
	tasks: PlanTask[];
	busy: Busy[];
	now: number | null; // plan from here (today); null = the whole day
	settings: PlannerSettings;
};

export type PlanBlock =
	| {
			kind: 'task';
			start: number;
			end: number;
			task_id: string;
			context: string;
			estimated: boolean; // true when the default estimate was assumed
			pinned: boolean; // placed by the user, not the planner
			part: number; // 1-based; parts > 1 when the task was split
			parts: number;
	  }
	| { kind: 'break' | 'switch'; start: number; end: number }
	| { kind: 'reserved'; start: number; end: number; label: string }
	| { kind: 'busy'; start: number; end: number; id: string; title: string };

export type DayPlan = {
	blocks: PlanBlock[]; // sorted by start
	overflow: { task_id: string; minutes: number }[]; // what didn't fit today
	planned_minutes: number;
	switches: number; // context changes between consecutive tasks
};

export const STEP = 5;
const MIN_CHUNK = 15; // never schedule a slice of work shorter than this
const MIN_START = 30; // don't start a task you'll have to stop sooner than this (re-entry cost)
const DEEP_MINUTES = 45; // a task this long needs sustained focus

type Unit = { task: PlanTask; minutes: number; estimated: boolean };

export function planDay({ tasks, busy, now, settings: s }: PlanInput): DayPlan {
	const reserved = s.lunch_minutes
		? [{ start: s.lunch_start, end: s.lunch_start + s.lunch_minutes, label: 'Lunch' }]
		: [];
	// Pinned tasks are the user's decisions: placed exactly where they were put
	// (even in the past or over an event), then planned around like fixed time.
	const pinned = tasks
		.filter((t) => t.pinned !== null)
		.map((t) => {
			const minutes = t.minutes ?? s.default_estimate_minutes;
			return {
				kind: 'task' as const,
				start: t.pinned!,
				end: Math.min(24 * 60, t.pinned! + minutes),
				task_id: t.id,
				context: t.context,
				estimated: t.minutes === null,
				pinned: true,
				part: 1,
				parts: 1
			};
		});

	const blocks: PlanBlock[] = [
		...busy.map((b) => ({ kind: 'busy' as const, ...b })),
		...reserved.map((r) => ({ kind: 'reserved' as const, ...r })),
		...pinned
	];

	const queue = orderUnits(
		tasks.filter((t) => t.pinned === null),
		s
	);
	let capacity = s.daily_capacity_minutes - pinned.reduce((sum, b) => sum + b.end - b.start, 0);
	let session = 0; // focused minutes since the last break
	let last: string | null = null; // context of the previous task in this session
	let prevEnd: number | null = null;

	for (const w of freeWindows([...busy, ...reserved, ...pinned], now, s)) {
		// A long enough gap (lunch, a meeting) is itself a break.
		if (prevEnd !== null && w.start - prevEnd >= Math.max(s.break_minutes, MIN_CHUNK)) {
			session = 0;
			last = null;
		}
		let t = w.start;

		while (queue.length > 0 && capacity > 0) {
			const pick = pickUnit(queue, w.end - t, s.max_focus_minutes - session, last, capacity, s);

			if (pick) {
				const { index, minutes, switchCost } = pick;
				const unit = queue[index];
				if (switchCost) {
					blocks.push({ kind: 'switch', start: t, end: t + switchCost });
					t += switchCost;
				}
				blocks.push({
					kind: 'task',
					start: t,
					end: t + minutes,
					task_id: unit.task.id,
					context: unit.task.context,
					estimated: unit.estimated,
					pinned: false,
					part: 0,
					parts: 0
				});
				t += minutes;
				session += minutes + switchCost;
				capacity -= minutes;
				last = unit.task.context;
				if (minutes < unit.minutes)
					unit.minutes -= minutes; // split: the rest stays queued
				else queue.splice(index, 1);
				continue;
			}

			// Nothing fits what's left of this focus session: rest, then carry on.
			if (session > 0 && w.end - t >= s.break_minutes + MIN_CHUNK) {
				if (s.break_minutes > 0) {
					blocks.push({ kind: 'break', start: t, end: t + s.break_minutes });
					t += s.break_minutes;
				}
				session = 0;
				last = null;
				continue;
			}
			break; // this window is used up
		}
		prevEnd = t;
	}

	blocks.sort((a, b) => a.start - b.start);
	numberParts(blocks, queue);
	const taskBlocks = blocks.filter((b) => b.kind === 'task');

	return {
		blocks,
		overflow: summarize(queue),
		planned_minutes: taskBlocks.reduce((sum, b) => sum + b.end - b.start, 0),
		switches: taskBlocks.filter((b, i) => i > 0 && b.context !== taskBlocks[i - 1].context).length
	};
}

// --- Ordering ------------------------------------------------------------------

const PRIORITY_RANK: Record<Priority, number> = { high: 2, normal: 1, low: 0 };

/** Batches in priority order, each task split into focus-sized parts. */
function orderUnits(tasks: PlanTask[], s: PlannerSettings): Unit[] {
	const minutesOf = (t: PlanTask) => t.minutes ?? s.default_estimate_minutes;

	const groups = new Map<string, PlanTask[]>();
	for (const task of tasks) groups.set(task.context, [...(groups.get(task.context) ?? []), task]);

	// Within a batch: due first, then priority, then longest (hardest while
	// fresh), then the user's own order.
	const within = (a: PlanTask, b: PlanTask) =>
		Number(b.due) - Number(a.due) ||
		PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority] ||
		minutesOf(b) - minutesOf(a) ||
		a.order - b.order;

	const batches = [...groups.values()].map((list) => {
		const sorted = list.sort(within);
		return {
			tasks: sorted,
			due: sorted.some((t) => t.due),
			high: sorted.some((t) => t.priority === 'high'),
			allLow: sorted.every((t) => t.priority === 'low'),
			deep: sorted.some((t) => minutesOf(t) >= DEEP_MINUTES),
			total: sorted.reduce((sum, t) => sum + minutesOf(t), 0),
			first: Math.min(...sorted.map((t) => t.order))
		};
	});

	batches.sort(
		(a, b) =>
			Number(b.due) - Number(a.due) ||
			Number(b.high) - Number(a.high) ||
			Number(a.allLow) - Number(b.allLow) ||
			Number(b.deep) - Number(a.deep) ||
			b.total - a.total ||
			a.first - b.first
	);

	return batches.flatMap((batch) =>
		batch.tasks.flatMap((task) =>
			splitEvenly(minutesOf(task), s.max_focus_minutes).map((minutes) => ({
				task,
				minutes,
				estimated: task.minutes === null
			}))
		)
	);
}

/** 150 with a 90 cap → [75, 75]; 95 → [50, 45]. Pieces are multiples of STEP except the last. */
function splitEvenly(total: number, cap: number): number[] {
	const n = Math.ceil(total / cap);
	const piece = Math.ceil(total / n / STEP) * STEP;
	return Array.from({ length: n }, (_, i) => (i < n - 1 ? piece : total - piece * (n - 1)));
}

// --- Placement -----------------------------------------------------------------

/**
 * What to work on next, given the time left before the next fixed block
 * (`windowRoom`) and in the current focus session (`focusRoom`). Null means
 * nothing sensible fits: the caller takes a break or moves to the next window.
 */
function pickUnit(
	queue: Unit[],
	windowRoom: number,
	focusRoom: number,
	last: string | null,
	capacity: number,
	s: PlannerSettings
): { index: number; minutes: number; switchCost: number } | null {
	const room = Math.min(windowRoom, focusRoom);
	const cost = (u: Unit) => (last !== null && u.task.context !== last ? s.switch_minutes : 0);
	const fits = (u: Unit) => u.minutes + cost(u) <= room && u.minutes <= capacity;
	const head = queue[0];

	// 1. The next unit in batch order.
	if (fits(head)) return { index: 0, minutes: head.minutes, switchCost: cost(head) };

	// 2. A unit from the current batch that fits. Once the previous batch is
	//    finished (or at the start of a session), "current" is the next batch.
	const context = queue.some((u) => u.task.context === last) ? last : head.task.context;
	const same = queue.findIndex((u) => u.task.context === context && fits(u));
	if (same !== -1)
		return { index: same, minutes: queue[same].minutes, switchCost: cost(queue[same]) };

	// 3. Start the next unit now and finish it after the fixed block, if both
	//    parts are worth doing. Only for a hard limit: a tired session gets a
	//    break instead (null), not a sliver of work.
	if (windowRoom <= focusRoom || capacity < head.minutes) {
		const available = Math.floor(Math.min(room - cost(head), capacity) / STEP) * STEP;
		const slice = Math.min(available, head.minutes - MIN_CHUNK);
		if (slice >= MIN_START) return { index: 0, minutes: slice, switchCost: cost(head) };
	}

	// 4. Before a fixed block, any unit that fits, even from another context:
	//    shallow work suits short gaps. A session that's merely tired gets a
	//    break instead, so a batch isn't interrupted and resumed.
	if (windowRoom <= focusRoom) {
		const any = queue.findIndex(fits);
		if (any !== -1)
			return { index: any, minutes: queue[any].minutes, switchCost: cost(queue[any]) };
	}

	return null;
}

/** Free time between day start (or now) and day end, minus taken time. */
function freeWindows(
	taken: { start: number; end: number }[],
	now: number | null,
	s: PlannerSettings
): { start: number; end: number }[] {
	const from = Math.max(s.day_start, now === null ? 0 : Math.ceil(now / STEP) * STEP);
	const windows: { start: number; end: number }[] = [];
	let cursor = from;
	for (const block of [...taken].sort((a, b) => a.start - b.start)) {
		if (block.start > cursor)
			windows.push({ start: cursor, end: Math.min(block.start, s.day_end) });
		cursor = Math.max(cursor, block.end);
	}
	windows.push({ start: cursor, end: s.day_end });
	return windows.filter((w) => w.end - w.start >= MIN_CHUNK);
}

// --- Output ----------------------------------------------------------------------

/** Label split tasks "part 1 of 3"; parts still in overflow count toward the total. */
function numberParts(blocks: PlanBlock[], leftover: Unit[]) {
	const counts = new Map<string, number>();
	for (const b of blocks)
		if (b.kind === 'task') counts.set(b.task_id, (counts.get(b.task_id) ?? 0) + 1);
	for (const u of leftover)
		if (counts.has(u.task.id)) counts.set(u.task.id, counts.get(u.task.id)! + 1);

	const seen = new Map<string, number>();
	for (const b of blocks) {
		if (b.kind !== 'task') continue;
		b.part = (seen.get(b.task_id) ?? 0) + 1;
		b.parts = counts.get(b.task_id)!;
		seen.set(b.task_id, b.part);
	}
}

function summarize(leftover: Unit[]): DayPlan['overflow'] {
	const byTask = new Map<string, number>();
	for (const u of leftover) byTask.set(u.task.id, (byTask.get(u.task.id) ?? 0) + u.minutes);
	return [...byTask].map(([task_id, minutes]) => ({ task_id, minutes }));
}
