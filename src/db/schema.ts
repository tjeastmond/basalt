import { relations } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import type { CollectionApiPermissions } from "@/lib/collection-api-permissions";
import type { CollectionFieldDefinition } from "@/lib/collection-fields";

export const accessLevels = pgTable("access_levels", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  label: text("label"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const user = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  accessLevelId: uuid("access_level_id")
    .notNull()
    .references(() => accessLevels.id, { onDelete: "restrict" }),
  onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true }),
});

export const session = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("sessions_userId_idx").on(table.userId)],
);

export const account = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("accounts_userId_idx").on(table.userId)],
);

export const collections = pgTable("collections", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** User-editable URL key; may diverge from `tableSuffix` after renames. */
  slug: text("slug").notNull().unique(),
  /** Immutable Postgres table suffix: physical data table is `col_<tableSuffix>`. Set once at create. */
  tableSuffix: text("table_suffix").notNull().unique(),
  name: text("name").notNull(),
  fields: jsonb("fields").$type<CollectionFieldDefinition[]>().notNull(),
  apiPermissions: jsonb("api_permissions")
    .$type<CollectionApiPermissions>()
    .notNull()
    .$defaultFn(() => ({
      read: true,
      create: true,
      update: true,
      delete: true,
    })),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** First 16 characters of the issued secret; used for lookup before constant-time verify. */
    keyPrefix: text("key_prefix").notNull().unique(),
    keySalt: text("key_salt").notNull(),
    keyHash: text("key_hash").notNull(),
    label: text("label").notNull(),
    accessLevelId: uuid("access_level_id")
      .notNull()
      .references(() => accessLevels.id, { onDelete: "restrict" }),
    /** When null, all collections are allowed (subject to per-collection API flags). When set, only listed UUIDs. */
    allowedCollectionIds: jsonb("allowed_collection_ids").$type<string[] | null>(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("api_keys_access_level_id_idx").on(table.accessLevelId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const accessLevelsRelations = relations(accessLevels, ({ many }) => ({
  users: many(user),
}));

export const userRelations = relations(user, ({ one, many }) => ({
  accessLevel: one(accessLevels, {
    fields: [user.accessLevelId],
    references: [accessLevels.id],
  }),
  sessions: many(session),
  accounts: many(account),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));
