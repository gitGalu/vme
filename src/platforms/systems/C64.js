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
    guessConfig: (fileName) => {
        return {
            vice_drive_true_emulation: 'true',
            vice_warp_boost: 'enabled',
            vice_autostart: 'enabled',
            vice_autoloadwarp: 'enabled',
        };
    },
    shader: ['assets/shaders/crt/crt-geom.glslp', 'assets/shaders/crt/shaders/crt-geom.glsl'],
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
        input_player1_a: 'nul',
        input_player1_y: 'nul',
        input_player1_x: 'nul',
        input_player1_start: 'nul',
        input_player1_select: 'nul',
        input_player1_l: 'nul',
        input_player1_r: 'nul'
    },
    fire_buttons: 1,
    keyboard: {
        shiftKey: 1,
        overrides: {
        }
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
    },
    message: ["C64 support is under development and mostly broken or non-functional."]
};

export default C64;





