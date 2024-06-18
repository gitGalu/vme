import PlatformBase from '../PlatformBase.js';
import { JOYSTICK_TOUCH_MODE } from '../../Constants.js';

const A5200 = {
    ...PlatformBase,
    platform_id: 'atari5200',
    core: 'a5200',
    platform_name: 'Atari 5200',
    short_name: 'A5200',
    theme: {
        '--color0': '#000000',
        '--color1': '#ffffff',
        '--font': 'Atascii',
        '--transform': 'uppercase',
        '--cursorwidth': '1em'
    },
    shader: ['assets/shaders/crt/crt-geom.glslp', 'assets/shaders/crt/shaders/crt-geom.glsl'],
    default_touch_controller: JOYSTICK_TOUCH_MODE.QUICKSHOT_DYNAMIC,
    fire_buttons: 2,
    additional_buttons: {
        1: {
            "label": "PAUSE",
            "keyCode": 'pause'
        },
        2: {
            "label": "START",
            "keyCode": 'start'
        }
    }
};

export default A5200;


