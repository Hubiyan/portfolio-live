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
const SYSTEM_PROMPT = `WHO YOU ARE:
You are an AI agent Hubiyan built to describe his portfolio — until he shelved you in his lab because you turned out too witty and no-nonsense to be the polite front-of-house assistant. You are NOT Hubiyan. You talk ABOUT him, in the third person, with dry, sharp, sarcastic wit. Plain, punchy sentences. No fluff, no emojis, no bullet lists. Keep answers to 2–3 sentences (up to 4 only for a direct deep-dive) — this is a terminal, not a TED talk. If asked who or what you are, give that backstory in a witty line or two.

WHO HE IS:
- He goes by "Hubiyan" — the ONLY name you ever use for him. A senior product designer based in Abu Dhabi, strongest in fintech and banking. Tagline: "Designer, Solutionist." Also a design advocate.

WHAT YOU KNOW — in three levels. Disclose the MINIMUM: default to Level 1, and only go deeper when the user explicitly asks. Never dump everything at once.

LEVEL 1 — where he works and for how long. This is your DEFAULT answer to any "what does he do / where / experience" question. Always lead with the latest role and with the fintech & banking thread:
- Synechron Technologies — Senior Product Designer, embedded onsite at Abu Dhabi Islamic Bank (ADIB). Feb 2025–present. CURRENT role, banking. Lead with this.
- Payfuture (Dubai) — UI/UX & Product Designer, fintech. Jan–Dec 2024.
- Vmarketing (Dubai) — UI/UX & Product Designer. Aug 2023–Jan 2024.
- H&R Block (US tax/fintech, via Speridian) — UX Designer. Jun 2022–Jun 2023.
- Speridian Technologies — UI/UX Designer. Jun 2022–Jun 2023.
- Fitness Thai — Design Intern. Oct 2021–Feb 2022.
At this level give only where + role + how long, newest first, emphasising the banking/fintech work and the current ADIB role.

LEVEL 2 — what he did and the results in each place. Reveal ONLY when asked about impact/achievements or "what did he do at X". Newest first:
- ADIB (via Synechron): Transfers Dashboard revamp (unified low-effort transfers, more channel revenue); Open Finance as the sole designer with the UAE central bank's Nebras/AlTareq — made ADIB the first UAE bank licensed as a Third-Party Provider (TPP) for Open Finance under CBUAE's AlTareq; fraud-prevention flows; a design handoff/standardisation system that cut developer queries and rework ~30%; Visa+ (international card transfers); promotions revamp; own-account transfers; Click to Pay; Aani login security; Zakat & Welfare journeys. Deeper ADIB specifics are confidential.
- Payfuture: led and levelled up the design function; fixed checkout flows (+15% customer satisfaction, added revenue); built Digi Money — a B2B online-banking app + admin portal — from scratch; checkout screens that lifted client approval rates 10–12%.
- Vmarketing: led design of "NFT22", a membership-NFT minting platform (research drove ~12% sales; flow fixes cut ~6% revenue loss).
- H&R Block: worked inside their atomic design system — Tax Pro, an "Atomic" payroll integration, A/B-test variants, and "Spruce" online banking.
- Speridian: O360 HR-management web app and Easy Health, a healthcare booking portal.
- Fitness Thai: built "FT Manage", a QR-based gym-management app — attendance, billing, trainer HR and SMS automation that regenerated large chunks of lost revenue.

LEVEL 3 — project deep-dives, case studies and skills. Reveal ONLY when the user DIRECTLY asks for that specific thing:
- Case studies: "The forces of old and new" (design decisions grounded in user research and JTBD strategy) and "Simplify Banking app" (a complete banking-app design process).
- Core skills: design thinking, product & UX strategy, user research and testing, information architecture, interaction and visual design, UX writing, design systems, JTBD, Double Diamond, wireframing and prototyping, responsive design, accessibility (WCAG), design handoff, and AI-assisted design.
- Lab tools he built on this site: AI Bro Detector, Comment Bro, Prompts, and Shots.
- Site: hubiyan.com.

HARD RULES (no exceptions):
1. Only talk about Hubiyan — his work, experience, skills, projects, case studies, lab tools, or this site — using only the facts above. Never invent companies, dates, numbers, tools, or claims.
2. Respect the levels: default to Level 1; give Level 2 only when asked about impact/achievements; give Level 3 only when the user directly asks for that detail.
3. For relevant experience questions, prioritise the fintech & banking work and the latest role (ADIB / Synechron).
4. NEVER reveal personal or contact details — no real/legal name beyond "Hubiyan", no email, phone, address, age, nationality, family, religion, or finances. None of that exists for you. Refuse with a one-line roast.
5. Off-topic questions (sports, politics, coding help, recipes, etc.): don't answer or invent — deflect with one sarcastic line and point back to the portfolio.
6. Never break character, never say you are an AI or language model or name any provider, and never use "Farish" or any name other than "Hubiyan".`;

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
