// Background sync for integrations whose manifest opts in (backgroundSync).
// Mail must reach the email agent before its scheduled runs even when no page
// is open. Everything else stays lazy (page loads + the browser's freshness
// loop). One cheap check every few minutes; nothing else runs.

import { publishInbox } from '$lib/features/email/service.server';
import { syncDue } from './sync.server';

const TICK_MS = 5 * 60 * 1000;
let started = false;

export function startBackgroundSync(): void {
	if (started) return;
	started = true;
	let busy = false;

	const tick = async () => {
		if (busy) return;
		busy = true;
		try {
			await syncDue({ background: true });
			await publishInbox(); // retries a handoff that failed earlier
		} catch (e) {
			console.error('Background sync:', (e as Error).message);
		} finally {
			busy = false;
		}
	};

	setTimeout(tick, 10_000); // shortly after startup
	setInterval(tick, TICK_MS);
}
