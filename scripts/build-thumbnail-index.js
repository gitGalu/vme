#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');
const os = require('os');
const { execFileSync } = require('child_process');

// Map of platform_id -> libretro_thumbnails_system folder name.
// Add new entries here when a platform gains `libretro_thumbnails_system` in src/platforms/systems/*.
const PLATFORMS = [
    { platform_id: 'spectrum', system: 'Sinclair - ZX Spectrum' },
    { platform_id: 'atari800', system: 'Atari - 8-bit' },
    { platform_id: 'nes', system: 'Nintendo - Nintendo Entertainment System' },
    {
        platform_id: 'amiga',
        system: 'Commodore - Amiga',
        dat_url: 'https://raw.githubusercontent.com/libretro/libretro-database/master/dat/Commodore%20-%20Amiga.dat'
    },
    { platform_id: 'atari2600', system: 'Atari - 2600' },
    { platform_id: 'cpc', system: 'Amstrad - CPC' },
    { platform_id: 'mame', system: 'MAME' },
    { platform_id: 'atari5200', system: 'Atari - 5200' },
    { platform_id: 'a7800', system: 'Atari - 7800' },
    { platform_id: 'lynx', system: 'Atari - Lynx' },
    { platform_id: 'st', system: 'Atari - ST' },
    { platform_id: 'c264', system: 'Commodore - Plus-4' },
    { platform_id: 'c64', system: 'Commodore - 64' },
    { platform_id: 'vic20', system: 'Commodore - VIC-20' },
    { platform_id: 'coleco', system: 'Coleco - ColecoVision' },
    { platform_id: 'intv', system: 'Mattel - Intellivision' },
    { platform_id: 'gb', system: 'Nintendo - Game Boy' },
    { platform_id: 'gba', system: 'Nintendo - Game Boy Advance' },
    { platform_id: 'gbc', system: 'Nintendo - Game Boy Color' },
    { platform_id: 'sms', system: 'Sega - Master System - Mark III' },
    { platform_id: 'smd', system: 'Sega - Mega Drive - Genesis' },
    { platform_id: 'zx80', system: 'Sinclair - ZX 81' },
    { platform_id: 'dos', system: 'DOS' },
    { platform_id: 'pce', system: 'NEC - PC Engine - TurboGrafx 16' },
    { platform_id: 'snes', system: 'Nintendo - Super Nintendo Entertainment System' },
    { platform_id: 'snk', system: 'SNK - Neo Geo' },
    { platform_id: 'tic-80', system: 'TIC-80' }
];

// Aliases: copy an existing platform's index under a different id.
const ALIASES = [
    { from: 'dos', to: 'xt' }
];

const LAYERS = ['Named_Snaps', 'Named_Titles', 'Named_Boxarts'];
const LAYER_KEY = {
    Named_Snaps: 'snaps',
    Named_Boxarts: 'boxarts',
    Named_Titles: 'titles'
};

// Thumbnail filenames are listed from the libretro-thumbnails GitHub mirror — the
// same source the app fetches images from at runtime (raw.githubusercontent.com,
// see src/platforms/PlatformBase.js). Listing from the mirror (rather than
// thumbnails.libretro.com) guarantees the index only references files that
// actually exist on the runtime host. This matters for systems where the two
// collections diverge (e.g. Commodore - Amiga: ADF on libretro.com vs WHDLoad on
// the mirror; Commodore - 64).
//
// Repo name = system name with spaces -> underscores, with one renamed repo
// (the GitHub API does not follow repo redirects). Keep this in sync with
// THUMBNAIL_REPO_OVERRIDES in src/platforms/PlatformBase.js.
const THUMBNAIL_REPO_OVERRIDES = {
    'Atari - 8-bit': 'Atari_-_8-bit_Family'
};
function thumbnailRepoName(systemName) {
    return THUMBNAIL_REPO_OVERRIDES[systemName] || systemName.replace(/ /g, '_');
}

