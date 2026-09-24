/**
 * Where envelopes come from. The ingest pipeline depends only on this interface.
 *
 * ┌─ DRIVE ADAPTER SWAP POINT ────────────────────────────────────────────────┐
 * │ Today: localSource() reads ./data/incoming/*.json.                        │
 * │ Later: a driveSource() implements the same two methods against the Drive  │
 * │ API — list() returns file ids in the digest folder, read() downloads and  │
 * │ JSON-parses one — and replaces localSource() as the default in            │
 * │ run.server.ts. Nothing else in the pipeline changes.                      │
 * └───────────────────────────────────────────────────────────────────────────┘
 */
export interface EnvelopeSource {
	/** Stable refs for every available envelope (file name, Drive file id, …). */
	list(): Promise<string[]>;
	/** Raw, unvalidated contents of one envelope. */
	read(ref: string): Promise<unknown>;
}
