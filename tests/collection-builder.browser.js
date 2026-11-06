import JSZip from 'jszip';
import { PlatformManager } from '../src/platforms/PlatformManager.js';
import { Nostalgist } from 'nostalgist';

const assert = (value, message) => { if (!value) throw new Error(message); };
const fixtureUrl = new URL('./collection-builder.fixture.txt', import.meta.url).href;

// Run only in an isolated context of the collection builder. Uses its own DB,
// synthetic game bytes and the real VM/E collection importer with stub storage.
export async function runCollectionBuilderTests() {
  const api = window.collectionBuilder; await api.ready;
  assert(api.inspect().sources.length === 0, 'Use a fresh isolated browser context.');
  const zip = new JSZip();
  zip.file('vme_import.json', JSON.stringify({ platforms: { nes: { software: 'nes.json' }, amiga: { software: 'amiga.json' } } }));
  for (const platform of ['nes', 'amiga']) zip.file(`${platform}.json`, JSON.stringify({
    version: 'CORSFILEv1', root: '', bases: [fixtureUrl], tags: { 0: 'Test' }, items: [
      ['Fixture game.nes', 0, '', 0, `${platform} fixture`], ['Other game.nes', 0, '?variant=2']
    ]
  }));
  await api.importFile(new File([await zip.generateAsync({ type: 'uint8array' })], 'fixture_vme_import.zip'));
  assert(api.inspect().entries === 4, 'All source catalogs imported');
  const matches = api.search({ query: 'fixture', platform: 'nes' });
  assert(matches.total === 1, 'Search filters platform and title');
  const first = matches.results[0]; const second = api.search({ query: 'fixture', platform: 'amiga' }).results[0];
  api.add(first.key); api.add(first.key); api.add(second.key);
  assert(api.inspect().selected.length === 2, 'Duplicate selection prevented');
  api.move(second.key, -1);
  api.setMetadata({ id: 'browser-test', name: 'Browser test' });
  const links = await api.export({ mode: 'links' });
  assert(links.manifest.list[0].platform_id === 'amiga', 'Selection order preserved');
  assert(links.manifest.list.every(item => item.url && !item.file), 'Link manifest uses URLs');
  const files = await api.export({ mode: 'files' });
  assert(files.manifest.list.every(item => item.file && !item.url), 'Embedded manifest uses file paths');

  class ImportOnlyManager extends PlatformManager { updatePlatform() {} }
  const imported = [];
  const cliErrors = [];
  const cli = { print() {}, print_progress() {}, message() {}, set_default_handler() {}, guru(error) { cliErrors.push(error.message); } };
  const storage = { checkFiles: async () => [[], [], null], storeCollection: async (id, name, image, items) => { imported.push({ id, name, image, items }); return true; } };
  const manager = new ImportOnlyManager({}, cli, storage, { fetch: url => fetch(url) }, {});
  await manager.loadCollectionFile(new Blob([links.bytes]));
  await manager.loadCollectionFile(new Blob([files.bytes]));
  assert(!cliErrors.length, `VM/E importer errors: ${cliErrors.join(', ')}`);
  assert(imported.length === 2 && imported.every(collection => collection.items.length === 2), 'Real VM/E importer accepts both ZIP modes');
  for (const collection of imported) {
    assert(collection.image.size > 0, 'Cover image present');
    for (const item of collection.items) {
      assert(item.image.size > 0, 'Game image present');
      assert((await item.file.text()).startsWith('Synthetic collection builder'), 'Exact downloaded game bytes imported');
    }
  }
  const cancelled = api.export({ mode: 'files' });
  document.getElementById('cancelOperation').click();
  let aborted = false;
  try { await cancelled; } catch (cause) { aborted = cause.name === 'AbortError'; }
  assert(aborted && document.getElementById('cancelOperation').hidden, 'Export cancellation restores the UI');
  await api.flush();
  return { catalogImport: true, search: true, duplicatePrevention: true, ordering: true,
    linkExport: true, embeddedExport: true, realVmeImporter: true, cancellation: true, persistedDraft: true, games: api.inspect().selected.length };
}

