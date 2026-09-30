import { describe, expect, it } from 'vitest';
import { planDay, type PlanBlock, type PlanTask } from './planner';
import { DEFAULT_PLANNER_SETTINGS, type PlannerSettings } from './schema';

const H = 60;
// A plain 9–17 day with no lunch, to keep expectations readable.
const base: PlannerSettings = {
	...DEFAULT_PLANNER_SETTINGS,
	day_start: 9 * H,
	day_end: 17 * H,
	lunch_minutes: 0
};

let order = 0;
const task = (
	id: string,
	minutes: number | null,
	context = 'a',
	extra: Partial<PlanTask> = {}
): PlanTask => ({
	id,
	minutes,
	context,
	priority: 'normal',
	due: false,
	order: order++,
	pinned: null,
	...extra
});

const tasksOf = (blocks: PlanBlock[]) => blocks.filter((b) => b.kind === 'task');
const kinds = (blocks: PlanBlock[]) => blocks.map((b) => b.kind);
const at = (h: number, m = 0) => h * H + m;

describe('planDay', () => {
	it('batches tasks by context so each context runs back-to-back', () => {
		const plan = planDay({
			tasks: [task('a1', 20, 'A'), task('b1', 20, 'B'), task('a2', 20, 'A'), task('b2', 20, 'B')],
			busy: [],
			now: null,
			settings: base
		});
		expect(tasksOf(plan.blocks).map((b) => b.task_id)).toEqual(['a1', 'a2', 'b1', 'b2']);
		expect(plan.switches).toBe(1);
		// One switch buffer between the two batches.
		expect(kinds(plan.blocks)).toEqual(['task', 'task', 'switch', 'task', 'task']);
	});

	it('caps focus sessions and inserts breaks', () => {
		const plan = planDay({
			tasks: [task('x', 60), task('y', 60)],
			busy: [],
			now: null,
			settings: base // 90-minute sessions, 15-minute breaks
		});
		expect(kinds(plan.blocks)).toEqual(['task', 'break', 'task']);
		expect(plan.blocks[1]).toMatchObject({ start: at(10), end: at(10, 15) });
	});

	it('splits a task longer than one session into balanced parts', () => {
		const plan = planDay({ tasks: [task('essay', 150)], busy: [], now: null, settings: base });
		const parts = tasksOf(plan.blocks);
		expect(parts.map((b) => [b.end - b.start, b.part, b.parts])).toEqual([
			[75, 1, 2],
			[75, 2, 2]
		]);
		expect(kinds(plan.blocks)).toEqual(['task', 'break', 'task']);
	});

	it('plans around busy time and lunch, and treats them as breaks', () => {
		const plan = planDay({
			tasks: [task('x', 60), task('y', 60)],
			busy: [{ id: 'e1', title: 'Standup', start: at(9), end: at(9, 30) }],
			now: null,
			settings: { ...base, lunch_start: at(10, 30), lunch_minutes: 60 }
		});
		const [x, y] = tasksOf(plan.blocks);
		expect(x).toMatchObject({ start: at(9, 30), end: at(10, 30) });
		expect(y).toMatchObject({ start: at(11, 30), end: at(12, 30) }); // after lunch, no extra break
		expect(plan.blocks.some((b) => b.kind === 'break')).toBe(false);
	});

	it('starts from now (rounded up), never in the past', () => {
		const plan = planDay({ tasks: [task('x', 30)], busy: [], now: at(13, 2), settings: base });
		expect(tasksOf(plan.blocks)[0]).toMatchObject({ start: at(13, 5), end: at(13, 35) });
	});

	it('fills a gap before a meeting with a same-context task instead of splitting', () => {
		// 40 minutes before the meeting: "long" doesn't fit, "short" from the same batch does.
		const plan = planDay({
			tasks: [task('long', 60, 'A'), task('short', 30, 'A'), task('other', 30, 'B')],
			busy: [{ id: 'm', title: 'Meeting', start: at(9, 40), end: at(12) }],
			now: null,
			settings: base
		});
		const placed = tasksOf(plan.blocks);
		expect(placed[0]).toMatchObject({ task_id: 'short', start: at(9), end: at(9, 30) });
		expect(placed.map((b) => b.task_id)).toEqual(['short', 'long', 'other']);
		expect(placed[1]).toMatchObject({ start: at(12), parts: 1 }); // "long" kept whole
	});

	it('splits across a meeting rather than switching context when nothing else fits', () => {
		const plan = planDay({
			tasks: [task('long', 60, 'A'), task('other', 30, 'B')],
			busy: [{ id: 'm', title: 'Meeting', start: at(9, 40), end: at(12) }],
			now: null,
			settings: base
		});
		expect(tasksOf(plan.blocks).map((b) => [b.task_id, b.end - b.start, b.part])).toEqual([
			['long', 40, 1],
			['long', 20, 2],
			['other', 30, 1]
		]);
	});

	it('takes a break rather than slipping another context into a tired session', () => {
		// After A1 there are 30 focus minutes left: B would fit, but it would
		// interrupt batch A (A → B → A). A break keeps A together.
		const plan = planDay({
			tasks: [task('a1', 60, 'A'), task('a2', 60, 'A'), task('b', 15, 'B', { priority: 'low' })],
			busy: [],
			now: null,
			settings: base
		});
		expect(kinds(plan.blocks)).toEqual(['task', 'break', 'task', 'switch', 'task']);
		expect(tasksOf(plan.blocks).map((b) => b.task_id)).toEqual(['a1', 'a2', 'b']);
		expect(plan.switches).toBe(1);
	});

	it("leaves a short gap as slack rather than starting work it can't get into", () => {
		// 20 minutes before a meeting is too little to start a 60-minute task.
		const plan = planDay({
			tasks: [task('long', 60)],
			busy: [{ id: 'm', title: 'Meeting', start: at(9, 20), end: at(10) }],
			now: null,
			settings: base
		});
		expect(tasksOf(plan.blocks)).toEqual([
			expect.objectContaining({ task_id: 'long', start: at(10), end: at(11), parts: 1 })
		]);
	});

	it('orders urgent, then deep, then low-priority batches', () => {
		const plan = planDay({
			tasks: [
				task('chore', 15, 'Admin', { priority: 'low' }),
				task('deep', 60, 'Thesis'),
				task('quick', 15, 'Misc'),
				task('rent', 15, 'Home', { due: true })
			],
			busy: [],
			now: null,
			settings: base
		});
		const contexts = [...new Set(tasksOf(plan.blocks).map((b) => b.context))];
		expect(contexts).toEqual(['Home', 'Thesis', 'Misc', 'Admin']);
	});

	it('respects the daily capacity and reports the overflow', () => {
		const plan = planDay({
			tasks: [task('x', 60), task('y', 60), task('z', 60)],
			busy: [],
			now: null,
			settings: { ...base, daily_capacity_minutes: 90 }
		});
		expect(plan.planned_minutes).toBe(90);
		expect(plan.overflow).toEqual([
			{ task_id: 'y', minutes: 30 },
			{ task_id: 'z', minutes: 60 }
		]);
	});

	it('assumes the default estimate for unestimated tasks and flags them', () => {
		const plan = planDay({ tasks: [task('x', null)], busy: [], now: null, settings: base });
		expect(tasksOf(plan.blocks)[0]).toMatchObject({ end: at(9, 30), estimated: true });
	});

	describe('pinned tasks', () => {
		it('sit exactly where the user put them; everything else plans around them', () => {
			const plan = planDay({
				tasks: [task('gym', 60, 'Gym', { pinned: at(10) }), task('a', 60, 'A'), task('b', 30, 'A')],
				busy: [],
				now: null,
				settings: base
			});
			const placed = tasksOf(plan.blocks);
			expect(placed.find((b) => b.task_id === 'gym')).toMatchObject({
				start: at(10),
				end: at(11),
				pinned: true,
				parts: 1
			});
			// The pinned hour is fixed time: "a" fills 9–10 exactly, "b" follows the gym.
			expect(placed.map((b) => [b.task_id, b.start])).toEqual([
				['a', at(9)],
				['gym', at(10)],
				['b', at(11)]
			]);
		});

		it('are never split or moved, even over an event or before now', () => {
			const plan = planDay({
				tasks: [task('deep', 150, 'A', { pinned: at(9) })],
				busy: [{ id: 'm', title: 'Meeting', start: at(10), end: at(11) }],
				now: at(13),
				settings: base
			});
			expect(tasksOf(plan.blocks)).toEqual([
				expect.objectContaining({ task_id: 'deep', start: at(9), end: at(11, 30), parts: 1 })
			]);
		});

		it('count toward the daily focus limit', () => {
			const plan = planDay({
				tasks: [task('pin', 60, 'A', { pinned: at(9) }), task('x', 60, 'A')],
				busy: [],
				now: null,
				settings: { ...base, daily_capacity_minutes: 90 }
			});
			expect(plan.planned_minutes).toBe(90);
			expect(plan.overflow).toEqual([{ task_id: 'x', minutes: 30 }]);
		});
	});

	it('returns nothing to do when the day is already over', () => {
		const plan = planDay({ tasks: [task('x', 30)], busy: [], now: at(18), settings: base });
		expect(tasksOf(plan.blocks)).toEqual([]);
		expect(plan.overflow).toEqual([{ task_id: 'x', minutes: 30 }]);
	});
});
