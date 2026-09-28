// Lazy auto-ingest: the board checks for new envelopes when it loads, at most
// once per interval. No background timer, so an idle dashboard costs nothing.

import { ingest } from './run.server';

const INTERVAL_MS = 10 * 60 * 1000;
let lastRun = 0;

export async function ingestIfStale(): Promise<void> {
	if (Date.now() - lastRun < INTERVAL_MS) return;
	lastRun = Date.now();
	// The source is external (network, Drive): a failure is logged and the board
	// still renders from what's already stored. "Check for new" surfaces details.
	try {
		const report = await ingest();
		for (const failure of report.failed)
			console.error(`Ingest failed for ${failure.ref}:`, failure.error);
	} catch (e) {
		console.error('Auto-ingest failed:', e);
	}
}
