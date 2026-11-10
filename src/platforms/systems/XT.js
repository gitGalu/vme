import PlatformBase from '../PlatformBase.js';
import { JOYSTICK_TOUCH_MODE, MOUSE_TOUCH_MODE } from '../../Constants.js';
import { KeyMaps } from '../../touch/KeyMaps.js';
import xtSystemUrl from '../../assets/xt-system.zip?url';
import { prepareXtLaunchRom } from '../../utils/XtDiskImage.js';

const XT_CPU_OPTIONS = Object.freeze([
    { value: 'Intel 8088', label: 'Intel 8088' },
    { value: 'NEC V20', label: 'NEC V20' }
]);

const XT_SPEED_OPTIONS = Object.freeze([
    { value: 'disabled', label: '4.77 MHz' },
    { value: 'enabled', label: '10 MHz (Turbo)' }
]);

const XT_VIDEO_OPTIONS = Object.freeze([
    { value: 'CGA', label: 'CGA' },
    { value: 'EGA', label: 'EGA' },
    { value: 'HGC', label: 'Hercules (monochrome)' }
]);

const XT_EMS_OPTIONS = Object.freeze([
    { value: 'disabled', label: 'Disabled' },
    { value: 'enabled', label: '2 MB' }
]);

function guessXtLaunchOverrides(fileName) {
    const guessed = { cpu: 'Intel 8088', speed: 'disabled', video: 'CGA', ems: 'disabled' };
    // Only explicit tags select hardware; a game title can contain e.g. "EGA".
    for (const match of String(fileName || '').matchAll(/\[([^\]]+)\]|\(([^)]+)\)/g)) {
        const tag = (match[1] ?? match[2]).trim().toUpperCase().replace(/\s+/g, ' ');
        switch (tag) {
            case '8088':
            case 'INTEL 8088': guessed.cpu = 'Intel 8088'; break;
            case 'V20':
            case 'NEC V20': guessed.cpu = 'NEC V20'; break;
            case '4.77 MHZ':
            case '4.77MHZ': guessed.speed = 'disabled'; break;
            case 'TURBO':
            case '10 MHZ':
            case '10MHZ': guessed.speed = 'enabled'; break;
            case 'CGA': guessed.video = 'CGA'; break;
            case 'EGA': guessed.video = 'EGA'; break;
            case 'HGC':
            case 'HERCULES': guessed.video = 'HGC'; break;
            case 'EMS':
            case '2MB EMS': guessed.ems = 'enabled'; break;
            case 'NO EMS': guessed.ems = 'disabled'; break;
        }
    }
    return guessed;
}

function selectedOption(options, value, fallback) {
    return options.some(option => option.value === value) ? value : fallback;
}

function buildXtLaunchSettings(fileName, overrides = null) {
    const guessedOverrides = guessXtLaunchOverrides(fileName);
    const selected = overrides && typeof overrides === 'object' ? overrides : {};
    const cpu = selectedOption(XT_CPU_OPTIONS, selected.cpu, guessedOverrides.cpu);
    const speed = selectedOption(XT_SPEED_OPTIONS, selected.speed, guessedOverrides.speed);
    const video = selectedOption(XT_VIDEO_OPTIONS, selected.video, guessedOverrides.video);
    const ems = selectedOption(XT_EMS_OPTIONS, selected.ems, guessedOverrides.ems);

    return {
        coreConfig: {
            virtualxt_cpu_type: cpu,
            virtualxt_cpu_turbo: speed,
            virtualxt_video: video,
            virtualxt_ems: ems,
            virtualxt_serial_mouse: 'enabled',
            virtualxt_hostfs: 'enabled',
            virtualxt_crt_filter: 'disabled',
            virtualxt_pc_noise: 'disabled',
            virtualxt_show_game_focus: 'disabled'
        },
        overrideValues: { cpu, speed, video, ems },
        guessedOverrides,
        overrideSchema: [
            { id: 'cpu', label: 'CPU', options: XT_CPU_OPTIONS },
            { id: 'speed', label: 'CPU speed', options: XT_SPEED_OPTIONS },
            { id: 'video', label: 'Video adapter', options: XT_VIDEO_OPTIONS },
            { id: 'ems', label: 'EMS memory', options: XT_EMS_OPTIONS }
        ]
    };
}

