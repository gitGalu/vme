import PlatformBase from '../PlatformBase.js';

const GB = {
    ...PlatformBase,
    platform_id: 'gb',
    core: 'gambatte',
    platform_name: 'Nintendo Game Boy',
    short_name: 'GB',
    theme: {
        '--color0': '#828329',
        '--color1': '#374e79',
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

export default GB;
