import assert from 'node:assert/strict';
import { test } from 'node:test';
import JSZip from 'jszip';
import { PNG } from 'pngjs';
import { importCatalog, searchCatalogs, buildCollection, validateCollection, selectionIdentity } from '../tools/collection-builder/scripts/model.js';
import { createDiskSetResolver, selectDiskSet } from '../tools/collection-builder/scripts/disk-sets.js';
import { buildCollectionDiskBundle, prepareCollectionDiskBundle } from '../src/utils/CollectionDiskSet.js';
import { createArtworkService } from '../tools/collection-builder/scripts/artwork.js';
import { matchThumbnails } from '../src/utils/ThumbnailMatching.js';
import PlatformBase from '../src/platforms/PlatformBase.js';
import { parseProgramList, matchProgramList, chooseProgramMatch, programListReport, searchProgramCandidates, addProgramSearchCandidate } from '../tools/collection-builder/scripts/program-list.js';
import { importCollectionArchive } from '../src/utils/CollectionImport.js';
import { testCollectionImport } from '../tools/collection-builder/scripts/import-test.js';

const bytes = async zip => zip.generateAsync({ type: 'uint8array' });
const directory = {
    version: 'CORSFILEv1', name: 'Sample library', root: 'https://example.org/archive.zip/',
    bases: ['Games%2F', 'https://other.example/'], tags: { 0: 'WHDLoad' },
    items: [['River_Raid (1983)(Publisher).zip', 0, 'River%20Raid%2Fgame.zip', 10, 'River Raid'], ['manual.txt', 0, 'manual.txt']]
};
const importJSON = (data = directory) => importCatalog(JSON.stringify(data), { id: 'source', name: 'library.json', platformId: 'amiga' });
const collection = entries => ({ id: 'test-collection', name: 'Test collection', list: entries });

test('software catalogs preserve encoded URLs, tags and display titles and filter non-games', async () => {
    const before = JSON.stringify(directory);
    const source = await importJSON();
    assert.equal(source.entries[0].url, 'https://example.org/archive.zip/Games%2FRiver%20Raid%2Fgame.zip');
    assert.equal(source.entries[0].title, 'River Raid');
    assert.equal(source.entries[0].tag, 'WHDLoad');
    assert.equal(searchCatalogs(source.entries, { query: 'RIVER raid whdload' }).total, 1);
    assert.equal(searchCatalogs(source.entries, {}).total, 1);
    assert.equal(JSON.stringify(directory), before);
    await assert.rejects(importCatalog(JSON.stringify(directory), { id: 'source' }), /Choose a platform/);
    const absolute = await importJSON({ ...directory, root: '', items: [['Game.zip', 1, 'Game%20Name.zip']] });
    assert.equal(absolute.entries[0].url, 'https://other.example/Game%20Name.zip');
});

test('vme_import ZIP imports the manifest catalogs and excludes dependencies from exports', async () => {
    const zip = new JSZip();
    zip.file('vme_import.json', JSON.stringify({ platforms: { atari7800: { software: 'a7800.json', dependencies: { bios: 'bios.bin' } } } }));
    zip.file('a7800.json', JSON.stringify(directory)); zip.file('bios.bin', 'private dependency');
    const source = await importCatalog(await bytes(zip), { id: 'import', name: 'vme_import.zip' });
    assert.equal(source.entries[0].platform_id, 'a7800');
    const result = await buildCollection(collection([source.entries[0]]));
    const output = await JSZip.loadAsync(result.bytes);
    assert.equal(output.file('bios.bin'), null);
    assert.ok(output.file('vme_collection.json'));
    assert.ok(output.file(result.manifest.image));
    assert.equal(PNG.sync.read(Buffer.from(await output.file(result.manifest.image).async('uint8array'))).width, 1);
});

test('links export never fetches game data and contains the images required by VM/E', async () => {
    const source = await importJSON(); let downloads = 0;
    const result = await buildCollection(collection([source.entries[0]]), { mode: 'links', fetchFile: () => { downloads++; throw new Error('Must not download'); } });
    const zip = await JSZip.loadAsync(result.bytes);
    assert.equal(downloads, 0);
    assert.equal(result.filename, 'test-collection_vme_collection.zip');
    const manifest = JSON.parse(await zip.file('vme_collection.json').async('string'));
    assert.equal(manifest.list[0].url, source.entries[0].url);
    assert.equal('file' in manifest.list[0], false);
    assert.ok(zip.file(manifest.list[0].image));
    assert.ok(zip.file(manifest.image));
    assert.equal(Object.keys(zip.files).some(name => name.startsWith('files/')), false);
});

test('file export downloads only selected games, retains launch filenames and avoids collisions', async () => {
    const source = await importJSON(); const first = { ...source.entries[0], filename: 'game.zip' };
    const second = { ...first, key: 'other', platform_id: 'nes', url: 'https://example.org/other.zip' };
    const calls = [];
    const result = await buildCollection(collection([second, first]), { mode: 'files', fetchFile: async url => { calls.push(url); return new TextEncoder().encode(url); } });
    const zip = await JSZip.loadAsync(result.bytes);
    assert.deepEqual(calls, [second.url, first.url]);
    assert.equal(result.manifest.list[0].filename, 'game.zip');
    assert.notEqual(result.manifest.list[0].file, result.manifest.list[1].file);
    assert.equal(await zip.file(result.manifest.list[0].file).async('string'), second.url);
    assert.equal('url' in result.manifest.list[0], false, 'VM/E must consume the embedded file');
});

test('existing collections retain embedded ROMs and images through a nested ZIP round trip', async () => {
    const zip = new JSZip();
    zip.file('folder/vme_collection.json', JSON.stringify({ id: 'old', name: 'Old collection', image: 'cover.png', list: [
        { title: 'My game', platform_id: 'nes', filename: 'game.nes', file: 'game.nes', image: 'game.png', credits: 'Original credits', description: 'Description' }
    ] }));
    zip.file('folder/game.nes', new Uint8Array([1, 2, 3])); zip.file('folder/game.png', new Uint8Array([4, 5, 6]));
    const source = await importCatalog(await bytes(zip), { id: 'embedded' });
    const sources = new Map([[source.id, source]]);
    assert.equal(source.collection.name, 'Old collection');
    assert.ok(validateCollection(collection(source.entries), { mode: 'links' }).some(error => error.includes('HTTP')));
    const result = await buildCollection(collection(source.entries), { mode: 'files', sources });
    const output = await JSZip.loadAsync(result.bytes);
    assert.deepEqual([...await output.file(result.manifest.list[0].file).async('uint8array')], [1, 2, 3]);
    assert.deepEqual([...await output.file(result.manifest.list[0].image).async('uint8array')], [4, 5, 6]);
    assert.equal(result.manifest.list[0].credits, 'Original credits');
    const again = await importCatalog(result.bytes, { id: 'again' });
    assert.equal(again.entries[0].title, 'My game');
});

test('invalid URLs, missing local assets, empty downloads and failed downloads stop export', async () => {
    const source = await importJSON(); const entry = source.entries[0];
    await assert.rejects(buildCollection(collection([{ ...entry, url: 'javascript:alert(1)' }])), /HTTP/);
    await assert.rejects(buildCollection(collection([{ ...entry, filePath: 'missing.bin' }]), { mode: 'files' }), /embedded file is missing/);
    await assert.rejects(buildCollection(collection([entry]), { mode: 'files', fetchFile: async () => new Uint8Array() }), /empty/);
    await assert.rejects(buildCollection(collection([entry]), { mode: 'files', fetchFile: async () => { throw new Error('HTTP 503'); } }), /503/);
    assert.ok(validateCollection(collection([entry]), { platforms: new Set(['nes']) }).some(error => error.includes('not enabled')));
});

