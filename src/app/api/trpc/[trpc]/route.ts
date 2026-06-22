import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { log } from "@/lib/server/logging/logger";
import { createTRPCContext } from "@/server/api/context";
import { appRouter } from "@/server/api/root";

function handler(req: Request) {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    router: appRouter,
    req,
    createContext: () => createTRPCContext({ headers: req.headers }),
    onError({ error, path, type }) {
      if (error.code === "INTERNAL_SERVER_ERROR") {
        log.errorFromUnknown(error, { trpcPath: path, trpcType: type });
      }
    },
  });
}

export { handler as GET, handler as POST };
