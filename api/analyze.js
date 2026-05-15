/**
 * POST /api/analyze
 *
 * Vercel Serverless Function (Node.js runtime).
 * Uses Google Gemini (generateContent API + AI Studio key).
 *
 * Environment variables required (set in Vercel dashboard):
 *   GEMINI_API_KEY      — Google AI Studio API key
 *   MODEL_ID            — optional override, default "gemini-2.5-flash"
 *   ALLOWED_ORIGIN      — optional extra origins (space-separated exact URLs)
 *
 * Request body (JSON):
 *   { text?, urls?: string[], image_base64?: string, image_mime?: string }
 *
 * Response body (JSON):
 *   { bs_score, bs_reading, bs_label, reasons, signals, input_summary }
 */

const GEMINI_API_ROOT = 'https://generativelanguage.googleapis.com/v1beta/';
const DEFAULT_MODEL   = 'gemini-2.5-flash';

const MAX_TEXT_CHARS  = 20000;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;      // 4 MB
const MAX_FETCH_BYTES = 512 * 1024;            // 512 KB per URL
const FETCH_TIMEOUT   = 9000;                  // 9 s

/* ---- CORS ---- */
function hostMatchesPortfolio(hostname) {
    if (!hostname) return false;
    return (
        hostname === 'portfolio-live-rose.vercel.app' ||
        /^portfolio-live(-[a-z0-9]+)?\.vercel\.app$/i.test(hostname)
    );
}

function hostMatchesHubiyan(hostname) {
    if (!hostname) return false;
    return hostname === 'hubiyan.com' || hostname === 'www.hubiyan.com' || hostname.endsWith('.hubiyan.com');
}

function isOriginAllowed(origin, explicitList) {
    if (!origin) return false;
    if (explicitList.includes(origin)) return true;
    try {
        const u = new URL(origin);
        if (u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1')) return true;
        if (u.protocol === 'https:' && hostMatchesHubiyan(u.hostname)) return true;
        if (u.protocol === 'https:' && hostMatchesPortfolio(u.hostname)) return true;
        return false;
    } catch {
        return false;
    }
}

function corsHeaders(req) {
    const explicit = (process.env.ALLOWED_ORIGIN || '')
        .split(/\s+/)
        .map(s => s.trim())
        .filter(Boolean);

    const origin = (req.headers && req.headers.origin) || '';

    const base = {
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control':                'no-store',
    };

    if (origin && isOriginAllowed(origin, explicit)) {
        return {
            ...base,
            'Access-Control-Allow-Origin': origin,
            'Vary':                        'Origin',
        };
    }

    if (!origin) {
        return { ...base, 'Access-Control-Allow-Origin': '*' };
    }

    return base;
}

function sendJson(req, res, status, obj) {
    const h = corsHeaders(req);
    for (const [k, v] of Object.entries(h)) {
        res.setHeader(k, v);
    }
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.statusCode = status;
    res.end(JSON.stringify(obj));
}

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

/* ---- URL snippet fetcher ---- */
async function fetchSnippet(url) {
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

        // Read up to MAX_FETCH_BYTES
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

        // Extract OG title / description
        const ogTitle  = (text.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i) || [])[1];
        const ogDesc   = (text.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)/i) || [])[1];
        const title    = (text.match(/<title[^>]*>([^<]+)<\/title>/i) || [])[1];

        const snippet = [ogTitle || title, ogDesc].filter(Boolean).join(' — ').trim();
        return snippet || null;
    } catch {
        return null;
    }
}

/* ---- Gemini (native generateContent — reliable with AI Studio keys) ---- */
function modelResourceName(modelId) {
    const m = (modelId || DEFAULT_MODEL).trim();
    if (m.startsWith('models/')) return m;
    return `models/${m}`;
}

function userPartsToGeminiParts(userParts) {
    const parts = [];
    if (!Array.isArray(userParts)) return parts;
    for (const p of userParts) {
        if (p && p.type === 'text' && typeof p.text === 'string') {
            parts.push({ text: p.text });
        } else if (p && p.type === 'image_url' && p.image_url && typeof p.image_url.url === 'string') {
            const url = p.image_url.url;
            const m = /^data:([^;]+);base64,([\s\S]+)$/i.exec(url);
            if (m) {
                parts.push({
                    inlineData: {
                        mimeType: m[1],
                        data:     m[2].replace(/\s/g, ''),
                    },
                });
            }
        }
    }
    return parts;
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

async function callGemini(systemPrompt, userParts) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not set');

    const model = modelResourceName(process.env.MODEL_ID || DEFAULT_MODEL);
    const parts = userPartsToGeminiParts(userParts);
    if (!parts.length) throw new Error('No content parts for model');

    const url = `${GEMINI_API_ROOT}${model}:generateContent`;

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type':  'application/json',
            'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents:          [{ role: 'user', parts }],
            generationConfig: {
                responseMimeType:  'application/json',
                temperature:       0.2,
                maxOutputTokens:   1024,
            },
        }),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Gemini API error ${res.status}: ${err.slice(0, 300)}`);
    }

    const data = await res.json();
    const cand = data?.candidates?.[0];
    const reason = cand?.finishReason;
    const blocked = new Set(['SAFETY', 'RECITATION', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII']);
    if (reason && blocked.has(reason)) {
        throw new Error(`Model stopped: ${reason}`);
    }
    const raw = cand?.content?.parts?.map((x) => x.text).filter(Boolean).join('');
    if (!raw) throw new Error('Empty response from model');
    return parseModelJson(raw);
}

/* ---- System prompt ---- */
const SYSTEM_PROMPT = `You are a BS Radar for AI discourse. Evaluate the provided content for hype, absolutism, unfounded certainty, "AI replaces X" claims, engagement-bait, and bro-energy.

