# Project plans

This directory holds **multi-step initiatives**: each file is one project with an overview, a definition of done, and a checklist of tasks.

## How this relates to other docs

- **[Project.md](../../Project.md)** — Product scope and MVP principles.
- **[PLAN.md](../../PLAN.md)** — Technical implementation checklist and deep notes; it remains the detailed spec. Project files here **lift** remaining work into trackable units and acceptance-style goals.

## Naming

- One Markdown file per project: **kebab-case**, e.g. `import-export.md`.
- Copy **[\_template.md](./_template.md)** when starting a new project.

## One-off work vs projects

- **Bugfixes, small chores, and quick follow-ups** — Track in issues/PRs, or in `.ai/issues.md` when discovered during development. They do not need a file under `docs/projects/` unless they grow into a larger initiative.
- **Projects** — Use when work spans multiple steps, has a clear user- or ops-facing outcome, and benefits from a shared definition of done (this folder).

## Current projects

| Project | File |
| ------- | ---- |
| Import and export | [import-export.md](./import-export.md) |
| Records UX (slide-in vs full page) | [records-ux-layout.md](./records-ux-layout.md) |
| Default avatars (Robohash) | [default-avatars.md](./default-avatars.md) |
| Ops, environment, deployment | [ops-deployment.md](./ops-deployment.md) |
| Mobile-friendly responsive layout | [mobile-responsive-layout.md](./mobile-responsive-layout.md) |
