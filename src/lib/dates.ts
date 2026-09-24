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
