import PlatformBase from '../PlatformBase.js';
import { JOYSTICK_TOUCH_MODE } from '../../Constants.js';

const PICO8 = {
    ...PlatformBase,
    platform_id: 'pico-8',
    core: 'fake08',
    core_asset_version: 'fake08-state-3',
    platform_name: 'PICO-8',
    short_name: 'PICO-8',
    theme: {
        '--color0': '#1D2B53',
        '--color1': '#00E436',
        '--color2': '#FF004D',
        '--color3': '#FFEC27',
        '--font': 'PICO8',
        '--fontsize': '1em',
        '--cursorwidth': '1em',
        '--portrait-fontsize': '100%'
    },
    savestates_disabled: false,
    rewind_disabled: false,
    rewind_granularity: 30,
    force_scale: true,
    video_smooth: false,
    keyboard_controller_info: {
        "Arrow Keys": "D-PAD",
        "Z": "Button O",
        "X": "Button X"
    },
    keyboard_controller_mapping: {
        input_player1_a: 'x',
        input_player1_b: 'z'
    },
    touch_controllers: [
        JOYSTICK_TOUCH_MODE.QUICKSHOT_DYNAMIC
    ],
    default_touch_controller: JOYSTICK_TOUCH_MODE.QUICKSHOT_DYNAMIC,
    fire_buttons: 2
};

export default PICO8;
