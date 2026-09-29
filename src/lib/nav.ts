// Top-level navigation, in sidebar order. A new feature page adds one entry.

import CalendarIcon from '@lucide/svelte/icons/calendar-days';
import LayoutGridIcon from '@lucide/svelte/icons/layout-grid';
import NewspaperIcon from '@lucide/svelte/icons/newspaper';

export const navItems = [
	{ href: '/', label: 'Board', icon: LayoutGridIcon },
	{ href: '/calendar', label: 'Calendar', icon: CalendarIcon },
	{ href: '/digests', label: 'Digests', icon: NewspaperIcon }
];