export async function runCollectionMultidiskTests() {
  const api = window.collectionBuilder; await api.ready;
  assert(api.inspect().sources.length === 0, 'Use a fresh isolated browser context.');
  const formats = { amiga: 'adf', atari800: 'atr', st: 'st', cpc: 'dsk', apple2: 'dsk' };
  const zip = new JSZip();
  zip.file('vme_import.json', JSON.stringify({ platforms: Object.fromEntries(Object.keys(formats).map(id => [id, { software: `${id}.json` }])) }));
  for (const [platform, extension] of Object.entries(formats)) zip.file(`${platform}.json`, JSON.stringify({
    root: '', bases: [fixtureUrl], items: [2, 1].map(disk => [`Fixture ${platform} (Disk ${disk} of 2).${extension}`, 0, `?platform=${platform}&disk=${disk}`])
  }));
  await api.importFile(new File([await zip.generateAsync({ type: 'uint8array' })], 'multidisk_vme_import.zip'));
  for (const platform of Object.keys(formats)) {
    const results = api.search({ platform }).results;
    const set = api.diskSet(results[0].key);
    assert(set.total === 2 && set.isComplete && set.isConfident, `${platform}: complete disk set review`);
    api.add(results[0].key); api.add(results[1].key);
  }
  assert(api.inspect().selected.length === 5, 'Adding either disk creates one complete game, with no duplicates');
  assert(document.querySelectorAll('#selection .disk-list li').length === 10, 'Every selected disk is visible outside the edit form');
  api.setMetadata({ id: 'multidisk-test', name: 'Multi-disk test' });
  const links = await api.export({ mode: 'links' });
  const files = await api.export({ mode: 'files' });
  assert([links, files].every(result => result.manifest.list.length === 5 && result.manifest.list.every(item => item.disks.length === 2)), 'Both modes retain five games and ten disks');
  assert(links.manifest.list.every(item => item.disks.every(disk => disk.url && !disk.file)), 'Links use per-disk URLs');
  assert(files.manifest.list.every(item => item.disks.every(disk => disk.file && !disk.url)), 'Files embed every disk');

  class ImportOnlyManager extends PlatformManager { updatePlatform() {} }
  const imported = [], cliErrors = [], requests = [], launches = [];
  const cli = new Proxy({}, { get: (_, key) => key === 'guru' ? cause => cliErrors.push(cause.message) : () => {} });
  const storage = { checkFiles: async () => [[], [], null], getFile: async () => null,
    storeCollection: async (id, name, image, items) => { imported.push({ id, name, image, items }); return true; } };
  const app = { isGamepadLaunch: () => false, getGamepadManager: () => null };
  const manager = new ImportOnlyManager(app, cli, storage, { fetch: url => { requests.push(url); return fetch(url); } }, new Proxy({}, { get: () => () => {} }));
  await manager.loadCollectionFile(new Blob([links.bytes]));
  assert(requests.length === 10, 'VM/E imports every linked disk');
  await manager.loadCollectionFile(new Blob([files.bytes]));
  assert(requests.length === 10, 'Embedded disk sets require no network downloads');
  assert(!cliErrors.length && imported.length === 2, `Real importer accepts both multi-disk formats: ${cliErrors.join(', ')}`);
  const damaged = await JSZip.loadAsync(files.bytes);
  damaged.remove(files.manifest.list[0].disks[1].file);
  await manager.loadCollectionFile(new Blob([await damaged.generateAsync({ type: 'uint8array' })]));
  assert(cliErrors.length === 1 && imported.length === 2, 'A missing disk aborts import before the collection is stored');
  cliErrors.length = 0;

  // Exercise the actual collection launch path up to the emulator boundary.
  // Synthetic fixture bytes deliberately never reach a running core.
  const fixture = document.createElement('div'); fixture.hidden = true;
  fixture.innerHTML = '<div id="cors_query_prefix"></div><div id="cors_query"></div><div id="cors_results"></div>';
  document.body.append(fixture);
  const configure = Nostalgist.configure; Nostalgist.configure = () => {};
  manager.startEmulation = (input, caption, romName) => { launches.push({ input, caption, romName }); };
  try {
    for (const item of imported[1].items) {
      await manager.loadRomFromCollection(item.platform_id, item.file, item.filename, item.title, null);
      const launched = launches.at(-1);
      assert(launched?.input.launchFiles.length === 3, `${item.platform_id}: collection launch includes M3U and both disks`);
      assert(launched.input.selectedNames[0].includes('Disk 1') && launched.input.selectedNames[1].includes('Disk 2'), `${item.platform_id}: disk order is stable`);
      assert((await launched.input.launchFiles[0].fileContent.text()).split('\n').filter(Boolean).length === 2, 'Playlist references both aliases');
    }
  } finally { Nostalgist.configure = configure; fixture.remove(); document.body.style.background = ''; document.documentElement.style.background = ''; }
  assert(launches.length === 5, 'All five multi-disk platforms reach the launch boundary');
  await api.flush();
  return { groupedGames: 5, disks: 10, linkExport: true, embeddedExport: true, realImporter: true,
    realCollectionLaunch: true, platforms: Object.keys(formats), draftPersisted: true };
}

