import { INBOX_PREFIX } from '$lib/features/email/batch';
import { listJsonFiles, readJson } from '$lib/server/google-drive';
import type { EnvelopeSource } from './source';

/**
 * Envelopes in a Drive folder. Refs are Drive file ids (stable across renames).
 * The folder also carries inbox batches going the other way (to the agent);
 * those aren't envelopes and are skipped.
 */
export function driveSource(folderId: string): EnvelopeSource {
	return {
		async list() {
			return (await listJsonFiles(folderId))
				.filter((file) => !file.name.startsWith(INBOX_PREFIX))
				.map((file) => file.id);
		},
		read: readJson
	};
}
