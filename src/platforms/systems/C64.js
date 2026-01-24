import PlatformBase from '../PlatformBase.js';
import { JOYSTICK_TOUCH_MODE } from '../../Constants.js';

const C64 = {
    ...PlatformBase,
    platform_id: 'c64',
    core: 'vice_x64',
    platform_name: 'Commodore 64',
    short_name: 'C64',
    theme: {
        '--color0': '#6a53f5',
        '--color1': '#b19efe',
        '--color2': '#68a941',
        '--color3': '#d0dc71',
        '--font': 'PetMe64',
        '--cursorwidth': '1em',
    },
    startup_beforelaunch: async function (nostalgist, storageManager) {
        var el = document.getElementById('kbCtrlClear');
        el.classList.add('kbCtrlSmall');
        el.textContent = 'RUN\nSTOP';
        el = document.getElementById('keyBackspace');
        el.textContent = 'DEL';
    },
    guessConfig: (fileName) => {
        return {
            vice_drive_true_emulation: 'true',
            vice_warp_boost: 'enabled',
            vice_autostart: 'enabled',
            vice_autoloadwarp: 'enabled',
        };
    },
    force_scale: true,
    video_smooth: false,
    shader: ['assets/shaders/crt/crt-geom.glslp', 'assets/shaders/crt/shaders/crt-geom.glsl'],
    keyboard_controller_info: {
        "Arrow Keys": "Joystick Directions",
        "Z": "Joystick Fire",
        "Escape": "Run/Stop"
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
    keyboard_controller_mapping: {
        input_player1_x: 'nul',
        input_player1_y: 'nul',
        input_player1_c: 'nul',
        input_player1_b: 'z', //fire
        input_player1_a: 'nul',
        input_player1_l: 'nul',
        input_player1_r: 'nul',
        input_player1_select: 'nul',
        input_player1_start: 'nul',
        input_player1_l2: 'nul',
        input_player1_r2: 'nul',
        input_player1_gun_start: 'nul',
        input_player1_gun_start_btn: 'nul',
        input_player1_gun_start_axis: 'nul',
        input_player1_gun_start_mbtn: 'nul',
        input_player1_gun_select: 'nul',
        input_player1_gun_select_btn: 'nul',
        input_player1_gun_select_axis: 'nul',
        input_player1_gun_select_mbtn: 'nul'
    },
    touch_controller_mapping: {
        input_player1_up: 'F13',
        input_player1_left: 'F14',
        input_player1_down: 'F15',
        input_player1_right: 'F11',
        input_player1_b: 'kp_minus',
        input_player1_a: 'nul',
        input_player1_y: 'nul',
        input_player1_x: 'nul',
        input_player1_start: 'nul',
        input_player1_select: 'nul',
        input_player1_l: 'nul',
        input_player1_r: 'nul',
        input_player1_gun_start: 'nul',
        input_player1_gun_start_btn: 'nul',
        input_player1_gun_start_axis: 'nul',
        input_player1_gun_start_mbtn: 'nul',
        input_player1_gun_select: 'nul',
        input_player1_gun_select_btn: 'nul',
        input_player1_gun_select_axis: 'nul',
        input_player1_gun_select_mbtn: 'nul',
        input_player1_l2: 'nul',
        input_player1_r2: 'nul'
    },
    joyport_toggle: true,
    fire_buttons: 1,
    keyboard: {
        shiftKey: 1,
        overrides: {
        }
    },
    touch_keyboard_reconfig: {
        keyMappings: {
            'keyMinus': {
                value: '=',
                code: 'Equal'
            },
            'keyColon': { //fixme
                value: ':',
                code: 'Semicolon',
                shift: false
            },
            'keySemicolon': {
                value: '\'',
                code: 'Quote',
            },
            'keyAmpersand': {
                value: '&',
                code: 'Digit6',
                shift: true
            },
            'keyBracketLeft': {
                value: '(',
                code: 'Digit8',
                shfit: true
            },
            'keyBracketRight': {
                value: ')',
                code: 'Digit9',
                shift: true
            },
            'keyAt': {
                value: '[',
                code: 'BracketLeft',
                shift: false
            },
            'keyQuote': {
                value: '"',
                code: 'Digit2',
                shift: true
            },
            'keyApostrophe': {
                value: '&',
                code: 'Digit7',
                shift: true
            }
        },
    },
    additional_keyboard: {
        "layerF": [
            { "id": "keyFA29", "value": "ArrowUp", "code": "ArrowUp", "label": "↑" },
            { "id": "keyFA39", "value": "ArrowDown", "code": "ArrowDown", "label": "↓" },
            { "id": "keyF21", "value": "ArrowLeft", "code": "ArrowLeft", "label": "←" },
            { "id": "keyF22", "value": "ArrowRight", "code": "ArrowRight", "label": "→" },
            { "id": "keyG13", "value": "F1", "code": "F1", "label": "F1" },
            { "id": "keyG14", "value": "F2", "code": "F2", "label": "F2" },
            { "id": "keyG15", "value": "F3", "code": "F3", "label": "F3" },
            { "id": "keyG16", "value": "F4", "code": "F4", "label": "F4" },
            { "id": "keyG23", "value": "F5", "code": "F5", "label": "F5" },
            { "id": "keyG24", "value": "F6", "code": "F6", "label": "F6" },
            { "id": "keyG25", "value": "F7", "code": "F7", "label": "F7" },
            { "id": "keyG26", "value": "F8", "code": "F8", "label": "F8" },

            { "id": "keyFL11", "value": "shift", "code": "ShiftLeft", "label": "LShift" },
            { "id": "keyFR11", "value": "shift", "code": "ShiftRight", "label": "RShift" }
        ]
    },
    additional_buttons: {
        1: {
            "label": "SPACE",
            "key": {
                "key": 'Space',
                "code": 'Space'
            }
        },
        2: {
            "label": "RUN/STOP",
            "key": {
                "key": 'Escape',
                "code": 'Escape'
            }
        },
        3: {
            "label": "F1",
            "key": {
                "key": 'F1',
                "code": 'F1'
            }
        }
    }
};

export default C64;





