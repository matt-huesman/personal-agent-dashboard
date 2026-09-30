<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import LockIcon from '@lucide/svelte/icons/lock';
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { formatAgo } from '$lib/dates';
	import { integrationsApi } from '../api';
	import type { EmailAgentStatus } from '$lib/features/email/service.server';
	import type { ConnectionSummary } from '../schema';
	import type { IntegrationManifest } from '../types';
	import ConnectionRow from './ConnectionRow.svelte';

	// One integration in the catalog. How it connects comes from its manifest's
	// auth kind: OAuth redirects, a URL takes a link, an agent is managed elsewhere.
	let {
		manifest,
		connections,
		focus,
		returnTo,
		agent
	}: {
		manifest: IntegrationManifest;
		connections: ConnectionSummary[];
		focus: string | null; // connection to open settings for (after connecting)
		returnTo: string;
		agent?: EmailAgentStatus; // for agent-kind integrations
	} = $props();

	let addingUrl = $state(false);
	let url = $state('');
	let connecting = $state(false);

	async function connectUrl(e: SubmitEvent) {
		e.preventDefault();
		connecting = true;
		try {
			const connection = await integrationsApi.connectUrl(manifest.id, url);
			toast(`Connected ${connection.account_label}`);
			url = '';
			addingUrl = false;
		} catch (err) {
			toast.error((err as Error).message);
		} finally {
			connecting = false;
			await invalidateAll();
		}
	}
</script>

<article class="rounded-xl border bg-card p-4">
	<div class="flex items-start gap-3">
		<div class="grid size-9 shrink-0 place-items-center rounded-lg bg-muted">
			<manifest.icon class="size-4" />
		</div>
		<div class="min-w-0 flex-1">
			<div class="flex flex-wrap items-center gap-2">
				<h4 class="text-sm font-medium">{manifest.name}</h4>
				{#if manifest.readOnly}
					<span
						class="inline-flex items-center gap-1 rounded-full border px-1.5 text-[0.65rem] text-muted-foreground"
						title="Data is only read from this source, never changed"
					>
						<LockIcon class="size-2.5" />Read-only
					</span>
				{/if}
			</div>
			<p class="mt-0.5 text-sm text-muted-foreground">{manifest.description}</p>
			<p class="mt-1.5 text-xs text-muted-foreground/80">{manifest.provides.join(' · ')}</p>
		</div>
		{#if manifest.auth.kind === 'oauth2'}
			<Button
				size="sm"
				variant="outline"
				href="/integrations/{manifest.id}/connect?return={encodeURIComponent(returnTo)}"
				data-sveltekit-reload
			>
				{connections.length ? 'Add account' : 'Connect'}
			</Button>
		{:else if manifest.auth.kind === 'url' && !addingUrl}
			<Button size="sm" variant="outline" onclick={() => (addingUrl = true)}>
				{connections.length ? 'Add feed' : 'Connect'}
			</Button>
		{/if}
	</div>

	{#if manifest.auth.kind === 'url' && addingUrl}
		<form class="mt-3 flex flex-col gap-2" onsubmit={connectUrl}>
			<div class="flex gap-2">
				<Input
					bind:value={url}
					placeholder={manifest.auth.placeholder}
					aria-label={manifest.auth.label}
					autofocus
				/>
				<Button type="submit" size="sm" disabled={!url.trim() || connecting}>
					{connecting ? 'Checking…' : 'Connect'}
				</Button>
				<Button size="sm" variant="ghost" onclick={() => (addingUrl = false)}>Cancel</Button>
			</div>
			<p class="text-xs text-muted-foreground">{manifest.auth.help}</p>
		</form>
	{/if}

	{#if manifest.auth.kind === 'agent' && agent}
		<div class="mt-3 flex items-start gap-2 border-t pt-3 text-xs text-muted-foreground">
			<span
				class={[
					'mt-1 size-2 shrink-0 rounded-full',
					!agent.handoffReady
						? 'bg-amber-500'
						: agent.lastRun
							? 'bg-emerald-500'
							: 'bg-muted-foreground/40'
				]}
			></span>
			<div class="flex flex-col gap-0.5">
				<span>
					{agent.lastRun ? `Last digest ${formatAgo(agent.lastRun)}` : 'No digests yet'} ·
					{agent.waiting
						? `${agent.waiting} message${agent.waiting === 1 ? '' : 's'} waiting for the next run`
						: 'inbox caught up'}
				</span>
				{#if !agent.handoffReady}
					<span class="text-amber-700">
						Mail can't reach the routine yet: set DRIVE_FOLDER_ID and INBOX_KEY. {manifest.auth
							.help}
					</span>
				{/if}
			</div>
		</div>
	{/if}

	{#if connections.length > 0}
		<ul class="mt-3 divide-y border-t">
			{#each connections as connection (connection.id)}
				<ConnectionRow {connection} {manifest} settingsOpen={connection.id === focus} />
			{/each}
		</ul>
	{/if}
</article>
