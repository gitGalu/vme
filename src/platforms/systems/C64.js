import PlatformBase from '../PlatformBase.js';

const C64 = {
    ...PlatformBase,
    platform_id: 'c64',
    core: 'vice_x64',
    platform_name: 'Commodore 64',
    short_name: 'C64',
    theme: {
        '--color0': '#6a53f5',
        '--color1': '#b19efe',
        '--color2': '#68a941',
        '--color3': '#d0dc71',
        '--font': 'PetMe64',
        '--cursorwidth': '1em',
    },
    guessConfig: (fileName) => {
        return {
            vice_drive_true_emulation: 'true',
            vice_warp_boost: 'enabled',
            vice_autostart: 'enabled',
            vice_autoloadwarp: 'enabled',
        };
    },
    shader: ['assets/shaders/crt/crt-geom.glslp', 'assets/shaders/crt/shaders/crt-geom.glsl'],
    fire_buttons: 1,
    additional_buttons: {
        1: {
            "label": "SPACE",
            "key": {
                "key": 'Space',
                "code": 'Space'
            }
        },
        2: {
            "label": "RUN/STOP",
            "key": {
                "key": 'Escape',
                "code": 'Escape'
            }
        },
        3: {
            "label": "F1",
            "key": {
                "key": 'F1',
                "code": 'F1'
            }
        }
    }
};

export default C64;





