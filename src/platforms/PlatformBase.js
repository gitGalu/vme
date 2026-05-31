// Thumbnails are served from the libretro-thumbnails GitHub mirror via jsDelivr.
// Unlike thumbnails.libretro.com (no CORS headers), jsDelivr sends
// `access-control-allow-origin: *` and `cross-origin-resource-policy: cross-origin`,
// so the images load under `Cross-Origin-Embedder-Policy: require-corp` — which the
// multithreaded cores (e.g. DOSBox Pure, needing SharedArrayBuffer) require, and
// which Safari only honours with `require-corp` (it does not support `credentialless`).
const LIBRETRO_THUMBNAILS_BASE = 'https://cdn.jsdelivr.net/gh/libretro-thumbnails';

// Map a libretro system name to its mirror repository name. The rule is simply
// "space -> underscore", with one repo that was renamed on GitHub (jsDelivr does
// not follow GitHub's repo redirects).
const THUMBNAIL_REPO_OVERRIDES = {
    'Atari - 8-bit': 'Atari_-_8-bit_Family',
};

function thumbnailRepoName(systemName) {
    return THUMBNAIL_REPO_OVERRIDES[systemName] || systemName.replace(/ /g, '_');
}

export default {
    platform_id: '',
    core: '',
    multidisk: false,
    platform_name: '',
    short_name: '',
    theme: {},
    dependencies: '',
    fire_buttons: 0,
    additional_buttons: {},
    libretro_thumbnails_system: null,
    getThumbnailUrls() {
        if (!this.libretro_thumbnails_system) {
            return null;
        }
        const repo = thumbnailRepoName(this.libretro_thumbnails_system);
        const base = `${LIBRETRO_THUMBNAILS_BASE}/${encodeURIComponent(repo)}@master`;
        return {
            boxarts: `${base}/Named_Boxarts/`,
            snaps: `${base}/Named_Snaps/`,
            titles: `${base}/Named_Titles/`
        };
    }
};
