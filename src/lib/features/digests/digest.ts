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

/**
 * Source ids are "<account>/<message id>" since multiple accounts can be
 * linked; older digests used the bare id (the default account).
 */
export function parseSourceId(source_message_id: string): { account: string | null; id: string } {
	const slash = source_message_id.lastIndexOf('/');
	return slash === -1
		? { account: null, id: source_message_id }
		: { account: source_message_id.slice(0, slash), id: source_message_id.slice(slash + 1) };
}

/** Opens the message in the account it arrived in. */
export function gmailLink(source_message_id: string): string {
	const { account, id } = parseSourceId(source_message_id);
	return `https://mail.google.com/mail/u/${account ? encodeURIComponent(account) : 0}/#all/${id}`;
}

/** The accounts a digest's items came from (empty for older, single-account digests). */
export function digestAccounts(digest: Digest): string[] {
	const ids = [
		...digest.fyi,
		...digest.suggested_replies,
		...digest.spam_candidates,
		...digest.action_items
	].flatMap((i) => (i.source_message_id ? [i.source_message_id] : []));
	return [...new Set(ids.map((id) => parseSourceId(id).account).filter((a) => a !== null))];
}
