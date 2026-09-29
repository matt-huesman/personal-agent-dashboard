<script lang="ts">
	import ArrowUpRightIcon from '@lucide/svelte/icons/arrow-up-right';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button';
	import { digestLabel, gmailLink, type Digest } from '../digest';

	let { digest }: { digest: Digest } = $props();

	const stamp = (iso: string, withDay = true) =>
		new Date(iso).toLocaleString('en-US', {
			...(withDay && { weekday: 'short' }),
			hour: 'numeric',
			minute: '2-digit'
		});

	const weekday = $derived(
		new Date(digest.generated_at).toLocaleDateString('en-US', { weekday: 'long' })
	);
	const empty = $derived(
		!digest.fyi.length &&
			!digest.suggested_replies.length &&
			!digest.action_items.length &&
			!digest.spam_candidates.length
	);

	async function copy(text: string) {
		await navigator.clipboard.writeText(text);
		toast('Reply copied');
	}
</script>

{#snippet emailLink(id: string)}
	<a
		href={gmailLink(id)}
		target="_blank"
		rel="noreferrer"
		class="inline-flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground"
	>
		Email<ArrowUpRightIcon class="size-3" />
	</a>
{/snippet}

{#snippet heading(title: string, count: number)}
	<h2 class="mb-3 flex items-baseline gap-2 text-sm font-medium">
		{title}<span class="text-xs font-normal text-muted-foreground tabular-nums">{count}</span>
	</h2>
{/snippet}

<article class="flex flex-col gap-10">
	<header>
		<h1 class="text-2xl font-semibold tracking-tight">
			{weekday}
			{digestLabel(digest.generated_at).toLowerCase()} digest
		</h1>
		<p class="mt-1 text-sm text-muted-foreground">
			Mail from {stamp(digest.window.since)} to {stamp(digest.window.until)}
		</p>
	</header>

	{#if empty}
		<p class="text-sm text-muted-foreground">A quiet window: nothing worth flagging.</p>
	{/if}

	{#if digest.fyi.length}
		<section>
			{@render heading('For your information', digest.fyi.length)}
			<ul class="divide-y divide-border/70 rounded-xl border bg-card">
				{#each digest.fyi as item, i (i)}
					<li class="flex items-start justify-between gap-4 px-4 py-3 text-sm leading-relaxed">
						<span>{item.summary}</span>
						{@render emailLink(item.source_message_id)}
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if digest.suggested_replies.length}
		<section>
			{@render heading('Suggested replies', digest.suggested_replies.length)}
			<ul class="flex flex-col gap-3">
				{#each digest.suggested_replies as reply, i (i)}
					<li class="rounded-xl border bg-card p-4">
						<p class="text-sm leading-relaxed whitespace-pre-wrap">{reply.draft}</p>
						<div class="mt-3 flex items-center gap-3">
							<Button size="sm" variant="outline" onclick={() => copy(reply.draft)}>
								<CopyIcon />Copy
							</Button>
							{@render emailLink(reply.source_message_id)}
							<span class="ml-auto text-xs text-muted-foreground">
								{reply.confidence} confidence
							</span>
						</div>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if digest.action_items.length}
		<section>
			{@render heading('Added to your pool', digest.action_items.length)}
			<ul class="divide-y divide-border/70 rounded-xl border bg-card">
				{#each digest.action_items as item (item.id)}
					<li class="flex items-start justify-between gap-4 px-4 py-3 text-sm">
						<span>{item.title}</span>
						{#if item.source_message_id}{@render emailLink(item.source_message_id)}{/if}
					</li>
				{/each}
			</ul>
			<a href="/" class="mt-2 inline-block text-xs text-muted-foreground hover:text-foreground">
				Open the board →
			</a>
		</section>
	{/if}

	{#if digest.spam_candidates.length}
		<section>
			{@render heading('Possible spam', digest.spam_candidates.length)}
			<ul class="divide-y divide-border/70 rounded-xl border border-dashed">
				{#each digest.spam_candidates as item, i (i)}
					<li
						class="flex items-start justify-between gap-4 px-4 py-3 text-sm text-muted-foreground"
					>
						<span>{item.reason}</span>
						{@render emailLink(item.source_message_id)}
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</article>
