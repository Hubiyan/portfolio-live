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

function getClientIp(req) {
    const xff = req.headers && req.headers['x-forwarded-for'];
    if (typeof xff === 'string' && xff.trim()) {
        return xff.split(',')[0].trim();
    }
    const realIp = req.headers && req.headers['x-real-ip'];
    if (typeof realIp === 'string' && realIp.trim()) return realIp.trim();
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
        unlimited:         true,
        limit:             MAX_REQUESTS,
        remaining:         MAX_REQUESTS,
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
        try {
            const kv = getKv();
            const v = await kv.get(key);
            return Array.isArray(v) ? v : [];
        } catch (err) {
            console.error('[rate-limit] KV get failed:', err.message);
            return [];
        }
    }
    return devLoad(key);
}

async function saveTimestamps(key, timestamps) {
    if (hasKv()) {
        try {
            const kv = getKv();
            await kv.set(key, timestamps, { ex: KV_TTL_SEC });
        } catch (err) {
            console.error('[rate-limit] KV set failed:', err.message);
        }
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
            unlimited:         false,
            limit,
            remaining:         0,
            resetAt,
            retryAfterSeconds,
        };
    }

    return {
        allowed:           true,
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
async function checkAndRecord(ip, { record }) {
    if (isWhitelisted(ip)) return whitelistResult();

    const key = ipKey(ip);
    const now = Date.now();
    let recent = prune(await loadTimestamps(key), now);

    if (!record) {
        return buildResult(recent, { record: false, now });
    }

    recent.push(now);
    await saveTimestamps(key, recent);
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
    getClientIp,
    checkAndRecord,
    rateLimitPayload,
};
