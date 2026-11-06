import { FileUtils } from '../../../src/utils/FileUtils.js';
import { fold, selectionIdentity, searchCatalogs } from './model.js';
import { selectDiskSet, atariDiskName } from './disk-sets.js';
import { parseAtari800Disk } from '../../../src/utils/Atari800DiskSets.js';
import { VERSION_POLICY, versionPreference, comparePreferredVersions, automaticVersionReason } from './version-preference.js';
import { titleMatchForms, titleMatchKind, titleFamily, createTitlePrefilter } from './title-matching.js';

const compact = value => fold(value).replace(/ /g, '');
const aliases = {
  a8: 'atari800', a800: 'atari800', atari8bit: 'atari800', atarixl: 'atari800', atarixe: 'atari800',
  a2600: 'atari2600', a5200: 'atari5200', atari7800: 'a7800',
  megadrive: 'smd', genesis: 'smd', md: 'smd', atarist: 'st', msdos: 'dos', pc: 'dos',
  commodore64: 'c64', zxspectrum: 'spectrum', appleii: 'apple2', amstrad: 'cpc'
};
const leaf = value => String(value || '').split(/[\\/]/).pop();
const unquote = value => value.trim().replace(/^"(.*)"$/, '$1').trim();
const mediaExtension = /\.(?:zip|7z|lha|adf|adz|dms|atr|atx|xfd|dcm|st|stx|msa|dim|dsk|do|po|woz|2mg|nes|sfc|smc|gb|gbc|gba|sms|gg|md|smd|bin|rom|crt|d64|tap|t64|prg|xex|cas|exe|com|chd|iso|cue)$/i;

function nameKeys(entry) {
  const keys = new Set([fold(entry.title)]);
  const articleFirst = value => String(value || '').replace(/^(.*),\s*(The|An|A)$/i, '$2 $1');
  keys.add(fold(articleFirst(entry.title)));
  for (const name of [entry.originalName, entry.filename]) {
    let stem = leaf(name);
    if (entry.platform_id === 'atari800') {
      const disk = parseAtari800Disk({ romName: atariDiskName(stem) });
      if (disk) keys.add(fold(disk.title.replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')));
    }
    keys.add(fold(stem));
    for (let depth = 0; depth < 2 && mediaExtension.test(stem); depth++) {
      stem = stem.replace(mediaExtension, '');
      keys.add(fold(stem));
    }
    const title = stem.replace(/\([^)]*\)|\[[^\]]*\]/g, ' ').trim();
    keys.add(title); keys.add(fold(title)); keys.add(fold(articleFirst(title)));
    for (const key of FileUtils.getThumbnailMatchKeys(leaf(name))) keys.add(fold(key));
  }
  for (const key of keys) keys.add(key.replace(/ /g, ''));
  keys.delete(''); return keys;
}