export async function runCollectionArtworkTests() {
  const api = window.collectionBuilder; await api.ready;
  assert(api.inspect().sources.length === 0, 'Use a fresh isolated browser context.');
  const canvas = document.createElement('canvas'); canvas.width = 16; canvas.height = 12;
  const context = canvas.getContext('2d'); context.fillStyle = '#ee2233'; context.fillRect(0, 0, 16, 12);
  const png = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  const originalFetch = window.fetch;
  let imageRequests = [], indexRequests = 0, blockImages = false;
  window.fetch = async (url, options) => {
    if (String(url).includes('cdn.jsdelivr.net/gh/libretro-thumbnails/')) {
      imageRequests.push(String(url));
      if (blockImages) return new Promise((_, reject) => {
        const fail = () => reject(new DOMException('Cancelled', 'AbortError'));
        if (options?.signal?.aborted) fail(); else options?.signal?.addEventListener('abort', fail, { once: true });
      });
      return new Response(png, { headers: { 'Content-Type': 'image/png' } });
    }
    if (String(url).includes('thumbnail-index/amiga.json')) indexRequests++;
    return originalFetch(url, options);
  };
  try {
    const catalog = { root: 'https://example.invalid/', bases: [''], items: [
      ['Worms (1995)(Ocean)(Disk 2 of 2).adf.zip', 0, 'two.zip'],
      ['Worms (1995)(Ocean)(Disk 1 of 2).adf.zip', 0, 'one.zip'],
      ['No Such Game Test 947328.zip', 0, 'unknown.zip']
    ] };
    await api.importFile(new File([JSON.stringify(catalog)], 'images.json'), { platformId: 'amiga' });
    const worms = api.search({ query: 'worms' }).results[0]; const unknown = api.search({ query: '947328' }).results[0];
    api.add(worms.key); api.add(unknown.key);
    const matches = await api.findImages(worms.key);
    assert(matches.map(item => item.layer).join(',') === 'snaps,titles,boxarts', 'Real VM/E Amiga index offers all image types for a disk set');
    await api.downloadImage(worms.key, 'snaps');
    assert(api.inspect().selected[0].attachedImage && api.inspect().selected[0].imageSource.layer === 'snaps', 'Downloaded screenshot becomes the stored game image');
    const summary = await api.downloadMissingImages();
    assert(summary.skipped === 1 && summary.unmatched === 1 && summary.downloaded === 0, 'Bulk preserves existing images and reports unmatched titles');
    assert(indexRequests === 1 && imageRequests.length === 1, 'Index cached; bulk does not redownload existing image');
    const result = await api.export({ mode: 'links' });
    const zip = await JSZip.loadAsync(result.bytes);
    const image = await zip.file(result.manifest.list[0].image).async('blob');
    const bitmap = await createImageBitmap(image);
    assert(bitmap.width === 16 && bitmap.height === 12, 'Links-only ZIP embeds the actual downloaded screenshot, rather than a generated placeholder'); bitmap.close();
    await api.downloadImage(worms.key, 'boxarts');
    assert(api.inspect().selected[0].imageSource.layer === 'boxarts', 'User can explicitly replace a screenshot with a box art');
    const card = [...document.querySelectorAll('#selection > li')][0];
    [...card.querySelectorAll('button')].find(button => button.textContent === 'Remove image').click();
    assert(!api.inspect().selected[0].attachedImage, 'Downloaded image can be removed');
    blockImages = true;
    const running = api.downloadMissingImages();
    document.getElementById('cancelOperation').click();
    const cancelled = await running;
    assert(cancelled.cancelled && document.getElementById('cancelOperation').hidden, 'Cancelling image download restores the UI');
    assert(!api.inspect().selected[0].attachedImage, 'Cancelled image is not committed');
    blockImages = false;
    await api.downloadImage(worms.key, 'titles');
    await api.flush();
    return { realIndex: true, diskSetMatch: true, manualLayerSelection: true, bulkPreservesExisting: true,
      cachedIndex: true, zipContainsDownloadedImage: true, cancellation: true, persistedImage: true };
  } finally { window.fetch = originalFetch; }
}

