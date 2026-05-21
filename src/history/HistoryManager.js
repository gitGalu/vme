import { StorageManager } from '../storage/StorageManager.js';

const KEY = 'recent.history';
const LIMIT = 500;

export class HistoryManager {
    static #cache = null;

    static #load() {
        if (HistoryManager.#cache !== null) return HistoryManager.#cache;
        const raw = StorageManager.getValue(KEY, undefined);
        if (raw == undefined) {
            HistoryManager.#cache = [];
            return HistoryManager.#cache;
        }
        try {
            const parsed = JSON.parse(raw);
            HistoryManager.#cache = Array.isArray(parsed) ? parsed : [];
        } catch {
            HistoryManager.#cache = [];
        }
        return HistoryManager.#cache;
    }

    static #save() {
        StorageManager.storeValue(KEY, JSON.stringify(HistoryManager.#cache || []));
    }

    static record({ romPath, romName, label, platformId }) {
        if (!romPath || !platformId) return;
        const list = HistoryManager.#load();
        const filtered = list.filter(e => !(e.romPath === romPath && e.platformId === platformId));
        filtered.unshift({
            romPath,
            romName: romName || '',
            label: label || romName || '',
            platformId,
            ts: Date.now()
        });
        HistoryManager.#cache = filtered.slice(0, LIMIT);
        HistoryManager.#save();
    }

    static getAll(platformIdFilter = null) {
        const list = HistoryManager.#load();
        if (!platformIdFilter) return list.slice();
        return list.filter(e => e.platformId === platformIdFilter);
    }

    static clear() {
        HistoryManager.#cache = [];
        HistoryManager.#save();
    }

    static formatRelative(ts) {
        const diff = Math.max(0, Date.now() - ts);
        const sec = Math.floor(diff / 1000);
        if (sec < 60) return 'just now';
        const min = Math.floor(sec / 60);
        if (min < 60) return `${min} min ago`;
        const hr = Math.floor(min / 60);
        if (hr < 24) return `${hr}h ago`;
        const day = Math.floor(hr / 24);
        if (day === 1) return 'yesterday';
        if (day < 7) return `${day} days ago`;
        const week = Math.floor(day / 7);
        if (week < 4) return `${week} week${week > 1 ? 's' : ''} ago`;
        const month = Math.floor(day / 30);
        if (month < 6) return `${month} month${month > 1 ? 's' : ''} ago`;
        const d = new Date(ts);
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }
}
