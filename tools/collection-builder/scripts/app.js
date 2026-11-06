import { platforms, loadImportPlatforms } from './platforms.js';
import { importCatalog, searchCatalogs, selectionIdentity, validateCollection, buildCollection, readSourceAsset, suggestId, fold } from './model.js';
import { db } from './storage.js';
import { pngImage, placeholderImage } from './images.js';
import { createDiskSetResolver, selectDiskSet, diskSetLabel } from './disk-sets.js';
import { createArtworkService, artworkLabels } from './artwork.js';
import { matchProgramList, chooseProgramMatch, programListReport, searchProgramCandidates, addProgramSearchCandidate } from './program-list.js';
import { testCollectionImport } from './import-test.js';
import { createListPrompt } from './list-prompt.js';

const $ = id => document.getElementById(id);
const names = new Map(platforms.map(platform => [platform.id, platform.name]));
const supported = new Set(names.keys());
const diskPlatforms = new Set(platforms.filter(platform => platform.multidisk).map(platform => platform.id));
const sources = new Map();
const state = { entries: [], selected: [], name: 'My collection', id: 'my-collection', imageOverride: null, mode: 'files', platform: '', inputMode: 'list', includeImages: true, preferWHDLoad: false, page: 0, importing: false, exporting: false, imagesBusy: false, listBusy: false, testing: false };
let importTestReport = null, lastImportArtifact = null, importTestController;
const batch = { text: '', platform: '', mode: 'files', images: true, replace: false, rows: [], applied: {}, appliedRequests: {}, overrides: {}, excluded: [], dirty: false, lastReport: null, message: '' };
let listController, listDisplayLimit = 100;
let storageAvailable = false, saveTimer, searchTimer, controller, saveQueue = Promise.resolve();
let selectionGeneration = 0, imageUrls = [], coverUrl;
const pageSize = 80;
let resolveDiskSet = () => null;
let imageController;
const imageChoices = new Map(), imageMessages = new Map();
const indexUrls = import.meta.glob('../../../src/thumbnail-index/*.json', { query: '?url', import: 'default', eager: true });
const artworks = createArtworkService({
  platforms,
  async loadIndex(id, { signal }) {
    const url = indexUrls[`../../../src/thumbnail-index/${id}.json`];
    if (!url) return null;
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`Image index unavailable: HTTP ${response.status}`);
    return response.json();
  },
  async fetchImage(url, { signal }) {
    const timeout = AbortSignal.timeout(20000);
    const response = await fetch(url, { credentials: 'omit', signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
    if (!response.ok) throw new Error(`Image download failed: HTTP ${response.status}`);
    return response.blob();
  },
  convertImage: pngImage
});

function element(tag, attributes = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) {
    if (key === 'text') node.textContent = value;
    else if (key === 'class') node.className = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else if (key in node) node[key] = value;
    else node.setAttribute(key, value);
  }
  node.append(...children); return node;
}
function error(message) { $('error').textContent = String(message?.message || message); $('error').hidden = false; }
function clearError() { $('error').hidden = true; }
$('error').addEventListener('click', clearError);

$('copyListPrompt').addEventListener('click', async () => {
  const prompt = createListPrompt(platforms);
  $('copyPromptStatus').textContent = '';
  try {
    await navigator.clipboard.writeText(prompt);
    $('copyPromptStatus').textContent = 'Prompt copied';
    return;
  } catch { /* HTTP contexts or clipboard permissions may require a fallback. */ }
  const previousFocus = document.activeElement;
  const field = element('textarea', { value: prompt, readOnly: true });
  field.style.cssText = 'position:fixed;left:-9999px;top:0';
  document.body.append(field);
  let copied = false;
  try { field.focus({ preventScroll: true }); field.select(); copied = document.execCommand('copy'); }
  catch { /* Offer selectable text when browser clipboard access is blocked. */ }
  finally { field.remove(); previousFocus?.focus({ preventScroll: true }); }
  if (copied) { $('copyPromptStatus').textContent = 'Prompt copied'; return; }
  $('listPromptText').value = prompt;
  $('listPromptDialog').showModal();
  $('listPromptText').focus(); $('listPromptText').select();
});

function snapshot() {
  return { key: 'draft', name: state.name, id: state.id, imageOverride: state.imageOverride,
    uiVersion: 2,
    mode: state.mode, platform: state.platform, inputMode: state.inputMode, includeImages: state.includeImages, preferWHDLoad: state.preferWHDLoad,
    selected: state.selected.map(entry => ({ ...entry })), batch: structuredClone(batch), savedAt: Date.now() };
}
function saveDraft() {
  clearTimeout(saveTimer);
  if (!storageAvailable) return;
  $('saveStatus').textContent = 'Saving…';
  saveTimer = setTimeout(() => {
    const draft = snapshot();
    saveQueue = saveQueue.catch(() => {}).then(() => db.workspace.put(draft)).then(() => { $('saveStatus').textContent = 'Draft saved'; })
      .catch(cause => { $('saveStatus').textContent = 'Draft not saved'; error(`Could not save workspace: ${cause.message}`); });
  }, 250);
}
function rebuildEntries(invalidateList = true) {
  state.entries = [...sources.values()].flatMap(source => source.entries);
  resolveDiskSet = createDiskSetResolver(state.entries, platforms);
  if (invalidateList && batch.rows.length) { batch.rows = []; batch.dirty = !!batch.text.trim(); batch.lastReport = null; batch.message = 'Catalogs changed. Match the list again.'; }
}
function updateSelect(node, options, label) {
  const previous = node.value;
  node.replaceChildren(new Option(label, ''), ...options.map(([value, name]) => new Option(name, value)));
  if (options.some(([value]) => value === previous)) node.value = previous;
}
function renderFilters() {
  const ids = [...new Set(state.entries.map(entry => entry.platform_id))].sort((a, b) => (names.get(a) || a).localeCompare(names.get(b) || b));
  if (state.platform && !ids.includes(state.platform)) ids.push(state.platform);
  updateSelect($('platformFilter'), ids.map(id => [id, names.get(id) || `${id} (not enabled)`]), 'All platforms');
  $('platformFilter').value = state.platform;
  const catalogs = [...sources.values()].flatMap(source => source.catalogs.filter(catalog => !state.platform || !catalog.platform_id || catalog.platform_id === state.platform)
    .map(catalog => [catalog.id, `${source.name} — ${catalog.name}`]));
  updateSelect($('catalogFilter'), catalogs, 'All catalogs');
  const tags = [...new Set(state.entries.filter(entry => (!state.platform || entry.platform_id === state.platform)
    && (!$('catalogFilter').value || entry.catalogId === $('catalogFilter').value)).map(entry => entry.tag).filter(Boolean))].sort();
  updateSelect($('tagFilter'), tags.map(tag => [tag, tag]), 'All tags');
  $('catalogFilterLabel').hidden = catalogs.length < 2;
  $('tagFilterLabel').hidden = tags.length < 2;
  if (catalogs.length < 2) $('catalogFilter').value = '';
  if (tags.length < 2) $('tagFilter').value = '';
  $('advancedFilters').hidden = catalogs.length < 2 && tags.length < 2;
  $('filterHint').textContent = $('catalogFilter').value || $('tagFilter').value ? ' · active' : '';
}
function renderSources() {
  $('sourceCount').textContent = `Imported catalogs (${sources.size}) · ${state.entries.length.toLocaleString()} entries`;
  $('sources').replaceChildren(...[...sources.values()].map(source => {
    const used = state.selected.some(entry => entry.sourceId === source.id || entry.disks?.some(disk => disk.sourceId === source.id));
    const remove = element('button', { text: 'Remove', disabled: used || state.exporting || state.imagesBusy || state.listBusy || state.testing, title: used ? 'Remove this source’s games from the draft first.' : 'Remove catalog', onclick: async () => {
      try {
        if (storageAvailable) await db.sources.delete(source.id);
        sources.delete(source.id); rebuildEntries(); renderSources(); renderFilters(); renderResults(); renderSelection();
      } catch (cause) { error(cause); }
    } });
    const actions = element('div', { class: 'actions' }, [remove]);
    if (source.collection) actions.prepend(element('button', { text: 'Use as draft', disabled: state.exporting || state.imagesBusy || state.listBusy || state.testing, onclick: () => useCollection(source).catch(error) }));
    const label = element('div', { text: `${source.name} · ${source.entries.length.toLocaleString()} entries` });
    if (source.warnings.length) label.append(element('div', { text: `${source.warnings.length} invalid entries skipped`, title: source.warnings.slice(0, 10).join('\n') }));
    return element('div', { class: 'source' }, [label, actions]);
  }));
}
function isSelected(entry) { return state.selected.some(selected => selected.key === entry.key || selectionIdentity(selected) === selectionIdentity(entry)
  || selected.disks?.some(disk => selectionIdentity(disk) === selectionIdentity(entry))); }
