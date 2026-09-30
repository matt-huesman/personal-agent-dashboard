// What the calendar view and planner consume: events for a range of days.
// Events arrive through integrations (src/lib/integrations) and are stored in
// calendar_events; calendar.server.ts reads them. Every timed, busy event is
// time the planner schedules around.

import type { StoredEventRecord } from './schema';

export type CalendarEvent = Pick<
	StoredEventRecord,
	'title' | 'start' | 'end' | 'all_day' | 'busy' | 'read_only' | 'calendar_name' | 'url'
> & { id: string; source: string /* integration name, e.g. "Google Calendar" */ };

export interface CalendarSource {
	/** Events overlapping the local days `from`..`to` (inclusive, "YYYY-MM-DD"). */
	events(from: string, to: string): Promise<CalendarEvent[]>;
}
