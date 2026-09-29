import { describe, expect, it } from 'vitest';
import { useTestDb } from '../../../test/db';
import { DEFAULT_PLANNER_SETTINGS } from './schema';
import { getSettings, saveSettings } from './service.server';

useTestDb();

describe('planner settings', () => {
	it('falls back to defaults, then round-trips what is saved', async () => {
		expect(await getSettings()).toEqual(DEFAULT_PLANNER_SETTINGS);

		const custom = { ...DEFAULT_PLANNER_SETTINGS, day_start: 8 * 60, max_focus_minutes: 60 };
		await saveSettings(custom);
		expect(await getSettings()).toEqual(custom);
	});
});
