import JSZip from 'jszip';
import { validateCollectionDisks } from '../../../src/utils/CollectionDiskSet.js';
import { tagRank } from '../../../src/utils/TagPriority.js';

const placeholder = new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1,0,0,0,1,8,4,0,0,0,181,28,12,2,0,0,0,11,73,68,65,84,120,218,99,100,248,15,0,1,5,1,1,39,24,227,102,0,0,0,0,73,69,78,68,174,66,96,130]);
const nonSoftware = /\.(?:txt|nfo|diz|png|jpe?g|gif|webp|bmp|pdf|xml|json|md5|sha1|sha256|ini|html?|css|ds_store)$/i;
export const normalizePlatform = id => ({ atari7800: 'a7800' }[String(id).toLowerCase()] || String(id).toLowerCase());
export const fold = value => String(value ?? '').toLowerCase().replace(/ł/g, 'l').normalize('NFD').replace(/\p{M}/gu, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
export const leafName = value => String(value || '').split(/[\\/]/).pop();
export const suggestId = name => fold(name).replace(/ /g, '-').slice(0, 80) || 'my-collection';

function cleanTitle(filename) {
  return leafName(filename).replace(/\.[^.]+$/, '').replace(/\([^)]*\)|\[[^\]]*\]/g, '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim() || filename;
}
export function httpUrl(value) {
  if (!value) return false;
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password; } catch { return false; }
}
function archivePath(value) {
  const path = String(value || '').replace(/\\/g, '/');
  if (!path || path.startsWith('/') || path.includes('\0') || path.split('/').some(part => part === '..') || /^[a-z]:/i.test(path))
    throw new Error(`Invalid archive path: ${value}`);
  return path;
}
function json(text) { return JSON.parse(text.replace(/^\uFEFF/, '')); }
export async function bytesOf(input) {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (typeof input === 'string') return new TextEncoder().encode(input);
  if (input?.arrayBuffer) return new Uint8Array(await input.arrayBuffer());
  throw new Error('File data is unavailable.');
}

