// Streams: the standard records every connector produces. The app maps each
// stream once (mappers.server.ts), so a new integration is only a connector.
// This is the integration boundary: a connector's output is validated here,
// once, and trusted afterwards.
//
// Each stream has fixed semantics:
//   events    SNAPSHOT: the complete set within the connector's window. Storage
//             is made to match it (the source owns events; edits and deletions
//             flow through).
//   messages  APPEND: messages new since the cursor. Stored insert-or-ignore
//             and pruned by age (mail is never edited, only arrives).

import { z } from 'zod';
import { isoDateTime } from '$lib/schema-primitives';

export const eventRecord = z.object({
	external_id: z.string().min(1), // stable within the connection
	calendar_id: z.string(),
	calendar_name: z.string(),
	title: z.string(),
	start: isoDateTime,
	end: isoDateTime,
	all_day: z.boolean(),
	busy: z.boolean(), // false for "free" events: shown, but not planned around
	url: z.string().nullable()
});

export const messageRecord = z.object({
	external_id: z.string().min(1), // the provider's message id
	thread_id: z.string(),
	account: z.string(), // the mailbox it arrived in, e.g. "you@gmail.com"
	from: z.string(),
	to: z.string(),
	subject: z.string(),
	received_at: isoDateTime,
	labels: z.array(z.string()),
	snippet: z.string(),
	body: z.string(), // plain text, trimmed to a readable length
	url: z.string() // opens the message in the right account
});

/** What one pull returns: any of the streams the connector provides, plus its next cursor. */
export const pullResult = z.object({
	events: z.array(eventRecord).optional(),
	messages: z.array(messageRecord).optional(),
	cursor: z.unknown().optional()
});

export type EventRecord = z.infer<typeof eventRecord>;
export type MessageRecord = z.infer<typeof messageRecord>;
export type PullResult = z.infer<typeof pullResult>;
