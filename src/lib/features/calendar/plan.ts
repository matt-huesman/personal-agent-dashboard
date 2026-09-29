// Glue between the app's data and the standalone planner: which tasks belong
// to a day, how they're grouped into contexts, and which events are busy time.
// Shared by server and client (the browser re-plans as time passes).

import { minutesInto } from '$lib/dates';
import type { ActionItemRecord } from '$lib/features/action-items/schema';
import { planDay, type Busy, type DayPlan, type PlanTask } from '$lib/features/planner/planner';
import type { PlannerSettings } from '$lib/features/planner/schema';
import type { CalendarEvent } from './source';

/** Contexts for tasks without a project. */
export const EMAIL_CONTEXT = 'email';
export const OTHER_CONTEXT = 'other';

/**
 * The batching key. A project is the strongest signal of shared mental
 * context; without one, email follow-ups (replies, forms, admin) batch well
 * together, and everything else forms one group.
 */
export function contextOf(item: ActionItemRecord): string {
	return item.project_id ?? (item.source_message_id ? EMAIL_CONTEXT : OTHER_CONTEXT);
}

/** Timed events on `day`, clipped to it, as busy minutes. */
export function busyOn(day: string, events: CalendarEvent[]): Busy[] {
	return events
		.filter((e) => !e.all_day)
		.map((e) => ({
			id: e.id,
			title: e.title,
			start: Math.max(0, minutesInto(day, new Date(e.start))),
			end: Math.min(24 * 60, minutesInto(day, new Date(e.end)))
		}))
		.filter((b) => b.end > b.start);
}

/** The plan for one day, or null for days already past. */
export function planFor(
	day: string,
	{
		today,
		now,
		items,
		events,
		settings
	}: {
		today: string;
		now: Date;
		items: ActionItemRecord[];
		events: CalendarEvent[];
		settings: PlannerSettings;
	}
): DayPlan | null {
	if (day < today) return null;
	const tasks: PlanTask[] = items
		.filter((i) => i.status !== 'done' && i.scheduled_date === day)
		.map((i) => ({
			id: i.id,
			minutes: i.estimate_minutes,
			context: contextOf(i),
			priority: i.priority,
			due: i.due_date !== null && i.due_date <= day,
			order: i.position
		}));
	return planDay({
		tasks,
		busy: busyOn(day, events),
		now: day === today ? minutesInto(day, now) : null,
		settings
	});
}