export async function importCatalog(input, { id, name = 'Catalog', platformId = '', onProgress = () => {} } = {}) {
  if (!id) throw new Error('Source ID is required.');
  const bytes = await bytesOf(input);
  const source = { id, name, entries: [], catalogs: [], warnings: [], zip: null, collection: null };
  let nextIndex = 0;
  const add = (entry, catalog) => {
    source.entries.push({ ...entry, key: `${id}:${nextIndex++}`, sourceId: id, catalogId: catalog.id, sourceName: name,
      search: fold([entry.title, entry.filename, entry.tag].join(' ')), software: !nonSoftware.test(entry.filename) });
  };
  const addDirectory = async (data, platform, path) => {
    if (!Array.isArray(data.items) || !Array.isArray(data.bases) || typeof data.root !== 'string') throw new Error(`Invalid software directory: ${path}`);
    if (!platform) throw new Error('Choose a platform for a standalone software JSON.');
    platform = normalizePlatform(platform);
    const catalog = { id: `${id}:${source.catalogs.length}`, name: data.name || path, platform_id: platform, count: data.items.length };
    source.catalogs.push(catalog);
    for (let index = 0; index < data.items.length; index++) {
      const item = data.items[index];
      if (!Array.isArray(item) || typeof item[0] !== 'string' || !Number.isInteger(item[1]) || typeof data.bases[item[1]] !== 'string' || typeof item[2] !== 'string') {
        source.warnings.push(`${path}: invalid entry ${index + 1} skipped.`); continue;
      }
      // Keep VM/E's concatenation exactly: URL resolution would break encoded ZIP member paths.
      const url = data.root + data.bases[item[1]] + item[2];
      add({ platform_id: platform, title: typeof item[4] === 'string' && item[4] ? item[4] : cleanTitle(item[0]),
        filename: leafName(item[0]), originalName: item[0], credits: '', description: '', url,
        tag: String(data.tags?.[item[1]] || ''), tagPriority: tagRank(data, item), size: item[3], filePath: '', imagePath: '' }, catalog);
      if (index % 5000 === 0) { onProgress({ source: name, count: source.entries.length }); await new Promise(resolve => setTimeout(resolve, 0)); }
    }
  };
  const addCollection = (data, base = '') => {
    if (!Array.isArray(data.list)) throw new Error('Invalid collection list.');
    source.collection = { id: data.id || '', name: data.name || name, imagePath: data.image ? base + archivePath(data.image) : '' };
    const catalog = { id: `${id}:0`, name: data.name || name, platform_id: '', count: data.list.length };
    source.catalogs.push(catalog);
    data.list.forEach((item, index) => {
      if (!item || !item.platform_id || !item.filename || (!item.file && !item.url && !item.disks)) throw new Error(`Invalid collection entry ${index + 1}.`);
      const filePath = item.file ? base + archivePath(item.file) : '';
      const imagePath = item.image ? base + archivePath(item.image) : '';
      let disks;
      if (item.disks != null) {
        validateCollectionDisks(item.disks);
        disks = item.disks.map((disk, diskIndex) => ({ key: `${id}:disk:${index}:${diskIndex}`, sourceId: id,
          platform_id: normalizePlatform(item.platform_id), title: item.title || cleanTitle(item.filename),
          filename: disk.filename, originalName: disk.filename, url: disk.url || '',
          filePath: disk.file ? base + archivePath(disk.file) : '' }));
      }
      add({ platform_id: normalizePlatform(item.platform_id), title: item.title || cleanTitle(item.filename),
        filename: leafName(item.filename), originalName: item.filename, credits: item.credits || '', description: item.description || '',
        url: item.url || '', filePath, imagePath, tag: '', ...(disks ? { disks,
          diskSet: { total: disks.length, isComplete: true, isConfident: true, missing: [], lowConfidence: [] } } : {}) }, catalog);
    });
  };
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    source.zip = await JSZip.loadAsync(bytes);
    const candidates = Object.keys(source.zip.files).filter(path => !path.startsWith('__MACOSX/') && /(^|\/)(vme_import|vme_collection)\.json$/.test(path));
    if (candidates.length !== 1) throw new Error('ZIP must contain one vme_import.json or vme_collection.json manifest.');
    const manifestPath = candidates[0];
    const base = manifestPath.slice(0, manifestPath.lastIndexOf('/') + 1);
    const manifest = json(await source.zip.file(manifestPath).async('string'));
    if (manifestPath.endsWith('vme_import.json')) {
      if (!manifest.platforms || typeof manifest.platforms !== 'object') throw new Error('Invalid vme_import manifest.');
      for (const [platform, config] of Object.entries(manifest.platforms)) {
        const path = base + archivePath(config.software);
        const file = source.zip.file(path);
        if (!file) throw new Error(`Software directory missing from ZIP: ${path}`);
        await addDirectory(json(await file.async('string')), platform, path);
      }
    } else addCollection(manifest, base);
  } else {
    const data = json(new TextDecoder().decode(bytes));
    if (Array.isArray(data.list)) addCollection(data);
    else await addDirectory(data, data.platform_id || platformId, name);
  }
  if (!source.entries.length) throw new Error('No software entries found.');
  return source;
}

export function searchCatalogs(entries, { query = '', platform = '', platformIds, catalog = '', tag = '', offset = 0, limit = 100 } = {}) {
  const terms = fold(query).split(' ').filter(Boolean);
  const results = []; let total = 0;
  for (const entry of entries) {
    if (!entry.software || (platformIds && !platformIds.has(entry.platform_id)) || (platform && entry.platform_id !== platform) || (catalog && entry.catalogId !== catalog) || (tag && entry.tag !== tag) || !terms.every(term => entry.search.includes(term))) continue;
    if (total >= offset && results.length < limit) results.push(entry);
    total++;
  }
  return { results, total };
}

