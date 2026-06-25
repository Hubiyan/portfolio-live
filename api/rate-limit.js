/**
 * Per-IP rate limit for /api/analyze (rolling window).
 * Production: Vercel KV. Local dev without KV: file-backed store in os.tmpdir().
 *
 * Best-effort IP limits — VPN/NAT can share or bypass. Protects Groq budget, not auth.
 *
 * Whitelist: set WHITELISTED_IPS env var (comma-separated IPs) to grant unlimited tokens.
 */

const crypto = require('crypto');
const fs     = require('fs');
const os     = require('os');
const path   = require('path');

const WINDOW_MS    = 12 * 60 * 60 * 1000;
const MAX_REQUESTS = 5;
const KV_TTL_SEC   = 13 * 60 * 60; // buffer over 12h window

const DEV_STORE_FILE = path.join(os.tmpdir(), 'ai-bro-dev-rate-limit.json');

function hasKv() {
    return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

function getKv() {
    if (!hasKv()) return null;
    // eslint-disable-next-line global-require
    const { kv } = require('@vercel/kv');
    return kv;
}

/* ---- Shared global daily budget (protects the single GROQ_API_KEY across
   /api/ask, /api/analyze and /api/comment) ----
   Atomic counter (INCR) keyed per UTC day. Reserve-then-refund: callers
   reserve before hitting Groq and refund if the upstream call fails.
   Fails CLOSED — if KV is configured but errors, we report `unavailable`
   so the caller can return 503 instead of silently allowing unlimited spend. */
const GLOBAL_DAILY_MAX = Number(process.env.GROQ_GLOBAL_DAILY_MAX || 500);
const GLOBAL_TTL_SEC   = 26 * 60 * 60; // > 24h buffer

function globalBudgetKey() {
    const day = new Date().toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD (UTC)
    return `groq:global:${day}`;
}

async function reserveGlobalBudget() {
    /* No KV configured (local/dev) → don't gate globally. */
    if (!hasKv()) return { allowed: true, unavailable: false, remaining: GLOBAL_DAILY_MAX };

    const kv  = getKv();
    const key = globalBudgetKey();
    let count;
    try {
        count = await kv.incr(key);
        if (count === 1) {
            try { await kv.expire(key, GLOBAL_TTL_SEC); } catch (e) { console.error('[rate-limit] global expire:', e.message); }
        }
    } catch (e) {
        console.error('[rate-limit] global incr failed:', e.message);
        return { allowed: false, unavailable: true, remaining: 0 };
    }

    if (count > GLOBAL_DAILY_MAX) {
        try { await kv.decr(key); } catch (e) { console.error('[rate-limit] global decr:', e.message); }
        return { allowed: false, unavailable: false, remaining: 0 };
    }
    return { allowed: true, unavailable: false, remaining: Math.max(0, GLOBAL_DAILY_MAX - count) };
}

async function refundGlobalBudget() {
    if (!hasKv()) return;
    try { await getKv().decr(globalBudgetKey()); } catch (e) { console.error('[rate-limit] global refund:', e.message); }
}

function getClientIp(req) {
    const h = (req && req.headers) || {};
    /* Prefer the headers Vercel sets from the TCP connection — these cannot be
       overwritten by a proxy/client. `x-vercel-forwarded-for` survives even when
       a proxy on top rewrites `x-forwarded-for`; `x-real-ip` is the canonical
       client IP used by @vercel/functions. Raw XFF is the last resort. */
    const vff = h['x-vercel-forwarded-for'];
    if (typeof vff === 'string' && vff.trim()) return vff.split(',')[0].trim();

    const realIp = h['x-real-ip'];
    if (typeof realIp === 'string' && realIp.trim()) return realIp.trim();

    const xff = h['x-forwarded-for'];
    if (typeof xff === 'string' && xff.trim()) return xff.split(',')[0].trim();

    return 'unknown';
}

/* ---- IP whitelist ---- */

function isWhitelisted(ip) {
    const raw = process.env.WHITELISTED_IPS || '';
    if (!raw.trim()) return false;
    return raw.split(',').map((s) => s.trim()).filter(Boolean).includes(ip);
}

function whitelistResult() {
    return {
        allowed:           true,
        unavailable:       false,
        unlimited:         true,
        limit:             MAX_REQUESTS,
        remaining:         MAX_REQUESTS,
        resetAt:           null,
        retryAfterSeconds: 0,
    };
}

function unavailableResult() {
    return {
        allowed:           false,
        unavailable:       true,
        unlimited:         false,
        limit:             MAX_REQUESTS,
        remaining:         0,
        resetAt:           null,
        retryAfterSeconds: 0,
    };
}

/* ---- Key / store helpers ---- */

function ipKey(ip) {
    const salt = process.env.RATE_LIMIT_SALT || 'dev-rate-limit-salt-change-in-production';
    const hash = crypto.createHash('sha256').update(`${ip}:${salt}`).digest('hex');
    return `analyze:rl:${hash}`;
}

function prune(timestamps, now) {
    const cutoff = now - WINDOW_MS;
    return timestamps.filter((t) => typeof t === 'number' && t > cutoff).sort((a, b) => a - b);
}

/* ---- File-backed dev store ---- */

function devLoad(key) {
    try {
        const raw = fs.readFileSync(DEV_STORE_FILE, 'utf8');
        const data = JSON.parse(raw);
        return Array.isArray(data[key]) ? data[key] : [];
    } catch {
        return [];
    }
}

function devSave(key, timestamps) {
    try {
        let data = {};
        try { data = JSON.parse(fs.readFileSync(DEV_STORE_FILE, 'utf8')); } catch { /* new file */ }
        data[key] = timestamps;
        fs.writeFileSync(DEV_STORE_FILE, JSON.stringify(data));
    } catch (err) {
        console.error('[rate-limit] dev file write failed:', err.message);
    }
}

/* ---- KV / dev store abstraction ---- */

async function loadTimestamps(key) {
    if (hasKv()) {
        const kv = getKv();
        const v = await kv.get(key);
        return Array.isArray(v) ? v : [];
    }
    return devLoad(key);
}

async function saveTimestamps(key, timestamps) {
    if (hasKv()) {
        const kv = getKv();
        await kv.set(key, timestamps, { ex: KV_TTL_SEC });
        return;
    }
    devSave(key, timestamps);
}

function buildResult(recent, { record, now }) {
    const limit = MAX_REQUESTS;
    const resetAt = recent.length ? recent[0] + WINDOW_MS : null;
    const remaining = Math.max(0, limit - recent.length);
    const retryAfterSeconds = resetAt
        ? Math.max(1, Math.ceil((resetAt - now) / 1000))
        : 0;

    if (!record && recent.length >= MAX_REQUESTS) {
        return {
            allowed:           false,
            unavailable:       false,
            unlimited:         false,
            limit,
            remaining:         0,
            resetAt,
            retryAfterSeconds,
        };
    }

    return {
        allowed:           true,
        unavailable:       false,
        unlimited:         false,
        limit,
        remaining,
        resetAt,
        retryAfterSeconds: 0,
    };
}

/**
 * @param {string} ip
 * @param {{ record: boolean }} opts — record:true appends a timestamp after a successful analyze
 */
function isRateLimitDisabled() {
    if (process.env.VERCEL_ENV === 'development') return true;
    const v = process.env.DISABLE_RATE_LIMIT;
    return v === '1' || v === 'true' || String(v || '').toLowerCase() === 'yes';
}

/** Local `vercel dev` / LAN testing — Host is localhost or private IP.
 *  Disabled in production: a Host header is attacker-controllable behind some
 *  proxies, so it must never grant a rate-limit bypass on the live site. */
function isLocalDevRequest(req) {
    if (process.env.VERCEL_ENV === 'production') return false;
    if (!req || !req.headers) return false;
    const host = String(req.headers.host || '').split(',')[0].trim().toLowerCase();
    if (!host) return false;
    const hostname = host.split(':')[0];
    return hostname === 'localhost'
        || hostname === '127.0.0.1'
        || hostname.endsWith('.local')
        || /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)
        || host.endsWith('.trycloudflare.com');
}

async function checkAndRecord(ip, { record, req } = {}) {
    if (isRateLimitDisabled() || isLocalDevRequest(req) || isWhitelisted(ip)) return whitelistResult();

    const key = ipKey(ip);
    const now = Date.now();
    let recent;
    try {
        recent = prune(await loadTimestamps(key), now);
    } catch (err) {
        console.error('[rate-limit] KV get failed:', err.message);
        return unavailableResult();
    }

    if (!record) {
        return buildResult(recent, { record: false, now });
    }

    recent.push(now);
    try {
        await saveTimestamps(key, recent);
    } catch (err) {
        console.error('[rate-limit] KV set failed:', err.message);
        return unavailableResult();
    }
    recent = prune(recent, now);
    return buildResult(recent, { record: true, now });
}

function rateLimitPayload(rl) {
    return {
        limit:     rl.limit,
        remaining: rl.remaining,
        reset_at:  rl.resetAt,
        unlimited: rl.unlimited || false,
    };
}

module.exports = {
    WINDOW_MS,
    MAX_REQUESTS,
    GLOBAL_DAILY_MAX,
    getClientIp,
    checkAndRecord,
    rateLimitPayload,
    reserveGlobalBudget,
    refundGlobalBudget,
};
