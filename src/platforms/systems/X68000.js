import PlatformBase from '../PlatformBase.js';
import { JOYSTICK_TOUCH_MODE } from '../../Constants.js';

// px68k reads its ROMs from <system>/keropi/ (iplrom.dat + cgrom.dat).
const KEROPI_DIR = '/home/web_user/retroarch/userdata/system/keropi';

const USERDATA_DIR = '/home/web_user/retroarch/userdata';

// Nostalgist's core table names px68k "PX68k", but the core reports library_name
// "PX68K" and RetroArch sorts states/saves by that name. The Emscripten FS is
// case-sensitive, so Nostalgist would wait forever for a state RetroArch wrote to
// states/PX68K (no toast, nothing saved) and its restore file (.state.auto) would
// never be found. Point Nostalgist's directory at the core's one.
function aliasNostalgistCoreDirectory(FS, parent) {
    const nostalgistDir = `${parent}/PX68k`;
    const coreDir = `${parent}/PX68K`;
    FS.mkdirTree(coreDir);
    if (FS.analyzePath(nostalgistDir, true).exists) {
        if (FS.isLink(FS.lstat(nostalgistDir).mode)) return;
        // Nostalgist writes the restore state here before beforeLaunch; keep it.
        for (const name of FS.readdir(nostalgistDir)) {
            if (name !== '.' && name !== '..') FS.rename(`${nostalgistDir}/${name}`, `${coreDir}/${name}`);
        }
        FS.rmdir(nostalgistDir);
    }
    FS.symlink(coreDir, nostalgistDir);
}

const X68000_CPU_OPTIONS = Object.freeze([
    { value: '10Mhz', label: '10 MHz (X68000)' },
    { value: '16Mhz', label: '16 MHz (XVI)' },
    { value: '25Mhz', label: '25 MHz (X68030)' },
    { value: '33Mhz (OC)', label: '33 MHz (overclock)' }
]);

const X68000_RAM_OPTIONS = Object.freeze([
    { value: '1MB', label: '1 MB' },
    { value: '2MB', label: '2 MB' },
    { value: '4MB', label: '4 MB' },
    { value: '12MB', label: '12 MB' }
]);

const X68000_DEFAULTS = Object.freeze({ cpu: '10Mhz', ram: '2MB' });

function selectedOption(options, value, fallback) {
    return options.some(option => option.value === value) ? value : fallback;
}

function buildX68000LaunchSettings(overrides = null) {
    const selected = overrides && typeof overrides === 'object' ? overrides : {};
    const cpu = selectedOption(X68000_CPU_OPTIONS, selected.cpu, X68000_DEFAULTS.cpu);
    const ram = selectedOption(X68000_RAM_OPTIONS, selected.ram, X68000_DEFAULTS.ram);

    return {
        coreConfig: {
            px68k_cpuspeed: cpu,
            px68k_ramsize: ram,
            // The browser FS is rebuilt on every launch; remembered paths would point nowhere.
            px68k_save_fdd_path: 'disabled',
            px68k_save_hdd_path: 'disabled',
            px68k_midi_output: 'disabled',
            px68k_sc55_emulation: 'disabled'
        },
        overrideValues: { cpu, ram },
        guessedOverrides: { ...X68000_DEFAULTS },
        overrideSchema: [
            { id: 'cpu', label: 'CPU speed', options: X68000_CPU_OPTIONS },
            { id: 'ram', label: 'RAM', options: X68000_RAM_OPTIONS }
        ]
    };
}

const X68000 = {
    ...PlatformBase,
    platform_id: 'x68000',
    core: 'px68k',
    multidisk: true,
    platform_name: 'Sharp X68000',
    short_name: 'X68000',
    libretro_thumbnails_system: 'Sharp - X68000',
    theme: {
        '--color0': '#101014',
        '--color1': '#e8e8ec',
        '--color2': '#9aa0aa',
        '--color3': '#d0202a',
        // KH Dot Font: Keitaro Hiraki's dot fonts for the X68000 (8x16 half-width cells).
        '--font': 'KHDotKodenmachou16',
        '--fontsize': '1.2em',
        '--portrait-fontsize': '100%',
        '--cursorwidth': '0.5em'
    },
    startup_beforelaunch: async function (nostalgist, storageManager) {
        const FS = nostalgist.getEmscriptenFS();
        aliasNostalgistCoreDirectory(FS, `${USERDATA_DIR}/states`);
        aliasNostalgistCoreDirectory(FS, `${USERDATA_DIR}/saves`);
        FS.mkdirTree(KEROPI_DIR);
        for (const file of ['iplrom.dat', 'cgrom.dat']) {
            const bytes = await storageManager.getFileBytes(`x68000.${file}`);
            if (bytes) FS.writeFile(`${KEROPI_DIR}/${file}`, bytes);
        }
    },
    resolveLaunchSettings: (_fileName, overrides = null) => buildX68000LaunchSettings(overrides),
    guessConfig: () => buildX68000LaunchSettings().coreConfig,
    savestates_disabled: false,
    rewind_disabled: true,
    force_scale: true,
    video_smooth: false,
    shader: ['assets/shaders/crt/crt-geom-progressive.glslp', 'assets/shaders/crt/shaders/crt-geom.glsl'],
    dependencies: [
        {
            key: 'iplrom.dat',
            type: 'X68000 IPL ROM (iplrom.dat)',
            required: true,
            accepted: ['7fd4caabac1d9169e289f0f7bbf71d8e']
        },
        {
            key: 'cgrom.dat',
            type: 'X68000 font ROM (cgrom.dat)',
            required: true,
            accepted: ['cb0a5cfcf7247a7eab74bb2716260269']
        }
    ],
    keyboard_controller_info: {
        'Arrow Keys': 'Joystick directions',
        'Z': 'Joystick button A',
        'X': 'Joystick button B',
        'F12': 'PX68K menu'
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
        JOYSTICK_TOUCH_MODE.QUICKSHOT_STATIC,
        JOYSTICK_TOUCH_MODE.HIDEAWAY
    ],
    // 2-button X68000 joystick: RetroPad B -> trigger A, RetroPad A -> trigger B.
    keyboard_controller_mapping: {
        input_player1_b: 'z',
        input_player1_a: 'x',
        input_player1_x: 'nul',
        input_player1_y: 'nul',
        input_player1_l: 'nul',
        input_player1_r: 'nul',
        input_player1_l2: 'nul',
        input_player1_r2: 'nul',
        input_player1_select: 'nul',
        input_player1_start: 'nul'
    },
    // Touch directions use keys px68k ignores (F13-F15, NumLock), so they never type.
    touch_controller_mapping: {
        input_player1_up: 'f13',
        input_player1_left: 'f14',
        input_player1_down: 'f15',
        input_player1_right: 'numlock',
        input_player1_b: 'z',
        input_player1_a: 'x',
        input_player1_x: 'nul',
        input_player1_y: 'nul',
        input_player1_l: 'nul',
        input_player1_r: 'nul',
        input_player1_l2: 'nul',
        input_player1_r2: 'nul',
        input_player1_select: 'nul',
        input_player1_start: 'nul'
    },
    fire_buttons: 2,
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
        1: {
            "label": "RETURN",
            "key": {
                "key": 'enter',
                "code": 'Enter',
            }
        },
        2: {
            "label": "SPACE",
            "key": {
                "key": 'space',
                "code": 'Space',
            }
        }
    }
};

export default X68000;