export async function runCollectionProgramListTests() {
  const api = window.collectionBuilder; await api.ready;
  assert(api.inspect().sources.length === 0, 'Use a fresh isolated browser context.');
  const zip = new JSZip();
  zip.file('vme_import.json', JSON.stringify({ platforms: { nes: { software: 'nes.json' }, amiga: { software: 'amiga.json' } } }));
  zip.file('nes.json', JSON.stringify({ root: '', bases: [fixtureUrl], items: [
    ['Alpha.nes', 0, '?game=alpha'], ['Beta (Europe).nes', 0, '?game=beta-europe'], ['Beta (USA).nes', 0, '?game=beta-usa'], ['Offline.nes', 0, '?game=offline']
  ] }));
  zip.file('amiga.json', JSON.stringify({ root: '', bases: [fixtureUrl], items: [
    ['DiskGame (Disk 2 of 2).adf', 0, '?disk=2'], ['DiskGame (Disk 1 of 2).adf', 0, '?disk=1']
  ] }));
  await api.importFile(new File([await zip.generateAsync({ type: 'uint8array' })], 'list-fixture.zip'));
  const originalFetch = window.fetch; const downloads = [];
  window.fetch = async (url, options) => {
    if (String(url).includes('cdn.jsdelivr.net/gh/libretro-thumbnails/')) return new Response('No synthetic artwork', { status: 404 });
    if (String(url) === '/api/download') {
      const target = JSON.parse(options.body).url; downloads.push(target);
      if (target.includes('offline')) return new Response(JSON.stringify({ error: 'Synthetic HTTP 404' }), { status: 400 });
    }
    return originalFetch(url, options);
  };
  try {
    const quick = await api.buildFromList({ text: 'nes | Alpha\nnes | Missing', mode: 'links', images: true });
    assert(quick.manifest.list.length === 1 && quick.report.counts.missing === 1 && quick.report.images, 'One action can match, look up images and build from a fresh list');
    document.getElementById('clearSelection').click();
    const text = 'nes | Alpha\nnes | Beta\namiga | DiskGame\nnes | Missing\nnes | Offline\nnes | Alpha';
    const report = await api.matchList(text);
    assert(report.counts.matched === 4 && !report.counts.ambiguous && report.counts.missing === 1 && report.counts.duplicate === 1, 'List automatically selects an edition and reports misses and repeated requests');
    assert(downloads.length === 0 && api.inspect().selected.length === 4, 'Matching populates the shared collection without downloading programs');
    const beta = report.rows.find(row => row.title === 'Beta');
    assert(beta.selection.method === 'automatic' && beta.selectedKey, 'Title-only matching automatically chooses a preferred release');
    const automatic = await api.buildFromList({ mode: 'links', images: false });
    assert(automatic.manifest.list.find(item => item.title === 'Beta').filename.includes('USA'), 'Default build exports the preferred release without requiring an edition choice');
    assert(downloads.length === 0, 'Automatic link build does not fetch game payloads');
    api.chooseListMatch(beta.line, beta.candidates.find(candidate => candidate.filename.includes('Europe')).key);
    assert(api.listReport().rows.find(row => row.title === 'Beta').selection.method === 'manual', 'Manual override is recorded');
    api.setMetadata({ id: 'list-test', name: 'Wishlist collection' });
    const result = await api.buildFromList({ mode: 'files', images: false });
    assert(result.manifest.list.length === 3 && result.report.export.failed === 1, 'ZIP contains available games and reports a failed download');
    assert(result.manifest.list.find(item => item.platform_id === 'amiga').disks.length === 2, 'List automation retains the complete disk set');
    assert(downloads.some(url => url.includes('beta-europe')) && !downloads.some(url => url.includes('beta-usa')), 'Only the explicitly chosen edition downloads');
    const output = await JSZip.loadAsync(result.bytes);
    const storedReport = JSON.parse(await output.file('collection_report.json').async('string'));
    assert(storedReport.counts.missing === 1 && storedReport.export.failed === 1, 'Report covers both catalog misses and download failures');
    assert(!output.file('images/0004.png'), 'Failed game leaves no orphan image');

    class ImportOnlyManager extends PlatformManager { updatePlatform() {} }
    const collections = [], errors = [];
    const cli = new Proxy({}, { get: (_, key) => key === 'guru' ? cause => errors.push(cause.message) : () => {} });
    const manager = new ImportOnlyManager({}, cli, { checkFiles: async () => [[], [], null],
      storeCollection: async (id, name, image, items) => { collections.push(items); return true; } }, { fetch: url => fetch(url) }, {});
    await manager.loadCollectionFile(new Blob([result.bytes]));
    assert(!errors.length && collections[0]?.length === 3, 'Real VM/E importer accepts the partial collection with its report');
    const downloaded = downloads.length;
    const links = await api.buildFromList({ mode: 'links', images: false });
    assert(links.manifest.list.length === 4 && downloads.length === downloaded, 'Link automation does not download game data or claim to validate availability');
    const cancelled = api.buildFromList({ mode: 'files', images: false });
    document.getElementById('cancelOperation').click();
    let aborted = false; try { await cancelled; } catch (cause) { aborted = cause.name === 'AbortError'; }
    assert(aborted && document.getElementById('cancelOperation').hidden, 'List build cancellation restores controls without returning a partial ZIP');
    await api.flush();
    return { matching: true, automaticReleaseChoice: true, manualEditionChoice: true, noDuplicateGames: true, completeDiskSets: true,
      partialFileExport: true, reportInZip: true, realVmeImporter: true, linkExport: true, cancellation: true, persistedList: true };
  } finally { window.fetch = originalFetch; }
}

