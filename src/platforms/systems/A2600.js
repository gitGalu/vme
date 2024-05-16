import PlatformBase from '../PlatformBase.js';

const A2600 = {
    ...PlatformBase,
    platform_id: 'atari2600',
    core: 'stella2014',
    platform_name: 'Atari 2600 / VCS',
    short_name: 'A2600',
    theme: {
        '--color0': '#000000',
        '--color1': '#a984ec',
        '--color2': '#ffffff',
        '--color3': '#a984ec',
        '--font': 'AtariSmall',
        '--cursorwidth': '0.5em',
        '--transform': 'uppercase',
        '--width': 'double',
    },
    shader: ['assets/shaders/crt/crt-geom.glslp', 'assets/shaders/crt/shaders/crt-geom.glsl'],
    fire_buttons: 1,
    additional_buttons: {
        1: {
            "label": "SELECT",
            "keyCode": 'select'
        },
        2: {
            "label": "START",
            "keyCode": 'start'
        },
    }
};

export default A2600;