test('attached files override unavailable source files and export can be cancelled', async () => {
    const source = await importJSON();
    const entry = { ...source.entries[0], filePath: 'missing', fileOverride: new Blob(['replacement']) };
    const result = await buildCollection(collection([entry]), { mode: 'files' });
    const zip = await JSZip.loadAsync(result.bytes);
    assert.equal(await zip.file(result.manifest.list[0].file).async('string'), 'replacement');
    const controller = new AbortController(); controller.abort();
    await assert.rejects(buildCollection(collection([entry]), { mode: 'files', signal: controller.signal }), error => error.name === 'AbortError');
});

test('large catalogs have bounded result pages and platform-specific selection identities', async () => {
    const source = await importJSON({ ...directory, items: Array.from({ length: 12003 }, (_, index) => [`Game ${index}.zip`, 0, `${index}.zip`]) });
    const found = searchCatalogs(source.entries, { query: 'game', offset: 80, limit: 80 });
    assert.equal(found.total, 12003); assert.equal(found.results.length, 80); assert.equal(found.results[0].filename, 'Game 80.zip');
    assert.notEqual(selectionIdentity(source.entries[0]), selectionIdentity({ ...source.entries[0], platform_id: 'nes' }));
});

test('unsafe archive references are rejected', async () => {
    const zip = new JSZip();
    zip.file('vme_import.json', JSON.stringify({ platforms: { nes: { software: '../escape.json' } } }));
    await assert.rejects(importCatalog(await bytes(zip), { id: 'bad' }), /Invalid archive path/);
});

test('cancellation during download or ZIP generation rejects without a partial result', async () => {
    const source = await importJSON();
    const downloading = new AbortController();
    await assert.rejects(buildCollection(collection([source.entries[0]]), { mode: 'files', signal: downloading.signal,
        fetchFile: async () => { downloading.abort(); return new Uint8Array([1, 2, 3]); }
    }), cause => cause.name === 'AbortError');
    const packing = new AbortController();
    await assert.rejects(buildCollection(collection([source.entries[0]]), { signal: packing.signal,
        onProgress: progress => { if (progress.stage === 'zip') packing.abort(); }
    }), cause => cause.name === 'AbortError');
});

const diskPlatforms = [{ id: 'amiga', core: 'puae', multidisk: true }, { id: 'atari800', core: 'atari800', multidisk: true }];
const diskSource = async (names, platform = 'amiga') => importCatalog(JSON.stringify({
    root: 'https://example.org/', bases: ['games/'], items: names.map((name, index) => [name, 0, `${index}.zip`, '880K'])
}), { id: 'disks', name: 'disks.json', platformId: platform });
const amigaNames = [2, 1].map(n => `Fixture (1991)(Publisher)(AGA)(Disk ${n} of 2)[cr Team].adf.zip`);
const selectSet = source => selectDiskSet(source.entries[0], createDiskSetResolver(source.entries, diskPlatforms));

test('disk grouping reuses VM/E selection, orders disks, preserves platform variants and scopes catalogs', async () => {
    const source = await diskSource([...amigaNames, ...amigaNames.map(name => name.replace('AGA', 'OCS'))]);
    const entry = selectSet(source);
    assert.equal(entry.disks.length, 2);
    assert.ok(entry.disks[0].filename.includes('Disk 1'));
    assert.ok(entry.disks.every(disk => disk.filename.includes('(AGA)')));
    assert.ok(entry.filename.endsWith('.zip') && entry.filename.includes('AGA'));
    assert.equal(entry.filename, selectDiskSet(source.entries[1], createDiskSetResolver(source.entries, diskPlatforms)).filename, 'The bundle filename does not depend on the clicked disk');
    assert.deepEqual(validateCollection(collection([entry])), []);
    const other = await diskSource([amigaNames[0]]);
    other.entries[0].sourceId = 'different'; other.entries[0].key = 'different';
    const split = [source.entries[1], other.entries[0]];
    const incomplete = selectDiskSet(split[0], createDiskSetResolver(split, diskPlatforms));
    assert.equal(incomplete.diskSet.isComplete, false, 'Other imported catalogs cannot supply missing disks');
    assert.ok(validateCollection(collection([incomplete])).some(error => /incomplete/.test(error)));
});

test('incomplete and ambiguous variants cannot silently export a partial game', async () => {
    const missing = selectSet(await diskSource([amigaNames[1]]));
    await assert.rejects(buildCollection(collection([missing])), /incomplete/);
    const names = [amigaNames[1], ...['[a1]', '[a2]'].map(tag => amigaNames[0].replace('[cr Team]', `[cr Team]${tag}`))];
    const ambiguous = selectSet(await diskSource(names));
    assert.equal(ambiguous.diskSet.isComplete, true);
    assert.equal(ambiguous.diskSet.isConfident, false);
    await assert.rejects(buildCollection(collection([ambiguous])), /ambiguous/);
    const huge = selectSet(await diskSource(['Game (Disk 1 of 999999999).adf']));
    await assert.rejects(buildCollection(collection([huge])), /incomplete/);
});

test('Atari disks/sides use conservative grouping and report missing sides and duplicate variants', async () => {
    const source = await diskSource(['Polar (v1, side B).atr.zip', 'Polar (v1, side A).atr.zip', 'Polar (v2, side A).atr.zip'], 'atari800');
    const entry = selectSet(source);
    assert.equal(entry.disks.length, 2);
    assert.ok(entry.disks[0].filename.includes('side A'));
    assert.ok(entry.disks.every(disk => disk.filename.includes('v1')));
    const missing = selectSet(await diskSource(['Game Disk 1 of 3.atr', 'Game Disk 3 of 3.atr'], 'atari800'));
    assert.deepEqual(missing.diskSet.missing, ['2']);
    const duplicate = selectSet(await diskSource(['Game side A.atr', 'Game side A.ATR', 'Game side B.atr'], 'atari800'));
    assert.equal(duplicate.diskSet.isConfident, false);
    const single = selectSet(await diskSource(['Game Disk 1.atr'], 'atari800'));
    assert.equal(single.disks, undefined, 'A standalone disk without a declared multi-disk count stays a normal entry');
});

test('multi-disk link export lists all URLs under one game and downloads nothing', async () => {
    const entry = selectSet(await diskSource(amigaNames));
    const result = await buildCollection(collection([entry]), { fetchFile: () => assert.fail('Links must not download') });
    assert.equal(result.manifest.list.length, 1);
    assert.deepEqual(result.manifest.list[0].disks.map(disk => disk.url), entry.disks.map(disk => disk.url));
    assert.equal(result.manifest.list[0].url, undefined);
    const zip = await JSZip.loadAsync(result.bytes);
    assert.ok(!Object.keys(zip.files).some(name => name.startsWith('files/')));
    const source = await importCatalog(result.bytes, { id: 'again' });
    assert.equal(source.entries[0].disks.length, 2);
    assert.deepEqual(validateCollection(collection(source.entries)), []);
});

