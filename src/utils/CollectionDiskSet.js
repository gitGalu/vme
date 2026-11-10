import JSZip from 'jszip';

// Collection entries with `disks` are stored as one self-contained game blob.
// Only this explicit manifest opts a ZIP into the collection disk-set loader.
const manifestName = 'vme_disks.json';
const extensions = {
    puae: ['adf', 'adz', 'dms', 'fdi', 'raw', 'hdf', 'hdz'],
    hatarib: ['st', 'stx', 'msa', 'dim'],
    cap32: ['dsk'],
    bluemsx: ['dsk'],
    atari800: ['atr', 'atx', 'xfd', 'dcm', 'pro'],
    applewin: ['dsk', 'do', 'po', 'nib', 'woz', '2mg', '2hd', 'hdv'],
    px68k: ['dim', 'img', 'd88', '88d', 'hdm', 'dup', '2hd', 'xdf']
};
const extension = name => String(name).split('.').pop().toLowerCase();
const leaf = name => String(name || '').split(/[\\/]/).pop();
const safe = path => typeof path === 'string' && path && !path.startsWith('/')
    && !/[\\:\u0000-\u001f]/.test(path) && !path.split('/').some(part => !part || part === '.' || part === '..');

export function validateCollectionDisks(disks) {
    if (!Array.isArray(disks) || disks.length < 2 || disks.length > 99) throw new Error('A disk set must contain 2–99 disks.');
    for (const disk of disks) {
        if (!safe(disk?.filename) || leaf(disk.filename) !== disk.filename) throw new Error('Invalid disk filename.');
    }
}

export async function buildCollectionDiskBundle(disks, platformId, readDisk) {
    validateCollectionDisks(disks);
    const zip = new JSZip();
    const date = new Date(1980, 0, 1);
    const manifest = { version: 1, platform_id: platformId, disks: [] };
    for (const [index, disk] of disks.entries()) {
        const data = await readDisk(disk, index);
        const bytes = data instanceof Blob ? new Uint8Array(await data.arrayBuffer()) : data;
        if (!bytes?.byteLength) throw new Error(`${disk.filename}: disk file is empty.`);
        const file = `disks/${String(index + 1).padStart(2, '0')}-${disk.filename}`;
        zip.file(file, bytes, { date, createFolders: false });
        manifest.disks.push({ filename: disk.filename, file });
    }
    zip.file(manifestName, JSON.stringify(manifest), { date });
    return new Blob([await zip.generateAsync({ type: 'uint8array', compression: 'STORE' })], { type: 'application/zip' });
}

export async function prepareCollectionDiskBundle(blob, romName, platform, diskIndex = 0) {
    if (!(blob instanceof Blob) || !/\.zip$/i.test(romName || '')) return null;
    let zip;
    try { zip = await JSZip.loadAsync(await blob.arrayBuffer()); }
    catch { return null; } // Preserve existing handling of non-bundle inputs.
    const file = zip.file(manifestName);
    if (!file) return null;
    const manifest = JSON.parse(await file.async('string'));
    if (manifest.version !== 1 || manifest.platform_id !== platform.platform_id || !platform.multidisk || !extensions[platform.core]) {
        throw new Error('This collection disk set is incompatible with the selected platform.');
    }
    validateCollectionDisks(manifest.disks);
    const files = [], names = [];
    for (const [index, disk] of manifest.disks.entries()) {
        try {
            if (!safe(disk.file) || !zip.file(disk.file)) throw new Error(`${disk.filename}: disk is missing from the collection bundle.`);
            let name = disk.filename;
            let bytes = await zip.file(disk.file).async('uint8array');
            if (extension(name) === 'zip') {
                const inner = await JSZip.loadAsync(bytes);
                const candidates = Object.values(inner.files).filter(entry => !entry.dir && safe(entry.name)
                    && (!entry.unsafeOriginalName || entry.unsafeOriginalName === entry.name)
                    && !entry.name.split('/').some(part => part.startsWith('.') || part === '__MACOSX')
                    && extensions[platform.core].includes(extension(entry.name)));
                if (candidates.length !== 1) throw new Error(`${name}: expected exactly one supported disk image in this disk ZIP; found ${candidates.length}.`);
                name = candidates[0].name;
                bytes = await candidates[0].async('uint8array');
            }
            if (!extensions[platform.core].includes(extension(name))) throw new Error(`${disk.filename}: unsupported disk image for ${platform.platform_id}.`);
            if (!bytes.byteLength) throw new Error(`${disk.filename}: disk file is empty.`);
            // Aliases avoid collisions and Nostalgist's filename sanitization.
            files.push({ fileName: `vme_disk_${index}.${extension(name)}`, fileContent: new Blob([bytes]) });
            names.push(disk.filename);
        } catch (cause) {
            cause.diskIndex = index + 1; cause.diskFilename = disk.filename; throw cause;
        }
    }
    const playlist = new Blob([files.map(disk => disk.fileName).join('\n') + '\n'], { type: 'text/plain' });
    return {
        launchFiles: [{ fileName: 'vme_collection.m3u', fileContent: playlist }, ...files],
        saveBlob: blob, programName: romName,
        selectedNames: names, selectedDisplayNames: names,
        selectedLaunchNames: files.map(disk => disk.fileName), selectedDiskBlobs: files.map(disk => disk.fileContent),
        totalDisks: files.length,
        diskIndex: Number.isInteger(diskIndex) ? Math.max(0, Math.min(files.length - 1, diskIndex)) : 0
    };
}
