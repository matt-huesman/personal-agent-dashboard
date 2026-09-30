import CalendarIcon from '@lucide/svelte/icons/calendar';
import { z } from 'zod';
import type { IntegrationManifest } from '../types';

export const googleCalendarConfig = z.object({
	calendar_ids: z.array(z.string()).default(['primary'])
});
export type GoogleCalendarConfig = z.infer<typeof googleCalendarConfig>;

export const googleCalendar: IntegrationManifest<GoogleCalendarConfig> = {
	id: 'google-calendar',
	name: 'Google Calendar',
	description: 'Your meetings and events, so tasks are planned around them.',
	category: 'calendar',
	icon: CalendarIcon,
	provides: ['Events on the calendar', 'Busy time for the planner'],
	auth: {
		kind: 'oauth2',
		provider: 'google',
		scopes: [
			'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
			'https://www.googleapis.com/auth/calendar.events.readonly'
		]
	},
	readOnly: true,
	config: googleCalendarConfig,
	configFields: [
		{
			key: 'calendar_ids',
			label: 'Calendars',
			kind: 'multiselect',
			source: 'calendars',
			hint: 'Events from these calendars appear on your calendar and block time.'
		}
	],
	syncEveryMinutes: 15
};
