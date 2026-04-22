document.addEventListener('DOMContentLoaded', () => {
    /* ---- Lottie: play once on load, hold last frame.
       Do NOT use loop="false" in HTML — the player treats a non-empty string as truthy
       and keeps looping. Control loop only via the lottie instance after load. ---- */
    const lottiePlayer = document.getElementById('promptsLottiePlayer');
    if (lottiePlayer) {
        let lottieHasStarted = false;
        function getAnim() {
            return typeof lottiePlayer.getLottie === 'function' ? lottiePlayer.getLottie() : null;
        }
        function lockToLastFrame() {
            try {
                const inst = getAnim();
                if (inst && typeof inst.totalFrames === 'number' && inst.totalFrames > 0) {
                    const last = Math.max(0, inst.totalFrames - 1);
                    if (typeof inst.goToAndStop === 'function') {
                        inst.goToAndStop(last, true);
                    }
                    if (typeof inst.pause === 'function') inst.pause();
                }
            } catch {
                /* no-op */
            }
        }
        function tryStartPlayback() {
            if (lottieHasStarted) return;
            const inst = getAnim();
            if (!inst) return;
            lottieHasStarted = true;
            if (typeof inst.stop === 'function') inst.stop();
            inst.loop = false;
            if (typeof lottiePlayer.setLooping === 'function') {
                lottiePlayer.setLooping(false);
            }
            if (typeof inst.goToAndStop === 'function') {
                inst.goToAndStop(0, true);
            }
            if (typeof lottiePlayer.play === 'function') {
                lottiePlayer.play();
            } else if (typeof inst.play === 'function') {
                inst.play();
            }
        }
        lottiePlayer.addEventListener('load', tryStartPlayback);
        lottiePlayer.addEventListener('ready', tryStartPlayback);
        lottiePlayer.addEventListener('complete', () => {
            lockToLastFrame();
        });
        /* If events fire before the internal animation is ready */
        setTimeout(tryStartPlayback, 0);
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

    /* ---- Toast helper ---- */
    const live = document.getElementById('prompts-copy-status');

    function showToast(msg) {
        if (!live) return;
        live.textContent = msg;
        live.classList.add('is-visible');
    }

    function hideToast() {
        if (!live) return;
        live.classList.remove('is-visible');
        /* clear text after fade-out transition (200ms) */
        setTimeout(() => { live.textContent = ''; }, 220);
    }

    /* ---- Card-level click — entire card is the copy target ---- */
    const resetTimers = new WeakMap();

    document.querySelectorAll('.prompt-block').forEach((card) => {
        card.addEventListener('click', async () => {
            const btn = card.querySelector('.prompt-copy-btn');
            if (!btn || btn.classList.contains('is-copied')) return;

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

            /* 5. Show toast */
            showToast('Prompt copied to clipboard.');

            /* 6. Reset everything after 2 s */
            clearTimeout(resetTimers.get(card));
            resetTimers.set(card, setTimeout(() => {
                btn.classList.remove('is-copied');
                const title = card.querySelector('.prompt-card-title')?.textContent;
                btn.setAttribute('aria-label',
                    title ? `Copy prompt: ${title}` : 'Copy prompt');
                hideToast();
            }, 2000));
        });
    });
});
