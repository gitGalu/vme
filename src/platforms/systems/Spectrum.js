import PlatformBase from '../PlatformBase.js';
import { JOYSTICK_TOUCH_MODE } from '../../Constants.js';
import { KeyMaps } from '../../touch/KeyMaps.js';

const SPECTRUM_MACHINE_OPTIONS = Object.freeze([
    { value: 'Spectrum 16K', label: 'ZX Spectrum 16K' },
    { value: 'Spectrum 48K', label: 'ZX Spectrum 48K' },
    { value: 'Spectrum 128K', label: 'ZX Spectrum 128K' },
    { value: 'Spectrum +2', label: 'ZX Spectrum +2' },
    { value: 'Spectrum +2A', label: 'ZX Spectrum +2A' },
    { value: 'Spectrum +3', label: 'ZX Spectrum +3' }
]);

const SPECTRUM_TAPE_LOADING_OPTIONS = Object.freeze([
    { value: 'off', label: 'Off' },
    { value: 'on', label: 'On' }
]);

const SPECTRUM_MACHINE_VALUES = new Set(SPECTRUM_MACHINE_OPTIONS.map(option => option.value));
const SPECTRUM_TAPE_LOADING_VALUES = new Set(SPECTRUM_TAPE_LOADING_OPTIONS.map(option => option.value));

function guessSpectrumMachine(fileName) {
    const nameU = String(fileName ?? '').toUpperCase();

    if (nameU.includes('(16K)')) {
        return 'Spectrum 16K';
    }

    if (nameU.includes('(48K)')) {
        return 'Spectrum 48K';
    }

    if (nameU.includes('(+2A-+3)')) {
        return 'Spectrum +2A';
    }

    if (nameU.includes('(+3)')) {
        return 'Spectrum +3';
    }

    if (nameU.includes('(+2)')) {
        return 'Spectrum +2';
    }

    if (
        nameU.includes('[AY]') ||
        nameU.includes('[128K]') ||
        nameU.includes('(128K)') ||
        nameU.includes('(48K-128K)')
    ) {
        return 'Spectrum 128K';
    }

    return 'Spectrum 48K';
}

function normalizeSpectrumMachine(value, fallback = 'Spectrum 48K') {
    if (typeof value !== 'string') {
        return fallback;
    }

    const normalized = value.trim();
    return SPECTRUM_MACHINE_VALUES.has(normalized) ? normalized : fallback;
}

function normalizeSpectrumRealtimeTapeLoading(value, fallback = 'off') {
    if (typeof value !== 'string') {
        return fallback;
    }

    const normalized = value.trim().toLowerCase();
    return SPECTRUM_TAPE_LOADING_VALUES.has(normalized) ? normalized : fallback;
}

function buildSpectrumLaunchSettings(fileName, overrides = null) {
    const defaultOptions = {
        input_libretro_device_p1: "513",
        input_libretro_device_p2: "0",
        input_libretro_device_p3: "259",
        input_libretro_device_p4: "1",
        input_libretro_device_p5: "1",
    };

    const guessedMachine = guessSpectrumMachine(fileName);
    const overrideInput = overrides && typeof overrides === 'object' ? overrides : {};
    const machine = normalizeSpectrumMachine(overrideInput.machine, guessedMachine);
    const realtimeTapeLoading = normalizeSpectrumRealtimeTapeLoading(overrideInput.realtime_tape_loading, 'off');

    return {
        bios: [],
        coreConfig: {
            ...defaultOptions,
            fuse_machine: machine,
            fuse_fast_load: realtimeTapeLoading === 'on' ? 'disabled' : 'enabled'
        },
        overrideValues: {
            machine,
            realtime_tape_loading: realtimeTapeLoading
        },
        guessedOverrides: {
            machine: guessedMachine,
            realtime_tape_loading: 'off'
        },
        overrideSchema: [
            {
                id: 'machine',
                label: 'Machine',
                options: SPECTRUM_MACHINE_OPTIONS
            },
            {
                id: 'realtime_tape_loading',
                label: 'Realtime tape loading',
                options: SPECTRUM_TAPE_LOADING_OPTIONS
            }
        ]
    };
}

const Spectrum = {
    ...PlatformBase,
    platform_id: 'spectrum',
    core: 'fuse',
    platform_name: 'Sinclair ZX Spectrum',
    short_name: 'Spectrum',
    libretro_thumbnails_system: 'Sinclair - ZX Spectrum',
    theme: {
        '--color0': '#c0c000',
        '--color1': '#0000c0',
        '--color3': '#be2ec8',
        '--color2': '#ffffff',
        '--font': 'ZXSpectrum',
        '--cursorwidth': '1em',
    },
    savestates_disabled: false,
    force_scale: true,
    shader: ['assets/shaders/crt/crt-geom.glslp', 'assets/shaders/crt/shaders/crt-geom.glsl'],
    resolveLaunchSettings: (fileName, overrides = null) => buildSpectrumLaunchSettings(fileName, overrides),
    guessConfig: (fileName) => buildSpectrumLaunchSettings(fileName).coreConfig,
    touch_controllers: [
        JOYSTICK_TOUCH_MODE.QUICKJOY_PRIMARY,
        JOYSTICK_TOUCH_MODE.QUICKSHOT_KEYBOARD
    ],
    touch_controller_mode_labels: {
        [JOYSTICK_TOUCH_MODE.QUICKSHOT_KEYBOARD]: 'QuickShot'
    },
    touch_key_mapping: {
        keyMap: {
            'Interface 2': KeyMaps.ZX_INTERFACE_2_LEFT,
            'Cursor': KeyMaps.ZX_CURSOR,
            'QAOP': KeyMaps.ZX_QOAP,
            'QWRE': KeyMaps.ZX_ULTIMATE,
            '1890': KeyMaps.ZX_DEATHCHASE
        },
        default: KeyMaps.ZX_CURSOR
    },
    touch_controller_mapping: {
        input_player1_up: 'F13',
        input_player1_left: 'F14',
        input_player1_down: 'F15',
        input_player1_right: 'F11',
        input_player1_b: 'kp_minus'
    },
    fire_buttons: 1,
    keyboard: {
        shiftKey: 1,
        overrides: {
        }
    },
    additional_buttons: {
        1: {
            "label": "1",
            "key": {
                "key": '1',
                "code": 'Digit1'
            }
        },
        2: {
            "label": "0",
            "key": {
                "key": '0',
                "code": 'Digit0'
            }
        },
        3: {
            "label": "ENTER",
            "key": {
                "key": 'enter',
                "code": 'Enter'
            }
        }
    },
};

export default Spectrum;
