<script lang="ts">
	import '../app.css';
	import Sidebar from '$lib/components/shell/Sidebar.svelte';
	import { Toaster } from '$lib/components/ui/sonner';
	import Freshness from '$lib/integrations/components/Freshness.svelte';
	import IntegrationsDialog from '$lib/integrations/components/IntegrationsDialog.svelte';

	let { data, children } = $props();
</script>

<div class="lg:flex">
	<aside
		class="border-b border-border/70 lg:sticky lg:top-0 lg:h-screen lg:w-56 lg:shrink-0 lg:border-r lg:border-b-0"
	>
		<Sidebar projects={data.projects} connections={data.integrations.connections} />
	</aside>
	<div class="min-w-0 flex-1">
		{@render children()}
	</div>
</div>

<IntegrationsDialog
	connections={data.integrations.connections}
	emailAgent={data.integrations.emailAgent}
/>
<Freshness connections={data.integrations.connections} />
<Toaster position="bottom-center" />