const OUT_DIR = path.resolve(__dirname, '..', 'src', 'thumbnail-index');
const platformFilter = process.argv
    .slice(2)
    .find(arg => arg.startsWith('--platform='))
    ?.slice('--platform='.length);

function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`${url} -> HTTP ${res.statusCode}`));
                return;
            }
            const chunks = [];
            res.on('data', (c) => chunks.push(c));
            res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        }).on('error', reject);
    });
}

// Fetch the full recursive file tree of a mirror repo via the GitHub API, then
// return the .png filenames under each `Named_*` layer directory.
// One API request per system. Unauthenticated GitHub allows 60 requests/hour,
// which covers all platforms in a single run; set GH_TOKEN to raise the limit.
function fetchTreeFromBranch(repoName, branch) {
    const url = `https://api.github.com/repos/libretro-thumbnails/${encodeURIComponent(repoName)}/git/trees/${branch}?recursive=1`;
    return new Promise((resolve, reject) => {
        const headers = { 'User-Agent': 'vme-thumbnail-index' };
        if (process.env.GH_TOKEN) headers.Authorization = `Bearer ${process.env.GH_TOKEN}`;
        https.get(url, { headers }, (res) => {
            const chunks = [];
            res.on('data', (c) => chunks.push(c));
            res.on('end', () => {
                const body = Buffer.concat(chunks).toString('utf8');
                if (res.statusCode !== 200) {
                    const err = new Error(`${url} -> HTTP ${res.statusCode} ${body.slice(0, 120)}`);
                    err.statusCode = res.statusCode;
                    reject(err);
                    return;
                }
                try {
                    resolve(JSON.parse(body));
                } catch (err) {
                    reject(err);
                }
            });
        }).on('error', reject);
    });
}

// Most mirror repos use the `master` branch; a few renamed ones use `main`
// (e.g. Atari_-_8-bit_Family). Try master first, fall back to main on 404.
async function fetchTree(repoName) {
    try {
        return await fetchTreeFromBranch(repoName, 'master');
    } catch (err) {
        if (err.statusCode === 404) {
            return await fetchTreeFromBranch(repoName, 'main');
        }
        throw err;
    }
}

function layerFilenamesFromTree(tree, layer) {
    const prefix = `${layer}/`;
    const filenames = [];
    for (const entry of tree.tree || []) {
        if (entry.type !== 'blob') continue;
        const p = entry.path;
        if (p.startsWith(prefix) && p.toLowerCase().endsWith('.png')) {
            filenames.push(p.slice(prefix.length));
        }
    }
    return filenames;
}

