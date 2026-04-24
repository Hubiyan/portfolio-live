/* ================================================================
   PROMPTS TITLE SCRAMBLE — CONTROLS
   ================================================================
   Edit only PROMPTS_HERO below (single source for the hero line).
   Optional: SCRAMBLE_CHARSET for the random glyph pool during scramble.

   The engine (scrambleTextReveal) reads from PROMPTS_HERO automatically.

   Line layout: the engine measures whether the title fits on
   one line or wraps; see groupCharIndicesByLine / applyScrambleLineLayout
   and .prompts-hero-scramble.is-single-line | .is-multiline in style.css.

   Character indices in the color arrays correspond to
   Array.from(text) grapheme positions (emoji-safe).
   If a color array is shorter than text, the last value repeats.
   ================================================================ */

// Wide multi-script glyph pool.
// Add / remove characters here to change what appears during scramble.
const SCRAMBLE_CHARSET = [
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    'abcdefghijklmnopqrstuvwxyz',
    '@#$%&*?~',
    '🔥✨🚀🎯🤖🧠🌈',
    '你好世界日',
    'アイウエオカキクケコサ',
    'अआइकह',
    'عربيحروفكتاب',
].join('');

// ── MAIN CONFIG (edit this object only for the hero title) ─────
const PROMPTS_HERO = {
    // ── WHAT & WHEN ──────────────────────────────────────────
    text:         'Supercharged pr*mpts', // final text revealed at end of animation
    /* Assistive tech name (can differ from `text`, e.g. no “*” placeholder). */
    ariaLabel:    'Supercharged prompts',
    duration:     3,    // total animation time, seconds
    revealDelay: .6,   // seconds of all-scramble before left→right reveal begins
    speed:        .08,      // scramble refresh rate: 1 = every frame, 0.3 = slower
    rightToLeft:  false,  // set true to reveal right → left instead

    // ── CHARSET ──────────────────────────────────────────────
    chars: SCRAMBLE_CHARSET, // pool of glyphs used for unrevealed positions

    // ── COLORS ───────────────────────────────────────────────
    // finalCharColors     – CSS color per character once it locks in (is revealed).
    //                       Use any CSS value: 'var(--grey-900)', '#1a1a2e', 'hsl(220 80% 40%)'.
    //
    // scrambleColor       – single color applied to ALL unrevealed (scrambling) chars.
    //
    // scrambleCharColors  – optional per-position override for the scramble phase.
    //                       When non-null, each index overrides scrambleColor for that slot.
    //                       Must be an array of CSS color strings matching text length.
    //                       null → scrambleColor is used for every unrevealed position.

    finalCharColors: [
        //  S                    u                    p                    e                    r
        'var(--grey-900)', 'var(--grey-900)', 'var(--grey-900)', 'var(--grey-900)', 'var(--grey-900)',
        //  c                    h                    a                    r                    g
        'var(--grey-900)', 'var(--grey-900)', 'var(--grey-900)', 'var(--grey-900)', 'var(--grey-900)',
        //  e                    d                 (space)                p                    r
        'var(--blue-900)', 'var(--grey-900)', 'var(--grey-900)', 'var(--grey-900)', 'var(--grey-900)',
        //  o                    m                    p                    t                    s
        '#FF6F00', 'var(--grey-900)', 'var(--grey-900)', 'var(--grey-900)', 'var(--grey-900)',
    ],
    scrambleColor:      '#000000',         // fallback if scrambleColorPalette is not set
    scrambleCharColors: null,              // e.g. ['red','blue',...]; null = use palette/scrambleColor
    // scrambleColorPalette – array of colors randomly assigned per scrambling char each tick.
    // Add, remove, or reorder colors here to change the glitch palette.
    scrambleColorPalette: [
        '#000000', // black
        '#FF7B00', // orange
        '#25E000', // green
        '#4871F7', // blue
    ],
    // In `text`, this character is replaced with `starImageSrc` once revealed. Infinite
    // rotation after the full title run. Asset: images/btn-icons/star.png
    starImageSrc: '../images/btn-icons/star.png',
    starChar: '*',
    // Wrap the last word in a no-break group so the star can’t end up on its own line.
    lastWordNoWrap: true,
};

const PROMPTS_SCRAMBLE = PROMPTS_HERO; /* alias: same object, for spread in DOMContentLoaded */

