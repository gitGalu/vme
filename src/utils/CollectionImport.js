import JSZip from 'jszip';
import { buildCollectionDiskBundle, prepareCollectionDiskBundle, validateCollectionDisks } from './CollectionDiskSet.js';

export class CollectionImportError extends Error {
    constructor(cause, context) {
        const location = [context.entryIndex ? `Game ${context.entryIndex}${context.title ? ` (${context.title})` : ''}` : 'Collection',
            context.platform_id, context.diskIndex ? `disk ${context.diskIndex}` : '', context.path || context.url].filter(Boolean).join(' · ');
        super(`${location} · ${context.stage}: ${cause?.message || String(cause)}`, { cause });
        this.name = 'CollectionImportError';
        this.context = { ...context };
    }
}

export function collectionImportIssue(error) {
    return { message: error?.message || String(error), detail: error?.cause?.message || error?.message || String(error),
        ...(error?.context || { stage: 'archive' }) };
}

// Decode using the same browser image support as the collection UI. No canvas,
// object URL or bitmap is retained after validation.
export async function checkCollectionImage(blob) {
    if (typeof Image === 'undefined') return;
    const url = URL.createObjectURL(blob);
    try {
        const image = new Image(); image.src = url; await image.decode();
        if (!image.naturalWidth || !image.naturalHeight) throw new Error('Image has no dimensions.');
    } finally { URL.revokeObjectURL(url); }
}

const safePath = path => typeof path === 'string' && path && !path.startsWith('/') && !/[\\:\u0000-\u001f]/.test(path)
    && !path.split('/').some(part => !part || part === '.' || part === '..');
