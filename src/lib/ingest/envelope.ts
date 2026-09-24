// The ingest contract. The upstream scheduled task writes envelopes matching
// this shape to Drive. An envelope is validated ONCE, here, at the ingest
// boundary; everything downstream (DB, API, UI) trusts the data.
//
// Entities that are persisted own their schema in their feature folder
// (features/<name>/schema.ts); the envelope only composes them.
//
// Deliberate restraint: this validates STRUCTURE and ENUMS, not string formats.
// Expected formats are documented in $lib/schema-primitives.

import { z } from 'zod';
import { isoDateTime } from '$lib/schema-primitives';
import { actionItem } from '$lib/features/action-items/schema';

// --- Display-only members ------------------------------------------------------
// Surfaced in the UI later; stored with the raw envelope in ingest_runs for now.
export const suggestedReply = z.object({
	source_message_id: z.string(),
	confidence: z.enum(['low', 'medium', 'high']),
	draft: z.string()
});

export const spamCandidate = z.object({
	source_message_id: z.string(),
	reason: z.string()
});

export const fyiItem = z.object({
	source_message_id: z.string(),
	summary: z.string()
});

// --- The envelope ---------------------------------------------------------------
export const envelope = z.object({
	schema_version: z.literal('1.0'), // bump on a breaking change; ingest can branch on it
	run_id: z.string(),
	generated_at: isoDateTime,
	source: z.string(), // producer name, e.g. "email-digest"
	window: z.object({
		since: isoDateTime,
		until: isoDateTime
	}),
	action_items: z.array(actionItem),
	suggested_replies: z.array(suggestedReply).default([]),
	spam_candidates: z.array(spamCandidate).default([]),
	fyi: z.array(fyiItem).default([])
});

export type SuggestedReply = z.infer<typeof suggestedReply>;
export type SpamCandidate = z.infer<typeof spamCandidate>;
export type FyiItem = z.infer<typeof fyiItem>;
export type Envelope = z.infer<typeof envelope>;
