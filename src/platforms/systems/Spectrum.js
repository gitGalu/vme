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
    savestates_disabled: true,
    shader: ['assets/shaders/crt/crt-geom.glslp', 'assets/shaders/crt/shaders/crt-geom.glsl'],
    guessConfig: (fileName) => {
        const tagRules = {

        };

        const defaultOptions = {
            input_libretro_device_p1: "513",
            input_libretro_device_p2: "0",
            input_libretro_device_p3: "259",
            input_libretro_device_p4: "1",
            input_libretro_device_p5: "1",
            fuse_machine: "Spectrum 128K"
        };

        let config = { ...defaultOptions };

        Object.keys(tagRules).forEach(tag => {
            if (fileName.toUpperCase().includes(tag)) {
                Object.assign(config, tagRules[tag]);
            }
        });

        return config;
    },
    touch_controller_mapping: {
        input_player1_up: 'F13',
        input_player1_left: 'F14',
        input_player1_down: 'F15',
        input_player1_right: 'F11',
        input_player1_b: 'kp_minus'
    },
    fire_buttons: 1,
    keyboard: {
        shiftKey: 1,
        overrides: {
        }
    },
    additional_buttons: {
    },
    message: ["ZX Spectrum support is under development and mostly broken or non-functional."]
};

export default Spectrum;


