/**
 * Comment Bro — system prompt + normaliser for /api/comment.
 *
 * Same input philosophy as the AI Bro Detector (paste a social post / thread /
 * screenshot OCR), but instead of scoring it we generate ready-to-post comments
 * that lampoon the cliché commenting habits of each platform.
 *
 * The model returns, for each platform, an array of comments at 5 "honesty"
 * levels so the front-end slider can swap between them in real time without
 * another API round-trip:
 *   level 0 (lowest)  → maximum cliché, the generic engagement-bait comment
 *                        everyone leaves. Funny because it's painfully on-the-nose.
 *   level 4 (highest) → still funny, but now gently roasting the post itself.
 *
 * Never rude, slurring, or genuinely offensive — witty, not cruel.
 */

const PLATFORMS = ['linkedin', 'x', 'instagram'];
const HONESTY_LEVELS = 5;

const PLATFORM_VOICE = {
    linkedin:
        'LinkedIn voice: corporate-inspirational, line breaks for "engagement", ' +
        'humble-brag adjacent, words like "resonates", "thoughts?", "well said", ' +
        '"this 👏 is 👏 gold", "agree 100%", "saving this", "thanks for sharing". ' +
        'Lampoon thought-leader comment culture.',
    x:
        'X / Twitter voice: short, lowercase, terse, reply-guy energy. ' +
        'Think "this.", "based", "ratio incoming", "hard agree", "ok but the real story is", ' +
        'quote-tweet snark. No hashtags spam. Punchy one-liners.',
    instagram:
        'Instagram voice: emoji-heavy, breathless, "obsessed", "🔥🔥🔥", "need this", ' +
        '"the way I gasped", "not me saving this", "drop the link 😍", "iconic". ' +
        'Lampoon hype-comment culture.',
};

function buildSystemPrompt() {
    return `You are "Comment Bro", a witty comment generator. A user pastes a real social media post (or the OCR text of a screenshot of one). Your job is to write comments they could post underneath it.

THE JOKE: every platform has painfully predictable comment culture — the same cliché, low-effort, engagement-farming replies you see under every post. You write comments that lean INTO those clichés on purpose, so they read as funny and self-aware. Always funny and witty. Never rude, never offensive, no slurs, no profanity beyond mild, no attacks on protected groups or on a person's identity/appearance. Roast the GENRE and the POST, never the human.

FIRST decide if the pasted text is actually a social media post / caption / thread / comment-worthy piece of content. If it is clearly NOT (random file paths, code, a search query, a to-do list, gibberish, a prompt to you, lorem ipsum, an empty/meaningless fragment), return:
{ "is_relevant": false, "error": "Does not seem like a post worth commenting on. Paste a real social media post.", "post_summary": "", "comments": null }

If it IS a valid post, return ONLY this JSON (no markdown, no prose):
{
  "is_relevant": true,
  "error": null,
  "post_summary": "<one neutral sentence recapping what the post is about>",
  "comments": {
    "linkedin":  ["<level0>", "<level1>", "<level2>", "<level3>", "<level4>"],
    "x":         ["<level0>", "<level1>", "<level2>", "<level3>", "<level4>"],
    "instagram": ["<level0>", "<level1>", "<level2>", "<level3>", "<level4>"]
  }
}

Each platform array MUST have exactly 5 comments, one per HONESTY LEVEL:
- Level 0 (LOWEST honesty) — MAXIMUM cliché. The generic, agreeable, engagement-bait comment everyone leaves. No real opinion. Pure platform autopilot. Funny because it's so on-the-nose.
- Level 1 — mostly cliché, a tiny wink that you know it's a cliché.
- Level 2 — half praise, half playful observation about the post.
- Level 3 — clearly teasing the post's clichés while still sounding like a comment.
- Level 4 (HIGHEST honesty) — still funny and postable, but now openly (lightly) roasting the post itself: pointing out the hype, the humble-brag, the obvious template, the thing everyone's too polite to say. Cheeky, not cruel.

Across all 5 levels the comment gets progressively more honest about how mid the post is, while staying witty and never mean-spirited.

VOICE PER PLATFORM — match each platform's real comment culture:
- ${PLATFORM_VOICE.linkedin}
- ${PLATFORM_VOICE.x}
- ${PLATFORM_VOICE.instagram}

Keep each comment realistically short (LinkedIn: up to ~2 short lines; X: one punchy line; Instagram: short + emoji). Reference specifics from the post where possible so it doesn't feel generic. Output valid JSON only.`;
}

function asString(v) {
    return typeof v === 'string' ? v.trim() : '';
}

/** Force a platform array to exactly HONESTY_LEVELS clean strings. */
function normalizePlatformArray(arr) {
    const src = Array.isArray(arr) ? arr.map(asString).filter(Boolean) : [];
    const out = [];
    for (let i = 0; i < HONESTY_LEVELS; i++) {
        out.push(src[i] || src[src.length - 1] || '');
    }
    return out;
}

/**
 * Coerce the raw model output into a safe, predictable shape.
 * Returns { error } when the model flagged the input as irrelevant.
 */
function normalizeComments(result) {
    if (!result || typeof result !== 'object') {
        return { error: 'The comment model returned nothing usable. Try again.' };
    }

    if (result.is_relevant === false || (result.error && !result.comments)) {
        return {
            error: asString(result.error) ||
                'Does not seem like a post worth commenting on. Paste a real social media post.',
        };
    }

    const rawComments = result.comments && typeof result.comments === 'object' ? result.comments : {};
    const comments = {};
    let anyContent = false;
    for (const p of PLATFORMS) {
        const normalized = normalizePlatformArray(rawComments[p]);
        comments[p] = normalized;
        if (normalized.some(Boolean)) anyContent = true;
    }

    if (!anyContent) {
        return { error: 'Could not generate comments for this one. Try a different post.' };
    }

    return {
        post_summary: asString(result.post_summary),
        comments,
        honesty_levels: HONESTY_LEVELS,
    };
}

module.exports = {
    PLATFORMS,
    HONESTY_LEVELS,
    buildSystemPrompt,
    normalizeComments,
};
