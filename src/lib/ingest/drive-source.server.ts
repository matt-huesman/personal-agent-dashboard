import { listJsonFiles, readJson } from '$lib/server/google-drive';
import type { EnvelopeSource } from './source';

/** Envelopes in a Drive folder. Refs are Drive file ids (stable across renames). */
export function driveSource(folderId: string): EnvelopeSource {
	return {
		async list() {
			return (await listJsonFiles(folderId)).map((file) => file.id);
		},
		read: readJson
	};
}
