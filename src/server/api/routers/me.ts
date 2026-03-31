import { eq } from "drizzle-orm";
import { z } from "zod";

import { db, user } from "@/db";
import { auth } from "@/lib/auth";
import { protectedProcedure, router } from "@/server/api/trpc";

export const meRouter = router({
  get: protectedProcedure.query(({ ctx }) => ({
    id: ctx.member.userId,
    email: ctx.member.email,
    name: ctx.member.name,
    image: ctx.member.image,
    accessSlug: ctx.member.accessSlug,
    onboardingCompletedAt: ctx.member.onboardingCompletedAt,
  })),

  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200),
        image: z.union([z.string().url().max(2000), z.null()]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await auth.api.updateUser({
        headers: ctx.headers,
        body: {
          name: input.name,
          ...(input.image !== undefined ? { image: input.image } : {}),
        },
      });
      return { ok: true as const };
    }),

  completeOnboarding: protectedProcedure.mutation(async ({ ctx }) => {
    await db.update(user).set({ onboardingCompletedAt: new Date() }).where(eq(user.id, ctx.member.userId));
    return { ok: true as const };
  }),
});
