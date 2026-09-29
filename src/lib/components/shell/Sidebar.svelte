<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
	import SettingsIcon from '@lucide/svelte/icons/settings-2';
	import { toast } from 'svelte-sonner';
	import { navItems } from '$lib/nav';
	import { projectColors } from '$lib/features/projects/colors';
	import type { ProjectSummary } from '$lib/features/projects/schema';
	import type { IngestReport } from '$lib/ingest/run.server';

	let { projects }: { projects: ProjectSummary[] } = $props();

	const path = $derived(page.url.pathname);
	const activeProject = $derived(path === '/' ? page.url.searchParams.get('project') : null);

	let checking = $state(false);

	async function checkForNew() {
		checking = true;
		const res = await fetch('/api/ingest', { method: 'POST' });
		checking = false;
		if (!res.ok) {
			toast.error("Couldn't check for new items", { description: (await res.json()).message });
			return;
		}
		const report: IngestReport = await res.json();
		const added = report.ingested.reduce((sum, run) => sum + run.inserted, 0);
		const digests = report.ingested.length;
		toast(
			digests
				? `${digests} new digest${digests === 1 ? '' : 's'}, ${added} new item${added === 1 ? '' : 's'}`
				: 'Nothing new'
		);
		for (const failure of report.failed) {
			toast.error(`Couldn't ingest ${failure.ref}`, { description: failure.error });
		}
		await invalidateAll();
	}

	const linkClass = (active: boolean) => [
		'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors',
		active
			? 'bg-muted font-medium text-foreground'
			: 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
	];
</script>

<nav class="flex h-full flex-col gap-6 px-3 py-6" aria-label="Main">
	<a href="/" class="px-2 text-sm font-semibold tracking-tight">Dashboard</a>

	<ul class="flex flex-col gap-0.5">
		{#each navItems as item (item.href)}
			<li>
				<a
					href={item.href}
					class={linkClass(
						item.href === '/' ? path === '/' && !activeProject : path.startsWith(item.href)
					)}
					aria-current={path === item.href ? 'page' : undefined}
				>
					<item.icon class="size-4" />
					{item.label}
				</a>
			</li>
		{/each}
	</ul>

	<section class="flex min-h-0 flex-col gap-1">
		<header class="flex items-center justify-between px-2 pb-1">
			<h2 class="text-xs font-medium text-muted-foreground">Projects</h2>
			<a
				href="/projects"
				class="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
				aria-label="Manage projects"
				title="Manage projects"
			>
				<SettingsIcon class="size-3.5" />
			</a>
		</header>
		<ul class="flex min-h-0 flex-col gap-0.5 overflow-y-auto">
			{#each projects as project (project.id)}
				<li>
					<a
						href={activeProject === project.id ? '/' : `/?project=${project.id}`}
						class={linkClass(activeProject === project.id)}
						title={activeProject === project.id ? 'Show all projects' : `Show only ${project.name}`}
					>
						<span
							class="size-2 shrink-0 rounded-full"
							style:background={projectColors[project.color]}
						></span>
						<span class="min-w-0 flex-1 truncate">{project.name}</span>
						{#if project.open_count}
							<span class="text-xs text-muted-foreground tabular-nums">{project.open_count}</span>
						{/if}
					</a>
				</li>
			{/each}
			<li>
				<a href="/projects" class={linkClass(path === '/projects')}>
					<PlusIcon class="size-4" />
					{projects.length ? 'New project' : 'Add a project'}
				</a>
			</li>
		</ul>
	</section>

	<div class="mt-auto">
		<button
			type="button"
			class={[linkClass(false), 'w-full disabled:opacity-60']}
			disabled={checking}
			onclick={checkForNew}
		>
			<RefreshCwIcon class={['size-4', checking && 'animate-spin']} />
			{checking ? 'Checking…' : 'Check for new'}
		</button>
	</div>
</nav>