if (Array.isArray(PROMPTS_HERO.finalCharColors)
    && PROMPTS_HERO.finalCharColors.length !== Array.from(PROMPTS_HERO.text).length) {
    console.warn(
        '[prompts] PROMPTS_HERO.finalCharColors length should match PROMPTS_HERO.text (grapheme count).',
        { textLength: Array.from(PROMPTS_HERO.text).length, colorsLength: PROMPTS_HERO.finalCharColors.length },
    );
}

/* ----------------------------------------------------------------
   scrambleTextReveal(el, opts)

   Replaces el's text content with per-character <span>s and runs
   a requestAnimationFrame loop that scrambles random glyphs then
   reveals the final characters left-to-right over `duration` ms.

   el receives aria-label = opts.ariaLabel (if non-empty string) else opts.text
   so the accessible name can differ from the visible/scrambled string.

   Returns a cancel function: call it to abort mid-animation.

   Line layout: after fonts load, the engine measures where each
   character span wraps. One visual line  →  one flex row, nowrap.
   Two (or more) lines  →  column of rows (reading order: top
   to bottom, each row LTR). Reveal order is still a single
   L→R pass over the full string in reading order.
---------------------------------------------------------------- */

function groupCharIndicesByLine(spans, epsilon) {
    const e = epsilon != null ? epsilon : 2;
    if (!spans.length) return [[]];
    const items = spans.map((span, i) => {
        const r = span.getBoundingClientRect();
        return { i, top: r.top, left: r.left };
    });
    items.sort((a, b) => (Math.abs(a.top - b.top) <= e ? a.left - b.left : a.top - b.top));
    const lines = [];
    let start = 0;
    for (let k = 1; k <= items.length; k += 1) {
        if (k === items.length || Math.abs(items[k].top - items[k - 1].top) > e) {
            const seg = items.slice(start, k);
            seg.sort((a, b) => a.i - b.i);
            lines.push(seg.map((s) => s.i));
            start = k;
        }
    }
    return lines;
}

/* Wraps the last word BEFORE line measurement so the browser treats it as one unit.
   Correct order: wrap → measure → layout. Without pre-wrapping, the browser can break
   inside the last word (e.g. between 'r' and '*'), putting the star on its own line. */
function buildLastWordNowrap(wrapper, spans, graphemes, n) {
    const li = Array.from(graphemes).lastIndexOf(' ');
    if (li < 0 || li >= n - 1) return null;
    const a = li + 1;
    const b = n - 1;
    const g = document.createElement('span');
    g.className = 'prompts-hero-nowrap';
    wrapper.insertBefore(g, spans[a]);
    for (let i = a; i <= b; i += 1) g.appendChild(spans[i]);
    return { g, a, b };
}

/* Appends a line-group of span indices to a row, substituting the nowrap g block when found. */
function appendLineGroupToRow(row, group, spans, wordWrap) {
    if (!wordWrap) {
        group.forEach((idx) => row.appendChild(spans[idx]));
        return;
    }
    const { g, a, b } = wordWrap;
    const len = b - a + 1;
    let p = 0;
    while (p < group.length) {
        if (group[p] === a && p + len - 1 < group.length && group[p + len - 1] === b) {
            row.appendChild(g);
            p += len;
        } else {
            row.appendChild(spans[group[p]]);
            p += 1;
        }
    }
}

/* Move span nodes into 1 (single line) or N (wrapped) line rows. */
function applyScrambleLineLayout(wrapper, spans, lineGroups, wordWrap) {
    wrapper.classList.remove('is-single-line', 'prompts-hero-scramble--measuring');
    /* Detach everything; if wordWrap.g exists it stays in memory and keeps last-word spans. */
    wrapper.textContent = '';
    if (lineGroups.length === 1) {
        const row = document.createElement('span');
        row.className = 'prompts-hero-scramble-line';
        appendLineGroupToRow(row, lineGroups[0], spans, wordWrap);
        wrapper.appendChild(row);
        wrapper.classList.add('is-single-line');
    } else {
        lineGroups.forEach((group) => {
            const row = document.createElement('span');
            row.className = 'prompts-hero-scramble-line';
            appendLineGroupToRow(row, group, spans, wordWrap);
            wrapper.appendChild(row);
        });
        
    }
    wrapper.classList.remove('prompts-hero-scramble--measuring');
}

