/**
 * Declarative form fields. An entity lists its editable fields once
 * (features/<name>/fields.ts) and FieldInput renders each by `kind`.
 * Adding a field to an entity is one line in that list; adding a new kind of
 * input is one branch in FieldInput.
 */
export type FieldKind =
	| 'text' // required string
	| 'textarea' // nullable string
	| 'date' // nullable ISO day
	| 'enum' // one of static `options`
	| 'select' // nullable id, options supplied at runtime from `source`
	| 'duration' // nullable whole minutes
	| 'links'; // Link[]

/** A runtime choice for a `select` field; `color` shows as a dot. */
export type Option = { value: string; label: string; color?: string };

export type Field = {
	label: string;
	kind: FieldKind;
	options?: readonly string[]; // enum
	source?: string; // select: key into the form's `sources`
	half?: boolean; // share a row with the next half-width field
};

/** A field bound to a key of the entity's edit schema. */
export type FieldConfig<T> = Field & { key: keyof T & string };
