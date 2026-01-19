import PlatformBase from '../PlatformBase.js';
import { JOYSTICK_TOUCH_MODE } from '../../Constants.js';

const C128 = {
    ...PlatformBase,
    platform_id: 'c128',
    core: 'vice_x128',
    platform_name: 'Commodore 128',
    short_name: 'C128',
    theme: {
        '--color0': '#b9e893',
        '--color1': '#555555',
        '--color2': '#555555',
        '--color3': '#b9e893',
        '--font': 'PetMe1282Y',
        '--cursorwidth': '0.5em',
    },
    startup_beforelaunch: async function (nostalgist, storageManager) {
        var el = document.getElementById('kbCtrlClear');
        el.classList.add('kbCtrlSmall');
        el.textContent = 'RUN\nSTOP';
        el = document.getElementById('keyBackspace');
        el.textContent = 'DEL';
    },
    guessConfig: (fileName) => {
        return {
        };
    },
    shader: ['assets/shaders/crt/crt-geom.glslp', 'assets/shaders/crt/shaders/crt-geom.glsl'],
    keyboard_controller_info: {
        "Arrow Keys": "Joystick Directions",
        "Z": "Joystick Fire",
        "Escape": "Run/Stop"
    },
    touch_controllers: [
        JOYSTICK_TOUCH_MODE.QUICKJOY_PRIMARY,
        JOYSTICK_TOUCH_MODE.QUICKSHOT_DYNAMIC,
        JOYSTICK_TOUCH_MODE.HIDEAWAY
    ],
    keyboard: {
        shiftKey: 1,
        overrides: {
        }
    },
    additional_buttons: {
        1: {
            "label": "SPACE",
            "key": {
                "key": 'Space',
                "code": 'Space'
            }
        },
        2: {
            "label": "RUN/STOP",
            "key": {
                "key": 'Escape',
                "code": 'Escape'
            }
        },
        3: {
            "label": "F1",
            "key": {
                "key": 'F1',
                "code": 'F1'
            }
        }
    }
};

export default C128;



