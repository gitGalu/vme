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
    arrow_keys: {
        up: { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
        down: { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
        left: { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 },
        right: { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 }
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
        shiftKey: 1,
        overrides: {
        }
    },
    touch_keyboard_reconfig: {
        keyMappings: {
            'keyQ': {
                value: 'a',
                code: 'KeyA'
            },
            'keyW': {
                value: 'z',
                code: 'KeyZ'
            },
            'keyA': {
                value: 'q',
                code: 'KeyQ'
            },
            'keyZ': {
                value: 'w',
                code: 'KeyW'
            },
            'keyM': {
                value: ';',
                code: 'Semicolon'
            },
            'key1': {
                value: '1',
                code: 'Digit1',
                shift: true
            },
            // 'key2': { 
            //     value: '2',
            //     code: 'Digit2',
            //     shift: true
            // },
            // 'key3': {
            //     value: '3',
            //     code: 'Digit3',
            //     shift: true
            // },
            'key4': {
                value: '4',
                code: 'Digit4',
                shift: true
            },
            'key5': {
                value: '5',
                code: 'Digit5',
                shift: true
            },
            // 'key6': {
            //     value: '6',
            //     code: 'Digit6',
            //     shift: true
            // },
            // 'key7': {
            //     value: '7',
            //     code: 'Digit7',
            //     shift: true
            // },
            'key8': {
                value: '8',
                code: 'Digit8',
                shift: true
            },
            'key9': {
                value: '9',
                code: 'Digit9',
                shift: true
            },
            'key0': {
                value: '0',
                code: 'Digit0',
                shift: true
            }
        },
    },
    additional_buttons: {
    }
};

export default CPC;