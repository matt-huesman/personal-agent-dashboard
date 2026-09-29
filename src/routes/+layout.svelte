<script lang="ts">
	import '../app.css';
	import Sidebar from '$lib/components/shell/Sidebar.svelte';
	import { Toaster } from '$lib/components/ui/sonner';

	let { data, children } = $props();
</script>

<div class="lg:flex">
	<aside
		class="border-b border-border/70 lg:sticky lg:top-0 lg:h-screen lg:w-56 lg:shrink-0 lg:border-r lg:border-b-0"
	>
		<Sidebar projects={data.projects} />
	</aside>
	<div class="min-w-0 flex-1">
		{@render children()}
	</div>
</div>
<Toaster position="bottom-center" />
