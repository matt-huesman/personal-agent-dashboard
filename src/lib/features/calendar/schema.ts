import { z } from 'zod';
import { isoDateTime } from '$lib/schema-primitives';
import { eventRecord } from '$lib/integrations/streams';

/** A synced event as stored: the `event` stream record plus where it came from. */
export const storedEventRecord = eventRecord.extend({
	connection_id: z.string(),
	read_only: z.boolean(), // the source can't be edited from here (lock icon)
	synced_at: isoDateTime
});

export type StoredEventRecord = z.infer<typeof storedEventRecord>;
