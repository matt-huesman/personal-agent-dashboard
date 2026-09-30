import SparklesIcon from '@lucide/svelte/icons/sparkles';
import { z } from 'zod';
import type { IntegrationManifest } from '../types';

// The AI stage of email. Mail comes from every linked Gmail account (the gmail
// integration), is handed to a scheduled Claude routine through Drive as
// encrypted inbox batches, and comes back as one digest across all accounts
// (src/lib/ingest). Managed outside the catalog, so it has no connector.
export const emailAgent: IntegrationManifest<Record<string, never>> = {
	id: 'email-agent',
	name: 'Email digest',
	description:
		'A scheduled Claude routine triages new mail from every linked account, twice a day, into one digest.',
	category: 'email',
	icon: SparklesIcon,
	provides: ['Action items in your pool', 'Morning and evening digests'],
	auth: {
		kind: 'agent',
		help: 'Set up once with docs/google-setup.md and agents/email-digest.md.'
	},
	readOnly: true,
	config: z.object({}),
	configFields: [],
	syncEveryMinutes: 10
};
