<script lang="ts">
	import XIcon from '@lucide/svelte/icons/x';
	import { Label } from '$lib/components/ui/label';
	import { Switch } from '$lib/components/ui/switch';
	import Board from '$lib/features/action-items/components/Board.svelte';
	import { SHOW_DONE_COOKIE } from '$lib/features/action-items/view';
	import { projectColors } from '$lib/features/projects/colors';

	let { data } = $props();

	// A per-browser view preference: kept in a cookie so the server renders it too.
	const initial = () => data.showDone;
	let showDone = $state(initial());

	function toggleDone(checked: boolean) {
		showDone = checked;
		document.cookie = `${SHOW_DONE_COOKIE}=${checked ? 1 : 0}; path=/; max-age=31536000; samesite=lax`;
	}

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
		<div class="flex flex-wrap items-center gap-4">
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
			<Label class="flex items-center gap-2 text-sm font-normal text-muted-foreground">
				<Switch checked={showDone} onCheckedChange={toggleDone} />
				Show completed
			</Label>
		</div>
	</header>

	<Board
		items={data.items}
		today={data.today}
		projects={data.projects}
		projectFilter={filtered ? filtered.id : null}
		{showDone}
	/>
</main>
