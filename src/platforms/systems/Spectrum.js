import PlatformBase from '../PlatformBase.js';
import { JOYSTICK_TOUCH_MODE } from '../../Constants.js';
import { KeyMaps } from '../../touch/KeyMaps.js';

const Spectrum = {
    ...PlatformBase,
    platform_id: 'spectrum',
    core: 'fuse',
    platform_name: 'Sinclair ZX Spectrum',
    short_name: 'Spectrum',
    theme: {
        '--color0': '#c0c000',
        '--color1': '#0000c0',
        '--color3': '#be2ec8',
        '--color2': '#ffffff',
        '--font': 'ZXSpectrum',
        '--cursorwidth': '1em',
    },
    savestates_disabled: true,
    shader: ['assets/shaders/crt/crt-geom.glslp', 'assets/shaders/crt/shaders/crt-geom.glsl'],
    guessConfig: (fileName) => {
        const tagRules = {

        };

        const defaultOptions = {
            input_libretro_device_p1: "513",
            input_libretro_device_p2: "0",
            input_libretro_device_p3: "259",
            input_libretro_device_p4: "1",
            input_libretro_device_p5: "1"
        };

        let config = { ...defaultOptions };

        Object.keys(tagRules).forEach(tag => {
            if (fileName.toUpperCase().includes(tag)) {
                Object.assign(config, tagRules[tag]);
            }
        });

        return config;
    },
    touch_controllers: [
        JOYSTICK_TOUCH_MODE.QUICKJOY_PRIMARY,
        JOYSTICK_TOUCH_MODE.QUICKSHOT_KEYBOARD
    ],
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


