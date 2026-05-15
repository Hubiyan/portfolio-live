# Design system documentation

This folder describes the **existing** visual and behavioral system of hubiyan.com as implemented in the root [`style.css`](../style.css), [`index.html`](../index.html), and [`script.js`](../script.js).

**Start here (strict rules):** [`../design-system.md`](../design-system.md) — then [guideline.md](./guideline.md) for this folder’s index.

| Doc | Purpose |
|-----|---------|
| [`../design-system.md`](../design-system.md) | **Authoritative** mandatory rules, `.ds-*` twin map, subpage shell appendix |
| [guideline.md](./guideline.md) | Entry point linking authoritative doc + folder references |
| [snippets/subpage-shell.html](./snippets/subpage-shell.html) | Nav + Get in touch modal fragment (`../` paths) |
| [tokens.md](./tokens.md) | Colors, spacing scale, typography-token overlap, nav blur variables |
| [components.md](./components.md) | Buttons, cards, chips, sections, nav, testimonials |
| [layout-and-bootstrap.md](./layout-and-bootstrap.md) | `.container`, flex + `gap-*-box`, `res-0-520-*`, breakpoints |
| [behavior.md](./behavior.md) | `script.js` coupling—classes and IDs not to rename casually |

These files are **not** served as part of the public site unless your host publishes the whole repo; they are for authors and tooling.
