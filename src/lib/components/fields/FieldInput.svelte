<script lang="ts">
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import * as Select from '$lib/components/ui/select';
	import type { Link } from '$lib/schema-primitives';
	import LinksInput from './LinksInput.svelte';
	import type { Field } from './fields';

	// `value` is typed by the entity's schema at the call site; here each kind
	// knows its own shape. Nullable kinds map an empty input back to null.
	let { field, id, value = $bindable() }: { field: Field; id: string; value: unknown } = $props();
</script>

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
{:else if field.kind === 'links'}
	<LinksInput {id} bind:links={() => value as Link[], (v) => (value = v)} />
{/if}
