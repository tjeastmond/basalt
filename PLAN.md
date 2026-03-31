# Basalt MVP Plan

## Summary

Build a single-tenant, PocketBase-inspired admin and API for collections and records with Owner/Admin/User roles, schema migrations, CRUD UI, and headless API access. Use Next.js App Router under `src/`, shadcn + `next-themes`, and the `@` -> `src/` alias.

## Foundation and Tooling

- [x] Scaffold Next.js App Router with TypeScript, Tailwind, and `src/` layout
- [x] Ensure App Router only (no `pages/` directory)
- [x] Configure `@/*` alias to `src/*` in `tsconfig.json`
- [x] Initialize shadcn and `next-themes` with class-based theme support
- [x] Add theme provider and dark mode toggle
- [x] Set up linting and formatting (ESLint, Prettier)
- [x] Add Vitest config and base test harness
- [x] Setup Docker compose file for local Postgres
- [x] Create a `.env.local` file with the local Postgres connection string

## Auth, Roles, and Onboarding

- [x] Local email/password auth (Better Auth + Drizzle + Postgres; no Clerk)
- [x] Access levels: Owner, Admin, User (`access_levels` table + seed; users link via `access_level_id`)
- [x] Owner is superuser-equivalent (enforce in app/tRPC)
- [x] Only Owner can assign Owner role
- [x] Owner role can be granted or revoked by another Owner
- [x] Admin can invite/create users and assign non-Owner roles
- [x] User can update own profile
- [x] Default Owner seeded (`pnpm db:seed`: `basalt@basalt.local` / `basalt`; change for production)
- [x] Onboarding prompt to create first collection

## Collections and Schema

- [ ] Create, edit, delete collections
- [ ] Field types: text, number, boolean, date, json
- [ ] Field settings: required, default value, unique
- [ ] Enforce schema change rules
- [ ] Support field renames
- [ ] Restrict unsafe type changes
- [ ] Require explicit confirmation before deleting fields
- [ ] Do not generate migrations for collection creation or schema changes
- [ ] Store collection schemas as metadata and apply changes at runtime

## Records and Admin UI

- [ ] CRUD UI for any collection
- [ ] Table view with pagination (default 25 per page)
- [ ] Search with simple contains across text fields
- [ ] Default sort by `created_at` desc with user override
- [ ] Record detail view with inline editing
- [ ] Validation rules
- [ ] Text min and max length
- [ ] Number min and max
- [ ] JSON validity checks
- [ ] Display validation errors in UI

## API Access and Permissions

- [ ] tRPC for internal app usage
- [ ] REST-ish JSON endpoints for external usage
- [ ] API key auth via `Authorization: Bearer <key>`
- [ ] Error shape `{ "error": { "code": string, "message": string } }`
- [ ] API keys scoped by role and optional collection allowlist
- [ ] Per-collection API permissions toggles for read/create/update/delete
- [ ] Per-endpoint role requirements (admin-only or owner-only)
- [ ] Rate limiting per API key (configurable constant)

## Import and Export

- [ ] Export collections as JSON, SQL, or CSV
- [ ] Include collection schema + data in export payloads
- [ ] Import into another instance from JSON, SQL, or CSV exports
- [ ] Validate import compatibility and surface errors

## Audit Trail

- [ ] Add audit fields to all collections
- [ ] `created_at`, `updated_at`, `created_by`, `updated_by`
- [ ] Audit fields are system-owned and immutable
- [ ] Show audit fields read-only in record detail

## Example Content and Seeds

- [ ] Create default `posts` collection
- [ ] Seed local dev data for `posts`

## UI and UX

- [ ] Mobile-friendly responsive layout
- [ ] Dark mode toggle in header or settings

## Ops, Environment, and Deployment

- [x] Local Docker Postgres setup
- [x] Drizzle config and migrations pipeline (`drizzle.config.ts`, `pnpm db:generate` / `db:migrate` / `db:push`, `pnpm db:seed`)
- [ ] Migrations only for base tables: users, superusers, posts, logs, collections metadata
- [ ] Environment config for local and production
- [ ] Vercel deployment uses App Router defaults

## Tests and Acceptance

- [ ] Smoke test: auth flow (login, logout)
- [ ] Smoke test: create/edit/delete collection
- [ ] Smoke test: create/edit/delete record
- [ ] Smoke test: API key access for read and write
- [ ] Build passes with `pnpm build`

## Non-Goals (MVP)

- [ ] No multi-tenant organizations
- [ ] No file uploads or storage
- [ ] No realtime subscriptions
- [ ] No advanced query builder
- [ ] No OAuth providers beyond email/password