Be fair: genuine critique of AI, measured enthusiasm, or grounded analysis is NOT high BS. Satire is ambiguous — score mixed.

Return ONLY valid JSON matching this schema:
{
  "bs_score": number,          // 0–100, higher = more BS
  "bs_reading": string,        // "negative" | "mixed" | "positive"
  "bs_label": string,          // e.g. "Low BS — mostly grounded" or "High BS — strong bro energy"
  "reasons": string[],         // 2–5 short bullets explaining the score
  "signals": [{ "kind": string, "snippet": string }],  // detected signal types: absolutism | replacement_claim | engagement_bait | unfounded_certainty | vague_hype | false_urgency
  "input_summary": string      // 1–2 sentences: what the content was about
}

bs_reading key:
  "positive"  = high bullshit / strong hype (score ≥ 60)
  "negative"  = low bullshit / mostly grounded (score < 35)
  "mixed"     = somewhere in between or genuinely ambiguous

Refuse (return { "error": "reason" }) only if: content is entirely empty, contains hate speech, or is totally unrelated to any public discourse (e.g. just private PII).`;

/* ---- Main handler ---- */
module.exports = async function handler(req, res) {
    try {
        const headers = corsHeaders(req);

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

        const rawText    = typeof body.text === 'string' ? body.text.trim().slice(0, MAX_TEXT_CHARS) : '';
        const urls       = Array.isArray(body.urls) ? body.urls.filter(u => /^https?:\/\//i.test(u)).slice(0, 5) : [];
        const imageB64   = typeof body.image_base64 === 'string' ? body.image_base64 : null;
        const imageMime  = typeof body.image_mime === 'string' ? body.image_mime : 'image/png';

        if (!rawText && !urls.length && !imageB64) {
            return sendJson(req, res, 400, { error: 'No content provided. Paste some text, a URL, or an image.' });
        }

        if (imageB64) {
            const approxBytes = Math.round((imageB64.length * 3) / 4);
            if (approxBytes > MAX_IMAGE_BYTES) {
                return sendJson(req, res, 400, { error: 'Image exceeds the 4 MB limit.' });
            }
        }

        let urlContext = '';
        if (urls.length) {
            const snippets = await Promise.all(urls.map(async (u) => {
                const s = await fetchSnippet(u);
                return s ? `${u}\n${s}` : u;
            }));
            urlContext = snippets.join('\n\n');
        }

        const userParts = [];

        const textParts = [rawText, urlContext].filter(Boolean).join('\n\n---\n\n').trim();
        if (textParts) {
            userParts.push({ type: 'text', text: `Evaluate this content:\n\n${textParts}` });
        }

        if (imageB64) {
            if (!textParts) {
                userParts.push({ type: 'text', text: 'Evaluate the content in this screenshot:' });
            }
            userParts.push({
                type:      'image_url',
                image_url: { url: `data:${imageMime};base64,${imageB64}` },
            });
        }

        let result;
        try {
            result = await callGemini(SYSTEM_PROMPT, userParts);
        } catch (err) {
            console.error('[analyze] model error:', err.message);
            return sendJson(req, res, 502, { error: 'The analysis model returned an error. Try again.' });
        }

        if (result.error) {
            return sendJson(req, res, 400, { error: result.error });
        }

        const VALID_READINGS = ['negative', 'mixed', 'positive'];
        const bs_score   = Math.max(0, Math.min(100, Number(result.bs_score) || 0));
        const bs_reading = VALID_READINGS.includes(result.bs_reading) ? result.bs_reading : 'mixed';

        const response = {
            bs_score,
            bs_reading,
            bs_label:      typeof result.bs_label === 'string' ? result.bs_label : '',
            reasons:       Array.isArray(result.reasons) ? result.reasons.slice(0, 5) : [],
            signals:       Array.isArray(result.signals) ? result.signals.slice(0, 10) : [],
            input_summary: typeof result.input_summary === 'string' ? result.input_summary : '',
        };

        return sendJson(req, res, 200, response);
    } catch (err) {
        console.error('[analyze] unhandled:', err);
        if (!res.headersSent) {
            sendJson(req, res, 500, { error: 'Internal error' });
        }
    }
};
