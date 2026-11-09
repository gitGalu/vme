#!/usr/bin/env node

// Adds Sharp X68000 to private-assets/vme_import.zip (the bundle behind CLI 'OPEN IA'):
// the TOSEC software list built from the archive.org item, and the BIOS ROMs.
// Safe to re-run: existing X68000 entries are replaced, everything else is kept.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const ITEM = 'Sharp_X68000_TOSEC_2012_04_23';
const LISTING_URL = `https://archive.org/download/${ITEM}/${ITEM}.txt`;
const SOFTWARE_ROOT = `https://archive.org/download/${ITEM}/${ITEM}.zip/`;
const SOFTWARE_NAME = 'TOSEC: Sharp X68000 (2012-04-23)';

const ROM_BASE_URL = 'https://raw.githubusercontent.com/Abdess/retrobios/main/bios/Sharp/X68000/';
// Must match `accepted` in src/platforms/systems/X68000.js.
const ROMS = {
    'iplrom.dat': '7fd4caabac1d9169e289f0f7bbf71d8e',
    'cgrom.dat': 'cb0a5cfcf7247a7eab74bb2716260269'
};

const ZIP_DIR = 'X68000';
const MANIFEST = 'vme_import.json';
const BUNDLE = path.resolve(__dirname, '..', 'private-assets', 'vme_import.zip');

// encodeURIComponent plus the characters it leaves alone, as in the existing TOSEC lists.
const encodePart = (part) => encodeURIComponent(part)
    .replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

async function download(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url} -> HTTP ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
}

// The listing is `unzip -l` output: "<size> <date> <time> <path>".
function buildSoftwareList(listing) {
    const files = listing.split(/\r?\n/)
        .map((line) => line.match(/^\s*\d+\s+\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}\s+(.+\.zip)\s*$/i)?.[1])
        .filter(Boolean)
        .map((file) => ({ dir: file.slice(0, file.lastIndexOf('/') + 1), name: file.slice(file.lastIndexOf('/') + 1) }));
    if (files.length === 0) throw new Error('No programs found in the archive.org listing.');

    const dirs = [...new Set(files.map((file) => file.dir))].sort();
    const items = files
        .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
        .map((file) => [file.name, dirs.indexOf(file.dir), encodePart(file.name)]);

    return {
        version: 'CORSFILEv1',
        name: SOFTWARE_NAME,
        root: SOFTWARE_ROOT,
        bases: dirs.map(encodePart),
        items
    };
}

async function main() {
    console.log(`Listing ${ITEM} ...`);
    const software = buildSoftwareList((await download(LISTING_URL)).toString('utf8'));
    console.log(`  ${software.items.length} programs in ${software.bases.length} folders`);

    const roms = {};
    for (const [name, md5] of Object.entries(ROMS)) {
        console.log(`Downloading ${name} ...`);
        const bytes = await download(ROM_BASE_URL + name);
        const actual = crypto.createHash('md5').update(bytes).digest('hex');
        if (actual !== md5) throw new Error(`${name}: MD5 ${actual}, expected ${md5}`);
        roms[name] = bytes;
    }

    const zip = await JSZip.loadAsync(fs.readFileSync(BUNDLE));
    const manifest = JSON.parse(await zip.file(MANIFEST).async('string'));

    const softwarePath = `${ZIP_DIR}/${ITEM}.json`;
    zip.file(softwarePath, JSON.stringify(software));
    const dependencies = {};
    for (const [name, bytes] of Object.entries(roms)) {
        dependencies[name] = `${ZIP_DIR}/${name}`;
        zip.file(dependencies[name], bytes);
    }
    manifest.platforms.x68000 = { software: softwarePath, dependencies };
    zip.file(MANIFEST, JSON.stringify(manifest, null, 2));

    const output = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    fs.copyFileSync(BUNDLE, `${BUNDLE}.bak`);
    fs.writeFileSync(`${BUNDLE}.tmp`, output);
    fs.renameSync(`${BUNDLE}.tmp`, BUNDLE);
    console.log(`Written ${BUNDLE} (${(output.length / 1048576).toFixed(1)} MB), previous version in .bak`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
