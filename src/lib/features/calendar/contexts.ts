import { projectColors } from '$lib/features/projects/colors';
import type { ProjectSummary } from '$lib/features/projects/schema';
import { EMAIL_CONTEXT } from './plan';

export type ContextStyle = { label: string; color: string };

/** How each planner context looks: projects use their colour; the rest stay neutral. */
export function contextStyles(projects: ProjectSummary[]): (context: string) => ContextStyle {
	const byId = new Map(projects.map((p) => [p.id, p]));
	return (context) => {
		const project = byId.get(context);
		if (project) return { label: project.name, color: projectColors[project.color] };
		if (context === EMAIL_CONTEXT) return { label: 'Email follow-ups', color: '#94a3b8' };
		return { label: 'Other tasks', color: '#a8a29e' };
	};
}
