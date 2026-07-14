/**
 * POST /api/comment
 *
 * Vercel Serverless Function (Node.js runtime).
 * Same plumbing as /api/analyze (Groq + GPT-OSS 120B, per-IP rate limit, URL
 * snippet fetch), but generates cliché-lampooning social comments instead of a
 * BS score. See ./comment-taxonomy.js for the prompt + output shape.
 *
 * Shares the same "bro token" budget mechanism as /api/analyze
 * (5 generations per rolling 12 hours, per IP).
 *
 * Request body (JSON):
 *   { text, urls?: string[], content_from_image?: boolean, typed_text_length?: number }
 *
 * Response body (JSON):
 *   { post_summary, comments: { linkedin[], x[], instagram[] }, honesty_levels, rate_limit? }
 */

const { sendJson, corsHeaders } = require('./cors');
const { getClientIp, checkAndRecord, rateLimitPayload, reserveGlobalBudget, refundGlobalBudget } = require('./rate-limit');
const { buildSystemPrompt, normalizeComments } = require('./comment-taxonomy');

const GROQ_API_URL  = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'openai/gpt-oss-120b';

const MAX_TEXT_CHARS  = 20000;
const MAX_FETCH_BYTES = 512 * 1024;            // 512 KB per URL
const FETCH_TIMEOUT   = 9000;                  // 9 s
const GROQ_TIMEOUT_MS = 30000;                 // upstream LLM call ceiling

function parseReqBody(req) {
    let raw = req.body;
    if (raw == null) return null;
    if (Buffer.isBuffer(raw)) raw = raw.toString('utf8');
    if (typeof raw === 'string') {
        try {
            return JSON.parse(raw);
        } catch {
            return null;
        }
    }
    if (typeof raw === 'object' && !Array.isArray(raw)) return raw;
    return null;
}

/* ---- SSRF guard: block private / reserved hostnames ---- */
function isPrivateUrl(rawUrl) {
    try {
        const { hostname } = new URL(rawUrl);
        if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.|::1$|fc00:|fd[0-9a-f]{2}:)/i.test(hostname)) return true;
        const m = /^172\.(\d{1,3})\./.exec(hostname);
        if (m && Number(m[1]) >= 16 && Number(m[1]) <= 31) return true;
        if (hostname === 'localhost' || hostname.endsWith('.local') || hostname.endsWith('.internal')) return true;
        return false;
    } catch {
        return true; // unparseable → block
    }
}

/* ---- URL snippet fetcher ---- */
async function fetchSnippet(url) {
    if (isPrivateUrl(url)) return null;
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

        const res = await fetch(url, {
            signal:  controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; HubiyanBot/1.0)',
                'Accept':     'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
            },
        });
        clearTimeout(timer);

        if (!res.ok) return null;

        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('text/html') && !contentType.includes('text/plain')) return null;

        const reader = res.body.getReader();
        let bytes = 0;
        const chunks = [];
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            bytes += value.byteLength;
            chunks.push(value);
            if (bytes >= MAX_FETCH_BYTES) break;
        }

        const text = new TextDecoder().decode(
            chunks.reduce((acc, c) => {
                const merged = new Uint8Array(acc.length + c.length);
                merged.set(acc);
                merged.set(c, acc.length);
                return merged;
            }, new Uint8Array(0))
        );

        const ogTitle  = (text.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i) || [])[1];
        const ogDesc   = (text.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)/i) || [])[1];
        const title    = (text.match(/<title[^>]*>([^<]+)<\/title>/i) || [])[1];

        const snippet = [ogTitle || title, ogDesc].filter(Boolean).join(' — ').trim();
        return snippet || null;
    } catch {
        return null;
    }
}

function userPartsToOpenAIContent(userParts) {
    const content = [];
    if (!Array.isArray(userParts)) return content;
    for (const p of userParts) {
        if (p && p.type === 'text' && typeof p.text === 'string') {
            content.push({ type: 'text', text: p.text });
        }
    }
    return content;
}

function parseModelJson(raw) {
    if (typeof raw !== 'string' || !raw.trim()) {
        throw new Error('Empty response from model');
    }
    let s = raw.trim();
    const fence = /^```(?:json)?\s*([\s\S]*?)```$/im.exec(s);
    if (fence) s = fence[1].trim();
    try {
        return JSON.parse(s);
    } catch {
        const start = s.indexOf('{');
        const end = s.lastIndexOf('}');
        if (start >= 0 && end > start) {
            return JSON.parse(s.slice(start, end + 1));
        }
        throw new Error('Model output was not valid JSON');
    }
}

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

