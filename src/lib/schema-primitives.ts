// Zod primitives shared by every entity and the ingest envelope.
//
// Strings are kept as plain strings on purpose: the expected format is a
// contract documented here, not a runtime check. Validation is about structure
// and the enums that drive UI state.

import { z } from 'zod';

export const isoDateTime = z.string(); // e.g. "2026-09-24T08:00:00.000Z"
export const isoDate = z.string(); // calendar day, e.g. "2026-09-24" (no time)

export const link = z.object({
	url: z.string(),
	label: z.string().optional()
});

export type Link = z.infer<typeof link>;
