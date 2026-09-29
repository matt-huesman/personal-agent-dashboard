// Where calendar events come from. The planner treats every event as busy
// time and schedules tasks around it.
//
// ┌─ CALENDAR INTEGRATION SWAP POINT ────────────────────────────────────────┐
// │ Today: noCalendar, so every day is open.                                 │
// │ Later: e.g. a Google Calendar source (Calendar API, events.list with     │
// │ timeMin/timeMax, singleEvents=true) implements events() and replaces     │
// │ noCalendar in calendar.server.ts. Several sources can be merged. The     │
// │ planner and the UI already render busy blocks.                           │
// └───────────────────────────────────────────────────────────────────────────┘

import { z } from 'zod';
import { isoDateTime } from '$lib/schema-primitives';

export const calendarEvent = z.object({
	id: z.string(),
	title: z.string(),
	start: isoDateTime,
	end: isoDateTime,
	all_day: z.boolean().default(false) // all-day events are shown but don't block time
});

export type CalendarEvent = z.infer<typeof calendarEvent>;

export interface CalendarSource {
	/** Events overlapping the local days `from`..`to` (inclusive, "YYYY-MM-DD"). */
	events(from: string, to: string): Promise<CalendarEvent[]>;
}

export const noCalendar: CalendarSource = { events: async () => [] };
