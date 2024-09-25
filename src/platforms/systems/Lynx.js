import PlatformBase from '../PlatformBase.js';
import { JOYSTICK_TOUCH_MODE } from '../../Constants.js';

const Lynx = {
    ...PlatformBase,
    platform_id: 'lynx',
    core: 'handy',
    platform_name: 'Atari Lynx',
    short_name: 'Lynx',
    theme: {
        '--color0': '#579342',
        '--color1': '#ebe4b2',
        '--color3': '#985495',
        '--font': 'Lynx',
        '--transform': 'uppercase',
        '--cursorwidth': '0.75em',
        '--cursorheight': '1em'
    },
    shader: async function (nostalgist) {
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
    touch_controllers: [
        JOYSTICK_TOUCH_MODE.QUICKSHOT_DYNAMIC,
        JOYSTICK_TOUCH_MODE.HIDEAWAY
    ],
    default_touch_controller: JOYSTICK_TOUCH_MODE.QUICKSHOT_DYNAMIC,
    fire_buttons: 2,
    additional_buttons: {
        1: {
            "label": "2",
            "keyCode": 'r'
        },
        2: {
            "label": "START",
            "keyCode": 'start'
        },
        3: {
            "label": "1",
            "keyCode": 'l'
        }
    }
};

export default Lynx;


