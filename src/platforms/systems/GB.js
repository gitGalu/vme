import PlatformBase from '../PlatformBase.js';
import { JOYSTICK_TOUCH_MODE } from '../../Constants.js';

const GB = {
    ...PlatformBase,
    platform_id: 'gb',
    core: 'gambatte',
    platform_name: 'Nintendo Game Boy',
    short_name: 'GB',
    theme: {
        '--color0': '#828329',
        '--color1': '#374e79',
        '--font': 'GB',
        '--cursorwidth': '1em'
    },
    shader: async function(nostalgist){
        const FS = nostalgist.getEmscriptenFS();

        const glslp = await fetch('assets/shaders/handheld/gameboy.glslp')
        const background = await fetch('assets/shaders/handheld/gameboy/resources/background.png');

        const backgroundBlob = await background.blob();
        const backgroundArrayBuffer = await backgroundBlob.arrayBuffer();

        const palette = await fetch('assets/shaders/handheld/gameboy/resources/palette.png');
        const paletteBlob = await palette.blob();
        const paletteArrayBuffer = await paletteBlob.arrayBuffer();

        const shader0 = await fetch('assets/shaders/handheld/gameboy/shader-files/gb-pass0.glsl');
        const shader1 = await fetch('assets/shaders/handheld/gameboy/shader-files/gb-pass1.glsl');
        const shader2 = await fetch('assets/shaders/handheld/gameboy/shader-files/gb-pass2.glsl');
        const shader3 = await fetch('assets/shaders/handheld/gameboy/shader-files/gb-pass3.glsl');
        const shader4 = await fetch('assets/shaders/handheld/gameboy/shader-files/gb-pass4.glsl');

        FS.mkdirTree('/home/web_user/retroarch/bundle/shaders/shaders_glsl/handheld/shaders/gameboy/resources');
        FS.mkdirTree('/home/web_user/retroarch/bundle/shaders/shaders_glsl/handheld/shaders/gameboy/shader-files');

        FS.writeFile('/home/web_user/retroarch/bundle/shaders/shaders_glsl/handheld/gameboy.glslp', await glslp.text());
        FS.writeFile('/home/web_user/retroarch/bundle/shaders/shaders_glsl/handheld/shaders/gameboy/resources/palette.png', new Uint8Array(paletteArrayBuffer));
        FS.writeFile('/home/web_user/retroarch/bundle/shaders/shaders_glsl/handheld/shaders/gameboy/resources/background.png', new Uint8Array(backgroundArrayBuffer));

        FS.writeFile('/home/web_user/retroarch/bundle/shaders/shaders_glsl/handheld/shaders/gameboy/shader-files/gb-pass0.glsl', await shader0.text());
        FS.writeFile('/home/web_user/retroarch/bundle/shaders/shaders_glsl/handheld/shaders/gameboy/shader-files/gb-pass1.glsl', await shader1.text());
        FS.writeFile('/home/web_user/retroarch/bundle/shaders/shaders_glsl/handheld/shaders/gameboy/shader-files/gb-pass2.glsl', await shader2.text());
        FS.writeFile('/home/web_user/retroarch/bundle/shaders/shaders_glsl/handheld/shaders/gameboy/shader-files/gb-pass3.glsl', await shader3.text());
        FS.writeFile('/home/web_user/retroarch/bundle/shaders/shaders_glsl/handheld/shaders/gameboy/shader-files/gb-pass4.glsl', await shader4.text());

        FS.mkdirTree('/home/web_user/retroarch/userdata/config/')
        FS.writeFile(
          '/home/web_user/retroarch/userdata/config/global.glslp',
          '#reference /home/web_user/retroarch/bundle/shaders/shaders_glsl/handheld/gameboy.glslp',
        )
    },
    force_scale: true,
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

export default GB;