export async function runCollectionTitleMatchingTests() {
  const api = window.collectionBuilder; await api.ready;
  assert(api.inspect().sources.length === 0, 'Use a fresh isolated browser context.');
  const names = ['Rick_Dangerous_II_(1990)(Publisher).zip', 'Rick_Dangerous_(1989)(Publisher).zip',
    'Ruff_and_Reddy_(1991)(Hi-Tec)[cr_Krawco].zip',
    'Amber and Violet - Hidden Valley.zip', 'Amber and Violet - Open Sea.zip'];
  const data = { root: 'https://example.invalid/', bases: [''], items: names.map((name, index) => [name, 0, `${index}.zip`]) };
  await api.importFile(new File([JSON.stringify(data)], 'title-matching.json'), { platformId: 'dos' });
  const report = await api.matchList('dos | Rick Dangerous 2\ndos | Ruff and Reddy in the Space Adventure\ndos | Rick Dangerous 3\ndos | Amber and Violet');
  assert(report.counts.matched === 2 && report.counts.missing === 1 && report.counts.ambiguous === 1, 'Generic matching resolves synonyms and keeps different games separate');
  assert(report.rows[0].selection.matchedVia === 'numeral', 'Roman/Arabic equivalence recorded');
  assert(report.rows[1].selection.matchedVia === 'shortened', 'Expanded/shortened title recorded');
  const result = await api.buildFromList({ mode: 'links', images: false });
  assert(result.manifest.list.length === 2, 'Only resolved games enter the collection');
  assert(result.manifest.list[0].filename === names[0] && result.manifest.list[1].filename === names[2], 'Original filenames and bindings survive synonym matching');
  const zip = await JSZip.loadAsync(result.bytes);
  const embedded = JSON.parse(await zip.file('collection_report.json').async('string'));
  assert(embedded.rows[1].selection.matchedVia === 'shortened', 'Export report explains the match');
  return { romanArabic: true, genericShortenedTitle: true, noGameExceptions: true, sequelIsolation: true,
    ambiguousTitlesPreserved: true, collectionExport: true, matchingReport: true };
}

