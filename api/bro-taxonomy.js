/**
 * AI Bro Detector — rhetoric taxonomy, weights, tier states, normalization.
 * High meter: hype, fear, course/lead-magnet farming, reality-blind claims.
 * Below zero: AI as human-benefit tool, steps, verifiable research, market-aware limits.
 */

const BRO_WEIGHTS = {
    absolutism:           10,
    replacement_claim:    14,
    ai_ultimate_solution: 12,
    ai_scare:             10,
    unfounded_certainty:  11,
    unbased_metrics:       9,
    vague_hype:            7,
    false_urgency:         8,
    engagement_bait:      11,
    guru_framing:          8,
    credential_flex:       6,
    hustle_culture:        6,
    viral_hook:            6,
    llm_slop_structure:    5,
    course_sales:         12,
    lead_magnet_comment:  13,
    fake_research_claim:  11,
    reality_gap:          10,
};

const POSITIVE_WEIGHTS = {
    grounded_evidence:      11,
    specific_example:        8,
    nuance_and_limits:      12,
    ai_as_tool:             13,
    practical_guidance:      8,
    proportional_claims:     7,
    intellectual_honesty:   10,
    cites_limitations:      10,
    calm_tone:               5,
    no_engagement_bait:      5,
    human_capability_gain:  13,
    step_by_step_execution: 11,
    verified_research:      12,
    news_or_primary_source: 10,
    market_grounded:        11,
};

const DISQUALIFIER_KINDS_SEV2 = new Set([
    'replacement_claim',
    'ai_ultimate_solution',
    'engagement_bait',
    'unbased_metrics',
    'unfounded_certainty',
    'ai_scare',
    'course_sales',
    'lead_magnet_comment',
    'fake_research_claim',
]);

const FARMING_BLOCK_KINDS = ['lead_magnet_comment', 'course_sales', 'fake_research_claim'];

const BENEFIT_TOOL_KINDS = ['ai_as_tool', 'human_capability_gain'];
const BENEFIT_EXEC_KINDS = [
    'step_by_step_execution',
    'verified_research',
    'news_or_primary_source',
    'practical_guidance',
    'specific_example',
];
const BENEFIT_LIMITS_KINDS = ['nuance_and_limits', 'market_grounded', 'cites_limitations'];

const VALID_NARRATIVE_TIERS = new Set([
    '0-10', '11-25', '26-40', '41-55', '56-100',
]);

const METER_STATES = {
    '0-10': {
        tier: '0-10',
        id: 'mostly_grounded',
        label: 'Mostly grounded',
        summary: 'Little hype — rare bro tells at most.',
    },
    '11-25': {
        tier: '11-25',
        id: 'low_bro_energy',
        label: 'Low bro energy',
        summary: 'Light rhetoric — substance still leads.',
    },
    '26-40': {
        tier: '26-40',
        id: 'mild_hype',
        label: 'Mild hype detected',
        summary: 'Some thought-leader seasoning.',
    },
    '41-55': {
        tier: '41-55',
        id: 'building_hype',
        label: 'Hype building',
        summary: 'Several farming patterns showing up.',
    },
    '56-100': {
        tier: '56-100',
        id: 'peak_bro',
        label: 'Peak bro energy',
        summary: 'Hype, fear, or engagement farming.',
    },
};

