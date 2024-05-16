import PlatformBase from '../PlatformBase.js';

const C264 = {
    ...PlatformBase,
    platform_id: 'c264',
    core: 'vice_xplus4',
    platform_name: 'Commodore C16, C116 & Plus/4',
    short_name: 'C264',
    theme: {
        '--color1': '#000000',
        '--color2': '#ffffff',
        '--color0': '#c6b4fa',
        '--color3': '#000000',
        '--font': 'Petme64',
        '--cursorwidth': '1em',
    },
    shader: ['assets/shaders/crt/crt-geom.glslp', 'assets/shaders/crt/shaders/crt-geom.glsl'],
    fire_buttons: 1,
    additional_buttons: {
        // 1: {
        //     "label": "KB",
        //     "keyCode": 'select'
        // }
    }
};

export default C264;


