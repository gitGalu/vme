import PlatformBase from '../PlatformBase.js';
import { JOYSTICK_TOUCH_MODE } from '../../Constants.js';
const CPC = {
    ...PlatformBase,
    platform_id: 'cpc',
    core: 'crocods',
    platform_name: 'Amstrad CPC',
    short_name: 'CPC',
    loader: 'unzip',
    theme: {
        '--color0': '#000060',
        '--color1': '#d6e121',
        '--color2': '#000000',
        '--color3': '#ea3323',
        '--font': 'AmstradCPC',
        '--cursorwidth': '1em'
    },
    startup_beforelaunch: async function (nostalgist, storageManager) {
        const FS = nostalgist.getEmscriptenFS();
        FS.mkdirTree('/home/web_user/.crocods/cfg/')
        const ini = await fetch('assets/config/crocods.ini');
        FS.writeFile('/home/web_user/.crocods/crocods.ini', await ini.text());
    },
    guessConfig: (fileName) => {
        return {
        };
    },
    savestates_disabled: true,
    shader: ['assets/shaders/crt/crt-geom.glslp', 'assets/shaders/crt/shaders/crt-geom.glsl'],
    keyboard_controller_info: {
        "Arrow Keys": "Joystick Directions",
        "Z": "Joystick Fire",
        "X": "Select file on launch"
    },
    touch_controllers: [
        JOYSTICK_TOUCH_MODE.QUICKJOY_PRIMARY,
        JOYSTICK_TOUCH_MODE.QUICKSHOT_DYNAMIC,
        JOYSTICK_TOUCH_MODE.HIDEAWAY
    ],
    touch_controller_mapping: {
        input_player1_up: 'F13',
        input_player1_left: 'F14', 
        input_player1_down: 'F15',
        input_player1_right: 'F11', 
        input_player1_b: 'b',
        input_player1_a: 'b'
    },
    fire_buttons: 1,
    keyboard: {
        shiftKey: 2,
        overrides: {
        }
    },
    additional_buttons: {
    }
};

export default CPC;