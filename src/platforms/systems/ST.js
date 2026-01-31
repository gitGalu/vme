import PlatformBase from '../PlatformBase.js';
import { JOYSTICK_TOUCH_MODE, MOUSE_TOUCH_MODE } from '../../Constants.js';
import { FileUtils } from '../../utils/FileUtils.js';

const ST = {
  ...PlatformBase,
  platform_id: 'st',
  core: 'hatarib',
  platform_name: 'Atari ST / STE / TT / Falcon',
  short_name: 'ST',
  loader: 'gemzip',
  theme: {
    '--color0': '#ffffff',
    '--color1': '#000000',
    '--color2': '#000000',
    '--color3': '#ffffff',
    '--color4': '#6780ae',
    '--font': 'ST',
    '--fontsize': '1.2em',
    '--cursorwidth': '0.5em',
    '--portrait-fontsize': '100%'
  },

  startup_beforelaunch: async function (nostalgist, storageManager) {
    const FS = nostalgist.getEmscriptenFS();
    FS.mkdirTree('/home/web_user/retroarch/userdata/system/hatarib');

    if (this._gemdosZipContent && this._gemdosFolderName) {
      const destDir = `/home/web_user/retroarch/userdata/system/hatarib/${this._gemdosFolderName}`;
      await FileUtils.unzipToEmscriptenFS(this._gemdosZipContent, FS, destDir);
      FS.writeFile(`/home/web_user/retroarch/userdata/system/hatarib/${this._gemdosFolderName}.gem`, new Uint8Array(0));
      FS.writeFile(`/home/web_user/retroarch/userdata/system/hatarib/${this._gemdosFolderName}.GEM`, new Uint8Array(0));
      this._gemdosZipContent = null;
      this._gemdosFolderName = null;
    }

    const tos = await storageManager.getFile('st.tos.img');
    const ste = await storageManager.getFile('st.ste.img');
    const falcon = await storageManager.getFile('st.falcon.img');

    FS.writeFile('/home/web_user/retroarch/userdata/system/tos.img', await new Uint8Array(tos));
    FS.writeFile('/home/web_user/retroarch/userdata/system/hatarib/ste.img', await new Uint8Array(ste));
    FS.writeFile('/home/web_user/retroarch/userdata/system/hatarib/falcon.img', await new Uint8Array(falcon));
  },
  guessBIOS: (fileName) => {
    let defaultBios = ['tos.img'];
    let nameU = fileName.toUpperCase();

    const biosTags = {
      "(STE)": ['ste.img'],

      "(FALCON030)": ['hatarib/falcon.img'],
      "(FALCON)": ['hatarib/falcon.img'],
      "[FALCON ONLY]": ['hatarib/falcon.img'],
      "[FALCON VERSION]": ['hatarib/falcon.img']
    };

    for (let tag in biosTags) {
      if (nameU.includes(tag)) {
        return biosTags[tag];
      }
    }
    return defaultBios;
  },
  guessConfig: (fileName) => {
    const defaultOptions = {
      hatarib_show_welcome: 1,
      hatarib_statusbar: 0,
      hatarib_readonly_floppy: 1,
      // hatarib_log_hatari: 5,
      // hatarib_save_floppy: 0,
      // hatarib_savestate_floppy_modify: 0
      // hatarib_emutos_region: 1,
      // hatarib_emutos_framerate: 1,
    };

    const canonicalRules = {
      STE: {
        hatarib_machine: 2,
        hatarib_tos: "hatarib/ste.img",
      },
      FALCON: {
        hatarib_machine: 5,
        hatarib_cpu: 3,
        hatarib_cpu_clock: 16,
        hatarib_tos: "hatarib/falcon.img",
        hatarib_memory: 14336,
        hatarib_monitor: 2
      },
      MEM1: {
        hatarib_memory: 1024,
      },
      MEM2: {
        hatarib_memory: 2048,
      },
      MEM4: {
        hatarib_memory: 4096,
      },
      MONO: {
        hatarib_monitor: 0
      }
    };
    const tagAliases = {
      // TODO (Mega ST), (Mega-STE), (TT)
      "(STE)": "STE",

      "(FALCON030)": "FALCON",
      "(FALCON)": "FALCON",
      "[FALCON ONLY]": "FALCON",
      "[FALCON VERSION]": "FALCON",

      "[1MB]": "MEM1",
      "[2MB]": "MEM2",
      "[4MB]": "MEM4",

      "[MONOCHROME]": "MONO"
    };

    const nameU = fileName.toUpperCase();
    const config = { ...defaultOptions };

    for (const [tag, key] of Object.entries(tagAliases)) {
      if (nameU.includes(tag)) Object.assign(config, canonicalRules[key]);
    }

    return config;
  },
  savestates_disabled: true,
  shader: ['assets/shaders/crt/crt-geom.glslp', 'assets/shaders/crt/shaders/crt-geom.glsl'],
  force_scale: true,
  video_smooth: false,
  dependencies: [
    {
      key: "tos.img",
      type: "TOS 1.02 (ST)",
      required: true,
      accepted: ["b2a8570de2e850c5acf81cb80512d9f6", "c1c57ce48e8ee4135885cee9e63a68a2"]
    },
    {
      key: "ste.img",
      type: "TOS 2.06 (STE)",
      required: true,
      accepted: ["0604dbb85928f0598d04144a8b554bbe"]
    },
    {
      key: "falcon.img",
      type: "TOS 4.04 (Falcon030)",
      required: true,
      accepted: ["e5ea0f216fb446f1c4a4f476bc5f03d4"]
    }
  ],
  keyboard_controller_info: {
    "Arrow Keys": "Joystick Directions",
    "Z": "Joystick Fire",
    "Mouse": "Mouse"
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
    JOYSTICK_TOUCH_MODE.HIDEAWAY,
  ],
  mouse_controllers: [
    MOUSE_TOUCH_MODE.TRACKPAD_BUTTONS
  ],
  keyboard_controller_mapping: {
    input_player1_x: 'nul',
    input_player1_y: 'nul',
    input_player1_c: 'nul',
    input_player1_b: 'z', //fire
    input_player1_a: 'nul',
    input_player1_l: 'nul',
    input_player1_r: 'nul',
    input_player1_select: 'nul',
    input_player1_start: 'nul',
    input_player1_l2: 'nul',
    input_player1_r2: 'nul',
    input_player1_gun_start: 'nul',
    input_player1_gun_start_btn: 'nul',
    input_player1_gun_start_axis: 'nul',
    input_player1_gun_start_mbtn: 'nul',
    input_player1_gun_select: 'nul',
    input_player1_gun_select_btn: 'nul',
    input_player1_gun_select_axis: 'nul',
    input_player1_gun_select_mbtn: 'nul'
  },
  touch_controller_mapping: {
    input_player1_x: 'F14',
    input_player1_y: 'F13',
    input_player1_c: 'nul',
    input_player1_a: 'nul',
    input_player1_l: 'nul',
    input_player1_r: 'nul',
    input_player1_select: 'nul',
    input_player1_start: 'nul',
    input_player1_gun_start: 'nul',
    input_player1_gun_start_btn: 'nul',
    input_player1_gun_start_axis: 'nul',
    input_player1_gun_start_mbtn: 'nul',
    input_player1_gun_select: 'nul',
    input_player1_gun_select_btn: 'nul',
    input_player1_gun_select_axis: 'nul',
    input_player1_gun_select_mbtn: 'nul',
    input_player1_l2: 'nul', //lmb
    input_player1_r2: 'nul', //rmb
    input_player1_b: 'F15' //fire
  },
  fire_buttons: 1,
  keyboard: {
    shiftKey: 2,
    overrides: {
    }
  },
  additional_keyboard: {
    "layerF": [
      { "id": "keyFA29", "value": "ArrowUp", "code": "ArrowUp", "label": "↑" },
      { "id": "keyFA39", "value": "ArrowDown", "code": "ArrowDown", "label": "↓" },
      { "id": "keyF21", "value": "ArrowLeft", "code": "ArrowLeft", "label": "←" },
      { "id": "keyF22", "value": "ArrowRight", "code": "ArrowRight", "label": "→" },
      { "id": "keyF14", "value": "F1", "code": "F1", "label": "F1" },
      { "id": "keyF15", "value": "F2", "code": "F2", "label": "F2" },
      { "id": "keyF16", "value": "F3", "code": "F3", "label": "F3" },
      { "id": "keyF24", "value": "F4", "code": "F4", "label": "F4" },
      { "id": "keyF25", "value": "F5", "code": "F5", "label": "F5" },
      { "id": "keyF26", "value": "F6", "code": "F6", "label": "F6" },
      { "id": "keyF34", "value": "F7", "code": "F7", "label": "F7" },
      { "id": "keyF35", "value": "F8", "code": "F8", "label": "F8" },
      { "id": "keyF36", "value": "F9", "code": "F9", "label": "F9" },
      { "id": "keyF45", "value": "F10", "code": "F10", "label": "F10" },
      { "id": "keyFL11", "value": "shift", "code": "ShiftLeft", "label": "LShift" },
      { "id": "keyFR11", "value": "shift", "code": "ShiftRight", "label": "RShift" }
    ]
  },
  additional_buttons: {
    1: {
      "label": "RETURN",
      "key": {
        "key": 'enter',
        "code": 'Enter',
      }
    },
    2: {
      "label": "SPACE",
      "key": {
        "key": 'space',
        "code": 'Space',
      }
    }
  },
  message: ["ST/TT/STE/Falcon support is under development and mostly broken or non-functional."]
};

export default ST;
