<script lang="ts" module>
	/** Day columns shown, starting today. Items scheduled beyond them appear under "Later". */
	export const BOARD_DAYS = 7;

	export type Destination = { label: string; date: string | null };

	export type BoardActions = {
		create: (title: string, scheduled_date: string | null) => void;
		move: (id: string, scheduled_date: string | null, index: number) => void;
		complete: (item: ActionItemRecord) => void;
		reopen: (item: ActionItemRecord) => void;
		edit: (item: ActionItemRecord) => void;
		remove: (item: ActionItemRecord) => void;
	};
</script>

<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { addDays, formatDay } from '$lib/dates';
	import { actionItemsApi as api } from '../api';
	import { can } from '../transitions';
	import Column from './Column.svelte';
	import ItemCard from './ItemCard.svelte';
	import ItemDialog from './ItemDialog.svelte';
	import type { ActionItemRecord, UpdateActionItemInput } from '../schema';

	let { items, today }: { items: ActionItemRecord[]; today: string } = $props();

	const days = $derived(Array.from({ length: BOARD_DAYS }, (_, i) => addDays(today, i)));
	const lastDay = $derived(days[days.length - 1]);

	// Column headings: "Today" / "Tomorrow" / "Saturday", with the date beside.
	const dayTitle = (day: string) =>
		day === today || day === addDays(today, 1)
			? formatDay(day, today)
			: new Date(`${day}T00:00:00Z`).toLocaleDateString('en-US', {
					weekday: 'long',
					timeZone: 'UTC'
				});
	const shortDate = (day: string) =>
		new Date(`${day}T00:00:00Z`).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			timeZone: 'UTC'
		});

	const destinations = $derived<Destination[]>([
		{ label: 'Pool', date: null },
		...days.map((day) => ({ label: dayTitle(day), date: day }))
	]);

	// Items arrive ordered by position; done items sort by when they were finished.
	const openIn = (date: string | null) =>
		items.filter((i) => i.status !== 'done' && i.scheduled_date === date);
	const doneIn = (date: string | null) =>
		items
			.filter((i) => i.status === 'done' && i.scheduled_date === date)
			.sort((a, b) => (a.completed_at ?? '').localeCompare(b.completed_at ?? ''));
	const later = $derived(
		items
			.filter((i) => i.status !== 'done' && i.scheduled_date !== null && i.scheduled_date > lastDay)
			.sort((a, b) => a.scheduled_date!.localeCompare(b.scheduled_date!) || a.position - b.position)
	);

	let editing = $state<ActionItemRecord | null>(null);

	// Every mutation: call the API, then reload the board from the server. A
	// failure (network, 409 on a stale view) is shown and the reload resyncs.
	async function run(action: Promise<unknown>) {
		try {
			await action;
		} catch (e) {
			toast.error((e as Error).message);
		}
		await invalidateAll();
	}

	const actions: BoardActions = {
		create: (title, scheduled_date) => run(api.create({ title, scheduled_date })),
		move: (id, scheduled_date, index) => run(api.move(id, { scheduled_date, index })),
		complete: (item) => run(api.complete(item.id)),
		reopen: (item) => run(api.reopen(item.id)),
		edit: (item) => (editing = item),
		remove: async (item) => {
			await run(api.remove(item.id));
			toast('Deleted', {
				description: item.title,
				action: { label: 'Undo', onClick: () => run(api.restore(item.id)) }
			});
		}
	};

	async function save(
		item: ActionItemRecord,
		values: Required<UpdateActionItemInput>,
		day: string | null
	) {
		editing = null;
		await run(
			(async () => {
				await api.update(item.id, values);
				if (day !== item.scheduled_date && can('move', item.status)) {
					await api.move(item.id, { scheduled_date: day, index: 0 });
				}
			})()
		);
	}
</script>

<div class="flex flex-col gap-10 lg:flex-row lg:items-start">
	<div class="lg:sticky lg:top-8 lg:w-80 lg:shrink-0">
		<Column
			title="Pool"
			detail="Unscheduled"
			date={null}
			open={openIn(null)}
			done={doneIn(null)}
			{today}
			{actions}
			{destinations}
		/>
	</div>

	<div class="min-w-0 flex-1 overflow-x-auto pb-6">
		<div class="flex gap-6">
			{#each days as day (day)}
				<div class="w-64 shrink-0">
					<Column
						title={dayTitle(day)}
						detail={shortDate(day)}
						date={day}
						open={openIn(day)}
						done={doneIn(day)}
						{today}
						{actions}
						{destinations}
					/>
				</div>
			{/each}

			{#if later.length > 0}
				<section class="flex w-64 shrink-0 flex-col gap-2">
					<header class="px-1 pb-1"><h2 class="text-sm font-medium">Later</h2></header>
					<ul class="flex flex-col gap-2">
						{#each later as item (item.id)}
							<li><ItemCard {item} {today} {actions} {destinations} showDate /></li>
						{/each}
					</ul>
				</section>
			{/if}
		</div>
	</div>
</div>

{#if editing}
	{@const item = editing}
	<ItemDialog
		{item}
		onsave={(values, day) => save(item, values, day)}
		onclose={() => (editing = null)}
	/>
{/if}
