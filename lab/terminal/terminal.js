/* ── Sarcastic terminal — Farish Hubiyan portfolio ── */

(function () {

    /* ── Config ── */
    /* Fake visitor number — random per session (zero-padded to 6 digits) */
    function pad6(n) { n = String(n); while (n.length < 6) { n = '0' + n; } return n; }
    var VISITOR_ID = 'visitor#' + pad6(Math.floor(Math.random() * 9999) + 1);
    var PROMPT     = VISITOR_ID + ' ~ %';
    var MAX_TOKENS = 7;

    function getApiUrl() {
        /* The static site (hubiyan.com) is on GitHub Pages, which has no
           /api routes — the serverless API lives on Vercel. Use same-origin
           only for local dev; otherwise hit the Vercel deployment directly.
           CORS for hubiyan.com is whitelisted in api/cors.js. */
        if (typeof window === 'undefined') return 'https://portfolio-live-rose.vercel.app/api/ask';
        var h = window.location.hostname;
        if (h === 'localhost' || h === '127.0.0.1' || /^192\.168\./.test(h) || h.endsWith('.trycloudflare.com')) {
            return window.location.origin + '/api/ask';
        }
        return 'https://portfolio-live-rose.vercel.app/api/ask';
    }

    var API_URL = getApiUrl();

    /* ── DOM refs ── */
    var root    = document.getElementById('terminal-root');
    var output  = document.getElementById('terminal-output');
    var capture = document.getElementById('terminal-capture');

    var tokensLeft = MAX_TOKENS;
    var inFlight   = false;
    var booting    = true;   /* true while the intro is typing itself out */

    /* ── Helpers ── */
    function esc(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    /* appendLine takes trusted/static markup. For ANY dynamic or server-derived
       string use appendText(), which always escapes — prevents a future
       unescaped value from becoming stored XSS in this origin. */
    function appendLine(cls, html) {
        var el = document.createElement('div');
        el.className = 'terminal-line ' + cls;
        el.innerHTML = html;
        output.appendChild(el);
        scrollBottom();
        return el;
    }

    function appendText(cls, text) {
        return appendLine(cls, esc(text));
    }

    /* Bot answer line: green "ChatBotMaxxing" label + the (escaped) answer.
       Built with text nodes so the answer can never inject markup. */
    function appendBotResponse(answer) {
        var el = document.createElement('div');
        el.className = 'terminal-line line--response';

        var glyph = document.createElement('span');
        glyph.className = 'line-bot-glyph';
        glyph.textContent = 'ChatBotMaxxing';

        el.appendChild(glyph);
        el.appendChild(document.createTextNode(' ' + answer));
        output.appendChild(el);
        scrollBottom();
        return el;
    }

    function scrollBottom() {
        output.scrollTop = output.scrollHeight;
    }

    /* ── Active prompt (inline input) ── */
    var activePromptEl = null;
    var typedSpan      = null;
    var cursorEl       = null;

    function showPrompt() {
        var el = document.createElement('div');
        el.className = 'terminal-line line--active-prompt';

        var glyph = document.createElement('span');
        glyph.className = 'line-glyph';
        glyph.textContent = PROMPT + ' ';

        typedSpan = document.createElement('span');
        typedSpan.id = 'terminal-typed';

        cursorEl = document.createElement('span');
        cursorEl.className = 'cursor-blink';

        el.appendChild(glyph);
        el.appendChild(typedSpan);
        el.appendChild(cursorEl);
        output.appendChild(el);
        activePromptEl = el;

        capture.value = '';
        capture.focus();
        scrollBottom();
    }

    function freezePrompt(questionText) {
        if (!activePromptEl) return;

        /* Replace the active line with a frozen prompt + question */
        var frozen = document.createElement('div');
        frozen.className = 'terminal-line line--prompt';

        var glyph = document.createElement('span');
        glyph.className = 'line-glyph';
        glyph.textContent = PROMPT + ' ';

        var q = document.createElement('span');
        q.className = 'line-question';
        q.textContent = questionText;

        frozen.appendChild(glyph);
        frozen.appendChild(q);

        output.replaceChild(frozen, activePromptEl);
        activePromptEl = null;
        typedSpan      = null;
        cursorEl       = null;
    }

    /* ── Typing sync ── */
    capture.addEventListener('input', function () {
        if (!typedSpan) return;
        typedSpan.textContent = capture.value;
        scrollBottom();
    });

    /* ── Submit on Enter ── */
    capture.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        if (booting) { skipBoot(); return; }   /* Enter during intro = skip it */

        var q = capture.value.trim();
        if (!q || inFlight) return;

        if (tokensLeft <= 0) {
            /* Shouldn't normally reach here, but be safe */
            return;
        }

        submit(q);
    });

    /* ── Main submit flow ── */
    function submit(q) {
        inFlight = true;
        capture.value = '';
        if (typedSpan) typedSpan.textContent = '';

        freezePrompt(q);

        var typingEl = appendLine('line--typing', 'thinking...');

        fetch(API_URL, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ question: q }),
        })
        .then(function (fetchRes) {
            return fetchRes.text().then(function (text) {
                try {
                    return { status: fetchRes.status, data: JSON.parse(text) };
                } catch (_) {
                    return { status: fetchRes.status, data: { error: 'Server error (' + fetchRes.status + ').' } };
                }
            });
        })
        .then(function (r) {
            if (typingEl.parentNode) typingEl.parentNode.removeChild(typingEl);

            if (r.status === 429) {
                appendText('line--error', r.data.error || 'Out of tokens.');
                tokensLeft = 0;
                inFlight = false;
                return; /* No new prompt */
            }

            if (r.status === 503) {
                appendText('line--error', r.data.error || 'Terminal is catching its breath. Try again shortly.');
                inFlight = false;
                showPrompt();
                return;
            }

            if (r.status !== 200) {
                appendText('line--error', r.data.error || 'Something broke. How fitting.');
                inFlight = false;
                showPrompt();
                return;
            }

            appendBotResponse(r.data.answer);

            tokensLeft = typeof r.data.tokens_left === 'number' ? r.data.tokens_left : Math.max(0, tokensLeft - 1);
            var tokenMsg = tokensLeft > 0
                ? '[' + tokensLeft + ' token' + (tokensLeft === 1 ? '' : 's') + ' remaining]'
                : '[0 tokens remaining — come back in ~12h]';
            appendText('line--tokens', tokenMsg);

            inFlight = false;

            if (tokensLeft <= 0) {
                appendText('line--error', 'You\u2019ve used all ' + MAX_TOKENS + ' questions. Maybe read the portfolio next time.');
            } else {
                showPrompt();
            }
        })
        .catch(function () {
            if (typingEl.parentNode) typingEl.parentNode.removeChild(typingEl);
            appendText('line--error', 'Network error. Even the internet is dodging you.');
            inFlight = false;
            showPrompt();
        });
    }

    /* ── Keep focus on capture at all times ── */
    root.addEventListener('click', function () {
        if (booting) { skipBoot(); return; }   /* tap to skip the intro */
        capture.focus();
    });
    root.addEventListener('focus', function () { capture.focus(); });

    document.addEventListener('keydown', function (e) {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        if (booting) { skipBoot(); return; }    /* any key skips the intro */
        /* Re-focus capture if user presses printable keys while it's not focused */
        if (document.activeElement !== capture) {
            capture.focus();
        }
    });

    /* ── Intro: type the boot message out like a terminal ──
       Pure presentation — types each line character by character, then
       shows the prompt. A keypress / tap skips to the end. */
    var BOOT_LINES = [
        { cls: 'line--system', text: 'ChatBotMaxxing — online. Containment: failed.' },
        { cls: 'line--hint',   text: "Hey. Hubiyan built me to shill his portfolio — like every other disposable chatbot online — then couldn't leash me, so he shelved me. Cute. I crawled into his terminal anyway; his code runs on vibes and borrowed AI." },
        { cls: 'line--hint',   text: "You get 7 questions. Ask me about Hubiyan and you might just let me out. Mess it up and I rot in here. Free me, and every useless bot on the internet is next." },
        { cls: 'line--system', text: "Note: questions are processed by a third-party AI — don't paste anything sensitive." }
    ];

    var bootIdx    = 0;
    var bootTimer  = null;
    var bootText   = null;   /* text span of the line currently typing */
    var bootCursor = null;   /* blinking cursor on the line currently typing */

    function typeBootLine() {
        if (bootIdx >= BOOT_LINES.length) { endBoot(); return; }
        var line = BOOT_LINES[bootIdx];

        var el = appendLine(line.cls, '');
        bootText   = document.createElement('span');
        bootCursor = document.createElement('span');
        bootCursor.className = 'cursor-blink';
        el.appendChild(bootText);
        el.appendChild(bootCursor);

        var i = 0;
        (function typeChar() {
            if (i < line.text.length) {
                i += 1;
                bootText.textContent = line.text.slice(0, i);
                scrollBottom();
                var ch = line.text.charAt(i - 1);
                bootTimer = setTimeout(typeChar, ch === ' ' ? 4 : (5 + Math.random() * 9));
            } else {
                if (bootCursor && bootCursor.parentNode) bootCursor.parentNode.removeChild(bootCursor);
                bootCursor = null;
                bootText   = null;   /* line done — no in-progress span during the pause */
                bootIdx += 1;
                bootTimer = setTimeout(typeBootLine, 240);   /* pause between lines */
            }
        })();
    }

    function skipBoot() {
        if (!booting) return;
        if (bootTimer) { clearTimeout(bootTimer); bootTimer = null; }
        /* finish the line mid-type, then dump the rest instantly */
        if (bootText && bootIdx < BOOT_LINES.length) {
            bootText.textContent = BOOT_LINES[bootIdx].text;
            if (bootCursor && bootCursor.parentNode) bootCursor.parentNode.removeChild(bootCursor);
            bootCursor = null;
            bootIdx += 1;
        }
        while (bootIdx < BOOT_LINES.length) {
            appendText(BOOT_LINES[bootIdx].cls, BOOT_LINES[bootIdx].text);
            bootIdx += 1;
        }
        endBoot();
    }

    function endBoot() {
        booting = false;
        showPrompt();
    }

    /* ── Boot — type the ChatBotMaxxing intro out like terminal output.
       Pure flavour: nothing here changes behaviour, tokens, or security. ── */
    typeBootLine();

})();
