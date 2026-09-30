import { z } from 'zod';
import { isoDateTime } from '$lib/schema-primitives';
import { messageRecord } from '$lib/integrations/streams';

/** A message as stored: the `message` stream record + where it came from + its batch. */
export const storedMessageRecord = messageRecord.extend({
	connection_id: z.string(),
	batch_id: z.string().nullable(), // null until handed to the email agent
	synced_at: isoDateTime
});

/**
 * A group of messages handed to the email agent in one Drive file.
 *   created   messages claimed (batch row exists)
 *   published uploaded to Drive (drive_file_id set)
 *   consumed  a digest covering it was ingested; the Drive file is deleted
 */
export const emailBatchRecord = z.object({
	id: z.string(),
	created_at: isoDateTime,
	message_count: z.number().int(),
	drive_file_id: z.string().nullable(),
	published_at: isoDateTime.nullable(),
	consumed_at: isoDateTime.nullable()
});

export type StoredMessageRecord = z.infer<typeof storedMessageRecord>;
export type EmailBatchRecord = z.infer<typeof emailBatchRecord>;
