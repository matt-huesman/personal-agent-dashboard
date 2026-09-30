<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import FieldInput from '$lib/components/fields/FieldInput.svelte';
	import type { Option } from '$lib/components/fields/fields';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import { integrationsApi } from '../api';
	import type { ConnectionSummary } from '../schema';
	import type { IntegrationManifest } from '../types';

	// The connection's settings form, rendered from its manifest. Fields with a
	// `source` get their choices from the connector (e.g. your calendars).
	let {
		connection,
		manifest,
		onclose
	}: { connection: ConnectionSummary; manifest: IntegrationManifest; onclose: () => void } =
		$props();

	const initial = () => manifest.config.parse(connection.config) as Record<string, unknown>;
	let values = $state(initial());
	let sources = $state<Record<string, Option[]>>({});
	let saving = $state(false);

	onMount(() => {
		for (const field of manifest.configFields) {
			if (!field.source) continue;
			const source = field.source;
			integrationsApi
				.options(connection.id, source)
				.then((options) => (sources[source] = options))
				.catch((e: Error) => toast.error(`Couldn't load choices: ${e.message}`));
		}
	});

	async function save(e: SubmitEvent) {
		e.preventDefault();
		saving = true;
		try {
			await integrationsApi.configure(connection.id, values);
			toast('Saved and synced');
			onclose();
		} catch (err) {
			toast.error((err as Error).message);
		} finally {
			saving = false;
			await invalidateAll();
		}
	}
</script>

<form class="flex flex-col gap-4 rounded-lg bg-muted/40 p-3" onsubmit={save}>
	{#each manifest.configFields as field (field.key)}
		<div class="flex flex-col gap-2">
			<Label for="{connection.id}-{field.key}">{field.label}</Label>
			<FieldInput
				{field}
				id="{connection.id}-{field.key}"
				options={field.source ? (sources[field.source] ?? []) : undefined}
				bind:value={values[field.key]}
			/>
			{#if field.hint}<p class="text-xs text-muted-foreground">{field.hint}</p>{/if}
		</div>
	{/each}
	<div class="flex justify-end gap-2">
		<Button size="sm" variant="ghost" onclick={onclose}>Cancel</Button>
		<Button size="sm" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
	</div>
</form>