function renderResults() {
  const result = searchCatalogs(state.entries, { query: $('query').value, platform: $('platformFilter').value,
    catalog: $('catalogFilter').value, tag: $('tagFilter').value, offset: state.page * pageSize, limit: pageSize });
  if (result.total && state.page * pageSize >= result.total) { state.page = 0; renderResults(); return; }
  $('results').replaceChildren(...result.results.map(entry => {
    const title = element('td', {}, [element('div', { class: 'game-title', text: entry.title }), element('div', { class: 'filename', text: entry.originalName || entry.filename, title: entry.url })]);
    const set = resolveDiskSet(entry);
    if (set) title.append(element('div', { class: `disk-status${set.isComplete === false || set.isConfident === false ? ' warning' : ''}`, text: diskSetLabel(set) }));
    const selected = isSelected(entry);
    return element('tr', {}, [title,
      element('td', { text: entry.platform_id, title: names.get(entry.platform_id) || 'Platform not enabled in VM/E' }),
      element('td', {}, entry.tag ? [element('span', { class: 'tag', text: entry.tag })] : []),
      element('td', {}, [element('button', { text: selected ? 'Added' : set ? 'Add set' : 'Add', disabled: selected || state.exporting || state.imagesBusy || state.listBusy || state.testing, onclick: () => add(entry.key) })])]);
  }));
  if (!result.results.length) $('results').append(element('tr', {}, [element('td', { colSpan: 4, class: 'empty', text: sources.size ? 'No matching games.' : 'Import vme_import.zip, *_vme_collection.zip or a software JSON.' })]));
  $('previousPage').disabled = !state.page;
  $('nextPage').disabled = (state.page + 1) * pageSize >= result.total;
  $('resultCount').textContent = result.total ? `${(state.page * pageSize + 1).toLocaleString()}–${Math.min((state.page + 1) * pageSize, result.total).toLocaleString()} of ${result.total.toLocaleString()}` : '0 results';
}

function renderValidation() {
  const busy = state.exporting || state.importing || state.imagesBusy || state.listBusy || state.testing;
  const pendingList = state.inputMode === 'list' && batch.dirty && !!batch.text.trim() && !!state.entries.length;
  const metadataErrors = validateCollection({ name: state.name, id: state.id, list: state.selected.length ? state.selected : [{}] }, { mode: state.mode, metadataOnly: true });
  $('exportZip').disabled = busy || !!metadataErrors.length || (!state.selected.length && !pendingList);
  $('clearSelection').disabled = busy;
  $('catalogFiles').disabled = !!busy;
  $('platformFilter').disabled = busy;
  $('includeImages').disabled = busy;
  $('preferWHDLoad').disabled = busy;
  $('cancelOperation').hidden = !state.exporting && !state.imagesBusy && !state.listBusy && !state.testing;
  $('validation').hidden = !metadataErrors.length;
  $('validation').replaceChildren(...metadataErrors.map(message => element('li', { text: message })));
  if (metadataErrors.some(message => message.startsWith('Collection ID'))) $('collectionDetails').open = true;
  renderProgramList();
  renderImportTest();
}
function changed() { renderValidation(); saveDraft(); }

