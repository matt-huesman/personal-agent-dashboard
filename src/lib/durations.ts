// Durations are whole minutes everywhere; these helpers only format and parse.

export const DURATION_PRESETS = [15, 30, 45, 60, 90, 120, 240] as const;

/** 45 → "45m", 60 → "1h", 90 → "1h 30m". */
export function formatMinutes(minutes: number): string {
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	if (h === 0) return `${m}m`;
	return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/**
 * Lenient parse of a typed duration: "80", "80m", "1.5h", "1h 20m", "1:20".
 * Returns whole minutes, or null if the text isn't a positive duration.
 */
export function parseMinutes(text: string): number | null {
	const s = text.trim().toLowerCase();
	let minutes: number | null = null;

	const clock = s.match(/^(\d+):(\d{1,2})$/);
	const units = s.match(
		/^(?:(\d+(?:\.\d+)?)\s*h(?:ours?|rs?)?)?\s*(?:(\d+)\s*m(?:in(?:ute)?s?)?)?$/
	);
	if (clock) minutes = Number(clock[1]) * 60 + Number(clock[2]);
	else if (/^\d+$/.test(s)) minutes = Number(s);
	else if (units && (units[1] || units[2]))
		minutes = Math.round(Number(units[1] ?? 0) * 60) + Number(units[2] ?? 0);

	return minutes !== null && minutes > 0 ? minutes : null;
}
