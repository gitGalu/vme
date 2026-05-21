const LIBRETRO_THUMBNAILS_BASE = 'https://thumbnails.libretro.com';

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
        const base = `${LIBRETRO_THUMBNAILS_BASE}/${encodeURIComponent(this.libretro_thumbnails_system)}`;
        return {
            boxarts: `${base}/Named_Boxarts/`,
            snaps: `${base}/Named_Snaps/`,
            titles: `${base}/Named_Titles/`
        };
    }
};