async function loadThumbnail(entry, thumbnail, generation, preview = false) {
  const data = await (entry.imageOverride || readSourceAsset(sources, entry, 'image'));
  if (!data || generation !== selectionGeneration) return;
  const url = URL.createObjectURL(data instanceof Blob ? data : new Blob([data]));
  imageUrls.push(url);
  const image = element('img', { class: preview ? 'artwork-preview' : 'thumbnail', src: url, alt: entry.title,
    title: entry.imageSource?.filename || entry.title });
  thumbnail.replaceWith(image);
}
function matchRowFor(entry) {
  return batch.rows.find(row => batch.applied[row.line] === entry.key && !batch.excluded.includes(row.line));
}
function versionControl(row, busy) {
  const options = row.candidates.slice(0, 100);
  const current = row.candidates.find(item => item.key === row.selectedKey);
  if (current && !options.some(item => item.key === current.key)) options.push(current);
  const select = element('select', { disabled: busy || !options.some(item => item.ready), 'aria-label': `Version for ${row.title}`, onchange: event => {
    try { chooseListVersion(row.line, event.target.value); } catch (cause) { error(cause); }
  } }, [new Option('Choose a version…', ''), ...options.map(item => {
    const option = new Option(`${item.platform_id} · ${item.filename}${item.tag ? ` · ${item.tag}` : ''} · ${item.source}${item.disks.length ? ` · ${item.disks.length} disks` : ''}${item.issue ? ` · ${item.issue}` : ''}`, item.key);
    option.disabled = !item.ready; return option;
  })]);
  select.value = row.selectedKey || '';
  return select;
}
function missingSearchControl(row, busy) {
  const search = row.catalogSearch ||= { query: row.title, submittedQuery: '', offset: 0, total: 0, results: [] };
  const input = element('input', { type: 'text', value: search.query, disabled: busy, 'aria-label': `Search catalogs for ${row.title}`,
    oninput: event => { search.query = event.target.value; saveDraft(); } });
  const matches = element('div', { class: 'missing-matches' });
  const renderMatches = () => {
    if (!search.submittedQuery) { matches.replaceChildren(); return; }
    const count = element('p', { class: 'match-reason', role: 'status', text: search.total
      ? `${search.offset + 1}–${Math.min(search.offset + 20, search.total)} of ${search.total} catalog entries · ${search.submittedQuery}`
      : `No matches for “${search.submittedQuery}”.` });
    const list = element('ul', {}, search.results.map(candidate => element('li', {}, [
      element('div', { class: 'missing-match-info' }, [element('strong', { text: candidate.title }),
        element('div', { class: 'filename', text: `${candidate.platform_id} · ${candidate.filename}${candidate.tag ? ` · ${candidate.tag}` : ''} · ${candidate.source}${candidate.disks.length ? ` · ${candidate.disks.length} disks` : ''}` }),
        ...(candidate.issue ? [element('div', { class: 'warning', text: candidate.issue })] : [])]),
      element('button', { text: 'Use', disabled: busy || !candidate.ready, 'aria-label': `Use ${candidate.filename}`, onclick: () => {
        try { useRequestSearchMatch(row.line, candidate.key); } catch (cause) { error(cause); }
      } })
    ])));
    const pages = element('div', { class: 'missing-search-pages' });
    if (search.offset) pages.append(element('button', { text: 'Previous', disabled: busy, onclick: () => find(search.submittedQuery, Math.max(0, search.offset - 20)) }));
    if (search.offset + 20 < search.total) pages.append(element('button', { text: 'Next', disabled: busy, onclick: () => find(search.submittedQuery, search.offset + 20) }));
    matches.replaceChildren(count, list, pages);
  };
  const find = (query, offset = 0) => {
    if (busy) return;
    const result = searchProgramCandidates(query, { entries: state.entries, platforms, platform: row.platform_id, resolveDiskSet, preferWHDLoad: state.preferWHDLoad, offset });
    Object.assign(search, { submittedQuery: query.trim(), offset, ...result });
    batch.lastReport = null; renderMatches(); changed();
  };
  const form = element('form', { class: 'missing-search-form', onsubmit: event => {
    event.preventDefault(); find(input.value);
  } }, [input, element('button', { type: 'submit', text: 'Find', disabled: busy })]);
  renderMatches();
  return element('div', { class: 'missing-search' }, [form, matches]);
}
function renderSelection() {
  const busy = state.exporting || state.imagesBusy || state.listBusy || state.testing || state.importing;
  const open = new Set([...$('selection').querySelectorAll('details[open]')].map(node => node.dataset.key));
  const generation = ++selectionGeneration;
  imageUrls.forEach(url => URL.revokeObjectURL(url)); imageUrls = [];
  const unresolved = batch.rows.filter(row => !['matched', 'duplicate'].includes(row.status) && !batch.excluded.includes(row.line));
  $('selectionCount').textContent = `${state.selected.length} ${state.selected.length === 1 ? 'game' : 'games'}`;
  $('selectionSize').textContent = unresolved.length ? `${unresolved.length} unresolved` : '';
  $('emptySelection').hidden = !!state.selected.length || !!unresolved.length;
  const failures = new Map((batch.lastReport?.export?.failures || []).map(item => [item.key, item.message]));
  const cards = state.selected.slice(0, listDisplayLimit).map((entry, index) => {
    const row = matchRowFor(entry);
    const thumbnail = element('div', { class: 'thumbnail', text: entry.platform_id.toUpperCase() });
    loadThumbnail(entry, thumbnail, generation).catch(() => {});
    const heading = element('strong', { text: entry.title });
    const entryErrors = validateCollection({ name: 'Review', id: 'review', list: [entry] }, { mode: state.mode, platforms: supported, diskPlatforms });
    const compatibilityProblem = importTestReport?.compatibility?.legacyManifest?.issues.find(issue => issue.filename === entry.filename && issue.platform_id === entry.platform_id);
    const importProblem = importTestReport?.status === 'failed' && importTestReport.error?.filename === entry.filename
      && importTestReport.error.platform_id === entry.platform_id ? importTestReport.error.message : compatibilityProblem?.message || '';
    const problem = importProblem || failures.get(entry.key) || entryErrors.join(' ');
    const meta = element('div', { class: 'game-meta' }, [element('span', { text: names.get(entry.platform_id) || entry.platform_id }),
      element('span', { class: problem ? 'warning' : 'status', text: problem ? 'Needs attention' : 'Ready' }),
      ...(entry.disks ? [element('span', { class: 'disk-status', text: `${entry.disks.length} disks` })] : [])]);
    const actions = element('div', { class: 'selected-actions' }, [
      element('button', { text: '↑', title: 'Move up', disabled: index === 0 || busy, onclick: () => move(entry.key, -1) }),
      element('button', { text: '↓', title: 'Move down', disabled: index === state.selected.length - 1 || busy, onclick: () => move(entry.key, 1) }),
      element('button', { text: '×', title: 'Remove game', disabled: busy, onclick: () => remove(entry.key) })]);
    const top = element('div', { class: 'selected-heading' }, [thumbnail, element('div', { class: 'game-text' }, [heading, meta]), actions]);
    const versionFields = element('div', { class: 'detail-content' }, [
      element('div', { class: 'filename', text: entry.originalName || entry.filename }),
      ...(row ? [versionControl(row, busy), element('p', { class: 'match-reason', text: row.message })] : []),
      ...(problem ? [element('p', { class: 'warning', text: problem })] : [])]);
    if (entry.disks) versionFields.append(element('div', { class: 'disk-status', text: diskSetLabel({ disks: entry.disks, ...entry.diskSet }) }),
      element('ol', { class: 'disk-list' }, entry.disks.map(disk => element('li', { text: disk.filename, title: disk.url }))));
    const version = element('details', { open: open.has(`${entry.key}:version`) || !!importProblem }, [element('summary', { text: row ? 'Change version' : 'Version / files' }), versionFields]);
    version.dataset.key = `${entry.key}:version`;

    const fields = element('div', { class: 'detail-content entry-fields' });
    for (const [key, title] of [['title', 'Title'], ['filename', 'Filename'], ['url', 'Source URL'], ['credits', 'Credits'], ['description', 'Description']]) {
      if (entry.disks && key === 'url') continue;
      const input = element(key === 'description' ? 'textarea' : 'input', { value: entry[key] || '', disabled: busy, oninput: event => {
        entry[key] = event.target.value; heading.textContent = entry.title; changed();
      } });
      fields.append(element('label', { text: title }, [input]));
    }
    if (!entry.disks) {
      const media = element('input', { type: 'file', disabled: busy, onchange: event => {
        const file = event.target.files[0]; if (!file) return;
        entry.fileOverride = file; entry.filename = file.name; renderSelection(); changed();
      } });
      fields.append(element('label', { text: entry.fileOverride ? `Attached: ${entry.fileOverride.name}` : entry.filePath ? 'Game file (included in source)' : 'Attach game file' }, [media]));
    }
    if (entry.disks) fields.append(...entry.disks.map((disk, diskIndex) => {
      const url = element('input', { type: 'url', value: disk.url || '', disabled: busy, oninput: event => { disk.url = event.target.value; changed(); } });
      const file = element('input', { type: 'file', disabled: busy, onchange: event => {
        const attached = event.target.files[0]; if (!attached) return;
        disk.fileOverride = attached; disk.filename = attached.name; renderSelection(); changed();
      } });
      return element('div', { class: 'disk-fields' }, [element('strong', { text: `Disk ${diskIndex + 1}: ${disk.filename}` }),
        element('label', { text: 'Source URL' }, [url]),
        element('label', { text: disk.fileOverride ? `Attached: ${disk.fileOverride.name}` : disk.filePath ? 'Disk file (included in source)' : 'Attach disk file' }, [file])]);
    }));
    const details = element('details', { open: open.has(`${entry.key}:edit`) }, [element('summary', { text: 'Edit details' }), fields]);
    details.dataset.key = `${entry.key}:edit`;

    const imageActions = element('div', { class: 'image-actions' }, [element('button', { text: 'Find images', disabled: busy || !artworks.supported(entry), onclick: () => findImages(entry.key).catch(error) })]);
    for (const candidate of imageChoices.get(entry.key) || []) imageActions.append(element('button', { text: artworkLabels[candidate.layer], title: candidate.filename, disabled: busy,
      onclick: () => downloadImage(entry.key, candidate.layer).catch(error) }));
    if (entry.imageOverride) imageActions.append(element('button', { text: entry.imagePath ? 'Use imported image' : 'Remove image', disabled: busy,
      onclick: () => { delete entry.imageOverride; delete entry.imageSource; renderSelection(); changed(); } }));
    const source = entry.imageSource;
    const imageInfo = source?.url ? element('a', { href: source.url, target: '_blank', rel: 'noopener noreferrer', class: 'image-info', text: `${artworkLabels[source.layer]} · ${source.filename}` })
      : element('div', { class: 'image-info', text: source?.filename ? `Uploaded · ${source.filename}` : entry.imagePath ? 'Image included in source' : imageMessages.get(entry.key) || '' });
    const imageInput = element('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif', disabled: busy, onchange: async event => {
      const file = event.target.files[0]; if (!file) return;
      try { entry.imageOverride = await pngImage(file); entry.imageSource = { provider: 'upload', filename: file.name }; renderSelection(); changed(); } catch (cause) { error(cause); }
    } });
    const preview = element('div'); loadThumbnail(entry, preview, generation, true).catch(() => {});
    const imageDetails = element('details', { open: open.has(`${entry.key}:image`) }, [element('summary', { text: 'Image' }),
      element('div', { class: 'detail-content' }, [preview, imageActions, imageInfo, element('label', { text: 'Upload image' }, [imageInput])])]);
    imageDetails.dataset.key = `${entry.key}:image`;
    return element('li', { class: 'selected-game', 'data-key': entry.key }, [top, element('div', { class: 'game-details' }, [version, imageDetails, details])]);
  });
  const remaining = Math.max(0, listDisplayLimit - cards.length);
  cards.push(...unresolved.slice(0, remaining).map(row => {
    const remove = element('button', { text: '×', title: 'Remove request', disabled: busy, onclick: () => { batch.excluded.push(row.line); renderSelection(); changed(); } });
    const content = element('div', { class: 'detail-content' }, [versionControl(row, busy), element('p', { class: 'match-reason', text: row.message })]);
    const details = element('details', { open: open.has(`request:${row.line}`) }, [element('summary', { text: row.candidates.some(item => item.ready) ? 'Choose a match' : 'Details' }), content]);
    details.dataset.key = `request:${row.line}`;
    return element('li', { class: 'unresolved-game', 'data-line': row.line }, [element('div', { class: 'selected-heading' }, [
      element('div', { class: 'game-text' }, [element('strong', { text: row.title || row.input }), element('div', { class: 'game-meta' }, [element('span', { text: row.platform_id || row.platform || 'Any platform' }), element('span', { class: 'warning', text: row.status })])]), remove]),
      ...(row.status === 'missing' ? [missingSearchControl(row, busy)] : []), details]);
  }));
  $('selection').replaceChildren(...cards);
  const count = state.selected.length + unresolved.length;
  $('showMoreGames').hidden = count <= listDisplayLimit;
  $('showMoreGames').textContent = `Show more (${count - listDisplayLimit} remaining)`;
  renderValidation();
}
function add(key) {
  const entry = state.entries.find(entry => entry.key === key);
  if (!entry) throw new Error('Game not found in imported catalogs.');
  if (!isSelected(entry)) state.selected.push(selectDiskSet(entry, resolveDiskSet));
  renderSelection(); renderSources(); renderResults(); changed();
}
function remove(key) {
  for (const [line, appliedKey] of Object.entries(batch.applied)) if (appliedKey === key) batch.excluded.push(Number(line));
  state.selected = state.selected.filter(entry => entry.key !== key); renderSelection(); renderSources(); renderResults(); changed();
}
function move(key, direction) {
  const index = state.selected.findIndex(entry => entry.key === key); const next = index + direction;
  if (index < 0 || next < 0 || next >= state.selected.length) return;
  [state.selected[index], state.selected[next]] = [state.selected[next], state.selected[index]];
  renderSelection(); changed();
}
function syncMetadata() {
  $('collectionName').value = state.name; $('collectionId').value = state.id; $('exportMode').value = state.mode;
  $('includeImages').checked = state.includeImages;
  $('preferWHDLoad').checked = state.preferWHDLoad;
  if (coverUrl) URL.revokeObjectURL(coverUrl);
  coverUrl = state.imageOverride ? URL.createObjectURL(state.imageOverride) : null;
  $('coverPreview').hidden = !coverUrl;
  if (coverUrl) $('coverPreview').src = coverUrl; else $('coverPreview').removeAttribute('src');
}
async function useCollection(source) {
  if (state.exporting || state.testing) return;
  importTestReport = null; lastImportArtifact = null;
  state.name = source.collection.name; state.id = source.collection.id || suggestId(state.name);
  Object.assign(batch, { text: '', rows: [], applied: {}, appliedRequests: {}, overrides: {}, excluded: [], dirty: false, lastReport: null, message: '' });
  state.selected = [];
  for (const entry of source.entries) if (!isSelected(entry)) state.selected.push(selectDiskSet(entry, resolveDiskSet));
  state.mode = state.selected.every(entry => (entry.disks || [entry]).every(disk => disk.url)) ? 'links' : 'files';
  state.imageOverride = null;
  if (source.collection.imagePath) {
    const bytes = source.zip?.file(source.collection.imagePath) && await source.zip.file(source.collection.imagePath).async('uint8array');
    if (bytes) state.imageOverride = await pngImage(new Blob([bytes]));
  }
  syncMetadata(); syncProgramList(); renderSelection(); renderSources(); renderResults(); changed();
}

