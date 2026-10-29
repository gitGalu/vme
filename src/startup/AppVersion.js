// Release versions use numeric components (for example 0.97 or 1.0.2).
function versionParts(version) {
    return typeof version === 'string' && /^\d+(?:\.\d+)*$/.test(version)
        ? version.split('.').map(Number)
        : null;
}

function isNewerVersion(current, previous) {
    const a = versionParts(current);
    const b = versionParts(previous);
    if (!a || !b) return false;
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
        const difference = (a[i] ?? 0) - (b[i] ?? 0);
        if (difference !== 0) return difference > 0;
    }
    return false;
}

export class AppVersion {
    static STORAGE_KEY = 'LAST_APP_VERSION';

    #storage;
    #info;

    constructor(currentVersion, storage) {
        this.#storage = storage;
        let previousVersion = null;
        try {
            const stored = storage.getValue(AppVersion.STORAGE_KEY);
            if (versionParts(stored)) previousVersion = stored;
        } catch {
            // Storage can be unavailable; version detection must not block startup.
        }
        this.#info = Object.freeze({
            currentVersion,
            previousVersion,
            isFirstRun: previousVersion === null,
            isUpdate: previousVersion !== null && isNewerVersion(currentVersion, previousVersion),
        });
    }

    get info() {
        return this.#info;
    }

    // Call only after successful startup. Detection alone does not consume an update.
    remember() {
        try {
            this.#storage.storeValue(AppVersion.STORAGE_KEY, this.#info.currentVersion);
            return true;
        } catch {
            return false;
        }
    }
}
