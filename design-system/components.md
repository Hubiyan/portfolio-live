# Components reference

Class names and roles as implemented in [`style.css`](../style.css). Compose with markup from [`index.html`](../index.html) as examples.

## Buttons

| Classes | Role |
|---------|------|
| `.my-button` | Base: flex, padding, pill radius, font weight |
| `.btn-primary` | Primary fill (`--blue-300` / hover / active) |
| `.btn-seco` | Secondary dark grey fill |
| `.btn-social` | Outlined / light social style (uses border and blue tints) |
| `.icon-btn` | Adjusted padding for icon-only buttons |
| `.btn-smaller` | Reduced padding modifier |
| `.button-link` | Wraps `<a>` around buttons; strips underline |
| `.large-btn-icon` | Icon size inside buttons |
| `.case-btn` | Case-study context; has responsive font tweaks |

**Pattern:** `class="my-button btn-primary"` (plus optional `res-0-520-w-100` for full width on small screens).

## Cards and surfaces

| Classes | Role |
|---------|------|
| `.card` | Default white card (radius, padding) |
| `.small-card`, `.big-card` | Bento / hero tiles |
| `.about-card`, `.about-head` | About section card structure |
| `.testimonial-card` | Quote cards in horizontal scrollers |
| `.pseudo-card` | Placeholder / invisible layout helper |
| `.dark-card` | Dark panel; **nests** `.section-title`, `.section-description`, `.heading-three` |
| `.case-study-card` | Case row layout; adjusts `.section-title` size |
| `.case-card` | Inner case testimonial width |
| `.carousel-card` | Modal carousel container; includes progress UI hooks |
| `.company-box` | Bordered company chip area |
| `.exp-card` | Horizontally scrollable experience strip (grab cursor) |
| `.abt-me-card` | (Referenced in responsive blocks) About me variant |

## Chips / tags

| Classes | Role |
|---------|------|
| `.chip` | Base chip |
| `.purple-chip`, `.mellow-chip`, `.yellow-chip`, `.green-chip` | Colorways (hex in CSS) |
| `.chip-wrapper` | Flex wrap row for chips |
| `.available-chip` | Green “availability” style |

## Section & hero shells

| Classes | Role |
|---------|------|
| `.hero-section` | Full viewport hero; mobile overrides |
| `.standard-section` | Default section; mobile horizontal padding |
| `.showcase-section` | Full-height showcase block |
| `.container` | Content width; **min/max width** and mobile `100%` overrides |
| `.bento-wrapper`, `.small-wrapper` | Hero grid layout |
| `.fill-width` | Full-bleed dark band; nests `.section-description`, `.socials-box` |
| `.marg-top-100`, `.marg-top-200` | Section spacing helpers |

## Navigation

| Classes | Role |
|---------|------|
| `.my-nav` | Top / bottom fixed nav context |
| `.nav-floater` | Floating pill bar |
| `.nav-logo-img` | Logo box |
| `.nav-blur-stack`, `.nav-blur-layer` | Blur bands (JS-populated) |

## Testimonials & marquee

| Classes | Role |
|---------|------|
| `.testimonial-container` | Drag-to-scroll (see [behavior.md](./behavior.md)) |
| `.marquee`, `.marquee-inner`, `.marquee-content`, `.marquee-item` | Infinite marquee |
| `.people-avatar`, `.avatars-holder` | Overlapping avatars |
| `.testi-content`, `.testi-tag`, `.testi-avatar` | Testimonial body |

## Misc UI

| Classes | Role |
|---------|------|
| `.dot-div` | Small circular separator |
| `.btn-help-text`, `.lighter-help`, `.help-pop` | Modal helper copy |
| `.divider` | Section divider (see HTML usage) |
| `.show-gradient`, `.top-gradient`, `.bottom-gradient` | Showcase fades |
| `.time-comp` | Live clock block (JS in script.js) |
| `.scroller-indicator`, `.full-width-scroller` | Scroll progress bar |

## Modals / carousel (Bootstrap)

Markup uses Bootstrap `.modal`, `.carousel`, `.carousel-item`, controls. Custom progress: `.carou-progress`. IDs such as `#carouselExampleIndicators` are tied to **both** HTML and [`script.js`](../script.js).

When adding new modals/carousels, either **reuse the established ID pattern and JS hooks** or update JS explicitly.
