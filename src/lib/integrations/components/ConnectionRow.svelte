<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
	import SettingsIcon from '@lucide/svelte/icons/settings-2';
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button';
	import { formatAgo } from '$lib/dates';
	import { integrationsApi } from '../api';
	import type { ConnectionSummary } from '../schema';
	import type { IntegrationManifest } from '../types';
	import ConnectionSettings from './ConnectionSettings.svelte';

	let {
		connection,
		manifest,
		settingsOpen = false
	}: {
		connection: ConnectionSummary;
		manifest: IntegrationManifest;
		settingsOpen?: boolean;
	} = $props();

	const initial = () => settingsOpen;
	let showSettings = $state(initial());
	let syncing = $state(false);
	let confirming = $state(false);

	const failing = $derived(connection.status === 'error');

	async function syncNow() {
		syncing = true;
		try {
			await integrationsApi.sync({ connection_id: connection.id });
		} catch (e) {
			toast.error((e as Error).message);
		} finally {
			syncing = false;
			await invalidateAll();
		}
	}

	async function disconnect() {
		try {
			await integrationsApi.disconnect(connection.id);
			toast(`Disconnected ${connection.account_label}`);
		} catch (e) {
			toast.error((e as Error).message);
		}
		await invalidateAll();
	}
</script>

<li class="flex flex-col gap-3 py-3">
	<div class="flex flex-wrap items-center gap-x-3 gap-y-1">
		<span
			class={['size-2 shrink-0 rounded-full', failing ? 'bg-destructive' : 'bg-emerald-500']}
			aria-hidden="true"
		></span>
		<div class="min-w-0 flex-1">
			<p class="truncate text-sm font-medium">{connection.account_label}</p>
			<p class={['text-xs', failing ? 'text-destructive' : 'text-muted-foreground']}>
				{#if syncing}
					Syncing…
				{:else if failing}
					{connection.last_error}
				{:else if connection.last_synced_at}
					Synced {formatAgo(connection.last_synced_at)}
				{:else}
					Not synced yet
				{/if}
			</p>
		</div>
		<div class="flex items-center gap-1">
			{#if confirming}
				<span class="text-xs text-muted-foreground">Disconnect and remove its data?</span>
				<Button size="sm" variant="destructive" onclick={disconnect}>Disconnect</Button>
				<Button size="sm" variant="ghost" onclick={() => (confirming = false)}>Cancel</Button>
			{:else}
				{#if manifest.configFields.length > 0}
					<Button
						size="icon-sm"
						variant="ghost"
						aria-label="Settings"
						title="Settings"
						onclick={() => (showSettings = !showSettings)}
					>
						<SettingsIcon />
					</Button>
				{/if}
				<Button
					size="icon-sm"
					variant="ghost"
					aria-label="Sync now"
					title="Sync now"
					disabled={syncing}
					onclick={syncNow}
				>
					<RefreshCwIcon class={[syncing && 'animate-spin']} />
				</Button>
				<Button
					size="sm"
					variant="ghost"
					class="text-muted-foreground"
					onclick={() => (confirming = true)}
				>
					Disconnect
				</Button>
			{/if}
		</div>
	</div>
	{#if showSettings}
		<ConnectionSettings {connection} {manifest} onclose={() => (showSettings = false)} />
	{/if}
</li>
