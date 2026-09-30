// iCal feed → event stream. The generic fallback for any calendar that can
// publish a link. Recurring events are expanded within the sync window;
// edited or cancelled occurrences (RECURRENCE-ID) replace their originals.

import ICAL from 'ical.js';
import { syncWindow } from '../http.server';
import type { EventRecord } from '../streams';
import type { Connector, ConnectorContext } from '../types';
import type { IcsConfig } from './manifest';

type Ctx = ConnectorContext<IcsConfig>;

/** webcal:// is https:// by another name. */
export function feedUrl(raw: string): string {
	return raw.trim().replace(/^webcal:\/\//i, 'https://');
}

function urlOf(ctx: Ctx): string {
	if (ctx.credentials.kind !== 'url') throw new Error('An iCal connection needs a feed URL');
	return feedUrl(ctx.credentials.url);
}

async function fetchCalendar(ctx: Ctx): Promise<ICAL.Component> {
	const res = await ctx.fetch(urlOf(ctx));
	if (!res.ok) throw new Error(`The feed returned ${res.status}`);
	const text = await res.text();
	if (!text.trimStart().startsWith('BEGIN:VCALENDAR')) {
		throw new Error("That link didn't return an iCal calendar");
	}
	return new ICAL.Component(ICAL.parse(text));
}

export function parseEvents(root: ICAL.Component, from: Date, to: Date): EventRecord[] {
	for (const tz of root.getAllSubcomponents('vtimezone')) ICAL.TimezoneService.register(tz);

	const name = (root.getFirstPropertyValue('x-wr-calname') as string | null) ?? 'Calendar feed';
	const vevents = root.getAllSubcomponents('vevent');
	const exceptions = vevents.filter((v) => v.hasProperty('recurrence-id'));
	const events: EventRecord[] = [];

	const toRecord = (item: ICAL.Event, start: ICAL.Time, end: ICAL.Time, id: string) => {
		if (item.component.getFirstPropertyValue('status') === 'CANCELLED') return;
		events.push({
			external_id: id,
			calendar_id: 'feed',
			calendar_name: name,
			title: item.summary || '(No title)',
			start: start.toJSDate().toISOString(),
			end: end.toJSDate().toISOString(),
			all_day: start.isDate,
			busy: item.component.getFirstPropertyValue('transp') !== 'TRANSPARENT',
			url: (item.component.getFirstPropertyValue('url') as string | null) ?? null
		});
	};

	for (const vevent of vevents) {
		if (vevent.hasProperty('recurrence-id')) continue; // handled via its master
		const event = new ICAL.Event(vevent);

		if (!event.isRecurring()) {
			const end = event.endDate ?? event.startDate;
			if (end.toJSDate() >= from && event.startDate.toJSDate() <= to) {
				toRecord(event, event.startDate, end, event.uid);
			}
			continue;
		}

		for (const ex of exceptions) {
			if (ex.getFirstPropertyValue('uid') === event.uid) event.relateException(ex);
		}
		const occurrences = event.iterator();
		for (let i = 0, next = occurrences.next(); next && i < 5000; i++, next = occurrences.next()) {
			if (next.toJSDate() > to) break;
			const details = event.getOccurrenceDetails(next);
			if (details.endDate.toJSDate() < from) continue;
			toRecord(details.item, details.startDate, details.endDate, `${event.uid}/${next.toString()}`);
		}
	}
	return events;
}

export const icsConnector: Connector<IcsConfig> = {
	async describe(ctx) {
		const root = await fetchCalendar(ctx);
		return (
			(root.getFirstPropertyValue('x-wr-calname') as string | null) ?? new URL(urlOf(ctx)).host
		);
	},

	async pull(ctx) {
		const { from, to } = syncWindow(ctx.now);
		return { events: parseEvents(await fetchCalendar(ctx), from, to) };
	}
};