test('multi-disk file export embeds all disks once and round trips without URLs or network', async () => {
    const entry = selectSet(await diskSource(amigaNames)); const calls = [];
    const result = await buildCollection(collection([entry]), { mode: 'files', fetchFile: async url => { calls.push(url); return new TextEncoder().encode(url); } });
    assert.deepEqual(calls, entry.disks.map(disk => disk.url));
    assert.equal(result.manifest.list.length, 1);
    const zip = await JSZip.loadAsync(result.bytes);
    for (const [index, disk] of result.manifest.list[0].disks.entries()) {
        assert.equal(disk.url, undefined);
        assert.equal(await zip.file(disk.file).async('string'), entry.disks[index].url);
    }
    const source = await importCatalog(result.bytes, { id: 'again' });
    const again = await buildCollection(collection(source.entries), { mode: 'files', sources: new Map([[source.id, source]]), fetchFile: () => assert.fail('Embedded files must not download') });
    assert.equal(again.manifest.list[0].disks.length, 2);
    await assert.rejects(buildCollection(collection(source.entries), { mode: 'links' }), /HTTP/);
});

test('runtime bundle unwraps separate disk ZIPs, aliases colliding names and produces a complete M3U', async () => {
    const disks = amigaNames.map(filename => ({ filename }));
    const blob = await buildCollectionDiskBundle(disks, 'amiga', async (_, index) => {
        const zip = new JSZip(); zip.file('same-name.adf', new Uint8Array([index + 1])); zip.file('manual.txt', 'manual');
        return bytes(zip);
    });
    const platform = { platform_id: 'amiga', core: 'puae', multidisk: true };
    const prepared = await prepareCollectionDiskBundle(blob, 'Game (AGA).zip', platform, 1);
    assert.equal(prepared.diskIndex, 1);
    assert.equal(prepared.programName, 'Game (AGA).zip');
    assert.equal(prepared.saveBlob, blob, 'The complete bundle survives saving and reopening');
    assert.deepEqual(prepared.selectedDisplayNames, amigaNames);
    assert.equal(await prepared.launchFiles[0].fileContent.text(), 'vme_disk_0.adf\nvme_disk_1.adf\n');
    assert.deepEqual([...new Uint8Array(await prepared.launchFiles[2].fileContent.arrayBuffer())], [2]);
    const restored = await prepareCollectionDiskBundle(prepared.saveBlob, prepared.programName, platform, 1);
    assert.equal(restored.launchFiles.length, 3);
});

test('bundle decoding preserves ordinary ZIP behavior and rejects missing, unsupported or ambiguous disks', async () => {
    const platform = { platform_id: 'amiga', core: 'puae', multidisk: true };
    const ordinary = new JSZip(); ordinary.file('game.adf', 'game');
    assert.equal(await prepareCollectionDiskBundle(new Blob([await bytes(ordinary)]), 'game.zip', platform), null);
    const disks = [{ filename: 'one.adf' }, { filename: 'two.adf' }];
    const blob = await buildCollectionDiskBundle(disks, 'amiga', async () => new Uint8Array([1]));
    const repeated = await buildCollectionDiskBundle(disks, 'amiga', async () => new Uint8Array([1]));
    assert.deepEqual(new Uint8Array(await blob.arrayBuffer()), new Uint8Array(await repeated.arrayBuffer()), 'Identical disks produce deterministic bundle bytes');
    assert.equal(await prepareCollectionDiskBundle(new Blob(['not a ZIP']), 'game.zip', platform), null);
    const damaged = await JSZip.loadAsync(await blob.arrayBuffer()); damaged.remove('disks/02-two.adf');
    await assert.rejects(prepareCollectionDiskBundle(new Blob([await bytes(damaged)]), 'game.zip', platform), /missing/);
    await assert.rejects(prepareCollectionDiskBundle(blob, 'game.zip', { ...platform, platform_id: 'st' }), /incompatible/);
    await assert.rejects(buildCollectionDiskBundle([{ filename: '../escape.adf' }, disks[1]], 'amiga', async () => new Uint8Array([1])), /filename/);
    const unsupported = await buildCollectionDiskBundle([{ filename: 'one.ipf' }, disks[1]], 'amiga', async () => new Uint8Array([1]));
    await assert.rejects(prepareCollectionDiskBundle(unsupported, 'game.zip', platform), /unsupported/);
    const inner = new JSZip(); inner.file('one.adf', 'one'); inner.file('two.adf', 'two');
    const ambiguous = await buildCollectionDiskBundle([{ filename: 'disks.zip' }, disks[1]], 'amiga', async () => bytes(inner));
    await assert.rejects(prepareCollectionDiskBundle(ambiguous, 'game.zip', platform), /exactly one/);
});

test('a failed disk or cancellation aborts the entire game export', async () => {
    const entry = selectSet(await diskSource(amigaNames)); let calls = 0;
    await assert.rejects(buildCollection(collection([entry]), { mode: 'files', fetchFile: async () => {
        if (++calls === 2) throw new Error('Second disk unavailable'); return new Uint8Array([1]);
    } }), /Second disk unavailable/);
    const controller = new AbortController(); calls = 0;
    await assert.rejects(buildCollection(collection([entry]), { mode: 'files', signal: controller.signal, fetchFile: async () => {
        calls++; controller.abort(); return new Uint8Array([1]);
    } }), cause => cause.name === 'AbortError');
    assert.equal(calls, 1, 'Cancellation prevents starting the next disk download');
});

const imagePlatform = { id: 'amiga', thumbnailUrls: PlatformBase.getThumbnailUrls.call({ libretro_thumbnails_system: 'Commodore - Amiga' }) };
const imageIndex = { snaps: { 'river raid': 'River Raid (Europe).png', riverraid: 'River Raid.png' },
    titles: { 'river raid': 'River Raid (Europe).png' }, boxarts: { 'river raid': 'River Raid.png' } };
const imageEntry = () => ({ key: 'game', platform_id: 'amiga', title: 'River Raid', filename: 'River Raid (1983)(Disk 2 of 2).zip' });
const imageService = options => createArtworkService({ platforms: [imagePlatform], loadIndex: async () => imageIndex,
    fetchImage: async () => new Blob(['image']), convertImage: async file => file, ...options });

test('artwork uses VM/E match keys, WHDLoad normalization, source URLs and layer order', () => {
    const matches = matchThumbnails(imageIndex, imagePlatform.thumbnailUrls, [imageEntry().filename]);
    assert.deepEqual(matches.map(match => match.layer), ['snaps', 'titles', 'boxarts']);
    assert.ok(matches[0].url.endsWith('Named_Snaps/River%20Raid%20(Europe).png'));
    assert.equal(matchThumbnails(imageIndex, imagePlatform.thumbnailUrls, ['RiverRaid_v1.2_1234.lha'])[0].filename, 'River Raid.png');
    const atari = PlatformBase.getThumbnailUrls.call({ libretro_thumbnails_system: 'Atari - 8-bit' });
    assert.ok(atari.snaps.includes('Atari_-_8-bit_Family@master'));
});

