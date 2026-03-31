# AGENTS.md

## Overview

This repository is **Basalt**, a Next.js application. Use **pnpm** for installs and scripts (`packageManager` is set in `package.json`). Before changing framework code, read the in-tree Next.js guide at `node_modules/next/dist/docs/`—this stack can differ from older Next.js docs and training data.

## Tech stack

- **Runtime / app:** Node.js, [Next.js](https://nextjs.org/) (App Router), React 19
- **Language:** TypeScript
- **Package manager:** pnpm
- **Styling:** Tailwind CSS v4, PostCSS, `tw-animate-css`
- **UI:** [shadcn/ui](https://ui.shadcn.com/) (style: base-nova), `@base-ui/react`, `next-themes`, Lucide (`lucide-react`), `class-variance-authority`, `clsx`, `tailwind-merge`
- **Data:** Postgres (Docker locally), [Drizzle ORM](https://orm.drizzle.team/), [Better Auth](https://www.better-auth.com/) (email/password)
- **Testing:** Vitest (with `@vitejs/plugin-react`, `jsdom`)
- **Quality:** ESLint (`eslint-config-next`, `eslint-config-prettier`), Prettier

Pinned versions live in `package.json`.

## Next.js

This version has breaking changes: APIs, conventions, and file structure may differ from your training data. Heed deprecation notices in the local docs.

## Testing

Tests run with **Vitest** in a **jsdom** environment (`vitest.config.ts`). Use `pnpm test` for watch mode and `pnpm test:run` for a single CI-style run.

**Naming:** test files must use the `*.spec.ts` or `*.spec.tsx` suffix (co-located under `src/` as needed). Do not use `*.test.ts` / `*.test.tsx`.

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

## Gotcha: Better Auth session UI (header / nav)

When showing **Sign in** vs **Log out** from `authClient.useSession()`:

1. **Do not branch on `isPending` alone** (e.g. a `…` placeholder). Better Auth refetches often; `isPending` + `data === null` flickers between states and looks broken.

2. **Pass a server hint for the first paint.** The async `AppHeader` calls `getServerSession()` and passes `initialSignedIn` into the client nav. Use it only while the client session query is still pending and `data` is still null, so logged-in users do not flash **Sign in** on load.

3. **Server props lag behind logout.** After `signOut`, the layout may still have served `initialSignedIn: true` until `router.refresh()` completes. Do not apply the server hint on **`/login`**, and use a short **`loggingOut`** flag (set when Log out is clicked) so the hint is ignored during sign-out.

4. **Remount client nav when the pathname changes** (e.g. outer `HeaderAuthNav` renders inner UI with `key={pathname}`) so `loggingOut` and similar state reset cleanly without effects that sync refs or fight the React Compiler ESLint rules.

5. **`drizzle-kit` does not load `.env.local`.** [`drizzle.config.ts`](drizzle.config.ts) uses `dotenv` for `.env.local` / `.env` so `pnpm db:migrate` and friends see `DATABASE_URL`.
