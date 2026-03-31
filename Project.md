# Basalt Project

In this file, we will define what features and functionality we want to deliver for Basalt.

The inspiration for this project is: https://pocketbase.io. We will include a lot of the same features, but not everything so don't make assumptions while we flesh out this file and eventually `Plan.md`.

## Tech Stack and Tools

- Better Auth / Next.js (local email/password; OAuth later)
- Docker (local Postgres)
- Drizzle
- Eslint
- Lucide
- Next.js
- Node.js
- Postgres
- Prettier
- Tailwind
- tRPC
- Vercel
- Vitest
- Zod

## MVP Principles

- Single-tenant to start (one workspace per deployment)
- Opinionated defaults over configurability
- Ship a usable admin UI first, then expand API surface

## MVP Scope (Detailed)

### Auth and Users

- Better Auth with Postgres (email/password for MVP); default Owner from `pnpm db:seed`
- Roles as data: `access_levels` (Owner, Admin, User) with users referencing `access_level_id`
- Owner is equivalent to superuser
- Only Owner can assign the Owner role to others
- Owner role can be granted or revoked by another Owner
- Admin can invite/create users and assign roles
- User can update their own profile

### Collections and Fields

- Create, edit, delete collections
- Field types: text, number, boolean, date, json
- Field settings: required, default value, unique (per collection)
- Schema changes create database migrations automatically
- Schema change rules:
- Renames are supported
- Type changes only allowed when safe (ex: text -> json disallowed)
- Deleting fields requires explicit confirmation

### Records (CRUD)

- Admin UI for CRUD on any collection
- Basic table view with pagination and search (simple contains)
- Record detail view with editable fields and validation errors
- Sorting: default by created_at desc, allow user to change sort per view
- Pagination: default 25 per page
- Search: simple contains across text fields only
- Validation: min/max length for text, min/max for number, JSON must be valid

### API Access (Headless)

- API keys scoped to role (Admin/User) with optional collection allowlist
- tRPC for internal app usage; REST-ish JSON endpoints for external usage
- Basic rate limiting per API key (configurable constant)
- Auth: API key via `Authorization: Bearer <key>`
- Error shape: `{ "error": { "code": string, "message": string } }`
- Per-collection API permissions: read/create/update/delete can be toggled
- Per-endpoint role requirement: admin-only or superuser-only where applicable

### Import and Export

- Export collections as JSON, SQL, or CSV
- Export includes schema + data
- Import into another instance from JSON, SQL, or CSV exports

### Posts (Example Collection)

- Provide a default `posts` collection to demonstrate end-to-end flow
- Seed data for local dev

### Ops and Quality

- Env config for local and production (Better Auth secret/URL, DB, API keys)
- Minimal audit trail: created_at, updated_at, created_by, updated_by
- Tests: smoke tests for auth, collection CRUD, record CRUD
- Audit trail is system-owned, immutable, and shown read-only in record detail
- Onboarding: seed default Owner (`db:seed`); prompt to create first collection (later)

## Non-Goals for MVP

- Multi-tenant organizations
- File uploads and storage
- Realtime subscriptions
- Advanced query builder (filters, joins)
- SSO/OAuth providers beyond email/password

## Main Features

- Authentication
- Auth Levels: Admin, User
- User creation
- Provide login service with username/password only for MVP
  - Keep in mind support for logging in with Google, Github, and Apple
- Collection creation (see pocketbase.io for example)
- CRUD operations for all collections
- Ability to edit collection (table) shapes and fields
- Posts
- APIs to fetch and update collection values from outside the main UI (headless CRM)
- Implement tRPC
- Mobile friendly / reactive layout
- Dark mode toggle
