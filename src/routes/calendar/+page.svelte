<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import LockIcon from '@lucide/svelte/icons/lock';
	import SlidersIcon from '@lucide/svelte/icons/sliders-horizontal';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button';
	import { addDays, formatAgo, mondayOf } from '$lib/dates';
	import { manifestOf } from '$lib/integrations/registry';
	import { formatMinutes } from '$lib/durations';
	import { actionItemsApi } from '$lib/features/action-items/api';
	import type { ActionItemRecord } from '$lib/features/action-items/schema';
	import WeekCalendar from '$lib/features/calendar/components/WeekCalendar.svelte';
	import { contextStyles } from '$lib/features/calendar/contexts';
	import { planFor } from '$lib/features/calendar/plan';
	import SettingsDialog from '$lib/features/planner/components/SettingsDialog.svelte';
	import type { PlannerSettings } from '$lib/features/planner/schema';

	let { data } = $props();

	// Re-plan every minute, so today's plan always starts from now.
	let now = $state(new Date());
	onMount(() => {
		const timer = setInterval(() => (now = new Date()), 60_000);
		return () => clearInterval(timer);
	});

	const calendarConnections = $derived(
		data.integrations.connections.filter(
			(c) => manifestOf(c.integration_id)?.category === 'calendar'
		)
	);

	const days = $derived(Array.from({ length: 7 }, (_, i) => addDays(data.week, i)));
	const items = $derived(new Map(data.items.map((i) => [i.id, i])));
	const plans = $derived(
		new Map(
			days.map((day) => [
				day,
				planFor(day, {
					today: data.today,
					now,
					items: data.items,
					events: data.events,
					settings: data.settings
				})
			])
		)
	);
	const styleOf = $derived(contextStyles(data.projects));

	// Contexts that appear this week, for the legend.
	const legend = $derived(
		[
			...new Set(
				[...plans.values()].flatMap(
					(p) => p?.blocks.flatMap((b) => (b.kind === 'task' ? [b.context] : [])) ?? []
				)
			)
		].map(styleOf)
	);
	const week = $derived(
		[...plans.values()].reduce(
			(sum, p) => ({
				planned: sum.planned + (p?.planned_minutes ?? 0),
				switches: sum.switches + (p?.switches ?? 0),
				overflow: sum.overflow + (p?.overflow.length ?? 0)
			}),
			{ planned: 0, switches: 0, overflow: 0 }
		)
	);

	// "Sep 28 – Oct 4, 2026"
	const title = $derived.by(() => {
		const fmt = (day: string, opts: Intl.DateTimeFormatOptions) =>
			new Date(`${day}T00:00:00Z`).toLocaleDateString('en-US', {
				month: 'short',
				day: 'numeric',
				timeZone: 'UTC',
				...opts
			});
		return `${fmt(data.week, {})} – ${fmt(addDays(data.week, 6), { year: 'numeric' })}`;
	});

	const thisWeek = $derived(mondayOf(data.today));
	let editingSettings = $state(false);

	async function run(action: Promise<unknown>) {
		try {
			await action;
		} catch (e) {
			toast.error((e as Error).message);
		}
		await invalidateAll();
	}

	const complete = (item: ActionItemRecord) => run(actionItemsApi.complete(item.id));

	async function saveSettings(settings: PlannerSettings) {
		editingSettings = false;
		await run(
			fetch('/api/planner/settings', {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(settings)
			}).then(async (res) => {
				if (!res.ok) throw new Error((await res.json()).message);
			})
		);
	}
</script>

<svelte:head><title>Calendar</title></svelte:head>

<main class="px-6 py-6 sm:px-8">
	<header class="mb-5 flex flex-wrap items-end justify-between gap-3">
		<div>
			<p class="text-sm text-muted-foreground">
				{#if week.planned}
					{formatMinutes(week.planned)} of focused work planned · {week.switches} context switch{week.switches ===
					1
						? ''
						: 'es'}
				{:else}
					Tasks scheduled on a day are planned into it automatically
				{/if}
			</p>
			<h1 class="text-2xl font-semibold tracking-tight">{title}</h1>
		</div>
		<div class="flex items-center gap-1">
			<Button
				variant="ghost"
				size="icon-sm"
				href="?week={addDays(data.week, -7)}"
				aria-label="Previous week"
			>
				<ChevronLeftIcon />
			</Button>
			<Button variant="outline" size="sm" href="?week={thisWeek}" disabled={data.week === thisWeek}>
				Today
			</Button>
			<Button
				variant="ghost"
				size="icon-sm"
				href="?week={addDays(data.week, 7)}"
				aria-label="Next week"
			>
				<ChevronRightIcon />
			</Button>
			<Button variant="ghost" size="sm" class="ml-2" onclick={() => (editingSettings = true)}>
				<SlidersIcon />Planning
			</Button>
		</div>
	</header>

	<WeekCalendar
		{days}
		today={data.today}
		{now}
		{plans}
		{items}
		events={data.events}
		settings={data.settings}
		{styleOf}
		oncomplete={complete}
	/>

	<footer class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
		{#each legend as entry (entry.label)}
			<span class="flex items-center gap-1.5">
				<span class="size-2 rounded-full" style:background={entry.color}></span>{entry.label}
			</span>
		{/each}
		<span class="flex items-center gap-1.5">
			<span class="h-2.5 w-4 rounded-sm border border-dashed border-border"></span>Break
		</span>
		<span class="flex items-center gap-1.5">
			<span
				class="h-2.5 w-4 rounded-sm bg-[repeating-linear-gradient(135deg,var(--border)_0_2px,transparent_2px_5px)]"
			></span>Switch buffer
		</span>
		<span class="flex items-center gap-1.5">
			<span class="h-2.5 w-4 rounded-sm border border-dashed border-foreground/30"></span>No
			estimate (assumed)
		</span>
		<span class="flex items-center gap-1.5">
			<span class="h-2.5 w-4 rounded-sm bg-foreground/80"></span>Event
			<LockIcon class="size-3" />read-only
		</span>
		<span class="ml-auto flex flex-wrap items-center gap-x-3">
			{#each calendarConnections as c (c.id)}
				<span class={[c.status === 'error' && 'text-destructive']} title={c.last_error ?? ''}>
					{manifestOf(c.integration_id)?.name} · {c.account_label} ·
					{c.status === 'error'
						? 'needs attention'
						: c.last_synced_at
							? `synced ${formatAgo(c.last_synced_at, now)}`
							: 'syncing…'}
				</span>
			{:else}
				<a href="?week={data.week}&panel=integrations" class="underline-offset-2 hover:underline">
					Connect a calendar to plan around your events
				</a>
			{/each}
		</span>
	</footer>
</main>

{#if editingSettings}
	<SettingsDialog
		settings={data.settings}
		onsave={saveSettings}
		onclose={() => (editingSettings = false)}
	/>
{/if}
