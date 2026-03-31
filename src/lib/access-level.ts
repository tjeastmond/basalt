export const ACCESS_SLUGS = ["owner", "admin", "user"] as const;

export type AccessSlug = (typeof ACCESS_SLUGS)[number];

export function isAdminOrOwnerSlug(slug: string): boolean {
  return slug === "owner" || slug === "admin";
}