async function importFile(file, { platformId = '' } = {}) {
  const id = globalThis.crypto?.randomUUID?.() || `source-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const source = await importCatalog(file, { id, name: file.name || 'Imported catalog', platformId,
    onProgress: progress => { $('importStatus').textContent = `Reading ${progress.source} · ${progress.count.toLocaleString()} entries…`; } });
  if (storageAvailable) {
    try { await db.sources.put({ id, name: source.name, platformId, blob: file }); }
    catch (cause) { storageAvailable = false; $('saveStatus').textContent = 'Session only'; error(`Catalog loaded, but could not be saved: ${cause.message}`); }
  }
  sources.set(id, source); rebuildEntries(); renderFilters(); renderSources(); renderResults(); renderSelection();
  $('importStatus').textContent = `Imported ${source.name} · ${source.entries.length.toLocaleString()} entries${source.warnings.length ? ` · ${source.warnings.length} skipped` : ''}`;
  return { id, entries: source.entries.length, warnings: source.warnings };
}
async function downloadFile(url, { signal, entry }) {
  const response = await fetch('/api/download', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }), signal });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error(`${entry.title}: ${detail.error}`);
  }
  return response.arrayBuffer();
}
async function exportCollection({ mode = state.mode, allowMissing = false, report } = {}) {
  if (state.testing) throw new Error('Wait for the import test to finish or cancel it.');
  if (state.imagesBusy) throw new Error('Wait for image downloads to finish or cancel them.');
  if (state.exporting) throw new Error('An export is already running.');
  clearError(); controller = new AbortController(); state.exporting = true;
  $('exportProgress').hidden = false; $('exportProgress').value = 0;
  for (const id of ['collectionName', 'collectionId', 'collectionCover', 'exportMode', 'catalogFiles']) $(id).disabled = true;
  renderSelection(); renderSources(); renderResults();
  const draft = { id: state.id, name: state.name, imageOverride: state.imageOverride, list: state.selected.map(entry => ({ ...entry })) };
  try {
    const result = await buildCollection(draft, { mode, sources, fetchFile: downloadFile, makeImage: placeholderImage, platforms: supported, diskPlatforms, allowMissing, report,
      signal: controller.signal, onProgress: progress => {
        if (progress.stage === 'media') {
          $('exportStatus').textContent = `${mode === 'files' ? 'Preparing files' : 'Preparing links'} ${progress.index}/${progress.total} · ${progress.title}`;
          $('exportProgress').value = (progress.index - 1) / progress.total * 80;
        } else { $('exportStatus').textContent = `Building ZIP · ${Math.round(progress.percent)}%`; $('exportProgress').value = 80 + progress.percent * 0.2; }
      } });
    lastImportArtifact = result;
    const importTest = await runImportTest(result.bytes, { filename: result.filename, automatic: true, signal: controller.signal });
    result.importTest = importTest;
    result.report = { ...(result.report || { ...workspaceReport(), export: { mode, requested: draft.list.length,
      exported: result.manifest.list.length, failed: 0, failures: [] } }), importTest };
    batch.lastReport = result.report;
    if (importTest.status === 'cancelled') throw new DOMException('Import test cancelled.', 'AbortError');
    if (importTest.status === 'failed') {
      const cause = new Error(importTest.error.message); cause.report = result.report; throw cause;
    }
    $('exportProgress').value = 100;
    $('exportStatus').textContent = `${result.filename} · ${result.manifest.list.length} games · ${(result.bytes.length / 1024 / 1024).toFixed(2)} MB${result.report?.export.failed ? ` · ${result.report.export.failed} failed (see report)` : ''}`;
    return result;
  } catch (cause) {
    if (cause.report) batch.lastReport = cause.report;
    $('exportStatus').textContent = controller.signal.aborted ? 'Export cancelled.' : 'Export failed.';
    throw cause;
  } finally {
    state.exporting = false;
    for (const id of ['collectionName', 'collectionId', 'collectionCover', 'exportMode', 'catalogFiles']) $(id).disabled = false;
    renderSelection(); renderSources(); renderResults();
  }
}

function renderProgramList() {
  const busy = state.exporting || state.imagesBusy || state.importing || state.listBusy || state.testing;
  $('programListText').disabled = busy;
  $('matchProgramList').disabled = busy || !batch.text.trim() || !state.entries.length;
  $('downloadProgramReport').hidden = !batch.rows.length && !batch.lastReport;
  $('downloadProgramReport').disabled = busy;
  const report = workspaceReport();
  $('programListStatus').textContent = batch.message || (batch.rows.length
    ? `${report.counts.matched || 0} matched · ${report.counts.ambiguous || 0} need a choice · ${report.counts.missing || 0} missing${report.counts.blocked ? ` · ${report.counts.blocked} incomplete` : ''}${report.counts.invalid ? ` · ${report.counts.invalid} invalid` : ''}`
    : '');
}
const importStageNames = { archive: 'ZIP archive', manifest: 'Manifest', cover: 'Collection image', entry: 'Game entry',
  platform: 'Platform', requirements: 'Requirements', image: 'Game image', game: 'Game file', disk: 'Disk file', bundle: 'Disk set / M3U', storage: 'Import result', compatibility: 'VM/E compatibility', complete: 'Complete' };
function renderImportTest() {
  $('importTestPanel').hidden = !importTestReport;
  if (!importTestReport) return;
  const report = importTestReport;
  const compatibilityIssues = report.compatibility?.legacyManifest?.issues || [];
  const pendingLinks = report.pendingLinks || [];
  const outdated = report.version !== 2 && ['passed', 'partial'].includes(report.status);
  $('importTestPanel').dataset.status = outdated ? 'partial' : report.status;
  $('importTestFilename').textContent = report.filename;
  $('importTestStatus').textContent = outdated ? 'Previous test · rebuild to check VM/E compatibility'
    : compatibilityIssues.length ? `Updated VM/E required · ${compatibilityIssues[0].title} (${compatibilityIssues[0].platform_id})`
    : report.status === 'passed' ? `Current-source archive check passed · ${report.checkedGames} games`
    : report.status === 'partial' ? `Archive checked · ${pendingLinks.length} linked files untested`
    : report.status === 'failed' ? report.error.message : report.status === 'cancelled' ? 'Import test cancelled.' : 'Testing with the VM/E importer…';
  $('importTestHint').textContent = [compatibilityIssues[0]?.message,
    pendingLinks.length ? lastImportArtifact ? 'The full import test downloads linked programs.' : 'Rebuild this ZIP to run the full linked import test.' : '',
    !outdated && ['passed', 'partial'].includes(report.status) ? 'Tested against current working sources. The published VM/E version, installed BIOS and database writes are not verified.' : ''].filter(Boolean).join(' ');
  $('testLinkedImport').hidden = report.status !== 'partial' || !pendingLinks.length || !lastImportArtifact || outdated;
  $('testLinkedImport').disabled = state.testing || state.exporting || state.listBusy || state.imagesBusy || state.importing;
  $('importTestSteps').replaceChildren(...[...(report.steps || []), ...compatibilityIssues].map(step => element('li', { text: [importStageNames[step.stage] || step.stage,
    step.entryIndex ? `${step.entryIndex}/${step.total} · ${step.title}` : '', step.diskIndex ? `disk ${step.diskIndex}` : '', step.message || step.path || step.url || ''].filter(Boolean).join(' · ') })));
}
async function runImportTest(input = lastImportArtifact?.bytes, { filename = lastImportArtifact?.filename || 'collection.zip', downloadLinks = false, automatic = false, signal } = {}) {
  if (!input) throw new Error('Build a ZIP first.');
  if (state.testing || (!automatic && (state.exporting || state.imagesBusy || state.importing || state.listBusy))) throw new Error('Wait for the current operation to finish.');
  importTestController = new AbortController();
  const testSignal = signal ? AbortSignal.any([signal, importTestController.signal]) : importTestController.signal;
  importTestReport = { filename, status: 'running', steps: [] }; state.testing = true;
  renderSelection(); renderSources(); renderResults();
  try {
    const livePlatforms = await loadImportPlatforms();
    importTestReport = await testCollectionImport(input, { filename, platforms: livePlatforms, signal: testSignal, downloadLinks,
      // Collection imports use NetworkManager.fetch(url, false): direct CORS
      // requests. The export downloader proxy would hide import-time failures.
      fetchFile: (url, options) => fetch(url, { signal: AbortSignal.any([options.signal, AbortSignal.timeout(180000)]) }),
      onProgress: position => { $('importTestStatus').textContent = `${importStageNames[position.stage] || position.stage}${position.title ? ` · ${position.title}` : ''}${position.diskIndex ? ` · disk ${position.diskIndex}` : ''}`; }
    });
  } catch (cause) {
    importTestReport = { version: 1, filename, status: testSignal.aborted ? 'cancelled' : 'failed', steps: [], error: { stage: 'tester', message: cause.message } };
  } finally {
    state.testing = false;
    batch.lastReport = { ...(batch.lastReport || workspaceReport()), importTest: importTestReport };
    renderSelection(); renderSources(); renderResults(); saveDraft();
  }
  return importTestReport;
}
function syncProgramList() {
  $('programListText').value = batch.text;
  $('platformFilter').value = state.platform;
  $('includeImages').checked = state.includeImages;
  setInputMode(state.inputMode, false);
}
function workspaceReport() {
  const rows = batch.rows.map(row => batch.excluded.includes(row.line) ? { ...row, status: 'excluded', message: 'Removed from collection.' } : row);
  return programListReport(rows, { preferWHDLoad: state.preferWHDLoad });
}
function requestIdentity(row) { return JSON.stringify([row.platform_id, fold(row.title), fold(row.variant)]); }
function setInputMode(mode, persist = true) {
  state.inputMode = mode === 'search' ? 'search' : 'list';
  for (const [name, tab, pane] of [['list', 'listTab', 'listInputPane'], ['search', 'searchTab', 'searchInputPane']]) {
    const active = state.inputMode === name;
    $(tab).setAttribute('aria-selected', String(active)); $(tab).tabIndex = active ? 0 : -1; $(pane).hidden = !active;
  }
  if (persist) { renderValidation(); saveDraft(); }
}
async function listJob(action) {
  if (state.exporting || state.imagesBusy || state.importing || state.listBusy || state.testing) throw new Error('Wait for the current operation to finish.');
  clearError(); listController = new AbortController(); state.listBusy = true;
  renderSelection(); renderSources(); renderResults();
  try { return await action(listController.signal); }
  catch (cause) {
    if (cause.report) batch.lastReport = cause.report;
    batch.message = listController.signal.aborted ? 'List operation cancelled. No ZIP was downloaded.' : cause.message;
    throw cause;
  } finally { state.listBusy = false; renderSelection(); renderSources(); renderResults(); changed(); }
}
async function performListMatch(text, { platform = batch.platform, preferWHDLoad = state.preferWHDLoad, signal } = {}) {
  state.preferWHDLoad = !!preferWHDLoad; $('preferWHDLoad').checked = state.preferWHDLoad;
  batch.text = String(text); batch.platform = platform; batch.rows = []; batch.excluded = []; batch.lastReport = null; listDisplayLimit = 100;
  if (!platform || supported.has(platform)) { state.platform = platform; renderFilters(); }
  syncProgramList();
  batch.rows = await matchProgramList(batch.text, { entries: state.entries, platforms, platform, resolveDiskSet, signal, preferWHDLoad: state.preferWHDLoad,
    onProgress: progress => { batch.message = `Matching imported catalogs · ${progress.index.toLocaleString()}/${progress.total.toLocaleString()}`; $('programListStatus').textContent = batch.message; } });
  for (const row of batch.rows) {
    const choice = batch.overrides[requestIdentity(row)];
    if (choice && !row.candidates.some(candidate => candidate.key === choice)) {
      const entry = state.entries.find(item => item.key === choice);
      // A manual catalog search can deliberately choose a shorter/different
      // title. Restore it even when the original requested title is missing.
      if (entry) try { addProgramSearchCandidate(row, entry, { platforms, resolveDiskSet, preferWHDLoad: state.preferWHDLoad }); }
      catch { /* A removed platform or incomplete disk set invalidates the old choice. */ }
    }
    if (choice && row.candidates.some(candidate => candidate.key === choice && candidate.ready)) chooseProgramMatch(batch.rows, row.line, choice);
  }
  batch.dirty = false; batch.message = ''; return workspaceReport();
}
function matchList(text = batch.text, options = {}) { return listJob(async signal => {
  await performListMatch(text, { ...options, signal });
  useListMatches({ replace: false });
  return workspaceReport();
}); }
function useListMatches({ replace = batch.replace, preserveVersionEdits = false } = {}) {
  const rows = batch.rows.filter(row => row.status === 'matched' && !batch.excluded.includes(row.line));
  const wanted = new Set(rows.map(row => row.selectedKey));
  const entries = new Map(state.entries.filter(entry => wanted.has(entry.key)).map(entry => [entry.key, entry]));
  const oldApplied = new Map(Object.entries(batch.applied).map(([line, key]) => [key, Number(line)]));
  const byKey = new Map(state.selected.map(entry => [entry.key, entry]));
  const byIdentity = new Map(state.selected.map(entry => [selectionIdentity(entry), entry]));
  const nextByLine = new Map();
  const selected = [], identities = new Set();
  const append = game => { const identity = selectionIdentity(game); if (!identities.has(identity)) { selected.push(game); identities.add(identity); } };
  for (const row of rows) {
    const entry = entries.get(row.selectedKey);
    if (!entry) throw new Error('A matched catalog is no longer available. Match the list again.');
    const game = selectDiskSet(entry, resolveDiskSet);
    const sameRelease = byKey.get(entry.key) || byIdentity.get(selectionIdentity(game));
    const previousRelease = byKey.get(batch.applied[row.line]);
    const sameRequest = batch.appliedRequests[row.line] === requestIdentity(row);
    if ((preserveVersionEdits || sameRequest) && !sameRelease && previousRelease) for (const field of ['title', 'credits', 'description', 'imageOverride', 'imageSource']) {
      if (previousRelease[field] != null) game[field] = previousRelease[field];
    }
    nextByLine.set(row.line, sameRelease || game);
  }
  if (!replace) for (const game of state.selected) {
    const line = oldApplied.get(game.key);
    if (line == null) append(game);
    else if (nextByLine.has(line)) append(nextByLine.get(line));
  }
  for (const game of nextByLine.values()) append(game);
  batch.applied = Object.fromEntries([...nextByLine].map(([line, game]) => [line, game.key]));
  batch.appliedRequests = Object.fromEntries(rows.map(row => [row.line, requestIdentity(row)]));
  state.selected = selected; renderSelection(); renderSources(); renderResults(); changed();
  return { games: selected.length };
}
function chooseListVersion(line, key) {
  chooseProgramMatch(batch.rows, line, key);
  batch.overrides[requestIdentity(batch.rows.find(row => row.line === line))] = key;
  batch.excluded = batch.excluded.filter(value => value !== line);
  batch.lastReport = null; batch.message = '';
  useListMatches({ replace: false, preserveVersionEdits: true });
  return workspaceReport();
}
function useRequestSearchMatch(line, key) {
  if (state.listBusy || state.exporting || state.imagesBusy || state.testing || state.importing) throw new Error('Wait for the current operation to finish.');
  const row = batch.rows.find(item => item.line === line);
  if (!row?.catalogSearch?.results.some(item => item.key === key)) throw new Error('Find a match for this request first.');
  addProgramSearchCandidate(row, state.entries.find(item => item.key === key), { platforms, resolveDiskSet, preferWHDLoad: state.preferWHDLoad });
  return chooseListVersion(line, key);
}
async function buildFromList({ text, platform = batch.platform, mode = state.mode, images = state.includeImages, replace = batch.replace } = {}) {
  return listJob(async signal => {
    const abort = () => { if (signal.aborted) throw new DOMException('List operation cancelled.', 'AbortError'); };
    if (text != null || !batch.rows.length || batch.dirty || platform !== batch.platform) await performListMatch(text ?? batch.text, { platform, signal });
    abort(); useListMatches({ replace });
    state.mode = mode; state.includeImages = images; batch.mode = mode; batch.images = images; batch.replace = replace; syncMetadata(); syncProgramList();
    const errors = validateCollection({ name: state.name, id: state.id, list: state.selected }, { mode, metadataOnly: true });
    if (errors.length) throw new Error(errors.join('\n'));
    let imageReport;
    if (images) { batch.message = 'Downloading matched images…'; renderProgramList(); imageReport = await downloadMissingImages(); }
    abort();
    const report = { ...workspaceReport(), ...(imageReport ? { images: imageReport } : {}) };
    batch.message = 'Building the collection. Unavailable games will be listed in the report.'; renderProgramList();
    const result = await exportCollection({ mode, allowMissing: true, report });
    abort(); batch.lastReport = result.report; batch.message = `${result.manifest.list.length} games exported · ${result.report.export.failed} download failures. Report included in ZIP.`;
    return result;
  });
}
async function buildWorkspace({ mode = state.mode, images = state.includeImages } = {}) {
  return listJob(async signal => {
    state.mode = mode; state.includeImages = images; syncMetadata();
    const abort = () => { if (signal.aborted) throw new DOMException('Build cancelled.', 'AbortError'); };
    if (state.inputMode === 'list' && batch.text.trim() && batch.dirty) {
      await performListMatch(batch.text, { platform: state.platform, signal }); useListMatches({ replace: false });
    }
    const errors = validateCollection({ name: state.name, id: state.id, list: state.selected }, { mode: state.mode, metadataOnly: true });
    if (errors.length) throw new Error(errors.join('\n'));
    abort();
    const imageReport = state.includeImages ? await downloadMissingImages() : null;
    abort();
    const report = { ...workspaceReport(), ...(imageReport ? { images: imageReport } : {}) };
    const result = await exportCollection({ mode: state.mode, allowMissing: true, report });
    abort(); batch.lastReport = result.report;
    batch.message = `${result.manifest.list.length} games exported${result.report.export.failed ? ` · ${result.report.export.failed} failed (see report)` : ''}`;
    return result;
  });
}
function downloadArtifact(bytes, filename, type = 'application/zip') {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  element('a', { href: url, download: filename }).click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function selectedGame(key) {
  const entry = state.selected.find(entry => entry.key === key);
  if (!entry) throw new Error('Game not found in the collection draft.');
  return entry;
}
async function imageJob(action) {
  if (state.imagesBusy || state.exporting || state.importing || state.testing) throw new Error('Wait for the current operation to finish.');
  clearError(); imageController = new AbortController(); state.imagesBusy = true;
  $('catalogFiles').disabled = true;
  renderSelection(); renderSources(); renderResults();
  try { return await action(imageController.signal); }
  catch (cause) {
    $('imageStatus').textContent = imageController.signal.aborted ? 'Image download cancelled. Completed images are kept.' : cause.message;
    if (cause.name !== 'AbortError') throw cause;
    return { cancelled: true };
  } finally {
    state.imagesBusy = false; $('catalogFiles').disabled = false;
    renderSelection(); renderSources(); renderResults(); changed();
  }
}
async function findImages(key) {
  const entry = selectedGame(key);
  return imageJob(async signal => {
    $('imageStatus').textContent = `Finding images · ${entry.title}`;
    const candidates = await artworks.find(entry, { signal });
    imageChoices.set(entry.key, candidates);
    const message = candidates.length ? 'Select an image type to download.' : 'No matching image in VM/E’s index.';
    imageMessages.set(entry.key, message); $('imageStatus').textContent = `${entry.title} · ${message}`;
    return candidates;
  });
}
async function downloadImage(key, layer = 'snaps') {
  const entry = selectedGame(key);
  return imageJob(async signal => {
    $('imageStatus').textContent = `Downloading image · ${entry.title}`;
    const candidates = await artworks.find(entry, { signal }); imageChoices.set(entry.key, candidates);
    const candidate = candidates.find(item => item.layer === layer);
    if (!candidate) throw new Error(`${entry.title}: no indexed ${artworkLabels[layer] || layer}.`);
    const result = await artworks.download(entry, candidate, { signal });
    if (state.selected.includes(entry)) { entry.imageOverride = result.blob; entry.imageSource = result.source; }
    $('imageStatus').textContent = `${entry.title} · ${artworkLabels[layer]} downloaded`;
    return result.source;
  });
}
async function downloadMissingImages() {
  return imageJob(async signal => {
    const summary = await artworks.downloadMissing([...state.selected], { signal,
      onProgress: progress => { $('imageStatus').textContent = `Images ${progress.index}/${progress.total} · ${progress.title}`; },
      onImage: (entry, result) => {
        if (!state.selected.includes(entry)) return;
        entry.imageOverride = result.blob; entry.imageSource = result.source;
        saveDraft(); renderSelection();
      }
    });
    $('imageStatus').textContent = `${summary.downloaded} downloaded · ${summary.skipped} existing · ${summary.unmatched} unmatched · ${summary.failed} failed`;
    $('imageStatus').title = summary.errors.map(item => `${item.title}: ${item.message}`).join('\n');
    return summary;
  });
}

$('importPlatform').append(new Option('Choose platform…', ''), ...platforms.map(platform => new Option(platform.name, platform.id)));
$('programListText').addEventListener('input', event => {
  batch.text = event.target.value; batch.rows = []; batch.excluded = []; batch.lastReport = null;
  batch.dirty = !!batch.text.trim(); batch.message = batch.dirty ? 'List changed. Match to update the collection.' : '';
  renderSelection(); saveDraft();
});
$('matchProgramList').addEventListener('click', () => matchList(batch.text, { platform: state.platform }).catch(cause => { if (cause.name !== 'AbortError') error(cause); }));
$('downloadProgramReport').addEventListener('click', () => downloadArtifact(JSON.stringify(batch.lastReport || workspaceReport(), null, 2) + '\n', `${state.id || 'collection'}_report.json`, 'application/json'));
$('listTab').addEventListener('click', () => setInputMode('list'));
$('searchTab').addEventListener('click', () => setInputMode('search'));
for (const id of ['listTab', 'searchTab']) $(id).addEventListener('keydown', event => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const mode = event.key === 'Home' ? 'list' : event.key === 'End' ? 'search' : state.inputMode === 'list' ? 'search' : 'list';
  setInputMode(mode); $(mode === 'list' ? 'listTab' : 'searchTab').focus();
});
function askImportPlatform(file) {
  return new Promise(resolve => {
    const dialog = $('importPlatformDialog');
    $('importPlatformFilename').textContent = file.name;
    $('importPlatform').value = supported.has(state.platform) ? state.platform : '';
    dialog.returnValue = '';
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'import' ? $('importPlatform').value : null), { once: true });
    dialog.showModal();
  });
}
async function importCatalogFiles(files) {
  if (state.importing || state.exporting || state.imagesBusy || state.listBusy || state.testing) throw new Error('Wait for the current operation to finish.');
  clearError(); state.importing = true; renderValidation();
  try {
    for (const file of files) {
      try { await importFile(file); }
      catch (cause) {
        if (!/Choose a platform for a standalone software JSON/.test(cause.message)) throw cause;
        const platformId = await askImportPlatform(file);
        if (!platformId) continue;
        await importFile(file, { platformId });
      }
    }
  } catch (cause) { error(cause); $('importStatus').textContent = 'Import failed.'; throw cause; }
  finally { state.importing = false; $('catalogFiles').value = ''; renderValidation(); }
}
$('catalogFiles').addEventListener('change', event => { importCatalogFiles([...event.target.files]).catch(() => {}); });
$('query').addEventListener('input', () => { clearTimeout(searchTimer); state.page = 0; searchTimer = setTimeout(renderResults, 120); });
$('platformFilter').addEventListener('change', event => {
  state.platform = event.target.value; batch.platform = state.platform; state.page = 0;
  $('catalogFilter').value = ''; $('tagFilter').value = '';
  if (batch.text.trim()) { batch.dirty = true; batch.message = 'Platform changed. Match to update the collection.'; }
  renderFilters(); renderResults(); changed();
});
for (const id of ['catalogFilter', 'tagFilter']) $(id).addEventListener('change', () => { state.page = 0; renderFilters(); renderResults(); });
$('previousPage').addEventListener('click', () => { state.page--; renderResults(); });
$('nextPage').addEventListener('click', () => { state.page++; renderResults(); });
$('showMoreGames').addEventListener('click', () => { listDisplayLimit += 100; renderSelection(); });
function newCollection() {
  importTestReport = null; lastImportArtifact = null;
  state.selected = []; state.name = 'My collection'; state.id = 'my-collection'; state.imageOverride = null;
  Object.assign(batch, { text: '', rows: [], applied: {}, appliedRequests: {}, overrides: {}, excluded: [], dirty: false, lastReport: null, message: '', platform: state.platform });
  listDisplayLimit = 100; imageChoices.clear(); imageMessages.clear();
  $('exportStatus').textContent = ''; $('imageStatus').textContent = ''; $('exportProgress').hidden = true;
  $('collectionCover').value = '';
  syncMetadata(); syncProgramList(); renderSelection(); renderSources(); renderResults(); changed();
}
$('clearSelection').addEventListener('click', newCollection);
$('collectionName').addEventListener('input', event => {
  if (state.id === suggestId(state.name)) { state.id = suggestId(event.target.value); $('collectionId').value = state.id; }
  state.name = event.target.value; changed();
});
$('collectionId').addEventListener('input', event => { state.id = event.target.value; changed(); });
$('exportMode').addEventListener('change', event => { state.mode = event.target.value; batch.mode = state.mode; renderSelection(); changed(); });
$('includeImages').addEventListener('change', event => { state.includeImages = event.target.checked; batch.images = state.includeImages; changed(); });
$('preferWHDLoad').addEventListener('change', event => {
  state.preferWHDLoad = event.target.checked;
  if (batch.text.trim()) { batch.dirty = true; batch.message = 'WHDLoad preference changed. Match to update the collection.'; }
  changed();
});
$('testLinkedImport').addEventListener('click', () => runImportTest(undefined, { downloadLinks: true }).catch(error));
$('collectionCover').addEventListener('change', async event => {
  const file = event.target.files[0]; if (!file) return;
  try { state.imageOverride = await pngImage(file); syncMetadata(); changed(); } catch (cause) { error(cause); }
});
$('cancelOperation').addEventListener('click', () => { listController?.abort(); imageController?.abort(); controller?.abort(); importTestController?.abort(); });
$('exportZip').addEventListener('click', () => buildWorkspace().then(result => downloadArtifact(result.bytes, result.filename)).catch(cause => { if (cause.name !== 'AbortError') error(cause); }));

async function initialize() {
  let migrateLegacyMatches = false;
  renderResults(); renderSelection();
  try {
    await db.open(); storageAvailable = true;
    const [savedSources, draft] = await Promise.all([db.sources.toArray(), db.workspace.get('draft')]);
    for (const stored of savedSources) {
      try {
        const source = await importCatalog(stored.blob, { id: stored.id, name: stored.name, platformId: stored.platformId,
          onProgress: progress => { $('importStatus').textContent = `Restoring ${progress.source}…`; } });
        sources.set(source.id, source);
      } catch (cause) { error(`Could not restore ${stored.name}: ${cause.message}`); }
    }
    if (draft) {
      state.name = draft.name || state.name; state.id = draft.id || state.id;
      state.imageOverride = draft.imageOverride || null; state.mode = draft.mode === 'files' ? 'files' : 'links';
      state.selected = Array.isArray(draft.selected) ? draft.selected.filter(entry => entry?.key && entry.platform_id) : [];
      if (draft.batch) Object.assign(batch, draft.batch, { message: '' });
      importTestReport = batch.lastReport?.importTest || null;
      state.platform = draft.platform ?? batch.platform ?? '';
      state.inputMode = draft.inputMode === 'search' ? 'search' : 'list';
      state.includeImages = draft.includeImages ?? draft.batch?.images ?? true;
      state.preferWHDLoad = draft.preferWHDLoad === true;
      batch.platform = state.platform;
      if (batch.text.trim() && !batch.rows.length) batch.dirty = true;
      // Older drafts stored matched rows separately. Link their existing
      // selected games without replacing user edits during migration.
      if (!Object.keys(batch.applied).length) for (const row of batch.rows) {
        const chosen = row.candidates.find(candidate => candidate.key === row.selectedKey);
        const existing = state.selected.find(entry => entry.key === row.selectedKey || (chosen && selectionIdentity(entry) === chosen.identity));
        if (existing && row.status === 'matched') batch.applied[row.line] = existing.key;
      }
      for (const row of batch.rows) {
        if (batch.applied[row.line]) batch.appliedRequests[row.line] = requestIdentity(row);
        if (row.selection?.method === 'manual' && row.selectedKey) batch.overrides[requestIdentity(row)] = row.selectedKey;
      }
      migrateLegacyMatches = draft.uiVersion !== 2 && !state.selected.length && batch.rows.some(row => row.status === 'matched');
    }
    $('saveStatus').textContent = draft ? 'Draft restored' : 'Workspace ready';
  } catch (cause) { storageAvailable = false; $('saveStatus').textContent = 'Session only'; error(`Browser storage unavailable: ${cause.message}`); }
  rebuildEntries(false); syncMetadata(); syncProgramList(); renderFilters(); renderSources(); renderResults(); renderSelection();
  if (migrateLegacyMatches) useListMatches({ replace: false });
  $('importStatus').textContent = '';
}
window.collectionBuilder = {
  ready: initialize(), importFile, add, remove, move, export: exportCollection,
  testImport: (input, options) => runImportTest(input, options),
  importTestReport: () => importTestReport ? structuredClone(importTestReport) : null,
  build: buildWorkspace, importFiles: importCatalogFiles, newCollection, setInputMode,
  findImages, downloadImage, downloadMissingImages,
  matchList, buildFromList,
  chooseListMatch(line, key) { if (state.listBusy || state.exporting || state.imagesBusy || state.testing) throw new Error('Wait for the current operation to finish.'); return chooseListVersion(line, key); },
  applyListMatches(options) { if (state.listBusy || state.exporting || state.imagesBusy || state.testing) throw new Error('Wait for the current operation to finish.'); return useListMatches(options); },
  listReport: () => structuredClone(batch.lastReport || workspaceReport()),
  search: options => searchCatalogs(state.entries, options),
  diskSet: key => {
    const entry = state.entries.find(entry => entry.key === key);
    if (!entry) throw new Error('Game not found in imported catalogs.');
    return structuredClone(resolveDiskSet(entry));
  },
  inspect: () => ({ name: state.name, id: state.id, mode: state.mode, platform: state.platform, inputMode: state.inputMode, includeImages: state.includeImages, preferWHDLoad: state.preferWHDLoad, entries: state.entries.length, sources: [...sources.values()].map(source => ({ id: source.id, name: source.name, entries: source.entries.length })),
    selected: state.selected.map(({ imageOverride, fileOverride, disks, ...entry }) => ({ ...entry, attachedImage: !!imageOverride, attachedFile: !!fileOverride,
      ...(disks ? { disks: disks.map(({ imageOverride, fileOverride, ...disk }) => ({ ...disk, attachedFile: !!fileOverride })) } : {}) })), storageAvailable }),
  setMetadata(values) { for (const key of ['name', 'id', 'mode']) if (values[key] != null) state[key] = values[key]; syncMetadata(); changed(); },
  async flush() { clearTimeout(saveTimer); await saveQueue; if (storageAvailable) await db.workspace.put(snapshot()); }
};
