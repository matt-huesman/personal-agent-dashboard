<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import * as Dialog from '$lib/components/ui/dialog';
	import { categoryLabels, integrations } from '../registry';
	import type { ConnectionSummary } from '../schema';
	import type { IntegrationCategory } from '../types';
	import type { EmailAgentStatus } from '$lib/features/email/service.server';
	import IntegrationCard from './IntegrationCard.svelte';

	// The integration catalog. Opened by ?panel=integrations on any page, so it
	// can be linked to and OAuth can return straight into it.
	let {
		connections,
		emailAgent
	}: { connections: ConnectionSummary[]; emailAgent: EmailAgentStatus } = $props();

	const PANEL_PARAMS = ['panel', 'connection', 'error'];

	const open = $derived(page.url.searchParams.get('panel') === 'integrations');
	const focus = $derived(page.url.searchParams.get('connection'));
	const problem = $derived(page.url.searchParams.get('error'));

	/** The current page without the panel's own params: where OAuth should come back to. */
	const returnTo = $derived.by(() => {
		const url = new URL(page.url);
		for (const key of PANEL_PARAMS) url.searchParams.delete(key);
		return `${url.pathname}${url.search}`;
	});

	const groups = $derived(
		(Object.entries(categoryLabels) as [IntegrationCategory, string][])
			.map(([category, label]) => ({
				label,
				manifests: integrations.filter((m) => m.category === category)
			}))
			.filter((g) => g.manifests.length > 0)
	);

	function close() {
		goto(returnTo, { replaceState: true, noScroll: true, keepFocus: true });
	}
</script>

<Dialog.Root {open} onOpenChange={(isOpen) => !isOpen && close()}>
	<Dialog.Content class="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
		<Dialog.Header>
			<Dialog.Title>Integrations</Dialog.Title>
			<Dialog.Description>
				Connect the places your life already lives. Everything syncs into your board, calendar and
				digests.
			</Dialog.Description>
		</Dialog.Header>

		{#if problem}
			<p
				class="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
			>
				{problem}
			</p>
		{/if}

		<div class="flex flex-col gap-6">
			{#each groups as group (group.label)}
				<section class="flex flex-col gap-2">
					<h3 class="text-xs font-medium text-muted-foreground">{group.label}</h3>
					{#each group.manifests as manifest (manifest.id)}
						<IntegrationCard
							{manifest}
							connections={connections.filter((c) => c.integration_id === manifest.id)}
							{focus}
							{returnTo}
							agent={manifest.auth.kind === 'agent' ? emailAgent : undefined}
						/>
					{/each}
				</section>
			{/each}
		</div>
	</Dialog.Content>
</Dialog.Root>
