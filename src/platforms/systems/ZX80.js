import PlatformBase from '../PlatformBase.js';
import { JOYSTICK_TOUCH_MODE } from '../../Constants.js';

const ZX80 = {
    ...PlatformBase,
    platform_id: 'zx80',
    core: '81',
    platform_name: 'Sinclair ZX80 / ZX81',
    short_name: 'ZX80',
    theme: {
        '--color0': '#ffffff',
        '--color1': '#000000',
        '--color2': '#000000',
        '--color3': '#ffffff',
        '--font': 'ZXSpectrum',
        '--cursorwidth': '1em',
        '--transform': 'uppercase',
    },
    force_scale: true,
    shader: ['assets/shaders/crt/crt-geom.glslp', 'assets/shaders/crt/shaders/crt-geom.glsl'],
    touch_controllers: [
        JOYSTICK_TOUCH_MODE.QUICKJOY_PRIMARY,
        JOYSTICK_TOUCH_MODE.QUICKSHOT_DYNAMIC,
        JOYSTICK_TOUCH_MODE.HIDEAWAY
    ],
    fire_buttons: 1,
    additional_buttons: {
    }
};

export default ZX80;