export function selectionIdentity(entry) {
  if (entry.disks) return `${entry.platform_id}:set:${entry.disks.map(selectionIdentity).join('|')}`;
  return `${entry.platform_id}:${entry.url || `${entry.sourceId}:${entry.filePath || entry.key}`}`;
}
export function validateCollection(collection, { mode = 'links', platforms, diskPlatforms, metadataOnly = false } = {}) {
  const errors = [];
  const list = Array.isArray(collection.list) ? collection.list : [];
  if (!collection.name?.trim()) errors.push('Enter a collection name.');
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(collection.id || '')) errors.push('Collection ID must use letters, digits, hyphens or underscores.');
  if (!list.length) errors.push('Add at least one game.');
  if (!['links', 'files'].includes(mode)) errors.push('Choose links or files.');
  if (metadataOnly) return errors;
  for (const [index, entry] of list.entries()) {
    const prefix = `${index + 1}. ${entry.title || entry.filename || 'Untitled'}`;
    if (!entry.platform_id || (platforms && !platforms.has(entry.platform_id))) errors.push(`${prefix}: platform is not enabled in this VM/E.`);
    if (!entry.title?.trim() || !leafName(entry.filename)) errors.push(`${prefix}: title and filename are required.`);
    if (entry.disks != null) {
      if (diskPlatforms && !diskPlatforms.has(entry.platform_id)) errors.push(`${prefix}: multi-disk collections are not supported for this platform.`);
      try { validateCollectionDisks(entry.disks); } catch (cause) { errors.push(`${prefix}: ${cause.message}`); }
      if (!/\.zip$/i.test(entry.filename)) errors.push(`${prefix}: a disk set filename must end in .zip.`);
      if (entry.diskSet?.isComplete === false || (entry.diskSet?.total && entry.disks.length !== entry.diskSet.total)) errors.push(`${prefix}: incomplete disk set (missing ${(entry.diskSet?.missing || []).join(', ') || 'disks'}).`);
      if (entry.diskSet?.isConfident === false) errors.push(`${prefix}: ambiguous disk variants; choose a different source variant.`);
    }
    for (const disk of entry.disks == null ? [entry] : Array.isArray(entry.disks) ? entry.disks : []) {
      if (!disk || typeof disk !== 'object') continue;
      const label = entry.disks ? `${prefix} / ${disk.filename}` : prefix;
      if (mode === 'links' && !httpUrl(disk.url)) errors.push(`${label}: add an HTTP(S) URL for link export.`);
      if (mode === 'files' && !disk.fileOverride && !disk.filePath && !httpUrl(disk.url)) errors.push(`${label}: attach a file or provide a download URL.`);
    }
  }
  return errors;
}

export async function readSourceAsset(sources, entry, type) {
  const path = type === 'image' ? entry.imagePath : entry.filePath;
  const source = sources.get(entry.sourceId);
  if (!path || !source?.zip?.file(path)) return null;
  return source.zip.file(path).async('uint8array');
}

