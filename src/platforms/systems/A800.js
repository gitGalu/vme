import PlatformBase from '../PlatformBase.js';
import { JOYSTICK_TOUCH_MODE } from '../../Constants.js';

const A800_MODEL_OPTIONS = Object.freeze([
    { value: '800XL (64K)', label: 'Atari 800XL (64KB RAM)' },
    { value: '130XE (128K)', label: 'Atari 130XE (128KB RAM)' },
    { value: 'Modern XL/XE(320K CS)', label: 'Atari 130XE (Compy Shop 320KB)' },
    { value: 'Modern XL/XE(1088K)', label: 'Atari 130XE (1MB RAM)' },
    { value: '400/800 (OS A)', label: 'Atari 400/800 OS A (48KB RAM)' },
    { value: '400/800 (OS B)', label: 'Atari 400/800 OS B (48KB RAM)' }
]);

const A800_BASIC_OPTIONS = Object.freeze([
    { value: 'off', label: 'BASIC disabled' },
    { value: 'on', label: 'BASIC enabled' }
]);

const A800_VIDEO_STANDARD_OPTIONS = Object.freeze([
    { value: 'PAL', label: 'PAL' },
    { value: 'NTSC', label: 'NTSC' }
]);

const A800_MODEL_VALUES = new Set(A800_MODEL_OPTIONS.map(option => option.value));
const A800_BASIC_VALUES = new Set(A800_BASIC_OPTIONS.map(option => option.value));
const A800_VIDEO_STANDARD_VALUES = new Set(A800_VIDEO_STANDARD_OPTIONS.map(option => option.value));

function guessA800Model(fileName) {
    const nameU = String(fileName ?? '').toUpperCase();

    if (
        nameU.includes('(130XE)') ||
        nameU.includes('[130XE]') ||
        nameU.includes('[128K]') ||
        nameU.includes('(128)')
    ) {
        return '130XE (128K)';
    }

    if (
        nameU.includes('[192K]') ||
        nameU.includes('[REQ 256K]') ||
        nameU.includes('[256K]') ||
        nameU.includes('[320K]')
    ) {
        return 'Modern XL/XE(320K CS)';
    }

    if (nameU.includes('[1MB]')) {
        return 'Modern XL/XE(1088K)';
    }

    if (nameU.includes('[REQ OSA]')) {
        return '400/800 (OS A)';
    }

    if (nameU.includes('[400-800]') || nameU.includes('[REQ OSB]')) {
        return '400/800 (OS B)';
    }

    return '800XL (64K)';
}

function getA800BiosForModel(model) {
    switch (model) {
        case '400/800 (OS A)':
            return ['ATARIOSA.ROM', 'ATARIBAS.ROM'];
        case '400/800 (OS B)':
            return ['ATARIOSB.ROM', 'ATARIBAS.ROM'];
        default:
            return ['ATARIXL.ROM', 'ATARIBAS.ROM'];
    }
}

function normalizeA800Model(value, fallback = '800XL (64K)') {
    if (typeof value !== 'string') {
        return fallback;
    }

    const normalized = value.trim();
    return A800_MODEL_VALUES.has(normalized) ? normalized : fallback;
}

function normalizeA800Basic(value, fallback = 'off') {
    if (typeof value !== 'string') {
        return fallback;
    }

    const normalized = value.trim().toLowerCase();
    return A800_BASIC_VALUES.has(normalized) ? normalized : fallback;
}

function normalizeA800VideoStandard(value, fallback = 'PAL') {
    if (typeof value !== 'string') {
        return fallback;
    }

    const normalized = value.trim().toUpperCase();
    return A800_VIDEO_STANDARD_VALUES.has(normalized) ? normalized : fallback;
}

function buildA800LaunchSettings(fileName, overrides = null) {
    const nameU = String(fileName ?? '').toUpperCase();
    const guessedModel = guessA800Model(fileName);
    const guessedBasic = nameU.includes('[BASIC]') ? 'on' : 'off';
    const guessedVideoStandard = nameU.includes('[REQ OSB]') ? 'NTSC' : 'PAL';
    const overrideInput = overrides && typeof overrides === 'object' ? overrides : {};
    const model = normalizeA800Model(overrideInput.model, guessedModel);
    const basic = normalizeA800Basic(overrideInput.basic, guessedBasic);
    const ntscpal = normalizeA800VideoStandard(overrideInput.ntscpal, guessedVideoStandard);

    const coreConfig = {
        atari800_f10: 'disabled',
        atari800_ntscpal: ntscpal,
        atari800_resolution: '336x240',
        atari800_system: model,
        atari800_internalbasic: basic === 'on' ? 'enabled' : 'disabled'
    };

    if (nameU.includes('.CAS')) {
        coreConfig.atari800_cassboot = 'enabled';
    }

    return {
        bios: getA800BiosForModel(model),
        coreConfig,
        overrideValues: {
            model,
            basic,
            ntscpal
        },
        guessedOverrides: {
            model: guessedModel,
            basic: guessedBasic,
            ntscpal: guessedVideoStandard
        },
        overrideSchema: [
            {
                id: 'model',
                label: 'Model',
                options: A800_MODEL_OPTIONS
            },
            {
                id: 'basic',
                label: 'BASIC',
                options: A800_BASIC_OPTIONS
            },
            {
                id: 'ntscpal',
                label: 'Video',
                options: A800_VIDEO_STANDARD_OPTIONS
            }
        ]
    };
}