const requiredText = (value, name) => { if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} must be a non-empty string.`); };

// Shared by PlatformManager.loadCollectionFile and the isolated developer tool.
// Callers supply storage/network adapters; this module never opens a database.
export async function importCollectionArchive(input, { platforms, storage, network, signal, onProgress = () => {},
    downloadLinks = true, checkImage = checkCollectionImage } = {}) {
    const abort = () => { if (signal?.aborted) throw new DOMException('Collection import cancelled.', 'AbortError'); };
    const at = async (stage, context, action) => {
        abort(); const position = { ...context, stage }; onProgress(position);
        try { const result = await action(); abort(); return result; }
        catch (cause) {
            abort();
            if (cause?.name === 'AbortError' || cause instanceof CollectionImportError) throw cause;
            throw new CollectionImportError(cause, position);
        }
    };
    const zip = await at('archive', {}, async () => JSZip.loadAsync(input?.arrayBuffer ? await input.arrayBuffer() : input, { checkCRC32: true }));
    const manifest = await at('manifest', { path: 'vme_collection.json' }, async () => {
        const file = zip.file('vme_collection.json');
        if (!file) throw new Error('vme_collection.json is missing from the ZIP root.');
        const value = JSON.parse((await file.async('string')).replace(/^\uFEFF/, ''));
        if (!value || typeof value !== 'object') throw new Error('Invalid collection manifest.');
        requiredText(value.id, 'Collection ID'); requiredText(value.name, 'Collection name');
        if (!Array.isArray(value.list) || !value.list.length) throw new Error('Collection list must contain at least one game.');
        return value;
    });
    const readAsset = async path => {
        if (!safePath(path)) throw new Error(`Invalid archive path: ${path}`);
        const file = zip.file(path);
        if (!file || (file.unsafeOriginalName && file.unsafeOriginalName !== file.name)) throw new Error(`File is missing from the ZIP: ${path}`);
        const blob = await file.async('blob');
        if (!blob.size) throw new Error(`File is empty: ${path}`);
        return blob;
    };
    const image = await at('cover', { path: manifest.image }, async () => {
        const blob = await readAsset(manifest.image); await checkImage(blob); return blob;
    });
    const enabled = new Map(Object.values(platforms).map(platform => [platform.platform_id, platform]));
    const pendingLinks = [], roms = [], requiredFeatures = [];
    const readProgram = async (item, context) => {
        if (!item.url) return at(context.diskIndex ? 'disk' : 'game', { ...context, path: item.file }, () => readAsset(item.file));
        return at(context.diskIndex ? 'disk' : 'game', { ...context, url: item.url }, async () => {
            const url = new URL(item.url);
            if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Use an HTTP(S) program URL without embedded credentials.');
            if (!downloadLinks) { pendingLinks.push({ ...context, url: item.url }); return null; }
            const response = await network.fetch(item.url, false, { signal });
            if (response.ok === false) throw new Error(`Download failed: HTTP ${response.status}`);
            if (/text\/html/i.test(response.headers?.get('content-type') || '')) throw new Error('Program URL returned an HTML page.');
            const blob = await response.blob();
            if (!blob.size) throw new Error('Downloaded program is empty.');
            return blob;
        });
    };
    for (const [index, item] of manifest.list.entries()) {
        const context = { entryIndex: index + 1, total: manifest.list.length, title: item?.title || item?.filename || '', filename: item?.filename, platform_id: item?.platform_id };
        await at('entry', context, () => {
            if (!item || typeof item !== 'object') throw new Error('Invalid game entry.');
            requiredText(item.filename, 'Game filename'); requiredText(item.platform_id, 'Platform ID');
        });
        const platform = await at('platform', context, () => {
            const result = enabled.get(item.platform_id);
            if (!result) throw new Error('Platform is not supported by this VM/E.');
            return result;
        });
        await at('requirements', context, async () => {
            const [, missing] = await storage.checkFiles(platform);
            if (missing.length) throw new Error(`Missing ${item.platform_id} requirements: ${missing.map(value => typeof value === 'string' ? value : value.key || value.name || 'dependency').join(', ')}`);
        });
        const gameImage = await at('image', { ...context, path: item.image }, async () => {
            const blob = await readAsset(item.image); await checkImage(blob); return blob;
        });
        let blob;
        if (item.disks != null) {
            // Older VM/E importers only read `file` or `url`. Keep this
            // requirement visible to callers even when current sources pass.
            if (!item.file && !item.url) requiredFeatures.push({ feature: 'multidisk-collections', ...context });
            const before = pendingLinks.length;
            blob = await at('bundle', context, async () => {
                if (!platform.multidisk || !/\.zip$/i.test(item.filename)) throw new Error('Invalid multi-disk collection entry.');
                // Read every available member, even when link downloads are deferred.
                // The bundle builder validates the disk list before invoking readers.
                if (!downloadLinks && Array.isArray(item.disks) && item.disks.some(disk => disk?.url)) {
                    validateCollectionDisks(item.disks);
                    for (const [diskIndex, disk] of item.disks.entries()) await readProgram(disk, { ...context, diskIndex: diskIndex + 1, diskFilename: disk.filename });
                    return null;
                }
                return buildCollectionDiskBundle(item.disks, item.platform_id, (disk, diskIndex) => readProgram(disk, { ...context, diskIndex: diskIndex + 1, diskFilename: disk.filename }));
            });
            if (pendingLinks.length === before) await at('bundle', context, async () => {
                try { return await prepareCollectionDiskBundle(blob, item.filename, platform); }
                catch (cause) {
                    if (!cause.diskIndex) throw cause;
                    const disk = item.disks[cause.diskIndex - 1];
                    throw new CollectionImportError(cause, { ...context, stage: 'bundle', diskIndex: cause.diskIndex,
                        diskFilename: disk.filename, ...(disk.url ? { url: disk.url } : { path: disk.file }) });
                }
            });
        } else blob = await readProgram(item, context);
        roms.push({ title: item.title ?? '', credits: item.credits ?? '', description: item.description ?? '',
            platform_id: item.platform_id, filename: item.filename, file: blob, data_type: 'blob', image: gameImage });
    }
    const summary = { id: manifest.id, name: manifest.name, checkedGames: roms.length,
        preparedGames: roms.filter(item => item.file).length, pendingLinks, requiredFeatures, storedGames: 0 };
    if (!pendingLinks.length) await at('storage', { total: roms.length }, async () => {
        const stored = await storage.storeCollection(manifest.id, manifest.name, image, roms);
        if (!stored) throw new Error('Collection storage rejected the import.');
        summary.storedGames = roms.length;
    });
    abort(); onProgress({ stage: 'complete', total: roms.length, pendingLinks: pendingLinks.length });
    return summary;
}