test('artwork loads only the relevant platform index once, supports disk sets and retries index failures', async () => {
    let loads = 0;
    const service = imageService({ loadIndex: async () => { loads++; return imageIndex; } });
    const entry = { ...imageEntry(), filename: 'bundle.zip', originalName: 'arbitrary.zip', title: 'Edited label', disks: [{ filename: 'River Raid (Disk 1 of 2).adf.zip' }] };
    const results = await Promise.all([service.find(entry), service.find(entry)]);
    assert.equal(loads, 1); assert.equal(results[0].length, 3);
    assert.deepEqual(await service.find({ ...entry, platform_id: 'unknown' }), []);
    assert.equal(loads, 1);
    let attempts = 0;
    const retry = imageService({ loadIndex: async () => { if (++attempts === 1) throw new Error('Temporary failure'); return imageIndex; } });
    await assert.rejects(retry.find(imageEntry()), /Temporary/);
    assert.equal((await retry.find(imageEntry())).length, 3);
});

test('bulk artwork preserves existing images, falls back to another layer and reports unmatched/failed games', async () => {
    const existing = { ...imageEntry(), key: 'existing', imageOverride: new Blob(['manual']) };
    const imported = { ...imageEntry(), key: 'imported', imagePath: 'images/existing.png' };
    const unmatched = { ...imageEntry(), key: 'unmatched', title: 'Unknown', filename: 'Unknown.zip' };
    const loaded = [], requests = [];
    const service = imageService({ fetchImage: async url => { requests.push(url); if (url.includes('Named_Snaps')) throw new Error('HTTP 404'); return new Blob(['title screen']); } });
    const summary = await service.downloadMissing([existing, imported, imageEntry(), unmatched], { onImage: (entry, result) => loaded.push({ entry, result }) });
    assert.deepEqual({ downloaded: summary.downloaded, skipped: summary.skipped, unmatched: summary.unmatched, failed: summary.failed }, { downloaded: 1, skipped: 2, unmatched: 1, failed: 0 });
    assert.equal(requests.length, 2); assert.equal(loaded[0].result.source.layer, 'titles');
    assert.equal(await existing.imageOverride.text(), 'manual');
    const failure = await imageService({ fetchImage: async () => { throw new Error('Offline'); } }).downloadMissing([imageEntry()]);
    assert.equal(failure.failed, 1); assert.equal(failure.errors[0].message, 'Offline');
});

test('artwork cancellation and image decoding errors never commit a broken image', async () => {
    const controller = new AbortController(); let commits = 0;
    const service = imageService({ fetchImage: async () => { controller.abort(); return new Blob(['late bytes']); } });
    await assert.rejects(service.downloadMissing([imageEntry()], { signal: controller.signal, onImage: () => commits++ }), cause => cause.name === 'AbortError');
    assert.equal(commits, 0);
    const bad = imageService({ convertImage: async () => { throw new Error('Not an image'); } });
    const matches = await bad.find(imageEntry());
    await assert.rejects(bad.download(imageEntry(), matches[0]), /Not an image/);
    await assert.rejects(bad.download(imageEntry(), { ...matches[0], url: 'https://example.org/unindexed.png' }), /not an indexed match/);
});

const listPlatforms = [...diskPlatforms.map(platform => ({ ...platform, name: platform.id })), { id: 'dos', name: 'DOS' }, { id: 'nes', name: 'Nintendo Entertainment System' }];
const listEntry = (key, title, platform = 'dos', extra = {}) => ({ key, title, platform_id: platform, filename: `${title}.zip`,
    originalName: `${title}.zip`, sourceId: 'list', sourceName: 'Catalog', catalogId: 'list:0', tag: '', software: true, url: `https://example.org/${key}.zip`, ...extra });
const matchList = (text, entries, options = {}) => matchProgramList(text, { entries, platforms: listPlatforms, yieldControl: async () => {}, ...options });

test('program lists accept platform/title/variant or titles, aliases, tabs, comments and headers', () => {
    const rows = parseProgramList('# Wishlist\nplatform | title | variant\namiga | Lemmings | WHDLoad\n- Doom\na8\tBruce Lee\nunknown | Missing\ndos |', { platforms: listPlatforms, platform: 'dos' });
    assert.equal(rows.length, 5); assert.equal(rows[0].line, 3); assert.equal(rows[0].variant, 'WHDLoad');
    assert.equal(rows[1].platform_id, 'dos'); assert.equal(rows[1].title, 'Doom');
    assert.equal(rows[2].platform_id, 'atari800'); assert.equal(rows[3].status, 'invalid'); assert.equal(rows[4].status, 'invalid');
});

test('list matching selects exact titles, isolates sequels, handles WHDLoad and reports misses without fuzzy guessing', async () => {
    const entries = [listEntry('doom', 'Doom'), listEntry('doom2', 'Doom II'), listEntry('worms', 'Worms_v1.0_1234', 'amiga', { filename: 'Worms_v1.0_1234.lha', originalName: 'Worms_v1.0_1234.lha', tag: 'WHDLoad' }),
        listEntry('monkey', 'Secret of Monkey Island, The', 'dos')];
    const rows = await matchList('dos | Doom\namiga | Worms | WHDLoad\ndos | The Secret of Monkey Island\ndos | Dmo\ndos | Doom III', entries);
    assert.deepEqual(rows.map(row => row.status), ['matched', 'matched', 'matched', 'missing', 'missing']);
    assert.equal(rows[0].selectedKey, 'doom'); assert.equal(rows[1].selectedKey, 'worms');
    assert.equal(programListReport(rows).counts.missing, 2);
});

test('manual search resolves a missing long title without changing the request and respects platform, paging and disk completeness', async () => {
    const source = await importJSON({ root: 'https://example.org/', bases: [''], items: [
        ['Zool (1992).zip', 0, 'zool.zip'], ['Zool 2.zip', 0, 'zool2.zip'],
        ['Disk Game (Disk 1 of 2).adf', 0, 'one.adf'], ['Disk Game (Disk 2 of 2).adf', 0, 'two.adf'],
        ['Broken (Disk 1 of 2).adf', 0, 'broken.adf']
    ] });
    const foreign = { ...source.entries[0], key: 'dos:zool', platform_id: 'dos' };
    const entries = [...source.entries, foreign, { ...foreign, key: 'unsupported', platform_id: 'unsupported' }];
    const resolveDiskSet = createDiskSetResolver(entries, diskPlatforms);
    const options = { entries, platforms: listPlatforms, platform: 'amiga', resolveDiskSet };
    const rows = await matchList('amiga | Zool: Ninja of the Nth Dimension\namiga | Zool', entries, { resolveDiskSet });
    assert.equal(rows[0].status, 'missing');
    const first = searchProgramCandidates('Zool', { ...options, limit: 1 });
    assert.equal(first.total, 2); assert.equal(first.results.length, 1); assert.equal(first.results[0].platform_id, 'amiga');
    assert.notEqual(searchProgramCandidates('Zool', { ...options, limit: 1, offset: 1 }).results[0].key, first.results[0].key);
    assert.equal(searchProgramCandidates(' ', options).total, 0);
    assert.equal(searchProgramCandidates('absent', options).total, 0);
    assert.equal(searchProgramCandidates('Zool', { ...options, platform: '' }).total, 3);
    const chosen = source.entries[0];
    addProgramSearchCandidate(rows[0], chosen, options); chooseProgramMatch(rows, rows[0].line, chosen.key);
    assert.equal(rows[0].status, 'matched'); assert.equal(rows[0].title, 'Zool: Ninja of the Nth Dimension');
    assert.equal(rows[0].selection.matchedVia, 'search'); assert.equal(rows[1].status, 'duplicate');
    const complete = searchProgramCandidates('Disk Game', options);
    assert.equal(complete.results.length, 1); assert.equal(complete.results[0].disks.length, 2); assert.equal(complete.results[0].ready, true);
    const broken = searchProgramCandidates('Broken', options).results[0]; assert.equal(broken.ready, false);
    const before = rows[0].candidates.length;
    assert.throws(() => addProgramSearchCandidate(rows[0], foreign, options), /requested platform/);
    assert.throws(() => addProgramSearchCandidate(rows[0], source.entries[4], options), /Incomplete disk set/);
    assert.equal(rows[0].candidates.length, before);
});

