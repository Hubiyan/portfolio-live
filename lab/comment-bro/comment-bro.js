/* -------------------------------------------------------
   Comment Bro — client JS
   Public URL: https://hubiyan.com/lab/comment-bro/

   Input handling (paste / OCR / validation / rate-limit) is shared with the
   AI Bro Detector. After generation, the API returns a matrix of comments —
   3 platforms × 5 honesty levels — so the platform tabs and the honesty slider
   swap text instantly with no further API calls.

   Local: from repo root run `npm run dev` (Vercel CLI), then open
   /lab/comment-bro/ on the dev origin — API resolves to /api/comment.
   ------------------------------------------------------- */

const COMMENT_API_URL = (() => {
    if (typeof window === 'undefined') return 'https://portfolio-live-rose.vercel.app/api/comment';
    const h = window.location.hostname;
    if (h === 'localhost' || h === '127.0.0.1' || /^192\.168\./.test(h) || h.endsWith('.trycloudflare.com')) {
        return `${window.location.origin}/api/comment`;
    }
    return 'https://portfolio-live-rose.vercel.app/api/comment';
})();

const QUOTA_API_URL = (() => {
    if (typeof window === 'undefined') return 'https://portfolio-live-rose.vercel.app/api/quota';
    const h = window.location.hostname;
    if (h === 'localhost' || h === '127.0.0.1' || /^192\.168\./.test(h) || h.endsWith('.trycloudflare.com')) {
        return `${window.location.origin}/api/quota`;
    }
    return 'https://portfolio-live-rose.vercel.app/api/quota';
})();

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_TEXT_CHARS  = 20000;
const IS_TOUCH_DEVICE = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
const PLACEHOLDER_DEFAULT = IS_TOUCH_DEVICE
    ? 'Tap & hold to paste the post, or type it'
    : 'Click to paste the post you want to comment on';
const PLACEHOLDER_WITH_CONTENT = IS_TOUCH_DEVICE ? 'Add more text or images' : 'Paste more text or images';
const MAX_IMAGES = 5;

