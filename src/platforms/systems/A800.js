import PlatformBase from '../PlatformBase.js';

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
    guessConfig: (fileName) => {
        const tagRules = {
            "[BASIC]": {
                atari800_cassboot: "enabled",
                atari800_internalbasic: "enabled"
            },
            "(130XE)": {
                atari800_system: "130XE (128K)"
            },
            "[128K]": {
                atari800_system: "130XE (128K)"
            },
            "[192K]": {
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
                atari800_system: "400/800 (OS B)"
            },
            "[REQ OSA]": {
                atari800_system: "400/800 (OS B)"
            },
            "[REQ OSB]": {
                atari800_system: "400/800 (OS B)"
            },
            "[STEREO]": {
            }
        };

        const defaultOptions = {
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
    fire_buttons: 1,
    additional_buttons: {
        1: {
            "label": "OPTION",
            "key": {
                "key": 'F2',
                "code": 'F2',
                "keyCode": 113
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
                "keyCode": 115
            }
        }

    }
};

export default A800;