test('title matching equates canonical Roman/Arabic sequel numbers in either direction', async () => {
    const entries = [listEntry('first', 'Rick Dangerous', 'amiga'),
        listEntry('second', 'Rick Dangerous II', 'amiga', { filename: 'Rick_Dangerous_II_(1990)(Core).zip', originalName: 'Rick_Dangerous_II_(1990)(Core).zip' }),
        listEntry('third', 'Rick Dangerous III', 'amiga')];
    const row = (await matchList('amiga | Rick Dangerous 2', entries))[0];
    assert.equal(row.selectedKey, 'second'); assert.equal(row.selection.matchedVia, 'numeral');
    assert.ok(row.selection.reason.includes('Roman/Arabic'));
    const reverse = await matchList('dos | Example Quest IV', [listEntry('four', 'Example Quest 4'), listEntry('six', 'Example Quest 6')]);
    assert.equal(reverse[0].selectedKey, 'four');
    assert.equal((await matchList('Example Quest 24', [listEntry('roman', 'Example Quest XXIV')]))[0].selectedKey, 'roman');
    assert.equal((await matchList('2 Example Heroes', [listEntry('roman', 'II Example Heroes')]))[0].selectedKey, 'roman');
    assert.equal((await matchList('Example Quest Part 5', [listEntry('roman', 'Example Quest Part V')]))[0].selectedKey, 'roman');
    assert.equal((await matchList('Mega Man 10', [listEntry('x', 'Mega Man X')]))[0].status, 'missing', 'A standalone letter X is not assumed to be a sequel number');
    assert.equal((await matchList('Example Quest 8', [listEntry('invalid', 'Example Quest IIX')]))[0].status, 'missing', 'Non-canonical Roman numerals are not rewritten');
});

test('shortened/expanded titles match generically with metadata and underscores, without per-game aliases', async () => {
    const ruff = listEntry('ruff', 'Ruff and Reddy', 'amiga', { filename: 'Ruff_and_Reddy_(1991)(Hi-Tec)[cr_Krawco].zip', originalName: 'Ruff_and_Reddy_(1991)(Hi-Tec)[cr_Krawco].zip' });
    const row = (await matchList('amiga | Ruff and Reddy in the Space Adventure', [ruff]))[0];
    assert.equal(row.selectedKey, 'ruff'); assert.equal(row.selection.matchedVia, 'shortened');
    assert.ok(row.message.includes('Shortened/expanded'));
    const generic = (await matchList('dos | Amber and Violet in the Hidden Valley', [listEntry('generic', 'Amber and Violet')]))[0];
    assert.equal(generic.selectedKey, 'generic', 'The same rule works for arbitrary titles');
    const reverse = await matchList('Amber and Violet', [listEntry('expanded', 'Amber and Violet: Hidden Valley')]);
    assert.equal(reverse[0].selectedKey, 'expanded');
});

test('short-title fallback preserves sequel numbers, exact titles and competing title families', async () => {
    const exact = listEntry('exact', 'Amber and Violet in the Hidden Valley');
    const base = listEntry('base', 'Amber and Violet');
    const rows = await matchList('Amber and Violet in the Hidden Valley', [base, exact]);
    assert.equal(rows[0].selectedKey, 'exact'); assert.equal(rows[0].selection.matchedVia, 'title');
    assert.equal((await matchList('Amber and Violet 2 in the Hidden Valley', [base]))[0].status, 'missing');
    assert.equal((await matchList('Rick Dangerous 2', [listEntry('first', 'Rick Dangerous')]))[0].status, 'missing');
    assert.equal((await matchList('Amber and Violet in the Hidden Valley', [listEntry('other', 'Amber and Violet in the Open Sea')]))[0].status, 'missing', 'Sharing only an abbreviated prefix does not equate different subtitles');
    const competing = await matchList('Amber and Violet', [listEntry('valley', 'Amber and Violet: Hidden Valley'), listEntry('sea', 'Amber and Violet: Open Sea')]);
    assert.equal(competing[0].status, 'ambiguous'); assert.equal(competing[0].selectedKey, null);
    assert.ok(competing[0].message.includes('different titles'));
    const filename = await matchList('Amber and Violet.zip', [listEntry('expanded', 'Amber and Violet: Hidden Valley')]);
    assert.equal(filename[0].status, 'missing', 'An explicit filename is not replaced with a shortened-title match');
});

test('list matching asks for a platform when needed and honors variant filters or exact filenames', async () => {
    const entries = [listEntry('europe', 'Game', 'nes', { filename: 'Game (Europe).nes', originalName: 'Game (Europe).nes' }),
        listEntry('usa', 'Game', 'nes', { filename: 'Game (USA).nes', originalName: 'Game (USA).nes' }), listEntry('dos', 'Game')];
    const rows = await matchList('Game\nnes | Game | Europe\nnes | Game (USA).nes', entries);
    assert.equal(rows[0].status, 'ambiguous'); assert.equal(rows[0].selectedKey, null);
    assert.equal(rows[1].selectedKey, 'europe'); assert.equal(rows[2].selectedKey, 'usa');
    chooseProgramMatch(rows, 1, 'dos'); assert.equal(rows[0].status, 'matched');
    assert.throws(() => chooseProgramMatch(rows, 1, 'absent'), /Choose a complete/);
});

const release = (key, filename, extra = {}) => listEntry(key, 'Game', 'dos', { filename, originalName: filename, ...extra });
const preferredRelease = async entries => (await matchList('dos | Game', entries))[0];

test('title-only matching automatically prefers regular, unmodified TOSEC releases over flagged alternatives', async () => {
    const clean = release('clean', 'Game v1.0 (1990)(Publisher)(En).zip');
    const entries = [release('bad', 'Game v99.0 (En)[b1][!].zip'), release('demo', 'Game v99.0 (Demo)(En).zip'),
        release('hack', 'Game v99.0 (En)[h].zip'), release('modified', 'Game v99.0 (En)[m].zip'),
        release('trainer', 'Game v99.0 (En)[t+3].zip'), release('alternative', 'Game v99.0 (En)[a1].zip'), clean];
    const row = await preferredRelease(entries);
    assert.equal(row.status, 'matched'); assert.equal(row.selectedKey, 'clean');
    assert.equal(row.selection.method, 'automatic'); assert.equal(row.selection.policy, 'tosec-v1');
    assert.ok(row.selection.reason.startsWith('Automatic TOSEC choice:'));
    assert.equal((await preferredRelease([...entries].reverse())).selectedKey, 'clean');
});

