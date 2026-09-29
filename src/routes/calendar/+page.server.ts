import { addDays, mondayOf, today } from '$lib/dates';
import { listBoard } from '$lib/features/action-items/service.server';
import { calendarSource } from '$lib/features/calendar/calendar.server';
import { getSettings } from '$lib/features/planner/service.server';
import type { PageServerLoad } from './$types';

// Only data here; the plan itself is computed in the page (and re-computed as
// time passes), from the same pure planner the server could run.
export const load: PageServerLoad = async ({ url, parent }) => {
	await parent();
	const day = today();
	const week = mondayOf(url.searchParams.get('week') ?? day);
	const [items, settings, events] = await Promise.all([
		listBoard(day), // also applies roll-over and weekly repeats
		getSettings(),
		calendarSource.events(week, addDays(week, 6))
	]);
	return { today: day, week, items, settings, events };
};
