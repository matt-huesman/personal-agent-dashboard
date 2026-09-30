<script lang="ts">
	import * as Popover from '$lib/components/ui/popover';
	import { formatClock, minutesInto } from '$lib/dates';
	import { formatMinutes } from '$lib/durations';
	import type { ActionItemRecord } from '$lib/features/action-items/schema';
	import type { DayPlan } from '$lib/features/planner/planner';
	import type { PlannerSettings } from '$lib/features/planner/schema';
	import type { ContextStyle } from '../contexts';
	import { allDayOn, timedOn } from '../plan';
	import type { CalendarEvent } from '../source';
	import EventBlock from './EventBlock.svelte';
	import TimelineBlock from './TimelineBlock.svelte';

	let {
		days,
		today,
		now,
		plans,
		items,
		events,
		settings,
		styleOf,
		oncomplete,
		onpin,
		onunpin,
		class: className
	}: {
		days: string[];
		today: string;
		now: Date;
		plans: Map<string, DayPlan | null>; // null = a past day
		items: Map<string, ActionItemRecord>;
		events: CalendarEvent[]; // from connected calendars
		settings: PlannerSettings;
		styleOf: (context: string) => ContextStyle;
		oncomplete: (item: ActionItemRecord) => void;
		onpin: (item: ActionItemRecord, day: string, start: number) => void;
		onunpin: (item: ActionItemRecord) => void;
		class?: string; // sizes the scroll container; the grid scrolls inside it
	} = $props();

	// --- Dragging task blocks to pin them ----------------------------------------
	// Press and move past a few pixels to drag; the preview snaps to 15 minutes
	// and can change day (not into the past). A plain click still opens the
	// block's details. Esc cancels.

	const SNAP = 15;
	const THRESHOLD = 4; // px of movement before a press becomes a drag
	const columns: Record<string, HTMLElement> = $state({});

	type Drag = {
		item: ActionItemRecord;
		color: string; // its context colour, for the preview
		duration: number;
		grabOffset: number; // minutes between the block's start and the pointer
		from: { x: number; y: number };
		moved: boolean;
		day: string;
		start: number;
	};
	let drag = $state<Drag | null>(null);

	function grab(
		e: PointerEvent,
		block: { start: number; context: string },
		item: ActionItemRecord,
		day: string
	) {
		if (e.button !== 0) return;
		const duration = item.estimate_minutes ?? settings.default_estimate_minutes;
		const column = columns[day].getBoundingClientRect();
		drag = {
			item,
			color: styleOf(block.context).color,
			duration,
			grabOffset: range.start + (e.clientY - column.top) / PX - block.start,
			from: { x: e.clientX, y: e.clientY },
			moved: false,
			day,
			start: block.start
		};
		window.addEventListener('pointermove', follow);
		window.addEventListener('pointerup', drop, { once: true });
		window.addEventListener('keydown', cancelOnEscape);
	}

	function follow(e: PointerEvent) {
		if (!drag) return;
		if (!drag.moved && Math.hypot(e.clientX - drag.from.x, e.clientY - drag.from.y) < THRESHOLD)
			return;
		drag.moved = true;
		const day = days.find((d) => {
			if (d < today) return false;
			const r = columns[d].getBoundingClientRect();
			return e.clientX >= r.left && e.clientX < r.right;
		});
		if (!day) return;
		const minute =
			range.start + (e.clientY - columns[day].getBoundingClientRect().top) / PX - drag.grabOffset;
		drag.day = day;
		drag.start = Math.min(Math.max(0, Math.round(minute / SNAP) * SNAP), 24 * 60 - drag.duration);
	}

	function drop() {
		const done = drag;
		stop();
		if (!done?.moved) return; // a click: let the popover open
		// The click that follows this pointerup would open the popover; swallow it.
		window.addEventListener('click', (e) => e.stopPropagation(), { capture: true, once: true });
		const unchanged =
			done.day === done.item.scheduled_date && done.start === done.item.pinned_start;
		if (!unchanged) onpin(done.item, done.day, done.start);
	}

	function cancelOnEscape(e: KeyboardEvent) {
		if (e.key === 'Escape') stop();
	}

	function stop() {
		drag = null;
		window.removeEventListener('pointermove', follow);
		window.removeEventListener('pointerup', drop);
		window.removeEventListener('keydown', cancelOnEscape);
	}

	const PX = 1.2; // pixels per minute (72px per hour)

	const timed = $derived(new Map(days.map((day) => [day, timedOn(day, events)])));
	const allDay = $derived(new Map(days.map((day) => [day, allDayOn(day, events)])));

	// Show the working day with an hour of margin, stretched to fit any events.
	const range = $derived.by(() => {
		const spans = [...timed.values()].flat();
		const start = Math.min(settings.day_start, ...spans.map((t) => t.start)) - 60;
		const end = Math.max(settings.day_end, ...spans.map((t) => t.end)) + 60;
		return {
			start: Math.max(0, Math.floor(start / 60) * 60),
			end: Math.min(1440, Math.ceil(end / 60) * 60)
		};
	});
	const hours = $derived(
		Array.from({ length: (range.end - range.start) / 60 }, (_, i) => range.start + i * 60)
	);
	const y = (minute: number) => (minute - range.start) * PX;
	const nowMinute = $derived(minutesInto(today, now));

	const header = (day: string) => {
		const d = new Date(`${day}T00:00:00Z`);
		return {
			weekday: d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
			date: d.getUTCDate()
		};
	};
</script>

