<script lang="ts">
	import { projectColors } from '../colors';
	import { PROJECT_COLORS, type ProjectColor } from '../schema';

	let {
		value,
		onchange,
		label = 'Colour'
	}: { value: ProjectColor; onchange: (color: ProjectColor) => void; label?: string } = $props();
</script>

<div class="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
	{#each PROJECT_COLORS as color (color)}
		<button
			type="button"
			role="radio"
			aria-checked={value === color}
			aria-label={color}
			title={color}
			class={[
				'size-5 rounded-full ring-offset-2 ring-offset-background transition-shadow',
				value === color ? 'ring-2 ring-foreground/60' : 'hover:ring-2 hover:ring-foreground/20'
			]}
			style:background={projectColors[color]}
			onclick={() => onchange(color)}
		></button>
	{/each}
</div>
