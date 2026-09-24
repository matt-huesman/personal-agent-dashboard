<script lang="ts">
	import XIcon from '@lucide/svelte/icons/x';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import type { Link } from '$lib/schema-primitives';

	let { links = $bindable(), id }: { links: Link[]; id?: string } = $props();

	function set(i: number, patch: Partial<Link>) {
		links = links.map((link, j) => (j === i ? { ...link, ...patch } : link));
	}
</script>

<div class="flex flex-col gap-2">
	{#each links as link, i (i)}
		<div class="flex gap-2">
			<Input
				id={i === 0 ? id : undefined}
				placeholder="https://…"
				value={link.url}
				oninput={(e) => set(i, { url: e.currentTarget.value })}
			/>
			<Input
				class="w-36"
				placeholder="Label"
				value={link.label ?? ''}
				oninput={(e) => set(i, { label: e.currentTarget.value || undefined })}
			/>
			<Button
				variant="ghost"
				size="icon"
				aria-label="Remove link"
				onclick={() => (links = links.filter((_, j) => j !== i))}
			>
				<XIcon />
			</Button>
		</div>
	{/each}
	<Button
		variant="ghost"
		size="sm"
		class="self-start text-muted-foreground"
		onclick={() => (links = [...links, { url: '' }])}
	>
		Add link
	</Button>
</div>
