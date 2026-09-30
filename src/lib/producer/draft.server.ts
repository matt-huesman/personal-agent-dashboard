// The upstream producer's half of the contract. The scheduled Claude routine
// writes a DRAFT (judgment only: what's actionable, spam, FYI); this code adds
// everything mechanical (ids, run metadata, window, lifecycle defaults) and
// yields an Envelope — the exact type the dashboard ingests.

import { createHash } from 'node:crypto';
import { z } from 'zod';
import { actionItem } from '$lib/features/action-items/schema';
import { envelope, type Envelope } from '$lib/ingest/envelope';

export const PRODUCER = 'email-digest';

export const actionItemDraft = actionItem
	.pick({ title: true, description: true, due_date: true, priority: true, links: true })
	.extend({ source_message_id: z.string() });

export const envelopeDraft = envelope
	.pick({ suggested_replies: true, spam_candidates: true, fyi: true })
	.extend({ action_items: z.array(actionItemDraft) });

export type EnvelopeDraft = z.infer<typeof envelopeDraft>;
export type RunWindow = Envelope['window'];

/** What this run covered: the inbox batches it triaged and the mail's time span. */
export type RunInputs = { window: RunWindow; input_batches: string[] };

/** Stable id: the same email always yields the same ids, so re-sends are idempotent. */
export function itemId(source_message_id: string, index: number): string {
	const hash = createHash('sha256').update(`${source_message_id}:${index}`).digest('hex');
	return `ai_${hash.slice(0, 12)}`;
}

export function buildEnvelope(draft: EnvelopeDraft, run: RunInputs, now: Date): Envelope {
	const generated_at = now.toISOString();
	const run_id = `${PRODUCER}-${generated_at}`;
	const perMessage = new Map<string, number>();

	return {
		schema_version: '1.0',
		run_id,
		generated_at,
		source: PRODUCER,
		window: run.window,
		input_batches: run.input_batches,
		action_items: draft.action_items.map((item) => {
			const index = perMessage.get(item.source_message_id) ?? 0;
			perMessage.set(item.source_message_id, index + 1);
			return {
				...item,
				id: itemId(item.source_message_id, index),
				estimate_minutes: null, // the owner estimates, for now
				source_run_id: run_id,
				status: 'pool',
				scheduled_date: null,
				created_at: generated_at
			};
		}),
		suggested_replies: draft.suggested_replies,
		spam_candidates: draft.spam_candidates,
		fyi: draft.fyi
	};
}

/** e.g. "email-digest-20260924T130000Z.json" — name order is chronological order. */
export function envelopeFileName(generatedAt: string): string {
	const stamp = generatedAt.replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
	return `${PRODUCER}-${stamp}.json`;
}
