/* ── Sarcastic terminal — Farish Hubiyan portfolio ── */

(function () {

    /* ── Config ── */
    var PROMPT     = 'you@hubiyan-sees-you ~ %';
    var MAX_TOKENS = 7;

    function getApiUrl() {
        /* Same-origin always — avoids CORS regardless of whether
           the user is on hubiyan.com or portfolio-live-rose.vercel.app */
        if (typeof window === 'undefined') return '/api/ask';
        return window.location.origin + '/api/ask';
    }

    var API_URL = getApiUrl();

    /* ── DOM refs ── */
    var root    = document.getElementById('terminal-root');
    var output  = document.getElementById('terminal-output');
    var capture = document.getElementById('terminal-capture');

    var tokensLeft = MAX_TOKENS;
    var inFlight   = false;

    /* ── Helpers ── */
    function esc(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function appendLine(cls, html) {
        var el = document.createElement('div');
        el.className = 'terminal-line ' + cls;
        el.innerHTML = html;
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
        .then(function (res) {
            return res.json().then(function (data) {
                return { status: res.status, data: data };
            });
        })
        .then(function (r) {
            if (typingEl.parentNode) typingEl.parentNode.removeChild(typingEl);

            if (r.status === 429) {
                appendLine('line--error', esc(r.data.error || 'Out of tokens.'));
                tokensLeft = 0;
                inFlight = false;
                return; /* No new prompt */
            }

            if (r.status !== 200) {
                appendLine('line--error', esc(r.data.error || 'Something broke. How fitting.'));
                inFlight = false;
                showPrompt();
                return;
            }

            appendLine('line--response', esc(r.data.answer));

            tokensLeft = typeof r.data.tokens_left === 'number' ? r.data.tokens_left : Math.max(0, tokensLeft - 1);
            var tokenMsg = tokensLeft > 0
                ? '[' + tokensLeft + ' token' + (tokensLeft === 1 ? '' : 's') + ' remaining]'
                : '[0 tokens remaining — come back in ~12h]';
            appendLine('line--tokens', tokenMsg);

            inFlight = false;

            if (tokensLeft <= 0) {
                appendLine('line--error', "You’ve used all " + MAX_TOKENS + " questions. Maybe read the portfolio next time.");
            } else {
                showPrompt();
            }
        })
        .catch(function () {
            if (typingEl.parentNode) typingEl.parentNode.removeChild(typingEl);
            appendLine('line--error', 'Network error. Even the internet is dodging you.');
            inFlight = false;
            showPrompt();
        });
    }

    /* ── Keep focus on capture at all times ── */
    root.addEventListener('click', function () { capture.focus(); });
    root.addEventListener('focus', function () { capture.focus(); });

    document.addEventListener('keydown', function (e) {
        /* Re-focus capture if user presses printable keys while it's not focused */
        if (document.activeElement !== capture && !e.metaKey && !e.ctrlKey && !e.altKey) {
            capture.focus();
        }
    });

    /* ── Boot ── */
    appendLine('line--system', 'Last login: probably instead of reading the portfolio.');
    showPrompt();

})();
