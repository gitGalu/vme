import PlatformBase from '../PlatformBase.js';
import { JOYSTICK_TOUCH_MODE } from '../../Constants.js';

const SMS = {
    ...PlatformBase,
    platform_id: 'sms',
    core: 'gearsystem',
    platform_name: 'Sega Master System',
    short_name: 'SMS',
    theme: {
        '--color0': '#000000',
        '--color1': '#ffffff',
        '--font': 'Emulogic',
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
        },
        2: {
            "label": "START",
            "keyCode": 'start'
        }
    }
};

export default SMS;


