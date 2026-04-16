# Ops, environment, and deployment

## Overview

Harden **how Basalt runs** outside local Docker: documented environment variables for local vs production, Vercel deployment aligned with App Router defaults, and clarity that **Drizzle migrations** cover **platform/base tables only** while **per-collection** heaps are managed at runtime—with production **backups/runbooks** called out where still TBD.

- **In scope:** Env configuration story, Vercel + Next.js App Router deployment expectations, and operational notes tied to PLAN’s remaining ops bullets.
- **Out of scope:** Multi-region HA or vendor-specific runbooks unless you explicitly add them later.

## Definition of done

- **Checked-in Drizzle migrations** are clearly documented as **base schema only**; per-collection DDL remains app-issued with idempotent guards; **backups/runbooks** gaps are either closed or explicitly documented as follow-ups ([PLAN.md](../../PLAN.md)).
- **Environment config** for local and production is documented and wired (secrets, `DATABASE_URL`, auth URLs, etc.) per deployment needs.
- **Vercel** deployment is verified to use **App Router** defaults appropriately.
- PLAN.md ops checkboxes are updated when each line is satisfied.

## Tasks

- **Checked-in Drizzle migrations** = platform/base schema only (users, auth, `collections` metadata registry, logs, etc.); **per-collection data tables** are created and evolved **at runtime** via app-issued DDL with idempotent guards and logging (backups / runbooks TBD for production)
- Environment config for local and production
- Vercel deployment uses App Router defaults