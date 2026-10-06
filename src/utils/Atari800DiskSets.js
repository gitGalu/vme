// Conservative grouping for Atari media: retain version, publisher, dump tags and
// directory in the identity. Only remove the disk/side markers themselves.
export function parseAtari800Disk(entry) {
    const path = entry?.romName;
    if (typeof path !== 'string' || !/\.(atr|atx|xfd|dcm)$/i.test(path)) return null;
    const slash = path.lastIndexOf('/');
    let stem = path.slice(slash + 1).replace(/\.[^.]+$/, '');
    const disk = stem.match(/\bdisk\s*(\d+)(?:\s*of\s*(\d+))?(?![a-z0-9])/i);
    const side = stem.match(/\bside\s*([a-z]|\d+)(?:\s*of\s*(\d+))?(?![a-z0-9])/i)
        || stem.match(/\bs(\d+)\b(?=[,)])/i);
    if (!disk && !side) return null;
    const diskNo = disk ? Number(disk[1]) : 1;
    const sideNo = side ? (/^[a-z]$/i.test(side[1]) ? side[1].toUpperCase().charCodeAt(0) - 64 : Number(side[1])) : 1;
    const diskTotal = disk?.[2] ? Number(disk[2]) : null;
    const sideTotal = side?.[2] ? Number(side[2]) : null;
    if (diskNo < 1 || sideNo < 1 || diskNo > 99 || sideNo > 26
        || (diskTotal !== null && (diskTotal < diskNo || diskTotal > 99))
        || (sideTotal !== null && (sideTotal < sideNo || sideTotal > 26))) return null;
    if (disk) stem = stem.replace(disk[0], '');
    if (side) stem = stem.replace(side[0], '');
    const title = stem.replace(/\(\s*,?\s*\)/g, '').replace(/,\s*\)/g, ')')
        .replace(/\(\s*,/g, '(').replace(/[\s_-]+$/g, '').replace(/\s+/g, ' ').trim();
    if (!title) return null;
    const family = JSON.stringify([path.slice(0, slash + 1),
        title.toLowerCase().replace(/[\s_-]+/g, ' '), Boolean(disk), Boolean(side)]);
    return { ...entry, title, family, diskNo, sideNo, diskTotal, sideTotal };
}

function sourceDirectory(url) {
    if (!url) return null;
    try {
        const parsed = new URL(url, 'https://example.invalid');
        return parsed.origin + parsed.pathname.slice(0, parsed.pathname.lastIndexOf('/') + 1);
    } catch { return null; }
}

export function buildAtari800DiskSet(entries, anchorRomName, anchorUrl = null) {
    const parsed = entries.map(parseAtari800Disk).filter(Boolean);
    const anchor = parsed.find(item => item.romName === anchorRomName && (!anchorUrl || item.url === anchorUrl));
    if (!anchor) return null;
    const candidates = parsed.filter(item => item.family === anchor.family
        && sourceDirectory(item.url) === sourceDirectory(anchor.url));
    if (candidates.length < 2) return null;
    const diskTotals = new Set(candidates.map(item => item.diskTotal).filter(value => value !== null));
    const sideTotals = new Set(candidates.map(item => item.sideTotal).filter(value => value !== null));
    if (diskTotals.size > 1 || sideTotals.size > 1) return null;
    const diskCount = [...diskTotals][0] ?? Math.max(...candidates.map(item => item.diskNo));
    const sideCount = [...sideTotals][0] ?? Math.max(...candidates.map(item => item.sideNo));
    const selected = [];
    for (let diskNo = 1; diskNo <= diskCount; diskNo++) {
        for (let sideNo = 1; sideNo <= sideCount; sideNo++) {
            const matches = candidates.filter(item => item.diskNo === diskNo && item.sideNo === sideNo);
            // A gap or multiple images for a position requires explicit selection.
            if (matches.length !== 1) return null;
            selected.push(matches[0]);
        }
    }
    if (selected.length !== candidates.length) return null;
    return { anchor, title: anchor.title, selected, total: selected.length, isComplete: true, isConfident: true };
}

export function archiveProgramChoices(paths) {
    const parsed = new Map();
    const families = new Map();
    for (const path of paths) {
        const disk = parseAtari800Disk({ romName: path });
        if (!disk) continue;
        parsed.set(path, disk);
        if (!families.has(disk.family)) families.set(disk.family, []);
        families.get(disk.family).push(disk);
    }
    const consumed = new Set();
    const choices = [];
    for (const path of paths) {
        if (consumed.has(path)) continue;
        const disk = parsed.get(path);
        const set = disk ? buildAtari800DiskSet(families.get(disk.family), path) : null;
        if (set) {
            const members = set.selected.map(item => item.romName);
            members.forEach(member => consumed.add(member));
            const directory = members[0].slice(0, members[0].lastIndexOf('/') + 1);
            choices.push({ path: members[0], label: `${directory}${set.title} [${set.total} disks]`, members });
        } else {
            consumed.add(path);
            choices.push({ path, label: path });
        }
    }
    return choices;
}
