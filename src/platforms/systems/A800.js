import PlatformBase from '../PlatformBase.js';
import { JOYSTICK_TOUCH_MODE } from '../../Constants.js';

const A800 = {
    ...PlatformBase,
    platform_id: 'atari800',
    core: 'atari800',
    bios: ['ATARIXL.ROM', 'ATARIBAS.ROM'],
    platform_name: 'Atari 800 / XE / XL',
    short_name: 'A800',
    theme: {
        '--color0': '#005181',
        '--color1': '#60b7e7',
        '--color3': '#005181',
        '--color2': '#60b7e7',
        '--font': 'Atascii',
        '--cursorwidth': '1em'
    },
    shader: ['assets/shaders/crt/crt-geom.glslp', 'assets/shaders/crt/shaders/crt-geom.glsl'],
    force_scale: true,
    video_smooth: false,
    guessBIOS: (fileName) => {
        let defaultBios = ['ATARIXL.ROM', 'ATARIBAS.ROM'];

        const biosTags = {
            "[400-800]": ['ATARIOSB.ROM', 'ATARIBAS.ROM'],
            "[REQ OSA]": ['ATARIOSA.ROM', 'ATARIBAS.ROM'],
            "[REQ OSB]": ['ATARIOSB.ROM', 'ATARIBAS.ROM']
        };

        for (let tag in biosTags) {
            if (fileName.toUpperCase().includes(tag)) {
                return biosTags[tag];
            }
        }

        return defaultBios;
    },
    guessConfig: (fileName) => {
        const tagRules = {
            "[BASIC]": {
                atari800_internalbasic: "enabled"
            },
            "(130XE)": {
                atari800_system: "130XE (128K)"
            },
            "[130XE]": {
                atari800_system: "130XE (128K)"
            },
            "[128K]": {
                atari800_system: "130XE (128K)"
            },
            "(128)": {
                atari800_system: "130XE (128K)"
            },
            "[192K]": {
                atari800_system: "Modern XL/XE(320K CS)"
            },
            "[REQ 256K]": {
                atari800_system: "Modern XL/XE(320K CS)"
            },
            "[256K]": {
                atari800_system: "Modern XL/XE(320K CS)"
            },
            "[320K]": {
                atari800_system: "Modern XL/XE(320K CS)"
            },
            "[1MB]": {
                atari800_system: "Modern XL/XE(1088K)"
            },
            "[400-800]": {
                atari800_system: "400/800 (OS B)",
            },
            "[REQ OSA]": {
                atari800_system: "400/800 (OS A)",
            },
            "[REQ OSB]": {
                atari800_system: "400/800 (OS B)",
                atari800_ntscpal: 'NTSC'
            },
            "[STEREO]": {
            },
            ".CAS": {
                atari800_cassboot: "enabled",
                // atari800_sioaccel: "disabled"
            }
        };
        const defaultOptions = {
            atari800_f10: 'disabled',
            atari800_ntscpal: 'PAL',
            atari800_resolution: '336x240',
            atari800_system: '800XL (64K)'
        };

        let config = { ...defaultOptions };

        Object.keys(tagRules).forEach(tag => {
            if (fileName.toUpperCase().includes(tag)) {
                Object.assign(config, tagRules[tag]);
            }
        });

        return config;
    },
    dependencies: [
        {
            key: "ATARIXL.ROM",
            type: "Atari XL/XE OS ROM",
            required: true,
            accepted: ["06daac977823773a3eea3422fd26a703"]
        },
        {
            key: "ATARIBAS.ROM",
            type: "BASIC interpreter ROM",
            required: true,
            accepted: ["0bac0c6a50104045d902df4503a4c30b"]
        },
        {
            key: "ATARIOSA.ROM",
            type: "Atari 400/800 PAL ROM",
            required: true,
            accepted: ["eb1f32f5d9f382db1bbfb8d7f9cb343a"]
        },
        {
            key: "ATARIOSB.ROM",
            type: "Atari 400/800 NTSC ROM",
            required: true,
            accepted: ["a3e8d617c95d08031fe1b20d541434b2"]
        },
    ],
    keyboard_controller_info: {
        "Arrow Keys": "Joystick Directions",
        "Z": "Joystick Fire",
        "Right Shift": "Select",
        "F2": "Option",
        "F4": "Start"
    },
    arrow_keys: {
        up: { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
        down: { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
        left: { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 },
        right: { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 }
    },
    touch_controllers: [
        JOYSTICK_TOUCH_MODE.QUICKJOY_PRIMARY,
        JOYSTICK_TOUCH_MODE.QUICKSHOT_DYNAMIC,
        JOYSTICK_TOUCH_MODE.HIDEAWAY
    ],
    touch_controller_mapping: {
        input_player1_up: 'F13',
        input_player1_left: 'F14',
        input_player1_down: 'F15',
        input_player1_right: 'F11',
        input_player1_b: 'kp_minus',
        input_player1_a: 'kp_minus'
    },
    keyboard_joystick_mapping: {
        ArrowUp: { key: 'F13', code: 'F13', keyCode: 124 },
        ArrowLeft: { key: 'F14', code: 'F14', keyCode: 125 },
        ArrowDown: { key: 'F15', code: 'F15', keyCode: 126 },
        ArrowRight: { key: 'F11', code: 'F11', keyCode: 122 },
        KeyZ: { key: '-', code: 'NumpadSubtract', keyCode: 109 }
    },
    gamepad_filter: {
        coalesceButtons: [0, 1],
        coalesceTarget: 0,
        disableButtons: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 16]
    },
    gamepad_controller_mapping: {
        input_player1_b_btn: '0', //0
        input_player1_a_btn: 'nul',
        input_player1_x_btn: 'nul',
        input_player1_y_btn: 'nul',
        input_player1_c_btn: 'nul',
        input_player1_l_btn: 'nul',
        input_player1_r_btn: 'nul',
        input_player1_select_btn: 'nul',
        input_player1_start_btn: 'nul',
        input_menu_toggle_btn: 'nul',
        input_menu_toggle: 'nul'
    },
    keyboard_controller_mapping: {
        input_player1_up: 'F13',
        input_player1_left: 'F14',
        input_player1_down: 'F15',
        input_player1_right: 'F11',
        input_player1_b: 'kp_minus',
        input_player1_a: 'nul'

    },
    fire_buttons: 1,
    keyboard: {
        shiftKey: 2,
        overrides: {
        }
    },
    additional_buttons: {
        1: {
            "label": "OPTION",
            "key": {
                "key": 'F2',
                "code": 'F2',
            }
        },
        2: {
            "label": "SELECT",
            "keyCode": 'select'
        },
        3: {
            "label": "START",
            "key": {
                "key": 'F4',
                "code": 'F4',
            }
        }
    }
};

export default A800;
