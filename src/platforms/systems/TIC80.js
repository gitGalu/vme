import PlatformBase from '../PlatformBase.js';
import { JOYSTICK_TOUCH_MODE } from '../../Constants.js';

const TIC80 = {
    ...PlatformBase,
    platform_id: 'tic80',
    core: 'tic80',
    platform_name: 'TIC-80',
    short_name: 'TIC-80',
    libretro_thumbnails_system: 'TIC-80',
    theme: {
        '--color0': '#1a1d2c',
        '--color1': '#566c87',
        '--color3': '#f4f4f4',
        '--color2': '#1a1d2c',
        '--font': 'TIC80',
        '--fontsize': '1.2em',
        '--transform': 'uppercase',
        '--portrait-fontsize': '125%',
        '--cursorwidth': '1em'
    },
    savestates_disabled: false,
    rewind_disabled: true,
    force_scale: true,
    video_smooth: false,
    keyboard_controller_info: {
        "Arrow Keys": "D-PAD",
        "Z": "Button A",
        "X": "Button B",
        "A": "Button X",
        "S": "Button Y"
    },
    touch_controllers: [
        JOYSTICK_TOUCH_MODE.QUICKSHOT_DYNAMIC
    ],
    default_touch_controller: JOYSTICK_TOUCH_MODE.QUICKSHOT_DYNAMIC,
    fire_buttons: 4,
};

export default TIC80;




