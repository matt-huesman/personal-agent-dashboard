<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Label } from '$lib/components/ui/label';
	import FieldInput from '$lib/components/fields/FieldInput.svelte';
	import { plannerFields } from '../fields';
	import { DEFAULT_PLANNER_SETTINGS, type PlannerSettings } from '../schema';

	let {
		settings,
		onsave,
		onclose
	}: {
		settings: PlannerSettings;
		onsave: (settings: PlannerSettings) => void;
		onclose: () => void;
	} = $props();

	const initial = () => ({ ...settings });
	let values = $state(initial());
	let version = $state(0); // remounts the inputs on reset, clearing their typing state

	function reset() {
		values = { ...DEFAULT_PLANNER_SETTINGS };
		version++;
	}

	function save(e: SubmitEvent) {
		e.preventDefault();
		onsave(values);
	}
</script>

<Dialog.Root open onOpenChange={(open) => !open && onclose()}>
	<Dialog.Content class="sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>Planning</Dialog.Title>
			<Dialog.Description>
				How the calendar places your tasks: your working hours and attention limits.
			</Dialog.Description>
		</Dialog.Header>
		<form class="grid grid-cols-2 gap-x-4 gap-y-5" onsubmit={save}>
			{#key version}
				{#each plannerFields as field (field.key)}
					<div
						class={['flex flex-col gap-2', field.half ? 'col-span-2 sm:col-span-1' : 'col-span-2']}
					>
						<Label for={field.key}>{field.label}</Label>
						<FieldInput {field} id={field.key} bind:value={values[field.key]} />
						{#if field.hint}<p class="text-xs text-muted-foreground">{field.hint}</p>{/if}
					</div>
				{/each}
			{/key}
			<Dialog.Footer class="col-span-2">
				<Button variant="ghost" class="mr-auto text-muted-foreground" onclick={reset}>
					Reset to defaults
				</Button>
				<Button variant="ghost" onclick={onclose}>Cancel</Button>
				<Button type="submit">Save</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
