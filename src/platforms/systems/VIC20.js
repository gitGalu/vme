import PlatformBase from '../PlatformBase.js';

const VIC20 = {
    ...PlatformBase,
    platform_id: 'vic20',
    core: 'vice_xvic',
    platform_name: 'Commodore VIC-20',
    short_name: 'VIC20',
    theme: {
        '--color0': '#ffffff',
        '--color1': '#250ec5',
        '--color2': '#250ec5',
        '--color3': '#6ebdcb',
        '--font': 'PetMe2X',
        '--cursorwidth': '2em',
        '--transform': 'uppercase',
    },
    shader: ['assets/shaders/crt/crt-geom.glslp', 'assets/shaders/crt/shaders/crt-geom.glsl'],
    fire_buttons: 1,
    additional_buttons: {
    }
};

export default VIC20;