<div class={['overflow-auto rounded-xl border bg-card', className]}>
	<div class="grid min-w-[52rem] grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]">
		<!-- Header row -->
		<div class="sticky top-0 z-20 border-b bg-card"></div>
		{#each days as day (day)}
			{@const h = header(day)}
			{@const plan = plans.get(day)}
			<div class="sticky top-0 z-20 border-b border-l bg-card px-2 py-2">
				<div class="flex items-baseline gap-1.5">
					<span class="text-xs text-muted-foreground">{h.weekday}</span>
					<span
						class={[
							'grid size-6 place-items-center rounded-full text-sm font-medium',
							day === today && 'bg-foreground text-background'
						]}
					>
						{h.date}
					</span>
				</div>
				<div
					class="mt-1 flex min-h-5 flex-wrap items-center gap-1.5 text-[0.7rem] text-muted-foreground"
				>
					{#if plan && plan.planned_minutes > 0}
						<span class="tabular-nums" title="Planned focus time / daily capacity">
							{formatMinutes(plan.planned_minutes)}
						</span>
					{/if}
					{#if plan && plan.overflow.length > 0}
						<Popover.Root>
							<Popover.Trigger
								class="rounded border border-dashed border-destructive/50 px-1 text-destructive hover:bg-destructive/5"
							>
								{plan.overflow.length} won't fit
							</Popover.Trigger>
							<Popover.Content align="start" class="w-72 text-sm">
								<p class="mb-2 font-medium">Doesn't fit this day</p>
								<ul class="flex flex-col gap-1.5">
									{#each plan.overflow as over (over.task_id)}
										<li class="flex justify-between gap-3">
											<span class="truncate">{items.get(over.task_id)?.title}</span>
											<span class="shrink-0 text-xs text-muted-foreground tabular-nums">
												{formatMinutes(over.minutes)}
											</span>
										</li>
									{/each}
								</ul>
								<p class="mt-3 text-xs text-muted-foreground">
									Past your working hours or daily focus limit. Move these to another day on the
									board, or adjust Planning.
								</p>
							</Popover.Content>
						</Popover.Root>
					{/if}
				</div>
				{#if allDay.get(day)?.length}
					<div class="mt-1.5 flex flex-col gap-0.5">
						{#each allDay.get(day) ?? [] as event (event.id)}
							<EventBlock {event} />
						{/each}
					</div>
				{/if}
			</div>
		{/each}

		<!-- Hour gutter -->
		<div class="relative" style="height: {y(range.end)}px">
			{#each hours as hour (hour)}
				{#if hour > range.start}
					<span
						class="absolute right-2 -translate-y-1/2 text-[0.65rem] text-muted-foreground tabular-nums"
						style="top: {y(hour)}px"
					>
						{formatClock(hour, true).replace(':00', '')}
					</span>
				{/if}
			{/each}
		</div>

		<!-- Day columns -->
		{#each days as day (day)}
			{@const plan = plans.get(day)}
			{@const working = plan?.blocks.some((b) => b.kind === 'task') ?? false}
			<!-- Routine blocks (lunch) only on days with planned work, to keep empty days clean.
			     Busy blocks are drawn from the events themselves (below), not from the plan. -->
			{@const blocks =
				plan?.blocks.filter((b) => b.kind !== 'busy' && (working || b.kind !== 'reserved')) ?? []}
			<div
				bind:this={columns[day]}
				class={['relative border-l', day < today && 'bg-muted/40']}
				style="height: {y(
					range.end
				)}px; background-image: linear-gradient(to bottom, var(--border) 1px, transparent 1px); background-size: 100% {60 *
					PX}px;"
			>
				<!-- Outside working hours -->
				<div
					class="absolute inset-x-0 top-0 bg-muted/50"
					style="height: {y(settings.day_start)}px"
				></div>
				<div
					class="absolute inset-x-0 bottom-0 bg-muted/50"
					style="top: {y(settings.day_end)}px"
				></div>

				{#each timed.get(day) ?? [] as t (t.event.id)}
					<EventBlock
						timed={t}
						event={t.event}
						top={y(t.start)}
						height={Math.max((t.end - t.start) * PX, 14)}
						compact={(t.end - t.start) * PX < 30}
					/>
				{/each}

				{#each blocks as block, i (i)}
					{@const item = block.kind === 'task' ? items.get(block.task_id) : undefined}
					<TimelineBlock
						{block}
						top={y(block.start)}
						height={Math.max((block.end - block.start) * PX, 3)}
						{item}
						style={block.kind === 'task' ? styleOf(block.context) : undefined}
						dragging={!!drag?.moved && drag.item.id === item?.id}
						ongrab={item && block.kind === 'task' ? (e) => grab(e, block, item, day) : undefined}
						{oncomplete}
						{onunpin}
					/>
				{/each}

				<!-- Where a dragged task will land. -->
				{#if drag?.moved && drag.day === day}
					<div
						class="pointer-events-none absolute inset-x-1 z-20 rounded-md border-2 border-dashed px-1.5 py-1 text-xs shadow-sm"
						style="top: {y(drag.start)}px; height: {drag.duration *
							PX}px; border-color: {drag.color}; background: color-mix(in oklab, {drag.color} 22%, var(--background));"
					>
						<span class="block truncate font-medium">{drag.item.title}</span>
						<span class="block text-[0.7rem] text-muted-foreground tabular-nums">
							{formatClock(drag.start)}–{formatClock(drag.start + drag.duration, true)}
						</span>
					</div>
				{/if}

				{#if day === today && nowMinute >= range.start && nowMinute <= range.end}
					<div class="pointer-events-none absolute inset-x-0 z-10" style="top: {y(nowMinute)}px">
						<div class="h-px bg-destructive"></div>
						<div class="absolute -top-1 -left-1 size-2 rounded-full bg-destructive"></div>
					</div>
				{/if}
			</div>
		{/each}
	</div>
</div>
