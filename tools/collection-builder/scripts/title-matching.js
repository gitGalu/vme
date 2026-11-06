import { fold } from './model.js';

const romans = new Map();
for (let number = 1; number <= 39; number++) {
  let remaining = number, roman = '';
  for (const [value, token] of [[10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']]) {
    while (remaining >= value) { roman += token; remaining -= value; }
  }
  romans.set(roman, String(number));
}
const partWords = new Set(['part', 'episode', 'chapter', 'volume', 'vol']);
const connectors = new Set(['in', 'and', 'the', 'a', 'an', 'of', 'on', 'at', 'with', 'vs', 'versus', 'to', 'for']);
const compact = value => value.replace(/ /g, '');
const digits = words => words.filter(word => /^\d+$/.test(word)).join(',');

export function canonicalTitle(value) {
  const words = fold(value).split(' ');
  return words.map((word, index) => {
    // Single letters can be part of a name (e.g. Mega Man X). Require an
    // explicit part label for I/V/X; multi-letter canonical numerals are clear.
    if (romans.has(word) && (word.length > 1 || partWords.has(words[index - 1]))) return romans.get(word);
    return word;
  }).join(' ');
}

function shortEnough(prefix, full) {
  const words = prefix.split(' '), all = full.split(' ');
  const meaningful = words.filter(word => !connectors.has(word));
  return meaningful.length >= 2 && words.length < all.length && digits(words) === digits(all);
}

export function shorterTitleKeys(value) {
  const full = canonicalTitle(value), words = full.split(' '), result = new Set();
  const add = prefix => {
    if (shortEnough(prefix, full)) { result.add(prefix); result.add(compact(prefix)); }
  };
  for (let index = 2; index < words.length; index++) {
    if (!connectors.has(words[index])) continue;
    // Never trim a base ending in a connector/article, or retain only an
    // article as the omitted suffix. "Ruff and Reddy in ..." is a valid split.
    if (connectors.has(words[index - 1])) continue;
    const suffix = words.slice(index).filter(word => !connectors.has(word));
    if (suffix.length) add(words.slice(0, index).join(' '));
  }
  for (const prefix of String(value).split(/\s*:\s*|\s+[-–—]\s+/).slice(0, -1)) {
    const key = canonicalTitle(prefix);
    if (full.startsWith(`${key} `)) add(key);
  }
  return result;
}

export function titleMatchForms(values) {
  const literal = new Set(), canonical = new Set(), shorter = new Set();
  for (const value of values) {
    const plain = fold(value), normalized = canonicalTitle(value);
    if (!plain) continue;
    literal.add(plain); literal.add(compact(plain));
    canonical.add(normalized); canonical.add(compact(normalized));
    for (const key of shorterTitleKeys(value)) shorter.add(key);
  }
  return { literal, canonical, shorter, keys: new Set([...literal, ...canonical, ...shorter]) };
}

// Cheap prefix screening keeps the richer rules off unrelated catalog rows.
// It only narrows the scan; the full matcher still decides every match.
export function createTitlePrefilter(queries) {
  const heads = new Set([...queries].flatMap(query => [...query.keys].map(key => key.split(' ')[0])));
  for (const [roman, number] of romans) if (heads.has(number)) heads.add(roman);
  const root = { children: new Map(), terminal: false };
  for (const head of heads) {
    let node = root;
    for (const character of head) {
      if (!node.children.has(character)) node.children.set(character, { children: new Map(), terminal: false });
      node = node.children.get(character);
    }
    node.terminal = true;
  }
  return keys => {
    for (const key of keys) {
      let node = root;
      for (const character of key) {
        node = node.children.get(character);
        if (!node) break;
        if (node.terminal) return true;
      }
    }
    return false;
  };
}

const intersects = (left, right) => [...left].some(key => right.has(key));
export function titleMatchKind(query, candidate) {
  if (intersects(query.literal, candidate.literal)) return 'title';
  if (intersects(query.canonical, candidate.canonical)) return 'numeral';
  if (intersects(query.shorter, candidate.canonical) || intersects(candidate.shorter, query.canonical)) return 'shortened';
  return null;
}

export function titleFamily(keys) {
  // The existing source keys include metadata-free names and WHDLoad names.
  // Pick their shortest canonical form to group release variants, preserving
  // every sequel number. This is only used to disambiguate shortened matches.
  return [...keys].map(key => compact(canonicalTitle(key))).filter(Boolean)
    .sort((a, b) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0))[0] || '';
}