export async function runCollectionSimplifiedUITests() {
  const api = window.collectionBuilder; await api.ready;
  assert(api.inspect().sources.length === 0, 'Use a fresh isolated browser context.');
  const waitFor = async predicate => {
    for (let attempt = 0; attempt < 300; attempt++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 10)); }
    throw new Error('UI operation did not complete.');
  };
  const change = (id, value) => { const input = document.getElementById(id); input.value = value; input.dispatchEvent(new Event('change', { bubbles: true })); };
  const zip = new JSZip();
  zip.file('vme_import.json', JSON.stringify({ platforms: { nes: { software: 'nes.json' }, dos: { software: 'dos.json' } } }));
  zip.file('nes.json', JSON.stringify({ root: '', bases: [fixtureUrl], tags: { 0: 'TOSEC' }, items: [
    ['Alpha.nes', 0, '?game=alpha'], ['Beta (Europe).nes', 0, '?game=beta-europe'], ['Beta (USA).nes', 0, '?game=beta-usa']
  ] }));
  zip.file('dos.json', JSON.stringify({ root: '', bases: [fixtureUrl], items: [['DOS game.zip', 0, '?game=dos']] }));
  await api.importFile(new File([await zip.generateAsync({ type: 'uint8array' })], 'workspace-fixture.zip'));
  await api.importFile(new File([JSON.stringify({ root: '', bases: [fixtureUrl], tags: { 0: 'Homebrew' }, items: [['Extra.nes', 0, '?game=extra']] })], 'extra-nes.json'), { platformId: 'nes' });
  assert(!document.getElementById('programListMode') && !document.getElementById('programListPlatform'), 'No duplicate platform or export settings');
  change('platformFilter', 'dos');
  assert(document.getElementById('advancedFilters').hidden, 'Redundant catalog/tag controls disappear for one catalog');
  change('platformFilter', 'nes');
  assert(!document.getElementById('advancedFilters').hidden && document.getElementById('catalogFilter').options.length === 3, 'Multiple catalogs remain available under advanced filters');
  document.getElementById('searchTab').click();
  assert(document.getElementById('listInputPane').hidden && !document.getElementById('searchInputPane').hidden, 'Input methods switch with accessible tabs');
  document.getElementById('listTab').click();
  const text = document.getElementById('programListText'); text.value = 'Alpha\nBeta\nMissing'; text.dispatchEvent(new Event('input', { bubbles: true }));
  document.getElementById('matchProgramList').click();
  await waitFor(() => api.listReport().requested === 3 && document.getElementById('cancelOperation').hidden);
  assert(api.inspect().selected.length === 2 && api.listReport().counts.missing === 1, 'Match immediately fills the collection using the shared platform');
  assert(document.querySelectorAll('#selection > li').length === 3 && !document.getElementById('programListResults'), 'Resolved and unresolved requests share one list');
  const beta = api.listReport().rows.find(row => row.title === 'Beta');
  const betaCard = [...document.querySelectorAll('#selection .selected-game')].find(node => node.dataset.key === beta.selectedKey);
  const version = betaCard.querySelector('details[data-key$=":version"]');
  assert(!version.open && !version.querySelector('select').checkVisibility(), 'Version selector stays collapsed until needed');
  const details = betaCard.querySelector('details[data-key$=":edit"]'); details.open = true;
  const description = details.querySelector('textarea'); description.value = 'Keep this description'; description.dispatchEvent(new Event('input', { bubbles: true }));
  const canvas = document.createElement('canvas'); canvas.width = 18; canvas.height = 14;
  canvas.getContext('2d').fillRect(0, 0, 18, 14);
  const png = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  const imageDetails = betaCard.querySelector('details[data-key$=":image"]'); imageDetails.open = true;
  const transfer = new DataTransfer(); transfer.items.add(new File([png], 'custom.png', { type: 'image/png' }));
  const upload = imageDetails.querySelector('input[type=file]'); upload.files = transfer.files; upload.dispatchEvent(new Event('change', { bubbles: true }));
  await waitFor(() => api.inspect().selected.find(entry => entry.key === beta.selectedKey)?.attachedImage);
  const europe = beta.candidates.find(candidate => candidate.filename.includes('Europe'));
  api.chooseListMatch(beta.line, europe.key);
  const edited = api.inspect().selected.find(entry => entry.key === europe.key);
  assert(edited?.attachedImage && edited.description === 'Keep this description', 'Changing release preserves custom artwork and description');
  assert(api.inspect().selected.length === 2, 'Changing a release replaces its game instead of adding a duplicate');
  const extra = api.search({ query: 'Extra', platform: 'nes' }).results[0]; api.add(extra.key);
  await api.matchList('Alpha\nBeta\nMissing', { platform: 'nes' });
  assert(api.inspect().selected.length === 3 && api.inspect().selected.some(entry => entry.key === extra.key), 'Rematching preserves manually added games');
  assert(api.listReport().rows.find(row => row.title === 'Beta').selectedKey === europe.key, 'Rematching retains explicit version choices');
  document.getElementById('includeImages').checked = false; document.getElementById('includeImages').dispatchEvent(new Event('change', { bubbles: true }));
  change('exportMode', 'links'); api.setMetadata({ name: 'Simple UI test', id: 'simple-ui-test' });
  const output = await api.build();
  const item = output.manifest.list.find(entry => entry.filename.includes('Europe'));
  assert(item.description === 'Keep this description' && output.manifest.list.length === 3, 'Single build action exports the edited draft without reapplying source metadata');
  const archive = await JSZip.loadAsync(output.bytes);
  const bitmap = await createImageBitmap(await archive.file(item.image).async('blob'));
  assert(bitmap.width === 18 && bitmap.height === 14, 'Custom image survives the unified build'); bitmap.close();
  api.remove(europe.key);
  assert((await api.build()).manifest.list.length === 2 && api.listReport().counts.excluded === 1, 'Removed requests stay excluded during rebuilding');

  const raw = new File([JSON.stringify({ root: '', bases: [fixtureUrl], items: [['Imported.zip', 0, '?imported']] })], 'needs-platform.json');
  const importing = api.importFiles([raw]);
  await waitFor(() => document.getElementById('importPlatformDialog').open);
  assert(document.getElementById('importPlatformFilename').textContent === raw.name, 'Standalone JSON requests a platform only during import');
  document.getElementById('importPlatform').value = 'dos';
  document.getElementById('importPlatformDialog').querySelector('form').requestSubmit(document.querySelector('#importPlatformDialog button[value=import]'));
  await importing;
  assert(api.search({ query: 'Imported', platform: 'dos' }).total === 1, 'Contextual platform choice is used by the importer');
  const count = api.inspect().sources.length;
  const cancelledImport = api.importFiles([raw]);
  await waitFor(() => document.getElementById('importPlatformDialog').open);
  document.getElementById('importPlatformDialog').close('cancel'); await cancelledImport;
  assert(api.inspect().sources.length === count, 'Cancelling contextual import leaves sources unchanged');
  await api.matchList('Extra', { platform: 'nes' });
  assert(api.inspect().selected.length === 1 && api.inspect().selected[0].title === 'Extra' && !api.inspect().selected[0].description,
    'Changing the requested title never copies edits from the previous game on the same line');
  await api.flush();
  return { sharedPlatform: true, contextualFilters: true, tabs: true, oneCollectionList: true,
    contextualVersionChoice: true, editsSurviveReleaseChange: true, unifiedBuild: true, excludedRequests: true,
    contextualImport: true, importCancellation: true, persistedDraft: true };
}

