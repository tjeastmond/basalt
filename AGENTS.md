# AGENTS.md

## Overview

This repository is **Basalt**, a Next.js application. Use **pnpm** for installs and scripts (`packageManager` is set in `package.json`). Before changing framework code, read the in-tree Next.js guide at `node_modules/next/dist/docs/`—this stack can differ from older Next.js docs and training data.

## Tech stack

- **Runtime / app:** Node.js, [Next.js](https://nextjs.org/) (App Router), React 19
- **Language:** TypeScript
- **Package manager:** pnpm
- **Styling:** Tailwind CSS v4, PostCSS, `tw-animate-css`
- **UI:** [shadcn/ui](https://ui.shadcn.com/) (style: base-nova), `@base-ui/react`, `next-themes`, Lucide (`lucide-react`), `class-variance-authority`, `clsx`, `tailwind-merge`
- **Testing:** Vitest (with `@vitejs/plugin-react`, `jsdom`)
- **Quality:** ESLint (`eslint-config-next`, `eslint-config-prettier`), Prettier

Pinned versions live in `package.json`.

## Next.js

This version has breaking changes: APIs, conventions, and file structure may differ from your training data. Heed deprecation notices in the local docs.

## Testing

Tests run with **Vitest** in a **jsdom** environment (`vitest.config.ts`). Use `pnpm test` for watch mode and `pnpm test:run` for a single CI-style run.

**Naming:** test files must use the `*.spec.ts` or `*.spec.tsx` suffix (co-located under `src/` as needed). Do not use `*.test.ts` / `*.test.tsx`.

## PNPM Scripts

| Script         | Purpose                               |
| -------------- | ------------------------------------- |
| `dev`          | Next.js dev server                    |
| `build`        | Production build                      |
| `start`        | Run production server (after `build`) |
| `lint`         | ESLint on the repo                    |
| `typecheck`    | TypeScript (`tsc --noEmit`)           |
| `format`       | Prettier write                        |
| `format:check` | Prettier check (CI-friendly)          |
| `test`         | Vitest watch mode                     |
| `test:run`     | Vitest single run (CI-friendly)       |
