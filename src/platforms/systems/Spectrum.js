import PlatformBase from '../PlatformBase.js';

const Spectrum = {
    ...PlatformBase,
    platform_id: 'spectrum',
    core: 'fuse',
    platform_name: 'Sinclair ZX Spectrum',
    short_name: 'Spectrum',
    theme: {
        '--color0': '#c0c000',
        '--color1': '#0000c0',
        '--color3': '#be2ec8',
        '--color2': '#ffffff',
        '--font': 'ZXSpectrum',
        '--cursorwidth': '1em',
    },
    shader: ['assets/shaders/crt/crt-geom.glslp', 'assets/shaders/crt/shaders/crt-geom.glsl'],
    fire_buttons: 1,
    additional_buttons: {
    }
};

export default Spectrum;