function scrambleTextReveal(el, opts) {
    const text        = opts.text || el.textContent.trim() || '';
    const charsPool   = Array.from(opts.chars || 'ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    const duration    = Math.max(0.1, opts.duration    || 1.5) * 1000;
    const revealDelay = Math.max(0,   opts.revealDelay || 0)   * 1000;
    const speedFactor = Math.max(0.01, opts.speed != null ? opts.speed : 1);
    const rtl         = !!opts.rightToLeft;
    const finalColors   = opts.finalCharColors  || [];
    const scrColors     = Array.isArray(opts.scrambleCharColors) ? opts.scrambleCharColors : null;
    const scrColor      = opts.scrambleColor || 'inherit';
    const scrPalette    = Array.isArray(opts.scrambleColorPalette) && opts.scrambleColorPalette.length
        ? opts.scrambleColorPalette : null;

    const graphemes   = Array.from(text);
    const n           = graphemes.length;
    if (n === 0) return () => {};
    const starChar    = opts.starChar;
    const starSrc     = opts.starImageSrc;
    const starIndex   = (starChar && starSrc) ? graphemes.findIndex((c) => c === starChar) : -1;
    const ensureStarImg = (slot) => {
        if (slot.querySelector('img')) return;
        slot.textContent = '';
        const img = document.createElement('img');
        img.src = starSrc;
        img.className = 'prompts-hero-title-star';
        img.alt = '';
        img.setAttribute('draggable', 'false');
        img.decoding = 'async';
        slot.appendChild(img);
    };

    function rndChar() {
        return charsPool[Math.floor(Math.random() * charsPool.length)];
    }

    /* Lock in the accessible name before any visual mutation. */
    const accessibleName = (typeof opts.ariaLabel === 'string' && opts.ariaLabel.trim() !== '')
        ? opts.ariaLabel
        : text;
    el.setAttribute('aria-label', accessibleName);

    const scrambled = graphemes.map(() => rndChar());
    function rndPaletteColor() {
        return scrPalette[Math.floor(Math.random() * scrPalette.length)];
    }
    const scrambledColors = graphemes.map(() => (scrPalette ? rndPaletteColor() : scrColor));

    function finalColor(i) {
        if (!finalColors.length) return 'inherit';
        return finalColors[Math.min(i, finalColors.length - 1)];
    }

    function scrambleColor(i) {
        if (scrColors && scrColors.length) {
            return scrColors[Math.min(i, scrColors.length - 1)];
        }
        if (scrPalette) return scrambledColors[i];
        return scrColor;
    }
    const tickMs = (1000 / 60) / speedFactor; // ms between scramble refreshes
    let lastTick = 0;
    let rafId;
    let cancelled = false;

    /* Build one <span> per grapheme inside an aria-hidden wrapper. */
    const wrapper = document.createElement('span');
    wrapper.setAttribute('aria-hidden', 'true');
    wrapper.className = 'prompts-hero-scramble prompts-hero-scramble--measuring';
    const spans = graphemes.map((g, i) => {
        const s = document.createElement('span');
        s.textContent = g; /* final copy — needed for correct wrap / line group rects */
        if (i === starIndex) s.classList.add('prompts-hero-title-star-slot');
        return s;
    });
    el.style.visibility = 'hidden';
    el.textContent = '';
    el.appendChild(wrapper);
    wrapper.append(...spans);

    function render(now) {
        if (cancelled) return;
        const elapsed = now - t0;
        const afterDelay = Math.max(0, elapsed - revealDelay);
        const window_ms = Math.max(1, duration - revealDelay);
        const progress = Math.min(1, afterDelay / window_ms);
        const revealed = Math.round(progress * n);

        /* Refresh scramble glyphs + colors at `speed`-controlled rate. */
        if (elapsed - lastTick >= tickMs) {
            for (let i = 0; i < n; i += 1) {
                scrambled[i] = rndChar();
                if (scrPalette) scrambledColors[i] = rndPaletteColor();
            }
            lastTick = elapsed;
        }

        for (let i = 0; i < n; i += 1) {
            const locked = rtl ? i >= n - revealed : i < revealed;
            if (starIndex === i) {
                if (locked) {
                    ensureStarImg(spans[i]);
                    spans[i].style.removeProperty('color');
                } else {
                    const im = spans[i].querySelector('img');
                    if (im) im.remove();
                    spans[i].textContent = scrambled[i];
                    spans[i].style.color = scrambleColor(i);
                }
            } else {
                spans[i].textContent = locked ? graphemes[i] : scrambled[i];
                spans[i].style.color = locked ? finalColor(i) : scrambleColor(i);
            }
        }

        if (progress < 1) {
            rafId = requestAnimationFrame(render);
        } else {
            for (let i = 0; i < n; i += 1) {
                if (starIndex === i) {
                    ensureStarImg(spans[i]);
                    spans[i].style.removeProperty('color');
                } else {
                    spans[i].textContent = graphemes[i];
                    spans[i].style.color = finalColor(i);
                }
            }
            if (starIndex >= 0) {
                const starEl = spans[starIndex].querySelector('.prompts-hero-title-star');
                if (starEl) starEl.classList.add('is-rotating');
            }
            if (typeof opts.onComplete === 'function') opts.onComplete();
        }
    }

    let t0;
    const cancel = () => {
        cancelled = true;
        if (rafId) cancelAnimationFrame(rafId);
        el.style.removeProperty('visibility');
    };

    function startAfterLineMeasure() {
        if (cancelled) return;
        /* Wrap the last word FIRST so the browser measures it as one nowrap unit —
           this ensures 'r' and '*' are always on the same line before we group indices. */
        const wordWrap = opts.lastWordNoWrap
            ? buildLastWordNowrap(wrapper, spans, graphemes, n)
            : null;
        const lineGroups = groupCharIndicesByLine(spans);
        applyScrambleLineLayout(wrapper, spans, lineGroups, wordWrap);
        /* Scramble all slots before the first frame so the user never sees final text. */
        for (let i = 0; i < n; i += 1) {
            spans[i].textContent = scrambled[i];
            spans[i].style.color = scrambleColor(i);
        }
        el.style.visibility = '';
        t0 = performance.now();
        rafId = requestAnimationFrame(render);
    }

    function scheduleLineMeasure() {
        if (cancelled) return;
        /* Two rAFs: layout + one frame for accurate wrap rects. */
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                if (cancelled) return;
                startAfterLineMeasure();
            });
        });
    }

    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => {
            if (cancelled) return;
            scheduleLineMeasure();
        });
    } else {
        scheduleLineMeasure();
    }

    return cancel;
}