// Some repos (e.g. Commodore - 64, ~118k files in Named_Snaps) exceed the GitHub
// git-trees API limit and come back truncated. For those, list filenames via a
// blobless, no-checkout shallow clone: this fetches only the tree objects (a few
// MB) — not the images (>1 GB) — then `git ls-tree` yields the complete listing.
function listLayerFilenamesViaClone(repoName) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vme-thumb-'));
    try {
        const repoUrl = `https://github.com/libretro-thumbnails/${repoName}.git`;
        execFileSync('git', ['clone', '--filter=blob:none', '--no-checkout', '--depth=1', repoUrl, tmp],
            { stdio: ['ignore', 'ignore', 'inherit'] });
        const byLayer = {};
        for (const layer of LAYERS) {
            const out = execFileSync('git', ['-C', tmp, 'ls-tree', '-r', '--name-only', 'HEAD', `${layer}/`],
                { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
            const prefix = `${layer}/`;
            byLayer[layer] = out.split('\n')
                .filter((p) => p.startsWith(prefix) && p.toLowerCase().endsWith('.png'))
                .map((p) => p.slice(prefix.length));
        }
        return byLayer;
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
}

// Return { layer: [filenames] } for all layers. Uses the git-trees API (one
// request), falling back to a blobless clone when the tree is truncated.
async function listLayerFilenames(repoName) {
    const tree = await fetchTree(repoName);
    if (tree.truncated) {
        console.log(`    tree truncated by API, falling back to blobless clone...`);
        return { byLayer: listLayerFilenamesViaClone(repoName), entries: 'clone' };
    }
    const byLayer = {};
    for (const layer of LAYERS) byLayer[layer] = layerFilenamesFromTree(tree, layer);
    return { byLayer, entries: (tree.tree || []).length };
}

function cleanRomName(filename) {
    if (!filename) return '';
    let name = String(filename).replace(/\.[^/.]+$/, '');
    const tagPattern = /\s*[\[\(][^\[\]\(\)]*[\]\)]/g;
    let prev;
    do {
        prev = name;
        name = name.replace(tagPattern, '');
    } while (name !== prev);
    return name.replace(/\s{2,}/g, ' ').trim();
}

function normalizeKey(filename) {
    let cleaned = cleanRomName(filename);
    if (!cleaned) return '';
    cleaned = cleaned
        .replace(/\s+v\s*\d+(?:\.\d+)*[a-z]?\b/gi, '')
        .replace(/\s+rev\.?\s*[a-z0-9]+\b/gi, '');
    return cleaned
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

// Roman numeral <-> Arabic digit conversion for standalone numeral words 1..30,
// covering the common sequel forms (II/III/IV...) found in game titles. Only whole
// numeral tokens are touched, so "iv" inside another word is never affected because
// keys are already space-separated by normalizeKey.
const ROMAN_TO_ARABIC = { i:'1', ii:'2', iii:'3', iv:'4', v:'5', vi:'6', vii:'7', viii:'8', ix:'9', x:'10', xi:'11', xii:'12', xiii:'13' };
const ARABIC_TO_ROMAN = { '1':'i', '2':'ii', '3':'iii', '4':'iv', '5':'v', '6':'vi', '7':'vii', '8':'viii', '9':'ix', '10':'x', '11':'xi', '12':'xii', '13':'xiii' };

function numeralVariants(key) {
    const variants = new Set();
    const tokens = key.split(' ');
    // Skip a lone "i"/"v"/"x" so we don't rewrite the pronoun "I" or single letters.
    const hasRoman = tokens.some(t => ROMAN_TO_ARABIC[t] && t.length >= 2);
    const hasArabic = tokens.some(t => ARABIC_TO_ROMAN[t]);
    if (hasRoman) {
        variants.add(tokens.map(t => (t.length >= 2 && ROMAN_TO_ARABIC[t]) ? ROMAN_TO_ARABIC[t] : t).join(' '));
    }
    if (hasArabic) {
        variants.add(tokens.map(t => ARABIC_TO_ROMAN[t] || t).join(' '));
    }
    return [...variants];
}

// Given a thumbnail filename and its primary normalized key, produce extra alias
// keys so collection rom-names written in a different-but-equivalent style still
// match. Handles three real libretro-naming patterns:
//   1. TOSEC trailing article:  "Last Ninja, The" -> also "the last ninja"
//   2. Subtitle:                "Turrican II - The Final Fight" -> also "turrican ii"
//   3. Roman <-> Arabic:        "Barbarian 2" / "Turrican II" -> both numeral forms
function aliasKeysForFilename(filename, primaryKey) {
    const aliases = new Set();
    const cleaned = cleanRomName(filename);
    if (!cleaned) return [];

    // 1. Trailing article: "Title, The" / "Title, A" / "Title, An" -> "The Title".
    const articleMatch = cleaned.match(/^(.*),\s+(the|a|an)$/i);
    if (articleMatch) {
        const moved = `${articleMatch[2]} ${articleMatch[1]}`;
        const k = normalizeKey(moved);
        if (k) aliases.add(k);
    }

    // 2. Subtitle: split on " - " or ": " and key the leading title alone.
    const subtitleSplit = cleaned.split(/\s+[-:]\s+/);
    if (subtitleSplit.length > 1) {
        const k = normalizeKey(subtitleSplit[0]);
        if (k) aliases.add(k);
    }

    // 3. Numeral variants of the primary key and of every alias gathered so far.
    for (const base of [primaryKey, ...aliases]) {
        for (const v of numeralVariants(base)) aliases.add(v);
    }

    aliases.delete(primaryKey);
    aliases.delete('');
    return [...aliases];
}

function normalizeWHDLoadKey(filename) {
    if (!filename) return '';
    const stem = String(filename).replace(/\.[^/.]+$/, '');
    const base = stem.split(/_v\d+(?:\.\d+)*[a-z]?\b/i)[0];
    if (!base || base === stem) return '';
    return base
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '')
        .trim();
}

function parseDatGames(datText) {
    const games = [];
    let current = null;
    for (const line of datText.split(/\r?\n/)) {
        if (/^\s*game\s*\(/.test(line)) {
            current = { name: '', roms: [] };
            continue;
        }
        if (!current) continue;
        if (/^\s*\)\s*$/.test(line)) {
            if (current.name && current.roms.length > 0) {
                games.push(current);
            }
            current = null;
            continue;
        }
        const nameMatch = line.match(/^\s*name\s+"([^"]+)"/);
        if (nameMatch) {
            current.name = nameMatch[1];
            continue;
        }
        const romMatch = line.match(/^\s*rom\s*\(\s*name\s+"([^"]+)"/);
        if (romMatch) {
            current.roms.push(romMatch[1]);
        }
    }
    return games;
}

function addDatAliases(index, games) {
    let added = 0;
    for (const game of games) {
        const titleKey = normalizeKey(game.name);
        if (!titleKey || !index[titleKey]) continue;
        const target = index[titleKey];
        for (const romName of game.roms) {
            const keys = [
                normalizeKey(romName),
                normalizeWHDLoadKey(romName)
            ].filter(Boolean);
            for (const key of keys) {
                if (index[key]) continue;
                index[key] = target;
                added++;
            }
        }
    }
    return added;
}

// Lower is better. Prefer canonical releases over alternate/hacked dumps.
function scoreCandidate(filename) {
    let score = 0;
    if (/\[a\d*\]/i.test(filename)) score += 100;     // alternate dumps
    if (/\[b\d*\]/i.test(filename)) score += 100;     // bad dumps
    if (/\[h\d*[^\]]*\]/i.test(filename)) score += 80; // hacks
    if (/\[k[- ]?file\]/i.test(filename)) score += 60;
    if (/\[cr [^\]]+\]/i.test(filename)) score += 50;
    if (/\[t\d*\]/i.test(filename)) score += 40;
    if (/\[tr[^\]]*\]/i.test(filename)) score += 40;
    if (/\[f\d*\]/i.test(filename)) score += 30;
    if (/\(side b\)/i.test(filename)) score += 20;
    if (/\(disk\s*\d*[^)1]\)/i.test(filename)) score += 20; // disk 2,3...
    // shorter filename = closer to canonical form
    score += filename.length * 0.01;
    return score;
}

