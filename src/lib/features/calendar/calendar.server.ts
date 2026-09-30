import { and, asc, eq, gt, lt } from 'drizzle-orm';
import { addDays, startOf } from '$lib/dates';
import { db } from '$lib/server/db';
import { manifestOf } from '$lib/integrations/registry';
import { connections } from '$lib/integrations/table.server';
import type { CalendarSource } from './source';
import { calendarEvents } from './table.server';

/** Events synced from every connected calendar integration. */
export const calendarSource: CalendarSource = {
	async events(from, to) {
		const rows = await db
			.select({ event: calendarEvents, integration_id: connections.integration_id })
			.from(calendarEvents)
			.innerJoin(connections, eq(connections.id, calendarEvents.connection_id))
			.where(
				and(
					lt(calendarEvents.start, startOf(addDays(to, 1))),
					gt(calendarEvents.end, startOf(from))
				)
			)
			.orderBy(asc(calendarEvents.start));

		return rows.map(({ event: e, integration_id }) => ({
			id: `${e.connection_id}/${e.external_id}`,
			title: e.title,
			start: e.start,
			end: e.end,
			all_day: e.all_day,
			busy: e.busy,
			read_only: e.read_only,
			calendar_name: e.calendar_name,
			url: e.url,
			source: manifestOf(integration_id)?.name ?? integration_id
		}));
	}
};
