import PlatformBase from '../PlatformBase.js';
import { JOYSTICK_TOUCH_MODE } from '../../Constants.js';

const Jaguar = {
    ...PlatformBase,
    platform_id: 'jaguar',
    core: 'virtualjaguar',
    core_asset_version: '3.10.0-ffea7893',
    platform_name: 'Atari Jaguar',
    short_name: 'Jaguar',
    libretro_thumbnails_system: 'Atari - Jaguar',
    theme: {
        // Tempest 2000-inspired cyan and magenta against a purple playfield.
        '--color0': '#28145a',
        '--color1': '#8cf2ff',
        '--color2': '#fff35c',
        '--color3': '#a81291',
        '--font': 'PixelOperatorMono8',
        '--fontsize': '1em',
        '--portrait-fontsize': '85%',
        '--transform': 'none',
        '--cursorwidth': '1em'
    },
    shader: ['assets/shaders/crt/crt-geom.glslp', 'assets/shaders/crt/shaders/crt-geom.glsl'],
    guessConfig: () => ({
        virtualjaguar_bios: 'disabled',
        virtualjaguar_pal: 'disabled',
        virtualjaguar_usefastblitter: 'disabled',
        virtualjaguar_internal_resolution: '1x'
    }),
    keyboard_controller_mapping: {
        input_player1_a: 'x',
        input_player1_b: 'z',
        input_player1_y: 'a',
        input_player1_select: 'rshift',
        input_player1_start: 'enter'
    },
    keyboard_controller_info: {
        'Arrow Keys': 'D-PAD',
        'X': 'Button A',
        'Z': 'Button B',
        'A': 'Button C',
        'Right Shift': 'Pause',
        'Enter': 'Option',
        '0...9': 'Keypad 0...9',
        '- / =': 'Keypad * / #'
    },
    touch_controllers: [
        JOYSTICK_TOUCH_MODE.QUICKSHOT_DYNAMIC,
        JOYSTICK_TOUCH_MODE.QUICKSHOT_STATIC
    ],
    default_touch_controller: JOYSTICK_TOUCH_MODE.QUICKSHOT_DYNAMIC,
    fire_buttons: 3,
    touch_keypad: {
        keys: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map(label => ({
            label,
            key: label === '*' ? '-' : label === '#' ? '=' : label,
            code: label === '*' ? 'Minus' : label === '#' ? 'Equal' : `Digit${label}`
        }))
    },
    additional_buttons: {
        1: {
            label: 'PAUSE',
            keyCode: 'select'
        },
        2: {
            label: 'OPTION',
            keyCode: 'start'
        }
    }
};

export default Jaguar;
