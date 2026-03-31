import { z } from "zod";

/** Physical `col_*` row uses `id`; audit columns reserved for a later milestone. */
export const RESERVED_COLLECTION_FIELD_NAMES = new Set(["id", "created_at", "updated_at", "created_by", "updated_by"]);

export const collectionFieldTypeSchema = z.enum(["text", "number", "boolean", "date", "json"]);
export type CollectionFieldType = z.infer<typeof collectionFieldTypeSchema>;

const machineNameSchema = z
  .string()
  .min(1)
  .max(63)
  .regex(/^[a-z][a-z0-9_]*$/, "Use lowercase letters, numbers, and underscores; start with a letter.");

/** API / form input before normalization (allows spaces, capitals, etc.). */
export const collectionFieldLooseSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  type: collectionFieldTypeSchema,
  required: z.boolean().default(false),
  unique: z.boolean().default(false),
  defaultValue: z.unknown().optional(),
});

export const collectionFieldsLooseArraySchema = z.array(collectionFieldLooseSchema);

export type CollectionFieldLooseInput = z.infer<typeof collectionFieldLooseSchema>;

/**
 * Turn a human-entered label into a stable machine name (`a-z`, digits, underscores).
 */
export function normalizeFieldMachineName(raw: string): string {
  let s = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");

  if (s.length === 0) {
    return "field";
  }
  if (!/^[a-z]/.test(s)) {
    s = `f_${s}`;
  }
  s = s
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (s.length === 0 || !/^[a-z]/.test(s)) {
    return "field";
  }
  if (s.length > 63) {
    s = s.slice(0, 63).replace(/_+$/g, "");
  }
  if (s.length === 0 || !/^[a-z][a-z0-9_]*$/.test(s)) {
    return "field";
  }
  return s;
}

/**
 * Display label for a stored machine name: `character_name` → "Character Name".
 * Splits on underscores, title-cases each segment; single-segment names become sentence case.
 */
export function humanizeFieldMachineName(name: string): string {
  const parts = name.split(/_+/).filter((p) => p.length > 0);
  if (parts.length === 0) {
    return name;
  }
  return parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join(" ");
}

/**
 * Ensure unique machine names in field order (second and later collisions get `_2`, `_3`, …).
 */
export function dedupeMachineNames(bases: string[]): string[] {
  const used = new Set<string>();
  const out: string[] = [];

  for (const base of bases) {
    let candidate = base;
    let i = 2;
    while (used.has(candidate)) {
      const suffix = `_${i}`;
      i += 1;
      let prefix = base.slice(0, Math.max(1, 63 - suffix.length)).replace(/_+$/g, "");
      if (prefix.length === 0) {
        prefix = "f";
      }
      candidate = `${prefix}${suffix}`;
      if (candidate.length > 63) {
        candidate = candidate.slice(0, 63).replace(/_+$/g, "");
      }
      if (!/^[a-z][a-z0-9_]*$/.test(candidate)) {
        candidate = `f_${i - 1}`.slice(0, 63).replace(/_+$/g, "");
        if (!/^[a-z]/.test(candidate)) {
          candidate = "field";
        }
      }
    }
    used.add(candidate);
    out.push(candidate);
  }

  return out;
}

export const collectionFieldDefinitionSchema = z
  .object({
    id: z.string().uuid(),
    name: machineNameSchema,
    type: collectionFieldTypeSchema,
    required: z.boolean().default(false),
    unique: z.boolean().default(false),
    defaultValue: z.unknown().optional(),
  })
  .superRefine((field, ctx) => {
    if (field.defaultValue === undefined) {
      return;
    }
    const { type, defaultValue } = field;
    const ok = (() => {
      switch (type) {
        case "text":
          return typeof defaultValue === "string";
        case "number":
          return typeof defaultValue === "number" && Number.isFinite(defaultValue);
        case "boolean":
          return typeof defaultValue === "boolean";
        case "date":
          return typeof defaultValue === "string" && !Number.isNaN(Date.parse(defaultValue));
        case "json":
          return defaultValue !== null && typeof defaultValue === "object";
        default:
          return false;
      }
    })();
    if (!ok) {
      ctx.addIssue({
        code: "custom",
        message: `defaultValue must match type ${type}.`,
        path: ["defaultValue"],
      });
    }
  });

export type CollectionFieldDefinition = z.infer<typeof collectionFieldDefinitionSchema>;

export const collectionFieldsArraySchema = z.array(collectionFieldDefinitionSchema).superRefine((fields, ctx) => {
  const seen = new Set<string>();
  for (let i = 0; i < fields.length; i++) {
    const name = fields[i]!.name;
    if (seen.has(name)) {
      ctx.addIssue({
        code: "custom",
        message: `Duplicate field name "${name}".`,
        path: [i, "name"],
      });
    }
    seen.add(name);
    if (RESERVED_COLLECTION_FIELD_NAMES.has(name)) {
      ctx.addIssue({
        code: "custom",
        message: `Field name "${name}" is reserved for system columns.`,
        path: [i, "name"],
      });
    }
  }
});

/** Normalize names, dedupe, then validate defaults and uniqueness (strict storage shape). */
export function finalizeFieldDefinitions(loose: CollectionFieldLooseInput[]): CollectionFieldDefinition[] {
  const bases = loose.map((f) => normalizeFieldMachineName(f.name));
  const names = dedupeMachineNames(bases);
  const merged = loose.map((f, i) => ({
    ...f,
    name: names[i]!,
  }));
  return collectionFieldsArraySchema.parse(merged);
}

export function isSafeTypeTransition(from: CollectionFieldType, to: CollectionFieldType): boolean {
  if (from === to) {
    return true;
  }
  const safe: [CollectionFieldType, CollectionFieldType][] = [
    ["text", "json"],
    ["number", "text"],
    ["boolean", "text"],
    ["date", "text"],
  ];
  return safe.some(([a, b]) => a === from && b === to);
}

export function parseCollectionFields(raw: unknown): CollectionFieldDefinition[] {
  return collectionFieldsArraySchema.parse(raw);
}

export type SchemaChangeFlags = {
  removedFieldIds: string[];
  unsafeTypeFieldIds: string[];
};

export function computeSchemaChangeFlags(
  previous: CollectionFieldDefinition[],
  next: CollectionFieldDefinition[],
): SchemaChangeFlags {
  const prevById = new Map(previous.map((f) => [f.id, f]));
  const nextIds = new Set(next.map((f) => f.id));

  const removedFieldIds = previous.filter((f) => !nextIds.has(f.id)).map((f) => f.id);

  const unsafeTypeFieldIds: string[] = [];
  for (const field of next) {
    const old = prevById.get(field.id);
    if (!old) {
      continue;
    }
    if (old.type !== field.type && !isSafeTypeTransition(old.type, field.type)) {
      unsafeTypeFieldIds.push(field.id);
    }
  }

  return { removedFieldIds, unsafeTypeFieldIds };
}

export function setsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const sb = new Set(b);
  return a.every((x) => sb.has(x));
}
