// The action-item state machine. Pure, shared by server (to enforce) and
// client (to decide which controls to show).
//
//   pool ──move(day)──▶ scheduled ──move(null)──▶ pool
//   pool | scheduled ──complete──▶ done ──reopen──▶ scheduled (if dated) | pool
//
// Edits and soft-delete are legal in every state and don't change placement.

import type { ActionItemRecord, ActionItemStatus } from './schema';

export const commandsFrom = {
	move: ['pool', 'scheduled'],
	complete: ['pool', 'scheduled'],
	reopen: ['done']
} as const satisfies Record<string, readonly ActionItemStatus[]>;

export type Command = keyof typeof commandsFrom;

export function can(command: Command, status: ActionItemStatus): boolean {
	return (commandsFrom[command] as readonly ActionItemStatus[]).includes(status);
}

type Placement = Pick<ActionItemRecord, 'status' | 'scheduled_date' | 'completed_at'>;

export function moved(scheduled_date: string | null): Placement {
	return { status: scheduled_date ? 'scheduled' : 'pool', scheduled_date, completed_at: null };
}

export function completed(item: Placement, now: string): Placement {
	return { status: 'done', scheduled_date: item.scheduled_date, completed_at: now };
}

export function reopened(item: Placement): Placement {
	return moved(item.scheduled_date);
}
