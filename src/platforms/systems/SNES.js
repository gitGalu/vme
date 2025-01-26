import PlatformBase from '../PlatformBase.js';
import { JOYSTICK_TOUCH_MODE } from '../../Constants.js';

const SNES = {
    ...PlatformBase,
    platform_id: 'snes',
    core: 'snes9x',
    platform_name: 'Super Nintendo Entertainment System',
    short_name: 'SNES',
    loader: 'unzip',
    theme: {
        '--color0': '#3c246d',
        '--color1': '#fdfcff',
        '--color2': '#be321c',
        '--color3': '#e17f30',
        '--font': 'NES',
        '--fontsize': '1em',
        '--cursorwidth': '1em',
    },
    shader: ['assets/shaders/crt/crt-geom.glslp', 'assets/shaders/crt/shaders/crt-geom.glsl'],
    keyboard_controller_info: {
        "Arrow Keys": "D-PAD",
        "Z": "Button B",
        "X": "Button A",
        "A": "Button Y",
        "S": "Button X",
        "Q": "Button L",
        "W": "Button R",
        "Right Shift": "Select",
        "Enter": "Start",
    },
    touch_controllers: [
        JOYSTICK_TOUCH_MODE.QUICKSHOT_DYNAMIC
    ],
    default_touch_controller: JOYSTICK_TOUCH_MODE.QUICKSHOT_DYNAMIC,
    fire_buttons: 6,
    additional_buttons: {
        1: {
            "label": "SELECT",
            "keyCode": 'select'
        },
        2: {
            "label": "START",
            "keyCode": 'start'
        }
    }
};

export default SNES;