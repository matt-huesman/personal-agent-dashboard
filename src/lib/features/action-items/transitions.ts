// The action-item state machine. Pure, shared by server (to enforce) and
// client (to decide which controls to show).
//
//   pool ──move(day)──▶ scheduled ──move(null)──▶ pool
//   pool | scheduled ──complete──▶ done ──reopen──▶ scheduled (if dated) | pool
//
// Edits and soft-delete are legal in every state and don't change placement.
//
// Time passing (applied when the board loads, see service.server.ts):
//   ordinary item, day passed, not done  ──▶ rolls into today
//   sticky item, day passed, done or not ──▶ nextOccurrence(), reset to scheduled
// Sticky ("repeat weekly") needs a day: moving to the pool turns it off.

import { addDays } from '$lib/dates';
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

/** The same weekday as `day`, on or after `today`. */
export function nextOccurrence(day: string, today: string): string {
	let next = day;
	while (next < today) next = addDays(next, 7);
	return next;
}
