import PlatformBase from '../PlatformBase.js';
import { JOYSTICK_TOUCH_MODE, MOUSE_TOUCH_MODE } from '../../Constants.js';

const Amiga = {
  ...PlatformBase,
  platform_id: 'amiga',
  core: 'puae',
  bios: ['kick1x', 'kick2x', 'kick3x'],
  platform_name: 'Commodore Amiga',
  short_name: 'Amiga',
  theme: {
    '--color0': '#A7A7A7',
    '--color1': '#000000',
    '--color2': '#666666',
    '--color3': '#ffffff',
    '--color4': '#6780ae',
    '--font': 'Topaz1200',
    '--cursorwidth': '0.5em',
    '--portrait-fontsize': '100%'
  },
  startup_beforelaunch: async function (nostalgist, storageManager) {
    const FS = nostalgist.getEmscriptenFS();

    const k1xAB = await storageManager.getFile('amiga.kick34005.A500');
    const k2xAB = await storageManager.getFile('amiga.kick40063.A600');
    const k3xAB = await storageManager.getFile('amiga.kick40068.A1200');

    FS.writeFile('/home/web_user/retroarch/userdata/system/kick34005.A500', await new Uint8Array(k1xAB));
    FS.writeFile('/home/web_user/retroarch/userdata/system/kick40063.A600', await new Uint8Array(k2xAB));
    FS.writeFile('/home/web_user/retroarch/userdata/system/kick40068.A1200', await new Uint8Array(k3xAB));
  },
  guessConfig: (fileName) => {
    if (fileName.endsWith(".adf")) {
      return {
        puae_model: "A500",
        puae_kickstart: "kick34005.A500",
        puae_video_vresolution: "single",
        puae_video_resolution: "hires",
        puae_cpu_compatibility: "exact",
        puae_crop_mode: "auto"
      };
    }

    return {
      puae_cpu_compatibility: "exact",
      puae_video_vresolution: "single",
      puae_video_resolution: "hires",
      puae_crop_mode: "auto"
    };
  },
  shader: ['assets/shaders/crt/crt-geom.glslp', 'assets/shaders/crt/shaders/crt-geom.glsl'],
  // force_scale: true,
  video_smooth: false,
  dependencies: [
    {
      key: "kick34005.A500",
      type: "A500 Kickstart v1.3 rev 34.005",
      required: true,
      accepted: ["82a21c1890cae844b3df741f2762d48d"]
    },
    {
      key: "kick40063.A600",
      type: "A600 Kickstart v3.1 rev 40.063",
      required: true,
      accepted: ["e40a5dfb3d017ba8779faba30cbd1c8e"]
    },
    {
      key: "kick40068.A1200",
      type: "A1200 Kickstart v3.1 rev 40.068",
      required: true,
      accepted: ["646773759326fbac3b2311fd8c8793ee"]
    },
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
    input_player1_x: 'nul',
    input_player1_y: 'nul',
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
    input_player1_l2: 'F13', //lmb
    input_player1_r2: 'F14', //rmb
    input_player1_b: 'F15' //fire
  },
  custom_controllers: {
    special_button: {
      label: 'CUSTOM'
    },
    fastui_area: {
      landscape: '1 / 1 / span 50 / span 50',
      portrait: '1 / 1 / span 50 / span 50'
    },
    focus_defaults: {
      'amiga-pinball-1': true,
      'amiga-pinball-2': true,
      'preset-test': false
    },
    presets: [
      {
        "id": "amiga-pinball-1",
        "name": "Pinball 1",
        "description": "Pinball Dreams, Pinball Fantasies",
        "gameFocus": true,
        "layout": {
          "landscape": {
            "columns": 50,
            "rows": 50
          },
          "portrait": {
            "columns": 50,
            "rows": 50
          }
        },
        "elements": [
          {
            "id": "amiga-pinball-left-shift",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "Shift",
                "code": "ShiftLeft",
                "keyCode": 16
              }
            },
            "gridArea": {
              "landscape": "37 / 1 / span 14 / span 10",
              "portrait": "44 / 1 / span 7 / span 23"
            },
            "label": "LEFT"
          },
          {
            "id": "amiga-pinball-right-shift",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "Shift",
                "code": "ShiftRight",
                "keyCode": 16
              }
            },
            "gridArea": {
              "landscape": "37 / 41 / span 14 / span 10",
              "portrait": "44 / 28 / span 7 / span 23"
            },
            "label": "RIGHT"
          },
          {
            "id": "amiga-pinball-plunger",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "ArrowDown",
                "code": "ArrowDown",
                "keyCode": 40
              }
            },
            "gridArea": {
              "landscape": "27 / 43 / span 9 / span 8",
              "portrait": "38 / 32 / span 5 / span 19"
            },
            "label": "PLUNGER"
          },
          {
            "id": "amiga-pinball-tilt",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "X",
                "code": "Space",
                "keyCode": 32
              }
            },
            "gridArea": {
              "landscape": "27 / 1 / span 9 / span 8",
              "portrait": "38 / 1 / span 5 / span 19"
            },
            "label": "TILT"
          },
          {
            "id": "amiga-pinball-f1",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "F1",
                "code": "F1",
                "keyCode": 112
              }
            },
            "gridArea": {
              "landscape": "3 / 5 / span 4 / span 4",
              "portrait": "26 / 11 / span 2 / span 9"
            },
            "label": "F1"
          },
          {
            "id": "amiga-pinball-f2",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "F2",
                "code": "F2",
                "keyCode": 113
              }
            },
            "gridArea": {
              "landscape": "8 / 5 / span 4 / span 4",
              "portrait": "29 / 11 / span 2 / span 9"
            },
            "label": "F2"
          },
          {
            "id": "amiga-pinball-f3",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "F3",
                "code": "F3",
                "keyCode": 114
              }
            },
            "gridArea": {
              "landscape": "13 / 5 / span 4 / span 4",
              "portrait": "32 / 11 / span 2 / span 9"
            },
            "label": "F3"
          },
          {
            "id": "amiga-pinball-f4",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "F4",
                "code": "F4",
                "keyCode": 115
              }
            },
            "gridArea": {
              "landscape": "18 / 5 / span 4 / span 4",
              "portrait": "35 / 11 / span 2 / span 9"
            },
            "label": "F4"
          },
          {
            "id": "amiga-pinball-esc",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "Escape",
                "code": "Escape",
                "keyCode": 27
              }
            },
            "gridArea": {
              "landscape": "3 / 47 / span 4 / span 4",
              "portrait": "26 / 42 / span 2 / span 9"
            },
            "label": "ESC"
          },
          {
            "id": "amiga-pinball-y",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "y",
                "code": "KeyY",
                "keyCode": 89
              }
            },
            "gridArea": {
              "landscape": "8 / 47 / span 4 / span 4",
              "portrait": "29 / 42 / span 2 / span 9"
            },
            "label": "Y"
          }
        ]
      },
      {
        "id": "amiga-pinball-2",
        "name": "Pinball 2",
        "description": "Pinball Illusions",
        "gameFocus": true,
        "layout": {
          "landscape": {
            "columns": 50,
            "rows": 50
          },
          "portrait": {
            "columns": 50,
            "rows": 50
          }
        },
        "elements": [
          {
            "id": "amiga-pinball-left-shift",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "Shift",
                "code": "ShiftLeft",
                "keyCode": 16
              }
            },
            "gridArea": {
              "landscape": "37 / 1 / span 14 / span 10",
              "portrait": "44 / 1 / span 7 / span 23"
            },
            "label": "LEFT"
          },
          {
            "id": "amiga-pinball-right-shift",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "Shift",
                "code": "ShiftRight",
                "keyCode": 16
              }
            },
            "gridArea": {
              "landscape": "37 / 41 / span 14 / span 10",
              "portrait": "44 / 28 / span 7 / span 23"
            },
            "label": "RIGHT"
          },
          {
            "id": "amiga-pinball-plunger",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "Enter",
                "code": "Enter",
                "keyCode": "13"
              }
            },
            "gridArea": {
              "landscape": "27 / 43 / span 9 / span 8",
              "portrait": "38 / 32 / span 5 / span 19"
            },
            "label": "PLUNGER"
          },
          {
            "id": "amiga-pinball-tilt",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "X",
                "code": "Space",
                "keyCode": 32
              }
            },
            "gridArea": {
              "landscape": "27 / 1 / span 9 / span 4",
              "portrait": "38 / 1 / span 5 / span 9"
            },
            "label": "TILT"
          },
          {
            "id": "amiga-pinball-f1",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "F1",
                "code": "F1",
                "keyCode": "112"
              }
            },
            "gridArea": {
              "landscape": "3 / 5 / span 4 / span 4",
              "portrait": "26 / 11 / span 2 / span 9"
            },
            "label": "F1"
          },
          {
            "id": "amiga-pinball-f2",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "ArrowUp",
                "code": "ArrowUp",
                "keyCode": "38"
              }
            },
            "gridArea": {
              "landscape": "8 / 5 / span 4 / span 4",
              "portrait": "29 / 11 / span 2 / span 9"
            },
            "label": "▲"
          },
          {
            "id": "amiga-pinball-f3",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "ArrowDown",
                "code": "ArrowDown",
                "keyCode": "40"
              }
            },
            "gridArea": {
              "landscape": "13 / 5 / span 4 / span 4",
              "portrait": "32 / 11 / span 2 / span 9"
            },
            "label": "▼"
          },
          {
            "id": "amiga-pinball-f4",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "X",
                "code": "Space",
                "keyCode": "32"
              }
            },
            "gridArea": {
              "landscape": "18 / 5 / span 4 / span 4",
              "portrait": "35 / 11 / span 2 / span 9"
            },
            "label": "OK"
          },
          {
            "id": "amiga-pinball-esc",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "Escape",
                "code": "Escape",
                "keyCode": 27
              }
            },
            "gridArea": {
              "landscape": "3 / 47 / span 4 / span 4",
              "portrait": "26 / 42 / span 2 / span 9"
            },
            "label": "ESC"
          },
          {
            "id": "amiga-pinball-y",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "y",
                "code": "KeyY",
                "keyCode": 89
              }
            },
            "gridArea": {
              "landscape": "8 / 47 / span 4 / span 4",
              "portrait": "29 / 42 / span 2 / span 9"
            },
            "label": "Y"
          },
          {
            "id": "tilt-2",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "Meta",
                "code": "MetaLeft",
                "keyCode": "91"
              }
            },
            "gridArea": {
              "landscape": "27 / 5 / span 9 / span 4",
              "portrait": "38 / 11 / span 5 / span 9"
            },
            "label": "TILT"
          }
        ]
      },

      {
        "id": "preset-test",
        "name": "Worms (1995)",
        "description": "incl. Touchpad (tap to click)",
        "gameFocus": false,
        "layout": {
          "landscape": {
            "columns": 50,
            "rows": 50
          },
          "portrait": {
            "columns": 50,
            "rows": 50
          }
        },
        "elements": [
          {
            "id": "worms-pad",
            "component": "TouchpadComponent",
            "binding": {
              "type": "joy"
            },
            "gridArea": {
              "landscape": "27 / 16 / span 24 / span 21",
              "portrait": "38 / 16 / span 13 / span 19"
            },
            "label": "worms-pad",
            "options": {
              "style": "tab",
              "tapToClick": true,
              "anywhere": true,
              "label": ""
            }
          },
          {
            "id": "worms-mv",
            "component": "QuickshotComponent",
            "binding": {
              "type": "joy"
            },
            "gridArea": {
              "landscape": "27 / 1 / span 24 / span 11",
              "portrait": "38 / 1 / span 13 / span 14"
            },
            "label": "worms-mv",
            "options": {
              "label": "MOVE/AIM",
              "style": "outline",
              "mode": "keyboard",
              "keys": {
                "up": {
                  "key": "d",
                  "code": "KeyD",
                  "keyCode": "68"
                },
                "down": {
                  "key": "x",
                  "code": "KeyX",
                  "keyCode": "88"

                },
                "left": {
                  "key": "z",
                  "code": "KeyZ",
                  "keyCode": "90"
                },
                "right": {
                  "key": "c",
                  "code": "KeyC",
                  "keyCode": "67"
                }
              }
            }
          },
          {
            "id": "worms-jump",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "Enter",
                "code": "Enter",
                "keyCode": "13"
              }
            },
            "gridArea": {
              "landscape": "36 / 40 / span 15 / span 11",
              "portrait": "43 / 36 / span 8 / span 15"
            },
            "label": "JUMP"
          },
          {
            "id": "worms-p",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "p",
                "code": "KeyP",
                "keyCode": "80"
              }
            },
            "gridArea": {
              "landscape": "3 / 47 / span 4 / span 4",
              "portrait": "26 / 42 / span 2 / span 9"
            },
            "label": "PAUSE"
          },
          {
            "id": "worms-tab",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "Tab",
                "code": "Tab",
                "keyCode": "9"
              }
            },
            "gridArea": {
              "landscape": "8 / 47 / span 4 / span 4",
              "portrait": "29 / 42 / span 2 / span 9"
            },
            "label": "CENTER"
          },
          {
            "id": "worms-tilde",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "`",
                "code": "Backquote",
                "keyCode": "192"
              }
            },
            "gridArea": {
              "landscape": "13 / 47 / span 4 / span 4",
              "portrait": "32 / 42 / span 2 / span 9"
            },
            "label": "NAMES"
          },
          {
            "id": "worms-fire",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "x",
                "code": "Space",
                "keyCode": "32"
              }
            },
            "gridArea": {
              "landscape": "27 / 40 / span 8 / span 11",
              "portrait": "38 / 36 / span 4 / span 15"
            },
            "label": "FIRE"
          },
          {
            "id": "worms-f1",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "F2",
                "code": "F2",
                "keyCode": "113"
              }
            },
            "gridArea": {
              "landscape": "23 / 3 / span 3 / span 2",
              "portrait": "26 / 18 / span 2 / span 6"
            },
            "label": "F2"
          },
          {
            "id": "worms-f2",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "F1",
                "code": "F1",
                "keyCode": "112"
              }
            },
            "gridArea": {
              "landscape": "23 / 1 / span 3 / span 2",
              "portrait": "26 / 11 / span 2 / span 6"
            },
            "label": "F1"
          },
          {
            "id": "worms-f3",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "F3",
                "code": "F3",
                "keyCode": "114"
              }
            },
            "gridArea": {
              "landscape": "23 / 5 / span 3 / span 2",
              "portrait": "26 / 25 / span 2 / span 6"
            },
            "label": "F3"
          },
          {
            "id": "worms-f4",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "F4",
                "code": "F4",
                "keyCode": "115"
              }
            },
            "gridArea": {
              "landscape": "23 / 7 / span 3 / span 2",
              "portrait": "29 / 11 / span 2 / span 6"
            },
            "label": "F4"
          },
          {
            "id": "worms-f5",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "F5",
                "code": "F5",
                "keyCode": "116"
              }
            },
            "gridArea": {
              "landscape": "23 / 9 / span 3 / span 2",
              "portrait": "29 / 18 / span 2 / span 6"
            },
            "label": "F5"
          },
          {
            "id": "worms-f6",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "F6",
                "code": "F6",
                "keyCode": "117"
              }
            },
            "gridArea": {
              "landscape": "23 / 41 / span 3 / span 2",
              "portrait": "29 / 25 / span 2 / span 6"
            },
            "label": "F6"
          },
          {
            "id": "worms-f7",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "F7",
                "code": "F7",
                "keyCode": "118"
              }
            },
            "gridArea": {
              "landscape": "23 / 43 / span 3 / span 2",
              "portrait": "32 / 11 / span 2 / span 6"
            },
            "label": "F7"
          },
          {
            "id": "worms-f8",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "F8",
                "code": "F8",
                "keyCode": "119"
              }
            },
            "gridArea": {
              "landscape": "23 / 45 / span 3 / span 2",
              "portrait": "32 / 18 / span 2 / span 6"
            },
            "label": "F8"
          },
          {
            "id": "worms-f9",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "F9",
                "code": "F9",
                "keyCode": "120"
              }
            },
            "gridArea": {
              "landscape": "23 / 47 / span 3 / span 2",
              "portrait": "32 / 25 / span 2 / span 6"
            },
            "label": "F9"
          },
          {
            "id": "worms-f10",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "F10",
                "code": "F10",
                "keyCode": "121"
              }
            },
            "gridArea": {
              "landscape": "23 / 49 / span 3 / span 2",
              "portrait": "35 / 11 / span 2 / span 6"
            },
            "label": "F10"
          },
          {
            "id": "worms-right",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "F14",
                "code": "F14",
                "keyCode": "125"
              }
            },
            "gridArea": {
              "landscape": "18 / 5 / span 4 / span 4",
              "portrait": "35 / 18 / span 2 / span 13"
            },
            "label": "ARMS"
          },
          {
            "id": "worms-1",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "1",
                "code": "Digit1",
                "keyCode": "49"
              }
            },
            "gridArea": {
              "landscape": "5 / 7 / span 3 / span 2",
              "portrait": "24 / 15 / span 1 / span 3"
            },
            "label": "1"
          },
          {
            "id": "worms-2",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "2",
                "code": "Digit2",
                "keyCode": "50"
              }
            },
            "gridArea": {
              "landscape": "8 / 5 / span 3 / span 2",
              "portrait": "24 / 18 / span 1 / span 3"
            },
            "label": "2"
          },
          {
            "id": "worms-3",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "3",
                "code": "Digit3",
                "keyCode": "51"
              }
            },
            "gridArea": {
              "landscape": "8 / 7 / span 3 / span 2",
              "portrait": "24 / 21 / span 1 / span 3"
            },
            "label": "3"
          },
          {
            "id": "worms-4",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "4",
                "code": "Digit4",
                "keyCode": "52"
              }
            },
            "gridArea": {
              "landscape": "11 / 5 / span 3 / span 2",
              "portrait": "24 / 24 / span 1 / span 3"
            },
            "label": "4"
          },
          {
            "id": "worms-5",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "5",
                "code": "Digit5",
                "keyCode": "53"
              }
            },
            "gridArea": {
              "landscape": "11 / 7 / span 3 / span 2",
              "portrait": "24 / 27 / span 1 / span 3"
            },
            "label": "5"
          },
          {
            "id": "worms-minus",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "-",
                "code": "Minus",
                "keyCode": "189"
              }
            },
            "gridArea": {
              "landscape": "14 / 5 / span 3 / span 2",
              "portrait": "24 / 30 / span 1 / span 3"
            },
            "label": "LO"
          },
          {
            "id": "worms-plus",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "=",
                "code": "Equal",
                "keyCode": "187",
                "shiftKey": true
              }
            },
            "gridArea": {
              "landscape": "14 / 7 / span 3 / span 2",
              "portrait": "24 / 33 / span 1 / span 3"
            },
            "label": "HI"
          }
        ]
      }

    ]
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
  },
  rewind_granularity: 25,
  fastforward_ratio: 10,
};

export default Amiga;
