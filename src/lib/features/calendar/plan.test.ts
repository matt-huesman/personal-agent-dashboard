import { describe, expect, it } from 'vitest';
import { createActionItemInput, type ActionItemRecord } from '$lib/features/action-items/schema';
import { DEFAULT_PLANNER_SETTINGS } from '$lib/features/planner/schema';
import { busyOn, contextOf, EMAIL_CONTEXT, OTHER_CONTEXT, planFor, timedOn } from './plan';

const DAY = '2026-09-29';

function item(overrides: Partial<ActionItemRecord>): ActionItemRecord {
	return {
		...createActionItemInput.parse({ title: 'x' }),
		id: overrides.id ?? 'i',
		source_message_id: null,
		source_run_id: null,
		status: 'scheduled',
		scheduled_date: DAY,
		position: 0,
		created_at: '',
		completed_at: null,
		updated_at: '',
		deleted_at: null,
		pinned_start: null,
		...overrides
	} as ActionItemRecord;
}

describe('calendar planning glue', () => {
	it('groups by project, then email follow-ups, then everything else', () => {
		expect(contextOf(item({ project_id: 'pr_1', source_message_id: 'm' }))).toBe('pr_1');
		expect(contextOf(item({ source_message_id: 'm' }))).toBe(EMAIL_CONTEXT);
		expect(contextOf(item({}))).toBe(OTHER_CONTEXT);
	});

	it("turns busy timed events into the day's busy minutes, clipped to the day", () => {
		const local = (time: string) => new Date(`${DAY}T${time}`).toISOString();
		const event = (id: string, start: string, end: string, extra = {}) => ({
			id,
			title: id,
			start,
			end,
			all_day: false,
			busy: true,
			read_only: true,
			calendar_name: 'Work',
			url: null,
			source: 'Google Calendar',
			...extra
		});
		const busy = busyOn(DAY, [
			event('a', local('09:30:00'), local('10:00:00')),
			event('b', local('00:00:00'), local('23:59:00'), { all_day: true }),
			event('c', local('23:00:00'), new Date(`2026-09-30T01:00:00`).toISOString()),
			event('free', local('13:00:00'), local('14:00:00'), { busy: false })
		]);
		expect(busy.map((b) => [b.id, b.start, b.end])).toEqual([
			['a', 570, 600],
			['c', 1380, 1440]
		]);
	});

	it('lays overlapping events side by side, and gives lone events the full width', () => {
		const local = (time: string) => new Date(`${DAY}T${time}:00`).toISOString();
		const ev = (id: string, from: string, to: string) => ({
			id,
			title: id,
			start: local(from),
			end: local(to),
			all_day: false,
			busy: true,
			read_only: true,
			calendar_name: 'Work',
			url: null,
			source: 'Google Calendar'
		});
		const laid = timedOn(DAY, [
			ev('a', '09:00', '10:00'),
			ev('b', '09:30', '10:30'),
			ev('c', '10:00', '11:00'), // reuses a's lane once a ends
			ev('solo', '14:00', '15:00')
		]);
		expect(laid.map((t) => [t.event.id, t.lane, t.lanes])).toEqual([
			['a', 0, 2],
			['b', 1, 2],
			['c', 0, 2],
			['solo', 0, 1]
		]);
	});

	it("plans only the day's open tasks, and nothing for past days", () => {
		const items = [
			item({ id: 'open', estimate_minutes: 30 }),
			item({ id: 'done', status: 'done', completed_at: 'x' }),
			item({ id: 'other-day', scheduled_date: '2026-09-30' })
		];
		const ctx = {
			today: DAY,
			now: new Date(`${DAY}T08:00:00`),
			items,
			events: [],
			settings: DEFAULT_PLANNER_SETTINGS
		};
		const plan = planFor(DAY, ctx)!;
		expect(plan.blocks.filter((b) => b.kind === 'task').map((b) => b.task_id)).toEqual(['open']);
		expect(planFor('2026-09-28', ctx)).toBeNull();
	});
});
