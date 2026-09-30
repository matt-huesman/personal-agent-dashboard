import ICAL from 'ical.js';
import { describe, expect, it } from 'vitest';
import { feedUrl, parseEvents } from './connector.server';

// A realistic feed: a named calendar in Chicago time with a weekly standup
// (one occurrence moved, one cancelled), an all-day event, a "free" event,
// a cancelled event, and something outside the window.
const FEED = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//EN
X-WR-CALNAME:Work
BEGIN:VTIMEZONE
TZID:America/Chicago
BEGIN:DAYLIGHT
TZOFFSETFROM:-0600
TZOFFSETTO:-0500
TZNAME:CDT
DTSTART:19700308T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU
END:DAYLIGHT
BEGIN:STANDARD
TZOFFSETFROM:-0500
TZOFFSETTO:-0600
TZNAME:CST
DTSTART:19701101T020000
RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU
END:STANDARD
END:VTIMEZONE
BEGIN:VEVENT
UID:standup
SUMMARY:Standup
DTSTART;TZID=America/Chicago:20260928T093000
DTEND;TZID=America/Chicago:20260928T094500
RRULE:FREQ=WEEKLY;COUNT=4
EXDATE;TZID=America/Chicago:20261012T093000
END:VEVENT
BEGIN:VEVENT
UID:standup
RECURRENCE-ID;TZID=America/Chicago:20261005T093000
SUMMARY:Standup (moved)
DTSTART;TZID=America/Chicago:20261005T110000
DTEND;TZID=America/Chicago:20261005T111500
END:VEVENT
BEGIN:VEVENT
UID:offsite
SUMMARY:Offsite
DTSTART;VALUE=DATE:20260930
DTEND;VALUE=DATE:20261001
END:VEVENT
BEGIN:VEVENT
UID:focus
SUMMARY:Maybe gym
TRANSP:TRANSPARENT
DTSTART:20260929T220000Z
DTEND:20260929T230000Z
END:VEVENT
BEGIN:VEVENT
UID:cancelled
SUMMARY:Cancelled thing
STATUS:CANCELLED
DTSTART:20260929T150000Z
DTEND:20260929T160000Z
END:VEVENT
BEGIN:VEVENT
UID:ancient
SUMMARY:Long ago
DTSTART:20250101T150000Z
DTEND:20250101T160000Z
END:VEVENT
END:VCALENDAR`;

const parse = () =>
	parseEvents(
		new ICAL.Component(ICAL.parse(FEED)),
		new Date('2026-09-22T00:00:00Z'),
		new Date('2026-11-30T00:00:00Z')
	);

describe('iCal connector', () => {
	it('expands recurrences within the window, honouring moved and cancelled occurrences', () => {
		const standups = parse().filter((e) => e.title.startsWith('Standup'));
		expect(standups.map((e) => [e.title, e.start])).toEqual([
			['Standup', '2026-09-28T14:30:00.000Z'], // 9:30 CDT
			['Standup (moved)', '2026-10-05T16:00:00.000Z'], // moved to 11:00
			['Standup', '2026-10-19T14:30:00.000Z'] // Oct 12 cancelled via EXDATE
		]);
		expect(new Set(standups.map((e) => e.external_id)).size).toBe(3);
		expect(standups[0]).toMatchObject({ calendar_name: 'Work', busy: true, all_day: false });
	});

	it('keeps all-day and free events, drops cancelled and out-of-window ones', () => {
		const byTitle = new Map(parse().map((e) => [e.title, e]));
		expect(byTitle.get('Offsite')).toMatchObject({ all_day: true });
		expect(byTitle.get('Maybe gym')).toMatchObject({ busy: false });
		expect(byTitle.has('Cancelled thing')).toBe(false);
		expect(byTitle.has('Long ago')).toBe(false);
	});

	it('treats webcal:// as https://', () => {
		expect(feedUrl(' webcal://example.com/cal.ics ')).toBe('https://example.com/cal.ics');
	});
});
