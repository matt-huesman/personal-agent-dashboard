<script lang="ts">
	import { flip } from 'svelte/animate';
	import { dndzone, TRIGGERS, type DndEvent } from 'svelte-dnd-action';
	import ItemCard from './ItemCard.svelte';
	import type { ActionItemRecord } from '../schema';
	import type { BoardActions, Destination } from './Board.svelte';

	// One container — the pool (date null) or a day. Open items are a drop zone;
	// done items sit underneath and don't drag.
	let {
		title,
		detail,
		date,
		open,
		done,
		today,
		actions,
		destinations
	}: {
		title: string;
		detail?: string;
		date: string | null;
		open: ActionItemRecord[];
		done: ActionItemRecord[];
		today: string;
		actions: BoardActions;
		destinations: Destination[];
	} = $props();

	const flipDurationMs = 150;

	// Follows `open`, but is overwritten while a drag is in flight.
	let zone = $derived(open);

	function consider(e: CustomEvent<DndEvent<ActionItemRecord>>) {
		zone = e.detail.items;
	}

	function finalize(e: CustomEvent<DndEvent<ActionItemRecord>>) {
		zone = e.detail.items;
		const { id, trigger } = e.detail.info;
		// Fires in the receiving zone for both cross-zone drops and in-zone reorders.
		if (trigger === TRIGGERS.DROPPED_INTO_ZONE) {
			actions.move(
				id,
				date,
				zone.findIndex((item) => item.id === id)
			);
		}
	}

	let draft = $state('');

	function add(e: SubmitEvent) {
		e.preventDefault();
		const title = draft.trim();
		if (!title) return;
		actions.create(title, date);
		draft = '';
	}
</script>

<section class="flex flex-col gap-2">
	<header class="flex items-baseline justify-between px-1 pb-1">
		<h2 class="text-sm font-medium">{title}</h2>
		{#if detail}<span class="text-xs text-muted-foreground">{detail}</span>{/if}
	</header>

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
			dropTargetClasses: ['bg-muted/70'],
			delayTouchStart: true
		}}
		onconsider={consider}
		onfinalize={finalize}
	>
		{#each zone as item (item.id)}
			<li animate:flip={{ duration: flipDurationMs }}>
				<ItemCard {item} {today} {actions} {destinations} />
			</li>
		{/each}
	</ul>

	<form onsubmit={add}>
		<input
			bind:value={draft}
			placeholder="Add item"
			aria-label="Add item to {title}"
			class="w-full rounded-md px-1 py-1.5 text-sm placeholder:text-muted-foreground/60 focus:placeholder:text-muted-foreground focus:outline-none"
		/>
	</form>

	{#if done.length > 0}
		<ul class="flex flex-col gap-2" aria-label="{title}: done">
			{#each done as item (item.id)}
				<li><ItemCard {item} {today} {actions} {destinations} /></li>
			{/each}
		</ul>
	{/if}
</section>
