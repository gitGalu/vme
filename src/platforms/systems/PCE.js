import PlatformBase from '../PlatformBase.js';
import { JOYSTICK_TOUCH_MODE } from '../../Constants.js';

const PCE = {
    ...PlatformBase,
    platform_id: 'pce',
    core: 'mednafen_pce_fast',
    platform_name: 'PC Engine',
    short_name: 'PCE',
    theme: {
        '--color0': '#000000',
        '--color1': '#f0f0f0',
        '--font': 'Shockman',
        '--cursorwidth': '0.5em',
        '--transform': 'uppercase',
    },
    shader: ['assets/shaders/crt/crt-geom.glslp', 'assets/shaders/crt/shaders/crt-geom.glsl'],
    keyboard_controller_info: {
        "Arrow Keys": "D-PAD",
        "Z": "Button II",
        "X": "Button I",
        "Right Shift": "Select",
        "Enter": "Run"
    },
    touch_controllers: [
        JOYSTICK_TOUCH_MODE.QUICKSHOT_DYNAMIC
    ],
    default_touch_controller: JOYSTICK_TOUCH_MODE.QUICKSHOT_DYNAMIC,
    fire_buttons: 2,
    additional_buttons: {
        1: {
            "label": "SELECT",
            "keyCode": 'select'
        },
        2: {
            "label": "RUN",
            "keyCode": 'start'
        }
    }
};

export default PCE;