const XT = {
    ...PlatformBase,
    platform_id: 'xt',
    core: 'virtualxt',
    core_asset_version: '3.1.0-2aecaf13-vme2',
    platform_name: 'IBM PC/XT (8088/V20 + CGA/EGA)',
    short_name: 'XT',
    libretro_thumbnails_system: 'DOS',
    theme: {
        '--color0': '#000000',
        '--color1': '#00AAAA',
        '--color2': '#ffffff',
        '--color3': '#AA00AA',
        '--color4': '#6780ae',
        '--font': 'CGA',
        '--fontsize': '1.1em',
        '--cursorwidth': '0.5em',
        '--portrait-fontsize': '100%'
    },
    resolveLaunchSettings: buildXtLaunchSettings,
    guessConfig: fileName => buildXtLaunchSettings(fileName).coreConfig,
    prepareLaunchRom: options => prepareXtLaunchRom(options, xtSystemUrl),
    savestates_disabled: true,
    rewind_disabled: true,
    ffd_disabled: true,
    shader: ['assets/shaders/crt/crt-geom.glslp', 'assets/shaders/crt/shaders/crt-geom.glsl'],
    force_scale: false,
    video_smooth: false,
    keyboard_passthrough: true,
    desktop_focus_mode: true,
    keyboard_mode_labels: {
        retropad: 'Mouse capture: Off',
        focusmode: 'Mouse capture: On (Esc to release)'
    },
    dependencies: [
    ],
    touch_controllers: [
        JOYSTICK_TOUCH_MODE.QUICKSHOT_KEYBOARD,
        JOYSTICK_TOUCH_MODE.QUICKSHOT_KEYBOARD_STATIC
    ],
    mouse_controllers: [
        MOUSE_TOUCH_MODE.TRACKPAD_BUTTONS
    ],
    touch_key_mapping: {
        keyMap: {
            'Spc+Ret': KeyMaps.XT_ARROWS_SPACE_RETURN,
            'Spc+X': KeyMaps.XT_ARROWS_SPACE_X,
            'Spc+Ctrl': KeyMaps.XT_ARROWS_SPACE_CTRL,
            'Z+X': KeyMaps.XT_ARROWS_Z_X,
            'Spc+A': KeyMaps.XT_ARROWS_SPACE_A,
            'Spc+Shift': KeyMaps.XT_ARROWS_SPACE_SHIFT,
        },
        default: KeyMaps.XT_ARROWS_SPACE_RETURN
    },
    keyboard_controller_mapping: {
        input_player1_up: 'nul',
        input_player1_left: 'nul',
        input_player1_down: 'nul',
        input_player1_right: 'nul',
        input_player1_x: 'nul',
        input_player1_y: 'nul',
        input_player1_c: 'nul',
        input_player1_a: 'nul',
        input_player1_b: 'nul',
        input_player1_l: 'nul',
        input_player1_r: 'nul',
        input_player1_l2: 'nul',
        input_player1_r2: 'nul',
        input_player1_l3: 'nul',
        input_player1_r3: 'nul',
        input_player1_select: 'nul',
        input_player1_start: 'nul',
        // These lightgun bindings reserve Enter and right Shift without a lightgun.
        input_player1_gun_start: 'nul',
        input_player1_gun_select: 'nul'
    },
    touch_controller_mapping: {
        input_player1_up: 'nul',
        input_player1_left: 'nul',
        input_player1_down: 'nul',
        input_player1_right: 'nul',
        input_player1_x: 'nul',
        input_player1_y: 'nul',
        input_player1_c: 'nul',
        input_player1_a: 'nul',
        input_player1_b: 'nul',
        input_player1_l: 'nul',
        input_player1_r: 'nul',
        input_player1_l2: 'nul',
        input_player1_r2: 'nul',
        input_player1_l3: 'nul',
        input_player1_r3: 'nul',
        input_player1_select: 'nul',
        input_player1_start: 'nul',
        input_player1_gun_start: 'nul',
        input_player1_gun_select: 'nul',
    },
    default_touch_controller: JOYSTICK_TOUCH_MODE.QUICKSHOT_KEYBOARD,
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
            "label": "F1",
            "key": {
                "key": 'F1',
                "code": 'F1'
            }
        },
        2: {
            "label": "ESC",
            "key": {
                "key": 'Escape',
                "code": 'Escape'
            }
        },
        3: {
            "label": "ENTER",
            "key": {
                "key": 'Enter',
                "code": 'Enter'
            }
        },
    },
};

export default XT;





