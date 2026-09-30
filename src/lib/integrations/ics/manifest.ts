import RssIcon from '@lucide/svelte/icons/rss';
import { z } from 'zod';
import type { IntegrationManifest } from '../types';

export const icsConfig = z.object({});
export type IcsConfig = z.infer<typeof icsConfig>;

export const icsFeed: IntegrationManifest<IcsConfig> = {
	id: 'ics',
	name: 'Calendar feed (iCal)',
	description:
		'Any calendar that publishes an iCal link: Outlook, Apple, Canvas, a sports schedule.',
	category: 'calendar',
	icon: RssIcon,
	provides: ['Events on the calendar', 'Busy time for the planner'],
	auth: {
		kind: 'url',
		label: 'Feed URL',
		placeholder: 'https://… .ics  or  webcal://…',
		help: 'Look for "Subscribe", "iCal", or "Export calendar" in the other app. Private links are secrets; this one is stored encrypted.'
	},
	readOnly: true,
	config: icsConfig,
	configFields: [],
	syncEveryMinutes: 30
};
