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
    touch_controller_mapping: {
        input_player1_up: 'F13',
        input_player1_left: 'F14',
        input_player1_down: 'F15',
        input_player1_right: 'F11',
        input_player1_b: 'kp_minus',
        input_player1_a: 'nul',
        input_player1_y: 'nul',
        input_player1_x: 'nul',
        input_player1_start: 'nul',
        input_player1_select: 'nul',
        input_player1_l: 'nul',
        input_player1_r: 'nul'
    },
    fire_buttons: 1,
    keyboard: {
        shiftKey: 1,
        overrides: {
        }
    },
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

export default VIC20;


