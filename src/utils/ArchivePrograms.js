import JSZip from 'jszip';
import { computeBlobSha256 } from './HashUtils.js';
import { buildAtari800DiskSet } from './Atari800DiskSets.js';

export class ArchiveSelectionCancelled extends Error {}

export function archiveSelection(coreConfig) {
    return coreConfig?._vmeArchive || null;
}

export function sameArchiveProgram(a, b) {
    if (!a || !b) return !a && !b;
    return a.entryPath === b.entryPath && a.archiveHash === b.archiveHash;
}

export function saveGameKey(save) {
    const member = archiveSelection(save.launch_core_config);
    return JSON.stringify(member
        ? [save.platform_id, member.archiveHash, member.entryPath]
        : [save.platform_id, save.program_name]);
}

function safePath(path) {
    return path && !path.startsWith('/') && !path.includes('\\')
        && !path.split('/').some(part => part === '..' || part === '.' || part === '')
        && !/[:\u0000-\u001f]/.test(path);
}

export async function readProgramArchive(blob, extensions) {
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const supported = new Set(extensions.map(ext => ext.toLowerCase()));
    const paths = Object.values(zip.files).filter(file => {
        const path = file.name;
        return !file.dir && safePath(path)
            && (!file.unsafeOriginalName || file.unsafeOriginalName === path)
            && !path.split('/').some(part => part === '__MACOSX' || part.startsWith('.'))
            && supported.has(path.split('.').pop().toLowerCase());
    }).map(file => file.name).sort((a, b) => {
        const left = a.toLowerCase(), right = b.toLowerCase();
        return left < right ? -1 : left > right ? 1 : a < b ? -1 : a > b ? 1 : 0;
    });
    if (!paths.length) throw new Error('No supported Atari programs found in this ZIP.');
    return { zip, paths };
}

// Nostalgist flattens and sanitizes file names. Use deterministic aliases and
// rewrite playlists so subdirectories and duplicate basenames remain unambiguous.
export async function extractArchiveProgram(archive, blob, archiveName, entryPath, remembered = null) {
    if (!archive.paths.includes(entryPath)) throw new Error(`ZIP program is missing: ${entryPath}`);
    const archiveHash = await computeBlobSha256(blob);
    if (remembered?.archiveHash && remembered.archiveHash !== archiveHash) {
        throw new Error('The ZIP has changed since this program was saved. Select it again from Browse.');
    }
    const detectedSet = remembered ? null : buildAtari800DiskSet(archive.paths.map(romName => ({ romName })), entryPath);
    const setPaths = remembered?.diskPaths && remembered?.launchName === 'vme_program.m3u' && !/\.m3u$/i.test(entryPath)
        ? remembered.diskPaths : detectedSet?.selected.map(item => item.romName);
    if (setPaths?.length) entryPath = setPaths[0];
    const extension = entryPath.split('.').pop().toLowerCase();
    const fileName = setPaths?.length ? 'vme_program.m3u' : `vme_program.${extension}`;
    let content = await archive.zip.file(entryPath).async('blob');
    const launchFiles = [];
    const diskPaths = [];
    const addDisk = async path => {
        if (!archive.paths.includes(path) || !/\.(atr|atx|xfd|dcm|cas)$/i.test(path)) {
            throw new Error(`Unsupported or missing playlist file: ${path}`);
        }
        const alias = `vme_disk_${launchFiles.length}.${path.split('.').pop().toLowerCase()}`;
        launchFiles.push({ fileName: alias, fileContent: await archive.zip.file(path).async('blob') });
        diskPaths.push(path);
        return alias;
    };
    if (setPaths?.length) {
        const rewritten = [];
        for (const path of setPaths) rewritten.push(await addDisk(path));
        content = new Blob([rewritten.join('\n')]);
    } else if (extension === 'm3u') {
        const base = entryPath.split('/').slice(0, -1);
        const lines = (await content.text()).replace(/^\uFEFF/, '').split(/\r?\n/);
        const rewritten = [];
        for (const line of lines) {
            const reference = line.trim();
            if (!reference || reference.startsWith('#')) { rewritten.push(line); continue; }
            const parts = [...base];
            for (const part of reference.replaceAll('\\', '/').split('/')) {
                if (part === '..') { if (!parts.length) throw new Error('Playlist path leaves the ZIP.'); parts.pop(); }
                else if (part && part !== '.') parts.push(part);
            }
            const path = parts.join('/');
            if (reference.startsWith('/') || !archive.paths.includes(path) || /\.m3u$/i.test(path)) {
                throw new Error(`Unsupported or missing playlist file: ${reference}`);
            }
            rewritten.push(await addDisk(path));
        }
        if (!launchFiles.length) throw new Error('The playlist contains no supported files.');
        content = new Blob([rewritten.join('\n')]);
    }
    const files = [{ fileName, fileContent: content }, ...launchFiles];
    let saveBlob = content;
    if (diskPaths.length) {
        const bundle = new JSZip();
        for (const file of files) {
            bundle.file(file.fileName, await file.fileContent.arrayBuffer(), { date: new Date('1980-01-01T00:00:00Z') });
        }
        saveBlob = new Blob([await bundle.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })], { type: 'application/zip' });
    }
    const selection = { version: 1, archiveName, archiveHash, entryPath, storage: diskPaths.length ? 'bundle' : 'entry' };
    if (diskPaths.length) Object.assign(selection, { diskPaths, launchName: fileName });
    return archiveLaunchPackage(files, saveBlob, selection);
}

function archiveLaunchPackage(launchFiles, saveBlob, selection, diskIndex = 0) {
    const disks = launchFiles.slice(1);
    const names = selection.diskPaths || disks.map(file => file.fileName);
    return {
        launchFiles, saveBlob, programName: selection.entryPath,
        suppressDiskUi: disks.length === 0,
        selectedNames: names, selectedDisplayNames: names,
        selectedLaunchNames: disks.map(file => file.fileName),
        selectedDiskBlobs: disks.map(file => file.fileContent),
        diskIndex: Number.isInteger(diskIndex) ? Math.max(0, Math.min(disks.length - 1, diskIndex)) : 0,
        archiveSelection: { ...selection }
    };
}

// Saved payloads are self-contained; restoring never needs the original ZIP.
export async function restoreArchiveProgram(blob, selection, diskIndex = 0) {
    const extension = selection.entryPath.split('.').pop().toLowerCase();
    const fileName = selection.launchName || `vme_program.${extension}`;
    if (!/^vme_program\.[a-z0-9]+$/.test(fileName)) throw new Error('Invalid saved program name.');
    let launchFiles = [{ fileName, fileContent: blob }];
    if (selection.storage === 'bundle') {
        const zip = await JSZip.loadAsync(await blob.arrayBuffer());
        const primary = zip.file(fileName);
        if (!primary) throw new Error('Saved playlist is missing from the program bundle.');
        launchFiles = [{ fileName, fileContent: await primary.async('blob') }];
        for (const file of Object.values(zip.files).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))) {
            if (file.dir || file.name === fileName) continue;
            if (!/^vme_disk_\d+\.[a-z0-9]+$/.test(file.name)) throw new Error('Invalid saved playlist file.');
            launchFiles.push({ fileName: file.name, fileContent: await file.async('blob') });
        }
    }
    if (selection.diskPaths && selection.diskPaths.length !== launchFiles.length - 1) throw new Error('Saved disk set is incomplete.');
    return archiveLaunchPackage(launchFiles, blob, selection, diskIndex);
}
