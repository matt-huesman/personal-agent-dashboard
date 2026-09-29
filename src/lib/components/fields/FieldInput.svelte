<script lang="ts">
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import * as Select from '$lib/components/ui/select';
	import { fromClock, toClock } from '$lib/dates';
	import type { Link } from '$lib/schema-primitives';
	import DurationInput from './DurationInput.svelte';
	import LinksInput from './LinksInput.svelte';
	import type { Field, Option } from './fields';

	// `value` is typed by the entity's schema at the call site; here each kind
	// knows its own shape. Nullable kinds map an empty input back to null.
	let {
		field,
		id,
		value = $bindable(),
		options = []
	}: { field: Field; id: string; value: unknown; options?: readonly Option[] } = $props();

	const NONE = '__none';
	const chosen = $derived(options.find((o) => o.value === value));
</script>

{#snippet dot(color: string | undefined)}
	{#if color}<span class="size-2 shrink-0 rounded-full" style:background={color}></span>{/if}
{/snippet}

{#if field.kind === 'text'}
	<Input {id} required bind:value={() => value as string, (v) => (value = v)} />
{:else if field.kind === 'textarea'}
	<Textarea
		{id}
		rows={3}
		bind:value={() => (value as string | null) ?? '', (v) => (value = v || null)}
	/>
{:else if field.kind === 'date'}
	<Input
		{id}
		type="date"
		class="w-44"
		bind:value={() => (value as string | null) ?? '', (v) => (value = v || null)}
	/>
{:else if field.kind === 'enum'}
	<Select.Root type="single" bind:value={() => value as string, (v) => (value = v)}>
		<Select.Trigger {id} class="w-44 capitalize">{value}</Select.Trigger>
		<Select.Content>
			{#each field.options ?? [] as option (option)}
				<Select.Item value={option} class="capitalize">{option}</Select.Item>
			{/each}
		</Select.Content>
	</Select.Root>
{:else if field.kind === 'select'}
	<Select.Root
		type="single"
		value={(value as string | null) ?? NONE}
		onValueChange={(v) => (value = v === NONE ? null : v)}
	>
		<Select.Trigger {id} class="w-44">
			<span class="flex items-center gap-2 truncate">
				{@render dot(chosen?.color)}{chosen?.label ?? 'None'}
			</span>
		</Select.Trigger>
		<Select.Content>
			<Select.Item value={NONE}>None</Select.Item>
			{#each options as option (option.value)}
				<Select.Item value={option.value}>
					<span class="flex items-center gap-2">{@render dot(option.color)}{option.label}</span>
				</Select.Item>
			{/each}
		</Select.Content>
	</Select.Root>
{:else if field.kind === 'duration'}
	<DurationInput
		{id}
		required={field.required}
		bind:value={() => value as number | null, (v) => (value = v)}
	/>
{:else if field.kind === 'time'}
	<Input
		{id}
		type="time"
		step="300"
		class="w-36"
		required
		bind:value={() => toClock(value as number), (v) => (value = v ? fromClock(v) : value)}
	/>
{:else if field.kind === 'links'}
	<LinksInput {id} bind:links={() => value as Link[], (v) => (value = v)} />
{/if}
