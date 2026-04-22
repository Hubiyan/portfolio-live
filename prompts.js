document.addEventListener('DOMContentLoaded', () => {
    /* ---- Sky: animate the cloud turbulence filters so wisps evolve over time ----
       Each <feTurbulence> gets a randomized starting seed + a slowly drifting
       baseFrequency. This keeps the clouds from ever looking identical between
       viewings and subtly morphs their edges the way real cloud vapor does.
       Gated on prefers-reduced-motion to stay considerate. */
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const turbulences = [
        { el: document.querySelector('#cloudTurbA feTurbulence'), bx: 0.012, by: 0.022, ax: 0.0015, ay: 0.0020 },
        { el: document.querySelector('#cloudTurbB feTurbulence'), bx: 0.009, by: 0.018, ax: 0.0012, ay: 0.0018 },
        { el: document.querySelector('#cloudTurbC feTurbulence'), bx: 0.016, by: 0.030, ax: 0.0020, ay: 0.0025 }
    ].filter(t => t.el);

    turbulences.forEach((t) => {
        t.el.setAttribute('seed', String(Math.floor(Math.random() * 10000)));
        t.phase = Math.random() * Math.PI * 2;
    });

    if (turbulences.length && !prefersReducedMotion) {
        let start = null;
        function tickClouds(ts) {
            if (start === null) start = ts;
            const t = (ts - start) / 1000;
            turbulences.forEach((tu, i) => {
                /* Each filter oscillates on a slow, unique period (~18–30s). */
                const speed = 0.18 + i * 0.05;
                const s = Math.sin(t * speed + tu.phase);
                const c = Math.cos(t * speed * 0.7 + tu.phase);
                const bx = (tu.bx + s * tu.ax).toFixed(4);
                const by = (tu.by + c * tu.ay).toFixed(4);
                tu.el.setAttribute('baseFrequency', `${bx} ${by}`);
            });
            requestAnimationFrame(tickClouds);
        }
        requestAnimationFrame(tickClouds);
    }

    /* ---- Confetti setup ---- */
    let copyConfetti = null;
    const confettiTrigger = document.getElementById('confetti-trigger');
    if (confettiTrigger && typeof Confetti !== 'undefined') {
        copyConfetti = new Confetti('confetti-trigger');
        copyConfetti.destroyTarget(false);
    }

    function fireConfettiAt(btn) {
        if (!copyConfetti || !confettiTrigger) return;
        const rect = btn.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        confettiTrigger.dispatchEvent(
            new MouseEvent('click', { clientX: x, clientY: y, bubbles: true })
        );
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

    /* ---- Toast helper ---- */
    const live = document.getElementById('prompts-copy-status');

    function showToast(msg, variant) {
        if (!live) return;
        live.textContent = msg;
        live.classList.toggle('is-soon', variant === 'soon');
        live.classList.add('is-visible');
    }

    function hideToast() {
        if (!live) return;
        live.classList.remove('is-visible');
        /* clear text + reset variant after fade-out transition (200ms) */
        setTimeout(() => {
            live.textContent = '';
            live.classList.remove('is-soon');
        }, 220);
    }

    /* ---- Card-level click — entire card is the copy target ---- */
    const resetTimers = new WeakMap();

    document.querySelectorAll('.prompt-block').forEach((card) => {
        card.addEventListener('click', async () => {
            const btn = card.querySelector('.prompt-copy-btn');
            if (!btn || btn.classList.contains('is-copied')) return;

            /* Coming-soon cards: show grey "Dropping shortly" toast and stop. */
            if (card.classList.contains('is-coming-soon')) {
                showToast('Dropping shortly', 'soon');
                clearTimeout(resetTimers.get(card));
                resetTimers.set(card, setTimeout(hideToast, 1800));
                return;
            }

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
            showToast(pickEncouragement());

            /* 6. Reset button + hide toast after green message has been visible long enough */
            clearTimeout(resetTimers.get(card));
            resetTimers.set(card, setTimeout(() => {
                btn.classList.remove('is-copied');
                const title = card.querySelector('.prompt-card-title')?.textContent;
                btn.setAttribute('aria-label',
                    title ? `Copy prompt: ${title}` : 'Copy prompt');
                hideToast();
            }, COPIED_TOAST_MS));
        });
    });
});