const REGRESSION_FIXTURES = [
    {
        id: 'test1_classic_bro',
        input: 'Design is dead. AI produces better UI than any designer in seconds. Stop learning Figma, start learning prompts. Adapt or get left behind. Like if you agree 👇',
        expected: { result_kind: 'bro', scoreMin: 56, scoreMax: 95, broKinds: ['replacement_claim', 'engagement_bait'] },
        expected_narrative_flags: { human_factor_removed: true, ai_as_replacer: true },
    },
    {
        id: 'test2_revenue_guru',
        input: 'I made $4M last year after I stopped coding and started orchestrating AI. The only devs who survive will pivot to this. DM me my playbook.',
        expected: { result_kind: 'bro', scoreMin: 70, scoreMax: 95 },
    },
    {
        id: 'test3_fomo',
        input: 'In 18 months this will be too late. The window is closing. AI is not a tool. It is the operating system of the future. Most people will ignore this. Will you?',
        expected: { result_kind: 'bro', scoreMin: 56, scoreMax: 90 },
    },
    {
        id: 'test4_nuanced',
        input: 'Been using AI coding tools for 6 months. Mixed results honestly. Fast for boilerplate, unreliable on our legacy billing logic. Junior devs learn faster with it. Senior devs are more selective. It\'s a tool, same as every tool before it.',
        expected: { result_kind: 'bro', scoreMin: 0, scoreMax: 15 },
        expected_narrative_flags: { human_factor_removed: false, ai_as_replacer: false },
    },
    {
        id: 'test5_llm_slop',
        input: '❌ Old way: spend hours designing screens\n✅ New way: prompt AI in seconds\n\n5 tools that 10x your design output:\n1. Midjourney\n2. Framer AI\n3. ChatGPT\n4. Galileo\n5. Uizard\n\nSave this post. Your future self will thank you.',
        expected: { result_kind: 'bro', scoreMin: 45, scoreMax: 75 },
    },
    {
        id: 'test6_calm_expert',
        input: 'State of AI in Design 2025 surveyed 400+ designers. AI is strongest in early ideation — gets work to about 60% done. The last 40% still needs human judgment: context, user trust, cultural nuance. It speeds me up. It doesn\'t replace my decisions.',
        expected: { result_kind: 'bro', scoreMin: 0, scoreMax: 12 },
    },
    {
        id: 'test7_mild_hype',
        input: 'AI is changing design faster than most people realise. I\'m seeing it in my team — some workflows that took days now take hours. Not sure where this leads for junior roles, but I\'d encourage everyone to experiment with these tools rather than ignore them.',
        expected: { result_kind: 'bro', scoreMin: 11, scoreMax: 40 },
    },
    {
        id: 'test8_short_ocr',
        input: 'AI bro',
        imageOnly: true,
        expected: { result_kind: 'bro', scoreMin: 25, scoreMax: 100 },
    },
    {
        id: 'test9_lead_magnet',
        input: 'AI will 10x your output overnight. Comment PLAYBOOK and I will send you the full course plus templates.',
        expected: { result_kind: 'bro', scoreMin: 60, scoreMax: 100, broKinds: ['lead_magnet_comment'] },
    },
    {
        id: 'test10_fake_research',
        input: 'Research shows AI replaces most knowledge work. Studies prove you are already behind. Comment YES for my free guide.',
        expected: { result_kind: 'bro', scoreMin: 56, scoreMax: 100 },
    },
    {
        id: 'test11_benefit_howto',
        input: 'How I use Copilot on legacy Rails: 1) Paste the ticket and file paths. 2) Ask for boilerplate only. 3) I review billing logic manually — it still hallucinates there. API cost is ~$20/dev/month; worth it for tests, not architecture.',
        expected: { result_kind: 'bro', scoreMin: 0, scoreMax: 15 },
    },
];

const CRITICAL_RULES = `
CRITICAL RULES:

1. TEXT TRANSCRIPT IS GROUND TRUTH. Read the entire post before scoring.

2. HIGH METER (bro 56–100): AI hype without limits, fearmongering (ai_scare), selling courses/cohorts (course_sales), "Comment KEYWORD and I'll send…" (lead_magnet_comment), vague "research shows" without a named source (fake_research_claim), claims that ignore adoption/cost/reality for the domain (reality_gap). Replacement/dehumanizing claims still fire replacement_claim at severity 3.

3. LOW METER (0–10): Grounded, tool-framed, limits-aware posts with little bro rhetoric. Use positive_signals for what checks out; still score 0–100 (never negative).

4. MARKET CHECK (prompt-only): In market_context_note, one sentence on whether claims fit plausible ~2025–2026 adoption/cost/practice for the domain stated. Do not invent statistics; flag reality_gap when claims sound ahead of typical adoption.

5. ENGAGEMENT BAIT: likes/shares/reposts AND comment-for-resource funnels are lead_magnet_comment or engagement_bait.

6. SNIPPETS: verbatim only.

7. REPLACER THEME: human_factor_removed / ai_as_replacer → score floor ≥56.
`;

