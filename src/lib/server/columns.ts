import { customType } from 'drizzle-orm/pg-core';

/**
 * timestamptz that round-trips as an ISO-8601 string ("2026-09-24T08:00:12.000Z"),
 * matching the isoDateTime contract. Drizzle's built-in string mode returns
 * Postgres' own format ("2026-09-24 08:00:12+00") instead.
 */
export const isoTimestamp = customType<{ data: string; driverData: string }>({
	dataType: () => 'timestamp (3) with time zone',
	fromDriver: (value) => new Date(value).toISOString()
});
