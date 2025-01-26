import PlatformBase from '../PlatformBase.js';
import { JOYSTICK_TOUCH_MODE } from '../../Constants.js';

const GBA = {
    ...PlatformBase,
    platform_id: 'gba',
    core: 'mgba',
    platform_name: 'Nintendo Game Boy Advance',
    short_name: 'GBA',
    theme: {
        '--color0': '#222222',
        '--color1': '#dddddd',
        '--color3': '#222222',
        '--color2': '#8abac2',
        '--font': 'PublicPixel',
        '--cursorwidth': '1em',
        '--transform': 'none'
    },
    shader: async function(nostalgist){
        const FS = nostalgist.getEmscriptenFS();

        const glslp = await fetch('assets/shaders/handheld/sameboy-lcd.glslp')
        const shader0 = await fetch('assets/shaders/handheld/shaders/sameboy-lcd.glsl');

        FS.mkdirTree('/home/web_user/retroarch/bundle/shaders/shaders_glsl/handheld/shaders');
        FS.writeFile('/home/web_user/retroarch/bundle/shaders/shaders_glsl/handheld/sameboy-lcd.glslp', await glslp.text());
        FS.writeFile('/home/web_user/retroarch/bundle/shaders/shaders_glsl/handheld/shaders/sameboy-lcd.glsl', await shader0.text());

        FS.mkdirTree('/home/web_user/retroarch/userdata/config/')
        FS.writeFile(
          '/home/web_user/retroarch/userdata/config/global.glslp',
          '#reference /home/web_user/retroarch/bundle/shaders/shaders_glsl/handheld/sameboy-lcd.glslp',
        )
    },
    guessConfig: (fileName) => {
        return {
        };
    },
    dependencies: [
        {
            key: "gba_bios.bin",
            type: "GBA BIOS",
            required: false,
            accepted: ["a860e8c0b6d573d191e4ec7db1b1e4f6"]
        }
    ],
    force_scale: true,
    keyboard_controller_info: {
        "Arrow Keys": "D-PAD",
        "Z": "Button B",
        "X": "Button A",
        "Q": "Button L",
        "W": "Button R",
        "Right Shift": "Select",
        "Enter": "Start"
    },
    touch_controllers: [
        JOYSTICK_TOUCH_MODE.QUICKSHOT_DYNAMIC
    ],
    default_touch_controller: JOYSTICK_TOUCH_MODE.QUICKSHOT_DYNAMIC,
    fire_buttons: 4,
    additional_buttons: {
        1: {
            "label": "SELECT",
            "keyCode": 'select'
        },
        2: {
            "label": "START",
            "keyCode": 'start'
        }
    }
};

export default GBA;