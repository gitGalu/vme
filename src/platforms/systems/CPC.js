import PlatformBase from '../PlatformBase.js';
import { JOYSTICK_TOUCH_MODE } from '../../Constants.js';

const CPC = {
    ...PlatformBase,
    platform_id: 'cpc',
    core: 'crocods',
    platform_name: 'Amstrad CPC',
    short_name: 'CPC',
    loader: 'unzip',
    theme: {
        '--color0': '#000060',
        '--color1': '#d6e121',
        '--color2': '#000000',
        '--color3': '#ea3323',
        '--font': 'AmstradCPC',
        '--cursorwidth': '1em'
    },
    savestates_disabled: true,
    shader: ['assets/shaders/crt/crt-geom.glslp', 'assets/shaders/crt/shaders/crt-geom.glsl'],
    keyboard_controller_info: {
        "Cursor Keys": "Joy Directions",
        "Z": "Fire",
        "X": "Select file"
    },
    touch_controllers: [
        JOYSTICK_TOUCH_MODE.QUICKJOY_PRIMARY,
        JOYSTICK_TOUCH_MODE.QUICKSHOT_DYNAMIC,
        JOYSTICK_TOUCH_MODE.HIDEAWAY
    ],
    fire_buttons: 1,
    additional_buttons: {
    },
    message: ["CPC support is under development and mostly broken or non-functional."]
};

export default CPC;