
/* ============================================================
   Mock Figma-multiplayer presence.
   - The visitor's cursor becomes a purple "You" cursor.
   - A red "Hubiyan" cursor trails them (offset, never overlapping),
     and when they dwell on a [data-hubiyan] section it glides onto
     that section and types a short first-person explanation.
   Desktop / fine-pointer only. Overlay never blocks input.
   ============================================================ */
(function () {
    'use strict';

    /* Desktop, fine-pointer only — leave touch/small screens untouched */
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    if (window.innerWidth < 901) return;

    var REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* Exact pointer path from the Paper "Cursor designs" file */
    var PATH = 'M33.232 20.137C33.232 20.137 33.242 20.144 33.242 20.144 33.784 20.536 34.186 21.055 34.381 21.698 34.551 22.26 34.579 22.837 34.426 23.404 34.278 23.954 33.985 24.435 33.581 24.84 33.101 25.323 32.49 25.578 31.823 25.65 31.823 25.65 18.463 27.299 18.463 27.299 18.187 27.333 17.937 27.477 17.77 27.698 17.77 27.698 9.656 38.394 9.656 38.394 9.259 38.933 8.732 39.333 8.072 39.505 7.517 39.651 6.953 39.663 6.4 39.516 5.831 39.364 5.343 39.051 4.939 38.624 4.477 38.134 4.228 37.528 4.157 36.864 4.157 36.864 4.156 36.852 4.156 36.852 4.156 36.852 1.012 3.556 1.012 3.556 0.932 2.932 1.028 2.318 1.351 1.766 1.637 1.278 2.031 0.886 2.522 0.604 3.013 0.321 3.551 0.178 4.118 0.175 4.761 0.172 5.343 0.397 5.845 0.777 5.845 0.777 33.232 20.137 33.232 20.137Z';

    function arrowSVG() {
        return '<svg class="hub-cur__arrow" viewBox="0 0 46 49" xmlns="http://www.w3.org/2000/svg">'
            + '<g transform="translate(3.06 7.75) rotate(-10.1)">'
            +   '<path d="' + PATH + '" fill="#ffffff"/>'
            +   '<path d="' + PATH + '" fill="none" stroke-width="2.678" vector-effect="non-scaling-stroke" style="stroke:var(--c)"/>'
            + '</g></svg>';
    }

    /* Pointer hand — filled icon mapped to the You colour token. */
    var POINTER_D = 'M12.6 5c-0.2 0-0.5 0-0.6 0 0-0.2-0.2-0.6-0.4-0.8s-0.6-0.4-1.1-0.4c-0.2 0-0.4 0-0.6 0.1-0.1-0.2-0.2-0.3-0.3-0.5-0.2-0.2-0.5-0.4-1.1-0.4-0.2 0-0.4 0-0.5 0.1v-1.7c0-0.6-0.4-1.4-1.4-1.4-0.4 0-0.8 0.2-1.1 0.4-0.5 0.6-0.5 1.4-0.5 1.4v4.3c-0.6 0.1-1.1 0.3-1.4 0.6-0.6 0.7-0.6 1.6-0.6 2.8 0 0.2 0 0.5 0 0.7 0 1.4 0.7 2.1 1.4 2.8l0.3 0.4c1.3 1.2 2.4 1.6 5.1 1.6 2.9 0 4.2-1.6 4.2-5.1v-2.5c0-0.7-0.2-2.1-1.4-2.4zM13 7.4v2.6c0 3.4-1.3 4.1-3.2 4.1-2.4 0-3.3-0.3-4.3-1.3-0.1-0.1-0.2-0.2-0.4-0.4-0.7-0.8-1.1-1.2-1.1-2.2 0-0.2 0-0.5 0-0.7 0-1 0-1.7 0.3-2.1 0.1-0.1 0.4-0.2 0.7-0.2v0.5l-0.3 1.5c0 0.1 0 0.1 0.1 0.2s0.2 0 0.2 0l1-1.2c0-0.1 0-0.2 0-0.2v-6.2c0-0.1 0-0.5 0.2-0.7 0.1 0 0.2-0.1 0.4-0.1 0.3 0 0.4 0.3 0.4 0.4v3.1c0 0 0 0 0 0v1.2c0 0.3 0.2 0.6 0.5 0.6s0.5-0.3 0.5-0.5v-1.3c0 0 0 0 0 0 0-0.1 0.1-0.5 0.5-0.5 0.3 0 0.5 0.1 0.5 0.4v1.3c0 0.3 0.2 0.6 0.5 0.6s0.5-0.3 0.5-0.5v-0.7c0-0.1 0.1-0.3 0.5-0.3 0.2 0 0.3 0.1 0.3 0.1 0.2 0.1 0.2 0.4 0.2 0.4v0.8c0 0.3 0.2 0.5 0.4 0.5 0.3 0 0.5-0.1 0.5-0.4 0-0.1 0.1-0.2 0.2-0.3 0 0 0.1 0 0.2 0 0.6 0.2 0.7 1.2 0.7 1.5 0-0.1 0-0.1 0 0z';
    var POINTER_OUTER = POINTER_D.split('M13 ')[0];
    function pointerSVG() {
        return '<svg class="hub-cur__icon hub-cur__icon--pointer" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">'
            +   '<path d="' + POINTER_OUTER + '" fill="#ffffff" stroke="#ffffff" stroke-width="0.5" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>'
            +   '<path d="' + POINTER_D + '" style="fill:var(--c)"/>'
            + '</svg>';
    }

    /* Open grab hand (default) — Clarity cursor-hand-open solid, You colour token. */
    var GRAB_OPEN_D = 'M29.6235,6.99688H29.374C28.8851,6.99688,28.4161,7.10681,27.997,7.29669C27.957,5.46783,26.4103,3.99875,24.5143,3.99875C23.9156,3.99875,23.3568,4.15865,22.8678,4.41849C22.4487,3.02936,21.1814,2,19.6547,2H19.4052C17.5691,2,16.0822,3.47908,16.0423,5.29794C15.6232,5.10806,15.1542,4.99813,14.6653,4.99813H14.4158C12.5597,4.99813,11.0429,6.50718,11.0429,8.37602V17.4304L8.76777,14.9519C7.76989,13.6327,5.94377,13.2829,4.53675,14.1424C3.1497,14.9819,2.60086,16.7308,3.29938,18.2998L6.60237,24.2161C6.86182,25.2055,8.45843,30.842,12.44,33.8001C12.6096,33.93,12.8192,34,13.0387,34H26.57C26.7895,34,27.009,33.92,27.1887,33.7901C30.8808,30.9019,32.9963,26.5646,32.9963,21.8876V10.3848C32.9963,8.52592,31.4895,7.00687,29.6235,7.00687V6.99688ZM31.0006,11.0344V21.8776C31.0006,25.8151,29.2643,29.4828,26.2207,31.9913H13.378C9.8854,29.183,8.52828,23.6665,8.5183,23.6065C8.49834,23.5166,8.45843,23.4266,8.41851,23.3467L5.08559,17.4004C4.83612,16.8407,5.04567,16.1711,5.57455,15.8513C6.1134,15.5215,6.80194,15.6615,7.24101,16.2311L11.3024,20.6683C11.482,20.8582,11.7415,20.9881,12.0308,20.9881C12.5797,20.9881,13.0287,20.5384,13.0287,19.9888V8.37602C13.0287,7.61649,13.6474,6.99688,14.4058,6.99688H14.6553C15.4137,6.99688,16.0323,7.61649,16.0323,8.37602V15.9913H18.0281V5.37789C18.0281,4.61836,18.6468,3.99875,19.4052,3.99875H19.6547C20.4131,3.99875,21.0317,4.61836,21.0317,5.37789V15.9913H23.0275V7.37664C23.0275,6.61711,23.6961,5.9975,24.5243,5.9975C25.3526,5.9975,26.0211,6.61711,26.0211,7.37664V15.9913H28.0169V10.3748C28.0169,9.61524,28.6356,8.99563,29.394,8.99563H29.6435C30.4018,8.99563,31.0205,9.61524,31.0205,10.3748V11.0344H31.0006Z';
    var GRAB_OPEN_OUTER = GRAB_OPEN_D.split('M31.0006')[0];
    function grabOpenSVG() {
        return '<svg class="hub-cur__icon hub-cur__icon--grab-open" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">'
            +   '<path d="' + GRAB_OPEN_OUTER + '" fill="#ffffff" stroke="#ffffff" stroke-width="2.5" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>'
            +   '<path d="' + GRAB_OPEN_D + '" style="fill:var(--c)"/>'
            + '</svg>';
    }

    /* Closed grab hand (mousedown / dragging) — filled icon, same You colour. */
    var GRAB_CLOSED_D = 'M28.09,9.74a4,4,0,0,0-1.16.19c-.19-1.24-1.55-2.18-3.27-2.18A4,4,0,0,0,22.13,8,3.37,3.37,0,0,0,19,6.3a3.45,3.45,0,0,0-2.87,1.32,3.65,3.65,0,0,0-1.89-.51A3.05,3.05,0,0,0,11,9.89v.91c-1.06.4-4.11,1.8-4.91,4.84s.34,8,2.69,11.78a25.21,25.21,0,0,0,5.9,6.41.9.9,0,0,0,.53.17H25.55a.92.92,0,0,0,.55-.19,13.13,13.13,0,0,0,3.75-6.13A25.8,25.8,0,0,0,31.41,18v-5.5A3.08,3.08,0,0,0,28.09,9.74ZM29.61,18a24,24,0,0,1-1.47,9.15A12.46,12.46,0,0,1,25.2,32.2H15.47a23.75,23.75,0,0,1-5.2-5.72c-2.37-3.86-3-8.23-2.48-10.39A5.7,5.7,0,0,1,11,12.76v7.65a.9.9,0,0,0,1.8,0V9.89c0-.47.59-1,1.46-1s1.49.52,1.49,1v5.72h1.8V8.81c0-.28.58-.71,1.46-.71s1.53.48,1.53.75v6.89h1.8V10l.17-.12a2.1,2.1,0,0,1,1.18-.32c.93,0,1.5.44,1.5.68l0,6.5H27V11.87a1.91,1.91,0,0,1,1.12-.33c.86,0,1.52.51,1.52.94Z';
    var GRAB_CLOSED_OUTER = GRAB_CLOSED_D.split('M29.61')[0];
    function grabClosedSVG() {
        return '<svg class="hub-cur__icon hub-cur__icon--grab-closed" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">'
            +   '<path d="' + GRAB_CLOSED_OUTER + '" fill="#ffffff" stroke="#ffffff" stroke-width="2.5" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>'
            +   '<path d="' + GRAB_CLOSED_D + '" style="fill:var(--c)"/>'
            + '</svg>';
    }

    var TIP_X = 6.5, TIP_Y = 6.5;   /* arrow-tip hotspot within the svg */

    var HIDE_CURSOR = 'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNgAAIAAAUAAen63NgAAAAASUVORK5CYII=") 0 0, none';

    /* Clickable targets first; grab only on explicit drag-scroll surfaces. */
    var POINTER_SEL = 'a[href], button, [role="button"], input[type="button"], input[type="submit"], input[type="reset"], input[type="checkbox"], input[type="radio"], summary, label[for], select, .my-button, .hamburger-btn, .btn-close, .button-link, .ham-link, .carousel-control-prev, .carousel-control-next, [data-bs-toggle], [data-bs-dismiss], [onclick], [data-cursor="pointer"], [style*="cursor:pointer"], [style*="cursor: pointer"]';
    var GRAB_SEL    = '.testimonial-container, .exp-card, [data-cursor="grab"], [style*="cursor:grab"], [style*="cursor: grab"]';

    /* Wistia embeds set their own cursor inside shadow DOM / iframes. */
    function injectWistiaCursorHide(player) {
        if (!player || !player.shadowRoot) return;
        if (player.shadowRoot.getElementById('hub-presence-cursor')) return;
        var style = document.createElement('style');
        style.id = 'hub-presence-cursor';
        style.textContent = ':host, :host *, :host *::before, :host *::after, iframe { cursor: ' + HIDE_CURSOR + ' !important; }';
        player.shadowRoot.appendChild(style);
        /* Re-inject if Wistia rebuilds its inner tree after load. */
        if (typeof MutationObserver !== 'undefined' && !player._hubPresenceObs) {
            player._hubPresenceObs = new MutationObserver(function () {
                if (!player.shadowRoot.getElementById('hub-presence-cursor')) injectWistiaCursorHide(player);
            });
            player._hubPresenceObs.observe(player.shadowRoot, { childList: true, subtree: true });
        }
    }
    function scanWistiaPlayers() {
        document.querySelectorAll('wistia-player').forEach(injectWistiaCursorHide);
    }
    function watchWistiaPlayers() {
        scanWistiaPlayers();
        if (typeof MutationObserver === 'undefined') return;
        var obs = new MutationObserver(function () { scanWistiaPlayers(); });
        obs.observe(document.documentElement, { childList: true, subtree: true });
        /* Shadow roots attach async — retry briefly after load. */
        var tries = 0;
        var retry = setInterval(function () {
            scanWistiaPlayers();
            if (++tries >= 20) clearInterval(retry);
        }, 500);
    }

    /* ── Build overlay ── */
    var root = document.createElement('div');
    root.id = 'hub-presence';
    root.setAttribute('aria-hidden', 'true');

    function makeCursor(role, label) {
        var el = document.createElement('div');
        el.className = 'hub-cur hub-cur--' + role;
        el.innerHTML = arrowSVG()
            + '<div class="hub-cur__tag">'
            +   '<span class="hub-cur__label">' + label + '</span>'
            +   '<div class="hub-cur__bubble"><span class="hub-cur__text"></span><span class="hub-cur__caret"></span></div>'
            + '</div>';
        root.appendChild(el);
        return el;
    }

    var hubEl = makeCursor('hub', 'Hubiyan');   /* built first → under the You cursor */
    var youEl = makeCursor('you', 'You');
    var hubText = hubEl.querySelector('.hub-cur__text');

    /* Give the You cursor its pointer + grab hand variants (after the arrow) */
    youEl.querySelector('.hub-cur__arrow')
         .insertAdjacentHTML('afterend', pointerSVG() + grabOpenSVG() + grabClosedSVG());

    /* Swap the You cursor's icon based on what is actually under the pointer. */
    var youCurState = '';
    function cursorStateFrom(el) {
        if (!el || !el.closest) return '';
        /* Pointer beats grab — buttons inside drag-scroll rows stay clickable. */
        if (el.closest(POINTER_SEL)) return 'pointer';
        if (el.closest(GRAB_SEL)) return 'grab';
        return '';
    }
    function setYouCursor(el) {
        var s = cursorStateFrom(el);
        if (s === youCurState) return;
        youCurState = s;
        youEl.classList.toggle('is-pointer', s === 'pointer');
        youEl.classList.toggle('is-grab',    s === 'grab');
        if (s !== 'grab') youEl.classList.remove('is-grabbing');
    }

    /* Hit-test the real element at the visitor's pointer. Pierces open shadow DOM. */
    function hitAt(x, y) {
        return document.elementFromPoint(x, y);
    }

    /* Re-derive pointer / grab / section from current pointer position. */
    function syncPointerContext() {
        var hit = hitAt(pointer.x, pointer.y);
        setYouCursor(hit);
        hoverSec = sectionFromTarget(hit);
    }

    /* ── State ── */
    /* Parked "home" corner — a different one is chosen each time Hubiyan
       returns to rest. Margins keep the "Hubiyan" tag on-screen. */
    var corner    = { x: 0, y: 0 };
    var corners   = [];
    var cornerIdx = 0;
    function setCorners() {
        var iw = window.innerWidth, ih = window.innerHeight;
        corners = [
            { x: 30,       y: 82 },       /* top-left     */
            { x: iw - 150, y: 82 },       /* top-right    */
            { x: 30,       y: ih - 92 },  /* bottom-left  */
            { x: iw - 150, y: ih - 92 }   /* bottom-right */
        ];
        corner.x = corners[cornerIdx].x;
        corner.y = corners[cornerIdx].y;
    }
    function pickCorner() {
        var i = cornerIdx;
        if (corners.length > 1) {
            do { i = Math.floor(Math.random() * corners.length); } while (i === cornerIdx);
        }
        cornerIdx = i;
        corner.x = corners[i].x;
        corner.y = corners[i].y;
    }
    cornerIdx = Math.floor(Math.random() * 4);   /* random starting corner */
    setCorners();
    window.addEventListener('resize', function () { setCorners(); wake(); });

    var pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    var you     = { x: pointer.x, y: pointer.y };
    var hub     = { x: corner.x, y: corner.y };
    var target  = { x: hub.x, y: hub.y };
    var mode    = 'wander';                /* 'wander' = parked at corner | 'explain' */
    var live    = false;
    var disabled = false;                  /* H pressed → whole feature is off */

    /* Loop lifecycle: the rAF only runs while something is actually moving or a
       pointer/scroll re-hit-test is pending. wake() (re)starts it; frame() parks
       it once everything has settled. This is what keeps the effect idle-free. */
    var running  = false;
    var dirty    = false;   /* pointer moved or scrolled → re-derive context next frame */
    var scrolled = false;   /* the pending re-derive was triggered by a scroll          */
    function wake() {
        if (!running) { running = true; requestAnimationFrame(frame); }
    }

    var pendingSec   = null;   /* section we're currently explaining */
    var pendingText  = '';
    var startedTyping = false;
    var typingDone   = false;  /* message fully typed out */
    var typeTimer    = null;
    var anchor       = { x: 0, y: 0 };   /* fixed explain-mode target */
    var explainAt    = 0;                /* time explain mode began */

    var idleTimer    = null;             /* fires once the pointer settles      */
    var holdTimer    = null;             /* fires HOLD_MS after a message shows  */
    var hoverSec     = null;             /* section the pointer is currently over */
    var shownCount   = new Map();        /* section el → completed show cycles   */

    var hintTimer  = null;
    var hintCount  = 0;                  /* how many times the "Press H" nudge has shown */

    /* ── Tunables ── */
    var IDLE_MS   = 500;   /* pointer must be still this long to trigger a message */
    var HOLD_MS   = 2500;  /* how long a message stays after it finishes typing    */
    var MAX_SHOWS = 1;     /* each section message shows once per session (after a full cycle) */
    var MAX_HINTS   = 2;     /* Hubiyan mentions "press H" at most this many times   */
    var HINT_CHANCE = 0.55;  /* ...and only on some rests, so it doesn't nag         */
    var HINT_TEXT   = 'Btw — press H on the keyboard to disable me anytime.';

    /* Occasionally, while parked, Hubiyan just says the "press H" tip in his own
       chat bubble (same view as the section messages) rather than every rest.
       Capped per session, never while a section message or the disabled state
       is active. Types in place — he stays in the corner. */
    function showHint() {
        if (disabled || mode !== 'wander' || pendingSec || hintCount >= MAX_HINTS) return;
        if (Math.random() > HINT_CHANCE) return;
        hintCount += 1;
        /* The tip bubble opens rightward — if we're parked at a right corner it
           would clip, so slide the resting spot left far enough to fit it. */
        var maxX = window.innerWidth - 380;
        if (corner.x > maxX) corner.x = Math.max(30, maxX);
        hubEl.classList.add('is-explaining');
        hubEl.classList.remove('is-typed');
        hubText.textContent = '';
        typeHint(HINT_TEXT);
        wake();                         /* the left-shift (if any) needs to glide */
    }
    function typeHint(text) {
        stopTyping();
        function done() {
            hubEl.classList.add('is-typed');
            clearTimeout(hintTimer);
            hintTimer = setTimeout(hideHint, HOLD_MS);
        }
        if (REDUCE) { hubText.textContent = text; done(); return; }
        var i = 0;
        (function step() {
            hubText.textContent = text.slice(0, i);
            if (i >= text.length) { done(); typeTimer = null; return; }
            var ch = text.charAt(i); i += 1;
            typeTimer = setTimeout(step, ch === ' ' ? 24 : (20 + Math.random() * 45));
        })();
    }
    /* Clear the tip bubble — but only if a section hasn't taken over the cursor. */
    function hideHint() {
        clearTimeout(hintTimer);
        if (mode !== 'wander' || pendingSec) return;
        stopTyping();
        hubEl.classList.remove('is-explaining', 'is-typed');
        hubText.textContent = '';
    }

    /* A section may be explained if it has not yet completed a full show cycle. */
    function canShow(sec) {
        return sec && (shownCount.get(sec) || 0) < MAX_SHOWS;
    }

    /* True while Hubiyan's cursor tip still sits over the section in the viewport. */
    function hubOverSection(sec) {
        if (!sec) return false;
        var r = sec.getBoundingClientRect();
        return hub.x >= r.left && hub.x <= r.right && hub.y >= r.top && hub.y <= r.bottom;
    }

    /* ── Render ── */
    function place(el, x, y) {
        el.style.transform = 'translate3d(' + (x - TIP_X) + 'px,' + (y - TIP_Y) + 'px,0)';
    }

    /* ── Section detection ── */
    function sectionFromTarget(node) {
        while (node && node !== document.body && node.nodeType === 1) {
            if (node.hasAttribute('data-hubiyan')) return node;
            node = node.parentElement;
        }
        return null;
    }

    function enterExplain(sec) {
        if (disabled) return;
        hideHint();
        clearTimeout(idleTimer);
        clearTimeout(holdTimer);
        mode = 'explain';
        pendingSec = sec;
        pendingText = sec.getAttribute('data-hubiyan') || '';
        startedTyping = false;
        typingDone = false;
        hubText.textContent = '';
        hubEl.classList.add('is-explaining');
        hubEl.classList.remove('is-typed');

        /* Anchor somewhere in the upper part of the section, near — but
           not on top of — the pointer, clamped into the viewport. */
        var r = sec.getBoundingClientRect();
        var ax = pointer.x - 150;
        ax = Math.max(r.left + 24, Math.min(ax, r.right - 260));
        ax = Math.max(16, Math.min(ax, window.innerWidth - 380));
        var ay = Math.max(r.top + 36, 76);
        ay = Math.min(ay, window.innerHeight - 150);
        anchor.x = ax; anchor.y = ay;
        target.x = ax; target.y = ay;
        explainAt = performance.now();
        wake();                         /* glide onto the section + trigger typing */
    }

    function exitExplain() {
        if (mode !== 'explain' && !pendingSec) return;
        clearTimeout(holdTimer);
        mode = 'wander';                /* glide back to the parked corner */
        pickCorner();                   /* ...a different corner each time  */
        pendingSec = null;
        stopTyping();
        hubEl.classList.remove('is-explaining', 'is-typed');
        hubText.textContent = '';
        wake();                         /* glide back to the parked corner */
        showHint();                     /* nudge again on the first rest after a message */
    }

    /* H fully turns the feature on/off — not just a visual hide. When off,
       every timer is cleared and any in-flight message is dropped (never
       shown, never counted), so nothing runs while hidden. The green You
       cursor keeps working. Turning it back on starts from a clean parked
       state. */
    function setHidden(h) {
        disabled = h;
        root.classList.toggle('is-hidden', h);
        hideHint();
        clearTimeout(idleTimer);
        clearTimeout(holdTimer);
        stopTyping();
        mode = 'wander';
        pendingSec = null;
        startedTyping = false;
        typingDone = false;
        hubEl.classList.remove('is-explaining', 'is-typed');
        hubText.textContent = '';
        pickCorner();
        hub.x = corner.x; hub.y = corner.y;      /* re-appear parked, no glide */
        target.x = corner.x; target.y = corner.y;
        wake();                                  /* render the snap once */
    }

    /* When the current message's full cycle ends (typed + held HOLD_MS), count it
       and move on. Interrupted cycles are not counted — the section stays eligible. */
    function onHoldEnd() {
        if (mode !== 'explain') return;
        if (pendingSec) {
            shownCount.set(pendingSec, (shownCount.get(pendingSec) || 0) + 1);
        }
        if (hoverSec && hoverSec !== pendingSec && canShow(hoverSec)) enterExplain(hoverSec);
        else exitExplain();
    }

    /* ── Typewriter ── */
    function markShown() {
        typingDone = true;
        hubEl.classList.add('is-typed');
        /* Message stays HOLD_MS after it finishes typing, then moves on —
           regardless of whether the visitor moves. */
        clearTimeout(holdTimer);
        holdTimer = setTimeout(onHoldEnd, HOLD_MS);
    }
    function typeText(text) {
        stopTyping();
        if (REDUCE) { hubText.textContent = text; markShown(); return; }
        var i = 0;
        (function step() {
            hubText.textContent = text.slice(0, i);
            if (i >= text.length) { markShown(); typeTimer = null; return; }
            var ch = text.charAt(i);
            i += 1;
            typeTimer = setTimeout(step, ch === ' ' ? 24 : (20 + Math.random() * 45));
        })();
    }
    function stopTyping() { if (typeTimer) { clearTimeout(typeTimer); typeTimer = null; } }

    /* ── Pointer ── */
    window.addEventListener('mousemove', function (e) {
        pointer.x = e.clientX;
        pointer.y = e.clientY;
        if (!live) {
            live = true;
            root.classList.add('is-live');
            document.documentElement.classList.add('hub-presence-on');
            setTimeout(showHint, 700);   /* first nudge, once the cursor has settled in */
        }
        dirty = true;                    /* re-derive pointer context in the frame */
        if (!e.buttons) youEl.classList.remove('is-grabbing');
        wake();
        if (disabled) return;                 /* feature off → no message logic */
        if (mode === 'wander') {
            clearTimeout(idleTimer);
            idleTimer = setTimeout(onSettle, IDLE_MS);
        }
    }, { passive: true });

    window.addEventListener('mousedown', function () {
        syncPointerContext();            /* rare — resolve grab-close instantly */
        if (youCurState === 'grab') youEl.classList.add('is-grabbing');
        wake();
    }, { passive: true });

    window.addEventListener('mouseup', function () {
        youEl.classList.remove('is-grabbing');
        syncPointerContext();
        wake();
    }, { passive: true });

    /* Pointer settled for IDLE_MS while roaming → explain the section under it,
       unless it has already completed a full show cycle this session. */
    function onSettle() {
        if (disabled) return;
        if (mode === 'wander' && canShow(hoverSec)) enterExplain(hoverSec);
    }

    /* Any scroll (page or nested): defer the re-hit-test to the next frame so
       momentum scrolling never forces a layout per event. The frame does the
       actual work (clear pointer/grab icons when the element under the cursor
       changes; cancel explain if the section moved away). */
    document.addEventListener('scroll', function () {
        if (!live) return;
        dirty = true;
        scrolled = true;
        wake();
    }, { passive: true, capture: true });

    /* Hide the presence if the pointer leaves the window */
    window.addEventListener('mouseout', function (e) {
        if (!e.relatedTarget && !e.toElement) {
            root.classList.remove('is-live');
            document.documentElement.classList.remove('hub-presence-on');
            live = false;
            youEl.classList.remove('is-grabbing');
        }
    });

    /* Press H to hide/show the Hubiyan cursor and the "You" name tag.
       The visitor's green cursor itself always stays. */
    window.addEventListener('keydown', function (e) {
        if (e.key !== 'h' && e.key !== 'H') return;
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        var a = document.activeElement;
        if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable)) return;
        setHidden(!disabled);
    });

    /* ── Loop ── */
    var EXPLAIN_EASE = REDUCE ? 1 : 0.13;   /* snappier glide onto a section */
    var WANDER_EASE  = REDUCE ? 1 : 0.045;  /* slow, calm autonomous roam    */
    var YOU_EASE     = REDUCE ? 1 : 0.55;
    var REST_EPS     = 0.1;                  /* within this many px → settled (sub-pixel) */

    function frame(t) {
        /* 1. Re-derive the pointer context at most once per frame, and only when
              the pointer moved or a scroll happened (dirty). */
        if (dirty) {
            if (live) {
                syncPointerContext();
                if (scrolled && !disabled) {
                    if (mode === 'explain' && pendingSec && !hubOverSection(pendingSec)) {
                        exitExplain();
                    } else if (mode === 'wander') {
                        clearTimeout(idleTimer);
                        idleTimer = setTimeout(onSettle, IDLE_MS);
                    }
                }
            }
            dirty = false;
            scrolled = false;
        }

        /* 2. Ease toward targets — unchanged motion. */
        you.x += (pointer.x - you.x) * YOU_EASE;
        you.y += (pointer.y - you.y) * YOU_EASE;

        /* Only two destinations, both reached with the same eased glide and
           then held still — no idle wobble or roaming. */
        if (mode === 'wander') {
            target.x = corner.x;   /* rest in the parked corner */
            target.y = corner.y;
        } else {
            target.x = anchor.x;   /* sit on the section being explained */
            target.y = anchor.y;
        }

        var ease = (mode === 'wander') ? WANDER_EASE : EXPLAIN_EASE;
        hub.x += (target.x - hub.x) * ease;
        hub.y += (target.y - hub.y) * ease;

        /* 3. Render. */
        place(youEl, you.x, you.y);
        place(hubEl, hub.x, hub.y);

        /* 4. Start typing once Hubiyan has arrived on the section (or after a
           short grace period, so a far glide never blocks the message). */
        if (mode === 'explain' && pendingSec && !startedTyping) {
            var dx = target.x - hub.x, dy = target.y - hub.y;
            if (dx * dx + dy * dy < 70 * 70 || (t - explainAt) > 650) {
                startedTyping = true;
                typeText(pendingText);
            }
        }

        /* 5. Park the loop once nothing is moving and no re-derive is pending.
           Snap the sub-pixel remainder (< REST_EPS, invisible) so there's no
           residual drift, then stop requesting frames. Any input or state change
           calls wake() to resume — typing and the caret run on their own timers,
           so sleeping while a message sits typed/held is fine. */
        if (!dirty
            && Math.abs(pointer.x - you.x) < REST_EPS && Math.abs(pointer.y - you.y) < REST_EPS
            && Math.abs(target.x - hub.x) < REST_EPS && Math.abs(target.y - hub.y) < REST_EPS) {
            you.x = pointer.x; you.y = pointer.y;
            hub.x = target.x;  hub.y = target.y;
            place(youEl, you.x, you.y);
            place(hubEl, hub.x, hub.y);
            running = false;
            return;
        }

        requestAnimationFrame(frame);
    }

    function boot() {
        (document.body || document.documentElement).appendChild(root);
        watchWistiaPlayers();
        wake();
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