async function callGroq(systemPrompt, userParts) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY not set');

    const model = (process.env.MODEL_ID || DEFAULT_MODEL).trim();
    const content = userPartsToOpenAIContent(userParts);
    if (!content.length) throw new Error('No content parts for model');

    const baseBody = {
        model,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user',   content },
        ],
        response_format: { type: 'json_object' },
        temperature:     0.9,
        max_tokens:      2048,
    };

    for (let attempt = 0; attempt < 3; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), GROQ_TIMEOUT_MS);
        let res;
        try {
            res = await fetch(GROQ_API_URL, {
                method:  'POST',
                headers: {
                    'Content-Type':  'application/json',
                    Authorization:   `Bearer ${apiKey}`,
                },
                body: JSON.stringify(baseBody),
                signal: controller.signal,
            });
        } catch (e) {
            if (e.name === 'AbortError') throw new Error('Groq timeout');
            throw e;
        } finally {
            clearTimeout(timer);
        }

        if (res.status === 429 && attempt < 2) {
            let waitMs = 2500 * (attempt + 1);
            const errText = await res.text();
            try {
                const errJson = JSON.parse(errText);
                const msg = errJson?.error?.message || '';
                const m = /retry in ([\d.]+)\s*s/i.exec(msg);
                if (m) waitMs = Math.min(32000, Math.ceil(parseFloat(m[1]) * 1000) + 400);
            } catch {
                /* keep default wait */
            }
            await sleep(waitMs);
            continue;
        }

        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Groq API error ${res.status}: ${err.slice(0, 300)}`);
        }

        const data = await res.json();
        const raw = data?.choices?.[0]?.message?.content;
        if (!raw) throw new Error('Empty response from model');
        return parseModelJson(raw);
    }

    throw new Error('Groq request failed after retries');
}

/* ---- Main handler ---- */
module.exports = async function handler(req, res) {
    try {
        const headers = corsHeaders(req, 'POST, OPTIONS');

        if (req.method === 'OPTIONS') {
            return res.writeHead(204, headers).end();
        }

        if (req.method !== 'POST') {
            return sendJson(req, res, 405, { error: 'Method not allowed' });
        }

        const body = parseReqBody(req);
        if (body === null) {
            return sendJson(req, res, 400, { error: 'Invalid JSON body' });
        }
        if (!body || typeof body !== 'object') {
            return sendJson(req, res, 400, { error: 'Request body required' });
        }

        const rawText = typeof body.text === 'string' ? body.text.trim().slice(0, MAX_TEXT_CHARS) : '';
        const urls    = Array.isArray(body.urls) ? body.urls.filter(u => /^https?:\/\//i.test(u)).slice(0, 5) : [];

        if (!rawText && !urls.length) {
            return sendJson(req, res, 400, { error: 'No content provided. Paste a post or a URL (screenshots must include OCR text).' });
        }

        const ip = getClientIp(req);
        const rlCheck = await checkAndRecord(ip, { record: false, req });
        if (rlCheck.unavailable) {
            return sendJson(req, res, 503, { error: 'Service is temporarily unavailable. Try again shortly.' });
        }
        if (!rlCheck.allowed) {
            res.setHeader('Retry-After', String(rlCheck.retryAfterSeconds));
            return sendJson(req, res, 429, {
                error:      'Rate limit reached. You can run 5 generations every 12 hours.',
                rate_limit: rateLimitPayload(rlCheck),
            });
        }

        /* Shared global daily budget (protects the Groq key across all lab
           tools). Fails closed on KV error. */
        const gRes = await reserveGlobalBudget();
        if (gRes.unavailable) {
            return sendJson(req, res, 503, { error: 'Service is temporarily unavailable. Try again shortly.' });
        }
        if (!gRes.allowed) {
            res.setHeader('Retry-After', '3600');
            return sendJson(req, res, 429, { error: 'The lab is overloaded right now. Try again later.' });
        }

        let urlContext = '';
        if (urls.length) {
            const snippets = await Promise.all(urls.map(async (u) => {
                const s = await fetchSnippet(u);
                return s ? `${u}\n${s}` : u;
            }));
            urlContext = snippets.join('\n\n');
        }

        const textParts = [rawText, urlContext].filter(Boolean).join('\n\n---\n\n').trim();
        if (!textParts) {
            await refundGlobalBudget();
            return sendJson(req, res, 400, { error: 'No text to read. Paste a post or wait for OCR from a screenshot.' });
        }

        const userParts = [{
            type: 'text',
            text: `Write comments for ONLY the following pasted post. Read all of it first:\n\n${textParts}`,
        }];

        let result;
        try {
            result = await callGroq(buildSystemPrompt(), userParts);
        } catch (err) {
            console.error('[comment] model error:', err.message);
            await refundGlobalBudget();
            return sendJson(req, res, 502, { error: 'The comment model returned an error. Try again.' });
        }

        const normalized = normalizeComments(result);
        if (normalized.error) {
            return sendJson(req, res, 400, { error: normalized.error });
        }

        const rlAfter = await checkAndRecord(ip, { record: true, req });

        return sendJson(req, res, 200, {
            ...normalized,
            rate_limit: rateLimitPayload(rlAfter),
        });
    } catch (err) {
        console.error('[comment] unhandled:', err);
        if (!res.headersSent) {
            sendJson(req, res, 500, { error: 'Internal error' });
        }
    }
};
