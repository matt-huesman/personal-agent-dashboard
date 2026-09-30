// Server-side half of the registry: integration id → connector code.
// Integrations delivered another way (the email agent) have no connector.

import { gmailConnector } from './gmail/connector.server';
import { googleCalendarConnector } from './google-calendar/connector.server';
import { icsConnector } from './ics/connector.server';
import type { Connector } from './types';

type AnyConnector = Connector<Record<string, unknown>>;

// Each connector's config type is erased here; the engine hands it config
// already parsed by that integration's manifest schema.
export const connectors: Record<string, AnyConnector> = {
	'google-calendar': googleCalendarConnector as unknown as AnyConnector,
	ics: icsConnector as unknown as AnyConnector,
	gmail: gmailConnector as unknown as AnyConnector
};
