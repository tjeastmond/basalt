import { z } from "zod";

export const collectionFieldTypeSchema = z.enum(["text", "number", "boolean", "date", "json"]);
export type CollectionFieldType = z.infer<typeof collectionFieldTypeSchema>;

const machineNameSchema = z
  .string()
  .min(1)
  .max(63)
  .regex(/^[a-z][a-z0-9_]*$/, "Use lowercase letters, numbers, and underscores; start with a letter.");

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
        code: z.ZodIssueCode.custom,
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
        code: z.ZodIssueCode.custom,
        message: `Duplicate field name "${name}".`,
        path: [i, "name"],
      });
    }
    seen.add(name);
  }
});

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
