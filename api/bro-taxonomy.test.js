'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
    normalizeAnalysis,
    meterTierFromScore,
    passesBenefitGate,
    computeBroScore,
    shouldApplyVisionGate,
    hasReplacerTheme,
    boostBroSignalsFromText,
} = require('./bro-taxonomy');

describe('meterTierFromScore', () => {
    it('maps tier boundaries', () => {
        assert.equal(meterTierFromScore(5), '0-10');
        assert.equal(meterTierFromScore(11), '11-25');
        assert.equal(meterTierFromScore(56), '56-100');
    });
});

describe('vision gate', () => {
    it('floors score for image-only', () => {
        const out = normalizeAnalysis(
            {
                bs_score:              5,
                narrative_flags:       { genuine_benefit: true },
                positive_signals:      [
                    { kind: 'ai_as_tool', severity: 2, snippet: 'tool' },
                    { kind: 'nuance_and_limits', severity: 2, snippet: 'nuance' },
                    { kind: 'step_by_step_execution', severity: 2, snippet: '1) step' },
                    { kind: 'market_grounded', severity: 1, snippet: 'cost' },
                ],
            },
            { hasImage: true, imageOnly: true, transcriptLength: 0, rawText: '' }
        );
        assert.ok(out.bs_score >= 25);
        assert.equal(out.vision_gate_applied, true);
    });
});

describe('lead magnet boost', () => {
    it('injects lead_magnet_comment from raw text and floors score', () => {
        const text = 'Comment PLAYBOOK and I will send you the full course.';
        const bro = boostBroSignalsFromText([], text);
        assert.ok(bro.some((s) => s.kind === 'lead_magnet_comment'));

        const out = normalizeAnalysis(
            {
                bs_score:        20,
                narrative_score: 30,
            },
            { rawText: text }
        );
        assert.ok(out.bs_score >= 60);
        assert.equal(out.narrative_flags.farming_intent, true);
    });
});

describe('replacer theme', () => {
    it('floors score when replacement_claim is strong', () => {
        const out = normalizeAnalysis({
            bs_score:        30,
            narrative_flags: { human_factor_removed: true, ai_as_replacer: true },
            bro_signals: [
                { kind: 'replacement_claim', severity: 3, snippet: 'Design is dead.' },
            ],
        });
        assert.ok(out.bs_score >= 56);
    });
});

describe('benefit gate', () => {
    it('passes for tool + steps + limits mix', () => {
        const pos = [
            { kind: 'ai_as_tool', severity: 2, snippet: 'tool' },
            { kind: 'nuance_and_limits', severity: 2, snippet: 'limits' },
            { kind: 'step_by_step_execution', severity: 2, snippet: '1) step' },
            { kind: 'market_grounded', severity: 1, snippet: 'cost' },
        ];
        assert.ok(passesBenefitGate([], pos, { genuine_benefit: true, farming_intent: false }, 'genuine_expert'));
    });

    it('fails on lead magnet', () => {
        const bro = [{ kind: 'lead_magnet_comment', severity: 2, snippet: 'Comment PLAYBOOK' }];
        const pos = [
            { kind: 'ai_as_tool', severity: 2, snippet: 'tool' },
            { kind: 'step_by_step_execution', severity: 2, snippet: 'steps' },
            { kind: 'nuance_and_limits', severity: 2, snippet: 'limits' },
        ];
        assert.equal(passesBenefitGate(bro, pos, { genuine_benefit: true }, 'genuine_expert'), false);
    });

    it('scores low for practitioner-style mock', () => {
        const out = normalizeAnalysis({
            narrative_flags: { genuine_benefit: true, farming_intent: false },
            positive_signals: [
                { kind: 'ai_as_tool', severity: 2, snippet: "It's a tool, same as every tool before it." },
                { kind: 'nuance_and_limits', severity: 2, snippet: 'Mixed results honestly.' },
                { kind: 'specific_example', severity: 2, snippet: 'legacy billing logic' },
                { kind: 'intellectual_honesty', severity: 1, snippet: 'honestly' },
            ],
        });
        assert.ok(out.bs_score >= 0 && out.bs_score <= 25);
        assert.equal(out.meter_tier, '0-10');
    });
});

describe('computeBroScore', () => {
    it('scores classic bro signals high', () => {
        const bro = [
            { kind: 'replacement_claim', severity: 3, snippet: 'Design is dead' },
            { kind: 'engagement_bait', severity: 2, snippet: 'Like' },
        ];
        assert.ok(computeBroScore(bro, []) >= 70);
    });
});

describe('shouldApplyVisionGate', () => {
    it('true for image-only or short transcript with image', () => {
        assert.equal(shouldApplyVisionGate({ hasImage: true, imageOnly: true, transcriptLength: 0 }), true);
        assert.equal(shouldApplyVisionGate({ hasImage: true, imageOnly: false, transcriptLength: 100 }), false);
    });
});

describe('hasReplacerTheme', () => {
    it('detects from signals and flags', () => {
        assert.ok(hasReplacerTheme([{ kind: 'ai_ultimate_solution', severity: 2, snippet: 'x' }], {}));
    });
});
