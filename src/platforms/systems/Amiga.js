import PlatformBase from '../PlatformBase.js';
import { StorageManager } from '../../storage/StorageManager.js';
import { JOYSTICK_TOUCH_MODE, MOUSE_TOUCH_MODE } from '../../Constants.js';

const Amiga = {
    ...PlatformBase,
    not_ready: true,
    platform_id: 'amiga',
    core: 'puae',
    bios: ['kick1x', 'kick2x', 'kick3x'],
    platform_name: 'Commodore Amiga',
    short_name: 'Amiga',
    theme: {
        '--color0': '#A7A7A7',
        '--color1': '#000000',
        '--color2': '#666666',
        '--color3': '#ffffff',
        '--color4': '#6780ae',
        '--font': 'Topaz1200',
        '--cursorwidth': '0.5em'
    },
    startup_beforelaunch: async function (nostalgist, storageManager) {
        const FS = nostalgist.getEmscriptenFS();

        const k1xAB = await storageManager.getFile('amiga.kick34005.A500');
        const k2xAB = await storageManager.getFile('amiga.kick40063.A600');
        const k3xAB = await storageManager.getFile('amiga.kick40068.A1200');

        FS.writeFile('/home/web_user/retroarch/userdata/system/kick34005.A500', await new Uint8Array(k1xAB));
        FS.writeFile('/home/web_user/retroarch/userdata/system/kick40063.A600', await new Uint8Array(k2xAB));
        FS.writeFile('/home/web_user/retroarch/userdata/system/kick40068.A1200', await new Uint8Array(k3xAB));
    },
    guessConfig: (fileName) => {
        if (fileName.endsWith(".adf")) {
            return {
                puae_model: "A500",
                puae_kickstart: "kick34005.A500",
                puae_video_vresolution: "single",
                puae_video_resolution: "hires",
                puae_cpu_compatibility: "exact"
            };
        }

        return {
            puae_cpu_compatibility: "exact",
            puae_video_vresolution: "single",
            puae_video_resolution: "hires",
            puae_crop: "auto"
        };
    },
    shader: ['assets/shaders/crt/crt-geom.glslp', 'assets/shaders/crt/shaders/crt-geom.glsl'],
    // force_scale: true,
    video_smooth: false,
    dependencies: [
        {
            key: "kick34005.A500",
            type: "A500 Kickstart v1.3 rev 34.005",
            required: true,
            accepted: ["82a21c1890cae844b3df741f2762d48d"]
        },
        {
            key: "kick40063.A600",
            type: "A600 Kickstart v3.1 rev 40.063",
            required: true,
            accepted: ["e40a5dfb3d017ba8779faba30cbd1c8e"]
        },
        {
            key: "kick40068.A1200",
            type: "A1200 Kickstart v3.1 rev 40.068",
            required: true,
            accepted: ["646773759326fbac3b2311fd8c8793ee"]
        },
    ],
    touch_controllers: [
        JOYSTICK_TOUCH_MODE.QUICKJOY_PRIMARY,
        JOYSTICK_TOUCH_MODE.QUICKSHOT_DYNAMIC,
        JOYSTICK_TOUCH_MODE.HIDEAWAY,
    ],
    mouse_controllers: [
        MOUSE_TOUCH_MODE.TRACKPAD_BUTTONS
    ],
    touch_controller_mapping: {
        input_player1_l2: 'F13', //lmb
        input_player1_r2: 'F14', //rmb
    },
    fire_buttons: 1,
    keyboard: {
        shiftKey: 2,
        overrides: {
        }
    },
    additional_buttons: {

    },
    rewind_granularity: 25,
    fastforward_ratio: 10,
};

export default Amiga;





