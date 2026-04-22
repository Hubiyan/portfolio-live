# Layout, flex, and Bootstrap

## Stack

- **Bootstrap 5** (grid, flex utilities, modals, carousel) is loaded from [`index.html`](../index.html).
- **Project-specific** spacing uses `.gap-{NN}-box` classes, **not** Bootstrap’s `gap-*` utilities.

## Flex + gap pattern

In markup you will see:

```text
d-flex flex-column gap-32-box
d-flex gap-04-box align-items-center
```

**Rule:** Use **`gap-{NN}-box`** where `NN` matches the spacing scale step (e.g. `04`, `08`, `16`, `32`, `64`, `100`). Definitions live in [`style.css`](../style.css) (search `.gap-32-box`).

## Container

- `.container` sets a **fixed min-width** on large screens and switches to **full width** under 520px with padding removed—see media queries in [`style.css`](../style.css).
- New pages should **reuse `.container`** for main content width unless there is a deliberate full-bleed layout (then use `.fill-width` or explicit structure like the hero).

## Primary breakpoint: 520px

- **Mobile nav** behavior ([`script.js`](../script.js) + CSS): `window.innerWidth <= 520` and CSS `max-width: 520px` blocks.
- **Responsive helper classes** (apply in the 0–520px range as defined in CSS):

| Class | Effect |
|--------|--------|
| `.res-0-520-column` | `flex-direction: column` |
| `.res-0-520-row` | `flex-direction: row` |
| `.res-0-520-column-rev` | `column-reverse` |
| `.res-0-520-align-center` | `align-items: center` |
| `.res-0-520-align-start` | `align-items: flex-start` |
| `.res-0-520-gap-32` / `-16` / `-08` / `-04` | Gap overrides |
| `.res-0-520-w-100` | `width: 100%` |

**Pattern:** Combine with Bootstrap `d-flex` and project `gap-*-box` classes.

## Other breakpoints

[`style.css`](../style.css) also uses ranges such as **330–520**, **520–840**, **2000–2500** for specific tweaks (titles, margins). Prefer **extending these blocks** rather than introducing many unrelated breakpoints.

## Z-index awareness

- Nav / blur / scroller use high z-index values (e.g. 996–999, 1000). New overlays should **not** guess; stack relative to `.my-nav`, `.nav-floater`, and modals.

## New sections checklist

1. Wrap content in `.container` when matching the rest of the site.
2. Use `.standard-section` or an existing section class if the spacing should match other blocks.
3. Use `.gap-{NN}-box` for internal spacing.
4. Add `res-0-520-*` classes if the Figma-like desktop flex row should collapse on mobile.
