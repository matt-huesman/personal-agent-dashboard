<script lang="ts">
	import ArrowUpRightIcon from '@lucide/svelte/icons/arrow-up-right';
	import CheckIcon from '@lucide/svelte/icons/check';
	import EllipsisIcon from '@lucide/svelte/icons/ellipsis';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { formatDay } from '$lib/dates';
	import { can } from '../transitions';
	import type { ActionItemRecord } from '../schema';
	import type { BoardActions, Destination } from './Board.svelte';

	let {
		item,
		today,
		actions,
		destinations,
		showDate = false
	}: {
		item: ActionItemRecord;
		today: string;
		actions: BoardActions;
		destinations: Destination[];
		showDate?: boolean;
	} = $props();

	const done = $derived(item.status === 'done');
	const overdue = $derived(!done && item.due_date !== null && item.due_date < today);
	const hasMeta = $derived(
		(showDate && item.scheduled_date) ||
			item.due_date ||
			item.priority !== 'normal' ||
			item.links.length > 0
	);
</script>

<div
	class="group flex items-start gap-3 rounded-lg border border-border/70 bg-card px-3 py-2.5 transition-colors hover:border-foreground/20"
>
	<button
		type="button"
		class={[
			'mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border transition-colors',
			done
				? 'border-foreground/70 bg-foreground/70 text-background'
				: 'border-muted-foreground/50 hover:border-foreground'
		]}
		aria-label={done ? 'Mark not done' : 'Mark done'}
		onclick={() => (can('reopen', item.status) ? actions.reopen(item) : actions.complete(item))}
	>
		{#if done}<CheckIcon class="size-3" strokeWidth={3} />{/if}
	</button>

	<div class="min-w-0 flex-1">
		<button
			type="button"
			class={[
				'block w-full text-left text-sm leading-snug',
				done && 'text-muted-foreground line-through'
			]}
			onclick={() => actions.edit(item)}
		>
			{item.title}
		</button>

		{#if hasMeta}
			<div
				class="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-muted-foreground"
			>
				{#if showDate && item.scheduled_date}
					<span>{formatDay(item.scheduled_date, today)}</span>
				{/if}
				{#if item.due_date}
					<span class={[overdue && 'text-destructive']}>Due {formatDay(item.due_date, today)}</span>
				{/if}
				{#if item.priority !== 'normal'}
					<span class={[item.priority === 'high' && 'font-medium text-amber-700']}>
						{item.priority === 'high' ? 'High' : 'Low'}
					</span>
				{/if}
				{#each item.links as link (link.url)}
					<a
						href={link.url}
						target="_blank"
						rel="noreferrer"
						class="inline-flex items-center gap-0.5 hover:text-foreground"
					>
						{link.label ?? 'Link'}<ArrowUpRightIcon class="size-3" />
					</a>
				{/each}
			</div>
		{/if}
	</div>

	<DropdownMenu.Root>
		<DropdownMenu.Trigger
			class="-mr-1 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground focus-visible:opacity-100 data-[state=open]:opacity-100"
			aria-label="Item actions"
		>
			<EllipsisIcon class="size-4" />
		</DropdownMenu.Trigger>
		<DropdownMenu.Content align="end" class="w-44">
			<DropdownMenu.Item onSelect={() => actions.edit(item)}>Edit</DropdownMenu.Item>
			{#if can('move', item.status)}
				<DropdownMenu.Sub>
					<DropdownMenu.SubTrigger>Move to</DropdownMenu.SubTrigger>
					<DropdownMenu.SubContent>
						{#each destinations as destination (destination.date)}
							<DropdownMenu.Item
								disabled={destination.date === item.scheduled_date}
								onSelect={() => actions.move(item.id, destination.date, 0)}
							>
								{destination.label}
							</DropdownMenu.Item>
						{/each}
					</DropdownMenu.SubContent>
				</DropdownMenu.Sub>
			{/if}
			<DropdownMenu.Separator />
			<DropdownMenu.Item variant="destructive" onSelect={() => actions.remove(item)}>
				Delete
			</DropdownMenu.Item>
		</DropdownMenu.Content>
	</DropdownMenu.Root>
</div>
