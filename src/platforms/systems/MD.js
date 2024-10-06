import PlatformBase from '../PlatformBase.js';
import { JOYSTICK_TOUCH_MODE } from '../../Constants.js';

const MD = {
    ...PlatformBase,
    platform_id: 'smd',
    core: 'genesis_plus_gx',
    platform_name: 'Sega Mega Drive',
    short_name: 'SMD',
    theme: {
        '--color0': '#00009B',
        '--color1': '#eeeeee',
        '--color3': '#66de42',
        '--color2': '#ce2c1e',
        '--font': 'MD',
        '--cursorwidth': '1em',
        '--transform': 'none'
    },
    shader: ['assets/shaders/crt/crt-geom.glslp', 'assets/shaders/crt/shaders/crt-geom.glsl'],
    guessConfig: (fileName) => {
        return {
            input_libretro_device_p1: "0"
        };
    },
    keyboard_controller_info: {
        "Cursor Keys": "D-PAD",
        "Z": "Button B",
        "X": "Button C",
        "A": "Button A",
        "S": "Button Y",
        "Q": "Button X",
        "W": "Button Z",
        "Right Shift": "Mode",
        "Enter": "Start"
    },
    touch_controllers: [
        JOYSTICK_TOUCH_MODE.QUICKSHOT_DYNAMIC
    ],
    default_touch_controller: JOYSTICK_TOUCH_MODE.QUICKSHOT_DYNAMIC,
    fire_buttons: 3,
    additional_buttons: {
        1: {
            "label": "START",
            "keyCode": 'start'
        }
    }
};

export default MD;