import PlatformBase from '../PlatformBase.js';
import { JOYSTICK_TOUCH_MODE } from '../../Constants.js';

const GBC = {
    ...PlatformBase,
    platform_id: 'gbc',
    core: 'gambatte',
    platform_name: 'Nintendo Game Boy Color',
    short_name: 'GBC',
    theme: {
        '--color0': '#ffffff',
        '--color1': '#4e93f1',
        '--color2': '#ffffff',
        '--color3': '#c95340',
        '--font': 'GB',
        '--cursorwidth': '1em'
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
    force_scale: true,
    keyboard_controller_info: {
        "Arrow Keys": "D-PAD",
        "Z": "Button B",
        "X": "Button A",
        "Right Shift": "Select",
        "Enter": "Start"
    },
    touch_controllers: [
        JOYSTICK_TOUCH_MODE.QUICKSHOT_DYNAMIC
    ],
    default_touch_controller: JOYSTICK_TOUCH_MODE.QUICKSHOT_DYNAMIC,
    fire_buttons: 2,
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

export default GBC;



