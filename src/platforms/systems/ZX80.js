import PlatformBase from '../PlatformBase.js';

const ZX80 = {
    ...PlatformBase,
    platform_id: 'zx80',
    core: '81',
    platform_name: 'Sinclair ZX80 / ZX81',
    short_name: 'ZX80',
    theme: {
        '--color0': '#ffffff',
        '--color1': '#000000',
        '--color2': '#000000',
        '--color3': '#ffffff',
        '--font': 'ZXSpectrum',
        '--cursorwidth': '1em',
        '--transform': 'uppercase',
    },
    shader: ['assets/shaders/crt/crt-geom.glslp', 'assets/shaders/crt/shaders/crt-geom.glsl'],
    fire_buttons: 1,
    additional_buttons: {
    }
};

export default ZX80;


