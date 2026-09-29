import type { ProjectColor } from './schema';

/** Swatches for each palette key (Tailwind's 500 shades), used as inline colours. */
export const projectColors: Record<ProjectColor, string> = {
	slate: '#64748b',
	red: '#ef4444',
	orange: '#f97316',
	amber: '#f59e0b',
	lime: '#84cc16',
	emerald: '#10b981',
	teal: '#14b8a6',
	sky: '#0ea5e9',
	indigo: '#6366f1',
	violet: '#8b5cf6',
	pink: '#ec4899'
};
