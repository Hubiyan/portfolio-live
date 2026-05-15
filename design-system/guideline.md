# Design system — working guideline

**Authoritative rules:** [`../design-system.md`](../design-system.md)

This folder (`design-system/`) holds **reference** descriptions of what is already implemented in the site:

| Doc | Purpose |
|-----|---------|
| [tokens.md](./tokens.md) | Colors, spacing, typography-token overlap |
| [components.md](./components.md) | Buttons, cards, sections, nav |
| [layout-and-bootstrap.md](./layout-and-bootstrap.md) | `.container`, flex + `gap-*-box`, breakpoints |
| [behavior.md](./behavior.md) | `script.js` coupling (if present) |

**Before changing tokens or shared components:** read [`../design-system.md`](../design-system.md) § **How the flow works**, § Mandatory rules, and the Review gate.

**Subpage / Prompts reuse:** use the `.ds-*` twin map and implementation checklist in [`../design-system.md`](../design-system.md).

**New lab UIs:** register scoped classes per [`../design-system.md`](../design-system.md) **Lab / interactive tool components** (e.g. AI Bro Detector) and implement only under `body.ai-bro-lab` in `style.css`.
