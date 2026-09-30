import MailIcon from '@lucide/svelte/icons/mail';
import { z } from 'zod';
import type { IntegrationManifest } from '../types';

export const gmailConfig = z.object({
	skip_promotions: z.boolean().default(true)
});
export type GmailConfig = z.infer<typeof gmailConfig>;

export const gmail: IntegrationManifest<GmailConfig> = {
	id: 'gmail',
	name: 'Gmail',
	description:
		'New inbox mail from this account goes to the email digest. Link as many accounts as you like.',
	category: 'email',
	icon: MailIcon,
	provides: ['Mail for the email digest', 'Links back to each message'],
	auth: {
		kind: 'oauth2',
		provider: 'google',
		scopes: ['https://www.googleapis.com/auth/gmail.readonly']
	},
	readOnly: true,
	config: gmailConfig,
	configFields: [
		{
			key: 'skip_promotions',
			label: 'Skip the Promotions and Social tabs',
			kind: 'boolean',
			hint: 'Only your main inbox reaches the digest. Turn off to let the agent see (and flag) everything.'
		}
	],
	syncEveryMinutes: 15,
	backgroundSync: true // mail must be ready before the agent's scheduled runs
};
