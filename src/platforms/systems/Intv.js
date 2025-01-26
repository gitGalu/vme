import PlatformBase from '../PlatformBase.js';
import { JOYSTICK_TOUCH_MODE } from '../../Constants.js';

const Intv = {
    ...PlatformBase,
    platform_id: 'intv',
    core: 'freeintv',
    platform_name: 'Mattel Intellivision',
    short_name: 'Intv',
    theme: {
        '--color0': '#566A1D',
        '--color1': '#FAFAFA',
        '--color2': '#E44D2B',
        '--color3': '#EFF469',
        '--font': 'Intellivision',
        '--fontsize': '1.2em',
        '--transform': 'uppercase',
        '--cursorwidth': '0.5em'
    },
    startup_beforelaunch: async function (nostalgist, storageManager) {
        const FS = nostalgist.getEmscriptenFS();

        FS.mkdirTree('/home/web_user/retroarch/userdata/system/');

        const exec = await storageManager.getFile('intv.exec.bin');
        FS.writeFile('/home/web_user/retroarch/userdata/system/exec.bin', await new Uint8Array(exec));

        const grom = await storageManager.getFile('intv.grom.bin');
        FS.writeFile('/home/web_user/retroarch/userdata/system/grom.bin', await new Uint8Array(grom));
    },
    shader: ['assets/shaders/crt/crt-geom.glslp', 'assets/shaders/crt/shaders/crt-geom.glsl'],
    keyboard_controller_info: {
        "Arrow Keys": "Directions",
        "Z": "Right Action Button",
        "X": "Left Action Button",
        "A": "Top Action Button",
        "Enter": "Pause",
        "1...0": "Keypad"
    },
    touch_controllers: [
        JOYSTICK_TOUCH_MODE.QUICKSHOT_DYNAMIC
    ],
    default_touch_controller: JOYSTICK_TOUCH_MODE.QUICKSHOT_DYNAMIC,
    dependencies: [
        {
            key: "grom.bin",
            type: "Graphics ROM",
            required: true,
            accepted: ["0cd5946c6473e42e8e4c2137785e427f"]
        },
        {
            key: "exec.bin",
            type: "Executive ROM",
            required: true,
            accepted: ["62e761035cb657903761800f4437b8af"]
        },
    ],
    fire_buttons: 3,
    additional_buttons: {
        1: {
            "label": "E",
            "key": {
                "key": ']',
                "code": 'BracketRight'
            }
        },
        2: {
            "label": "2",
            "key": {
                "key": '2',
                "code": 'Digit2'
            }
        },
        3: {
            "label": "1",
            "key": {
                "key": '1',
                "code": 'Digit1'
            }
        },
    }
};

export default Intv;




