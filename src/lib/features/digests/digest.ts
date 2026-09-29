// A digest is one ingest run seen as a briefing: what the email agent found
// in one window of mail. Read-only; the data is the validated envelope stored
// in ingest_runs, so there is no table of its own (see CONVENTIONS: display-only
// members stay in the envelope until they earn one).

import type { Envelope } from '$lib/ingest/envelope';

export type Digest = {
	id: string; // the run_id
	generated_at: string;
	window: Envelope['window'];
	fyi: Envelope['fyi'];
	suggested_replies: Envelope['suggested_replies'];
	spam_candidates: Envelope['spam_candidates'];
	action_items: Pick<Envelope['action_items'][number], 'id' | 'title' | 'source_message_id'>[];
};

/** "Morning" / "Afternoon" / "Evening" by local time of the run. */
export function digestLabel(generated_at: string): string {
	const hour = new Date(generated_at).getHours();
	return hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';
}

export function gmailLink(source_message_id: string): string {
	return `https://mail.google.com/mail/u/0/#all/${source_message_id}`;
}
