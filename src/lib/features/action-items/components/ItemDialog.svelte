<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { weekdayName } from '$lib/dates';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import FieldInput from '$lib/components/fields/FieldInput.svelte';
	import type { Option } from '$lib/components/fields/fields';
	import { actionItemFields } from '../fields';
	import { can } from '../transitions';
	import type { ActionItemRecord, UpdateActionItemInput } from '../schema';

	let {
		item,
		sources,
		onsave,
		onclose
	}: {
		item: ActionItemRecord;
		sources: Record<string, Option[]>; // runtime options for `select` fields
		onsave: (values: Required<UpdateActionItemInput>, day: string | null) => void;
		onclose: () => void;
	} = $props();

	// Content fields come from fields.ts. The day is placement (saved as a move),
	// and weekly repeat depends on it, so both live outside the field list.
	const initial = () => ({
		values: Object.fromEntries(
			actionItemFields.map((f) => [f.key, item[f.key]])
		) as Required<UpdateActionItemInput>,
		day: item.scheduled_date,
		sticky: item.sticky
	});
	let { values, day, sticky } = $state(initial());

	function save(e: SubmitEvent) {
		e.preventDefault();
		onsave(
			{
				...values,
				links: values.links.filter((link) => link.url.trim()),
				sticky: day !== null && sticky
			},
			day
		);
	}
</script>

<Dialog.Root open onOpenChange={(open) => !open && onclose()}>
	<Dialog.Content class="sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>Edit item</Dialog.Title>
		</Dialog.Header>
		<form class="grid grid-cols-2 gap-x-4 gap-y-5" onsubmit={save}>
			{#each actionItemFields as field (field.key)}
				<div
					class={['flex flex-col gap-2', field.half ? 'col-span-2 sm:col-span-1' : 'col-span-2']}
				>
					<Label for={field.key}>{field.label}</Label>
					<FieldInput
						{field}
						id={field.key}
						options={field.source ? sources[field.source] : undefined}
						bind:value={values[field.key]}
					/>
				</div>
			{/each}
			<div class="col-span-2 flex flex-col gap-2">
				<Label for="scheduled_date">Day</Label>
				<Input
					id="scheduled_date"
					type="date"
					class="w-44"
					disabled={!can('move', item.status)}
					bind:value={() => day ?? '', (v) => (day = v || null)}
				/>
				<p class="text-xs text-muted-foreground">Leave empty to keep it in the pool.</p>
				<Label class="mt-1 flex items-center gap-2 font-normal">
					<Checkbox
						checked={day !== null && sticky}
						disabled={day === null}
						onCheckedChange={(checked) => (sticky = checked)}
					/>
					{day
						? `Repeat every ${weekdayName(day)}, even after it's checked off`
						: 'Repeat weekly (pick a day first)'}
				</Label>
			</div>
			<Dialog.Footer class="col-span-2">
				<Button variant="ghost" onclick={onclose}>Cancel</Button>
				<Button type="submit">Save</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
