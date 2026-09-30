import { afterEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { useTestDb } from '../../test/db';
import { calendarSource } from '$lib/features/calendar/calendar.server';
import { connect, disconnect, listConnections, load } from './service.server';
import { syncConnection, syncDue } from './sync.server';
import { connections } from './table.server';

useTestDb();

// Exercise the whole engine through the iCal integration with a stubbed network.
const feed = (events: string) => `BEGIN:VCALENDAR
VERSION:2.0
X-WR-CALNAME:Club
${events}
END:VCALENDAR`;
const vevent = (uid: string, title: string, start: string, end: string) =>
	`BEGIN:VEVENT\nUID:${uid}\nSUMMARY:${title}\nDTSTART:${start}\nDTEND:${end}\nEND:VEVENT`;

let body = '';
let status = 200;
vi.stubGlobal('fetch', async () => new Response(body, { status }));
afterEach(() => {
	status = 200;
});

const soon = (hours: number) => {
	const d = new Date(Date.now() + hours * 3600_000);
	return d
		.toISOString()
		.replace(/[-:]/g, '')
		.replace(/\.\d+Z$/, 'Z');
};
const week = () => {
	const from = new Date().toLocaleDateString('en-CA');
	const to = new Date(Date.now() + 7 * 86_400_000).toLocaleDateString('en-CA');
	return calendarSource.events(from, to);
};

describe('sync engine', () => {
	it('connects, stores a snapshot, and replaces it on the next sync', async () => {
		body = feed(
			vevent('a', 'Practice', soon(24), soon(25)) + '\n' + vevent('b', 'Game', soon(48), soon(50))
		);
		const c = await connect('ics', { kind: 'url', url: 'https://example.com/club.ics' });
		expect(c.account_label).toBe('Club');

		await syncConnection(c.id);
		expect((await week()).map((e) => [e.title, e.read_only, e.source])).toEqual([
			['Practice', true, 'Calendar feed (iCal)'],
			['Game', true, 'Calendar feed (iCal)']
		]);

		body = feed(vevent('b', 'Game (rescheduled)', soon(72), soon(74)));
		await syncConnection(c.id);
		expect((await week()).map((e) => e.title)).toEqual(['Game (rescheduled)']);
		expect(await load(c.id)).toMatchObject({ status: 'active', last_error: null });
	});

	it('records a failure without losing the last good data, and recovers', async () => {
		body = feed(vevent('a', 'Practice', soon(24), soon(25)));
		const c = await connect('ics', { kind: 'url', url: 'https://example.com/club.ics' });
		await syncConnection(c.id);

		status = 503;
		await syncConnection(c.id);
		const failed = await load(c.id);
		expect(failed.status).toBe('error');
		expect(failed.last_error).toContain('503');
		expect((await week()).map((e) => e.title)).toEqual(['Practice']); // kept

		status = 200;
		await syncConnection(c.id);
		expect((await load(c.id)).status).toBe('active');
	});

	it('tracks freshness: only stale connections are synced', async () => {
		body = feed('');
		const c = await connect('ics', { kind: 'url', url: 'https://example.com/club.ics' });
		expect((await listConnections())[0]).toMatchObject({ stale: true, next_sync_at: null });

		expect(await syncDue()).toBe(1);
		const [fresh] = await listConnections();
		expect(fresh.stale).toBe(false);
		expect(Date.parse(fresh.next_sync_at!) - Date.parse(fresh.last_attempt_at!)).toBe(30 * 60_000);
		expect(await syncDue()).toBe(0);

		// Pretend the last attempt was an hour ago.
		const hourAgo = new Date(Date.now() - 3600_000).toISOString();
		await db.update(connections).set({ last_attempt_at: hourAgo }).where(eq(connections.id, c.id));
		expect(await syncDue()).toBe(1);
	});

	it('keeps credentials encrypted and removes mirrored data on disconnect', async () => {
		body = feed(vevent('a', 'Practice', soon(24), soon(25)));
		const c = await connect('ics', { kind: 'url', url: 'https://example.com/secret-token.ics' });
		await syncConnection(c.id);
		expect((await load(c.id)).credentials).not.toContain('secret-token');
		expect(JSON.stringify(await listConnections())).not.toContain('credentials');

		await disconnect(c.id);
		expect(await week()).toEqual([]);
	});
});
