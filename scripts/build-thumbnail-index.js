#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');

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
    { platform_id: 'snk', system: 'SNK - Neo Geo' }
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

function parseListing(html) {
    const filenames = [];
    const re = /<a href="([^"]+\.png)"/g;
    let m;
    while ((m = re.exec(html)) !== null) {
        filenames.push(decodeURIComponent(m[1]));
    }
    return filenames;
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
    const index = {};
    for (const [key, candidates] of buckets) {
        candidates.sort((a, b) => {
            const sa = scoreCandidate(a);
            const sb = scoreCandidate(b);
            if (sa !== sb) return sa - sb;
            return a.localeCompare(b);
        });
        index[key] = candidates[0];
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
    let successfulLayers = 0;
    for (const layer of LAYERS) {
        const url = `https://thumbnails.libretro.com/${encodeURIComponent(platform.system)}/${layer}/`;
        process.stdout.write(`  ${layer}: fetching... `);
        try {
            const html = await fetchUrl(url);
            const filenames = parseListing(html);
            const index = buildIndexForLayer(filenames);
            const aliases = datGames.length > 0 ? addDatAliases(index, datGames) : 0;
            result[LAYER_KEY[layer]] = index;
            successfulLayers++;
            console.log(`${filenames.length} files -> ${Object.keys(index).length} keys (${aliases} DAT aliases)`);
        } catch (err) {
            console.log(`FAILED (${err.message})`);
        }
    }
    if (successfulLayers === 0) {
        throw new Error(`No thumbnail layers fetched for ${platform.platform_id}; leaving existing index untouched`);
    }
    const outPath = path.join(OUT_DIR, `${platform.platform_id}.json`);
    fs.writeFileSync(outPath, JSON.stringify(result, null, 0));
    console.log(`  written: ${outPath} (${(fs.statSync(outPath).size / 1024).toFixed(1)} KB)`);
}

(async () => {
    if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
    const platforms = platformFilter
        ? PLATFORMS.filter(platform => platform.platform_id === platformFilter)
        : PLATFORMS;
    if (platforms.length === 0) {
        throw new Error(`Unknown platform: ${platformFilter}`);
    }
    for (const platform of platforms) {
        await buildForPlatform(platform);
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
    console.log('\nDone.');
})().catch((err) => {
    console.error(err);
    process.exit(1);
});
