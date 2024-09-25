import PlatformBase from '../PlatformBase.js';
import { JOYSTICK_TOUCH_MODE } from '../../Constants.js';

const Coleco = {
    ...PlatformBase,
    platform_id: 'coleco',
    core: 'gearcoleco',
    platform_name: 'ColecoVision',
    short_name: 'Coleco',
    theme: {
        '--color0': '#000000',
        '--color1': '#EEEEEE',
        '--color3': '#E7585B',
        '--color2': '#F0E59B',
        '--font': 'Coleco',
        '--fontsize': '1.2em',
        '--transform': 'uppercase',
        '--cursorwidth': '0.5em'
    },
    startup_beforelaunch: async function (nostalgist, storageManager) {
        const FS = nostalgist.getEmscriptenFS();

        const bios = await storageManager.getFile('coleco.colecovision.rom');

        FS.mkdirTree('/home/web_user/retroarch/userdata/system/');

        FS.writeFile('/home/web_user/retroarch/userdata/system/colecovision.rom', await new Uint8Array(bios));
    },
    shader: ['assets/shaders/crt/crt-geom.glslp', 'assets/shaders/crt/shaders/crt-geom.glsl'],
    touch_controllers: [
        JOYSTICK_TOUCH_MODE.QUICKSHOT_DYNAMIC
    ],
    default_touch_controller: JOYSTICK_TOUCH_MODE.QUICKSHOT_DYNAMIC,
    dependencies: [
        {
            key: "colecovision.rom",
            type: "ColecoVision ROM",
            required: true,
            accepted: ["2c66f5911e5b42b8ebe113403548eee7"]
        }
    ],
    fire_buttons: 2,
    additional_buttons: {
        3: {
            "label": "1",
            "keyCode": "x"
        },
        2: {
            "label": "2",
            "keyCode": "y"
        },
        1: {
            "label": "#",
            "keyCode": "select"   
        }
    }
};

export default Coleco;




