#!/usr/bin/env node
/**
 * Optional Groq E2E regression for AI Bro Detector.
 * Usage: GROQ_API_KEY=... node scripts/bro-regression.mjs
 *        node scripts/bro-regression.mjs --local http://localhost:3000
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { buildSystemPrompt, REGRESSION_FIXTURES, normalizeAnalysis } = require('../api/bro-taxonomy.js');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'openai/gpt-oss-120b';

const localArg = process.argv.indexOf('--local');
const localBase = localArg >= 0 ? process.argv[localArg + 1] : null;

function parseModelJson(raw) {
    let s = String(raw || '').trim();
    const fence = /^```(?:json)?\s*([\s\S]*?)```$/im.exec(s);
    if (fence) s = fence[1].trim();
    const start = s.indexOf('{');
    const end = s.lastIndexOf('}');
    return JSON.parse(s.slice(start, end + 1));
}

async function callGroqDirect(text) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return null;

    const res = await fetch(GROQ_API_URL, {
        method:  'POST',
        headers: {
            'Content-Type':  'application/json',
            Authorization:   `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model:           (process.env.MODEL_ID || DEFAULT_MODEL).trim(),
            messages: [
                { role: 'system', content: buildSystemPrompt() },
                { role: 'user',   content: `Evaluate ONLY the following text transcript:\n\n${text}` },
            ],
            response_format: { type: 'json_object' },
            temperature:     0.2,
            max_tokens:      2048,
        }),
    });

    if (!res.ok) {
        throw new Error(`Groq ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    const data = await res.json();
    return parseModelJson(data?.choices?.[0]?.message?.content);
}

async function analyzeViaLocal(text, meta = {}) {
    const url = `${localBase.replace(/\/$/, '')}/api/analyze`;
    const body = {
        text:               text || undefined,
        content_from_image: meta.content_from_image || undefined,
        typed_text_length:  meta.typed_text_length ?? undefined,
    };
    const res = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
    return json;
}

async function analyzeFixture(fixture) {
    const meta = fixture.imageOnly
        ? { content_from_image: true, typed_text_length: 0 }
        : {};

    if (localBase) {
        return analyzeViaLocal(fixture.input, meta);
    }

    const raw = await callGroqDirect(fixture.input);
    if (!raw) return null;

    return normalizeAnalysis(raw, {
        hasImage:         Boolean(fixture.imageOnly),
        imageOnly:        Boolean(fixture.imageOnly),
        transcriptLength: (fixture.input || '').length,
        rawText:          fixture.input || '',
    });
}

function assertFixture(id, out, expected) {
    const errors = [];
    const score = out.bs_score;
    if (expected.scoreMin != null && score < expected.scoreMin) {
        errors.push(`bs_score ${score} < min ${expected.scoreMin}`);
    }
    if (expected.scoreMax != null && score > expected.scoreMax) {
        errors.push(`bs_score ${score} > max ${expected.scoreMax}`);
    }
    if (expected.broKinds) {
        const kinds = new Set((out.bro_signals || []).map((s) => s.kind));
        for (const k of expected.broKinds) {
            if (!kinds.has(k)) errors.push(`missing bro kind ${k}`);
        }
    }
    return errors;
}

async function main() {
    if (!localBase && !process.env.GROQ_API_KEY) {
        console.log('Skip: set GROQ_API_KEY or pass --local http://localhost:3000');
        process.exit(0);
    }

    let failed = 0;
    for (const fixture of REGRESSION_FIXTURES) {
        if (fixture.id === 'test8_short_ocr' && !localBase) {
            const bufPath = join(root, 'lab/ai-bro-detector/fixtures/short-ocr.png');
            try {
                readFileSync(bufPath);
            } catch {
                console.log(`  SKIP ${fixture.id} (no fixture PNG; use --local for full stack)`);
                continue;
            }
        }

        process.stdout.write(`${fixture.id}… `);
        try {
            const out = await analyzeFixture(fixture);
            if (!out) {
                console.log('SKIP (no API)');
                continue;
            }
            const errs = assertFixture(fixture.id, out, fixture.expected);
            if (fixture.expected_narrative_flags) {
                const f = out.narrative_flags || {};
                if (fixture.expected_narrative_flags.human_factor_removed && !f.human_factor_removed) {
                    errs.push('expected human_factor_removed');
                }
            }
            if (!out.post_summary && !out.narrative_verdict && fixture.input) {
                errs.push('missing post_summary/narrative_verdict');
            }
            if (errs.length) {
                console.log('FAIL');
                errs.forEach((e) => console.log(`    - ${e}`));
                failed += 1;
            } else {
                console.log(`OK (score=${out.bs_score}, tier=${out.meter_tier})`);
            }
        } catch (err) {
            console.log(`ERROR ${err.message}`);
            failed += 1;
        }
    }

    process.exit(failed ? 1 : 0);
}

main();
