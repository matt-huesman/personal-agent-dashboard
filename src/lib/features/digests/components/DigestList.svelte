<script lang="ts">
	import { addDays, today } from '$lib/dates';
	import { digestLabel, type Digest } from '../digest';

	let { digests, selectedId }: { digests: Digest[]; selectedId: string | undefined } = $props();

	const localDay = (iso: string) => new Date(iso).toLocaleDateString('en-CA');
	const time = (iso: string) =>
		new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

	function dayHeading(day: string) {
		const now = today();
		if (day === now) return 'Today';
		if (day === addDays(now, -1)) return 'Yesterday';
		return new Date(`${day}T00:00:00Z`).toLocaleDateString('en-US', {
			weekday: 'short',
			month: 'short',
			day: 'numeric',
			timeZone: 'UTC'
		});
	}

	// Newest first, grouped by the local day each digest was generated.
	const groups = $derived.by(() => {
		const byDay = new Map<string, Digest[]>();
		for (const digest of digests) {
			const day = localDay(digest.generated_at);
			byDay.set(day, [...(byDay.get(day) ?? []), digest]);
		}
		return [...byDay];
	});

	function summary(d: Digest) {
		const parts = [
			d.fyi.length && `${d.fyi.length} FYI`,
			d.suggested_replies.length &&
				`${d.suggested_replies.length} repl${d.suggested_replies.length === 1 ? 'y' : 'ies'}`,
			d.action_items.length &&
				`${d.action_items.length} task${d.action_items.length === 1 ? '' : 's'}`
		].filter(Boolean);
		return parts.length ? parts.join(' · ') : 'Nothing flagged';
	}
</script>

<nav aria-label="Digests" class="flex flex-col gap-5">
	{#each groups as [day, list] (day)}
		<section>
			<h2 class="px-2 pb-1 text-xs font-medium text-muted-foreground">{dayHeading(day)}</h2>
			<ul class="flex flex-col gap-0.5">
				{#each list as digest (digest.id)}
					<li>
						<a
							href="?run={encodeURIComponent(digest.id)}"
							data-sveltekit-noscroll
							aria-current={digest.id === selectedId ? 'page' : undefined}
							class={[
								'block rounded-md px-2 py-1.5 transition-colors',
								digest.id === selectedId ? 'bg-muted' : 'hover:bg-muted/60'
							]}
						>
							<span class="flex items-baseline justify-between gap-2 text-sm">
								<span class={[digest.id === selectedId && 'font-medium']}>
									{digestLabel(digest.generated_at)}
								</span>
								<span class="text-xs text-muted-foreground tabular-nums">
									{time(digest.generated_at)}
								</span>
							</span>
							<span class="block text-xs text-muted-foreground">{summary(digest)}</span>
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/each}
</nav>