document.addEventListener('DOMContentLoaded', () => {
    const ua = navigator.userAgent || '';
    const platform = navigator.platform || '';
    const isTouchMac = platform === 'MacIntel' && navigator.maxTouchPoints > 1;
    const isIOS = /iP(hone|ad|od)/.test(ua) || isTouchMac;
    const isWebKit = /WebKit/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua);
    const shouldUseIOSPerfMode = isIOS && isWebKit;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ---- Scramble title → subtitle → grid cascade ---- */
    const heroTitle    = document.getElementById('prompts-hero-title');
    const heroSubtitle = document.querySelector('.prompts-hero-subtitle');
    const promptsGrid  = document.querySelector('.prompts-grid');
    if (heroTitle) {
        scrambleTextReveal(heroTitle, {
            ...PROMPTS_SCRAMBLE,
            onComplete() {
                if (!heroSubtitle) return;
                heroSubtitle.classList.add('is-visible');
                /* Trigger grid only after subtitle transition fully lands */
                heroSubtitle.addEventListener('transitionend', () => {
                    if (promptsGrid) promptsGrid.classList.add('is-visible');
                }, { once: true });
            },
        });
    }

    /* ---- ASCII art animations on prompt card headings ---- */
    (function initPromptAscii() {
        /* Each frame is a 5×5 grid of box-drawing / block chars.
           Frames auto-cycle; each card gets its own independent loop. */
        const FRAME_SETS = [
            /* Circuit pulse */
            [
                ['┌─┬─┐','│ │ │','├─┼─┤','│ │ │','└─┴─┘'],
                ['╔═╦═╗','║ ║ ║','╠═╬═╣','║ ║ ║','╚═╩═╝'],
                ['┌─┬─┐','├─┼─┤','│ │ │','├─┼─┤','└─┴─┘'],
                ['╔═╦═╗','╠═╬═╣','║ ║ ║','╠═╬═╣','╚═╩═╝'],
            ],
            /* Expanding diamond */
            [
                ['  ·  ','  ·  ','·····','  ·  ','  ·  '],
                [' ╱─╲ ',' │ │ ','─   ─',' │ │ ',' ╲─╱ '],
                ['╱───╲','│   │','│   │','│   │','╲───╱'],
                ['╔═══╗','║   ║','║   ║','║   ║','╚═══╝'],
                ['╔═══╗','╠═══╣','║   ║','╠═══╣','╚═══╝'],
            ],
            /* Spinner */
            [
                ['╔═══╗','║ ▸ ║','║   ║','║   ║','╚═══╝'],
                ['╔═══╗','║   ║','║  ▾║','║   ║','╚═══╝'],
                ['╔═══╗','║   ║','║   ║','║ ◂ ║','╚═══╝'],
                ['╔═══╗','║   ║','║▴  ║','║   ║','╚═══╝'],
            ],
    
            /* Waveform */
            [
                ['▁▂▃▄▅','▂▃▄▅▆','▃▄▅▆▇','▂▃▄▅▆','▁▂▃▄▅'],
                ['▅▄▃▂▁','▆▅▄▃▂','▇▆▅▄▃','▆▅▄▃▂','▅▄▃▂▁'],
                ['▁▃▅▃▁','▂▄▆▄▂','▃▅▇▅▃','▂▄▆▄▂','▁▃▅▃▁'],
                ['▅▃▁▃▅','▆▄▂▄▆','▇▅▃▅▇','▆▄▂▄▆','▅▃▁▃▅'],
            ],
            /* Data blocks */
            [
                ['░░░░░','░░░░░','░░░░░','░░░░░','░░░░░'],
                ['▒░░░░','░▒░░░','░░▒░░','░░░▒░','░░░░▒'],
                ['▓▒░░░','░▓▒░░','░░▓▒░','░░░▓▒','▒░░░▓'],
                ['█▓▒░░','░█▓▒░','░░█▓▒','▒░░█▓','▒░░░█'],
                ['█████','█████','█████','█████','█████'],
                ['▓▓▓▓▓','▓▓▓▓▓','▓▓▓▓▓','▓▓▓▓▓','▓▓▓▓▓'],
                ['▒▒▒▒▒','▒▒▒▒▒','▒▒▒▒▒','▒▒▒▒▒','▒▒▒▒▒'],
                ['░░░░░','░░░░░','░░░░░','░░░░░','░░░░░'],
            ],
        ];

        /* Color palette rotated per card (matches scramble palette for cohesion) */
        const PALETTES = [
            { fg: '#4871F7', bg: 'transparent', border: 'var(--grey-100)' },
            { fg: '#FF7B00', bg: 'transparent', border: 'var(--grey-100)' },
            { fg: '#25E000', bg: 'transparent', border: 'var(--grey-100)' },
            { fg: '#FFE500', bg: 'transparent', border: 'var(--grey-100)' },
            { fg: 'var(--grey-400)', bg: 'transparent', border: 'var(--grey-100)' },
        ];

        document.querySelectorAll('.prompt-block-header').forEach((header, idx) => {
            const titleEl   = header.querySelector('.prompt-card-title');
            if (!titleEl) return;

            const palette   = PALETTES[idx % PALETTES.length];
            const frameSet  = FRAME_SETS[idx % FRAME_SETS.length];
            const INTERVAL  = 340; /* ms per frame */

            /* ── Box element ── */
            const box = document.createElement('div');
            box.className        = 'prompt-ascii-box';
            box.setAttribute('aria-hidden', 'true');
            box.style.setProperty('--ascii-fg', palette.fg);
            box.style.setProperty('--ascii-border', palette.border);

            const pre = document.createElement('pre');
            pre.className = 'prompt-ascii-pre';
            box.appendChild(pre);

            /* Insert before the title */
            header.insertBefore(box, titleEl);

            /* ── Size box to match title height after layout ── */
            function syncSize() {
                const h = titleEl.getBoundingClientRect().height;
                if (h > 0) {
                    box.style.width  = Math.round(h) + 'px';
                    box.style.height = Math.round(h) + 'px';
                }
            }

            /* ── Animation loop ── */
            let frameIdx = 0;
            function renderFrame() {
                const rows = frameSet[frameIdx % frameSet.length];
                pre.textContent = rows.join('\n');
                frameIdx += 1;
            }
            renderFrame();
            syncSize();

            /* Use ResizeObserver to keep size synced */
            if (window.ResizeObserver) {
                new ResizeObserver(syncSize).observe(titleEl);
            }

            /* Start cycling after first paint */
            setInterval(renderFrame, INTERVAL);
        });
    })();

    /* ---- One-shot confetti (no confetti.min.js) ----
       The old library created a full-screen canvas and called requestAnimationFrame
       forever, even with zero particles — expensive on iOS. This animates only
       while a burst is visible, then removes the canvas and stops. */
    const burstMaxMs = 2200;
    /* Slightly more on narrow / iOS than the first one-shot build; still below desktop max. */
    const burstParticleCap = (shouldUseIOSPerfMode || window.matchMedia('(max-width: 520px)').matches) ? 36 : 58;

    function fireConfettiAt(btn) {
        if (prefersReducedMotion) return;
        const rect = btn.getBoundingClientRect();
        const originX = rect.left + rect.width / 2;
        const originY = rect.top + rect.height / 2;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        /* Cap DPR to limit canvas fill cost on high-density phones without timers. */
        const dpr = shouldUseIOSPerfMode
            ? 1
            : Math.min(2, window.devicePixelRatio || 1);

        const canvas = document.createElement('canvas');
        canvas.setAttribute('role', 'presentation');
        canvas.setAttribute('aria-hidden', 'true');
        Object.assign(canvas.style, {
            position: 'fixed',
            left: '0',
            top: '0',
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: '999999999',
        });
        canvas.width = Math.round(vw * dpr);
        canvas.height = Math.round(vh * dpr);
        const ctx = canvas.getContext('2d', { alpha: true });
        if (!ctx) return;
        if (dpr !== 1) {
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.scale(dpr, dpr);
        }

        const particles = [];
        for (let i = 0; i < burstParticleCap; i += 1) {
            /* Full radial burst from the button center (2π). */
            const angle = Math.random() * Math.PI * 2;
            const sp = 7 + Math.random() * 12;
            const speedScale = 0.45 + Math.random() * 0.55;
            particles.push({
                x: originX,
                y: originY,
                vx: Math.cos(angle) * sp * speedScale,
                vy: Math.sin(angle) * sp * speedScale,
                w: 3 + Math.random() * 6,
                h: 2 + Math.random() * 3,
                rot: Math.random() * Math.PI * 2,
                vr: (Math.random() - 0.5) * 0.25,
                /* Same full-spectrum pick as confetti.min.js: hue = 360 * Math.random() */
                hue: 360 * Math.random(),
                life: 1,
                decay: 0.0075 + Math.random() * 0.0065,
            });
        }

        document.body.appendChild(canvas);
        const gravity = 0.32;
        const t0 = performance.now();

        function step(now) {
            const elapsed = now - t0;
            if (elapsed > burstMaxMs) {
                canvas.remove();
                return;
            }
            ctx.clearRect(0, 0, vw, vh);
            let alive = 0;
            for (let p = 0; p < particles.length; p += 1) {
                const c = particles[p];
                if (c.life <= 0) continue;
                alive += 1;
                c.vy += gravity;
                c.x += c.vx;
                c.y += c.vy;
                c.vx *= 0.99;
                c.vy *= 0.999;
                c.rot += c.vr;
                c.life -= c.decay;
                if (c.life <= 0) continue;
                const a = Math.max(0, Math.min(1, c.life));
                ctx.save();
                /* Match original confetti draw: hsla(hue, 90%, 65%, opacity) */
                ctx.fillStyle = `hsla(${c.hue % 360}, 90%, 65%, ${a})`;
                ctx.translate(c.x, c.y);
                ctx.rotate(c.rot);
                ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
                ctx.restore();
            }
            if (alive > 0) {
                requestAnimationFrame(step);
            } else {
                canvas.remove();
            }
        }
        requestAnimationFrame(step);
    }

    /* ---- Copy to clipboard helper ---- */
    async function copyText(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
            return;
        }
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } finally { document.body.removeChild(ta); }
    }

    /* ---- Encouragement messages — random on each copy ---- */
    const ENCOURAGEMENTS = [
        'Copied. Now go supercharge your design.',
        'Locked in. Paste it and let AI think with you.',
        'Yours now. create something meaningful ☺️',
        'Copied. your creativity is now AI powered.',
        'It\u2019s yours. you are now on 🔥.',
        'Copied. you are now limited only by your imagination.',
        'In your clipboard. Go build the magic.',
        'Stolen for greatness. Paste to your fav AI.',
        'Copied. one step closer to your best design.',
        'Ready to paste. Design at the speed of thought.',
        'Copied. Skip the busywork, design the bigger thing.',
        'Done. Use the saved minutes on craft.',
        'Copied. Iterate fearlessly.',
        'In hand. Let AI handle the it for your creativity.',
        'Copied. Make your next design the best one yet.'
    ];
    let lastMsgIndex = -1;
    function pickEncouragement() {
        if (ENCOURAGEMENTS.length <= 1) return ENCOURAGEMENTS[0];
        let i;
        do {
            i = Math.floor(Math.random() * ENCOURAGEMENTS.length);
        } while (i === lastMsgIndex);
        lastMsgIndex = i;
        return ENCOURAGEMENTS[i];
    }

    /* How long the green "copied" toast (and checkmark state) stay visible, ms. */
    const COPIED_TOAST_MS = 4000;

    /* ---- Toast helper ----
       Single slot: a new showToast() invalidates pending hide + delayed DOM clear
       (avoids empty green bar / wrong variant if user switches between cards). */
    const live = document.getElementById('prompts-copy-status');
    let clearToastTextTimer = null;
    let toastToken = 0;

    function showToast(msg, variant) {
        if (!live) return 0;
        if (clearToastTextTimer) {
            clearTimeout(clearToastTextTimer);
            clearToastTextTimer = null;
        }
        toastToken += 1;
        const token = toastToken;
        live.textContent = msg;
        live.classList.toggle('is-soon', variant === 'soon');
        live.classList.add('is-visible');
        return token;
    }

    function hideToast() {
        if (!live) return;
        if (clearToastTextTimer) {
            clearTimeout(clearToastTextTimer);
            clearToastTextTimer = null;
        }
        live.classList.remove('is-visible');
        /* clear text + reset variant after fade-out transition (200ms) */
        clearToastTextTimer = setTimeout(() => {
            clearToastTextTimer = null;
            live.textContent = '';
            live.classList.remove('is-soon');
        }, 220);
    }

    function hideToastIfToken(token) {
        if (token === toastToken) {
            hideToast();
        }
    }

    /* ---- Card-level click — entire card is the copy target ---- */
    const resetTimers = new WeakMap();

    document.querySelectorAll('.prompt-block').forEach((card) => {
        card.addEventListener('click', async () => {
            const btn = card.querySelector('.prompt-copy-btn');
            if (!btn) return;

            /* Coming-soon cards: dark toast, always (even if another card just showed green). */
            if (card.classList.contains('is-coming-soon')) {
                const t = showToast('Dropping soon', 'soon');
                clearTimeout(resetTimers.get(card));
                resetTimers.set(card, setTimeout(() => hideToastIfToken(t), 1800));
                return;
            }

            if (btn.classList.contains('is-copied')) return;

            const targetId = btn.getAttribute('data-copy-for');
            const block = targetId ? document.getElementById(targetId) : null;
            if (!block) return;

            /* 1. Copy text */
            try {
                await copyText(block.textContent.trim());
            } catch {
                /* silent fail — still run the visual feedback */
            }

            /* 2. Bounce micro-animation on the button */
            btn.classList.add('is-bouncing');
            btn.addEventListener('animationend', () => {
                btn.classList.remove('is-bouncing');
            }, { once: true });

            /* 3. Transition button to copied (green + check icon) */
            btn.classList.add('is-copied');
            btn.setAttribute('aria-label', 'Copied!');

            /* 4. Confetti burst from the button */
            fireConfettiAt(btn);

            /* 5. Show toast — pick a random encouraging message */
            const copyToastToken = showToast(pickEncouragement());

            /* 6. Reset button + hide toast after green message has been visible long enough */
            clearTimeout(resetTimers.get(card));
            resetTimers.set(card, setTimeout(() => {
                btn.classList.remove('is-copied');
                const title = card.querySelector('.prompt-card-title')?.textContent;
                btn.setAttribute('aria-label',
                    title ? `Copy prompt: ${title}` : 'Copy prompt');
                hideToastIfToken(copyToastToken);
            }, COPIED_TOAST_MS));
        });
    });
});