export async function buildCollection(collection, { mode = 'links', sources = new Map(), fetchFile, makeImage,
  signal, onProgress = () => {}, platforms, diskPlatforms, allowMissing = false, report } = {}) {
  const errors = validateCollection(collection, { mode, platforms, diskPlatforms, metadataOnly: allowMissing });
  if (errors.length) throw new Error(errors.join('\n'));
  const abort = () => { if (signal?.aborted) throw new DOMException('Export cancelled.', 'AbortError'); };
  const zip = new JSZip();
  const manifest = { id: collection.id, name: collection.name.trim(), image: 'images/collection.png', list: [] };
  const exportReport = { mode, requested: collection.list.length, exported: 0, failed: 0, failures: [] };
  const image = async (entry, index) => {
    if (entry.imageOverride) return { bytes: await bytesOf(entry.imageOverride), extension: 'png' };
    const stored = await readSourceAsset(sources, entry, 'image');
    if (stored) return { bytes: stored, extension: /\.(png|jpe?g|gif|webp|bmp)$/i.exec(entry.imagePath)?.[1].toLowerCase() || 'png' };
    return { bytes: makeImage ? await bytesOf(await makeImage(entry.title || collection.name, entry.platform_id || '', index)) : placeholder, extension: 'png' };
  };
  const readGame = async entry => {
    let data;
    if (entry.fileOverride) data = await bytesOf(entry.fileOverride);
    else if (entry.filePath) {
      data = await readSourceAsset(sources, entry, 'file');
      if (!data) throw new Error(`${entry.title}: embedded file is missing. Attach a replacement file.`);
    } else {
      if (!fetchFile) throw new Error(`${entry.title}: a downloader is required for file export.`);
      data = await bytesOf(await fetchFile(entry.url, { signal, entry }));
    }
    abort();
    if (!data?.byteLength) throw new Error(`${entry.title}: game file is empty.`);
    return data;
  };
  abort();
  const cover = collection.imageOverride ? await bytesOf(collection.imageOverride)
    : makeImage ? await bytesOf(await makeImage(collection.name, 'VM/E COLLECTION', -1)) : placeholder;
  zip.file(manifest.image, cover);
  for (const [index, entry] of collection.list.entries()) {
    abort();
    onProgress({ stage: 'media', index: index + 1, total: collection.list.length, title: entry.title });
    try {
      if (allowMissing) {
        const invalid = validateCollection({ ...collection, list: [entry] }, { mode, platforms, diskPlatforms });
        if (invalid.length) throw new Error(invalid.join('\n'));
      }
      const artwork = await image(entry, index);
      const prefix = String(index + 1).padStart(4, '0');
      const item = { title: entry.title.trim(), platform_id: entry.platform_id, filename: leafName(entry.filename),
        credits: entry.credits || '', description: entry.description || '', image: `images/${prefix}.${artwork.extension}` };
      // Commit assets only after every disk succeeds. A failed game leaves no
      // orphaned image or partial disk set in a best-effort collection.
      const assets = [[item.image, artwork.bytes]];
      if (entry.disks) {
        item.disks = [];
        for (const [diskIndex, disk] of entry.disks.entries()) {
          abort();
          onProgress({ stage: 'media', index: index + 1, total: collection.list.length, title: `${entry.title} · disk ${diskIndex + 1}/${entry.disks.length}` });
          const output = { filename: disk.filename };
          if (mode === 'links') output.url = disk.url.trim();
          else {
            output.file = `files/${prefix}/disk-${String(diskIndex + 1).padStart(2, '0')}-${disk.filename}`;
            assets.push([output.file, await readGame(disk)]);
          }
          item.disks.push(output);
        }
      } else if (mode === 'links') item.url = entry.url.trim();
      else {
        item.file = `files/${prefix}-${leafName(entry.filename)}`;
        assets.push([item.file, await readGame(entry)]);
      }
      abort();
      for (const [path, data] of assets) zip.file(path, data);
      manifest.list.push(item);
    } catch (cause) {
      abort();
      if (!allowMissing || cause.name === 'AbortError') throw cause;
      exportReport.failures.push({ key: entry.key, title: entry.title, platform_id: entry.platform_id,
        filename: entry.filename, message: cause.message });
    }
  }
  abort();
  exportReport.exported = manifest.list.length;
  exportReport.failed = exportReport.failures.length;
  const finalReport = { ...(report || {}), export: exportReport };
  if (!manifest.list.length) {
    const cause = new Error('No games could be exported. Download the report to inspect the failures.');
    cause.report = finalReport; throw cause;
  }
  if (report || allowMissing) zip.file('collection_report.json', JSON.stringify(finalReport, null, 2) + '\n');
  zip.file('vme_collection.json', JSON.stringify(manifest, null, 2) + '\n');
  const bytes = await new Promise((resolve, reject) => {
    const stream = zip.generateInternalStream({ type: 'uint8array', compression: 'STORE', streamFiles: true });
    let chunks = [], length = 0, settled = false;
    const cleanup = () => signal?.removeEventListener('abort', cancelled);
    const failed = cause => {
      if (settled) return;
      settled = true; stream.pause(); chunks = []; cleanup(); reject(cause);
    };
    const cancelled = () => failed(new DOMException('Export cancelled.', 'AbortError'));
    signal?.addEventListener('abort', cancelled, { once: true });
    stream.on('data', (chunk, progress) => {
      if (settled) return;
      chunks.push(chunk); length += chunk.length;
      try { onProgress({ stage: 'zip', percent: progress.percent }); } catch (cause) { failed(cause); }
    }).on('error', failed).on('end', () => {
      if (settled) return;
      try {
        const result = new Uint8Array(length); let offset = 0;
        for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
        settled = true; chunks = []; cleanup(); resolve(result);
      } catch (cause) { failed(cause); }
    });
    if (signal?.aborted) cancelled(); else stream.resume();
  });
  abort();
  return { bytes, manifest, filename: `${collection.id}_vme_collection.zip`, ...((report || allowMissing) ? { report: finalReport } : {}) };
}