function buildIndexForLayer(filenames) {
    const buckets = new Map();
    for (const filename of filenames) {
        const key = normalizeKey(filename);
        if (!key) continue;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(filename);
    }
    const sortCandidates = (candidates) => candidates.sort((a, b) => {
        const sa = scoreCandidate(a);
        const sb = scoreCandidate(b);
        if (sa !== sb) return sa - sb;
        return a.localeCompare(b);
    });

    const index = {};
    for (const [key, candidates] of buckets) {
        sortCandidates(candidates);
        index[key] = candidates[0];
    }

    // Second pass: register alias keys (trailing article, subtitle, numeral
    // variants) without ever overwriting a primary key. When two filenames map to
    // the same alias, keep the better-scored candidate so aliases stay canonical.
    const aliasOwner = {};
    for (const [key, candidates] of buckets) {
        const best = candidates[0];
        for (const alias of aliasKeysForFilename(best, key)) {
            if (index[alias]) continue; // primary keys always win
            const prev = aliasOwner[alias];
            if (!prev || scoreCandidate(best) < scoreCandidate(prev)) {
                aliasOwner[alias] = best;
            }
        }
    }
    for (const [alias, filename] of Object.entries(aliasOwner)) {
        index[alias] = filename;
    }
    return index;
}

async function buildForPlatform(platform) {
    console.log(`\n=== ${platform.platform_id} (${platform.system}) ===`);
    let datGames = [];
    if (platform.dat_url) {
        process.stdout.write('  DAT aliases: fetching... ');
        try {
            const datText = await fetchUrl(platform.dat_url);
            datGames = parseDatGames(datText);
            console.log(`${datGames.length} games`);
        } catch (err) {
            console.log(`FAILED (${err.message})`);
        }
    }
    const result = {
        platform_id: platform.platform_id,
        system: platform.system,
        generated_at: new Date().toISOString()
    };

    // List thumbnail filenames from the mirror repo (git-trees API, with a
    // blobless-clone fallback for repos too large for the API).
    const repoName = thumbnailRepoName(platform.system);
    process.stdout.write(`  tree (${repoName}): fetching... `);
    let byLayer;
    try {
        const listed = await listLayerFilenames(repoName);
        byLayer = listed.byLayer;
        console.log(`${listed.entries} entries`);
    } catch (err) {
        // Network/HTTP/clone failure: keep the existing index rather than risk losing it.
        console.warn(`  SKIPPED: failed to list files (${err.message}); existing index left untouched`);
        return false;
    }

    let successfulLayers = 0;
    for (const layer of LAYERS) {
        const filenames = byLayer[layer] || [];
        if (filenames.length === 0) {
            console.log(`  ${layer}: 0 files (skipped)`);
            continue;
        }
        const index = buildIndexForLayer(filenames);
        const aliases = datGames.length > 0 ? addDatAliases(index, datGames) : 0;
        result[LAYER_KEY[layer]] = index;
        successfulLayers++;
        console.log(`  ${layer}: ${filenames.length} files -> ${Object.keys(index).length} keys (${aliases} DAT aliases)`);
    }
    if (successfulLayers === 0) {
        console.warn(`  SKIPPED: no thumbnail layers found; existing index left untouched`);
        return false;
    }
    const outPath = path.join(OUT_DIR, `${platform.platform_id}.json`);
    fs.writeFileSync(outPath, JSON.stringify(result, null, 0));
    console.log(`  written: ${outPath} (${(fs.statSync(outPath).size / 1024).toFixed(1)} KB)`);
    return true;
}

