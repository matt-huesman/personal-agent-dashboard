// The integration contract. A manifest is data (shared with the browser: the
// catalog renders from it); a connector is server-only code. See
// docs/integrations-plan.md for the architecture and the add-an-integration recipe.

import type { Component } from 'svelte';
import type { z } from 'zod';
import type { FieldConfig, Option } from '$lib/components/fields/fields';

export type IntegrationCategory = 'calendar' | 'email' | 'school' | 'messaging' | 'storage';

export type AuthSpec =
	| { kind: 'oauth2'; provider: 'google'; scopes: string[] }
	| { kind: 'url'; label: string; placeholder: string; help: string } // e.g. an iCal feed
	| { kind: 'agent'; help: string }; // delivered by a scheduled Claude routine

export type IntegrationManifest<Config extends Record<string, unknown> = Record<string, unknown>> =
	{
		id: string;
		name: string;
		description: string;
		category: IntegrationCategory;
		icon: Component;
		provides: string[]; // what it adds, in plain words
		auth: AuthSpec;
		readOnly: boolean; // its records can't be changed from here (shown with a lock)
		config: z.ZodType<Config>; // the user's choices; defaults apply on connect
		configFields: FieldConfig<Config>[];
		syncEveryMinutes: number; // how long synced data counts as fresh
		/** Also sync while no page is open (background.server.ts), for data other parts depend on. */
		backgroundSync?: boolean;
	};

// --- Server side ----------------------------------------------------------------

export type Credentials =
	| {
			kind: 'oauth2';
			provider: 'google';
			access_token: string;
			refresh_token: string;
			expires_at: number; // epoch ms
			scope: string;
	  }
	| { kind: 'url'; url: string };

export type ConnectorContext<Config> = {
	config: Config;
	credentials: Credentials;
	/** fetch with auth applied (OAuth tokens refreshed as needed); plain fetch otherwise. */
	fetch: (url: string, init?: RequestInit) => Promise<Response>;
	now: Date;
	/** What the connector returned as `cursor` last time (null on the first sync). */
	cursor: unknown;
};

export type Connector<Config> = {
	/** A label for the connected account or source ("you@gmail.com", "Canvas"). */
	describe(ctx: ConnectorContext<Config>): Promise<string>;
	/** Choices for a config field that has a `source`, e.g. the account's calendars. */
	options?(ctx: ConnectorContext<Config>, source: string): Promise<Option[]>;
	/** The data since `ctx.cursor`, as a PullResult (validated by the sync engine). */
	pull(ctx: ConnectorContext<Config>): Promise<unknown>;
};
