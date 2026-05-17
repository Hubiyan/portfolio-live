/**
 * Shared CORS helpers for AI Bro Detector API routes.
 */

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

function corsHeaders(req, methods = 'POST, GET, OPTIONS') {
    const explicit = (process.env.ALLOWED_ORIGIN || '')
        .split(/\s+/)
        .map((s) => s.trim())
        .filter(Boolean);

    const origin = (req.headers && req.headers.origin) || '';

    const base = {
        'Access-Control-Allow-Methods': methods,
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

function sendJson(req, res, status, obj, methods) {
    const h = corsHeaders(req, methods);
    for (const [k, v] of Object.entries(h)) {
        res.setHeader(k, v);
    }
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.statusCode = status;
    res.end(JSON.stringify(obj));
}

module.exports = { corsHeaders, sendJson };
