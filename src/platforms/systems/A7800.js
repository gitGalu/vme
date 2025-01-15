import PlatformBase from '../PlatformBase.js';
import { JOYSTICK_TOUCH_MODE } from '../../Constants.js';

const A7800 = {
    ...PlatformBase,
    platform_id: 'a7800',
    core: 'prosystem',
    platform_name: 'Atari 7800 ProSystem',
    short_name: 'A7800',
    theme: {
        '--color0': '#000000',
        '--color1': '#fafafa',
        '--color3': '#000000',
        '--color2': '#4e8bbb',
        '--font': 'A7800',
        '--fontsize': '1.3em',
        '--transform': 'uppercase',
        '--cursorwidth': '1em'
    },
    shader: ['assets/shaders/crt/crt-geom.glslp', 'assets/shaders/crt/shaders/crt-geom.glsl'],
    touch_controllers: [
        JOYSTICK_TOUCH_MODE.QUICKSHOT_DYNAMIC
    ],
    default_touch_controller: JOYSTICK_TOUCH_MODE.QUICKSHOT_DYNAMIC,
    fire_buttons: 2,
    additional_buttons: {
        1: {
            "label": "SELECT",
            "keyCode": 'select'
        }
    }
};

export default A7800;


