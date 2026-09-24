<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import FieldInput from '$lib/components/fields/FieldInput.svelte';
	import { actionItemFields } from '../fields';
	import { can } from '../transitions';
	import type { ActionItemRecord, UpdateActionItemInput } from '../schema';

	let {
		item,
		onsave,
		onclose
	}: {
		item: ActionItemRecord;
		onsave: (values: Required<UpdateActionItemInput>, day: string | null) => void;
		onclose: () => void;
	} = $props();

	// Content fields come from fields.ts; the day is placement, saved as a move.
	const initial = () => ({
		values: Object.fromEntries(
			actionItemFields.map((f) => [f.key, item[f.key]])
		) as Required<UpdateActionItemInput>,
		day: item.scheduled_date
	});
	let { values, day } = $state(initial());

	function save(e: SubmitEvent) {
		e.preventDefault();
		onsave({ ...values, links: values.links.filter((link) => link.url.trim()) }, day);
	}
</script>

<Dialog.Root open onOpenChange={(open) => !open && onclose()}>
	<Dialog.Content class="sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>Edit item</Dialog.Title>
		</Dialog.Header>
		<form class="flex flex-col gap-5" onsubmit={save}>
			{#each actionItemFields as field (field.key)}
				<div class="flex flex-col gap-2">
					<Label for={field.key}>{field.label}</Label>
					<FieldInput {field} id={field.key} bind:value={values[field.key]} />
				</div>
			{/each}
			<div class="flex flex-col gap-2">
				<Label for="scheduled_date">Day</Label>
				<Input
					id="scheduled_date"
					type="date"
					class="w-44"
					disabled={!can('move', item.status)}
					bind:value={() => day ?? '', (v) => (day = v || null)}
				/>
				<p class="text-xs text-muted-foreground">Leave empty to keep it in the pool.</p>
			</div>
			<Dialog.Footer>
				<Button variant="ghost" onclick={onclose}>Cancel</Button>
				<Button type="submit">Save</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
