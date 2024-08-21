import PlatformBase from '../PlatformBase.js';
import { JOYSTICK_TOUCH_MODE } from '../../Constants.js';

const SNK = {
    ...PlatformBase,
    platform_id: 'snk',
    core: 'fbalpha2012_neogeo',
    platform_name: 'Neo Geo AES / MVS',
    short_name: 'SNK',
    theme: {
        '--color0': '#656565',
        '--color1': '#c3c3c3',
        '--color3': '#71f3f2',
        '--color2': '#000000',
        '--font': 'SNK',
        '--cursorwidth': '1em',
        '--transform': 'none'
    },
    shader: ['assets/shaders/crt/crt-geom.glslp', 'assets/shaders/crt/shaders/crt-geom.glsl'],
    guessConfig: (fileName) => {
        return {
        };
    },
    touch_controllers: [
        JOYSTICK_TOUCH_MODE.QUICKSHOT_DYNAMIC
    ],
    default_touch_controller: JOYSTICK_TOUCH_MODE.QUICKSHOT_DYNAMIC,
    fire_buttons: 4,
    button_overrides: {
        "3countb": 4, //a,b,c,a+b
        "2020bb": 4,
        "alpham2": 3,
        "androdun": 2,
        "aodk": 4, 
        "aof": 4, 
        "aof2": 4,
        "aof3": 4,
        "bakatono": 4, //19
        "bjourney": 3,
        "blazstar": 2,
        "breakers": 4,
        "bstars": 4,
        "bstars2": 4,
        "burningf": 3, //a,b,c,a+b
        "crsword": 2,
        "cyberlip": 3,
        "doubledr": 4,
        "eightman": 3, //a,a+b,c
        "fatfursp": 4,
        "fatfury1": 4,
        "fatfury2": 4,
        "fatfury3": 4,
        "fbfrenzy": 4,
        "galaxyfg": 4,
        "garou": 4,
        "gowcaizr": 4,
        "gpilots": 2,
        "joyjoy": 2,
        "kabukikl": 4, //+
        "karnovr": 4,
        "kizuna": 4,
        "kof94": 4,
        "kof95": 4,
        "kof96": 4,
        "kof97": 4,
        "kof98": 4,
        "kof99": 4,
        "kof2000": 4,
        "kof2001": 4,
        "kof2002": 4,
        "kof2003": 4,
        "kotm": 3,
        "kotm2": 3,
        "lastblad": 4,
        "lastbld2": 4,
        "lbowling": 1,
        "legendos": 2,
        "lresort": 2,
        "magdrop2": 2,
        "magdrop3": 3,
        "maglord": 2,
        "mahretsu": 2,
        "marukodq": 4, //?
        "matrim": 4,
        "minasan": 0,
        "mosyougi": 0,
        "mslug": 3, //+
        "mslug2": 3, //+
        "mslug3": 3, //+
        "mslug4": 4,
        "mslug5": 4,
        "mslugx": 3, //+
        "mutnat": 2,
        "nam1975": 3,
        "ncombat": 3,
        "ncommand": 3,
        "neocup98": 3,
        "ninjamas": 4,
        "overtop": 2, //?
        "pulstar": 2,
        "quizdai2": 4, //?
        "quizdais": 4, //?
        "quizkof": 4, //?
        "ragnagrd": 4,
        "rbff1": 4,
        "rbff1a": 4,
        "rbff2": 4,
        "rbffspec": 4,
        "ridhero": 3,
        "roboarmy": 3,
        "rotd": 4,
        "samsh5sp": 4,
        "samsho": 4,
        "samsho2": 4,
        "samsho3": 4,
        "samsho4": 4,
        "samsho5": 4,
        "savagere": 4,
        "sengoku": 3,
        "sengoku2": 4,
        "sengoku3": 4,
        "shocktr2": 4,
        "socbrawl": 2,
        "sonicwi2": 2,
        "sonicwi3": 2,
        "spinmast": 3,
        "ssideki": 2,
        "ssideki2": 3,
        "ssideki3": 3,
        "ssideki4": 3,
        "stakwin": 2,
        "stakwin2": 3,
        "strhoop": 2,
        "superspy": 3,
        "svc": 4, //+
        "tophuntr": 3,
        "tpgolf": 4,
        "trally": 2,
        "turfmast": 3,
        "twinspri": 2,
        "viewpoin": 2,
        "wakuwak7": 4,
        "wh1": 3,
        "wh2": 3,
        "wh2j": 3,
        "whp": 4, //+
        "wjammers": 2
    },
    additional_buttons: {
        1: {
            "label": "COIN",
            "keyCode": 'select'
        },
        2: {
            "label": "START",
            "keyCode": 'start'
        }
    },
};

export default SNK;