export async function runMissingRequestSearchTests() {
  const api = window.collectionBuilder; await api.ready;
  assert(api.inspect().sources.length === 0, 'Use a fresh isolated browser context.');
  const data = { root: '', bases: [fixtureUrl, fixtureUrl], tags: { 1: 'WHDLoad' }, items: [
    ['Zool (En)[!].zip', 0, '?zool'], ['Zool_v1.0.lha', 1, '?zool-whd'],
    ...Array.from({ length: 23 }, (_, index) => [`Zool Extra ${index}.zip`, 0, `?extra=${index}`]),
    ['Disk Game (Disk 1 of 2).adf', 0, '?disk=1'], ['Disk Game (Disk 2 of 2).adf', 0, '?disk=2'],
    ['Broken (Disk 1 of 2).adf', 0, '?broken']
  ] };
  await api.importFile(new File([JSON.stringify(data)], 'amiga-search.json'), { platformId: 'amiga' });
  await api.importFile(new File([JSON.stringify({ root: '', bases: [fixtureUrl], items: [['Zool.zip', 0, '?dos']] })], 'dos-search.json'), { platformId: 'dos' });
  const request = 'amiga | Zool: Ninja of the Nth Dimension\namiga | Missing title\namiga | Disk Game Deluxe Edition';
  await api.matchList(request);
  const card = line => document.querySelector(`.unresolved-game[data-line="${line}"]`);
  const find = (line, query) => {
    const node = card(line), input = node.querySelector('.missing-search-form input');
    input.value = query; input.dispatchEvent(new Event('input', { bubbles: true }));
    node.querySelector('form').requestSubmit(); return node;
  };
  assert(card(1).querySelector('input').value === 'Zool: Ninja of the Nth Dimension', 'Missing request has a prefilled editable query');
  let first = find(1, 'Zool');
  assert(first.querySelectorAll('.missing-matches li').length === 20, 'Search results are compact and bounded');
  assert(![...first.querySelectorAll('.missing-matches .filename')].some(node => node.textContent.startsWith('dos')), 'Inline search respects the request platform');
  first.querySelector('.missing-search-pages button').click();
  assert(first.querySelector('.missing-matches [role=status]').textContent.startsWith('21–25'), 'Additional catalog entries remain accessible');
  first.querySelector('.missing-search-pages button').click();
  [...first.querySelectorAll('.missing-matches li')].find(node => node.textContent.includes('Zool_v1.0.lha')).querySelector('button').click();
  assert(!card(1) && api.listReport().rows[0].status === 'matched', 'Use resolves the original missing request immediately');
  assert(api.listReport().rows[0].title === 'Zool: Ninja of the Nth Dimension' && api.listReport().rows[0].selection.matchedVia === 'search', 'Report keeps the original request and manual search provenance');
  assert(api.inspect().selected.length === 1 && api.inspect().selected[0].filename === 'Zool_v1.0.lha', 'Use adds the chosen release to the collection');
  const absent = find(2, 'definitely absent');
  assert(absent.querySelector('.missing-matches [role=status]').textContent.includes('No matches') && !absent.querySelector('.missing-matches li'), 'No results leaves the request unresolved');
  let disks = find(3, 'Broken');
  assert(disks.querySelector('.missing-matches li button').disabled, 'Incomplete disk sets cannot be used');
  disks = find(3, 'Disk Game');
  assert(disks.querySelectorAll('.missing-matches li').length === 1 && disks.querySelector('.missing-matches li').textContent.includes('2 disks'), 'Disk members collapse into one complete result');
  disks.querySelector('.missing-matches li button').click();
  assert(api.inspect().selected.some(entry => entry.disks?.length === 2), 'Use adds the complete disk set');
  await api.matchList();
  assert(api.listReport().counts.matched === 2 && api.listReport().counts.missing === 1 && api.inspect().selected.length === 2, 'Manual search choices survive rematching without duplicate games');
  find(2, 'still absent'); await api.flush();
  return { inlineSearch: true, platformScope: true, pagination: true, useResolvesMissing: true,
    completeDiskSets: true, rematchPreservesChoice: true, originalRequestPreserved: true, savedDraft: true };
}

