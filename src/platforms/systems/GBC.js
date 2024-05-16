import PlatformBase from '../PlatformBase.js';

const GBC = {
    ...PlatformBase,
    platform_id: 'gbc',
    core: 'gambatte',
    platform_name: 'Nintendo Game Boy Color',
    short_name: 'GBC',
    theme: {
        '--color0': '#ffffff',
        '--color1': '#4e93f1',
        '--color2': '#ffffff',
        '--color3': '#c95340',
        '--font': 'GB',
        '--cursorwidth': '1em'
    },
    shader: '',
    fire_buttons: 2,
    additional_buttons: {
        1: {
            "label": "SELECT",
            "keyCode": 'select'
        },
        2: {
            "label": "START",
            "keyCode": 'start'
        }
    }
};

export default GBC;



