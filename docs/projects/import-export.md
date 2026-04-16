# Import and export

## Overview

Allow operators to move collection **schema metadata and row data** between Basalt instances using portable formats. Export should reflect the real physical tables (`col_<table_suffix>`) and the `collections` registry; import should apply data safely with clear errors when a dump is incompatible.

- **In scope:** Export as JSON, SQL, and CSV; import from those formats; validation and user-visible errors on failure.
- **Out of scope:** Incremental sync, multi-tenant migration, or non-MVP query features (see [Project.md](../../Project.md) non-goals).

## Definition of done

- Admins (or documented API) can **export** at least one collection with **schema + rows** from physical tables, in JSON, SQL, and CSV as specified in [PLAN.md](../../PLAN.md).
- Export payloads **include collection schema and data** (tables + rows) in a way that matches PLAN’s intent.
- A **fresh instance** can **import** from a supported export without silent data loss; conflicts or mismatches are **validated** and surfaced as actionable errors.
- Checklist items in **Tasks** below are completed and reflected in [PLAN.md](../../PLAN.md) when shipped.

## Tasks

- Export collections as JSON, SQL, or CSV (**schema metadata + row data from physical tables**)
- Include collection schema + data in export payloads (tables + rows)
- Import into another instance from JSON, SQL, or CSV exports
- Validate import compatibility and surface errors