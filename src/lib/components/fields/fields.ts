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
	| 'enum' // one of `options`
	| 'links'; // Link[]

export type Field = {
	label: string;
	kind: FieldKind;
	options?: readonly string[];
};

/** A field bound to a key of the entity's edit schema. */
export type FieldConfig<T> = Field & { key: keyof T & string };
