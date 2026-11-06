import { FileUtils } from './FileUtils.js';

export const THUMBNAIL_LAYERS = ['snaps', 'titles', 'boxarts'];

// Shared by the live VM/E preview and the collection builder. Index filenames
// are authoritative: never guess a CDN URL from a cleaned display title.
export function matchThumbnails(index, urls, names) {
    if (!index || !urls) return [];
    const keys = [...new Set(names.flatMap(name => FileUtils.getThumbnailMatchKeys(name)))];
    return THUMBNAIL_LAYERS.flatMap(layer => {
        const filename = keys.map(key => index[layer]?.[key]).find(value => typeof value === 'string' && value);
        return filename && urls[layer] ? [{ layer, filename, url: `${urls[layer]}${encodeURIComponent(filename)}` }] : [];
    });
}
