// Ranking is metadata-based. Exact filenames and explicit variant filters are
// applied by the matcher before this policy sees the remaining releases.
export const VERSION_POLICY = 'tosec-v1';
const lexical = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const tokens = (name, pattern) => [...name.matchAll(pattern)].map(match => match[1].trim().toLowerCase());
const flagged = (tags, code) => tags.some(tag => new RegExp(`^${code}(?:\\+?\\d+)?(?:\\s.*)?$`).test(tag));

function version(name) {
  const match = name.match(/(?:^|[\s_([,])v(?:ersion)?\s*(\d+(?:\.\d+)*)([a-z]?)(?=$|[\s_()[\],.])/i);
  return match ? [...match[1].split('.').map(Number), ...(match[2] ? [match[2].toLowerCase().charCodeAt(0) - 96] : [])] : [];
}
function compareVersion(a, b) {
  for (let index = 0; index < Math.max(a.length, b.length); index++) {
    const difference = (b[index] || 0) - (a[index] || 0);
    if (difference) return difference;
  }
  return 0;
}

export function versionPreference(candidate, { preferWHDLoad = false } = {}) {
  const names = candidate.disks?.length ? candidate.disks : [candidate.filename];
  const tags = names.flatMap(name => tokens(name, /\[([^\]]+)\]/g));
  const parens = names.flatMap(name => tokens(name, /\(([^)]+)\)/g));
  const bad = flagged(tags, 'b') || tags.some(tag => /bad\s*dump|corrupt/.test(tag));
  const modified = (flagged(tags, 'h') ? 4 : 0) + (flagged(tags, 'm') ? 3 : 0)
    + (flagged(tags, 't') ? 2 : 0) + (flagged(tags, 'tr') ? 1 : 0) + (flagged(tags, 'f') ? 1 : 0);
  const prerelease = [...parens, ...tags].some(token => /^(?:demo|preview|beta|alpha|proto(?:type)?|shareware)(?:\b|\d)/.test(token) || token === 'sw');
  const installer = parens.some(token => /^install(?:er|ation)(?:\b|\s)/.test(token));
  const verified = names.every(name => tokens(name, /\[([^\]]+)\]/g).includes('!'));
  const international = parens.some(token => /^(?:en|eng|english|us|usa|uk|gb|world)(?:$|[, -])/.test(token)
    || /(?:^|[, -])en(?:$|[, -])/.test(token));
  const foreign = parens.some(token => /^(?:fr|de|es|it|nl|pl|ja|jp|ru|pt|sv|fi|da|no|cs|hu|ko|zh)(?:$|[, -])/.test(token));
  const versions = names.map(version).filter(value => value.length).sort(compareVersion);
  const revision = names.map(name => name.match(/\brev(?:ision)?\.?\s*([0-9]+|[a-z])\b/i)?.[1]).filter(Boolean)
    .map(value => /^\d+$/.test(value) ? Number(value) : value.toLowerCase().charCodeAt(0) - 96);
  const years = parens.map(token => token.match(/^((?:19|20)\d{2})(?:$|-)/)?.[1]).filter(Boolean).map(Number);
  const tagPriority = Number.isFinite(candidate.tagPriority) ? candidate.tagPriority
    : candidate.platform_id === 'amiga' && /whdload/i.test(candidate.tag || '') ? -1 : 0;
  return {
    badDump: bad ? 1 : 0, prerelease: prerelease ? 1 : 0, modified,
    whdload: preferWHDLoad && candidate.platform_id === 'amiga' && (candidate.whdload || /whd[\s_-]*load/i.test([candidate.tag, candidate.filename, candidate.source].join(' '))) ? -1 : 0,
    verified: verified ? 0 : 1, alternative: flagged(tags, 'a') ? 1 : 0,
    tagPriority, language: international ? 0 : foreign ? 2 : 1, installer: installer ? 1 : 0,
    year: years.length ? Math.max(...years) : 0, version: versions[0] || [], revision: revision.length ? Math.max(...revision) : 0
  };
}

const priorities = [
  ['badDump', 'no bad-dump flags'], ['prerelease', 'regular release before demo/beta/preview/shareware'],
  ['whdload', 'Prefer WHDLoad enabled'],
  ['modified', 'fewer hack/modification/trainer/translation/fix flags'], ['verified', 'verified [!] dump'],
  ['alternative', 'standard dump before alternative [a]'], ['tagPriority', 'catalog tag priority'],
  ['language', 'English/international tags before unspecified or other languages'],
  ['installer', 'game package before installer-only distribution']
];

export function comparePreferredVersions(a, b) {
  if (a.ready !== b.ready) return a.ready ? -1 : 1;
  const left = a.preference || versionPreference(a), right = b.preference || versionPreference(b);
  for (const [key] of priorities) if ((left[key] || 0) !== (right[key] || 0)) return (left[key] || 0) - (right[key] || 0);
  if (left.year !== right.year) return right.year - left.year;
  const versionDifference = compareVersion(left.version, right.version);
  if (versionDifference) return versionDifference;
  if (left.revision !== right.revision) return right.revision - left.revision;
  for (const key of ['platform_id', 'filename', 'tag', 'source', 'identity', 'key']) {
    const difference = lexical(String(a[key] || ''), String(b[key] || ''));
    if (difference) return difference;
  }
  return 0;
}

export function automaticVersionReason(chosen, runnerUp) {
  if (!runnerUp) return 'Only complete candidate.';
  const left = chosen.preference || versionPreference(chosen), right = runnerUp.preference || versionPreference(runnerUp);
  for (const [key, reason] of priorities) if ((left[key] || 0) !== (right[key] || 0)) return `Automatic TOSEC choice: ${reason}.`;
  if (left.year !== right.year) return `Automatic TOSEC choice: newer declared release year (${left.year}).`;
  if (compareVersion(left.version, right.version)) return `Automatic TOSEC choice: newer declared version (${left.version.join('.')}).`;
  if (left.revision !== right.revision) return `Automatic TOSEC choice: newer declared revision (${left.revision}).`;
  return 'Automatic TOSEC choice: equivalent metadata; stable filename/source order breaks the tie.';
}
