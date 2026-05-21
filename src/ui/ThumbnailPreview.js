import { FileUtils } from '../utils/FileUtils.js';
import { SelectedPlatforms } from '../platforms/PlatformManager.js';

const SHOW_DEBOUNCE_MS = 200;
const LAYER_ORDER = ['snaps', 'titles', 'boxarts'];

class ThumbnailPreviewClass {
    #platformManager = null;
    #imgEl = null;
    #currentToken = 0;
    #indexCache = new Map(); // platform_id -> index JSON (or null if failed)
    #pendingFetches = new Map(); // platform_id -> Promise<index>
    #debounceTimer = null;
    #availableLayers = []; // [{layer, url}, ...] for the current selection
    #activeLayerIndex = 0;
    #preferredLayer = 'snaps'; // session-only memory of last layer user picked

    init(platformManager) {
        this.#platformManager = platformManager;
        this.#imgEl = document.getElementById('cli-thumbnail');
        if (!this.#imgEl) return;
        this.#imgEl.addEventListener('load', () => {
            if (this.#imgEl.dataset.token === String(this.#currentToken)) {
                this.#imgEl.classList.add('visible');
            }
        });
        this.#imgEl.addEventListener('error', () => {
            if (this.#imgEl.dataset.token === String(this.#currentToken)) {
                this.#imgEl.classList.remove('visible');
                this.#imgEl.removeAttribute('src');
            }
        });
        this.#imgEl.addEventListener('click', (e) => {
            e.stopPropagation();
            this.#cycleLayer();
        });
    }

    show(romName, platformIdOverride = null) {
        if (!this.#imgEl || !this.#platformManager) return;
        const token = ++this.#currentToken;
        this.#imgEl.classList.remove('visible');
        this.#imgEl.classList.remove('layer-flipping');
        this.#imgEl.removeAttribute('src');
        this.#imgEl.dataset.token = String(token);
        this.#availableLayers = [];
        this.#activeLayerIndex = 0;
        if (this.#debounceTimer) {
            clearTimeout(this.#debounceTimer);
        }
        this.#debounceTimer = setTimeout(() => {
            this.#debounceTimer = null;
            this.#resolve(romName, token, platformIdOverride);
        }, SHOW_DEBOUNCE_MS);
    }

    async #resolve(romName, token, platformIdOverride) {
        if (!this.#imgEl || !this.#platformManager) return;
        if (this.#currentToken !== token) return;
        let platform = null;
        if (platformIdOverride) {
            platform = Object.values(SelectedPlatforms).find(p => p.platform_id === platformIdOverride) || null;
        }
        if (!platform) {
            platform = this.#platformManager.getSelectedPlatform?.();
        }
        if (!platform || typeof platform.getThumbnailUrls !== 'function') {
            this.hide();
            return;
        }
        const urls = platform.getThumbnailUrls();
        if (!urls) {
            this.hide();
            return;
        }
        const key = FileUtils.normalizeForThumbnailMatch(romName);
        if (!key) {
            this.hide();
            return;
        }
        const index = await this.#loadIndex(platform.platform_id);
        if (this.#currentToken !== token) return;
        if (!index) return;

        const layers = [];
        for (const layer of LAYER_ORDER) {
            const layerIndex = index[layer];
            const layerUrl = urls[layer];
            if (!layerIndex || !layerUrl) continue;
            const filename = layerIndex[key];
            if (!filename) continue;
            layers.push({ layer, url: `${layerUrl}${encodeURIComponent(filename)}` });
        }
        if (layers.length === 0) return;

        this.#availableLayers = layers;
        const preferredIdx = layers.findIndex(l => l.layer === this.#preferredLayer);
        this.#activeLayerIndex = preferredIdx >= 0 ? preferredIdx : 0;
        this.#imgEl.src = layers[this.#activeLayerIndex].url;
    }

    #cycleLayer() {
        if (!this.#imgEl) return;
        if (this.#availableLayers.length < 2) return;
        this.#activeLayerIndex = (this.#activeLayerIndex + 1) % this.#availableLayers.length;
        const next = this.#availableLayers[this.#activeLayerIndex];
        this.#preferredLayer = next.layer;
        const token = ++this.#currentToken;
        this.#imgEl.classList.add('layer-flipping');
        this.#imgEl.classList.remove('visible');
        this.#imgEl.dataset.token = String(token);
        this.#imgEl.src = next.url;
    }

    hide() {
        if (!this.#imgEl) return;
        if (this.#debounceTimer) {
            clearTimeout(this.#debounceTimer);
            this.#debounceTimer = null;
        }
        this.#currentToken++;
        this.#availableLayers = [];
        this.#activeLayerIndex = 0;
        this.#imgEl.classList.remove('visible');
        this.#imgEl.classList.remove('layer-flipping');
        this.#imgEl.removeAttribute('src');
    }

    async #loadIndex(platformId) {
        if (!platformId) return null;
        if (this.#indexCache.has(platformId)) return this.#indexCache.get(platformId);
        if (this.#pendingFetches.has(platformId)) return this.#pendingFetches.get(platformId);
        const base = import.meta.env.BASE_URL || '/';
        const url = `${base.endsWith('/') ? base : base + '/'}thumbnail-index/${platformId}.json`;
        const promise = fetch(url)
            .then((res) => res.ok ? res.json() : null)
            .catch(() => null)
            .then((data) => {
                this.#indexCache.set(platformId, data);
                this.#pendingFetches.delete(platformId);
                return data;
            });
        this.#pendingFetches.set(platformId, promise);
        return promise;
    }
}

export const ThumbnailPreview = new ThumbnailPreviewClass();
