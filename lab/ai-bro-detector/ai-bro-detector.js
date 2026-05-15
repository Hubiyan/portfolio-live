/* -------------------------------------------------------
   AI Bro Detector — client JS
   Public URL: https://hubiyan.com/lab/ai-bro-detector/

   Local: from repo root run `npm run dev` (Vercel CLI), then open
   /lab/ai-bro-detector/ on the dev origin — API resolves to /api/analyze.

   Text: use the textarea (reliable paste across browsers).
   Images: paste while the textarea is focused, or paste anywhere on the page.
   ------------------------------------------------------- */
/** Same host as the lab when using `vercel dev`; production Vercel API otherwise. */
const ANALYZE_API_URL = (() => {
    if (typeof window === 'undefined') return 'https://portfolio-live-rose.vercel.app/api/analyze';
    const h = window.location.hostname;
    if (h === 'localhost' || h === '127.0.0.1') {
        return `${window.location.origin}/api/analyze`;
    }
    return 'https://portfolio-live-rose.vercel.app/api/analyze';
})();

const MAX_IMAGE_BYTES  = 4 * 1024 * 1024;
const MAX_TEXT_CHARS   = 20000;
const URL_REGEX        = /https?:\/\/[^\s"'<>()[\]{}]+/g;

let state = {
    text:         '',
    urls:         [],
    imageBase64:  null,
    imageMime:    null,
    imageObjectUrl: null,
};

const pasteWrap       = document.getElementById('aibroPasteWrap');
const textInput       = document.getElementById('aiBroTextInput');
const preview         = document.getElementById('aiBroPreview');
const previewText     = document.getElementById('aiBroPreviewText');
const excerpt         = document.getElementById('aiBroExcerpt');
const urlRow          = document.getElementById('aiBroUrlRow');
const urlChips        = document.getElementById('aiBroUrlChips');
const thumbWrap       = document.getElementById('aiBroThumb');
const thumbImg        = document.getElementById('aiBroThumbImg');
const thumbSize       = document.getElementById('aiBroThumbSize');
const analyzeBtn      = document.getElementById('aiBroAnalyze');
const clearBtn        = document.getElementById('aiBroClear');
const statusEl        = document.getElementById('aiBroStatus');
const resultSection   = document.getElementById('aiBroResult');
const dialFill        = document.getElementById('aiBroDialFill');
const needle          = document.getElementById('aiBroNeedle');
const scoreNumber     = document.getElementById('aiBroScoreNumber');
const scoreLabel      = document.getElementById('aiBroScoreLabel');
const legendEl        = document.getElementById('aiBroLegend');
const legendText      = document.getElementById('aiBroLegendText');
const reasonsWrap     = document.getElementById('aiBroReasonsWrap');
const reasonsList     = document.getElementById('aiBroReasons');
const signalsWrap     = document.getElementById('aiBroSignalsWrap');
const signalsList     = document.getElementById('aiBroSignalsList');
const signalsToggle   = signalsWrap ? signalsWrap.querySelector('.ai-bro-signals-toggle') : null;
const summaryWrap     = document.getElementById('aiBroSummaryWrap');
const summaryText     = document.getElementById('aiBroSummaryText');

function isEditableTarget(el) {
    if (!el || !el.closest) return false;
    const tag = el.tagName;
    if (tag === 'TEXTAREA' || tag === 'INPUT') return true;
    if (el.isContentEditable) return true;
    return !!el.closest('textarea, input:not([type="button"]):not([type="submit"]):not([type="reset"]), [contenteditable="true"]');
}

function htmlToPlain(html) {
    if (!html || typeof html !== 'string') return '';
    try {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        return (doc.body && doc.body.textContent) ? doc.body.textContent : '';
    } catch {
        return '';
    }
}

function clipboardPlainText(cd) {
    if (!cd) return '';
    let t = cd.getData('text/plain');
    if (t && t.trim()) return t;
    const html = cd.getData('text/html');
    if (html) return htmlToPlain(html);
    return '';
}

function readImageFromClipboard(cd, onFile) {
    if (!cd || !cd.items) return;
    const imgItem = Array.from(cd.items).find((i) => i.type && i.type.startsWith('image/'));
    if (!imgItem) return;
    const file = imgItem.getAsFile();
    if (!file) return;
    onFile(file);
}

function loadImageFile(file) {
    if (file.size > MAX_IMAGE_BYTES) {
        showStatus(`Image too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 4 MB.`, 'error');
        return;
    }
    const reader = new FileReader();
    reader.onload = () => {
        const dataUrl = reader.result;
        const comma = dataUrl.indexOf(',');
        const b64     = comma >= 0 ? dataUrl.slice(comma + 1) : '';
        state.imageBase64    = b64;
        state.imageMime      = file.type || 'image/png';
        if (state.imageObjectUrl) URL.revokeObjectURL(state.imageObjectUrl);
        state.imageObjectUrl = URL.createObjectURL(file);
        renderPreview();
    };
    reader.readAsDataURL(file);
}

function syncTextFromInput() {
    const raw = textInput.value || '';
    state.text = raw.trim().slice(0, MAX_TEXT_CHARS);
    const found = [...new Set((raw.match(URL_REGEX) || []))];
    state.urls = found;
    renderPreview();
}

/* Click paste area (not the textarea) still focuses the field */
pasteWrap.addEventListener('click', (e) => {
    if (e.target !== textInput) textInput.focus();
});

textInput.addEventListener('input', syncTextFromInput);

textInput.addEventListener('paste', (e) => {
    const cd = e.clipboardData;
    readImageFromClipboard(cd, (file) => {
        e.preventDefault();
        loadImageFile(file);
    });
});

/* Paste when focus is NOT in an input — still capture text/images for users who click the page background */
document.addEventListener(
    'paste',
    (e) => {
        if (isEditableTarget(e.target)) return;
        const cd = e.clipboardData;
        if (!cd) return;

        const imgItem = Array.from(cd.items || []).find(
            (i) => i.type && i.type.startsWith('image/')
        );
        if (imgItem) {
            const file = imgItem.getAsFile();
            if (file) {
                e.preventDefault();
                textInput.focus();
                loadImageFile(file);
                return;
            }
        }

        const t = clipboardPlainText(cd);
        if (t && t.trim()) {
            e.preventDefault();
            textInput.focus();
            const next = (textInput.value ? `${textInput.value.trim()}\n\n` : '') + t.trim();
            textInput.value = next.slice(0, MAX_TEXT_CHARS);
            syncTextFromInput();
        }
    },
    false
);

function renderPreview() {
    const hasContent = state.text || state.imageBase64 || state.urls.length;
    if (!hasContent) {
        pasteWrap.classList.add('is-empty');
        pasteWrap.classList.remove('is-filled');
        preview.classList.add('ai-bro-preview--hidden');
        analyzeBtn.disabled = true;
        analyzeBtn.setAttribute('aria-disabled', 'true');
        clearBtn.style.display = 'none';
        return;
    }

    pasteWrap.classList.remove('is-empty');
    pasteWrap.classList.add('is-filled');
    preview.classList.remove('ai-bro-preview--hidden');

    if (state.text) {
        previewText.style.display = '';
        excerpt.textContent =
            state.text.length > 260 ? state.text.slice(0, 260) + '…' : state.text;
    } else {
        previewText.style.display = 'none';
    }

    if (state.urls.length) {
        urlRow.style.display = '';
        urlChips.innerHTML = '';
        state.urls.forEach((url) => {
            const chip = document.createElement('span');
            chip.className = 'ai-bro-url-chip chip';
            chip.title = url;
            try {
                chip.textContent = new URL(url).hostname;
            } catch {
                chip.textContent = url.slice(0, 40) + (url.length > 40 ? '…' : '');
            }
            urlChips.appendChild(chip);
        });
    } else {
        urlRow.style.display = 'none';
    }

    if (state.imageObjectUrl) {
        thumbWrap.style.display = '';
        thumbImg.src = state.imageObjectUrl;
        const kb = state.imageBase64
            ? Math.round((state.imageBase64.length * 3) / 4 / 1024)
            : 0;
        thumbSize.textContent = kb ? `${kb} KB` : '';
    } else {
        thumbWrap.style.display = 'none';
    }

    analyzeBtn.disabled = false;
    analyzeBtn.setAttribute('aria-disabled', 'false');
    clearBtn.style.display = '';
    hideStatus();
}

clearBtn.addEventListener('click', resetState);

function resetState() {
    if (state.imageObjectUrl) URL.revokeObjectURL(state.imageObjectUrl);
    state = { text: '', urls: [], imageBase64: null, imageMime: null, imageObjectUrl: null };
    textInput.value = '';

    pasteWrap.classList.add('is-empty');
    pasteWrap.classList.remove('is-filled');
    preview.classList.add('ai-bro-preview--hidden');
    previewText.style.display = 'none';
    urlRow.style.display = 'none';
    thumbWrap.style.display = 'none';
    thumbImg.src = '';
    urlChips.innerHTML = '';
    excerpt.textContent = '';
    analyzeBtn.disabled = true;
    analyzeBtn.setAttribute('aria-disabled', 'true');
    clearBtn.style.display = 'none';
    hideStatus();
    hideResult();
    textInput.focus();
}

analyzeBtn.addEventListener('click', runAnalysis);

async function runAnalysis() {
    const hasPayload = state.text || state.imageBase64 || state.urls.length;
    if (!hasPayload) return;

    setLoading(true);
    hideStatus();
    hideResult();

    const body = {
        text:         state.text || undefined,
        urls:         state.urls.length ? state.urls : undefined,
        image_base64: state.imageBase64 || undefined,
        image_mime:   state.imageMime || undefined,
    };

    try {
        const res = await fetch(ANALYZE_API_URL, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(body),
        });

        const text = await res.text();
        let json;
        try {
            json = text ? JSON.parse(text) : {};
        } catch {
            const snippet = text.replace(/\s+/g, ' ').trim().slice(0, 200);
            showStatus(
                snippet
                    ? `Analysis server returned ${res.status} (not JSON). ${snippet}`
                    : `Analysis server returned ${res.status} with an empty body.`,
                'error',
            );
            return;
        }

        if (!res.ok) {
            showStatus(json.error || `Server error ${res.status}`, 'error');
            return;
        }

        renderResult(json);
    } catch (err) {
        const name = err && err.name === 'TypeError' ? 'Network error' : 'Request failed';
        showStatus(`${name}. Check your connection or try again. ${err && err.message ? `(${err.message})` : ''}`.trim(), 'error');
        console.error('[ai-bro-detector]', err);
    } finally {
        setLoading(false);
    }
}

