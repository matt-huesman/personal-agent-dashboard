<script lang="ts">
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import CheckIcon from '@lucide/svelte/icons/check';
	import * as Popover from '$lib/components/ui/popover';
	import { Button } from '$lib/components/ui/button';
	import { formatClock } from '$lib/dates';
	import { formatMinutes } from '$lib/durations';
	import type { ActionItemRecord } from '$lib/features/action-items/schema';
	import type { PlanBlock } from '$lib/features/planner/planner';
	import type { ContextStyle } from '../contexts';

	let {
		block,
		top,
		height,
		item,
		style,
		oncomplete
	}: {
		block: PlanBlock;
		top: number;
		height: number;
		item?: ActionItemRecord; // task blocks
		style?: ContextStyle; // task blocks
		oncomplete: (item: ActionItemRecord) => void;
	} = $props();

	const range = $derived(`${formatClock(block.start)}–${formatClock(block.end, true)}`);
	const roomy = $derived(height >= 34);
</script>

{#if block.kind === 'task' && item && style}
	<Popover.Root>
		<Popover.Trigger
			class={[
				'absolute inset-x-1 overflow-hidden rounded-md border-l-[3px] px-1.5 text-left text-xs transition-shadow hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring',
				block.estimated &&
					'border-y border-r border-dashed border-y-foreground/20 border-r-foreground/20',
				roomy ? 'py-1' : 'flex items-center gap-1.5'
			]}
			style="top: {top}px; height: {height}px; border-left-color: {style.color}; background: color-mix(in oklab, {style.color} 14%, var(--background));"
		>
			<span class={['font-medium text-foreground', roomy ? 'line-clamp-2' : 'truncate']}>
				{item.title}
			</span>
			<span class="block truncate text-[0.7rem] text-muted-foreground tabular-nums">
				{range}{block.parts > 1 ? ` · ${block.part}/${block.parts}` : ''}
			</span>
		</Popover.Trigger>
		<Popover.Content align="start" class="w-72">
			<div class="flex flex-col gap-3 text-sm">
				<div>
					<p class="font-medium leading-snug">{item.title}</p>
					<p class="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
						<span class="size-2 rounded-full" style:background={style.color}></span>
						{style.label}
					</p>
				</div>
				<dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
					<dt class="text-muted-foreground">When</dt>
					<dd class="tabular-nums">{range}</dd>
					{#if block.parts > 1}
						<dt class="text-muted-foreground">Part</dt>
						<dd>{block.part} of {block.parts}</dd>
					{/if}
					<dt class="text-muted-foreground">Estimate</dt>
					<dd>
						{#if item.estimate_minutes}
							{formatMinutes(item.estimate_minutes)}
						{:else}
							none, so {formatMinutes(block.end - block.start)} was assumed
						{/if}
					</dd>
				</dl>
				<div class="flex gap-2">
					<Button size="sm" onclick={() => oncomplete(item)}><CheckIcon />Mark done</Button>
					<Button size="sm" variant="ghost" href="/">Board<ArrowRightIcon /></Button>
				</div>
			</div>
		</Popover.Content>
	</Popover.Root>
{:else if block.kind === 'break'}
	<div
		class="absolute inset-x-2 flex items-center justify-center rounded border border-dashed border-border text-[0.65rem] text-muted-foreground"
		style="top: {top}px; height: {height}px;"
		title="Break · {range}"
	>
		{#if height >= 14}Break{/if}
	</div>
{:else if block.kind === 'switch'}
	<div
		class="absolute inset-x-3 rounded-sm bg-[repeating-linear-gradient(135deg,var(--border)_0_2px,transparent_2px_5px)]"
		style="top: {top}px; height: {height}px;"
		title="Context switch · {formatMinutes(block.end - block.start)} buffer"
	></div>
{:else if block.kind === 'reserved' || block.kind === 'busy'}
	<div
		class={[
			'absolute inset-x-1 overflow-hidden rounded-md px-1.5 py-1 text-xs',
			block.kind === 'busy' ? 'bg-foreground/80 text-background' : 'bg-muted text-muted-foreground'
		]}
		style="top: {top}px; height: {height}px;"
		title="{block.kind === 'busy' ? block.title : block.label} · {range}"
	>
		<span class="truncate font-medium">{block.kind === 'busy' ? block.title : block.label}</span>
	</div>
{/if}
