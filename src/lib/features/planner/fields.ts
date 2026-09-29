import type { FieldConfig } from '$lib/components/fields/fields';
import type { PlannerSettings } from './schema';

/** The planning settings form, in display order. */
export const plannerFields: FieldConfig<PlannerSettings>[] = [
	{ key: 'day_start', label: 'Workday starts', kind: 'time', half: true },
	{ key: 'day_end', label: 'Workday ends', kind: 'time', half: true },
	{ key: 'lunch_start', label: 'Lunch at', kind: 'time', half: true },
	{
		key: 'lunch_minutes',
		label: 'Lunch length',
		kind: 'duration',
		required: true,
		half: true,
		hint: 'Custom 0 for none'
	},
	{
		key: 'max_focus_minutes',
		label: 'Longest focus session',
		kind: 'duration',
		required: true,
		half: true,
		hint: 'Then a break'
	},
	{ key: 'break_minutes', label: 'Break length', kind: 'duration', required: true, half: true },
	{
		key: 'switch_minutes',
		label: 'Context-switch buffer',
		kind: 'duration',
		required: true,
		half: true,
		hint: 'Between different projects'
	},
	{
		key: 'daily_capacity_minutes',
		label: 'Focused work per day',
		kind: 'duration',
		required: true,
		half: true,
		hint: 'Anything more is flagged, not crammed in'
	},
	{
		key: 'default_estimate_minutes',
		label: 'Assume unestimated tasks take',
		kind: 'duration',
		required: true
	}
];