(async () => {
    if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
    const platforms = platformFilter
        ? PLATFORMS.filter(platform => platform.platform_id === platformFilter)
        : PLATFORMS;
    if (platforms.length === 0) {
        throw new Error(`Unknown platform: ${platformFilter}`);
    }
    const skipped = [];
    for (const platform of platforms) {
        try {
            const ok = await buildForPlatform(platform);
            if (!ok) skipped.push(platform.platform_id);
        } catch (err) {
            // Unexpected per-platform error: report and continue with the rest
            // rather than aborting the whole run (and the indexes already written).
            console.warn(`  ERROR for ${platform.platform_id}: ${err.message}`);
            skipped.push(platform.platform_id);
        }
    }
    for (const alias of ALIASES) {
        if (!platformFilter || platformFilter === alias.from || platformFilter === alias.to) {
            const src = path.join(OUT_DIR, `${alias.from}.json`);
            const dst = path.join(OUT_DIR, `${alias.to}.json`);
            if (fs.existsSync(src)) {
                fs.copyFileSync(src, dst);
                console.log(`alias: ${alias.to}.json <- ${alias.from}.json`);
            }
        }
    }
    if (skipped.length > 0) {
        console.log(`\nDone, with ${skipped.length} platform(s) skipped (existing index kept): ${skipped.join(', ')}`);
    } else {
        console.log('\nDone.');
    }
})().catch((err) => {
    console.error(err);
    process.exit(1);
});
