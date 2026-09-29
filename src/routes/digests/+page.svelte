<script lang="ts">
	import { page } from '$app/state';
	import DigestList from '$lib/features/digests/components/DigestList.svelte';
	import DigestView from '$lib/features/digests/components/DigestView.svelte';

	let { data } = $props();

	// ?run=<run_id> picks a digest; otherwise the latest.
	const selected = $derived(
		data.digests.find((d) => d.id === page.url.searchParams.get('run')) ?? data.digests[0]
	);
</script>

<svelte:head><title>Digests</title></svelte:head>

<main class="px-6 py-6 sm:px-8">
	{#if selected}
		<div class="flex flex-col gap-8 md:flex-row md:items-start">
			<div class="md:sticky md:top-6 md:w-56 md:shrink-0">
				<DigestList digests={data.digests} selectedId={selected.id} />
			</div>
			<div class="max-w-3xl min-w-0 flex-1">
				<DigestView digest={selected} />
			</div>
		</div>
	{:else}
		<h1 class="text-2xl font-semibold tracking-tight">Digests</h1>
		<p class="mt-2 text-sm text-muted-foreground">
			No digests yet. Each email-agent run appears here as a morning or evening briefing.
		</p>
	{/if}
</main>
