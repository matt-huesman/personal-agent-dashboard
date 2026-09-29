<script lang="ts">
	import * as Select from '$lib/components/ui/select';
	import { Input } from '$lib/components/ui/input';
	import { DURATION_PRESETS, formatMinutes, parseMinutes } from '$lib/durations';

	let {
		value = $bindable(),
		id,
		required = false
	}: { value: number | null; id?: string; required?: boolean } = $props();

	const isPreset = (v: number | null) =>
		(v === null && !required) || (DURATION_PRESETS as readonly number[]).includes(v ?? -1);

	// A value that isn't a preset opens straight into the custom field.
	const initial = () => value;
	let custom = $state(!isPreset(initial()));
	let text = $state(isPreset(initial()) ? '' : formatMinutes(initial() ?? 0));

	const selected = $derived(custom ? 'custom' : value === null ? 'none' : String(value));

	function choose(choice: string) {
		custom = choice === 'custom';
		if (choice === 'none') value = null;
		else if (!custom) value = Number(choice);
	}

	function typed() {
		// "0" is a real answer for a required duration (e.g. no lunch break).
		const minutes = text.trim() === '0' && required ? 0 : parseMinutes(text);
		if (minutes !== null || !required) value = minutes;
	}
</script>

<div class="flex gap-2">
	<Select.Root type="single" value={selected} onValueChange={choose}>
		<Select.Trigger {id} class="w-36">
			{custom ? 'Custom' : value === null ? 'None' : formatMinutes(value)}
		</Select.Trigger>
		<Select.Content>
			{#if !required}<Select.Item value="none">None</Select.Item>{/if}
			{#each DURATION_PRESETS as minutes (minutes)}
				<Select.Item value={String(minutes)}>{formatMinutes(minutes)}</Select.Item>
			{/each}
			<Select.Item value="custom">Custom…</Select.Item>
		</Select.Content>
	</Select.Root>
	{#if custom}
		<Input
			class="w-36"
			placeholder="e.g. 1h 20m"
			aria-label="Custom duration"
			aria-invalid={text.trim() !== '' && parseMinutes(text) === null && text.trim() !== '0'}
			bind:value={text}
			oninput={typed}
		/>
	{/if}
</div>
