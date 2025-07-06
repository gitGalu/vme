import PlatformBase from '../PlatformBase.js';
import { JOYSTICK_TOUCH_MODE } from '../../Constants.js';

const PICO8 = {
    ...PlatformBase,
    platform_id: 'pico-8',
    core: 'retro8',
    platform_name: 'PICO-8',
    short_name: 'PICO-8',
    theme: {
        '--color0': '#1D2B53',
        '--color1': '#00E436',
        '--color2': '#FF004D',
        '--color3': '#FFEC27',
        '--font': 'PICO8',
        '--fontsize': '2em',
        '--cursorwidth': '1em'
    },
    savestates_disabled: true,
    rewind_disabled: true,
    force_scale: true,
    video_smooth: false,
    keyboard_controller_info: {
        "Arrow Keys": "D-PAD",
        "Z": "Button B",
        "X": "Button A"
    },
    touch_controllers: [
        JOYSTICK_TOUCH_MODE.QUICKSHOT_DYNAMIC
    ],
    default_touch_controller: JOYSTICK_TOUCH_MODE.QUICKSHOT_DYNAMIC,
    fire_buttons: 2,
    message: ["PICO-8 support is under development and mostly broken or non-functional."]
};

export default PICO8;
