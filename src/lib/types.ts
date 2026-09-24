/**
 * Exact type equality. Used to pin each Drizzle table to its Zod record schema:
 *   const _drift: Equal<typeof table.$inferSelect, Record> = true;
 * fails to compile the moment the two drift apart.
 */
export type Equal<A, B> =
	(<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
