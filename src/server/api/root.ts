import { meRouter } from "@/server/api/routers/me";
import { usersRouter } from "@/server/api/routers/users";
import { router } from "@/server/api/trpc";

export const appRouter = router({
  me: meRouter,
  users: usersRouter,
});

export type AppRouter = typeof appRouter;
