// Calendar-day helpers. Days are ISO strings ("2026-09-24"), so they compare
// and sort lexically. "Today" is the local day of whichever process calls it —
// on the server that is the container's TZ.

export function today(): string {
	return new Date().toLocaleDateString('en-CA'); // en-CA formats as YYYY-MM-DD
}

/** Local midnight at the start of `day`, as an ISO timestamp. */
export function startOf(day: string): string {
	return new Date(`${day}T00:00:00`).toISOString(); // no "Z": parsed as local time
}

export function addDays(day: string, n: number): string {
	const d = new Date(`${day}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + n);
	return d.toISOString().slice(0, 10);
}

/** The Monday of the week containing `day`. */
export function mondayOf(day: string): string {
	const weekday = new Date(`${day}T00:00:00Z`).getUTCDay(); // 0 = Sunday
	return addDays(day, -((weekday + 6) % 7));
}

// --- Time of day (minutes since local midnight) -------------------------------

/** Minutes since local midnight of `day` at instant `at` (may be <0 or >1440). */
export function minutesInto(day: string, at: Date): number {
	return Math.round((at.getTime() - new Date(`${day}T00:00:00`).getTime()) / 60000);
}

/** 540 → "09:00" (for <input type="time">). */
export function toClock(minutes: number): string {
	const h = String(Math.floor(minutes / 60)).padStart(2, '0');
	return `${h}:${String(minutes % 60).padStart(2, '0')}`;
}

/** "09:00" → 540. */
export function fromClock(clock: string): number {
	const [h, m] = clock.split(':').map(Number);
	return h * 60 + m;
}

/** 540 → "9:00", 810 → "1:30" (12-hour, no suffix; pass `suffix` for "1:30 PM"). */
export function formatClock(minutes: number, suffix = false): string {
	const h24 = Math.floor(minutes / 60) % 24;
	const h = h24 % 12 || 12;
	const text = `${h}:${String(minutes % 60).padStart(2, '0')}`;
	return suffix ? `${text} ${h24 < 12 ? 'AM' : 'PM'}` : text;
}

/** "just now", "5 min ago", "3 h ago", then a date. */
export function formatAgo(iso: string, now = new Date()): string {
	const minutes = Math.round((now.getTime() - Date.parse(iso)) / 60_000);
	if (minutes < 1) return 'just now';
	if (minutes < 60) return `${minutes} min ago`;
	if (minutes < 24 * 60) return `${Math.round(minutes / 60)} h ago`;
	return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** "2026-09-28" → "Monday". */
export function weekdayName(day: string): string {
	return new Date(`${day}T00:00:00Z`).toLocaleDateString('en-US', {
		weekday: 'long',
		timeZone: 'UTC'
	});
}

export function formatDay(day: string, relativeTo: string): string {
	if (day === relativeTo) return 'Today';
	if (day === addDays(relativeTo, 1)) return 'Tomorrow';
	return new Date(`${day}T00:00:00Z`).toLocaleDateString('en-US', {
		weekday: 'short',
		month: 'short',
		day: 'numeric',
		timeZone: 'UTC'
	});
}