const URL_REGEX = /https?:\/\/[^\s"'<>()[\]{}]+/g;

const LOADING_MESSAGE = 'Workshopping your most engagement-baity comment';

/* Slider honesty levels — index 0 (cliché) → 4 (mild roast). */
const HONESTY_META = [
    { label: 'Pure cliché',   note: 'The most generic, painfully relatable engagement-bait comment. Zero opinions, maximum likes.' },
    { label: 'Barely honest', note: 'Still a cliché — but with a knowing little wink that you know it’s a cliché.' },
    { label: 'Half & half',   note: 'Half polite praise, half a playful nudge at the post.' },
    { label: 'Cheeky',        note: 'Clearly teasing the post’s clichés, while still sounding like a real comment.' },
    { label: 'Mild roast',    note: 'Still funny and postable, now openly (gently) roasting the post itself.' },
];

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

/** Per-IP quota from GET /api/quota or comment responses */
let rateLimitState = { limit: 5, remaining: null, reset_at: null, unlimited: false };

let state = {
    text:   '',
    urls:   [],
    images: [],
};

/* Generated comment matrix + current view */
let commentData = null;             // { linkedin:[], x:[], instagram:[] }
let activePlatform = 'linkedin';
let activeHonesty = 0;

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
const mobilePasteBtn = document.getElementById('aiBroMobilePasteBtn');
const pastePreviewBody = document.getElementById('aiBroPastePreviewBody');

/* Result / composer elements */
const resultSection   = document.getElementById('commentBroResult');
const resultToolbar   = document.getElementById('commentBroResultToolbar');
const tryAnotherBtn   = document.getElementById('commentBroTryAnother');
const postCard        = document.getElementById('commentBroPostCard');
const postSummaryEl   = document.getElementById('commentBroPostSummary');
const composerEl      = document.getElementById('commentBroComposer');
const tabsWrap        = document.getElementById('commentBroTabs');
const tabButtons      = tabsWrap ? Array.from(tabsWrap.querySelectorAll('.comment-bro-tab')) : [];
const outputBtn       = document.getElementById('commentBroOutput');
const outputTextEl    = document.getElementById('commentBroOutputText');
const honestySlider   = document.getElementById('commentBroHonesty');
const honestyLabelEl  = document.getElementById('commentBroHonestyLabel');
const honestyNoteEl   = document.getElementById('commentBroHonestyNote');

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

function stopLoaderText() { /* no-op — kept for call sites */ }

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

    if (!navigator.clipboard) {
        showStatus(
            IS_TOUCH_DEVICE
                ? 'Long-press inside the text box, then tap Paste.'
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
        if (!IS_TOUCH_DEVICE && navigator.clipboard?.read) {
            const items = await navigator.clipboard.read();
            let pastedText = false;
            let pastedImage = false;

            for (const item of items) {
                const types = [...item.types];
                const imageType = types.find((t) => t.startsWith('image/'));
                if (imageType && !pastedImage) {
                    const blob = await item.getType(imageType);
                    const file = new File([blob], 'clipboard.png', { type: blob.type || imageType });
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
        console.warn('[comment-bro] clipboard read failed', err);
        if (IS_TOUCH_DEVICE) {
            showStatus('Long-press inside the text box, then tap Paste.', 'error');
            didShowError = true;
        } else if (err?.name === 'NotAllowedError') {
            showStatus('Allow clipboard access in the browser prompt to paste on click.', 'error');
            didShowError = true;
        }
    } finally {
        clipboardPasteBusy = false;
    }

    if (!didPaste) {
        if (IS_TOUCH_DEVICE && !didShowError) {
            showStatus('Nothing to paste — copy the post first, or long-press inside the text box to paste.', 'error');
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
        console.warn('[comment-bro] Tesseract.js not loaded (check script / blockers).');
        return '';
    }
    try {
        const { data: { text } } = await T.recognize(file, 'eng', { logger: () => {} });
        return (text || '').trim();
    } catch (err) {
        console.error('[comment-bro] OCR failed', err);
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
            if (!img) { resolveOcr(''); return; }
            const raw = await runOcrOnFile(file);
            const imgAfter = state.images.find((i) => i.id === id);
            if (!imgAfter) { resolveOcr(''); return; }
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

textInput.addEventListener('input', () => { syncTextFromInput(); });

if (inputBox) {
    inputBox.addEventListener('click', (e) => {
        if (IS_TOUCH_DEVICE) {
            if (!e.target.closest('button') && !e.target.closest('label') && !e.target.closest('.ai-bro-thumb-remove')) {
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

const VALIDATION_MSG = 'Does not seem like a post. Paste a real social media post to comment on.';

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
    } catch { /* quota display is optional */ }
}

async function awaitPendingOcr() {
    const jobs = state.images.map((i) => i.ocrPromise).filter(Boolean);
    if (!jobs.length) return;
    try {
        await Promise.all(jobs);
    } catch { /* proceed with whatever OCR completed */ }
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
    if (!raw) return false;

    if (raw.length < 20) return false;
    const words = raw.match(/[a-zA-Z]{2,}/g) || [];
    if (words.length < 3) return false;

    if (/\/Users\/|\/home\/|\/etc\/|\/var\/|C:\\Users\\|C:\\Windows\\/.test(raw) ||
        /^(\/[\w.~-]+){2,}\/?$/m.test(raw) || /^~\//.test(raw))
        return false;

    if (/[0-9a-fA-F]{32,}/.test(raw) && !/[g-zG-Z]{4}/.test(raw)) return false;

    if (/lorem\s+ipsum/i.test(raw)) return false;

    const codeLineRe = /^(\s*)(\$\s|>\s|#!|import |from .+ import|const |let |var |function |def |SELECT |INSERT |UPDATE |<html|<\?xml|<!DOCTYPE|<\/)/m;
    if (codeLineRe.test(raw)) return false;

    const codeKeywords = (raw.match(/\b(function\s*\(|function |=>|console\.log|import |export |#!\/usr)\b/g) || []).length;
    if (codeKeywords >= 4) return false;

    const compact = raw.toLowerCase().replace(/\s/g, '');
    if (compact.length > 0 && compact.length <= 80) {
        const uniqueRatio = new Set(compact).size / compact.length;
        if (uniqueRatio < 0.2) return false;
    }
    if (/(.)\1{8,}/.test(compact)) return false;

    const letters = (raw.match(/[a-zA-Z]/g) || []).length;
    if (raw.length > 15 && (raw.length - letters) / raw.length > 0.70) return false;

    if (/\b(write me a|write a (function|script|program|app|component|code)|can you write|generate a (function|script|code|class)|please write|help me write|explain how to code|summarize this for me|rewrite this (post|email|text))\b/i.test(raw))
        return false;

    if (raw.length < 100 && /^(what|who|where|when|why|how|is|are|can|could|should|do|does)\b/i.test(raw) && raw.trimEnd().endsWith('?'))
        return false;

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
            pasteFromSystemClipboard();
        });
    } else {
        mobilePasteBtn.hidden = true;
    }
}

if (uploadBtn && imageUploadInput) {
    uploadBtn.addEventListener('click', (e) => {
        if (uploadBtn.classList.contains('is-disabled')) {
            e.preventDefault();
            return;
        }
        e.stopPropagation();
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

    const textPayload = buildTextPayloadForApi();
    if (!textPayload) {
        restoreInputWithError('No text to read. Wait for OCR or paste the post text.');
        stopLoaderText();
        loadingSection.style.display = 'none';
        setInputSectionHidden(false);
        return;
    }

    const body = {
        text:               textPayload,
        urls:               state.urls.length ? state.urls : undefined,
        content_from_image: hasImages() ? true : undefined,
        typed_text_length:  (state.text || '').trim().length,
    };

    try {
        const res = await fetch(COMMENT_API_URL, {
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
                    ? `Server returned ${res.status} (not JSON). ${snippet}`
                    : `Server returned ${res.status} with an empty body.`
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
        console.error('[comment-bro]', err);
    } finally {
        stopLoaderText();
        loadingSection.style.display = 'none';
    }
}

function restoreInputWithError(msg) {
    setInputSectionHidden(false);
    showStatus(msg, 'error');
}

/* ---- Paste preview (modal) ---- */
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

    pastePreviewBody.innerHTML = parts.length
        ? parts.join('')
        : '<p class="section-description ai-bro-paste-preview-empty">No preview available.</p>';
}

function clearPastePreview() {
    if (pastePreviewBody) pastePreviewBody.innerHTML = '';
}

/* ---- Comment composer rendering ---- */
function currentComment() {
    if (!commentData) return '';
    const arr = commentData[activePlatform] || [];
    return arr[activeHonesty] || arr[arr.length - 1] || '';
}

function renderActiveComment() {
    if (!outputTextEl) return;
    const text = currentComment();
    outputTextEl.textContent = text || '…';
    if (outputBtn) outputBtn.setAttribute('aria-label', `Comment for ${activePlatform} — click to copy`);
}

function setActivePlatform(platform) {
    if (!commentData || !commentData[platform]) return;
    activePlatform = platform;
    tabButtons.forEach((btn) => {
        const on = btn.getAttribute('data-platform') === platform;
        btn.classList.toggle('is-active', on);
        btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    renderActiveComment();
}

function setHonesty(level) {
    const lvl = Math.max(0, Math.min(HONESTY_META.length - 1, Number(level) || 0));
    activeHonesty = lvl;
    const meta = HONESTY_META[lvl];
    if (honestyLabelEl) honestyLabelEl.textContent = meta.label;
    if (honestyNoteEl) honestyNoteEl.textContent = meta.note;
    if (honestySlider) {
        honestySlider.value = String(lvl);
        honestySlider.setAttribute('aria-valuetext', meta.label);
        honestySlider.style.setProperty('--cb-fill', `${(lvl / (HONESTY_META.length - 1)) * 100}%`);
    }
    renderActiveComment();
}

tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => setActivePlatform(btn.getAttribute('data-platform')));
});

if (honestySlider) {
    honestySlider.addEventListener('input', () => setHonesty(honestySlider.value));
}

if (outputBtn) {
    outputBtn.addEventListener('click', () => copyActiveComment());
}

function renderResult(data) {
    commentData = data && data.comments ? data.comments : null;
    if (!commentData) {
        restoreInputWithError('No comments came back. Try a different post.');
        return;
    }

    setInputSectionHidden(true);
    renderPastePreview();

    const summary = (data.post_summary || '').trim();
    if (postCard && postSummaryEl) {
        postCard.style.display = '';
        postSummaryEl.textContent = summary || 'Here’s your post. Now go say something profound.';
    }

    resultSection.classList.remove('comment-bro-result--empty');
    if (resultToolbar) resultToolbar.hidden = false;
    if (composerEl) composerEl.style.display = '';

    activePlatform = 'linkedin';
    setActivePlatform('linkedin');
    setHonesty(0);
}

function hideResult() {
    commentData = null;
    resultSection.classList.add('comment-bro-result--empty');
    if (resultToolbar) resultToolbar.hidden = true;
    if (postCard) postCard.style.display = 'none';
    if (postSummaryEl) postSummaryEl.textContent = '';
    if (composerEl) composerEl.style.display = 'none';
    if (outputTextEl) outputTextEl.textContent = '';
    clearPastePreview();
}

/* ---- Copy + toast (shared design-system live toast) ---- */
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

const COPY_MESSAGES = [
    'Copied. Now go pretend you read the whole thing.',
    'In your clipboard. The algorithm thanks you for your service.',
    'Copied. Engagement secured, dignity optional.',
    'Locked in. Paste it before you overthink it.',
    'Copied. Another meaningful contribution to the discourse.',
    'Yours now. Be the cliché you wish to see in the comments.',
    'Copied. Nobody will ever know it wasn’t you.',
    'Done. Drop it, dash, and never look back.',
    'Copied. Adding to the noise, one comment at a time.',
    'In hand. Go farm that sweet, sweet validation.',
    'Copied. Your network will be so inspired.',
    'Ready to paste. Touch grass after, maybe.',
];
let lastCopyMsg = -1;
function pickCopyMessage() {
    if (COPY_MESSAGES.length <= 1) return COPY_MESSAGES[0];
    let i;
    do { i = Math.floor(Math.random() * COPY_MESSAGES.length); } while (i === lastCopyMsg);
    lastCopyMsg = i;
    return COPY_MESSAGES[i];
}

const toastEl = document.getElementById('commentBroToast');
const COPIED_TOAST_MS = 3200;
let toastHideTimer = null;
let toastClearTimer = null;

function showToast(msg) {
    if (!toastEl) return;
    if (toastClearTimer) { clearTimeout(toastClearTimer); toastClearTimer = null; }
    if (toastHideTimer) { clearTimeout(toastHideTimer); toastHideTimer = null; }
    toastEl.textContent = msg;
    toastEl.classList.add('is-visible');
    toastHideTimer = setTimeout(hideToast, COPIED_TOAST_MS);
}

function hideToast() {
    if (!toastEl) return;
    toastEl.classList.remove('is-visible');
    toastClearTimer = setTimeout(() => { toastEl.textContent = ''; }, 220);
}

let copyResetTimer = null;
async function copyActiveComment() {
    const text = currentComment();
    if (!text) return;
    try {
        await copyText(text);
    } catch { /* still show feedback */ }

    if (outputBtn) {
        outputBtn.classList.add('is-copied');
        clearTimeout(copyResetTimer);
        copyResetTimer = setTimeout(() => outputBtn.classList.remove('is-copied'), COPIED_TOAST_MS);
    }
    showToast(pickCopyMessage());
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
