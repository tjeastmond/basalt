import { apiKeysRouter } from "@/server/api/routers/api-keys";
import { collectionsRouter } from "@/server/api/routers/collections";
import { meRouter } from "@/server/api/routers/me";
import { recordsRouter } from "@/server/api/routers/records";
import { usersRouter } from "@/server/api/routers/users";
import { router } from "@/server/api/trpc";

export const appRouter = router({
  me: meRouter,
  users: usersRouter,
  apiKeys: apiKeysRouter,
  collections: collectionsRouter,
  records: recordsRouter,
});

export type AppRouter = typeof appRouter;