test('TOSEC selection prefers verified dumps, then language and numeric versions/revisions', async () => {
    const verified = await preferredRelease([release('new', 'Game v9.0 (En).zip'), release('verified', 'Game v1.0 (En)[!].zip')]);
    assert.equal(verified.selectedKey, 'verified'); assert.ok(verified.selection.reason.includes('verified'));
    const language = await preferredRelease([release('french', 'Game v99.0 (Fr).zip'), release('unknown', 'Game v99.0.zip'), release('english', 'Game v1.0 (En).zip')]);
    assert.equal(language.selectedKey, 'english');
    assert.equal((await preferredRelease([release('eu', 'Game (Europe).zip'), release('us', 'Game (USA).zip')])).selectedKey, 'us');
    const versions = await preferredRelease([release('older', 'Game v1.9 (En).zip'), release('newer', 'Game v1.10 (En).zip')]);
    assert.equal(versions.selectedKey, 'newer'); assert.ok(versions.selection.reason.includes('1.10'));
    const revisions = await preferredRelease([release('older', 'Game (Rev 2)(En).zip'), release('newer', 'Game (Rev 10)(En).zip')]);
    assert.equal(revisions.selectedKey, 'newer');
    const packages = await preferredRelease([release('shareware', 'Game v9.0 [SW] (1995).zip'),
        release('installer', 'Game v9.0 (Installer) (1995).zip'), release('old', 'Game v1.666 (1994).zip'),
        release('game', 'Game v1.9 (1995).zip')]);
    assert.equal(packages.selectedKey, 'game', 'Full game package with newer declared year beats shareware, installers and older release numbers');
});

test('automatic release choice respects catalog tag priorities and explicit filenames/variant filters', async () => {
    const source = await importCatalog(JSON.stringify({ root: 'https://example.org/', bases: ['dos/', 'windows/'],
        tags: { 1: 'WIN' }, tagPriority: { WIN: 1 }, items: [['Game v1.0.zip', 0, 'game.zip'], ['Game v9.0.zip', 1, 'game.zip']] }),
        { id: 'priorities', platformId: 'dos' });
    assert.equal(source.entries[1].tagPriority, 1);
    const native = await matchList('dos | Game', source.entries);
    assert.equal(native[0].selectedKey, source.entries[0].key);
    const whd = await matchList('amiga | Game', [release('disk', 'Game.zip', { platform_id: 'amiga' }),
        release('whd', 'Game_v1.0.lha', { platform_id: 'amiga', tag: 'WHDLoad' })]);
    assert.equal(whd[0].selectedKey, 'whd');
    const entries = [release('clean', 'Game (En)[!].zip'), release('requested', 'Game (Fr)[b].zip')];
    const exact = await matchList('dos | Game (Fr)[b].zip', entries);
    assert.equal(exact[0].selectedKey, 'requested'); assert.equal(exact[0].selection.method, 'filename');
    assert.equal((await matchList('dos | Game | Fr', entries))[0].selectedKey, 'requested');
});

test('WHDLoad preference changes Amiga release ranking with a fallback and keeps explicit requests authoritative', async () => {
    const entries = [release('disk', 'Game (En)[!].zip', { platform_id: 'amiga' }),
        release('whd', 'Game_v1.0.lha', { platform_id: 'amiga', tag: 'WHDLoad' })];
    assert.equal((await matchList('amiga | Game', entries))[0].selectedKey, 'disk');
    const preferred = (await matchList('amiga | Game', entries, { preferWHDLoad: true }))[0];
    assert.equal(preferred.selectedKey, 'whd'); assert.match(preferred.selection.reason, /Prefer WHDLoad/);
    assert.equal((await matchList('amiga | Game', entries.slice(0, 1), { preferWHDLoad: true }))[0].selectedKey, 'disk');
    assert.equal((await matchList('amiga | Game (En)[!].zip', entries, { preferWHDLoad: true }))[0].selectedKey, 'disk');
    assert.equal((await matchList('amiga | Game | En', entries, { preferWHDLoad: true }))[0].selectedKey, 'disk');
    const dos = entries.map(entry => ({ ...entry, platform_id: 'dos' }));
    assert.equal((await matchList('dos | Game', dos, { preferWHDLoad: true }))[0].selectedKey, 'disk');
    const bad = [{ ...entries[1], filename: 'Game_v1.0[b].lha', originalName: 'Game_v1.0[b].lha' }, entries[0]];
    assert.equal((await matchList('amiga | Game', bad, { preferWHDLoad: true }))[0].selectedKey, 'disk');
    const blocked = [{ ...entries[1], disks: [entries[1]], diskSet: { isComplete: false, total: 2, missing: [2] } }, entries[0]];
    assert.equal((await matchList('amiga | Game', blocked, { preferWHDLoad: true }))[0].selectedKey, 'disk');
});

test('WHDLoad releases can be recognized by their catalog source, filename or URL', async () => {
    for (const metadata of [{ sourceName: 'Amiga WHDLoad' }, { filename: 'Game (WHDLoad).lha', originalName: 'Game (WHDLoad).lha' },
        { url: 'https://example.org/WHDLoad/game.lha' }]) {
        const entries = [release('disk', 'Game (En)[!].zip', { platform_id: 'amiga' }),
            release('whd', 'Game_v1.0.lha', { platform_id: 'amiga', ...metadata })];
        assert.equal((await matchList('amiga | Game', entries, { preferWHDLoad: true }))[0].selectedKey, 'whd');
    }
});

test('release ranking inspects every disk and never prefers an incomplete or uncertain set', async () => {
    const set = (key, secondDisk, diskSet = { isComplete: true, isConfident: true, total: 2 }) => release(key, 'Game.zip', { platform_id: 'amiga', diskSet,
        disks: [1, 2].map(number => ({ key: `${key}:${number}`, platform_id: 'amiga', filename: number === 2 ? secondDisk : 'Game (Disk 1 of 2)[!].adf', url: `https://example.org/${key}/${number}.adf` })) });
    const entries = [set('bad', 'Game (Disk 2 of 2)[b][!].adf'), set('good', 'Game (Disk 2 of 2)[!].adf'),
        set('incomplete', 'Game (Disk 2 of 2)[!].adf', { isComplete: false, isConfident: true, total: 3, missing: [3] }),
        set('uncertain', 'Game (Disk 2 of 2)[!].adf', { isComplete: true, isConfident: false, total: 2 })];
    const row = (await matchList('amiga | Game', entries))[0];
    assert.equal(row.selectedKey, 'good'); assert.equal(row.candidates[0].disks.length, 2);
    assert.equal(row.candidates.find(candidate => candidate.key === 'bad').preference.badDump, 1);
});

test('automatic choice evaluates releases beyond the displayed candidate limit and uses a stable tie break', async () => {
    const entries = Array.from({ length: 601 }, (_, index) => release(`version-${index}`, `Game v1.${index} (En).zip`));
    const row = await preferredRelease(entries);
    assert.equal(row.status, 'matched'); assert.equal(row.selectedKey, 'version-600');
    assert.equal(row.candidateCount, 601); assert.equal(row.candidates.length, 500);
    const ties = [release('z', 'Game (En).zip'), release('a', 'Game (En).zip')];
    assert.equal((await preferredRelease(ties)).selectedKey, (await preferredRelease([...ties].reverse())).selectedKey);
    assert.ok((await preferredRelease(ties)).selection.reason.includes('stable'));
});

