<script lang="ts">
	// Keeps integration data fresh while the app is open, without ever blocking
	// a page: right after load, when the tab regains focus, and once a minute,
	// any connection past its freshness window is synced in the background and
	// the page data refreshed. Renders nothing.

	import { invalidateAll } from '$app/navigation';
	import { onMount } from 'svelte';
	import { integrationsApi, isStale } from '../api';
	import { manifestOf } from '../registry';
	import type { ConnectionSummary } from '../schema';

	let { connections }: { connections: ConnectionSummary[] } = $props();

	let syncing = false;

	async function refreshIfStale() {
		// Only integrations with a connector sync from here (not the email agent).
		const due = connections.some(
			(c) => manifestOf(c.integration_id)?.auth.kind !== 'agent' && isStale(c)
		);
		if (!due || syncing || document.visibilityState !== 'visible') return;
		syncing = true;
		try {
			const { synced } = await integrationsApi.sync();
			if (synced > 0) await invalidateAll();
		} catch {
			// Offline or server restarting: try again on the next tick.
		} finally {
			syncing = false;
		}
	}

	onMount(() => {
		refreshIfStale();
		const timer = setInterval(refreshIfStale, 60_000);
		document.addEventListener('visibilitychange', refreshIfStale);
		return () => {
			clearInterval(timer);
			document.removeEventListener('visibilitychange', refreshIfStale);
		};
	});
</script>
