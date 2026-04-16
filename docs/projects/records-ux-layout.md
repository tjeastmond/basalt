# Records UX: slide-in vs full page

## Overview

Today, collection and record editing uses full pages and expandable rows ([PLAN.md](../../PLAN.md) Records section). This project adds an optional **slide-in panel** experience and a **user setting** to choose slide-in from the right vs whole-page navigation.

- **In scope:** Layout mode for editing collections/tables (slide-in vs full page); settings UI to persist the preference.
- **Out of scope:** Changing core CRUD or validation behavior beyond what is required for the new presentation.

## Definition of done

- Forms for editing collections or records can open in a **slide-in panel** or on a **dedicated full page**, per product rules you define during implementation.
- A **settings** area exposes the choice: slide in/out from the right **or** display on a whole page ([PLAN.md](../../PLAN.md) checklist).
- Behavior is covered by manual QA or automated tests as appropriate; PLAN checklist items are updated when done.

## Tasks

- Forms for editing any collections or tables should slide into view or load on a whole new page (later)
- Add a settings section with the option to have collections slide in/out from the right, or display a whole page (later)