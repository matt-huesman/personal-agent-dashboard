<script lang="ts">
	import XIcon from '@lucide/svelte/icons/x';
	import Board from '$lib/features/action-items/components/Board.svelte';
	import { projectColors } from '$lib/features/projects/colors';

	let { data } = $props();

	const heading = $derived(
		new Date(`${data.today}T00:00:00Z`).toLocaleDateString('en-US', {
			weekday: 'long',
			month: 'long',
			day: 'numeric',
			timeZone: 'UTC'
		})
	);
	const filtered = $derived(data.projects.find((p) => p.id === data.projectFilter));
</script>

<svelte:head><title>Board</title></svelte:head>

<main class="px-6 py-6 sm:px-8">
	<header class="mb-6 flex flex-wrap items-end justify-between gap-3">
		<div>
			<p class="text-sm text-muted-foreground">{heading}</p>
			<h1 class="text-2xl font-semibold tracking-tight">Board</h1>
		</div>
		{#if filtered}
			<a
				href="/"
				class="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm hover:bg-muted"
				title="Show all projects"
			>
				<span class="size-2 rounded-full" style:background={projectColors[filtered.color]}></span>
				{filtered.name}
				<XIcon class="size-3.5 text-muted-foreground" />
			</a>
		{/if}
	</header>

	<Board
		items={data.items}
		today={data.today}
		projects={data.projects}
		projectFilter={filtered ? filtered.id : null}
	/>
</main>