function renderResult(data) {
    const score = Math.max(0, Math.min(100, Number(data.bs_score) || 0));

    resultSection.classList.remove('ai-bro-result--empty');

    const deg = (score / 100) * 180 - 90;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
        needle.style.transform = `rotate(${deg}deg)`;
        needle.style.transformBox = 'fill-box';
        needle.style.transformOrigin = '50% 100%';
        dialFill.style.strokeDashoffset = String(267 - (score / 100) * 267);
    } else {
        needle.style.transition = 'transform 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)';
        needle.style.transformBox = 'fill-box';
        needle.style.transformOrigin = '50% 100%';
        requestAnimationFrame(() => {
            needle.style.transform = `rotate(${deg}deg)`;
        });
        dialFill.style.transition = 'stroke-dashoffset 0.7s cubic-bezier(0.22, 1, 0.36, 1)';
        dialFill.style.strokeDashoffset = String(267 - (score / 100) * 267);
    }

    scoreNumber.textContent = String(score);
    scoreLabel.textContent  = data.bs_label || '';

    const reading = (data.bs_reading || '').toLowerCase();
    legendEl.className = `ai-bro-legend ai-bro-legend--${reading || 'mixed'}`;
    legendText.textContent = data.bs_label || '';

    if (Array.isArray(data.reasons) && data.reasons.length) {
        reasonsWrap.style.display = '';
        reasonsList.innerHTML = data.reasons
            .map((r) => `<li class="ai-bro-reasons-item">${escapeHtml(r)}</li>`)
            .join('');
    } else {
        reasonsWrap.style.display = 'none';
    }

    if (Array.isArray(data.signals) && data.signals.length) {
        signalsWrap.style.display = '';
        signalsList.innerHTML = data.signals.map(
            (s) => `<li class="ai-bro-signal">
                <span class="ai-bro-signal-kind chip">${escapeHtml(s.kind || '')}</span>
                <span class="ai-bro-signal-snippet">${escapeHtml(s.snippet || '')}</span>
            </li>`
        ).join('');
    } else {
        signalsWrap.style.display = 'none';
    }

    if (signalsToggle) {
        signalsToggle.addEventListener(
            'click',
            () => {
                const expanded = signalsToggle.getAttribute('aria-expanded') === 'true';
                signalsToggle.setAttribute('aria-expanded', String(!expanded));
                signalsList.hidden = expanded;
                signalsWrap.classList.toggle('is-open', !expanded);
            },
            { once: false }
        );
    }

    if (data.input_summary) {
        summaryWrap.style.display = '';
        summaryText.textContent = data.input_summary;
    } else {
        summaryWrap.style.display = 'none';
    }
}

function setLoading(on) {
    analyzeBtn.disabled = on;
    analyzeBtn.setAttribute('aria-disabled', String(on));
    analyzeBtn.setAttribute('aria-busy', String(on));
    analyzeBtn.classList.toggle('is-loading', on);
}

function showStatus(msg, type = 'info') {
    statusEl.textContent = msg;
    statusEl.className   = `ai-bro-status ai-bro-status--${type}`;
    statusEl.style.display = '';
    statusEl.setAttribute('role', type === 'error' ? 'alert' : 'status');
}

function hideStatus() {
    statusEl.style.display = 'none';
    statusEl.textContent   = '';
}

function hideResult() {
    resultSection.classList.add('ai-bro-result--empty');
    scoreNumber.textContent  = '—';
    scoreLabel.textContent   = '';
    legendText.textContent   = '';
    reasonsWrap.style.display = 'none';
    signalsWrap.style.display = 'none';
    summaryWrap.style.display = 'none';
    needle.style.transform   = 'rotate(-90deg)';
    dialFill.style.strokeDashoffset = '267';
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/* Initial focus so paste works immediately */
textInput.focus();