export async function runCollectionImportTesterTests() {
  const api = window.collectionBuilder; await api.ready;
  assert(api.inspect().sources.length === 0, 'Use a fresh isolated browser context.');
  const waitFor = async predicate => {
    for (let attempt = 0; attempt < 300; attempt++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 10)); }
    throw new Error('Import test did not complete.');
  };
  const dbBefore = (await indexedDB.databases()).map(db => db.name);
  const data = { root: '', bases: [fixtureUrl], items: [['Synthetic.nes', 0, '?tester']] };
  await api.importFile(new File([JSON.stringify(data)], 'tester.json'), { platformId: 'nes' });
  api.add(api.search({ platform: 'nes' }).results[0].key);
  const files = await api.export({ mode: 'files' });
  assert(files.importTest.status === 'passed' && files.importTest.storedGames === 1, 'File export automatically passes the actual shared import pipeline');
  assert(!document.getElementById('importTestPanel').hidden && document.getElementById('importTestStatus').textContent.includes('passed'), 'Result appears next to Build ZIP');
  const originalFetch = window.fetch; let directRequests = 0, proxyRequests = 0, failNetwork = false;
  window.fetch = async (url, options) => {
    if (String(url) === '/api/download') proxyRequests++;
    if (String(url).startsWith(fixtureUrl)) {
      directRequests++;
      if (failNetwork) throw new TypeError('Synthetic CORS/network failure');
    }
    return originalFetch(url, options);
  };
  try {
    const links = await api.export({ mode: 'links' });
    assert(links.importTest.status === 'partial' && directRequests === 0 && proxyRequests === 0, 'Link preflight downloads no program bytes and does not claim a full pass');
    assert(!document.getElementById('testLinkedImport').hidden, 'Full linked test is a contextual action');
    document.getElementById('testLinkedImport').click();
    await waitFor(() => api.importTestReport().status === 'passed' && document.getElementById('cancelOperation').hidden);
    assert(directRequests === 1 && proxyRequests === 0, 'Full test uses the same direct browser requests as VM/E');

    const damaged = await JSZip.loadAsync(files.bytes); damaged.remove(files.manifest.list[0].image);
    const damagedBytes = await damaged.generateAsync({ type: 'uint8array' });
    let report = await api.testImport(damagedBytes, { filename: 'missing-image.zip' });
    assert(report.status === 'failed' && report.error.stage === 'image' && report.error.entryIndex === 1, 'Tester identifies the failing import phase and game');
    assert(report.error.path === files.manifest.list[0].image && document.getElementById('importTestStatus').textContent.includes(report.error.path), 'Exact broken path is visible in the UI');
    class ImportOnlyManager extends PlatformManager { updatePlatform() {} }
    let stored = 0;
    const cli = new Proxy({}, { get: () => () => {} });
    const manager = new ImportOnlyManager({}, cli, { checkFiles: async () => [[], [], null], storeCollection: async () => { stored++; return true; } }, { fetch: originalFetch }, {});
    const actual = await manager.loadCollectionFile(new Blob([damagedBytes]));
    assert(!actual.ok && actual.error.stage === report.error.stage && actual.error.path === report.error.path && stored === 0, 'VM/E reports the identical failure and does not store a partial collection');

    const badImage = await JSZip.loadAsync(files.bytes); badImage.file(files.manifest.list[0].image, 'Not a PNG');
    const badSource = await api.importFile(new File([await badImage.generateAsync({ type: 'uint8array' })], 'bad-image-collection.zip'));
    api.newCollection(); api.add(api.search({}).results.find(entry => entry.sourceId === badSource.id).key);
    let blocked = false;
    try { await api.export({ mode: 'files' }); } catch (cause) { blocked = cause.report?.importTest?.error?.stage === 'image'; }
    assert(blocked && api.importTestReport().status === 'failed', 'Automatic test blocks a newly generated ZIP with unreadable artwork');
    failNetwork = true;
    report = await api.testImport(links.bytes, { filename: 'linked-network-error.zip', downloadLinks: true });
    assert(report.status === 'failed' && report.error.stage === 'game' && report.error.url === links.manifest.list[0].url, 'Network/CORS errors identify the actual linked URL');
    const cancelled = api.testImport(links.bytes, { filename: 'cancelled.zip', downloadLinks: true });
    document.getElementById('cancelOperation').click();
    report = await cancelled;
    assert(report.status === 'cancelled' && document.getElementById('cancelOperation').hidden, 'Tester shares the contextual cancel action');
    const multidisk = await JSZip.loadAsync(files.bytes);
    const manifest = JSON.parse(await multidisk.file('vme_collection.json').async('string'));
    const game = { ...manifest.list[0], title: 'Turrican', platform_id: 'cpc', filename: 'Turrican.zip',
      disks: [{ filename: 'one.dsk', file: 'one.dsk' }, { filename: 'two.dsk', file: 'two.dsk' }] };
    delete game.file;
    manifest.list.push({ ...manifest.list[0], title: 'Second game' }, game);
    multidisk.file('one.dsk', 'one'); multidisk.file('two.dsk', 'two');
    multidisk.file('vme_collection.json', JSON.stringify(manifest));
    const multidiskBytes = await multidisk.generateAsync({ type: 'uint8array' });
    const multiSource = await api.importFile(new File([multidiskBytes], 'multidisk-compatibility.zip'));
    api.newCollection(); api.add(api.search({ platform: 'cpc' }).results.find(entry => entry.sourceId === multiSource.id).key);
    report = await api.testImport(multidiskBytes, { filename: 'multidisk-compatibility.zip' });
    assert(report.status === 'partial' && report.checkedGames === 3 && report.pendingLinks.length === 0, 'Passing local disk preparation does not claim compatibility with older published importers');
    assert(report.compatibility.legacyManifest.issues[0].entryIndex === 3 && document.getElementById('importTestStatus').textContent.includes('Turrican'), 'Compatibility failure identifies the third game in the report and UI');
    assert(document.getElementById('importTestStatus').textContent.includes('Updated VM/E required') && document.getElementById('testLinkedImport').hidden, 'Compatibility warning stays distinct from deferred link downloads');
    assert(document.getElementById('selection').textContent.includes('Needs attention'), 'Affected selected game is marked for review');
    await api.testImport(damagedBytes, { filename: 'missing-image.zip' }); await api.flush();
    const dbAfter = (await indexedDB.databases()).map(db => db.name);
    assert(!dbBefore.includes('VME') && !dbAfter.includes('VME'), 'The tester never opens the actual VM/E database');
    return { automaticFileTest: true, deferredLinks: true, directNetworkTest: true, exactErrorLocation: true,
      realImporterSameFailure: true, badArtifactBlocked: true, cancellation: true, versionCompatibility: true, isolatedStorage: true, persistedReport: true };
  } finally { window.fetch = originalFetch; }
}
