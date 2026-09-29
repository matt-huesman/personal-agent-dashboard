<script lang="ts">
	import * as Popover from '$lib/components/ui/popover';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { projectColors } from '../colors';
	import ColorPicker from './ColorPicker.svelte';
	import type { ProjectSummary, UpdateProjectInput } from '../schema';

	let {
		project,
		onupdate,
		onremove
	}: {
		project: ProjectSummary;
		onupdate: (patch: UpdateProjectInput) => void;
		onremove: () => void;
	} = $props();

	let confirming = $state(false);

	function rename(e: Event) {
		const name = (e.currentTarget as HTMLInputElement).value.trim();
		if (name && name !== project.name) onupdate({ name });
	}
</script>

<li class="flex flex-wrap items-center gap-3 py-3">
	<Popover.Root>
		<Popover.Trigger
			class="size-5 shrink-0 rounded-full ring-offset-2 ring-offset-background hover:ring-2 hover:ring-foreground/20"
			style="background: {projectColors[project.color]}"
			aria-label="Change colour for {project.name}"
		/>
		<Popover.Content align="start" class="w-auto">
			<ColorPicker value={project.color} onchange={(color) => onupdate({ color })} />
		</Popover.Content>
	</Popover.Root>

	<Input
		class="h-8 max-w-xs flex-1 border-transparent bg-transparent px-2 shadow-none hover:border-border focus-visible:border-ring"
		value={project.name}
		aria-label="Project name"
		onchange={rename}
		onkeydown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
	/>

	<a
		href="/?project={project.id}"
		class="text-xs text-muted-foreground tabular-nums hover:text-foreground"
	>
		{project.open_count} open
	</a>

	<div class="ml-auto flex items-center gap-2">
		{#if confirming}
			<span class="text-xs text-muted-foreground">
				Delete? {project.open_count ? 'Its tasks stay, without a project.' : ''}
			</span>
			<Button size="sm" variant="destructive" onclick={onremove}>Delete</Button>
			<Button size="sm" variant="ghost" onclick={() => (confirming = false)}>Cancel</Button>
		{:else}
			<Button
				size="sm"
				variant="ghost"
				class="text-muted-foreground"
				onclick={() => (confirming = true)}
			>
				Delete
			</Button>
		{/if}
	</div>
</li>
