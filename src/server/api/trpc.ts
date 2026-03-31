import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";

import { isAdminOrOwner, isOwner } from "@/lib/member";
import type { TRPCContext } from "@/server/api/context";

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireMember = t.middleware(({ ctx, next }) => {
  if (!ctx.member) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "You must be signed in." });
  }
  return next({
    ctx: {
      ...ctx,
      member: ctx.member,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireMember);

const requireAdminOrOwnerMw = t.middleware(({ ctx, next }) => {
  if (!ctx.member || !isAdminOrOwner(ctx.member)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Owner or Admin access required." });
  }
  return next({
    ctx: {
      ...ctx,
      member: ctx.member,
    },
  });
});

export const adminProcedure = protectedProcedure.use(requireAdminOrOwnerMw);

const requireOwnerMw = t.middleware(({ ctx, next }) => {
  if (!ctx.member || !isOwner(ctx.member)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Owner access required." });
  }
  return next({
    ctx: {
      ...ctx,
      member: ctx.member,
    },
  });
});

export const ownerProcedure = protectedProcedure.use(requireOwnerMw);
