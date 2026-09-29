<script lang="ts">
	import * as Popover from '$lib/components/ui/popover';
	import { formatClock, minutesInto } from '$lib/dates';
	import { formatMinutes } from '$lib/durations';
	import type { ActionItemRecord } from '$lib/features/action-items/schema';
	import type { DayPlan } from '$lib/features/planner/planner';
	import type { PlannerSettings } from '$lib/features/planner/schema';
	import type { ContextStyle } from '../contexts';
	import TimelineBlock from './TimelineBlock.svelte';

	let {
		days,
		today,
		now,
		plans,
		items,
		settings,
		styleOf,
		oncomplete
	}: {
		days: string[];
		today: string;
		now: Date;
		plans: Map<string, DayPlan | null>; // null = a past day
		items: Map<string, ActionItemRecord>;
		settings: PlannerSettings;
		styleOf: (context: string) => ContextStyle;
		oncomplete: (item: ActionItemRecord) => void;
	} = $props();

	const PX = 1.2; // pixels per minute (72px per hour)

	// Show the working day with an hour of margin, stretched to fit any events.
	const range = $derived.by(() => {
		const busy = [...plans.values()].flatMap(
			(p) => p?.blocks.filter((b) => b.kind === 'busy') ?? []
		);
		const start = Math.min(settings.day_start, ...busy.map((b) => b.start)) - 60;
		const end = Math.max(settings.day_end, ...busy.map((b) => b.end)) + 60;
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

<div class="overflow-x-auto rounded-xl border bg-card">
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
			<!-- Routine blocks (lunch) only on days with planned work, to keep empty days clean. -->
			{@const blocks = plan?.blocks.filter((b) => working || b.kind !== 'reserved') ?? []}
			<div
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

				{#each blocks as block, i (i)}
					<TimelineBlock
						{block}
						top={y(block.start)}
						height={Math.max((block.end - block.start) * PX, 3)}
						item={block.kind === 'task' ? items.get(block.task_id) : undefined}
						style={block.kind === 'task' ? styleOf(block.context) : undefined}
						{oncomplete}
					/>
				{/each}

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
