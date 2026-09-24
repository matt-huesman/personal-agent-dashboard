import type { ServerInit } from '@sveltejs/kit';
import { migrate } from '$lib/server/db';

export const init: ServerInit = migrate;