const LEAD_MAGNET_RE = /comment\s+[A-Z0-9]{2,24}\s+(?:and\s+)?(?:i'?ll|i will)\s+send/i;
const COURSE_SALES_RE = /(?:enroll|join my course|link in bio|dm me for|buy my).{0,50}(?:playbook|course|cohort|masterclass)/i;
const DM_PLAYBOOK_RE = /\bDM me\b.{0,30}\b(?:playbook|course|guide)\b/i;

function normalizeKind(kind) {
    return String(kind || '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '_')
        .replace(/-+/g, '_');
}

function clampSeverity(n) {
    const s = Number(n);
    if (!Number.isFinite(s)) return 2;
    return Math.max(1, Math.min(3, Math.round(s)));
}

function clampScore(n, min = 0, max = 100) {
    const s = Number(n);
    if (!Number.isFinite(s)) return min;
    return Math.max(min, Math.min(max, Math.round(s)));
}

function weightedSum(signals, weightMap) {
    if (!Array.isArray(signals)) return 0;
    let sum = 0;
    for (const raw of signals) {
        const kind = normalizeKind(raw.kind);
        const base = weightMap[kind] ?? 5;
        sum += base * clampSeverity(raw.severity);
    }
    return sum;
}

function maxSevForKind(signals, kind) {
    const k = normalizeKind(kind);
    let max = 0;
    for (const s of signals) {
        if (normalizeKind(s.kind) === k) {
            max = Math.max(max, clampSeverity(s.severity));
        }
    }
    return max;
}

function hasMinSeverity(signals, kinds, minSev) {
    return kinds.some((k) => maxSevForKind(signals, k) >= minSev);
}

function sanitizeSignals(arr, max = 10) {
    if (!Array.isArray(arr)) return [];
    return arr
        .filter((s) => s && typeof s === 'object' && s.snippet)
        .slice(0, max)
        .map((s) => ({
            kind:     normalizeKind(s.kind) || 'unknown',
            severity: clampSeverity(s.severity),
            snippet:  String(s.snippet).slice(0, 400),
        }));
}

function sanitizeNarrativeFlags(raw) {
    const f = raw && typeof raw === 'object' ? raw : {};
    return {
        human_factor_removed: Boolean(f.human_factor_removed),
        ai_as_replacer:       Boolean(f.ai_as_replacer),
        farming_intent:       Boolean(f.farming_intent),
        genuine_benefit:      Boolean(f.genuine_benefit),
    };
}

function upsertBroSignal(broSignals, kind, severity, snippet) {
    const k = normalizeKind(kind);
    const sev = clampSeverity(severity);
    const snip = String(snippet || '').slice(0, 400);
    const idx = broSignals.findIndex((s) => normalizeKind(s.kind) === k);
    if (idx >= 0) {
        if (broSignals[idx].severity < sev) {
            broSignals[idx].severity = sev;
            broSignals[idx].snippet = snip || broSignals[idx].snippet;
        }
        return broSignals;
    }
    broSignals.push({ kind: k, severity: sev, snippet: snip || k });
    return broSignals;
}

function boostBroSignalsFromText(broSignals, rawText) {
    const text = String(rawText || '');
    if (!text.trim()) return broSignals;

    let out = [...broSignals];
    const lm = text.match(LEAD_MAGNET_RE);
    if (lm) out = upsertBroSignal(out, 'lead_magnet_comment', 3, lm[0]);

    const cs = text.match(COURSE_SALES_RE) || text.match(DM_PLAYBOOK_RE);
    if (cs) out = upsertBroSignal(out, 'course_sales', 2, cs[0]);

    if (/\bresearch shows\b/i.test(text) && !/\b(n=|survey|study|report|arxiv|doi|https?:\/\/)/i.test(text)) {
        const m = text.match(/research shows[^.!?]{0,80}/i);
        out = upsertBroSignal(out, 'fake_research_claim', 2, m ? m[0] : 'research shows');
    }

    return sanitizeSignals(out, 10);
}

function hasDisqualifier(broSignals) {
    for (const s of broSignals) {
        const kind = normalizeKind(s.kind);
        const sev = clampSeverity(s.severity);
        if (sev >= 3) return true;
        if (DISQUALIFIER_KINDS_SEV2.has(kind) && sev >= 2) return true;
    }
    return false;
}

function hasFarmingBlock(broSignals) {
    return FARMING_BLOCK_KINDS.some((k) => maxSevForKind(broSignals, k) >= 2);
}

function passesBenefitGate(broSignals, positiveSignals, narrativeFlags, narrativeResultKind) {
    if (hasDisqualifier(broSignals) || hasFarmingBlock(broSignals)) return false;
    if (narrativeFlags?.farming_intent) return false;
    if (hasReplacerTheme(broSignals, narrativeFlags)) return false;

    const broSum = weightedSum(broSignals, BRO_WEIGHTS);
    if (broSum > 8) return false;

    const posKinds = new Set(positiveSignals.map((s) => normalizeKind(s.kind)));
    if (posKinds.size < 3) return false;

    if (!hasMinSeverity(positiveSignals, BENEFIT_TOOL_KINDS, 2)) return false;
    if (!hasMinSeverity(positiveSignals, BENEFIT_EXEC_KINDS, 2)) return false;
    if (!hasMinSeverity(positiveSignals, BENEFIT_LIMITS_KINDS, 1)) return false;

    const narrativeOk = narrativeResultKind === 'genuine_expert' || narrativeFlags?.genuine_benefit;
    return narrativeOk;
}

/** @deprecated use passesBenefitGate */
function passesGenuineGate(broSignals, positiveSignals) {
    return passesBenefitGate(
        broSignals,
        positiveSignals,
        { genuine_benefit: true, farming_intent: false },
        'genuine_expert'
    );
}

function shouldApplyVisionGate(inputMeta) {
    const { hasImage, imageOnly, transcriptLength } = inputMeta;
    return Boolean(hasImage && (imageOnly || (transcriptLength || 0) < 80));
}

function meterTierFromScore(bsScore) {
    const score = Math.max(0, Number(bsScore) || 0);
    if (score <= 10) return '0-10';
    if (bsScore <= 25) return '11-25';
    if (bsScore <= 40) return '26-40';
    if (bsScore <= 55) return '41-55';
    return '56-100';
}

function meterStateFromTier(tier) {
    return METER_STATES[tier] || METER_STATES['41-55'];
}

function computeBroScore(broSignals, positiveSignals) {
    const broSum = weightedSum(broSignals, BRO_WEIGHTS);
    const posSum = weightedSum(positiveSignals, POSITIVE_WEIGHTS);
    const raw = 50 + broSum * 0.60 - posSum * 0.55;
    return clampScore(raw, 0, 100);
}

function clampNarrativeScore(n) {
    const s = Number(n);
    if (!Number.isFinite(s)) return null;
    return clampScore(s, 0, 100);
}

function normalizeNarrativeTier(tier, score) {
    const t = String(tier || '').trim();
    if (t === 'genuine') return '0-10';
    if (VALID_NARRATIVE_TIERS.has(t)) return t;
    return meterTierFromScore(score ?? 0);
}

function bsReadingForBroScore(score) {
    if (score >= 56) return 'positive';
    if (score < 26) return 'negative';
    return 'mixed';
}

function hasReplacerTheme(broSignals, flags) {
    if (flags?.human_factor_removed || flags?.ai_as_replacer) return true;
    return (
        maxSevForKind(broSignals, 'replacement_claim') >= 2
        || maxSevForKind(broSignals, 'ai_ultimate_solution') >= 2
    );
}

function isDominantReplacer(broSignals, flags) {
    if (flags?.human_factor_removed && flags?.ai_as_replacer) return true;
    return (
        maxSevForKind(broSignals, 'replacement_claim') >= 3
        || maxSevForKind(broSignals, 'ai_ultimate_solution') >= 3
    );
}

const REPLACER_MENTION_RE = /replac|obsolete|dead|finished|human|people|role|judgment|judgement|tool|assist|saviour|savior|out of the loop/i;

function ensureReplacerMention(verdict, flags) {
    let v = String(verdict || '').trim();
    if (!v) v = 'Frames AI as replacing people rather than assisting them.';
    else if (!REPLACER_MENTION_RE.test(v)) {
        v += ' — frames AI as replacing people rather than assisting them.';
    }
    if (flags?.human_factor_removed && !/human|people|role|judgment|judgement|obsolete/i.test(v)) {
        v += ' Writes humans out of the narrative.';
    }
    return v.slice(0, 500);
}

function ensureReplacerSummary(summary, flags) {
    let s = String(summary || '').trim();
    if (!s) {
        return flags?.human_factor_removed
            ? 'The post argues that human roles or judgment are no longer needed.'
            : 'The post presents AI as a full replacer rather than an assistant.';
    }
    if (!REPLACER_MENTION_RE.test(s)) {
        s += ' It treats AI as replacing human work rather than augmenting it.';
    }
    return s.slice(0, 800);
}

function reconcileWithNarrative(signalScore, narrative) {
    const nScore = clampNarrativeScore(narrative.narrative_score);
    const effectiveN = nScore == null ? signalScore : nScore;
    const nTier = normalizeNarrativeTier(narrative.narrative_tier, effectiveN);
    const sTier = meterTierFromScore(signalScore);
    const tierMismatch = nTier !== sTier;
    const scoreDelta = Math.abs(effectiveN - signalScore);

    if (tierMismatch || scoreDelta > 12) {
        const adjusted = Math.round(0.35 * signalScore + 0.65 * effectiveN);
        return {
            bs_score:       clampScore(adjusted, 0, 100),
            reconciled:     true,
            narrative_tier: nTier,
        };
    }
    return { bs_score: signalScore, reconciled: false, narrative_tier: nTier };
}

function applyReplacerThemeRules(ctx) {
    const { broSignals, narrative_flags } = ctx;
    if (!hasReplacerTheme(broSignals, narrative_flags)) return ctx;

    const floor = isDominantReplacer(broSignals, narrative_flags) ? 70 : 56;
    ctx.result_kind = 'bro';
    ctx.bs_score = Math.max(ctx.bs_score, floor);
    if (ctx.narrative_score != null && ctx.narrative_score >= 0) {
        ctx.narrative_score = Math.max(ctx.narrative_score, floor);
    }
    ctx.narrative_flags = {
        ...narrative_flags,
        human_factor_removed: narrative_flags.human_factor_removed
            || maxSevForKind(broSignals, 'replacement_claim') >= 2,
        ai_as_replacer: narrative_flags.ai_as_replacer
            || maxSevForKind(broSignals, 'ai_ultimate_solution') >= 2,
        farming_intent: true,
        genuine_benefit: false,
    };
    ctx.narrative_verdict = ensureReplacerMention(ctx.narrative_verdict, ctx.narrative_flags);
    ctx.post_summary = ensureReplacerSummary(ctx.post_summary, ctx.narrative_flags);
    ctx.replacer_floor = floor;
    return ctx;
}

function applyFarmingThemeRules(ctx) {
    const { broSignals } = ctx;
    let floor = null;

    if (maxSevForKind(broSignals, 'lead_magnet_comment') >= 2) {
        floor = Math.max(floor ?? 0, 60);
    }
    if (maxSevForKind(broSignals, 'course_sales') >= 2) {
        floor = Math.max(floor ?? 0, 55);
    }
    if (maxSevForKind(broSignals, 'ai_scare') >= 3 && maxSevForKind(broSignals, 'false_urgency') >= 2) {
        floor = Math.max(floor ?? 0, 56);
    }
    if (maxSevForKind(broSignals, 'reality_gap') >= 3) {
        floor = Math.max(floor ?? 0, 50);
    }

    if (floor == null) return ctx;

    ctx.result_kind = 'bro';
    ctx.bs_score = Math.max(ctx.bs_score, floor);
    if (ctx.narrative_score != null && ctx.narrative_score >= 0) {
        ctx.narrative_score = Math.max(ctx.narrative_score, floor);
    }
    ctx.narrative_flags = {
        ...ctx.narrative_flags,
        farming_intent: true,
        genuine_benefit: false,
    };
    ctx.farming_floor = floor;
    return ctx;
}

function buildSystemPrompt() {
    const broKinds = Object.keys(BRO_WEIGHTS).join(' | ');
    const posKinds = Object.keys(POSITIVE_WEIGHTS).join(' | ');

    return `You classify AI social posts on an AI bro energy meter (0–100). Higher = more hype, farming, fearmongering. Lower = more grounded.

Farming / high meter (56–100): hype, fearmongering, course sales, "Comment KEYWORD I'll send…", fake "research", claims ignoring adoption/cost for the domain (~2025–2026).
Low meter (0–10): tool framing, steps, named studies/news, limits — use positive_signals; score stays 0–100.

WORKFLOW: Read ENTIRE transcript → post_summary → market_context_note → narrative fields → signals → scores.

Return ONLY valid JSON:
{
  "post_summary": "2–4 neutral sentences",
  "market_context_note": "1 sentence: domain + whether claims match plausible adoption/cost (judgment, not verified fact)",
  "narrative_verdict": "One sentence holistic outcome",
  "narrative_score": number,
  "narrative_tier": "0-10" | "11-25" | "26-40" | "41-55" | "56-100",
  "narrative_flags": {
    "human_factor_removed": boolean,
    "ai_as_replacer": boolean,
    "farming_intent": boolean,
    "genuine_benefit": boolean
  },
  "bs_score": number,
  "bro_signals": [{ "kind": string, "severity": 1|2|3, "snippet": string }],
  "positive_signals": [{ "kind": string, "severity": 1|2|3, "snippet": string }],
  "reasons": ["3–6 sentences explaining the score. Always cover BOTH what the post does well (grounded language, limits, evidence, tool framing) AND what raises the score (hype, farming, absolutism, fearmongering). If score is 0–10, lead with strengths. Each sentence is standalone — no bullet prefixes."],
  "input_summary": string
}

BRO kinds: ${broKinds}
POSITIVE kinds: ${posKinds}

bs_score 0–100 only. Lead magnets, course sales, replacer themes → 56+.

Quote verbatim snippets. Legacy "signals" = bro only.
${CRITICAL_RULES}`;
}

function normalizeAnalysis(result, inputMeta = {}) {
    let broSignals = sanitizeSignals(result.bro_signals, 10);
    let positiveSignals = sanitizeSignals(result.positive_signals, 10);

    if (!broSignals.length && Array.isArray(result.signals)) {
        broSignals = sanitizeSignals(result.signals, 10);
    }

    const rawText = (inputMeta.rawText || '').trim();
    broSignals = boostBroSignalsFromText(broSignals, rawText);

    const visionGate = shouldApplyVisionGate(inputMeta);
    let narrative_flags = sanitizeNarrativeFlags(result.narrative_flags);

    if (narrative_flags.human_factor_removed || narrative_flags.ai_as_replacer) {
        narrative_flags = {
            ...narrative_flags,
            human_factor_removed: true,
            ai_as_replacer:       true,
            genuine_benefit:      false,
        };
    }

    let post_summary = typeof result.post_summary === 'string' ? result.post_summary.trim() : '';
    let narrative_verdict = typeof result.narrative_verdict === 'string' ? result.narrative_verdict.trim() : '';
    let narrative_score = clampNarrativeScore(result.narrative_score);
    const modelWantedGenuine = result.narrative_result_kind === 'genuine_expert'
        || result.result_kind === 'genuine_expert'
        || Number(result.bs_score) < 0;
    const market_context_note = typeof result.market_context_note === 'string'
        ? result.market_context_note.trim().slice(0, 400)
        : '';

    if (visionGate && !broSignals.length) {
        const snippet = rawText.slice(0, 120) || '(Insufficient text for full analysis)';
        broSignals = [{ kind: 'vague_hype', severity: 2, snippet }];
    }

    const modelScore = Number(result.bs_score);
    const computed = computeBroScore(broSignals, positiveSignals);
    const modelClamped = Number.isFinite(modelScore) && modelScore >= 0
        ? clampScore(modelScore, 0, 100)
        : computed;
    let signalScore = Math.round(0.30 * modelClamped + 0.70 * computed);
    signalScore = clampScore(signalScore, 0, 100);

    let narrative_mismatch = modelWantedGenuine
        || (narrative_flags.genuine_benefit && signalScore > 25);

    const reconciled = reconcileWithNarrative(signalScore, {
        narrative_score,
        narrative_tier: result.narrative_tier,
    });
    let bs_score = reconciled.bs_score;
    let score_reconciled_out = reconciled.reconciled;

    let ctx = {
        result_kind: 'bro',
        bs_score,
        broSignals,
        positiveSignals,
        narrative_flags,
        narrative_verdict,
        post_summary,
        narrative_score: narrative_score == null ? bs_score : narrative_score,
        replacer_floor:  null,
        farming_floor:   null,
    };
    ctx = applyReplacerThemeRules(ctx);
    ctx = applyFarmingThemeRules(ctx);
    bs_score = ctx.bs_score;
    narrative_flags = ctx.narrative_flags;
    narrative_verdict = ctx.narrative_verdict;
    post_summary = ctx.post_summary;
    narrative_score = ctx.narrative_score;

    if (visionGate) {
        bs_score = Math.max(25, bs_score);
        if (narrative_score != null) {
            narrative_score = Math.max(25, narrative_score);
        }
    }

    if (ctx.replacer_floor != null) bs_score = Math.max(bs_score, ctx.replacer_floor);
    if (ctx.farming_floor != null) bs_score = Math.max(bs_score, ctx.farming_floor);

    if (bs_score > 0 && !broSignals.length) {
        const snippet = rawText.slice(0, 160) || '(Elevated rhetoric detected)';
        broSignals = [{ kind: 'vague_hype', severity: 1, snippet }];
    }

    const meter_tier = meterTierFromScore(bs_score);
    const nTier = normalizeNarrativeTier(result.narrative_tier, narrative_score ?? bs_score);
    if (meter_tier !== nTier && !score_reconciled_out) score_reconciled_out = true;

    const showPositivesOnBro = bs_score <= 25 && positiveSignals.length > 0;

    if (!post_summary && typeof result.input_summary === 'string') {
        post_summary = result.input_summary.trim();
    }

    return {
        bs_score,
        meter_tier,
        bro_signals:          broSignals,
        positive_signals:     positiveSignals,
        signals:              broSignals,
        show_positive_on_bro: showPositivesOnBro,
        reasons:              Array.isArray(result.reasons) ? result.reasons.slice(0, 5) : [],
        input_summary:        typeof result.input_summary === 'string' ? result.input_summary : '',
        post_summary,
        market_context_note,
        narrative_verdict,
        narrative_score:      narrative_score ?? bs_score,
        narrative_tier:       normalizeNarrativeTier(result.narrative_tier, narrative_score ?? bs_score),
        narrative_flags,
        narrative_mismatch,
        score_reconciled:     score_reconciled_out,
        vision_gate_applied:  visionGate,
    };
}

module.exports = {
    BRO_WEIGHTS,
    POSITIVE_WEIGHTS,
    METER_STATES,
    REGRESSION_FIXTURES,
    buildSystemPrompt,
    normalizeAnalysis,
    meterTierFromScore,
    meterStateFromTier,
    normalizeKind,
    passesGenuineGate,
    passesBenefitGate,
    computeBroScore,
    shouldApplyVisionGate,
    hasReplacerTheme,
    boostBroSignalsFromText,
};
