/* -------------------------------------------------------
   AI Bro Detector — client JS
   Public URL: https://hubiyan.com/lab/ai-bro-detector/

   Local: from repo root run `npm run dev` (Vercel CLI), then open
   /lab/ai-bro-detector/ on the dev origin — API resolves to /api/analyze.

   Text: click the empty input to paste from clipboard, or use the textarea / ⌘V.
   Images: click-to-paste, paste while focused, or paste anywhere on the page.
   OCR: Tesseract.js (CDN) extracts text from pasted images in-browser; that
   text is merged into the JSON `text` field on Analyze (image is still sent).
   ------------------------------------------------------- */

const ANALYZE_API_URL = (() => {
    if (typeof window === 'undefined') return 'https://portfolio-live-rose.vercel.app/api/analyze';
    const h = window.location.hostname;
    if (h === 'localhost' || h === '127.0.0.1') {
        return `${window.location.origin}/api/analyze`;
    }
    return 'https://portfolio-live-rose.vercel.app/api/analyze';
})();

const QUOTA_API_URL = (() => {
    if (typeof window === 'undefined') return 'https://portfolio-live-rose.vercel.app/api/quota';
    const h = window.location.hostname;
    if (h === 'localhost' || h === '127.0.0.1') {
        return `${window.location.origin}/api/quota`;
    }
    return 'https://portfolio-live-rose.vercel.app/api/quota';
})();

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_TEXT_CHARS  = 20000;
const IS_TOUCH_DEVICE = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
const PLACEHOLDER_DEFAULT = IS_TOUCH_DEVICE
    ? 'Tap & hold to paste, or type your content'
    : 'Click to paste suspected content';
const PLACEHOLDER_WITH_CONTENT = IS_TOUCH_DEVICE ? 'Add more text or images' : 'Paste more text or images';
const MAX_IMAGES = 5;

