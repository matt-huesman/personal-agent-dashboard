<script lang="ts">
	import ArrowUpRightIcon from '@lucide/svelte/icons/arrow-up-right';
	import LockIcon from '@lucide/svelte/icons/lock';
	import * as Popover from '$lib/components/ui/popover';
	import { formatClock } from '$lib/dates';
	import type { TimedEvent } from '../plan';
	import type { CalendarEvent } from '../source';

	// A synced calendar event: solid when it blocks time, outlined when "free".
	// A lock marks read-only sources (all of them, today).
	let {
		timed,
		event,
		top,
		height,
		compact = false
	}: {
		timed?: TimedEvent; // timed events (positioned); omit for all-day chips
		event: CalendarEvent;
		top?: number;
		height?: number;
		compact?: boolean;
	} = $props();

	const when = $derived(
		timed ? `${formatClock(timed.start)}–${formatClock(timed.end, true)}` : 'All day'
	);
	const position = $derived(
		timed
			? `top: ${top}px; height: ${height}px; left: calc(${(timed.lane / timed.lanes) * 100}% + 2px); width: calc(${100 / timed.lanes}% - 4px);`
			: ''
	);
</script>

<Popover.Root>
	<Popover.Trigger
		class={[
			'overflow-hidden rounded-md px-1.5 text-left text-xs focus-visible:ring-2 focus-visible:ring-ring',
			timed ? 'absolute' : 'w-full truncate py-0.5',
			event.busy
				? 'bg-foreground/80 text-background hover:bg-foreground/90'
				: 'border border-foreground/30 bg-background/70 text-muted-foreground hover:bg-muted'
		]}
		style={position}
	>
		<span class="flex items-center gap-1">
			{#if event.read_only}<LockIcon class="size-2.5 shrink-0 opacity-70" />{/if}
			<span class="truncate font-medium">{event.title}</span>
		</span>
		{#if timed && !compact}
			<span class="block truncate text-[0.7rem] opacity-75 tabular-nums">{when}</span>
		{/if}
	</Popover.Trigger>
	<Popover.Content align="start" class="w-72">
		<div class="flex flex-col gap-3 text-sm">
			<p class="leading-snug font-medium">{event.title}</p>
			<dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
				<dt class="text-muted-foreground">When</dt>
				<dd class="tabular-nums">{when}</dd>
				<dt class="text-muted-foreground">Calendar</dt>
				<dd>{event.calendar_name}</dd>
				<dt class="text-muted-foreground">From</dt>
				<dd class="flex items-center gap-1">
					{event.source}
					{#if event.read_only}<span class="inline-flex items-center gap-0.5 text-muted-foreground"
							>· <LockIcon class="size-3" />read-only</span
						>{/if}
				</dd>
				{#if !event.busy}
					<dt class="text-muted-foreground">Shows as</dt>
					<dd>Free, so tasks can be planned over it</dd>
				{/if}
			</dl>
			{#if event.url}
				<a
					href={event.url}
					target="_blank"
					rel="noreferrer"
					class="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
				>
					Open in {event.source}<ArrowUpRightIcon class="size-3" />
				</a>
			{/if}
		</div>
	</Popover.Content>
</Popover.Root>
