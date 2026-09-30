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

/**
 * Busy, timed events on `day`, clipped to it, in minutes. All-day events and
 * events marked "free" are shown on the calendar but don't block time.
 */
export function busyOn(day: string, events: CalendarEvent[]): Busy[] {
	return events
		.filter((e) => !e.all_day && e.busy)
		.map((e) => ({
			id: e.id,
			title: e.title,
			start: Math.max(0, minutesInto(day, new Date(e.start))),
			end: Math.min(24 * 60, minutesInto(day, new Date(e.end)))
		}))
		.filter((b) => b.end > b.start);
}

export type TimedEvent = {
	event: CalendarEvent;
	start: number; // minutes into the day, clipped to it
	end: number;
	lane: number; // side-by-side position among overlapping events
	lanes: number; // how many lanes its overlap group needs
};

/** Timed events on `day` (busy or free), laid out so overlapping ones sit side by side. */
export function timedOn(day: string, events: CalendarEvent[]): TimedEvent[] {
	const timed = events
		.filter((e) => !e.all_day)
		.map((event) => ({
			event,
			start: Math.max(0, minutesInto(day, new Date(event.start))),
			end: Math.min(24 * 60, minutesInto(day, new Date(event.end))),
			lane: 0,
			lanes: 1
		}))
		.filter((t) => t.end > t.start)
		.sort((a, b) => a.start - b.start || b.end - a.end);

	// Walk overlap groups; within each, take the first lane that's free.
	let group: TimedEvent[] = [];
	let groupEnd = -1;
	const laneEnds: number[] = [];
	const closeGroup = () => {
		for (const t of group) t.lanes = laneEnds.length;
		group = [];
		laneEnds.length = 0;
	};
	for (const t of timed) {
		if (t.start >= groupEnd) closeGroup();
		const free = laneEnds.findIndex((end) => end <= t.start);
		t.lane = free === -1 ? laneEnds.length : free;
		laneEnds[t.lane] = t.end;
		group.push(t);
		groupEnd = Math.max(groupEnd, t.end);
	}
	closeGroup();
	return timed;
}

/** All-day events covering `day` (their end date is exclusive, as in iCal and Google). */
export function allDayOn(day: string, events: CalendarEvent[]): CalendarEvent[] {
	const dayStart = new Date(`${day}T00:00:00`).getTime();
	return events.filter(
		(e) => e.all_day && Date.parse(e.start) <= dayStart && Date.parse(e.end) > dayStart
	);
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