const URL_REGEX       = /https?:\/\/[^\s"'<>()[\]{}]+/g;

const LOADING_MESSAGE = 'Detecting AI led expert bro energy';

let ocrJob = null;

// Sequential OCR queue — one Tesseract job at a time to avoid worker stalls
let ocrQueue   = [];
let ocrRunning = false;

function enqueueOcr(job) {
    ocrQueue.push(job);
    if (!ocrRunning) drainOcrQueue();
}

async function drainOcrQueue() {
    ocrRunning = true;
    while (ocrQueue.length > 0) {
        const next = ocrQueue.shift();
        try { await next(); } catch { /* never let one failure block the rest */ }
    }
    ocrRunning = false;
}

/** Per-IP quota from GET /api/quota or analyze responses */
let rateLimitState = { limit: 5, remaining: null, reset_at: null, unlimited: false };

let state = {
    text:   '',
    urls:   [],
    images: [],
};

/** @deprecated mirrors first image for legacy paths */
function syncLegacyImageFields() {
    const img = state.images[0] || null;
    state.imageBase64    = img?.base64 ?? null;
    state.imageMime      = img?.mime ?? null;
    state.imageObjectUrl = img?.objectUrl ?? null;
    state.ocrText        = combinedOcrText();
    state.ocrStatus      = state.images.some((i) => i.ocrStatus === 'busy') ? 'busy'
        : state.images.some((i) => i.ocrText) ? 'done' : 'idle';
}

function combinedOcrText() {
    return state.images
        .map((img) => (img.ocrText || '').trim())
        .filter(Boolean)
        .join('\n\n');
}

function hasTypedText() {
    return Boolean((state.text || '').trim());
}

function hasImages() {
    return state.images.length > 0;
}

function getInputState() {
    const typed = hasTypedText();
    const imgs = hasImages();
    if (!typed && !imgs) return 'empty';
    if (typed && imgs) return 'text-and-images';
    if (imgs) return 'images-only';
    return 'text-only';
}

function applyInputStateUI() {
    const inputState = getInputState();
    inputBox.dataset.inputState = inputState;
    inputBox.className = `ai-bro-input-box ai-bro-input-box--${inputState}`;

    if (mediaStrip) {
        mediaStrip.hidden = !hasImages();
    }
    if (inputState === 'empty') {
        textInput.placeholder = PLACEHOLDER_DEFAULT;
    } else {
        textInput.placeholder = PLACEHOLDER_WITH_CONTENT;
    }

    const filled = inputState !== 'empty';
    textInput.classList.toggle('is-filled', hasTypedText());
    inputBox.classList.toggle('is-filled', filled);
    inputBox.classList.toggle('has-image', hasImages());
}

function nextImageId() {
    return `img-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function removeImage(id) {
    const idx = state.images.findIndex((i) => i.id === id);
    if (idx < 0) return;
    const [removed] = state.images.splice(idx, 1);
    if (removed?.objectUrl) URL.revokeObjectURL(removed.objectUrl);
    renderThumbnails();
    syncLegacyImageFields();
    renderPreview();
}

function renderThumbnails() {
    if (!thumbList) return;
    thumbList.innerHTML = state.images.map((img, index) => {
        const busy = img.ocrStatus === 'busy';
        const alt = `Screenshot ${index + 1}`;
        const status = busy ? 'Extracting text…' : '';
        return `<li class="ai-bro-thumb-item" data-image-id="${escapeHtml(img.id)}">
            <button type="button" class="ai-bro-thumb-remove" aria-label="Remove screenshot ${index + 1}" data-remove-id="${escapeHtml(img.id)}">×</button>
            <img class="ai-bro-thumb-img" src="${escapeHtml(img.objectUrl || '')}" alt="${alt}">
            ${status ? `<span class="ai-bro-thumb-status">${escapeHtml(status)}</span>` : ''}
        </li>`;
    }).join('');

    thumbList.querySelectorAll('.ai-bro-thumb-remove').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const id = btn.getAttribute('data-remove-id');
            if (id) removeImage(id);
        });
    });
}


const inputSection   = document.getElementById('aiBroInputSection');
const loadingSection = document.getElementById('aiBroLoading');
const loaderTextEl   = document.getElementById('aiBroLoaderText');
const textInput      = document.getElementById('aiBroTextInput');
if (textInput && IS_TOUCH_DEVICE) textInput.placeholder = PLACEHOLDER_DEFAULT;
const inputBox         = document.getElementById('aiBroInputBox');
const mediaStrip       = document.getElementById('aiBroMediaStrip');
const thumbList        = document.getElementById('aiBroThumbList');
const analyzeBtn     = document.getElementById('aiBroAnalyze');
const uploadBtn      = document.getElementById('aiBroUploadBtn');
const imageUploadInput = document.getElementById('aiBroImageUpload');
const inputHint      = document.getElementById('aiBroInputHint');
const quotaEl        = document.getElementById('aiBroQuota');
const statusEl       = document.getElementById('aiBroStatus');
const resultSection  = document.getElementById('aiBroResult');
const resultToolbar  = document.getElementById('aiBroResultToolbar');
const tryAnotherBtn       = document.getElementById('aiBroTryAnother');
const mobilePasteBtn      = document.getElementById('aiBroMobilePasteBtn');
const exportBtn           = document.getElementById('aiBroExportBtn');
const exportCaptureEl     = document.getElementById('aiBroExportCapture');
const breatheBanner       = document.getElementById('aiBroBreathe');
const pastePreviewBody    = document.getElementById('aiBroPastePreviewBody');
const dialFill       = document.getElementById('aiBroDialFill');
const needle         = document.getElementById('aiBroNeedle');
const scoreNumber    = document.getElementById('aiBroScoreNumber');
const reasonsWrap           = document.getElementById('aiBroReasonsWrap');
const reasonsTitle          = document.getElementById('aiBroReasonsTitle');
const reasonsList           = document.getElementById('aiBroReasons');
const positiveSignalsWrap   = document.getElementById('aiBroPositiveSignalsWrap');
const positiveSignalsList   = document.getElementById('aiBroPositiveSignalsList');
const positiveSignalsTitle  = document.getElementById('aiBroPositiveSignalsTitle');
const signalsWrap           = document.getElementById('aiBroSignalsWrap');
const signalsTitle          = document.getElementById('aiBroSignalsTitle');
const signalsList           = document.getElementById('aiBroSignalsList');
const dialWrap              = document.querySelector('.ai-bro-dial-wrap');
const gifWrap        = document.getElementById('aiBroGifWrap');
const gifPanes       = gifWrap ? Array.from(gifWrap.querySelectorAll('.ai-bro-gif-pane')) : [];
const postSummaryWrap   = document.getElementById('aiBroPostSummaryWrap');
const postSummaryText   = document.getElementById('aiBroPostSummaryText');

/** Bro (red) signal labels */
const BRO_SIGNAL_LABELS = {
    absolutism:           'Extreme either/or',
    replacement_claim:    'People won’t be needed',
    ai_ultimate_solution: 'AI as magic fix',
    ai_scare:             'AI doom panic',
    engagement_bait:      'Written to provoke',
    unfounded_certainty:  'Reads as a guarantee',
    unbased_metrics:      'Unverified numbers',
    vague_hype:           'Light on specifics',
    false_urgency:        'Rushed timing',
    guru_framing:         'Playbook energy',
    credential_flex:      'Humble brag',
    hustle_culture:       'Grindset rhetoric',
    viral_hook:           'Viral opener',
    llm_slop_structure:   'Template cadence',
    course_sales:         'Selling a course',
    lead_magnet_comment:  'Comment for freebie',
    fake_research_claim:  'Vague “research”',
    reality_gap:          'Ahead of real adoption',
};

/** Positive (green) signal labels */
const POSITIVE_SIGNAL_LABELS = {
    grounded_evidence:     'Backed by evidence',
    specific_example:        'Concrete example',
    nuance_and_limits:       'Acknowledges limits',
    ai_as_tool:              'AI as a tool',
    practical_guidance:      'Actionable advice',
    proportional_claims:     'Calibrated claims',
    intellectual_honesty:    'Intellectual honesty',
    cites_limitations:       'Names downsides',
    calm_tone:               'Calm tone',
    no_engagement_bait:      'No like-farming',
    human_capability_gain:   'Helps humans do more',
    step_by_step_execution:  'Step-by-step how-to',
    verified_research:       'Named research',
    news_or_primary_source:  'News or primary source',
    market_grounded:         'Adoption/cost aware',
};

function normalizeSignalKind(kind) {
    return String(kind || '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '_')
        .replace(/-+/g, '_');
}

function signalKindToChipLabel(kind, variant = 'bro') {
    const k = normalizeSignalKind(kind);
    const map = variant === 'positive' ? POSITIVE_SIGNAL_LABELS : BRO_SIGNAL_LABELS;
    if (map[k]) return map[k];
    if (!k) return 'Other';
    return k
        .split('_')
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
}

function meterTierFromData(data) {
    if (data?.meter_tier) return data.meter_tier;
    const score = Math.max(0, Math.min(100, Number(data?.bs_score) || 0));
    if (score <= 10) return '0-10';
    if (score <= 25) return '11-25';
    if (score <= 40) return '26-40';
    if (score <= 55) return '41-55';
    return '56-100';
}

/** @param {boolean} hidden */
function setInputSectionHidden(hidden) {
    if (!inputSection) return;
    inputSection.classList.toggle('ai-bro-input-section--hidden', hidden);
    inputSection.setAttribute('aria-hidden', hidden ? 'true' : 'false');
}

/* ---- Loader text ---- */
function startLoaderText() {
    if (!loaderTextEl) return;
    loaderTextEl.textContent = LOADING_MESSAGE;
    loaderTextEl.classList.remove('is-fading');
}

function stopLoaderText() {
    /* no-op — kept for call sites */
}

/* ---- Utilities ---- */
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

function isInputEmpty() {
    return !hasTypedText() && !hasImages();
}

function applyPastedText(raw) {
    const trimmed = (raw || '').trim();
    if (!trimmed) return false;
    const next = (textInput.value ? `${textInput.value.trim()}\n\n` : '') + trimmed;
    textInput.value = next.slice(0, MAX_TEXT_CHARS);
    syncTextFromInput();
    return true;
}

let clipboardPasteBusy = false;

/** Read system clipboard after a click (requires secure context + user gesture). */
async function pasteFromSystemClipboard() {
    if (clipboardPasteBusy || !textInput) return false;

    // Clipboard API requires HTTPS / localhost (secure context).
    if (!navigator.clipboard) {
        showStatus(
            IS_TOUCH_DEVICE
                ? 'Long-press in the text box, then tap Paste.'
                : 'Clipboard not available — use Ctrl+V / ⌘V to paste.',
            'error'
        );
        textInput.focus();
        return false;
    }

    clipboardPasteBusy = true;
    let didPaste = false;
    let didShowError = false;

    try {
        // iOS never grants clipboard-read permission so clipboard.read() always throws.
        // Use readText() directly on touch devices; it shows the native iOS paste consent banner.
        if (!IS_TOUCH_DEVICE && navigator.clipboard?.read) {
            const items = await navigator.clipboard.read();
            let pastedText = false;
            let pastedImage = false;

            for (const item of items) {
                const types = [...item.types];
                const imageType = types.find((t) => t.startsWith('image/'));
                if (imageType && !pastedImage) {
                    const blob = await item.getType(imageType);
                    const file = new File(
                        [blob],
                        'clipboard.png',
                        { type: blob.type || imageType }
                    );
                    loadImageFile(file);
                    pastedImage = true;
                    didPaste = true;
                }
                if (!pastedText) {
                    const plainType = types.includes('text/plain') ? 'text/plain' : null;
                    const htmlType = types.includes('text/html') ? 'text/html' : null;
                    const useType = plainType || htmlType;
                    if (useType) {
                        const blob = await item.getType(useType);
                        const text = useType === 'text/html'
                            ? htmlToPlain(await blob.text())
                            : await blob.text();
                        if (applyPastedText(text)) {
                            pastedText = true;
                            didPaste = true;
                        }
                    }
                }
            }
        } else if (navigator.clipboard?.readText) {
            const text = await navigator.clipboard.readText();
            if (applyPastedText(text)) didPaste = true;
        }
    } catch (err) {
        console.warn('[ai-bro-detector] clipboard read failed', err);
        if (IS_TOUCH_DEVICE) {
            const msg = err?.name === 'NotAllowedError'
                ? 'Tap "Allow Paste" when your browser prompts you.'
                : 'Long-press in the text box, then tap Paste.';
            showStatus(msg, 'error');
            didShowError = true;
        } else if (err?.name === 'NotAllowedError') {
            showStatus('Allow clipboard access in the browser prompt to paste on click.', 'error');
            didShowError = true;
        }
    } finally {
        clipboardPasteBusy = false;
    }

    if (!didPaste) {
        // Show feedback when clipboard was accessible but empty or contained only an image
        if (IS_TOUCH_DEVICE && !didShowError) {
            showStatus('Nothing to paste — copy some text first, then tap Paste.', 'error');
        }
        textInput.focus();
    } else if (IS_TOUCH_DEVICE) {
        textInput.focus();
    }
    return didPaste;
}

function shouldPasteOnInputClick(target) {
    if (!target || !inputBox) return false;
    if (target.closest('button')) return false;
    if (target.closest('.ai-bro-thumb-remove')) return false;
    if (!inputBox.contains(target)) return false;
    // On touch-only devices (iOS/Android), skip the async Clipboard API read.
    // iOS loses the user-gesture context inside async functions, so the subsequent
    // textInput.focus() call is ignored and the keyboard never appears.
    // Native long-press → Paste works fine without this.
    if (IS_TOUCH_DEVICE) return false;
    return isInputEmpty();
}

const IMAGE_EXT_RE = /\.(png|jpe?g|webp|gif|bmp|heic|heif|avif)$/i;
const BLOCKED_IMAGE_TYPES = new Set(['image/svg+xml']);

function isAcceptableImageFile(file) {
    if (!file || !(file instanceof Blob)) return false;
    const type = (file.type || '').toLowerCase().trim();
    if (type) {
        if (!type.startsWith('image/')) return false;
        if (BLOCKED_IMAGE_TYPES.has(type)) return false;
        return true;
    }
    return IMAGE_EXT_RE.test((file.name || '').trim());
}

function imageRejectionMessage(file) {
    const name = (file && file.name) ? file.name : 'This file';
    const typeHint = file?.type ? ` (${file.type})` : '';
    return `"${name}"${typeHint} is not a supported image. Use PNG, JPEG, WebP, or GIF screenshots only.`;
}

async function runOcrOnFile(file) {
    const T = typeof window !== 'undefined' ? window.Tesseract : undefined;
    if (!T || typeof T.recognize !== 'function') {
        console.warn('[ai-bro-detector] Tesseract.js not loaded (check script / blockers).');
        return '';
    }
    try {
        const { data: { text } } = await T.recognize(file, 'eng', { logger: () => {} });
        return (text || '').trim();
    } catch (err) {
        console.error('[ai-bro-detector] OCR failed', err);
        return '';
    }
}

function loadImageFile(file) {
    if (!isAcceptableImageFile(file)) {
        showStatus(imageRejectionMessage(file), 'error');
        return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
        showStatus(`Image too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 4 MB.`, 'error');
        return;
    }
    if (state.images.length >= MAX_IMAGES) {
        showStatus(`Maximum ${MAX_IMAGES} screenshots. Remove one to add another.`, 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = () => {
        const dataUrl = reader.result;
        const isImage = typeof dataUrl === 'string' && /^data:image\//i.test(dataUrl);
        if (!isImage) {
            showStatus(imageRejectionMessage(file), 'error');
            return;
        }
        const comma = dataUrl.indexOf(',');
        const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : '';
        const id = nextImageId();
        const entry = {
            id,
            base64:     b64,
            mime:       file.type || 'image/png',
            objectUrl:  URL.createObjectURL(file),
            ocrText:    '',
            ocrStatus:  'busy',
        };
        state.images.push(entry);
        syncLegacyImageFields();
        renderThumbnails();

        let resolveOcr;
        entry.ocrPromise = new Promise((res) => { resolveOcr = res; });

        enqueueOcr(async () => {
            const img = state.images.find((i) => i.id === id);
            if (!img) { resolveOcr(''); return; }   // removed before queue ran
            const raw = await runOcrOnFile(file);
            const imgAfter = state.images.find((i) => i.id === id);
            if (!imgAfter) { resolveOcr(''); return; } // removed while OCR ran
            imgAfter.ocrText   = raw.slice(0, MAX_TEXT_CHARS);
            imgAfter.ocrStatus = 'done';
            syncLegacyImageFields();
            renderThumbnails();
            renderPreview();
            resolveOcr(imgAfter.ocrText);
        });
        ocrJob = entry.ocrPromise;

        renderPreview();
    };
    reader.readAsDataURL(file);
}

function syncTextFromInput() {
    const raw = textInput.value || '';
    state.text = raw.trim().slice(0, MAX_TEXT_CHARS);
    state.urls = [...new Set((raw.match(URL_REGEX) || []))];
    renderPreview();
}

textInput.addEventListener('input', () => {
    syncTextFromInput();
});

if (inputBox) {
    inputBox.addEventListener('click', (e) => {
        if (IS_TOUCH_DEVICE) {
            // On mobile: just focus the textarea so the keyboard appears and
            // the user can type or use native long-press → Paste.
            if (!e.target.closest('button') && !e.target.closest('.ai-bro-thumb-remove')) {
                textInput.focus();
            }
            return;
        }
        if (!shouldPasteOnInputClick(e.target)) return;
        pasteFromSystemClipboard();
    });
}

textInput.addEventListener('paste', (e) => {
    const cd = e.clipboardData;
    readImageFromClipboard(cd, (file) => {
        e.preventDefault();
        loadImageFile(file);
    });
    // Ensure state updates after native text paste (some browsers skip input event)
    requestAnimationFrame(() => syncTextFromInput());
});

document.addEventListener('paste', (e) => {
    if (isEditableTarget(e.target)) return;
    const cd = e.clipboardData;
    if (!cd) return;

    const imgItem = Array.from(cd.items || []).find((i) => i.type && i.type.startsWith('image/'));
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
        applyPastedText(t);
    }
}, false);

const VALIDATION_MSG = 'Does not seem relevant, find an AI bro and post their content here';

function formatResetIn(ms) {
    if (ms <= 0) return 'soon';
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    if (m > 0) return `${m}m`;
    return 'under a minute';
}

function applyRateLimit(rl) {
    if (!rl || typeof rl !== 'object') return;
    rateLimitState = {
        limit:     Number(rl.limit) || 5,
        remaining: typeof rl.remaining === 'number' ? rl.remaining : rateLimitState.remaining,
        reset_at:  rl.reset_at != null ? Number(rl.reset_at) : rateLimitState.reset_at,
        unlimited: rl.unlimited === true,
    };
    renderQuotaLine();
}

function renderQuotaLine() {
    if (!quotaEl) return;
    const { limit, remaining, reset_at, unlimited } = rateLimitState;
    if (unlimited) {
        quotaEl.hidden = false;
        quotaEl.textContent = '∞ bro tokens';
        return;
    }
    if (remaining == null) {
        quotaEl.textContent = '';
        quotaEl.hidden = true;
        return;
    }
    quotaEl.hidden = false;
    const resetMs = reset_at ? reset_at - Date.now() : 0;
    if (remaining > 0) {
        quotaEl.textContent = `${remaining}/${limit} bro tokens left · refreshes every 12hrs`;
    } else {
        const resetPart = reset_at && resetMs > 0
            ? `Try again in ${formatResetIn(resetMs)}.`
            : 'Try again later.';
        quotaEl.textContent = `0/${limit} bro tokens left · ${resetPart}`;
    }
}

function isLocalDevHost() {
    const h = window.location.hostname;
    return h === 'localhost'
        || h === '127.0.0.1'
        || /^192\.168\.\d{1,3}\.\d{1,3}$/.test(h)
        || h.endsWith('.trycloudflare.com');
}

function isRateLimited() {
    if (isLocalDevHost() || rateLimitState.unlimited) return false;
    return rateLimitState.remaining === 0;
}

async function fetchQuota() {
    try {
        const res = await fetch(QUOTA_API_URL);
        if (!res.ok) return;
        const json = await res.json();
        applyRateLimit(json.rate_limit);
        renderPreview();
    } catch {
        /* quota display is optional */
    }
}

async function awaitPendingOcr() {
    const jobs = state.images.map((i) => i.ocrPromise).filter(Boolean);
    if (!jobs.length) return;
    try {
        await Promise.all(jobs);
    } catch {
        /* proceed with whatever OCR completed */
    }
    syncLegacyImageFields();
}

function validateInput() {
    const typed = (state.text || '').trim();

    if (hasImages() && !typed) {
        if (state.images.some((i) => i.ocrStatus === 'busy')) return false;
        const ocrPayload = buildTextPayloadForApi();
        if (!ocrPayload || ocrPayload.length < 20) return false;
        const words = ocrPayload.match(/[a-zA-Z]{2,}/g) || [];
        if (words.length < 3) return false;
        return true;
    }

    const raw = typed;
    if (!raw) return false; // empty — silent, no hint needed

    // Too short
    if (raw.length < 20) return false;
    const words = raw.match(/[a-zA-Z]{2,}/g) || [];
    if (words.length < 3) return false;

    // File paths — check anywhere in text
    if (/\/Users\/|\/home\/|\/etc\/|\/var\/|C:\\Users\\|C:\\Windows\\/.test(raw) ||
        /^(\/[\w.~-]+){2,}\/?$/m.test(raw) || /^~\//.test(raw))
        return false;

    // Encoded / hex / base64 data — look for a long run anywhere
    if (/[0-9a-fA-F]{32,}/.test(raw) && !/[g-zG-Z]{4}/.test(raw)) return false;

    // Lorem ipsum
    if (/lorem\s+ipsum/i.test(raw)) return false;

    // Code / terminal output — line starts with a clear code signal
    const codeLineRe = /^(\s*)(\$\s|>\s|#!|import |from .+ import|const |let |var |function |def |SELECT |INSERT |UPDATE |<html|<\?xml|<!DOCTYPE|<\/)/m;
    if (codeLineRe.test(raw)) return false;

    // Code keyword density — only strong signals (avoid "return on investment", "master class")
    const codeKeywords = (raw.match(/\b(function\s*\(|function |=>|console\.log|import |export |#!\/usr)\b/g) || []).length;
    if (codeKeywords >= 4) return false;

    // Keyboard mashing — short strings only (long posts have naturally low unique-char ratio)
    const compact = raw.toLowerCase().replace(/\s/g, '');
    if (compact.length > 0 && compact.length <= 80) {
        const uniqueRatio = new Set(compact).size / compact.length;
        if (uniqueRatio < 0.2) return false;
    }
    if (/(.)\1{8,}/.test(compact)) return false;

    // Too many symbols / numbers
    const letters = (raw.match(/[a-zA-Z]/g) || []).length;
    if (raw.length > 15 && (raw.length - letters) / raw.length > 0.70) return false;

    // LLM / AI prompts — check anywhere, not just start
    if (/\b(write me a|write a (function|script|program|app|component|code)|can you write|generate a (function|script|code|class)|please write|help me write|explain how to code|summarize this for me|rewrite this (post|email|text))\b/i.test(raw))
        return false;

    // Short direct search queries (< 100 chars, starts with question word, ends with ?)
    if (raw.length < 100 && /^(what|who|where|when|why|how|is|are|can|could|should|do|does)\b/i.test(raw) && raw.trimEnd().endsWith('?'))
        return false;

    // Personal / private messages — check anywhere
    if (/\b(hope you'?re (well|doing well|okay)|just checking in|wanted to (let you know|reach out)|miss you|thinking of you)\b/i.test(raw))
        return false;
    if (/^(hey|hi|dear|hello)\s+[a-z]/i.test(raw) && raw.length < 200)
        return false;

    // To-do / shopping lists — majority of lines are short list items
    const lines = raw.split('\n').filter(l => l.trim().length > 0);
    if (lines.length >= 4) {
        const listLines = lines.filter(l => /^(\s*[-*•]|\s*\d+\.|\s*\[[ x]\])\s/.test(l) && l.trim().length < 60);
        if (listLines.length / lines.length > 0.65) return false;
    }

    return true;
}

function renderPreview() {
    syncLegacyImageFields();
    const hasContent = hasTypedText() || hasImages() || state.urls.length;

    applyInputStateUI();
    renderThumbnails();

    if (uploadBtn) {
        const atMax = state.images.length >= MAX_IMAGES;
        // <label> doesn't support .disabled — use a class instead
        uploadBtn.classList.toggle('is-disabled', atMax);
        uploadBtn.setAttribute('aria-disabled', String(atMax));
    }

    if (!hasContent) {
        analyzeBtn.disabled = true;
        analyzeBtn.setAttribute('aria-disabled', 'true');
        inputHint.hidden = true;
        inputHint.textContent = '';
        return;
    }

    const valid = validateInput();
    analyzeBtn.disabled = !valid;
    analyzeBtn.setAttribute('aria-disabled', String(!valid));

    if (!valid && hasTypedText()) {
        inputHint.textContent = VALIDATION_MSG;
        inputHint.hidden = false;
    } else if (!valid && hasImages() && !combinedOcrText()) {
        inputHint.textContent = 'No readable text in screenshot — paste the post text or try a clearer image.';
        inputHint.hidden = false;
    } else {
        inputHint.hidden = true;
        inputHint.textContent = '';
    }

    hideStatus();
}

if (tryAnotherBtn) tryAnotherBtn.addEventListener('click', resetState);

if (mobilePasteBtn) {
    if (IS_TOUCH_DEVICE) {
        mobilePasteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            // readText() MUST be called synchronously inside the click handler —
            // iOS drops the user-gesture token across async/await boundaries.
            if (!navigator.clipboard?.readText) {
                textInput.focus();
                return;
            }
            navigator.clipboard.readText()
                .then((text) => {
                    if (applyPastedText(text)) textInput.focus();
                })
                .catch(() => {
                    textInput.focus();
                });
        });
    } else {
        mobilePasteBtn.hidden = true;
    }
}
if (exportBtn) exportBtn.addEventListener('click', () => { exportResultsAsImage(); });

if (uploadBtn && imageUploadInput) {
    // Programmatic click is more reliable than label-for on iOS Chrome/WKWebView.
    // The button directly opens the picker within the user-gesture context.
    uploadBtn.addEventListener('click', () => {
        imageUploadInput.click();
    });

    imageUploadInput.addEventListener('change', () => {
        const picked = Array.from(imageUploadInput.files || []);
        if (!picked.length) return;

        for (const file of picked) {
            const accepted = isAcceptableImageFile(file);
            if (!accepted) {
                showStatus(imageRejectionMessage(file), 'error');
                continue;
            }
            if (state.images.length >= MAX_IMAGES) {
                showStatus(`Maximum ${MAX_IMAGES} screenshots. Remove one to add another.`, 'error');
                break;
            }
            loadImageFile(file);
        }

        // Delay value reset to avoid iOS revoking sandbox access before FileReader
        // has finished reading the selected files
        setTimeout(() => { imageUploadInput.value = ''; }, 300);
    });
}

function resetState() {
    state.images.forEach((img) => {
        if (img.objectUrl) URL.revokeObjectURL(img.objectUrl);
    });
    ocrQueue = [];
    ocrJob = null;
    state = { text: '', urls: [], images: [] };
    syncLegacyImageFields();
    textInput.value = '';
    if (thumbList) thumbList.innerHTML = '';
    renderPreview();
    analyzeBtn.disabled = true;
    analyzeBtn.setAttribute('aria-disabled', 'true');
    inputHint.hidden = true;
    inputHint.textContent = '';
    stopLoaderText();
    loadingSection.style.display = 'none';
    hideResult();
    hideStatus();
    setInputSectionHidden(false);
    textInput.focus();
}

analyzeBtn.addEventListener('click', runAnalysis);

function buildTextPayloadForApi() {
    const typed = (state.text || '').trim();
    const ocrParts = state.images
        .map((img, index) => {
            const t = (img.ocrText || '').trim();
            if (!t) return '';
            const label = state.images.length > 1 ? `[From image ${index + 1}, OCR]` : '[From image, OCR]';
            return `${label}\n\n${t}`;
        })
        .filter(Boolean);
    const ocr = ocrParts.join('\n\n---\n\n');
    if (!typed && !ocr) return '';
    if (!ocr) return typed.slice(0, MAX_TEXT_CHARS);
    if (!typed) return ocr.slice(0, MAX_TEXT_CHARS);
    return `${typed}\n\n---\n\n${ocr}`.slice(0, MAX_TEXT_CHARS);
}

async function runAnalysis() {
    if (!validateInput()) return;
    if (isRateLimited()) {
        const rlModal = document.getElementById('aiBroRateLimitModal');
        if (rlModal && window.bootstrap) {
            bootstrap.Modal.getOrCreateInstance(rlModal).show();
        }
        return;
    }

    setInputSectionHidden(true);
    loadingSection.style.display = '';
    startLoaderText();
    hideResult();
    hideStatus();

    if (hasImages()) {
        await awaitPendingOcr();
    }

    const typedTrim = (state.text || '').trim();
    const textPayload = buildTextPayloadForApi();
    if (!textPayload) {
        restoreInputWithError('No text to analyse. Wait for OCR or paste the post text.');
        stopLoaderText();
        loadingSection.style.display = 'none';
        setInputSectionHidden(false);
        return;
    }

    const body = {
        text:                textPayload,
        urls:                state.urls.length ? state.urls : undefined,
        content_from_image:  hasImages() ? true : undefined,
        typed_text_length:   typedTrim.length,
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
            restoreInputWithError(
                snippet
                    ? `Analysis server returned ${res.status} (not JSON). ${snippet}`
                    : `Analysis server returned ${res.status} with an empty body.`
            );
            return;
        }

        if (!res.ok) {
            if (json.rate_limit) applyRateLimit(json.rate_limit);
            restoreInputWithError(json.error || `Server error ${res.status}`);
            renderPreview();
            return;
        }

        if (json.rate_limit) applyRateLimit(json.rate_limit);
        renderResult(json);
    } catch (err) {
        const name = err && err.name === 'TypeError' ? 'Network error' : 'Request failed';
        restoreInputWithError(`${name}. Check your connection or try again.${err && err.message ? ` (${err.message})` : ''}`);
        console.error('[ai-bro-detector]', err);
    } finally {
        stopLoaderText();
        loadingSection.style.display = 'none';
    }
}

function restoreInputWithError(msg) {
    setInputSectionHidden(false);
    showStatus(msg, 'error');
}

function gifTierForScore(score) {
    const s = Math.max(0, Math.min(100, Number(score) || 0));
    if (s <= 10) return '0-10';
    if (s <= 25) return '11-25';
    if (s <= 40) return '26-40';
    if (s <= 55) return '41-55';
    return '56-100';
}

function renderPostSummary(data) {
    const summary = (data.post_summary || data.input_summary || '').trim();
    if (postSummaryWrap && postSummaryText) {
        postSummaryWrap.style.display = '';
        if (summary) {
            postSummaryText.textContent = summary;
            postSummaryText.hidden = false;
        } else {
            postSummaryText.textContent = '';
            postSummaryText.hidden = true;
        }
    }
}

function hidePostSummary() {
    if (postSummaryWrap) postSummaryWrap.style.display = 'none';
    if (postSummaryText) postSummaryText.textContent = '';
}

function showGifForTier(tier) {
    if (!gifWrap || !gifPanes.length) return;
    gifPanes.forEach((pane) => {
        pane.classList.toggle('is-active', pane.getAttribute('data-tier') === tier);
    });
    gifWrap.hidden = false;
    gifWrap.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => ensureTenorEmbeds());
}

function ensureTenorEmbeds() {
    const active = gifWrap && gifWrap.querySelector('.ai-bro-gif-pane.is-active .tenor-gif-embed');
    if (!active || active.querySelector('iframe')) return;
    const s = document.createElement('script');
    s.src = 'https://tenor.com/embed.js';
    s.async = true;
    document.body.appendChild(s);
}

/** Direct Tenor media URLs for export (iframes are not canvas-safe). */
const GIF_EXPORT_SRC_BY_POSTID = {
    '9388313': 'https://media.tenor.com/VPqmYWo4-98AAAAC/leslie-david-baker-annoyed.gif',
    '1302676710766719675': 'https://media.tenor.com/EhQJkQpssrsAAAAC/james-doakes-dexter-dexter.gif',
    '1343162792415382650': 'https://media.tenor.com/EqPfcX1wzHoAAAAC/dexter-james-doakes.gif',
    '12313683': 'https://media.tenor.com/XMVz4JeILUMAAAAC/ladies-and-gentleman-we-got-him.gif',
    '12533315': 'https://media.tenor.com/gCezqk662woAAAAC/typo-autocorrect.gif',
};

/** @type {{ embed: HTMLElement, html: string } | null} */
let gifExportBackup = null;

function getActiveTenorEmbed() {
    return gifWrap && gifWrap.querySelector('.ai-bro-gif-pane.is-active .tenor-gif-embed');
}

function loadExportGif(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.className = 'ai-bro-export-gif';
        img.alt = '';
        img.onerror = () => reject(new Error('GIF load failed'));
        img.onload = () => {
            const done = () => resolve(img);
            if (img.decode) img.decode().then(done).catch(done);
            else done();
        };
        img.src = src;
    });
}

async function prepareGifForExport() {
    const embed = getActiveTenorEmbed();
    if (!embed || gifExportBackup) return;

    const postId = embed.getAttribute('data-postid') || '';
    const src = GIF_EXPORT_SRC_BY_POSTID[postId];
    gifExportBackup = { embed, html: embed.innerHTML };

    embed.innerHTML = '';
    if (src) {
        try {
            const img = await loadExportGif(src);
            embed.appendChild(img);
            return;
        } catch {
            /* fall through to placeholder */
        }
    }

    const tier = embed.closest('.ai-bro-gif-pane')?.getAttribute('data-tier') || '';
    embed.innerHTML =
        `<p class="ai-bro-export-gif-placeholder section-description">Reaction GIF (${escapeHtml(tier)})</p>`;
}

function restoreGifAfterExport() {
    if (!gifExportBackup) return;
    const { embed, html } = gifExportBackup;
    embed.innerHTML = html;
    gifExportBackup = null;
    ensureTenorEmbeds();
}

function exportCaptureBackground() {
    if (!exportCaptureEl) return '#ffffff';
    const card = exportCaptureEl.querySelector('.card');
    const el = card || exportCaptureEl;
    const bg = getComputedStyle(el).backgroundColor;
    return bg && bg !== 'rgba(0, 0, 0, 0)' ? bg : '#ffffff';
}

function dialSettleDelayMs() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 300;
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

async function exportResultsAsImage() {
    if (!exportCaptureEl || resultSection.classList.contains('ai-bro-result--empty')) return;
    if (typeof html2canvas !== 'function') {
        showStatus('Image export is unavailable. Check your connection and refresh.', 'error');
        return;
    }

    const score = (scoreNumber.textContent || '0').trim().replace(/[^\d]/g, '') || '0';
    const filename = `ai-bro-energy-${score}.png`;

    if (exportBtn) {
        exportBtn.disabled = true;
        exportBtn.setAttribute('aria-busy', 'true');
    }

    try {
        await document.fonts.ready;
        await new Promise((r) => setTimeout(r, dialSettleDelayMs()));

        await prepareGifForExport();

        const canvas = await html2canvas(exportCaptureEl, {
            scale: 2,
            useCORS: true,
            backgroundColor: exportCaptureBackground(),
            logging: false,
            ignoreElements: (el) => el.classList && el.classList.contains('ai-bro-export-ignore'),
        });

        const blob = await new Promise((resolve, reject) => {
            canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png');
        });

        downloadBlob(blob, filename);
        hideStatus();
    } catch {
        showStatus('Could not save image. Try again.', 'error');
    } finally {
        restoreGifAfterExport();
        if (exportBtn) {
            exportBtn.disabled = false;
            exportBtn.removeAttribute('aria-busy');
        }
    }
}

function showGifForScore(score) {
    showGifForTier(gifTierForScore(score));
}

function renderSignalsList(listEl, signals, variant) {
    if (!listEl) return;
    const items = Array.isArray(signals) ? signals : [];
    if (!items.length) {
        listEl.innerHTML = '';
        return;
    }
    const chipClass = variant === 'positive'
        ? 'ai-bro-signal-chip ai-bro-signal-chip--positive'
        : 'ai-bro-signal-chip ai-bro-signal-chip--bro';
    listEl.innerHTML = items.map((s) => {
        const label = escapeHtml(signalKindToChipLabel(s.kind, variant));
        return `<li class="ai-bro-signal" role="listitem">
            <span class="ai-bro-signal-kind ${chipClass}">${label}</span>
            <span class="ai-bro-signal-snippet">${escapeHtml(s.snippet || '')}</span>
        </li>`;
    }).join('');
}

function hideGif() {
    restoreGifAfterExport();
    if (!gifWrap) return;
    gifWrap.hidden = true;
    gifWrap.setAttribute('aria-hidden', 'true');
    gifPanes.forEach((pane) => pane.classList.remove('is-active'));
}

function renderPastePreview() {
    if (!pastePreviewBody) return;

    const parts = [];

    state.images.forEach((img, index) => {
        if (!img.objectUrl) return;
        const alt = state.images.length > 1 ? `Screenshot ${index + 1}` : 'Pasted screenshot';
        parts.push(
            `<figure class="ai-bro-paste-preview-figure">` +
            `<img class="ai-bro-paste-preview-img" src="${escapeHtml(img.objectUrl)}" alt="${escapeHtml(alt)}">` +
            `</figure>`
        );
        const ocr = (img.ocrText || '').trim();
        if (ocr) {
            const chip = state.images.length > 1
                ? `Extracted text from image ${index + 1}`
                : 'Extracted text from image';
            parts.push(
                `<div class="ai-bro-paste-preview-ocr">` +
                `<span class="ai-bro-ocr-chip">${escapeHtml(chip)}</span>` +
                `<p class="ai-bro-paste-preview-text">${escapeHtml(ocr)}</p>` +
                `</div>`
            );
        }
    });

    const typed = (state.text || '').trim();
    if (typed) {
        parts.push(`<p class="ai-bro-paste-preview-text">${escapeHtml(typed)}</p>`);
    }

    if (state.urls.length) {
        const chips = state.urls
            .map((u) => `<span class="ai-bro-url-chip">${escapeHtml(u)}</span>`)
            .join('');
        parts.push(`<div class="ai-bro-url-chips ai-bro-paste-preview-urls">${chips}</div>`);
    }

    if (!parts.length) {
        pastePreviewBody.innerHTML =
            '<p class="section-description ai-bro-paste-preview-empty">No preview available.</p>';
        return;
    }

    pastePreviewBody.innerHTML = parts.join('');
}

function clearPastePreview() {
    if (pastePreviewBody) pastePreviewBody.innerHTML = '';
}

function renderResult(data) {
    setInputSectionHidden(true);
    renderPastePreview();
    renderPostSummary(data);

    const tier = meterTierFromData(data);
    const score = Math.max(0, Math.min(100, Number(data.bs_score) || 0));
    const broSignals = Array.isArray(data.bro_signals) && data.bro_signals.length
        ? data.bro_signals
        : (Array.isArray(data.signals) ? data.signals : []);
    const positiveSignals = Array.isArray(data.positive_signals) ? data.positive_signals : [];

    resultSection.classList.remove('ai-bro-result--empty');
    resultSection.classList.toggle('ai-bro-result--tier-low', score <= 25);
    if (resultToolbar) resultToolbar.hidden = false;
    if (breatheBanner) breatheBanner.hidden = false;
    if (dialWrap) dialWrap.classList.remove('ai-bro-dial-wrap--zeroed');

    showGifForTier(tier);

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
        requestAnimationFrame(() => { needle.style.transform = `rotate(${deg}deg)`; });
        dialFill.style.transition = 'stroke-dashoffset 0.7s cubic-bezier(0.22, 1, 0.36, 1)';
        dialFill.style.strokeDashoffset = String(267 - (score / 100) * 267);
    }

    scoreNumber.textContent = String(score);
    if (reasonsTitle) reasonsTitle.textContent = 'Why this score';
    if (positiveSignalsTitle) positiveSignalsTitle.textContent = 'What checks out';

    if (Array.isArray(data.reasons) && data.reasons.length) {
        reasonsWrap.style.display = '';
        reasonsList.innerHTML = data.reasons
            .map((r) => `<li class="ai-bro-reasons-item">${escapeHtml(r)}</li>`)
            .join('');
    } else {
        reasonsWrap.style.display = 'none';
    }

    if (positiveSignals.length) {
        positiveSignalsWrap.style.display = '';
        renderSignalsList(positiveSignalsList, positiveSignals, 'positive');
    } else if (positiveSignalsWrap) {
        positiveSignalsWrap.style.display = 'none';
        if (positiveSignalsList) positiveSignalsList.innerHTML = '';
    }

    if (score > 0) {
        signalsWrap.style.display = '';
        if (signalsTitle) signalsTitle.textContent = 'What is sus about this';
        renderSignalsList(signalsList, broSignals, 'bro');
    } else {
        signalsWrap.style.display = 'none';
        if (signalsList) signalsList.innerHTML = '';
    }
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
    hideGif();
    hidePostSummary();
    clearPastePreview();
    resultSection.classList.add('ai-bro-result--empty');
    resultSection.classList.remove('ai-bro-result--tier-low');
    if (resultToolbar) resultToolbar.hidden = true;
    if (breatheBanner) breatheBanner.hidden = true;
    if (dialWrap) dialWrap.classList.remove('ai-bro-dial-wrap--zeroed');
    scoreNumber.textContent = '—';
    reasonsWrap.style.display = 'none';
    if (positiveSignalsWrap) {
        positiveSignalsWrap.style.display = 'none';
        if (positiveSignalsList) positiveSignalsList.innerHTML = '';
    }
    signalsWrap.style.display = 'none';
    if (signalsList) signalsList.innerHTML = '';
    needle.style.transform   = 'rotate(-90deg)';
    dialFill.style.strokeDashoffset = '267';
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

renderPreview();
textInput.focus();
fetchQuota();

