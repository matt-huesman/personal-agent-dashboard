<script lang="ts" module>
	import type { ProjectSummary } from '$lib/features/projects/schema';

	/** Day panels shown, starting today. Items scheduled beyond them appear under "Later". */
	export const BOARD_DAYS = 7;

	export type Destination = { label: string; date: string | null };

	export type BoardActions = {
		create: (title: string, scheduled_date: string | null) => void;
		/** Place `id` in a container just after `after` (null = at the top). */
		move: (id: string, scheduled_date: string | null, after: string | null) => void;
		update: (item: ActionItemRecord, patch: UpdateActionItemInput) => void;
		complete: (item: ActionItemRecord) => void;
		reopen: (item: ActionItemRecord) => void;
		edit: (item: ActionItemRecord) => void;
		remove: (item: ActionItemRecord) => void;
	};

	/** Everything a column or card needs from the board, passed as one prop. */
	export type BoardContext = {
		today: string;
		actions: BoardActions;
		destinations: Destination[];
		projects: Map<string, ProjectSummary>;
	};
</script>

<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { addDays, formatDay } from '$lib/dates';
	import { projectColors } from '$lib/features/projects/colors';
	import { actionItemsApi as api } from '../api';
	import { can } from '../transitions';
	import Column from './Column.svelte';
	import ItemCard from './ItemCard.svelte';
	import ItemDialog from './ItemDialog.svelte';
	import type { ActionItemRecord, UpdateActionItemInput } from '../schema';

	let {
		items,
		today,
		projects,
		projectFilter
	}: {
		items: ActionItemRecord[];
		today: string;
		projects: ProjectSummary[];
		projectFilter: string | null; // show only this project's items
	} = $props();

	const days = $derived(Array.from({ length: BOARD_DAYS }, (_, i) => addDays(today, i)));
	const lastDay = $derived(days[days.length - 1]);

	// Panel headings: "Today" / "Tomorrow" / "Saturday", with the date beside.
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

	const visible = $derived(
		projectFilter ? items.filter((i) => i.project_id === projectFilter) : items
	);

	// Items arrive ordered by position; done items sort by when they were finished.
	const openIn = (list: ActionItemRecord[], date: string | null) =>
		list.filter((i) => i.status !== 'done' && i.scheduled_date === date);
	const doneIn = (date: string | null) =>
		visible
			.filter((i) => i.status === 'done' && i.scheduled_date === date)
			.sort((a, b) => (a.completed_at ?? '').localeCompare(b.completed_at ?? ''));
	const later = $derived(
		visible
			.filter((i) => i.status !== 'done' && i.scheduled_date !== null && i.scheduled_date > lastDay)
			.sort((a, b) => a.scheduled_date!.localeCompare(b.scheduled_date!) || a.position - b.position)
	);

	let editing = $state<ActionItemRecord | null>(null);

	// Every mutation: call the API, then reload from the server. A failure
	// (network, 409 on a stale view) is shown and the reload resyncs.
	async function run(action: Promise<unknown>) {
		try {
			await action;
		} catch (e) {
			toast.error((e as Error).message);
		}
		await invalidateAll();
	}

	/** The API takes an index among ALL open items in the container, filtered or not. */
	function indexAfter(id: string, date: string | null, after: string | null): number {
		const order = openIn(items, date)
			.map((i) => i.id)
			.filter((other) => other !== id);
		return after === null ? 0 : order.indexOf(after) + 1;
	}

	const actions: BoardActions = {
		create: (title, scheduled_date) =>
			run(api.create({ title, scheduled_date, project_id: projectFilter })),
		move: (id, scheduled_date, after) =>
			run(api.move(id, { scheduled_date, index: indexAfter(id, scheduled_date, after) })),
		update: (item, patch) => run(api.update(item.id, patch)),
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

	const board: BoardContext = $derived({
		today,
		actions,
		projects: new Map(projects.map((p) => [p.id, p])),
		destinations: [
			{ label: 'Pool', date: null },
			...days.map((day) => ({ label: dayTitle(day), date: day }))
		]
	});

	const projectOptions = $derived(
		projects.map((p) => ({ value: p.id, label: p.name, color: projectColors[p.color] }))
	);

	async function save(
		item: ActionItemRecord,
		values: Required<UpdateActionItemInput>,
		day: string | null
	) {
		editing = null;
		// Move first: repeating weekly needs the item to already be on a day.
		await run(
			(async () => {
				if (day !== item.scheduled_date && can('move', item.status)) {
					await api.move(item.id, { scheduled_date: day, index: 0 });
				}
				await api.update(item.id, values);
			})()
		);
	}
</script>

<div class="flex flex-col gap-4 lg:flex-row lg:items-start">
	<div
		class="flex max-h-112 flex-col lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:w-72 lg:shrink-0"
	>
		<Column
			title="Pool"
			detail="Unscheduled"
			date={null}
			open={openIn(visible, null)}
			done={doneIn(null)}
			{board}
			fill
		/>
	</div>

	<div
		class="grid min-w-0 flex-1 grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] items-start gap-4"
	>
		{#each days as day (day)}
			<Column
				title={dayTitle(day)}
				detail={shortDate(day)}
				date={day}
				open={openIn(visible, day)}
				done={doneIn(day)}
				highlight={day === today}
				{board}
			/>
		{/each}

		{#if later.length > 0}
			<section class="flex flex-col rounded-xl border border-border/70 bg-muted/40">
				<header class="px-3 pt-3 pb-2"><h2 class="text-sm font-medium">Later</h2></header>
				<ul class="flex max-h-104 flex-col gap-2 overflow-y-auto px-2 pb-2">
					{#each later as item (item.id)}
						<li><ItemCard {item} {board} showDate /></li>
					{/each}
				</ul>
			</section>
		{/if}
	</div>
</div>

{#if editing}
	{@const item = editing}
	<ItemDialog
		{item}
		sources={{ projects: projectOptions }}
		onsave={(values, day) => save(item, values, day)}
		onclose={() => (editing = null)}
	/>
{/if}
