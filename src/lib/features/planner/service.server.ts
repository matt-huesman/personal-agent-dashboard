import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { plannerSettings, type PlannerSettings } from './schema';
import { plannerSettingsTable } from './table.server';

const PROFILE = 'default';

/** Saved settings, with defaults for anything never saved (or added since). */
export async function getSettings(): Promise<PlannerSettings> {
	const [row] = await db
		.select()
		.from(plannerSettingsTable)
		.where(eq(plannerSettingsTable.id, PROFILE));
	return plannerSettings.parse(row?.value ?? {});
}

export async function saveSettings(settings: PlannerSettings): Promise<PlannerSettings> {
	const row = { id: PROFILE, value: settings, updated_at: new Date().toISOString() };
	await db
		.insert(plannerSettingsTable)
		.values(row)
		.onConflictDoUpdate({ target: plannerSettingsTable.id, set: row });
	return settings;
}
