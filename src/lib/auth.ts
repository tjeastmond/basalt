import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import * as authSchema from "@/db/schema";

const secret = process.env.BETTER_AUTH_SECRET;
if (!secret) {
  throw new Error("BETTER_AUTH_SECRET is not set");
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: authSchema,
  }),
  secret,
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  emailAndPassword: {
    enabled: true,
  },
  plugins: [nextCookies()],
  user: {
    additionalFields: {
      accessLevelId: {
        type: "string",
        required: true,
        input: false,
      },
      onboardingCompletedAt: {
        type: "date",
        required: false,
        input: false,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          if (user.accessLevelId) {
            return { data: user };
          }
          const [row] = await db
            .select({ id: authSchema.accessLevels.id })
            .from(authSchema.accessLevels)
            .where(eq(authSchema.accessLevels.slug, "user"))
            .limit(1);
          if (!row) {
            throw new Error("Missing access_levels row with slug 'user'. Run pnpm db:seed.");
          }
          return {
            data: {
              ...user,
              accessLevelId: row.id,
            },
          };
        },
      },
    },
  },
});