test('list matching collapses disk members and identical URLs and rejects incomplete sets', async () => {
    const source = await diskSource(amigaNames);
    const missingSource = await diskSource(['Missing (Disk 1 of 3).adf']);
    missingSource.entries[0].key = 'missing';
    const entries = [...source.entries, ...missingSource.entries];
    const resolveDiskSet = createDiskSetResolver(entries, diskPlatforms);
    const rows = await matchList('amiga | Fixture\namiga | Fixture\namiga | Missing', entries, { resolveDiskSet });
    assert.deepEqual(rows.map(row => row.status), ['matched', 'duplicate', 'blocked']);
    assert.equal(rows[0].candidates.length, 1); assert.equal(rows[0].candidates[0].disks.length, 2);
    assert.equal(rows[1].duplicateOf, 1);
    const repeated = [listEntry('one', 'Doom'), listEntry('copy', 'Doom', 'dos', { url: 'https://example.org/one.zip' })];
    assert.equal((await matchList('Doom', repeated))[0].status, 'matched');
    const atari = await diskSource(['City - Disk 2.atr', 'City - Disk 1.atr'], 'atari800');
    const city = await matchList('a8 | City', atari.entries, { resolveDiskSet: createDiskSetResolver(atari.entries, diskPlatforms) });
    assert.equal(city[0].status, 'matched'); assert.equal(city[0].candidates[0].disks.length, 2);
});

test('list matching has bounded input, aborts promptly and handles large imported catalogs in one pass', async () => {
    assert.throws(() => parseProgramList(Array(2001).fill('Doom').join('\n'), { platforms: listPlatforms }), /2,000/);
    const controller = new AbortController(); controller.abort();
    await assert.rejects(matchList('Doom', [], { signal: controller.signal }), cause => cause.name === 'AbortError');
    const entries = Array.from({ length: 12003 }, (_, index) => listEntry(`game-${index}`, `Game ${index}`));
    const rows = await matchList('Game 0\nGame 5000\nGame 12002\nGame 99999', entries);
    assert.deepEqual(rows.map(row => row.status), ['matched', 'matched', 'matched', 'missing']);
});

test('best-effort file export skips failed games atomically and includes a machine-readable report', async () => {
    const group = selectSet(await diskSource(amigaNames));
    const good = listEntry('good', 'Working game'); const bad = listEntry('bad', 'Unavailable game');
    const result = await buildCollection(collection([group, good, bad]), { mode: 'files', allowMissing: true, report: { requested: 4, counts: { missing: 1 } },
        fetchFile: async url => { if (url === group.disks[1].url || url === bad.url) throw new Error('HTTP 404'); return new Uint8Array([1, 2]); } });
    assert.equal(result.manifest.list.length, 1); assert.equal(result.manifest.list[0].title, good.title);
    assert.equal(result.report.export.failed, 2); assert.equal(result.report.counts.missing, 1);
    const zip = await JSZip.loadAsync(result.bytes);
    assert.ok(zip.file('collection_report.json'));
    assert.equal(Object.keys(zip.files).some(name => name.startsWith('files/0001/')), false, 'No disks from a failed game are left in the ZIP');
    assert.equal(zip.file('images/0001.png'), null);
    assert.equal(JSON.parse(await zip.file('collection_report.json').async('string')).export.exported, 1);
});

test('best-effort export does not swallow cancellation or return an empty collection', async () => {
    const entry = listEntry('bad', 'Bad');
    await assert.rejects(buildCollection(collection([entry]), { mode: 'files', allowMissing: true, fetchFile: async () => { throw new Error('Offline'); } }), cause => {
        assert.equal(cause.report.export.failed, 1); return /No games/.test(cause.message);
    });
    const controller = new AbortController();
    await assert.rejects(buildCollection(collection([entry]), { mode: 'files', allowMissing: true, signal: controller.signal,
        fetchFile: async () => { controller.abort(); throw new Error('Cancelled fetch'); } }), cause => cause.name === 'AbortError');
    const links = await buildCollection(collection([entry]), { allowMissing: true, fetchFile: () => assert.fail('Link export must not download') });
    assert.equal(links.report.export.exported, 1);
    const invalid = { ...entry, key: 'invalid', url: 'javascript:invalid' };
    const partial = await buildCollection(collection([invalid, entry]), { allowMissing: true });
    assert.equal(partial.report.export.failed, 1); assert.equal(partial.manifest.list.length, 1);
});

const importPlatforms = [{ platform_id: 'nes', core: 'nes', dependencies: [] }, { platform_id: 'amiga', core: 'puae', multidisk: true, dependencies: [{ key: 'kickstart' }] }];
const importFixture = async () => {
    const image = new PNG({ width: 2, height: 2 }); image.data.fill(255);
    const zip = new JSZip();
    const manifest = { id: 'import-test', name: 'Import test', image: 'cover.png', list: [
        { title: 'Synthetic game', platform_id: 'nes', filename: 'game.nes', file: 'game.nes', image: 'game.png' }
    ] };
    zip.file('cover.png', PNG.sync.write(image)); zip.file('game.png', PNG.sync.write(image)); zip.file('game.nes', 'SYNTHETIC-PROGRAM-BYTES');
    const pack = () => { zip.file('vme_collection.json', JSON.stringify(manifest)); return bytes(zip); };
    return { zip, manifest, pack };
};
const checkTestImage = async blob => { PNG.sync.read(Buffer.from(await blob.arrayBuffer())); };
const importTest = (input, options = {}) => testCollectionImport(input, { platforms: importPlatforms, checkImage: checkTestImage, ...options });

test('shared VM/E importer prepares all assets and calls storage only after the complete collection succeeds', async () => {
    const fixture = await importFixture(); let stored = 0;
    const result = await importCollectionArchive(await fixture.pack(), { platforms: importPlatforms, checkImage: checkTestImage,
        storage: { checkFiles: async () => [[], [], null], storeCollection: async (id, name, cover, items) => {
            stored++; assert.equal(id, 'import-test'); assert.equal(items.length, 1); assert.equal(await items[0].file.text(), 'SYNTHETIC-PROGRAM-BYTES'); return true;
        } }, network: { fetch: () => assert.fail('Embedded archives do not download links') } });
    assert.equal(stored, 1); assert.equal(result.storedGames, 1);
    const report = await importTest(await fixture.pack());
    assert.equal(report.status, 'passed'); assert.equal(report.storedGames, 1);
    assert.equal(report.scope.storage, 'temporary memory'); assert.equal(report.scope.requirements, 'not checked');
    assert.ok(report.steps.some(step => step.stage === 'storage'));
});

test('import tester pinpoints missing cover, per-game image and program files', async () => {
    for (const [path, stage] of [['cover.png', 'cover'], ['game.png', 'image'], ['game.nes', 'game']]) {
        const fixture = await importFixture(); fixture.zip.remove(path);
        const report = await importTest(await fixture.pack());
        assert.equal(report.status, 'failed'); assert.equal(report.error.stage, stage); assert.equal(report.error.path, path);
        if (stage !== 'cover') { assert.equal(report.error.entryIndex, 1); assert.equal(report.error.title, 'Synthetic game'); assert.equal(report.error.platform_id, 'nes'); }
    }
});