const A800 = {
    ...PlatformBase,
    platform_id: 'atari800',
    core: 'atari800',
    core_asset_version: 'direct-frame-rwebaudio-1',
    bios: ['ATARIXL.ROM', 'ATARIBAS.ROM'],
    platform_name: 'Atari 800 / XE / XL',
    short_name: 'A800',
    libretro_thumbnails_system: 'Atari - 8-bit',
    // Core's REAL render resolution. atari800 renders 384x240 with full overscan border (the
    // visible area is 336, but the framebuffer is wider - a 336-wide buffer dropped columns).
    // Low Performance HW mode makes the WebGL backbuffer an exact integer multiple of this, so
    // every pixel scales equally (no fat/thin columns).
    native_resolution: { width: 384, height: 240 },
    theme: {
        '--color0': '#005181',
        '--color1': '#60b7e7',
        '--color3': '#005181',
        '--color2': '#60b7e7',
        '--font': 'Atascii',
        '--cursorwidth': '1em'
    },
    shader: ['assets/shaders/crt/crt-geom.glslp', 'assets/shaders/crt/shaders/crt-geom.glsl'],
    force_scale: true,
    video_smooth: false,
    guessBIOS: (fileName) => buildA800LaunchSettings(fileName).bios,
    resolveLaunchSettings: (fileName, overrides = null) => buildA800LaunchSettings(fileName, overrides),
    guessConfig: (fileName) => buildA800LaunchSettings(fileName).coreConfig,
    dependencies: [
        {
            key: "ATARIXL.ROM",
            type: "Atari XL/XE OS ROM",
            required: true,
            accepted: ["06daac977823773a3eea3422fd26a703"]
        },
        {
            key: "ATARIBAS.ROM",
            type: "BASIC interpreter ROM",
            required: true,
            accepted: ["0bac0c6a50104045d902df4503a4c30b"]
        },
        {
            key: "ATARIOSA.ROM",
            type: "Atari 400/800 PAL ROM",
            required: true,
            accepted: ["eb1f32f5d9f382db1bbfb8d7f9cb343a"]
        },
        {
            key: "ATARIOSB.ROM",
            type: "Atari 400/800 NTSC ROM",
            required: true,
            accepted: ["a3e8d617c95d08031fe1b20d541434b2"]
        },
    ],
    keyboard_controller_info: {
        "Arrow Keys": "Joystick Directions",
        "Z": "Joystick Fire",
        "Right Shift": "Select",
        "F2": "Option",
        "F4": "Start"
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
        JOYSTICK_TOUCH_MODE.HIDEAWAY
    ],
    touch_controller_mapping: {
        input_player1_up: 'F13',
        input_player1_left: 'F14',
        input_player1_down: 'F15',
        input_player1_right: 'F11',
        input_player1_b: 'kp_minus',
        input_player1_a: 'kp_minus'
    },
    keyboard_joystick_mapping: {
        ArrowUp: { key: 'F13', code: 'F13', keyCode: 124 },
        ArrowLeft: { key: 'F14', code: 'F14', keyCode: 125 },
        ArrowDown: { key: 'F15', code: 'F15', keyCode: 126 },
        ArrowRight: { key: 'F11', code: 'F11', keyCode: 122 },
        KeyZ: { key: '-', code: 'NumpadSubtract', keyCode: 109 }
    },
    gamepad_filter: {
        coalesceButtons: [0, 1],
        coalesceTarget: 0,
        disableButtons: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 16]
    },
    gamepad_controller_mapping: {
        input_player1_b_btn: '0', //0
        input_player1_a_btn: 'nul',
        input_player1_x_btn: 'nul',
        input_player1_y_btn: 'nul',
        input_player1_c_btn: 'nul',
        input_player1_l_btn: 'nul',
        input_player1_r_btn: 'nul',
        input_player1_select_btn: 'nul',
        input_player1_start_btn: 'nul',
        input_menu_toggle_btn: 'nul',
        input_menu_toggle: 'nul'
    },
    keyboard_controller_mapping: {
        input_player1_up: 'F13',
        input_player1_left: 'F14',
        input_player1_down: 'F15',
        input_player1_right: 'F11',
        input_player1_b: 'kp_minus',
        input_player1_a: 'nul'

    },
    fire_buttons: 1,
    keyboard: {
        shiftKey: 2,
        overrides: {
        }
    },
    additional_buttons: {
        1: {
            "label": "OPTION",
            "key": {
                "key": 'F2',
                "code": 'F2',
            }
        },
        2: {
            "label": "SELECT",
            "keyCode": 'select'
        },
        3: {
            "label": "START",
            "key": {
                "key": 'F4',
                "code": 'F4',
            }
        }
    }
};

export default A800;
