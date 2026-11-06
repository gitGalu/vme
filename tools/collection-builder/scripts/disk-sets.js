import { DiskSetBuilder } from '../../../src/utils/DiskSetBuilder.js';
import { parseAtari800Disk, buildAtari800DiskSet } from '../../../src/utils/Atari800DiskSets.js';

const directory = url => { try { const parsed = new URL(url); return parsed.origin + parsed.pathname.slice(0, parsed.pathname.lastIndexOf('/') + 1); } catch { return ''; } };
const diskName = entry => entry.originalName || entry.filename;
export const atariDiskName = name => /\.zip$/i.test(name) ? name.replace(/(?:\.(?:atr|atx|xfd|dcm))?\.zip$/i, '.atr') : name;

// Index once by catalog/platform/family. Resolving visible rows never scans an
// entire software directory, and disks from different imports cannot mix.
export function createDiskSetResolver(entries, platforms) {
  const enabled = new Map(platforms.filter(platform => platform.multidisk).map(platform => [platform.id, platform]));
  const groups = new Map(), indexed = new Map(), cache = new Map();
  for (const entry of entries) {
    if (entry.disks || !enabled.has(entry.platform_id)) continue;
    const atari = enabled.get(entry.platform_id).core === 'atari800';
    const candidate = { romName: atari ? atariDiskName(diskName(entry)) : diskName(entry), url: entry.url, size: entry.size, entry };
    const parsed = atari ? parseAtari800Disk(candidate) : DiskSetBuilder.parseEntry(candidate);
    if (!parsed) continue;
    const group = JSON.stringify([entry.sourceId, entry.catalogId, entry.platform_id,
      atari ? [parsed.family, directory(entry.url)] : parsed.titleKey]);
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(candidate); indexed.set(entry.key, { candidate, parsed, group, atari });
  }
  return entry => {
    if (entry.disks) return { disks: entry.disks, ...entry.diskSet };
    if (cache.has(entry.key)) return cache.get(entry.key);
    const anchor = indexed.get(entry.key);
    if (!anchor) return null;
    if (anchor.parsed.diskTotal > 99) return { disks: [entry], total: anchor.parsed.diskTotal,
      missing: ['disk count exceeds 99'], lowConfidence: [], isComplete: false, isConfident: true };
    const family = groups.get(anchor.group);
    let set = anchor.atari
      ? buildAtari800DiskSet(family, anchor.candidate.romName, anchor.candidate.url)
      : DiskSetBuilder.buildBestSet(family, anchor.candidate.romName, anchor.candidate.url);
    if (!set && anchor.atari) {
      // The runtime deliberately returns null for incomplete/ambiguous sets.
      // Keep its conservative family identity, but expose the failure in review.
      const parsed = family.map(parseAtari800Disk);
      const diskCount = Math.max(...parsed.map(disk => disk.diskTotal || disk.diskNo));
      const sideCount = Math.max(...parsed.map(disk => disk.sideTotal || disk.sideNo));
      const selected = [], missing = [], lowConfidence = [];
      for (let disk = 1; disk <= diskCount; disk++) for (let side = 1; side <= sideCount; side++) {
        const matches = parsed.filter(item => item.diskNo === disk && item.sideNo === side);
        const label = sideCount > 1 ? `${disk}/${side}` : `${disk}`;
        if (!matches.length) missing.push(label);
        else {
          selected.push(matches.find(item => item.entry.key === entry.key) || matches[0]);
          if (matches.length > 1) lowConfidence.push({ diskNo: label, top1: matches[0].entry.filename, top2: matches[1].entry.filename });
        }
      }
      if (new Set(parsed.map(item => item.diskTotal).filter(Boolean)).size > 1
          || new Set(parsed.map(item => item.sideTotal).filter(Boolean)).size > 1) lowConfidence.push({ diskNo: 'total', top1: 'Conflicting disk counts', top2: '' });
      set = { selected, missing, lowConfidence, total: diskCount * sideCount, isComplete: !missing.length, isConfident: !lowConfidence.length };
    }
    if (!set) return null;
    if (set.total < 2) return null;
    const result = { disks: set.selected.map(disk => ({ ...disk.entry })), total: set.total,
      missing: set.missing || [], lowConfidence: set.lowConfidence || [], isComplete: set.isComplete, isConfident: set.isConfident };
    cache.set(entry.key, result); return result;
  };
}

export function selectDiskSet(entry, resolve) {
  const set = resolve(entry);
  if (!set || entry.disks) return structuredClone(entry);
  const { disks, ...diskSet } = set;
  const stem = (disks[0]?.filename || entry.filename).replace(/\.[^.]+$/, '').replace(/\(\s*disk\s*\d+\s*of\s*\d+\s*\)/ig, '')
    .replace(/\b(?:disk\s*\d+(?:\s*of\s*\d+)?|side\s*[a-z0-9]+(?:\s*of\s*\d+)?)\b/ig, '')
    .replace(/\(\s*\)/g, '').replace(/\s+/g, ' ').trim();
  return { ...entry, filename: `${stem || entry.title}.zip`, url: '', filePath: '', disks: structuredClone(disks), diskSet };
}

export function diskSetLabel(set) {
  if (!set) return '';
  return `${set.disks.length}/${set.total ?? set.disks.length} disks${set.isComplete === false ? ` · missing ${(set.missing || []).join(', ')}` : ''}${set.isConfident === false ? ' · ambiguous variants' : ''}`;
}
