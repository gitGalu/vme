import PlatformBase from '../PlatformBase.js';
import { JOYSTICK_TOUCH_MODE } from '../../Constants.js';

const NES = {
    ...PlatformBase,
    platform_id: 'nes',
    core: 'fceumm',
    platform_name: 'Nintendo Entertainment System',
    short_name: 'NES',
    theme: {
        '--color0': '#000000',
        '--color1': '#eeeeee',
        '--color2': '#e45c10',
        '--color3': '#f0d0b0',
        '--font': 'NES',
        '--cursorwidth': '1em',
        '--transform': 'uppercase'
    },
    shader: ['assets/shaders/crt/crt-geom.glslp', 'assets/shaders/crt/shaders/crt-geom.glsl'],
    default_touch_controller: JOYSTICK_TOUCH_MODE.QUICKSHOT_DYNAMIC,
    fire_buttons: 2,
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

export default NES;