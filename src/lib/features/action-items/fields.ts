import type { FieldConfig } from '$lib/components/fields/fields';
import { priority, type UpdateActionItemInput } from './schema';

/** The edit form, in display order. Keys are checked against the update schema. */
export const actionItemFields: FieldConfig<Required<UpdateActionItemInput>>[] = [
	{ key: 'title', label: 'Title', kind: 'text' },
	{ key: 'description', label: 'Notes', kind: 'textarea' },
	{ key: 'due_date', label: 'Due', kind: 'date' },
	{ key: 'priority', label: 'Priority', kind: 'enum', options: priority.options },
	{ key: 'links', label: 'Links', kind: 'links' }
];
