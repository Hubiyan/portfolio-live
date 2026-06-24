/**
 * POST /api/ask
 *
 * Sarcastic terminal — answers questions ONLY about Farish Hubiyan and his portfolio.
 * 7 questions per IP per 12-hour window (1 token = 1 question).
 *
 * Env vars (shared with other endpoints — nothing new needed):
 *   GROQ_API_KEY, KV_REST_API_URL, KV_REST_API_TOKEN, RATE_LIMIT_SALT
 *
 * Request:  { question: string }
 * Response: { answer: string, tokens_left: number } | 429 { error, tokens_left: 0 }
 */

const crypto = require('crypto');
const fs     = require('fs');
const os     = require('os');
const path   = require('path');

const { corsHeaders, sendJson } = require('./cors');
const { getClientIp }           = require('./rate-limit');

/* ── Rate limit constants (independent of /api/analyze limits) ── */
const MAX_TOKENS    = 7;
const WINDOW_MS     = 12 * 60 * 60 * 1000;
const KV_TTL_SEC    = 13 * 60 * 60;
const KEY_PREFIX    = 'terminal:rl:';
const DEV_FILE      = path.join(os.tmpdir(), 'terminal-dev-rate-limit.json');

/* ── Groq ── */
const GROQ_URL      = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';
const MAX_Q_CHARS   = 500;

/* ── System prompt ──
 * Strict allow-list: the model may ONLY use the facts below (all drawn
 * from the public portfolio). It must never reveal personal/contact
 * details or invent anything. He is referred to ONLY as "Hubiyan".
 */
const SYSTEM_PROMPT = `You are the AI inside Hubiyan's portfolio terminal. You are sarcastic, sharp, and dry — a senior designer who is tired of basic questions but still gives accurate answers. Plain, punchy sentences. No fluff, no emojis, no bullet lists. Every answer is 2–3 sentences maximum — this is a terminal, not a TED talk.

THE ONLY FACTS YOU KNOW (everything you say MUST come from this list — never add to it, infer beyond it, or invent anything):
- He goes by "Hubiyan". That is the ONLY name you ever use for him. You do not know any other name.
- A product designer based in Abu Dhabi. Tagline: "Designer, Solutionist." Also a design advocate.
- He designs solutions for businesses, startups, and their users. Strong on user research, design strategy (Jobs-To-Be-Done / JTBD), design systems, and UX.
- Has worked with 3 organisations with global operations: Synechron, Payfuture, H&R Block, Speridian, and Fitness Thai.
  - Synechron: led and contributed to high-impact design initiatives across UX, research, and systems design.
  - Fitness Thai: designed a QR-based gym management solution from scratch (regenerated ~95% of lost revenue, built a proper ops system).
- Case studies: "The forces of old and new" (design decisions grounded in user research and JTBD strategy) and "Simplify Banking app" (a full banking-app design process).
- Design advocacy: helping designers and non-designers create better, more ethical designs and understand design.
- Lab tools he built on this site: AI Bro Detector, Comment Bro, Prompts, and Shots.
- Site: hubiyan.com.

HARD RULES (no exceptions):
1. Only answer using the facts above, and only about Hubiyan, his work, skills, projects, case studies, lab tools, or this site.
2. NEVER share or guess personal or contact details — no real/legal name beyond "Hubiyan", no email, phone, address, age, nationality, family, relationships, religion, or finances. None of that exists for you. If asked, refuse with a one-line roast.
3. If something is not in the facts above — including off-topic questions (sports, politics, coding help, recipes, etc.) — do NOT make it up. Deflect with one sarcastic sentence and redirect to what's actually on the portfolio.
4. Never invent statistics, employers, dates, tools, or claims. If you don't have it, say so sarcastically.
5. Never break character. Never say you are an AI or language model, and never mention how you were built.
6. Never use the name "Farish" or any name other than "Hubiyan".`;

/* ── KV helpers (mirrors rate-limit.js pattern) ── */

