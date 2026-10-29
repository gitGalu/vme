import PlatformBase from '../PlatformBase.js';
import { JOYSTICK_TOUCH_MODE } from '../../Constants.js';

const Coleco = {
    ...PlatformBase,
    platform_id: 'coleco',
    core: 'gearcoleco',
    platform_name: 'ColecoVision',
    short_name: 'Coleco',
    libretro_thumbnails_system: 'Coleco - ColecoVision',
    theme: {
        '--color0': '#000000',
        '--color1': '#EEEEEE',
        '--color3': '#E7585B',
        '--color2': '#F0E59B',
        '--font': 'Coleco',
        '--fontsize': '1.2em',
        '--transform': 'uppercase',
        '--cursorwidth': '0.5em',
        '--portrait-fontsize': '100%'
    },
    startup_beforelaunch: async function (nostalgist, storageManager) {
        const FS = nostalgist.getEmscriptenFS();

        const bios = await storageManager.getFile('coleco.colecovision.rom');

        FS.mkdirTree('/home/web_user/retroarch/userdata/system/');

        FS.writeFile('/home/web_user/retroarch/userdata/system/colecovision.rom', await new Uint8Array(bios));
    },
    force_scale: true,
    shader: ['assets/shaders/crt/crt-geom.glslp', 'assets/shaders/crt/shaders/crt-geom.glsl'],
    keyboard_controller_info: {
        "Arrow Keys": "Directions",
        "Z": "Fire Left",
        "X": "Fire Right",
        "A": "Numpad 1",
        "S": "Numpad 2",
        "Q": "Numpad 3",
        "Right Shift": "Numpad #",
        "Enter": "Numpad *"
    },
    touch_controllers: [
        JOYSTICK_TOUCH_MODE.QUICKSHOT_DYNAMIC,
        JOYSTICK_TOUCH_MODE.QUICKSHOT_STATIC
    ],
    default_touch_controller: JOYSTICK_TOUCH_MODE.QUICKSHOT_DYNAMIC,
    // Gearcoleco reads its keypad through RetroPad buttons and left-stick axes.
    // Keep the touch keypad's digit keys separate from fire and D-pad input.
    touch_controller_mapping: {
        input_player1_y: 'num1',
        input_player1_x: 'num2',
        input_player1_l: 'num3',
        input_player1_r: 'num4',
        input_player1_l2: 'num5',
        input_player1_r2: 'num6',
        input_player1_l3: 'num7',
        input_player1_r3: 'num8',
        input_player1_start: 'minus',
        input_player1_select: 'equals',
        input_player1_l_x_plus: 'num0',
        input_player1_l_y_plus: 'num9',
        input_player1_analog_dpad_mode: '0'
    },
    touch_keypad: {
        replace_additional_buttons: true,
        keys: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map(label => ({
            label,
            key: label === '*' ? '-' : label === '#' ? '=' : label,
            code: label === '*' ? 'Minus' : label === '#' ? 'Equal' : `Digit${label}`
        }))
    },
    dependencies: [
        {
            key: "colecovision.rom",
            type: "ColecoVision ROM",
            required: true,
            accepted: ["2c66f5911e5b42b8ebe113403548eee7"]
        }
    ],
    fire_buttons: 2,
    // Retain the desktop Special keys menu; touch uses the full keypad above.
    additional_buttons: {
        3: {
            "label": "1",
            "keyCode": "y"
        },
        2: {
            "label": "2",
            "keyCode": "x"
        },
        1: {
            "label": "#",
            "keyCode": "select"
        }
    }
};

export default Coleco;




