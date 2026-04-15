# Design philosophy

Basalt’s UI is **text-first**, **minimal**, and **system-driven**: lots of whitespace, almost no decorative chrome, and typography that does the work. We use **Tailwind CSS** for layout and tokens, **shadcn/ui** for accessible primitives, and **Lucide** for small functional icons—colors can vary; contrast and hierarchy matter more than matching a single palette.

## Principles

### Typography

- Establish **clear roles**: page/brand line, section headings, body, captions, monospace where data or “studio” tone helps.
- Prefer **sentence case** for UI copy unless a proper noun requires otherwise.
- **Body text** stays readable at arm’s length: avoid shrinking core copy below a comfortable size on phones and tablets (see [Responsive](#responsive-and-tablet-friendly)).
- **Links** read as links (underline and/or distinct `text-`* from surrounding body)—not mystery click targets.

### Layout

- **Single-column stacks** for narrative and marketing pages: left-aligned content, generous horizontal padding, vertical rhythm between blocks (logo/wordmark → copy → contact → footer actions).
- **Constrain line length** for prose (`max-w-prose` or similar); let app shells, tables, and tools use wider layouts when the task needs it.
- **Whitespace** defines groups; borders are for real separation (tables, dialogs), not decoration.

### Minimal surface

- **Neutral surfaces**, one strong accent for primary actions; avoid competing gradients and competing “hero” treatments on one screen.
- **Icons** clarify (footer links, theme toggle, nav); pair with labels when the action isn’t universal—except compact toolbars where icons are standard (e.g. GitHub, LinkedIn, globe, moon).
- **Motion**: focus rings and light hover/focus feedback only.

### System over one-offs

- Compose from **shadcn** patterns in-repo; extend shared components instead of one-off widgets.
- Use **Tailwind** tokens (`bg-`*, `text-*`, `border-*`, radii) so **dark mode** stays coherent via `ThemeProvider` and the root theme script.
- **Accessibility**: semantic HTML, focus order, keyboard paths—verify in real flows, not only defaults.

### Data and tools

- **Tables and lists**: scannable headers, aligned numbers, minimal cell chrome.
- **Forms**: consistent label / help / error; single column unless fields are tightly paired.
- **Empty and loading** states: short, factual—no marketing filler.

## Marketing & landing surfaces

A **calm, text-forward** page (developer-/studio-style) fits this doc when it:

- Puts **copy in a narrow column** with **large vertical gaps** between logo, paragraphs, contact line, and footer.
- Optionally uses **monospace for body** (`font-mono`) for a restrained, editorial feel while keeping the **brand line** in a distinct treatment (e.g. display or script)—only if it stays legible and doesn’t fight app UI elsewhere.
- Ends with a **compact icon row** (e.g. social, site, repo, theme): `flex` + `gap`, Lucide or brand SVGs, with [touch-friendly](#responsive-and-tablet-friendly) targets—not a cramped string of glyphs.

## Responsive and tablet-friendly

Tablets are a **first-class** width, not a stretched phone layout.

- **Padding**: increase horizontal padding from phone to tablet (`px-`* → `md:px-*`) so content doesn’t hug the bezel.
- **Tap targets**: interactive icons and links in footers and nav aim for **at least ~44×44px** hit area (padding on the control or `min-h` / `min-w` + flex centering), even if the glyph is smaller.
- **Type**: avoid stepping body text down on tablet; if anything, **slightly larger** line-height or size for comfortable reading at arm’s length.
- **Layout**: keep **one column** for narrative pages; introduce side-by-side layouts only when the content truly benefits (e.g. form + aside), and test at `md` breakpoints.

## Stack in practice


| Layer         | Role                                                   |
| ------------- | ------------------------------------------------------ |
| **Tailwind**  | Spacing, type, color, layout, breakpoints              |
| **shadcn/ui** | Buttons, inputs, dialogs, menus—accessible, composable |
| **Lucide**    | Small icons for footers, actions, and wayfinding       |


## What we avoid

- Decorative imagery as filler  
- Multiple competing hero styles on one page  
- Custom CSS that duplicates tokens and components  
- Dense borders where spacing and type do the job

## Evolution

Ask: **Can this be mostly type, spacing, and an existing component?** If yes, it fits. New patterns belong here or in the feature note so the system stays intentional.