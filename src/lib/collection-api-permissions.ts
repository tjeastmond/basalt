import { z } from "zod";

export type CollectionApiPermissions = {
  read: boolean;
  create: boolean;
  update: boolean;
  delete: boolean;
};

export const defaultCollectionApiPermissions: CollectionApiPermissions = {
  read: true,
  create: true,
  update: true,
  delete: true,
};

export const collectionApiPermissionsSchema = z.object({
  read: z.boolean(),
  create: z.boolean(),
  update: z.boolean(),
  delete: z.boolean(),
});

export function normalizeCollectionApiPermissions(raw: unknown): CollectionApiPermissions {
  const parsed = collectionApiPermissionsSchema.safeParse(raw);
  if (parsed.success) {
    return parsed.data;
  }
  return { ...defaultCollectionApiPermissions };
}