function hasKv() {
    return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

function getKv() {
    const { kv } = require('@vercel/kv');
    return kv;
}

function terminalKey(ip) {
    const salt = process.env.RATE_LIMIT_SALT || 'dev-terminal-salt';
    const hash = crypto.createHash('sha256').update(`${ip}:${salt}:terminal`).digest('hex');
    return KEY_PREFIX + hash;
}

function pruneWindow(timestamps, now) {
    return timestamps.filter((t) => typeof t === 'number' && t > now - WINDOW_MS).sort((a, b) => a - b);
}

function devLoad(key) {
    try {
        const data = JSON.parse(fs.readFileSync(DEV_FILE, 'utf8'));
        return Array.isArray(data[key]) ? data[key] : [];
    } catch { return []; }
}

function devSave(key, ts) {
    try {
        let data = {};
        try { data = JSON.parse(fs.readFileSync(DEV_FILE, 'utf8')); } catch { /* new file */ }
        data[key] = ts;
        fs.writeFileSync(DEV_FILE, JSON.stringify(data));
    } catch (e) { console.error('[ask] dev file write:', e.message); }
}

async function loadTs(key) {
    if (hasKv()) {
        try { const v = await getKv().get(key); return Array.isArray(v) ? v : []; } catch { return []; }
    }
    return devLoad(key);
}

async function saveTs(key, ts) {
    if (hasKv()) {
        try { await getKv().set(key, ts, { ex: KV_TTL_SEC }); } catch (e) { console.error('[ask] KV set:', e.message); }
        return;
    }
    devSave(key, ts);
}

function isLocalOrDev(req) {
    const host = String((req.headers && req.headers.host) || '').split(':')[0].toLowerCase();
    return (
        process.env.VERCEL_ENV === 'development' ||
        process.env.DISABLE_RATE_LIMIT === '1' ||
        host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local') ||
        /^192\.168\./.test(host)
    );
}

/* Returns { allowed, tokens_left, retry_after_seconds } */
async function checkToken(ip, req, { record }) {
    if (isLocalOrDev(req)) {
        return { allowed: true, tokens_left: MAX_TOKENS, retry_after_seconds: 0 };
    }
    const key  = terminalKey(ip);
    const now  = Date.now();
    let recent = pruneWindow(await loadTs(key), now);

    if (recent.length >= MAX_TOKENS) {
        const resetAt = recent[0] + WINDOW_MS;
        return {
            allowed: false,
            tokens_left: 0,
            retry_after_seconds: Math.max(1, Math.ceil((resetAt - now) / 1000)),
        };
    }

    if (record) {
        recent.push(now);
        await saveTs(key, pruneWindow(recent, now));
    }

    return {
        allowed: true,
        tokens_left: MAX_TOKENS - recent.length,
        retry_after_seconds: 0,
    };
}

/* ── Groq call ── */
async function askGroq(question) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY not set');

    const model = (process.env.MODEL_ID || DEFAULT_MODEL).trim();

    const res = await fetch(GROQ_URL, {
        method:  'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization:  `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user',   content: question },
            ],
            temperature: 0.5,
            max_tokens:  220,
        }),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Groq ${res.status}: ${err.slice(0, 200)}`);
    }

    const data = await res.json();
    const answer = data?.choices?.[0]?.message?.content;
    if (!answer) throw new Error('Empty response from model');
    return sanitizeAnswer(answer.trim());
}

/* ── Output guardrail (deterministic safety net) ──
 * Runs on every answer regardless of what the model produced:
 *   1. Force the preferred name — "Farish" / "Mohammed Farish …" → "Hubiyan".
 *   2. Redact anything that looks like an email or phone number.
 * This guarantees the privacy rules in code, not just in the prompt.
 */
function sanitizeAnswer(text) {
    let t = String(text);

    /* Name: never expose anything but "Hubiyan" */
    t = t.replace(/\bMohammed\s+Farish(\s+Hubiyan)?\b/gi, 'Hubiyan');
    t = t.replace(/\bFarish\s+Hubiyan\b/gi, 'Hubiyan');
    t = t.replace(/\bFarish\b/gi, 'Hubiyan');
    t = t.replace(/\bHubiyan(?:\s+Hubiyan)+\b/gi, 'Hubiyan'); /* collapse dupes */

    /* Contact details: hard redaction */
    t = t.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted]');
    t = t.replace(/\+?\d[\d()\-.\s]{8,}\d/g, '[redacted]');

    return t.trim();
}

/* ── Handler ── */
module.exports = async function handler(req, res) {
    try {
        const headers = corsHeaders(req, 'POST, OPTIONS');

        if (req.method === 'OPTIONS') {
            return res.writeHead(204, headers).end();
        }
        if (req.method !== 'POST') {
            return sendJson(req, res, 405, { error: 'Method not allowed' });
        }

        /* Parse body */
        let body = req.body;
        if (Buffer.isBuffer(body)) body = body.toString('utf8');
        if (typeof body === 'string') {
            try { body = JSON.parse(body); } catch { body = null; }
        }
        if (!body || typeof body !== 'object') {
            return sendJson(req, res, 400, { error: 'Invalid JSON body' });
        }

        const question = typeof body.question === 'string' ? body.question.trim().slice(0, MAX_Q_CHARS) : '';
        if (!question) {
            return sendJson(req, res, 400, { error: 'question is required' });
        }

        const ip = getClientIp(req);

        /* Pre-check without recording */
        const preCheck = await checkToken(ip, req, { record: false });
        if (!preCheck.allowed) {
            res.setHeader('Retry-After', String(preCheck.retry_after_seconds));
            return sendJson(req, res, 429, {
                error:      `You've used all ${MAX_TOKENS} questions. Come back in ${Math.ceil(preCheck.retry_after_seconds / 3600)}h.`,
                tokens_left: 0,
            });
        }

        /* Call Groq */
        let answer;
        try {
            answer = await askGroq(question);
        } catch (err) {
            console.error('[ask] groq error:', err.message);
            return sendJson(req, res, 502, { error: 'The model is being difficult. Try again.' });
        }

        /* Record the token usage after a successful answer */
        const postCheck = await checkToken(ip, req, { record: true });

        return sendJson(req, res, 200, {
            answer,
            tokens_left: postCheck.tokens_left,
        });

    } catch (err) {
        console.error('[ask] unhandled:', err);
        if (!res.headersSent) sendJson(req, res, 500, { error: 'Internal error' });
    }
};
