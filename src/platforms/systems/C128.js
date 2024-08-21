import PlatformBase from '../PlatformBase.js';
import { JOYSTICK_TOUCH_MODE } from '../../Constants.js';

const C128 = {
    ...PlatformBase,
    platform_id: 'c128',
    core: 'vice_x128',
    platform_name: 'Commodore 128',
    short_name: 'C128',
    theme: {
        '--color0': '#b9e893',
        '--color1': '#555555',
        '--color2': '#555555',
        '--color3': '#b9e893',
        '--font': 'PetMe1282Y',
        '--cursorwidth': '0.5em',
    },
    shader: ['assets/shaders/crt/crt-geom.glslp', 'assets/shaders/crt/shaders/crt-geom.glsl'],
    touch_controllers: [
        JOYSTICK_TOUCH_MODE.QUICKJOY_PRIMARY,
        JOYSTICK_TOUCH_MODE.QUICKSHOT_DYNAMIC,
        JOYSTICK_TOUCH_MODE.HIDEAWAY
    ],
    fire_buttons: 1,
    additional_buttons: {
    },
    message: ["C128 support is under development and mostly broken or non-functional."]
};

export default C128;



