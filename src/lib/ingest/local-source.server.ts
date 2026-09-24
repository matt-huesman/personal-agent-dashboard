import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { EnvelopeSource } from './source';

/** Stand-in for Drive: envelope JSON files in a local folder. */
export function localSource(dir = 'data/incoming'): EnvelopeSource {
	return {
		async list() {
			return (await readdir(dir)).filter((name) => name.endsWith('.json')).sort();
		},
		async read(ref) {
			return JSON.parse(await readFile(path.join(dir, ref), 'utf8'));
		}
	};
}
