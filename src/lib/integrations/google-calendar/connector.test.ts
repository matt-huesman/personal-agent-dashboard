import { describe, expect, it } from 'vitest';
import type { ConnectorContext, Credentials } from '../types';
import { googleCalendarConnector, toEventRecord } from './connector.server';
import { googleCalendar, type GoogleCalendarConfig } from './manifest';

const SCOPE = 'https://www.googleapis.com/auth/';

/**
 * The scope Google requires for each endpoint (per the Calendar API docs).
 * The fake grants exactly what the manifest requests, so a connector calling
 * an endpoint outside those scopes fails here, as it would for real.
 */
function requiredScope(path: string): string {
	if (path.startsWith('/calendar/v3/users/me/calendarList'))
		return `${SCOPE}calendar.calendarlist.readonly`;
	if (/^\/calendar\/v3\/calendars\/[^/]+\/events/.test(path))
		return `${SCOPE}calendar.events.readonly`;
	return `${SCOPE}calendar.readonly`; // e.g. Calendars.get — not requested by this integration
}

/** A fake Google: responses keyed by path, with the query recorded. */
function fakeGoogle(routes: Record<string, unknown[]>) {
	const calls: string[] = [];
	const granted = new Set(googleCalendar.auth.kind === 'oauth2' ? googleCalendar.auth.scopes : []);
	const fetch = async (url: string) => {
		const u = new URL(url);
		calls.push(`${u.pathname}${u.search}`);
		if (!granted.has(requiredScope(decodeURIComponent(u.pathname)))) {
			return Response.json(
				{ error: { code: 403, message: 'Request had insufficient authentication scopes.' } },
				{ status: 403 }
			);
		}
		const pages = routes[decodeURIComponent(u.pathname)];
		if (!pages) return new Response('not found', { status: 404 });
		const page = Number(u.searchParams.get('pageToken') ?? 0);
		const body = {
			...(pages[page] as object),
			...(page + 1 < pages.length && { nextPageToken: String(page + 1) })
		};
		return Response.json(body);
	};
	return { fetch, calls };
}

const ctx = (config: GoogleCalendarConfig, fetch: ConnectorContext<unknown>['fetch']) =>
	({
		config,
		fetch,
		now: new Date('2026-09-29T12:00:00Z'),
		credentials: {} as Credentials,
		cursor: null
	}) satisfies ConnectorContext<GoogleCalendarConfig>;

const calendarList = [
	{
		items: [
			{
				id: 'me@example.com',
				summary: 'me@example.com',
				primary: true,
				backgroundColor: '#9fe1e7'
			},
			{ id: 'team@group', summary: 'Team', summaryOverride: 'TEL team', backgroundColor: '#f83a22' }
		]
	}
];

describe('Google Calendar connector', () => {
	it('maps events: timed, all-day, free; skips cancelled and declined', () => {
		const timed = toEventRecord(
			{
				id: 'a',
				summary: 'Sync',
				htmlLink: 'https://calendar.google.com/a',
				start: { dateTime: '2026-09-29T10:00:00-05:00' },
				end: { dateTime: '2026-09-29T10:30:00-05:00' }
			},
			'primary',
			'Me'
		);
		expect(timed).toEqual({
			external_id: 'primary/a',
			calendar_id: 'primary',
			calendar_name: 'Me',
			title: 'Sync',
			start: '2026-09-29T15:00:00.000Z',
			end: '2026-09-29T15:30:00.000Z',
			all_day: false,
			busy: true,
			url: 'https://calendar.google.com/a'
		});

		const allDay = toEventRecord(
			{ id: 'b', start: { date: '2026-10-01' }, end: { date: '2026-10-02' } },
			'primary',
			'Me'
		);
		expect(allDay).toMatchObject({ all_day: true, title: '(No title)' });
		expect(allDay!.start).toBe(new Date('2026-10-01T00:00:00').toISOString()); // local midnight

		const free = toEventRecord(
			{
				id: 'c',
				transparency: 'transparent',
				start: { dateTime: '2026-09-29T20:00:00Z' },
				end: { dateTime: '2026-09-29T21:00:00Z' }
			},
			'primary',
			'Me'
		);
		expect(free?.busy).toBe(false);

		expect(
			toEventRecord({ id: 'd', status: 'cancelled', start: {}, end: {} }, 'p', 'Me')
		).toBeNull();
		expect(
			toEventRecord(
				{
					id: 'e',
					attendees: [{ self: true, responseStatus: 'declined' }],
					start: { dateTime: '2026-09-29T20:00:00Z' },
					end: { dateTime: '2026-09-29T21:00:00Z' }
				},
				'p',
				'Me'
			)
		).toBeNull();
	});

	it("labels the account with its email, using only the integration's scopes", async () => {
		const { fetch } = fakeGoogle({
			'/calendar/v3/users/me/calendarList/primary': [{ id: 'me@example.com', primary: true }]
		});
		expect(await googleCalendarConnector.describe(ctx({ calendar_ids: [] }, fetch))).toBe(
			'me@example.com'
		);
	});

	it('offers the account calendars, primary first as "primary"', async () => {
		const { fetch } = fakeGoogle({ '/calendar/v3/users/me/calendarList': calendarList });
		const options = await googleCalendarConnector.options!(
			ctx({ calendar_ids: [] }, fetch),
			'calendars'
		);
		expect(options).toEqual([
			{ value: 'primary', label: 'me@example.com', color: '#9fe1e7' },
			{ value: 'team@group', label: 'TEL team', color: '#f83a22' }
		]);
	});

	it('pulls only selected calendars, across pages, within the window', async () => {
		const event = (id: string) => ({
			id,
			summary: id,
			start: { dateTime: '2026-09-30T15:00:00Z' },
			end: { dateTime: '2026-09-30T16:00:00Z' }
		});
		const { fetch, calls } = fakeGoogle({
			'/calendar/v3/users/me/calendarList': calendarList,
			'/calendar/v3/calendars/team@group/events': [
				{ items: [event('t1')] },
				{ items: [event('t2')] }
			],
			'/calendar/v3/calendars/primary/events': [{ items: [event('p1')] }]
		});

		const snapshot = (await googleCalendarConnector.pull(
			ctx({ calendar_ids: ['team@group', 'gone@group'] }, fetch)
		)) as { events: { external_id: string; calendar_name: string }[] };

		expect(snapshot.events.map((e) => e.external_id)).toEqual(['team@group/t1', 'team@group/t2']);
		expect(snapshot.events[0].calendar_name).toBe('TEL team');
		const eventsCall = calls.find((c) => c.includes('/events'))!;
		expect(eventsCall).toContain('singleEvents=true');
		expect(eventsCall).toContain('timeMin=2026-09-22');
		expect(calls.some((c) => c.includes('gone'))).toBe(false); // removed calendar skipped
	});
});
