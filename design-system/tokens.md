# Tokens reference

All values below are defined in [`style.css`](../style.css) unless noted. This file is descriptive only.

## Spacing scale (`--spacing-*`)

- **Pattern:** `--spacing-02` through `--spacing-200` (and beyond in the file), stepping by **0.125rem** per step in the numeric suffix (e.g. `--spacing-16` = 1rem).
- **Critical convention:** The same variables are often used for **`font-size`**, **`padding`**, **`gap`**, **`border-radius`**, etc. Changing one token can ripple across typography and layout. When adjusting “type scale,” check every use of that token or introduce a **new** token instead of repurposing an existing one.

## Colors

### Grey ramp

| Token | Typical role |
|--------|----------------|
| `--grey-50` … `--grey-900` | Neutrals, borders, text hierarchy, dark surfaces |

### Blue ramp

| Token | Typical role |
|--------|----------------|
| `--blue-50` … `--blue-1000` | Primary actions, links accents, social button states |

### Surfaces / background

| Token | Role |
|--------|------|
| `--bg-white` | White panels, cards |
| `--bg-grey` | **Page background** (`body`) |
| `--bg-video` | Used where video-related areas need a light surface |

### Audit note

- `.btn-social` uses `var(--white-50)` in [`style.css`](../style.css); that variable is **not** listed in the main `:root` block in the same file. If social buttons look wrong in some browsers, verify whether `--white-50` is defined elsewhere or should be aligned with an existing token (e.g. `--blue-50` / `--bg-white`)—**fix only after following [guideline.md](./guideline.md)**.

## Typography (class-based, not separate type tokens)

Headings and text rely on **classes**, with sizes often coming from **`var(--spacing-*)`**:

| Class | Notes |
|--------|--------|
| `.main-title` | Hero-style title; responsive font sizes under 520px (see media queries) |
| `.hi-there`, `.hi-tag` | Hero intro line + tag |
| `.main-description` | Hero / lead body |
| `.section-title` | Section headings; nested overrides in `.dark-card`, `.case-study-card`, etc. |
| `.section-description` | Section subcopy |
| `.button-cat` | Modal / CTA group labels (font-weight 500) |
| `.gradient-h` | Gradient text utility |
| `.case-title` | Case study titles |

Global: `body` uses **Outfit**, `line-height: 120%`, letter-spacing 0; `h1–h6` and `p` margins reset.

## Radii and shadows

- **Card / UI radius:** commonly `var(--spacing-22)` or `var(--spacing-16)` depending on component.
- **Pill buttons:** `.my-button` uses `border-radius: var(--spacing-100)` (large radius).
- **Shadows:** Many components use longhand `box-shadow` values in px (not tokenized). New components should **match visual weight** of nearest sibling (e.g. `.nav-floater`, `.people-avatar`).

## Nav blur stack (custom properties)

Defined near `.my-nav` / `.nav-blur-stack` in [`style.css`](../style.css). Examples:

- `--nav-blur-layers`, `--nav-blur-min`, `--nav-blur-max`, `--nav-blur-angle`
- `--nav-blur-height` (also adjusted in `@media (max-width: 520px)`)
- `--nav-blur-width`, `--nav-blur-bottom`, `--nav-blur-z`

[`script.js`](../script.js) builds layers in `#navBlurStack` from these values; changing variable **names** requires JS updates.

## Reduced motion

- `@media (prefers-reduced-motion: no-preference)` wraps some motion-related rules—preserve accessibility when adding animations.
