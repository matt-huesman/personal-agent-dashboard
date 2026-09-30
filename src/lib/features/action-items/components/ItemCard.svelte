<script lang="ts">
	import ArrowUpRightIcon from '@lucide/svelte/icons/arrow-up-right';
	import CheckIcon from '@lucide/svelte/icons/check';
	import ClockIcon from '@lucide/svelte/icons/clock';
	import EllipsisIcon from '@lucide/svelte/icons/ellipsis';
	import PinIcon from '@lucide/svelte/icons/pin';
	import RepeatIcon from '@lucide/svelte/icons/repeat';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { formatClock, formatDay, weekdayName } from '$lib/dates';
	import { DURATION_PRESETS, formatMinutes } from '$lib/durations';
	import { projectColors } from '$lib/features/projects/colors';
	import { can } from '../transitions';
	import type { ActionItemRecord } from '../schema';
	import type { BoardContext } from './Board.svelte';

	let {
		item,
		board,
		showDate = false
	}: { item: ActionItemRecord; board: BoardContext; showDate?: boolean } = $props();

	const { actions } = $derived(board);
	const done = $derived(item.status === 'done');
	const overdue = $derived(!done && item.due_date !== null && item.due_date < board.today);
	const project = $derived(item.project_id ? board.projects.get(item.project_id) : undefined);
	const color = $derived(project ? projectColors[project.color] : undefined);
</script>

{#snippet dot(color: string)}
	<span class="size-2 shrink-0 rounded-full" style:background={color}></span>
{/snippet}

<div
	class={[
		'group flex items-start gap-3 rounded-lg border border-border/70 bg-card py-2.5 pr-2 pl-3 transition-colors hover:border-foreground/20',
		color && 'border-l-[3px]'
	]}
	style:border-left-color={color}
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

		<div class="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
			<!-- Estimate: one click to set, so every item gets one. -->
			<DropdownMenu.Root>
				<DropdownMenu.Trigger
					class={[
						'inline-flex items-center gap-1 rounded px-1 -mx-1 hover:bg-muted hover:text-foreground',
						item.estimate_minutes === null &&
							!done &&
							'border border-dashed border-muted-foreground/40 text-muted-foreground/80'
					]}
					aria-label="Set estimate"
				>
					<ClockIcon class="size-3" />
					{item.estimate_minutes === null ? 'Estimate' : formatMinutes(item.estimate_minutes)}
				</DropdownMenu.Trigger>
				<DropdownMenu.Content align="start" class="w-36">
					{#each DURATION_PRESETS as minutes (minutes)}
						<DropdownMenu.Item onSelect={() => actions.update(item, { estimate_minutes: minutes })}>
							{formatMinutes(minutes)}
							{#if minutes === item.estimate_minutes}<CheckIcon class="ml-auto size-3.5" />{/if}
						</DropdownMenu.Item>
					{/each}
					<DropdownMenu.Separator />
					<DropdownMenu.Item onSelect={() => actions.edit(item)}>Custom…</DropdownMenu.Item>
					{#if item.estimate_minutes !== null}
						<DropdownMenu.Item onSelect={() => actions.update(item, { estimate_minutes: null })}>
							Clear
						</DropdownMenu.Item>
					{/if}
				</DropdownMenu.Content>
			</DropdownMenu.Root>

			{#if project && color}
				<span class="inline-flex min-w-0 items-center gap-1.5">
					{@render dot(color)}<span class="truncate">{project.name}</span>
				</span>
			{/if}
			{#if item.pinned_start !== null}
				<span class="inline-flex items-center gap-1" title="Pinned time (set on the calendar)">
					<PinIcon class="size-3" />{formatClock(item.pinned_start, true)}
				</span>
			{/if}
			{#if item.sticky && item.scheduled_date}
				<span class="inline-flex items-center gap-1" title="Repeats every week">
					<RepeatIcon class="size-3" />{weekdayName(item.scheduled_date)}s
				</span>
			{/if}
			{#if showDate && item.scheduled_date}
				<span>{formatDay(item.scheduled_date, board.today)}</span>
			{/if}
			{#if item.due_date}
				<span class={[overdue && 'text-destructive']}>
					Due {formatDay(item.due_date, board.today)}
				</span>
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
	</div>

	<DropdownMenu.Root>
		<DropdownMenu.Trigger
			class="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground focus-visible:opacity-100 data-[state=open]:opacity-100"
			aria-label="Item actions"
		>
			<EllipsisIcon class="size-4" />
		</DropdownMenu.Trigger>
		<DropdownMenu.Content align="end" class="w-48">
			<DropdownMenu.Item onSelect={() => actions.edit(item)}>Edit</DropdownMenu.Item>
			{#if can('move', item.status)}
				<DropdownMenu.Sub>
					<DropdownMenu.SubTrigger>Move to</DropdownMenu.SubTrigger>
					<DropdownMenu.SubContent>
						{#each board.destinations as destination (destination.date)}
							<DropdownMenu.Item
								disabled={destination.date === item.scheduled_date}
								onSelect={() => actions.move(item.id, destination.date, null)}
							>
								{destination.label}
							</DropdownMenu.Item>
						{/each}
					</DropdownMenu.SubContent>
				</DropdownMenu.Sub>
			{/if}
			<DropdownMenu.CheckboxItem
				checked={item.sticky}
				disabled={item.scheduled_date === null}
				onCheckedChange={(sticky) => actions.update(item, { sticky })}
			>
				Repeat weekly
			</DropdownMenu.CheckboxItem>
			<DropdownMenu.Sub>
				<DropdownMenu.SubTrigger>Project</DropdownMenu.SubTrigger>
				<DropdownMenu.SubContent class="w-48">
					<DropdownMenu.Item onSelect={() => actions.update(item, { project_id: null })}>
						None
						{#if !item.project_id}<CheckIcon class="ml-auto size-3.5" />{/if}
					</DropdownMenu.Item>
					{#each board.projects.values() as option (option.id)}
						<DropdownMenu.Item onSelect={() => actions.update(item, { project_id: option.id })}>
							{@render dot(projectColors[option.color])}
							<span class="truncate">{option.name}</span>
							{#if option.id === item.project_id}<CheckIcon class="ml-auto size-3.5" />{/if}
						</DropdownMenu.Item>
					{/each}
					<DropdownMenu.Separator />
					<DropdownMenu.Item>
						{#snippet child({ props })}
							<a href="/projects" {...props}>Manage projects…</a>
						{/snippet}
					</DropdownMenu.Item>
				</DropdownMenu.SubContent>
			</DropdownMenu.Sub>
			<DropdownMenu.Separator />
			<DropdownMenu.Item variant="destructive" onSelect={() => actions.remove(item)}>
				Delete
			</DropdownMenu.Item>
		</DropdownMenu.Content>
	</DropdownMenu.Root>
</div>
