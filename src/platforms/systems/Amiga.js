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
        '--cursorwidth': '0.5em',
        '--portrait-fontsize': '100%'
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
                puae_cpu_compatibility: "exact",
                puae_crop_mode: "auto"
            };
        }

        return {
            puae_cpu_compatibility: "exact",
            puae_video_vresolution: "single",
            puae_video_resolution: "hires",
            puae_crop_mode: "auto"
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
    keyboard_controller_info: {
        "Arrow Keys": "Joystick Directions",
        "Z": "Joystick Fire",
        "Mouse": "Mouse"
    },
    arrow_keys: {
        up: { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
        down: { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
        left: { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 },
        right: { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 }
    },
    touch_controllers: [
        JOYSTICK_TOUCH_MODE.QUICKJOY_PRIMARY,
        JOYSTICK_TOUCH_MODE.QUICKSHOT_DYNAMIC,
        JOYSTICK_TOUCH_MODE.HIDEAWAY,
    ],
    mouse_controllers: [
        MOUSE_TOUCH_MODE.TRACKPAD_BUTTONS
    ],
    touch_controller_mapping: {
        input_player1_x: 'nul',
        input_player1_y: 'nul',
        input_player1_c: 'nul',
        input_player1_a: 'nul',
        input_player1_l: 'nul',
        input_player1_r: 'nul',
        input_player1_select: 'nul',
        input_player1_start: 'nul',
        input_player1_l2: 'F13', //lmb
        input_player1_r2: 'F14', //rmb
        input_player1_b: 'F15' //fire
    },
    fire_buttons: 1,
    keyboard: {
        shiftKey: 2,
        overrides: {
        }
    },
    additional_keyboard: {
        "layerF": [
            { "id": "keyFA29", "value": "ArrowUp", "code": "ArrowUp", "label": "↑" },
            { "id": "keyFA39", "value": "ArrowDown", "code": "ArrowDown", "label": "↓" },
            { "id": "keyF21", "value": "ArrowLeft", "code": "ArrowLeft", "label": "←" },
            { "id": "keyF22", "value": "ArrowRight", "code": "ArrowRight", "label": "→" },
            { "id": "keyF14", "value": "F1", "code": "F1", "label": "F1" },
            { "id": "keyF15", "value": "F2", "code": "F2", "label": "F2" },
            { "id": "keyF16", "value": "F3", "code": "F3", "label": "F3" },
            { "id": "keyF24", "value": "F4", "code": "F4", "label": "F4" },
            { "id": "keyF25", "value": "F5", "code": "F5", "label": "F5" },
            { "id": "keyF26", "value": "F6", "code": "F6", "label": "F6" },
            { "id": "keyF34", "value": "F7", "code": "F7", "label": "F7" },
            { "id": "keyF35", "value": "F8", "code": "F8", "label": "F8" },
            { "id": "keyF36", "value": "F9", "code": "F9", "label": "F9" },
            { "id": "keyF45", "value": "F10", "code": "F10", "label": "F10" },
            { "id": "keyFL11", "value": "shift", "code": "ShiftLeft", "label": "LShift" },
            { "id": "keyFR11", "value": "shift", "code": "ShiftRight", "label": "RShift" }
        ]
    },
    additional_buttons: {
    },
    rewind_granularity: 25,
    fastforward_ratio: 10,
};

export default Amiga;





