<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button';
	import Board from '$lib/features/action-items/components/Board.svelte';
	import type { IngestReport } from '$lib/ingest/run.server';

	let { data } = $props();

	let checking = $state(false);

	async function checkForNew() {
		checking = true;
		const report: IngestReport = await (await fetch('/api/ingest', { method: 'POST' })).json();
		checking = false;

		const added = report.ingested.reduce((sum, run) => sum + run.inserted, 0);
		toast(added ? `${added} new item${added === 1 ? '' : 's'}` : 'Nothing new');
		for (const failure of report.failed) {
			toast.error(`Couldn't ingest ${failure.ref}`, { description: failure.error });
		}
		await invalidateAll();
	}

	const heading = $derived(
		new Date(`${data.today}T00:00:00Z`).toLocaleDateString('en-US', {
			weekday: 'long',
			month: 'long',
			day: 'numeric',
			timeZone: 'UTC'
		})
	);
</script>

<svelte:head><title>Action items</title></svelte:head>

<main class="mx-auto max-w-[1700px] px-6 py-10 sm:px-10">
	<header class="mb-10 flex items-end justify-between gap-4">
		<div>
			<p class="text-sm text-muted-foreground">{heading}</p>
			<h1 class="text-2xl font-semibold tracking-tight">Action items</h1>
		</div>
		<Button variant="outline" size="sm" disabled={checking} onclick={checkForNew}>
			{checking ? 'Checking…' : 'Check for new'}
		</Button>
	</header>

	<Board items={data.items} today={data.today} />
</main>
