// Every integration the app knows, in catalog order. Adding an integration:
// write its manifest (+ connector.server.ts) and list it here and in
// connectors.server.ts. The catalog UI renders from this list.

import { emailAgent } from './email-agent/manifest';
import { gmail } from './gmail/manifest';
import { googleCalendar } from './google-calendar/manifest';
import { icsFeed } from './ics/manifest';
import type { IntegrationCategory, IntegrationManifest } from './types';

/**
 * Each manifest is written against its own config type; the registry holds
 * them side by side, so that type is erased here (Zod schema types are
 * invariant). Config is always re-parsed by the manifest's own schema.
 */
const erase = <C extends Record<string, unknown>>(m: IntegrationManifest<C>) =>
	m as unknown as IntegrationManifest;

export const integrations: IntegrationManifest[] = [
	erase(googleCalendar),
	erase(icsFeed),
	erase(gmail),
	erase(emailAgent)
];

export function manifestOf(id: string): IntegrationManifest | undefined {
	return integrations.find((m) => m.id === id);
}

export const categoryLabels: Record<IntegrationCategory, string> = {
	calendar: 'Calendars',
	email: 'Email',
	school: 'School',
	messaging: 'Messaging',
	storage: 'Storage'
};
