import PlatformBase from '../PlatformBase.js';
import { JOYSTICK_TOUCH_MODE, MOUSE_TOUCH_MODE } from '../../Constants.js';
import { KeyMaps } from '../../touch/KeyMaps.js';

const XT = {
    ...PlatformBase,
    platform_id: 'xt',
    core: 'virtualxt',
    platform_name: 'IBM PC/XT (286 + CGA)',
    short_name: 'XT',
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
    guessConfig: (fileName) => {
        return {
        }
    },
    savestates_disabled: true,
    rewind_disabled: true,
    ffd_disabled: true,
    shader: ['assets/shaders/crt/crt-geom.glslp', 'assets/shaders/crt/shaders/crt-geom.glsl'],
    force_scale: true,
    video_smooth: false,
    dependencies: [
    ],
    touch_controllers: [
        JOYSTICK_TOUCH_MODE.QUICKSHOT_KEYBOARD
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
        input_player1_start: 'nul'
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
    message: ["XT support is under development and mostly broken or non-functional."]
};

export default XT;





