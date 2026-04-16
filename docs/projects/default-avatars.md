# Default avatars (Robohash)

## Overview

Set a **default avatar** for users who have not uploaded an image, using [Robohash](https://robohash.org/) (or equivalent stable URL strategy) so profiles look recognizable without file storage.

- **In scope:** Default avatar URL generation/assignment for users without a custom image.
- **Out of scope:** User-uploaded avatars and storage (non-goal for MVP in [Project.md](../../Project.md)).

## Definition of done

- New or existing users without an avatar get a **deterministic or random** Robohash-backed default (per [PLAN.md](../../PLAN.md)).
- Avatar displays wherever user identity is shown in the app (within current auth/profile UI).
- PLAN.md “Avatar” line can be checked off when shipped.

## Tasks

- [ ] Avatar: By default set random avatar using: https://robohash.org (later)
