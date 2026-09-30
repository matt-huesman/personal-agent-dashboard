// Google Calendar → event stream. Read-only scopes; each pull fetches the
// sync window for every selected calendar (a snapshot, see streams.ts).

import { startOf } from '$lib/dates';
import type { Option } from '$lib/components/fields/fields';
import { getJson, syncWindow } from '../http.server';
import type { EventRecord } from '../streams';
import type { Connector, ConnectorContext } from '../types';
import type { GoogleCalendarConfig } from './manifest';

const API = 'https://www.googleapis.com/calendar/v3';

type Ctx = ConnectorContext<GoogleCalendarConfig>;

type CalendarListEntry = {
	id: string;
	summary: string;
	summaryOverride?: string;
	backgroundColor?: string;
	primary?: boolean;
};

type GoogleEvent = {
	id: string;
	status?: 'confirmed' | 'tentative' | 'cancelled';
	summary?: string;
	htmlLink?: string;
	transparency?: 'opaque' | 'transparent';
	start: { dateTime?: string; date?: string };
	end: { dateTime?: string; date?: string };
	attendees?: { self?: boolean; responseStatus?: string }[];
};

type Page<T> = { items?: T[]; nextPageToken?: string };

async function allPages<T>(ctx: Ctx, url: string, params: Record<string, string>): Promise<T[]> {
	const items: T[] = [];
	let pageToken: string | undefined;
	do {
		const query = new URLSearchParams({ ...params, ...(pageToken && { pageToken }) });
		const page = await getJson<Page<T>>(ctx, `${url}?${query}`);
		items.push(...(page.items ?? []));
		pageToken = page.nextPageToken;
	} while (pageToken);
	return items;
}

/** The account's calendars. The primary one is addressed as "primary" (the config default). */
async function calendars(ctx: Ctx): Promise<(CalendarListEntry & { key: string })[]> {
	const list = await allPages<CalendarListEntry>(ctx, `${API}/users/me/calendarList`, {
		minAccessRole: 'reader'
	});
	return list
		.map((c) => ({ ...c, key: c.primary ? 'primary' : c.id }))
		.sort((a, b) => Number(!!b.primary) - Number(!!a.primary));
}

/** An all-day date ("2026-10-01") is local midnight; timed events carry their own offset. */
const instant = (t: GoogleEvent['start']) =>
	t.dateTime ? new Date(t.dateTime).toISOString() : startOf(t.date!);

export function toEventRecord(
	e: GoogleEvent,
	calendarKey: string,
	calendarName: string
): EventRecord | null {
	const declined = e.attendees?.some((a) => a.self && a.responseStatus === 'declined');
	if (e.status === 'cancelled' || declined) return null;
	return {
		external_id: `${calendarKey}/${e.id}`,
		calendar_id: calendarKey,
		calendar_name: calendarName,
		title: e.summary ?? '(No title)',
		start: instant(e.start),
		end: instant(e.end),
		all_day: !e.start.dateTime,
		busy: e.transparency !== 'transparent', // "Show as: Free" doesn't block time
		url: e.htmlLink ?? null
	};
}

export const googleCalendarConnector: Connector<GoogleCalendarConfig> = {
	async describe(ctx) {
		// The calendar *list* entry: covered by calendarlist.readonly. (Calendars.get
		// on /calendars/primary needs a broader scope than this integration asks for.)
		const primary = await getJson<{ id: string }>(ctx, `${API}/users/me/calendarList/primary`);
		return primary.id; // the account's email address
	},

	async options(ctx, source): Promise<Option[]> {
		if (source !== 'calendars') return [];
		return (await calendars(ctx)).map((c) => ({
			value: c.key,
			label: c.summaryOverride ?? c.summary,
			color: c.backgroundColor
		}));
	},

	async pull(ctx) {
		const { from, to } = syncWindow(ctx.now);
		const names = new Map(
			(await calendars(ctx)).map((c) => [c.key, c.summaryOverride ?? c.summary])
		);
		const events: EventRecord[] = [];

		for (const key of ctx.config.calendar_ids) {
			// A calendar removed from the account since it was selected is skipped.
			if (!names.has(key)) continue;
			const items = await allPages<GoogleEvent>(
				ctx,
				`${API}/calendars/${encodeURIComponent(key)}/events`,
				{
					singleEvents: 'true',
					orderBy: 'startTime',
					timeMin: from.toISOString(),
					timeMax: to.toISOString(),
					maxResults: '2500'
				}
			);
			for (const item of items) {
				const record = toEventRecord(item, key, names.get(key)!);
				if (record) events.push(record);
			}
		}
		return { events };
	}
};