test('import tester reports invalid manifests/platforms and corrupt images rather than accepting unreadable assets', async () => {
    const absent = new JSZip(); absent.file('wrong.json', '{}');
    assert.equal((await importTest(await bytes(absent))).error.stage, 'manifest');
    const malformed = new JSZip(); malformed.file('vme_collection.json', '{bad json');
    assert.equal((await importTest(await bytes(malformed))).error.path, 'vme_collection.json');
    const unsupported = await importFixture(); unsupported.manifest.list[0].platform_id = 'unknown';
    assert.equal((await importTest(await unsupported.pack())).error.stage, 'platform');
    const badImage = await importFixture(); badImage.zip.file('game.png', 'Not an image');
    const report = await importTest(await badImage.pack());
    assert.equal(report.error.stage, 'image'); assert.equal(report.error.path, 'game.png');
    const broken = await importFixture(); broken.zip.file('game.nes', new Uint8Array());
    assert.ok((await importTest(await broken.pack())).error.detail.includes('empty'));
});

test('link-only preflight validates structure without network access or a pretend successful storage commit', async () => {
    const fixture = await importFixture(); delete fixture.manifest.list[0].file; fixture.manifest.list[0].url = 'https://example.org/game.nes';
    const report = await importTest(await fixture.pack(), { fetchFile: () => assert.fail('Preflight must not download programs') });
    assert.equal(report.status, 'partial'); assert.equal(report.pendingLinks.length, 1); assert.equal(report.storedGames, 0);
    assert.equal(report.pendingLinks[0].url, 'https://example.org/game.nes');
    assert.ok(!report.steps.some(step => step.stage === 'storage'));
    fixture.manifest.list[0].url = 'javascript:invalid';
    assert.equal((await importTest(await fixture.pack())).error.stage, 'game');
});

test('full linked import catches HTTP, HTML, network and empty-file errors at the actual game URL', async () => {
    const fixture = await importFixture(); delete fixture.manifest.list[0].file; fixture.manifest.list[0].url = 'https://example.org/game.nes';
    const payload = await fixture.pack();
    const passed = await importTest(payload, { downloadLinks: true, fetchFile: async () => new Response('game') });
    assert.equal(passed.status, 'passed'); assert.equal(passed.storedGames, 1);
    for (const fetchFile of [async () => new Response('missing', { status: 404 }), async () => new Response('<html>error</html>', { headers: { 'Content-Type': 'text/html' } }),
        async () => new Response(''), async () => { throw new TypeError('Failed to fetch (CORS)'); }]) {
        const report = await importTest(payload, { downloadLinks: true, fetchFile });
        assert.equal(report.status, 'failed'); assert.equal(report.error.stage, 'game');
        assert.equal(report.error.url, 'https://example.org/game.nes'); assert.equal(report.error.filename, 'game.nes');
    }
});

test('multi-disk import diagnostics identify missing disk paths and invalid disk ZIP contents', async () => {
    const fixture = await importFixture();
    const item = fixture.manifest.list[0]; item.platform_id = 'amiga'; item.filename = 'game.zip'; delete item.file;
    item.disks = [{ filename: 'one.adf', file: 'one.adf' }, { filename: 'two.zip', file: 'two.zip' }];
    fixture.zip.file('one.adf', 'one');
    let report = await importTest(await fixture.pack());
    assert.equal(report.error.stage, 'disk'); assert.equal(report.error.diskIndex, 2); assert.equal(report.error.path, 'two.zip');
    const inner = new JSZip(); inner.file('one.adf', 'one'); inner.file('two.adf', 'two'); fixture.zip.file('two.zip', await bytes(inner));
    report = await importTest(await fixture.pack());
    assert.equal(report.error.stage, 'bundle'); assert.equal(report.error.diskIndex, 2); assert.equal(report.error.path, 'two.zip');
    assert.ok(report.error.detail.includes('exactly one'));
    item.disks[1] = { filename: 'two.adf', file: 'two.adf' }; fixture.zip.file('two.adf', 'two');
    const valid = await importTest(await fixture.pack());
    assert.equal(valid.status, 'partial');
    assert.equal(valid.preparedGames, 1);
    assert.equal(valid.compatibility.legacyManifest.status, 'unsupported');
});

test('multi-disk manifests never claim compatibility with published importers that require file/url', async () => {
    const fixture = await importFixture();
    fixture.manifest.list.push({ ...fixture.manifest.list[0], title: 'Second game' }, {
        title: 'Turrican', platform_id: 'cpc', filename: 'Turrican.zip', image: 'game.png',
        disks: [{ filename: 'one.dsk', file: 'one.dsk' }, { filename: 'two.dsk', file: 'two.dsk' }]
    });
    fixture.zip.file('one.dsk', 'one'); fixture.zip.file('two.dsk', 'two');
    const platforms = [...importPlatforms, { platform_id: 'cpc', core: 'cap32', multidisk: true }];
    let report = await importTest(await fixture.pack(), { platforms });
    assert.equal(report.status, 'partial'); assert.equal(report.preparedGames, 3);
    assert.equal(report.pendingLinks.length, 0);
    const [issue] = report.compatibility.legacyManifest.issues;
    assert.equal(issue.entryIndex, 3); assert.equal(issue.title, 'Turrican'); assert.equal(issue.platform_id, 'cpc');
    assert.equal(issue.filename, 'Turrican.zip'); assert.equal(issue.stage, 'compatibility');
    assert.match(issue.message, /disks instead of file\/url/);
    assert.match(report.scope.importer, /published VM\/E is not executed/);
    // The earlier importer would reach this exact entry and reject it.
    const firstRejected = fixture.manifest.list.findIndex(item => !item.file && !item.url) + 1;
    assert.equal(issue.entryIndex, firstRejected);
    for (const disk of fixture.manifest.list[2].disks) { disk.url = `https://example.org/${disk.filename}`; delete disk.file; }
    report = await importTest(await fixture.pack(), { platforms });
    assert.equal(report.status, 'partial'); assert.equal(report.pendingLinks.length, 2);
    report = await importTest(await fixture.pack(), { platforms, downloadLinks: true, fetchFile: async () => new Response('disk') });
    assert.equal(report.status, 'partial'); assert.equal(report.pendingLinks.length, 0);
    assert.equal(report.compatibility.legacyManifest.issues[0].entryIndex, 3);
});

test('real importer reports dependency and storage failures separately, without committing a partial collection', async () => {
    const fixture = await importFixture(); const input = await fixture.pack(); let stored = 0;
    await assert.rejects(importCollectionArchive(input, { platforms: importPlatforms, storage: { checkFiles: async () => [[], ['BIOS'], null], storeCollection: async () => { stored++; return true; } } }), cause => cause.context.stage === 'requirements');
    assert.equal(stored, 0);
    await assert.rejects(importCollectionArchive(input, { platforms: importPlatforms, storage: { checkFiles: async () => [[], [], null], storeCollection: async () => { throw new Error('Quota exceeded'); } } }), cause => cause.context.stage === 'storage' && cause.message.includes('Quota exceeded'));
});

test('import tester distinguishes cancellation and CRC failure from a successful import', async () => {
    const fixture = await importFixture(); const controller = new AbortController(); controller.abort();
    assert.equal((await importTest(await fixture.pack(), { signal: controller.signal })).status, 'cancelled');
    const input = Buffer.from(await fixture.pack()); const at = input.indexOf('SYNTHETIC-PROGRAM-BYTES'); assert.ok(at > 0); input[at] ^= 1;
    const report = await importTest(input);
    assert.equal(report.status, 'failed'); assert.equal(report.error.stage, 'archive'); assert.ok(report.error.detail.includes('CRC'));
});
