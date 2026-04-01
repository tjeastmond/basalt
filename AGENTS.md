# AGENTS.md

## Overview

This repository is **Basalt**, a Next.js application. Use **pnpm** for installs and scripts (`packageManager` is set in `package.json`). Before changing framework code, read the in-tree Next.js guide at `node_modules/next/dist/docs/`—this stack can differ from older Next.js docs and training data.

## PNPM Scripts

| Script         | Purpose                                 |
| -------------- | --------------------------------------- |
| `dev`          | Next.js dev server                      |
| `build`        | Production build                        |
| `start`        | Run production server (after `build`)   |
| `lint`         | ESLint on the repo                      |
| `typecheck`    | TypeScript (`tsc --noEmit`)             |
| `format`       | Prettier write                          |
| `format:check` | Prettier check (CI-friendly)            |
| `test`         | Vitest watch mode                       |
| `test:run`     | Vitest single run (CI-friendly)         |
| `db:generate`  | Drizzle: generate SQL migrations        |
| `db:migrate`   | Drizzle: apply migrations               |
| `db:push`      | Drizzle: push schema (dev shortcut)     |
| `db:seed`      | Seed access levels + default Owner user |

## Tech stack

- **Runtime / app:** Node.js, [Next.js](https://nextjs.org/) (App Router), React 19
- **Language:** TypeScript
- **Package manager:** pnpm
- **Styling:** Tailwind CSS v4, PostCSS, `tw-animate-css`
- **UI:** [shadcn/ui](https://ui.shadcn.com/) (style: base-nova), `@base-ui/react`, class-based dark mode via in-app `ThemeProvider` (`src/components/theme-provider.tsx`) plus a blocking script in root layout (`src/lib/theme-init-script.ts`), Lucide (`lucide-react`), `class-variance-authority`, `clsx`, `tailwind-merge`
- **Data:** Postgres (Docker locally), [Drizzle ORM](https://orm.drizzle.team/), [Better Auth](https://www.better-auth.com/) (email/password)
- **API (app):** [tRPC](https://trpc.io/) v11 (`@trpc/server`, `@trpc/client`, `@trpc/react-query`), [TanStack Query](https://tanstack.com/query) (`@tanstack/react-query`), [superjson](https://github.com/blitz-js/superjson) for dates and other non-JSON types on the wire, and [Zod](https://zod.dev/) for procedure inputs.
- **tRPC layout:** Route handler [`src/app/api/trpc/[trpc]/route.ts`](src/app/api/trpc/[trpc]/route.ts), merged routers under [`src/server/api/`](src/server/api/), client [`TrpcProvider` in `src/trpc/react.tsx`](src/trpc/react.tsx) inside root [`layout.tsx`](src/app/layout.tsx). Use `protectedProcedure` and `adminProcedure` from [`src/server/api/trpc.ts`](src/server/api/trpc.ts). Resolve the current user’s access level from Postgres via [`getMemberFromHeaders`](src/lib/member.ts) in tRPC context—do not treat the client as authoritative for roles.
- **Testing:** Vitest (with `@vitejs/plugin-react`, `jsdom`)
- **Quality:** ESLint (`eslint-config-next`, `eslint-config-prettier`), Prettier

Pinned versions live in `package.json`.

## Collection physical tables (Postgres)

- **Two layers:** Collection **metadata** lives in the Drizzle table `collections` (`slug`, immutable `tableSuffix`, `name`, `fields` JSON). **Row data** lives in a separate Postgres table per collection named `col_<tableSuffix>` (prefix and validation in [`src/lib/collection-physical-table.ts`](src/lib/collection-physical-table.ts)).
- **No per-collection Drizzle migrations:** The app issues raw `CREATE TABLE` / `ALTER TABLE` via [`src/server/collection-data-ddl.ts`](src/server/collection-data-ddl.ts). Drizzle migrations only evolve the shared `collections` (and auth) schema.
- **Create:** [`collections.create`](src/server/api/routers/collections.ts) runs in a DB transaction: insert the `collections` row (`tableSuffix` starts equal to `slug`), then `createCollectionDataTable` builds columns from finalized field defs (`id uuid` primary key plus mapped types: text, double precision, boolean, timestamptz, jsonb; optional `UNIQUE` constraints).
- **Update:** After confirmation flags for destructive changes, `syncCollectionDataTableSchema` alters the physical table to match new `fields` (add/drop/rename columns, type changes with `USING` where supported). If the physical table is missing, `createCollectionDataTable` is used. **`tableSuffix` is never changed** after create—only `slug` may be renamed for URLs.
- **Delete:** `dropCollectionDataTable` then delete the `collections` row (transaction).

## Local Postgres (readonly exploration)

With the default Docker setup, agents can use this **read-only** URL (same value as `DATABASE_URL_READONLY` in [`.env.example`](.env.example)) to inspect **table shapes** and **current values** without write access:

`postgresql://basalt_readonly:basalt_readonly@localhost:5432/basalt`

The readonly role is **SELECT-only**—use it for exploration (e.g. `psql`, GUI clients). Use `DATABASE_URL` for migrations, seeding, and any data changes.

## Next.js

This version has breaking changes: APIs, conventions, and file structure may differ from your training data. Heed deprecation notices in the local docs.

## Testing

Tests run with **Vitest** in a **jsdom** environment (`vitest.config.ts`). Use `pnpm test` for watch mode and `pnpm test:run` for a single CI-style run.

**Naming:** test files must use the `*.spec.ts` or `*.spec.tsx` suffix (co-located under `src/` as needed). Do not use `*.test.ts` / `*.test.tsx`.

## Gotchas

### Do not branch on `isPending` alone

When showing **Sign in** vs **Log out** from `authClient.useSession()`, do not use only `isPending` (e.g. a `…` placeholder). Better Auth refetches often; `isPending` with `data === null` flickers between states and looks broken.

### Pass a server hint for the first paint

The async `AppHeader` calls `getMemberFromHeaders()` and passes `initialSignedIn` and `initialAccessSlug` into the client nav. Use the signed-in hint only while the client session query is still pending and `data` is still null, so logged-in users do not flash **Sign in** on load. Use `initialAccessSlug` the same way for admin-only chrome (e.g. **Users**) on first paint.

### Server props lag behind logout

After `signOut`, the layout may still have served `initialSignedIn: true` until `router.refresh()` completes. Do not apply the server hint on **`/login`**, and use a short **`loggingOut`** flag (set when Log out is clicked) so the hint is ignored during sign-out.

### Remount client nav when the pathname changes

Outer `HeaderAuthNav` should render inner UI with `key={pathname}` so `loggingOut` and similar state reset cleanly without effects that sync refs or fight the React Compiler ESLint rules.

### Drizzle Kit and `.env.local`

`drizzle-kit` does not load `.env.local` by default. [`drizzle.config.ts`](drizzle.config.ts) uses `dotenv` for `.env.local` / `.env` so `pnpm db:migrate` and friends see `DATABASE_URL`.
