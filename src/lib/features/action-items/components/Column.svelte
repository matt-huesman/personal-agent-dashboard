<script lang="ts">
	import { flip } from 'svelte/animate';
	import { dndzone, TRIGGERS, type DndEvent } from 'svelte-dnd-action';
	import { formatMinutes } from '$lib/durations';
	import ItemCard from './ItemCard.svelte';
	import type { ActionItemRecord } from '../schema';
	import type { BoardContext } from './Board.svelte';

	// One container — the pool (date null) or a day — as a panel. Open items are
	// a drop zone; done items sit underneath and don't drag. The list scrolls
	// inside the panel, so a busy day never pushes the grid around.
	let {
		title,
		detail,
		date,
		open,
		done,
		board,
		highlight = false,
		fill = false
	}: {
		title: string;
		detail?: string;
		date: string | null;
		open: ActionItemRecord[];
		done: ActionItemRecord[];
		board: BoardContext;
		highlight?: boolean; // today
		fill?: boolean; // grow with content up to the parent's height cap, then scroll
	} = $props();

	const flipDurationMs = 150;

	// Follows `open`, but is overwritten while a drag is in flight.
	let zone = $derived(open);

	const planned = $derived(open.reduce((sum, item) => sum + (item.estimate_minutes ?? 0), 0));
	const unestimated = $derived(open.filter((item) => item.estimate_minutes === null).length);

	function consider(e: CustomEvent<DndEvent<ActionItemRecord>>) {
		zone = e.detail.items;
	}

	function finalize(e: CustomEvent<DndEvent<ActionItemRecord>>) {
		zone = e.detail.items;
		const { id, trigger } = e.detail.info;
		// Fires in the receiving zone for both cross-zone drops and in-zone reorders.
		// Placement is "after this visible item", so it stays right when a
		// project filter hides some of the container's items.
		if (trigger === TRIGGERS.DROPPED_INTO_ZONE) {
			const at = zone.findIndex((item) => item.id === id);
			board.actions.move(id, date, zone[at - 1]?.id ?? null);
		}
	}

	let draft = $state('');

	function add(e: SubmitEvent) {
		e.preventDefault();
		const title = draft.trim();
		if (!title) return;
		board.actions.create(title, date);
		draft = '';
	}
</script>

<section
	class={[
		'flex min-h-0 flex-col rounded-xl border',
		highlight ? 'border-foreground/15 bg-card shadow-xs' : 'border-border/70 bg-muted/40'
	]}
>
	<header class="flex items-baseline gap-2 px-3 pt-3 pb-2 whitespace-nowrap">
		<h2 class="truncate text-sm font-medium">{title}</h2>
		{#if detail}<span class="text-xs text-muted-foreground">{detail}</span>{/if}
		{#if open.length > 0}
			<span
				class="ml-auto flex items-baseline gap-1.5 text-xs text-muted-foreground tabular-nums"
				title="{formatMinutes(planned || 0)} estimated{unestimated
					? `; ${unestimated} item${unestimated === 1 ? '' : 's'} without an estimate`
					: ''}"
			>
				{#if planned}{formatMinutes(planned)}{/if}
				{#if unestimated}
					<span class="rounded border border-dashed border-muted-foreground/40 px-1 leading-4">
						+{unestimated}
					</span>
				{/if}
			</span>
		{/if}
	</header>

	<div class={['overflow-y-auto px-2', fill ? 'min-h-0' : 'max-h-104']}>
		<ul
			class={[
				'flex min-h-12 flex-col gap-2 rounded-lg transition-colors',
				zone.length === 0 && 'border border-dashed border-border'
			]}
			aria-label={title}
			use:dndzone={{
				items: zone,
				flipDurationMs,
				type: 'action-item',
				dropTargetStyle: {},
				dropTargetClasses: ['bg-muted'],
				delayTouchStart: true
			}}
			onconsider={consider}
			onfinalize={finalize}
		>
			{#each zone as item (item.id)}
				<li animate:flip={{ duration: flipDurationMs }}>
					<ItemCard {item} {board} />
				</li>
			{/each}
		</ul>

		{#if done.length > 0}
			<ul class="mt-2 flex flex-col gap-2" aria-label="{title}: done">
				{#each done as item (item.id)}
					<li><ItemCard {item} {board} /></li>
				{/each}
			</ul>
		{/if}
	</div>

	<form onsubmit={add} class="px-3 pt-1 pb-2">
		<input
			bind:value={draft}
			placeholder="Add item"
			aria-label="Add item to {title}"
			class="w-full rounded-md py-1.5 text-sm placeholder:text-muted-foreground/60 focus:placeholder:text-muted-foreground focus:outline-none"
		/>
	</form>
</section>
