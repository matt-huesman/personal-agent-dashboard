// Planner settings: the knobs the scheduling algorithm reads. Stored as one
// row (see table.server.ts); missing keys fall back to these defaults, so new
// settings can be added without a data migration.

import { z } from 'zod';

/** Minutes since local midnight (540 = 9:00). */
const minuteOfDay = z
	.number()
	.int()
	.min(0)
	.max(24 * 60);
const minutes = (min: number, max: number) => z.number().int().min(min).max(max);

export const plannerSettings = z
	.object({
		day_start: minuteOfDay.default(9 * 60),
		day_end: minuteOfDay.default(18 * 60),
		lunch_start: minuteOfDay.default(12 * 60),
		lunch_minutes: minutes(0, 180).default(45), // 0 = no lunch block
		max_focus_minutes: minutes(15, 240).default(90), // one focus session, then a break
		break_minutes: minutes(0, 60).default(15),
		switch_minutes: minutes(0, 30).default(5), // buffer when changing context
		daily_capacity_minutes: minutes(30, 16 * 60).default(6 * 60), // focused work per day
		default_estimate_minutes: minutes(5, 240).default(30) // for tasks without an estimate
	})
	.refine((s) => s.day_end > s.day_start, {
		message: 'The day must end after it starts',
		path: ['day_end']
	});

export type PlannerSettings = z.infer<typeof plannerSettings>;

export const DEFAULT_PLANNER_SETTINGS: PlannerSettings = plannerSettings.parse({});