export function parseProgramList(text, { platforms, platform = '' } = {}) {
  const names = new Map(Object.entries(aliases));
  for (const item of platforms) { names.set(compact(item.id), item.id); names.set(compact(item.name), item.id); }
  const enabled = new Set(platforms.map(item => item.id));
  const resolve = value => value ? names.get(compact(value)) || null : '';
  const rows = [];
  for (const [index, raw] of String(text).replace(/^\uFEFF/, '').split(/\r?\n/).entries()) {
    const input = raw.trim();
    if (!input || /^(?:#|\/\/)/.test(input)) continue;
    const fields = input.replace(/^(?:[-*]\s+|\d+[.)]\s+)/, '').split(/\s*\|\s*|\t/).map(unquote);
    if (!rows.length && /^(?:platform|platforma)$/i.test(fields[0]) && /^(?:title|tytu[lł])$/i.test(fields[1])) continue;
    const platformName = fields.length === 1 ? platform : fields[0];
    const title = fields.length === 1 ? fields[0] : fields[1];
    const platformId = resolve(platformName);
    const row = { line: index + 1, input, platform: platformName, platform_id: platformId || '', title: title || '',
      variant: fields[2] || '', status: 'pending', message: '', candidates: [], selectedKey: null };
    if (fields.length > 3 || !title) { row.status = 'invalid'; row.message = 'Use title, or platform | title | optional variant.'; }
    else if (platformName && (!platformId || !enabled.has(platformId))) { row.status = 'invalid'; row.message = `Unknown or disabled platform: ${platformName}`; }
    rows.push(row);
    if (rows.length > 2000) throw new Error('Paste at most 2,000 programs at a time.');
  }
  return rows;
}

function candidateFor(entry, resolveDiskSet, options) {
  const game = selectDiskSet(entry, resolveDiskSet);
  const complete = game.diskSet?.isComplete !== false && (!game.diskSet?.total || game.disks?.length === game.diskSet.total);
  const confident = game.diskSet?.isConfident !== false;
  const candidate = { key: entry.key, identity: selectionIdentity(game), platform_id: entry.platform_id,
    title: entry.title, filename: entry.originalName || entry.filename, tag: entry.tag || '', source: entry.sourceName || '',
    whdload: entry.platform_id === 'amiga' && /whd[\s_-]*load/i.test([entry.tag, entry.originalName, entry.filename, entry.sourceName, entry.url].join(' ')),
    ...(Number.isFinite(entry.tagPriority) ? { tagPriority: entry.tagPriority } : {}),
    disks: game.disks?.map(disk => disk.filename) || [], ready: complete && confident,
    issue: !complete ? `Incomplete disk set; missing ${(game.diskSet.missing || []).join(', ') || 'disks'}` : !confident ? 'Ambiguous disk variants' : '' };
  candidate.preference = versionPreference(candidate, options); return candidate;
}

export function searchProgramCandidates(query, { entries, platforms, platform = '', resolveDiskSet = () => null,
  preferWHDLoad = false, offset = 0, limit = 20 } = {}) {
  if (!fold(query)) return { results: [], total: 0 };
  const found = searchCatalogs(entries, { query, platform, platformIds: new Set(platforms.map(item => item.id)), offset, limit });
  const candidates = new Map();
  for (const entry of found.results) {
    const candidate = { ...candidateFor(entry, resolveDiskSet, { preferWHDLoad }), matchedVia: 'search' };
    const previous = candidates.get(candidate.identity);
    if (!previous || comparePreferredVersions(candidate, previous) < 0) candidates.set(candidate.identity, candidate);
  }
  return { results: [...candidates.values()].sort(comparePreferredVersions), total: found.total };
}

export function addProgramSearchCandidate(row, entry, { platforms, resolveDiskSet = () => null, preferWHDLoad = false } = {}) {
  if (!row || row.status === 'invalid' || !entry?.software || !platforms.some(item => item.id === entry.platform_id)
    || (row.platform_id && row.platform_id !== entry.platform_id)) throw new Error('Choose a game on the requested platform.');
  const candidate = { ...candidateFor(entry, resolveDiskSet, { preferWHDLoad }), matchedVia: 'search' };
  if (!candidate.ready) throw new Error(candidate.issue);
  if (!row.candidates.some(item => item.key === candidate.key)) row.candidates.push(candidate);
  row.candidateCount = row.candidates.length;
  return candidate;
}

export function refreshProgramList(rows) {
  const chosen = new Map();
  for (const row of rows) {
    if (!row.selectedKey) continue;
    const candidate = row.candidates.find(item => item.key === row.selectedKey);
    if (!candidate?.ready) continue;
    row.status = 'matched'; row.message = row.selection?.reason || ''; delete row.duplicateOf;
    if (chosen.has(candidate.identity)) {
      row.status = 'duplicate'; row.duplicateOf = chosen.get(candidate.identity);
      row.message = `Same game as line ${row.duplicateOf}; included once.`;
    } else chosen.set(candidate.identity, row.line);
  }
  return rows;
}

export function chooseProgramMatch(rows, line, key) {
  const row = rows.find(item => item.line === line);
  const candidate = row?.candidates.find(item => item.key === key);
  if (!candidate?.ready) throw new Error('Choose a complete, unambiguous candidate from this row.');
  row.selectedKey = key;
  row.selection = { method: 'manual', ...(candidate.matchedVia === 'search' ? { matchedVia: 'search' } : {}),
    reason: candidate.matchedVia === 'search' ? 'Chosen manually from catalog search.' : 'Chosen manually.' };
  return refreshProgramList(rows);
}

export function programListReport(rows, { preferWHDLoad = false } = {}) {
  const counts = {};
  for (const row of rows) counts[row.status] = (counts[row.status] || 0) + 1;
  return { version: 1, selectionPolicy: VERSION_POLICY, preferences: { preferWHDLoad }, requested: rows.length, counts, rows: structuredClone(rows) };
}

// Exact titles and numeral equivalences share the release ranking. A shortened
// title is a fallback only, and competing title families require a choice.
export async function matchProgramList(text, { entries, platforms, platform = '', resolveDiskSet = () => null, preferWHDLoad = false,
  signal, onProgress = () => {}, yieldControl = () => new Promise(resolve => setTimeout(resolve, 0)) } = {}) {
  const rows = parseProgramList(text, { platforms, platform });
  if (!rows.length) throw new Error('Paste at least one program title.');
  const queries = new Map(), found = new Map(), forms = new Map(), enabled = new Set(platforms.map(item => item.id));
  const abort = () => { if (signal?.aborted) throw new DOMException('List matching cancelled.', 'AbortError'); };
  for (const row of rows) {
    if (row.status !== 'pending') continue;
    const query = titleMatchForms([row.title]); forms.set(row, query);
    for (const key of query.keys) {
      if (!queries.has(key)) queries.set(key, []);
      queries.get(key).push(row);
    }
    found.set(row, []);
  }
  const mayMatch = createTitlePrefilter(forms.values());
  for (const [index, entry] of entries.entries()) {
    if (index % 5000 === 0) { abort(); onProgress({ index, total: entries.length }); await yieldControl(); abort(); }
    if (!entry.software || !enabled.has(entry.platform_id)) continue;
    const sourceKeys = nameKeys(entry);
    if (!mayMatch(sourceKeys)) continue;
    const candidateForms = titleMatchForms([...sourceKeys, entry.title]);
    const related = new Set();
    for (const key of candidateForms.keys) for (const row of queries.get(key) || []) related.add(row);
    for (const row of related) {
      if (row.platform_id && row.platform_id !== entry.platform_id) continue;
      const detail = fold([entry.originalName, entry.filename, entry.title, entry.tag, entry.sourceName].join(' '));
      if (!fold(row.variant).split(' ').filter(Boolean).every(term => detail.includes(term))) continue;
      const exactFilename = [entry.originalName, entry.filename].some(name => fold(leaf(name)) === fold(row.title));
      if (mediaExtension.test(row.title) && !exactFilename) continue;
      const kind = exactFilename ? 'filename' : titleMatchKind(forms.get(row), candidateForms);
      if (!kind) continue;
      found.get(row).push({ entry, score: exactFilename ? 4 : kind === 'shortened' ? 1 : 3, kind, family: titleFamily(sourceKeys) });
    }
  }
  abort();
  const candidateCache = new Map();
  for (const [row, matches] of found) {
    if (!matches.length) { row.status = 'missing'; row.message = 'No matching title/filename in imported catalogs.'; continue; }
    const score = Math.max(...matches.map(match => match.score));
    const ranked = matches.filter(match => match.score === score);
    const candidates = new Map();
    for (const [index, { entry, kind, family }] of ranked.entries()) {
      if (index % 50 === 0) { abort(); await yieldControl(); abort(); }
      if (!candidateCache.has(entry.key)) candidateCache.set(entry.key, candidateFor(entry, resolveDiskSet, { preferWHDLoad }));
      const candidate = { ...candidateCache.get(entry.key), matchedVia: kind, titleFamily: family };
      const previous = candidates.get(candidate.identity);
      if (!previous || comparePreferredVersions(candidate, previous) < 0) candidates.set(candidate.identity, candidate);
    }
    const ordered = [...candidates.values()].sort(comparePreferredVersions);
    row.candidateCount = ordered.length; row.truncated = ordered.length > 500;
    row.candidates = ordered.slice(0, 500);
    const ready = ordered.filter(candidate => candidate.ready);
    const competingTitles = score === 1 && new Set(ready.map(candidate => candidate.titleFamily)).size > 1;
    if (ready.length && new Set(ready.map(candidate => candidate.platform_id)).size === 1 && !competingTitles) {
      row.status = 'matched'; row.selectedKey = ready[0].key;
      const matchReason = ready[0].matchedVia === 'numeral' ? 'Roman/Arabic numeral equivalence. ' : ready[0].matchedVia === 'shortened' ? 'Shortened/expanded title match. ' : '';
      row.selection = { method: score === 4 ? 'filename' : ready.length > 1 ? 'automatic' : 'unique', policy: VERSION_POLICY,
        matchedVia: ready[0].matchedVia, alternatives: ready.length, reason: score === 4 ? 'Requested filename.' : matchReason + automaticVersionReason(ready[0], ready[1]) };
    }
    else if (ready.length) { row.status = 'ambiguous'; row.message = competingTitles ? 'Several different titles share this shortened name. Choose the intended game.' : 'Matches exist on multiple platforms. Choose a platform.'; }
    else { row.status = 'blocked'; row.message = 'No complete, unambiguous disk set is available.'; }
  }
  return refreshProgramList(rows);
}
