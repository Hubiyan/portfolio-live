/**
 * GET /api/quota
 *
 * Read-only per-IP rate limit status (5 analyses / 12 hours).
 * Does not consume an analysis.
 */

const { corsHeaders, sendJson } = require('./cors');
const { getClientIp, checkAndRecord, rateLimitPayload } = require('./rate-limit');

module.exports = async function handler(req, res) {
    try {
        const headers = corsHeaders(req, 'GET, OPTIONS');

        if (req.method === 'OPTIONS') {
            return res.writeHead(204, headers).end();
        }

        if (req.method !== 'GET') {
            return sendJson(req, res, 405, { error: 'Method not allowed' }, 'GET, OPTIONS');
        }

        const ip = getClientIp(req);
        const rl = await checkAndRecord(ip, { record: false });

        return sendJson(req, res, 200, {
            rate_limit: rateLimitPayload(rl),
        }, 'GET, OPTIONS');
    } catch (err) {
        console.error('[quota] unhandled:', err);
        if (!res.headersSent) {
            sendJson(req, res, 500, { error: 'Internal error' }, 'GET, OPTIONS');
        }
    }
};
