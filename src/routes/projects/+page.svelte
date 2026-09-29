<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { projectsApi as api } from '$lib/features/projects/api';
	import ColorPicker from '$lib/features/projects/components/ColorPicker.svelte';
	import ProjectRow from '$lib/features/projects/components/ProjectRow.svelte';
	import { PROJECT_COLORS, type ProjectColor } from '$lib/features/projects/schema';

	let { data } = $props();

	// Suggest the first colour not already in use, so new projects stay distinct.
	const nextColor = $derived(
		PROJECT_COLORS.find((c) => !data.projects.some((p) => p.color === c)) ?? PROJECT_COLORS[0]
	);

	let name = $state('');
	let picked = $state<ProjectColor | null>(null);
	const color = $derived(picked ?? nextColor);

	async function run(action: Promise<unknown>) {
		try {
			await action;
		} catch (e) {
			toast.error((e as Error).message);
		}
		await invalidateAll();
	}

	async function create(e: SubmitEvent) {
		e.preventDefault();
		if (!name.trim()) return;
		await run(api.create({ name, color }));
		name = '';
		picked = null;
	}
</script>

<svelte:head><title>Projects</title></svelte:head>

<main class="max-w-2xl px-6 py-6 sm:px-8">
	<header class="mb-8">
		<h1 class="text-2xl font-semibold tracking-tight">Projects</h1>
		<p class="mt-1 text-sm text-muted-foreground">
			Themes your tasks belong to. Each gets a colour, shown as a stripe on its tasks.
		</p>
	</header>

	<form class="mb-8 flex flex-col gap-3 rounded-xl border bg-card p-4" onsubmit={create}>
		<div class="flex gap-2">
			<Input
				bind:value={name}
				placeholder="New project, e.g. Honors thesis"
				aria-label="Project name"
			/>
			<Button type="submit" disabled={!name.trim()}>Add</Button>
		</div>
		<ColorPicker value={color} onchange={(c) => (picked = c)} />
	</form>

	{#if data.projects.length > 0}
		<ul class="divide-y divide-border/70">
			{#each data.projects as project (project.id)}
				<ProjectRow
					{project}
					onupdate={(patch) => run(api.update(project.id, patch))}
					onremove={() => run(api.remove(project.id))}
				/>
			{/each}
		</ul>
	{:else}
		<p class="text-sm text-muted-foreground">No projects yet.</p>
	{/if}
</main>
