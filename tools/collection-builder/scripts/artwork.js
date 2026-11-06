import { matchThumbnails } from '../../../src/utils/ThumbnailMatching.js';

export const artworkLabels = { snaps: 'Screenshot', titles: 'Title screen', boxarts: 'Box art' };

export function createArtworkService({ platforms, loadIndex, fetchImage, convertImage }) {
  const systems = new Map(platforms.map(platform => [platform.id, platform]));
  const indexes = new Map(), pending = new Map();
  const abort = signal => { if (signal?.aborted) throw new DOMException('Image download cancelled.', 'AbortError'); };
  const indexFor = async (platform, signal) => {
    if (indexes.has(platform)) return indexes.get(platform);
    if (pending.has(platform)) return pending.get(platform);
    const request = Promise.resolve().then(() => loadIndex(platform, { signal })).then(index => {
      abort(signal); indexes.set(platform, index); return index;
    }).finally(() => pending.delete(platform));
    pending.set(platform, request); return request;
  };
  const find = async (entry, { signal } = {}) => {
    abort(signal);
    const platform = systems.get(entry.platform_id);
    if (!platform?.thumbnailUrls) return [];
    const index = await indexFor(entry.platform_id, signal);
    abort(signal);
    const names = [entry.originalName, entry.filename, ...(entry.disks || []).map(disk => disk.filename), entry.title]
      .filter(Boolean).flatMap(name => {
        const leaf = name.split(/[\\/]/).pop();
        return [leaf, leaf.replace(/\.zip$/i, '')];
      });
    return matchThumbnails(index, platform.thumbnailUrls, names);
  };
  return {
    supported: entry => !!systems.get(entry.platform_id)?.thumbnailUrls,
    find,
    async download(entry, candidate, { signal } = {}) {
      // The source must be an indexed match for this game/platform.
      const candidates = await find(entry, { signal });
      const match = candidates.find(item => item.layer === candidate.layer && item.url === candidate.url);
      if (!match) throw new Error('This image is not an indexed match for the selected game.');
      const file = await fetchImage(match.url, { signal });
      abort(signal);
      const blob = await convertImage(file);
      abort(signal);
      return { blob, source: { ...match, provider: 'libretro-thumbnails' } };
    },
    async downloadMissing(entries, { signal, onProgress = () => {}, onImage = () => {} } = {}) {
      const summary = { downloaded: 0, skipped: 0, unmatched: 0, failed: 0, errors: [] };
      for (const [index, entry] of entries.entries()) {
        abort(signal);
        onProgress({ index: index + 1, total: entries.length, title: entry.title });
        if (entry.imageOverride || entry.imagePath) { summary.skipped++; continue; }
        try {
          const candidates = await find(entry, { signal });
          if (!candidates.length) { summary.unmatched++; continue; }
          let result, lastError;
          for (const candidate of candidates) {
            try { result = await this.download(entry, candidate, { signal }); break; }
            catch (cause) { abort(signal); lastError = cause; }
          }
          if (!result) throw lastError;
          abort(signal);
          await onImage(entry, result); summary.downloaded++;
        } catch (cause) {
          abort(signal); summary.failed++; summary.errors.push({ key: entry.key, title: entry.title, message: cause.message });
        }
      }
      return summary;
    }
  };
}
