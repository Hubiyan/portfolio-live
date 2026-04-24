# Behavior and fragile selectors

[`script.js`](../script.js) assumes certain class names and IDs. Renaming these in HTML/CSS **without** updating JS will break behavior.

## Marquee

- **Selector:** `.marquee` with children `.marquee-inner`, `.marquee-content`
- **Behavior:** Clones first `.marquee-content` for seamless loop; animates `translateX` on `.marquee-inner`

## Mobile nav

- **Selector:** `.my-nav`
- **Behavior:** Under 520px width, forces fixed bottom positioning and z-index via inline styles on scroll/touch.

## Testimonial / horizontal drag scroll

- **Selector:** `.testimonial-container`
- **Behavior:** Mouse drag to scroll horizontally (`mousedown` / `mousemove` / `mouseleave` / `mouseup`)

## Scroll progress bar

- **Selector:** `.scroller-indicator`
- **Behavior:** Width set from scroll percentage of document

## Bootstrap carousel + progress

- **Selector:** `#carouselExampleIndicators` inside a `.carousel-card`
- **Behavior:** Updates `.carou-progress` width; disables `.carousel-control-prev` on first slide; listens for `slid.bs.carousel`

If you add a **second** carousel with the same needs, **do not duplicate the same ID**; extend the script to accept multiple carousels (or shared class-based selectors).

## Live clock

- **Selector:** `.time-comp`
- **Data attributes:** `data-timezone`, `data-city` (optional; defaults in JS)
- **Child selectors:** `.city`, `.hm`, `.ampm`

## Confetti

- **Selector:** `#confetti-trigger` (hidden); uses `Confetti` from `confetti.min.js`
- **Behavior:** Fires once when user scrolls to bottom of page

## Nav blur layers

- **Selector:** `#navBlurStack` with dynamically added `.nav-blur-layer` children
- **Behavior:** Reads CSS custom properties from `document.documentElement` (see [tokens.md](./tokens.md) nav blur section)
- **Important:** On `width <= 520`, clears inner HTML (no blur layers)

## Reduced-motion note

If you add motion-heavy features, align with existing `prefers-reduced-motion` usage in [`style.css`](../style.css).
