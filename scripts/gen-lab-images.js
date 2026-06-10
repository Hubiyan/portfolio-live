#!/usr/bin/env node
/**
 * Scans images/lab-images/ and writes a manifest.json used by the Lab page
 * to auto-populate desktop icons. Run manually or via the GitHub Action.
 *
 * Supported types: jpg, jpeg, png, gif, webp (image), webm (video)
 */
'use strict';

const fs   = require('fs');
const path = require('path');

const DIR      = path.join(__dirname, '..', 'images', 'lab-images');
const OUT      = path.join(DIR, 'manifest.json');
const IMG_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp']);
const VID_EXTS = new Set(['webm']);

const entries = fs.readdirSync(DIR)
    .filter(f => {
        /* Skip dotfiles, the manifest itself, and filenames with backslashes */
        if (f.startsWith('.') || f === 'manifest.json' || f.includes('\\')) return false;
        const ext = path.extname(f).slice(1).toLowerCase();
        return IMG_EXTS.has(ext) || VID_EXTS.has(ext);
    })
    .sort()
    .map(f => {
        const ext  = path.extname(f).slice(1).toLowerCase();
        const base = path.basename(f, path.extname(f));
        const name = base; /* Keep the actual filename as-is — no reformatting */
        return {
            file: f,
            name,
            ext,
            type: VID_EXTS.has(ext) ? 'video' : 'image',
        };
    });

fs.writeFileSync(OUT, JSON.stringify(entries, null, 2) + '\n');
console.log(`✔  manifest.json — ${entries.length} file(s) written.`);
