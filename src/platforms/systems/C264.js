import PlatformBase from '../PlatformBase.js';
import { JOYSTICK_TOUCH_MODE } from '../../Constants.js';

const C264 = {
    ...PlatformBase,
    platform_id: 'c264',
    core: 'vice_xplus4',
    platform_name: 'Commodore C16, C116 & Plus/4',
    short_name: 'C264',
    theme: {
        '--color1': '#000000',
        '--color2': '#ffffff',
        '--color0': '#c6b4fa',
        '--color3': '#000000',
        '--font': 'Petme64',
        '--cursorwidth': '1em',
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
    }
};

export default C264;


