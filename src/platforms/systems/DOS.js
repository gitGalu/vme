
import PlatformBase from '../PlatformBase.js';
import { JOYSTICK_TOUCH_MODE, MOUSE_TOUCH_MODE } from '../../Constants.js';
import { KeyMaps } from '../../touch/KeyMaps.js';

const DOS = {
    ...PlatformBase,
    platform_id: 'dos',
    core: 'dosbox_pure',
    uses_pthreads: true,
    platform_name: 'DOS PC (Pentium + SB + SVGA)',
    short_name: 'DOS',
    theme: {
        '--color0': '#0000AA',
        '--color1': '#FFFF55',
        '--color2': '#FFFFFF',
        '--color3': '#AA0101',
        '--color4': '#FFFF55',
        '--font': 'VGA',
        '--fontsize': '1.1em',
        '--cursorwidth': '0.5em',
        '--portrait-fontsize': '100%'
    },
    guessConfig: (fileName) => {
        return {
            dosbox_pure_memory_size: "16",
            dosbox_pure_voodoo: "off",
            dosbox_pure_savestate: "load-save",
            video_gpu_screenshot: "false"
        }
    },
    savestates_disabled: false,
    rewind_disabled: true,
    ffd_disabled: true,
    force_scale: true,
    video_smooth: false,
    dependencies: [
    ],
    arrow_keys: {
        up: { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
        down: { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
        left: { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 },
        right: { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 }
    },
    touch_controllers: [
    ],
    touch_key_mapping: {
        keyMap: {
            'Arrows+Space': KeyMaps.DOS_ARROWS_SPACE,
            'Arrows+Ctrl': KeyMaps.DOS_ARROWS_CTRL,
            'Arrows+Enter': KeyMaps.DOS_ARROWS_ENTER,
            'Arrows+Alt+Space': KeyMaps.DOS_ARROWS_ALT_SPACE
        },
        default: KeyMaps.DOS_ARROWS_SPACE
    },
    mouse_controllers: [
        MOUSE_TOUCH_MODE.TRACKPAD_BUTTONS
    ],
    keyboard_controller_mapping: {
        input_player1_up: 'nul',
        input_player1_left: 'nul',
        input_player1_down: 'nul',
        input_player1_right: 'nul',
        input_player1_x: 'nul',
        input_player1_y: 'nul',
        input_player1_c: 'nul',
        input_player1_a: 'nul',
        input_player1_b: 'nul',
        input_player1_l: 'nul',
        input_player1_r: 'nul',
        input_player1_l2: 'nul',
        input_player1_r2: 'nul',
        input_player1_l3: 'nul',
        input_player1_r3: 'nul',
        input_player1_select: 'nul',
        input_player1_start: 'nul',
        input_game_focus_toggle: 'nul',
        input_auto_game_focus: '1',
        input_menu_toggle: 'nul',
        input_menu_ok: 'nul',
        input_menu_ok_btn: 'nul',
        input_menu_ok_axis: 'nul',
        input_menu_ok_mbtn: 'nul',
        input_menu_cancel: 'nul',
        input_menu_cancel_btn: 'nul',
        input_menu_cancel_axis: 'nul',
        input_menu_cancel_mbtn: 'nul',
        input_menu_back: 'nul',
        input_menu_start: 'nul',
        input_menu_start_btn: 'nul',
        input_menu_start_axis: 'nul',
        input_menu_start_mbtn: 'nul',
        input_menu_select: 'nul',
        input_menu_select_btn: 'nul',
        input_menu_select_axis: 'nul',
        input_menu_select_mbtn: 'nul',
        input_menu_up: 'nul',
        input_menu_up_btn: 'nul',
        input_menu_up_axis: 'nul',
        input_menu_down: 'nul',
        input_menu_down_btn: 'nul',
        input_menu_down_axis: 'nul',
        input_menu_left: 'nul',
        input_menu_left_btn: 'nul',
        input_menu_left_axis: 'nul',
        input_menu_right: 'nul',
        input_menu_right_btn: 'nul',
        input_menu_right_axis: 'nul',
        input_menu_page_up: 'nul',
        input_menu_page_up_btn: 'nul',
        input_menu_page_up_axis: 'nul',
        input_menu_page_down: 'nul',
        input_menu_page_down_btn: 'nul',
        input_menu_page_down_axis: 'nul',
        input_menu_home: 'nul',
        input_menu_home_btn: 'nul',
        input_menu_home_axis: 'nul',
        input_menu_end: 'nul',
        input_menu_end_btn: 'nul',
        input_menu_end_axis: 'nul',
        input_player1_gun_start: 'nul',
        input_player1_gun_start_btn: 'nul',
        input_player1_gun_start_axis: 'nul',
        input_player1_gun_start_mbtn: 'nul',
        input_player1_gun_select: 'nul',
        input_player1_gun_select_btn: 'nul',
        input_player1_gun_select_axis: 'nul',
        input_player1_gun_select_mbtn: 'nul',
    },
    touch_controller_mapping: {
        input_player1_up: 'nul',
        input_player1_left: 'nul',
        input_player1_down: 'nul',
        input_player1_right: 'nul',
        input_player1_x: 'nul',
        input_player1_y: 'nul',
        input_player1_c: 'nul',
        input_player1_a: 'nul',
        input_player1_b: 'nul',
        input_player1_l: 'nul',
        input_player1_r: 'nul',
        input_player1_l2: 'nul',
        input_player1_r2: 'nul',
        input_player1_l3: 'nul',
        input_player1_r3: 'nul',
        input_player1_select: 'nul',
        input_player1_start: 'nul',
        input_game_focus_toggle: 'nul',
        input_auto_game_focus: '1',
        input_menu_toggle: 'nul',
        input_menu_ok: 'nul',
        input_menu_ok_btn: 'nul',
        input_menu_ok_axis: 'nul',
        input_menu_ok_mbtn: 'nul',
        input_menu_cancel: 'nul',
        input_menu_cancel_btn: 'nul',
        input_menu_cancel_axis: 'nul',
        input_menu_cancel_mbtn: 'nul',
        input_menu_back: 'nul',
        input_menu_start: 'nul',
        input_menu_start_btn: 'nul',
        input_menu_start_axis: 'nul',
        input_menu_start_mbtn: 'nul',
        input_menu_select: 'nul',
        input_menu_select_btn: 'nul',
        input_menu_select_axis: 'nul',
        input_menu_select_mbtn: 'nul',
        input_menu_up: 'nul',
        input_menu_up_btn: 'nul',
        input_menu_up_axis: 'nul',
        input_menu_down: 'nul',
        input_menu_down_btn: 'nul',
        input_menu_down_axis: 'nul',
        input_menu_left: 'nul',
        input_menu_left_btn: 'nul',
        input_menu_left_axis: 'nul',
        input_menu_right: 'nul',
        input_menu_right_btn: 'nul',
        input_menu_right_axis: 'nul',
        input_menu_page_up: 'nul',
        input_menu_page_up_btn: 'nul',
        input_menu_page_up_axis: 'nul',
        input_menu_page_down: 'nul',
        input_menu_page_down_btn: 'nul',
        input_menu_page_down_axis: 'nul',
        input_menu_home: 'nul',
        input_menu_home_btn: 'nul',
        input_menu_home_axis: 'nul',
        input_menu_end: 'nul',
        input_menu_end_btn: 'nul',
        input_menu_end_axis: 'nul',
        input_player1_gun_start: 'nul',
        input_player1_gun_start_btn: 'nul',
        input_player1_gun_start_axis: 'nul',
        input_player1_gun_start_mbtn: 'nul',
        input_player1_gun_select: 'nul',
        input_player1_gun_select_btn: 'nul',
        input_player1_gun_select_axis: 'nul',
        input_player1_gun_select_mbtn: 'nul',
    },
    custom_controllers: {
        special_button: {
            label: 'CUSTOM'
        },
        fastui_area: {
            landscape: '1 / 1 / span 50 / span 50',
            portrait: '1 / 1 / span 50 / span 50'
        },
        presets: [
            {
                "id": "dos-qj-space",
                "name": "Quickjoy Arrows + Space",
                "description": "Doofus, Magic Boy, Prehistorik 2, Another World",
                "gameFocus": true,
                "defaultLayoutId": "layout-1",
                "currentLayoutId": "layout-1",
                "layouts": [
                ],
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
                        "component": "DualTouchButton",
                        "binding": {
                            "type": "keyboard",
                            "primary": {
                                "key": "ArrowLeft",
                                "code": "ArrowLeft",
                                "keyCode": "37"
                            },
                            "secondary": {
                                "key": "ArrowRight",
                                "code": "ArrowRight",
                                "keyCode": "39"
                            }
                        },
                        "gridArea": {
                            "landscape": "39 / 1 / span 14 / span 16",
                            "portrait": "45 / 1 / span 6 / span 18"
                        },
                        "labels": [
                            "LEFT",
                            "RIGHT"
                        ],
                        "options": {
                            "isHorizontal": true
                        }
                    },
                    {
                        "component": "DualTouchButton",
                        "binding": {
                            "type": "keyboard",
                            "primary": {
                                "key": "ArrowUp",
                                "code": "ArrowUp",
                                "keyCode": "38"
                            },
                            "secondary": {
                                "key": "ArrowDown",
                                "code": "ArrowDown",
                                "keyCode": "40"
                            }
                        },
                        "gridArea": {
                            "landscape": "27 / 43 / span 24 / span 8",
                            "portrait": "39 / 40 / span 12 / span 11"
                        },
                        "labels": [
                            "UP",
                            "DOWN"
                        ],
                        "options": {
                            "isHorizontal": false
                        }
                    },
                    {
                        "component": "SingleTouchButton",
                        "binding": {
                            "type": "keyboard",
                            "key": {
                                "key": "space",
                                "code": "Space",
                                "keyCode": "32"
                            }
                        },
                        "gridArea": {
                            "landscape": "27 / 35 / span 24 / span 8",
                            "portrait": "39 / 29 / span 12 / span 11"
                        },
                        "label": "SPACE"
                    }
                ]
            },
            {
                "id": "dos-qj-shift",
                "name": "Quickjoy Arrows + Shift",
                "description": "Prince of Persia",
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
                        "component": "DualTouchButton",
                        "binding": {
                            "type": "keyboard",
                            "primary": {
                                "key": "ArrowLeft",
                                "code": "ArrowLeft",
                                "keyCode": "37"
                            },
                            "secondary": {
                                "key": "ArrowRight",
                                "code": "ArrowRight",
                                "keyCode": "39"
                            }
                        },
                        "gridArea": {
                            "landscape": "39 / 1 / span 14 / span 16",
                            "portrait": "45 / 1 / span 6 / span 18"
                        },
                        "labels": [
                            "LEFT",
                            "RIGHT"
                        ],
                        "options": {
                            "isHorizontal": true
                        }
                    },
                    {
                        "component": "DualTouchButton",
                        "binding": {
                            "type": "keyboard",
                            "primary": {
                                "key": "ArrowUp",
                                "code": "ArrowUp",
                                "keyCode": "38"
                            },
                            "secondary": {
                                "key": "ArrowDown",
                                "code": "ArrowDown",
                                "keyCode": "40"
                            }
                        },
                        "gridArea": {
                            "landscape": "27 / 43 / span 24 / span 8",
                            "portrait": "39 / 40 / span 12 / span 11"
                        },
                        "labels": [
                            "UP",
                            "DOWN"
                        ],
                        "options": {
                            "isHorizontal": false
                        }
                    },
                    {
                        "component": "SingleTouchButton",
                        "binding": {
                            "type": "keyboard",
                            "key": {
                                "key": "Shift",
                                "code": "ShiftLeft",
                                "keyCode": "16"
                            }
                        },
                        "gridArea": {
                            "landscape": "27 / 35 / span 24 / span 8",
                            "portrait": "39 / 29 / span 12 / span 11"
                        },
                        "label": "SHIFT"
                    }
                ]
            },
            {
                "id": "dos-pinball-tristan",
                "name": "Pinball 1",
                "description": "Solid State Pinball Tristan",
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
                        "component": "SingleTouchButton",
                        "binding": {
                            "type": "keyboard",
                            "key": {
                                "key": "ArrowUp",
                                "code": "ArrowUp",
                                "keyCode": 38
                            }
                        },
                        "gridArea": {
                            "landscape": "3 / 5 / span 4 / span 4",
                            "portrait": "26 / 11 / span 2 / span 9"
                        },
                        "label": "▲"
                    },
                    {
                        "component": "SingleTouchButton",
                        "binding": {
                            "type": "keyboard",
                            "key": {
                                "key": "Enter",
                                "code": "Enter",
                                "keyCode": 13
                            }
                        },
                        "gridArea": {
                            "landscape": "8 / 5 / span 4 / span 4",
                            "portrait": "29 / 11 / span 2 / span 9"
                        },
                        "label": "OK"
                    },
                    {
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
                            "landscape": "13 / 5 / span 4 / span 4",
                            "portrait": "32 / 11 / span 2 / span 9"
                        },
                        "label": "▼"
                    },
                    {
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
                        "component": "SingleTouchButton",
                        "binding": {
                            "type": "keyboard",
                            "key": {
                                "key": "Enter",
                                "code": "Enter",
                                "keyCode": 13
                            }
                        },
                        "gridArea": {
                            "landscape": "28 / 43 / span 8 / span 8",
                            "portrait": "38 / 32 / span 5 / span 19"
                        },
                        "label": "PLUNGER"
                    },
                    {
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
                            "landscape": "28 / 1 / span 8 / span 8",
                            "portrait": "38 / 1 / span 5 / span 19"
                        },
                        "label": "TILT"
                    }
                ]
            },
            {
                "id": "dos-pinball-epic",
                "name": "Pinball 2",
                "description": "Epic Pinball",
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
                        "component": "SingleTouchButton",
                        "binding": {
                            "type": "keyboard",
                            "key": {
                                "key": "Space",
                                "code": "Space",
                                "keyCode": 32
                            }
                        },
                        "gridArea": {
                            "landscape": "28 / 43 / span 8 / span 8",
                            "portrait": "38 / 32 / span 5 / span 19"
                        },
                        "label": "TILT<br/>PLUNGER"
                    },
                    {
                        "component": "SingleTouchButton",
                        "binding": {
                            "type": "keyboard",
                            "key": {
                                "key": "Space",
                                "code": "Space",
                                "keyCode": 32
                            }
                        },
                        "gridArea": {
                            "landscape": "28 / 1 / span 8 / span 8",
                            "portrait": "38 / 1 / span 5 / span 19"
                        },
                        "label": "TILT<br/>PLUNGER"
                    },
                    {
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
                            "landscape": "3 / 5 / span 4 / span 4",
                            "portrait": "26 / 11 / span 2 / span 9"
                        },
                        "label": "Y"
                    },
                    {
                        "component": "SingleTouchButton",
                        "binding": {
                            "type": "keyboard",
                            "key": {
                                "key": "n",
                                "code": "KeyN",
                                "keyCode": 78
                            }
                        },
                        "gridArea": {
                            "landscape": "8 / 5 / span 4 / span 4",
                            "portrait": "29 / 11 / span 2 / span 9"
                        },
                        "label": "N"
                    },
                    {
                        "component": "SingleTouchButton",
                        "binding": {
                            "type": "keyboard",
                            "key": {
                                "key": "ArrowUp",
                                "code": "ArrowUp",
                                "keyCode": 38
                            }
                        },
                        "gridArea": {
                            "landscape": "13 / 5 / span 4 / span 4",
                            "portrait": "32 / 11 / span 2 / span 9"
                        },
                        "label": "▲"
                    },
                    {
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
                            "landscape": "18 / 5 / span 4 / span 4",
                            "portrait": "35 / 11 / span 2 / span 9"
                        },
                        "label": "▼"
                    }
                ]
            },
            {
                "id": "preset-worms",
                "name": "Worms",
                "description": "Worms, Worms+, Worms United, Worms Reinforcements",
                "gameFocus": true,
                "hideAdditionalButtons": true,
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
                            "landscape": "32 / 1 / span 19 / span 11",
                            "portrait": "38 / 1 / span 13 / span 14"
                        },
                        "label": "worms-mv",
                        "options": {
                            "label": "MOVE/AIM",
                            "style": "outline",
                            "mode": "keyboard",
                            "keys": {
                                "up": {
                                    "key": "ArrowUp",
                                    "code": "ArrowUp",
                                    "keyCode": "38"
                                },
                                "down": {
                                    "key": "ArrowDown",
                                    "code": "ArrowDown",
                                    "keyCode": "88"

                                },
                                "left": {
                                    "key": "ArrowLeft",
                                    "code": "ArrowLeft",
                                    "keyCode": "37"
                                },
                                "right": {
                                    "key": "ArrowRight",
                                    "code": "ArrowRight",
                                    "keyCode": "39"
                                }
                            }
                        }
                    },
                    {
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
                            "landscape": "41 / 40 / span 10 / span 11",
                            "portrait": "43 / 36 / span 8 / span 15"
                        },
                        "label": "JUMP"
                    },
                    {
                        "component": "SingleTouchButton",
                        "binding": {
                            "type": "keyboard",
                            "key": {
                                "key": "Escape",
                                "code": "Escape",
                                "keyCode": "27"
                            }
                        },
                        "gridArea": {
                            "landscape": "3 / 47 / span 4 / span 4",
                            "portrait": "26 / 42 / span 2 / span 9"
                        },
                        "label": "ESC"
                    },
                    {
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
                            "landscape": "8 / 43 / span 4 / span 4",
                            "portrait": "29 / 32 / span 2 / span 9"
                        },
                        "label": "PAUSE"
                    },
                    {
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
                        "component": "SingleTouchButton",
                        "binding": {
                            "type": "keyboard",
                            "key": {
                                "key": "m",
                                "code": "KeyM",
                                "keyCode": "77"
                            }
                        },
                        "gridArea": {
                            "landscape": "13 / 47 / span 4 / span 4",
                            "portrait": "32 / 42 / span 2 / span 9"
                        },
                        "label": "ZOOM"
                    },
                    {
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
                            "landscape": "32 / 40 / span 8 / span 11",
                            "portrait": "38 / 36 / span 4 / span 15"
                        },
                        "label": "FIRE"
                    },
                    {
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
                            "landscape": "28 / 3 / span 3 / span 2",
                            "portrait": "26 / 11 / span 2 / span 6"
                        },
                        "label": "F1"
                    },
                    {
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
                            "landscape": "28 / 1 / span 3 / span 2",
                            "portrait": "26 / 18 / span 2 / span 6"
                        },
                        "label": "F2"
                    },
                    {
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
                            "landscape": "28 / 5 / span 3 / span 2",
                            "portrait": "26 / 25 / span 2 / span 6"
                        },
                        "label": "F3"
                    },
                    {
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
                            "landscape": "28 / 7 / span 3 / span 2",
                            "portrait": "29 / 11 / span 2 / span 6"
                        },
                        "label": "F4"
                    },
                    {
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
                            "landscape": "28 / 9 / span 3 / span 2",
                            "portrait": "29 / 18 / span 2 / span 6"
                        },
                        "label": "F5"
                    },
                    {
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
                            "landscape": "28 / 11 / span 3 / span 2",
                            "portrait": "29 / 25 / span 2 / span 6"
                        },
                        "label": "F6"
                    },
                    {
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
                            "landscape": "28 / 39 / span 3 / span 2",
                            "portrait": "32 / 11 / span 2 / span 6"
                        },
                        "label": "F7"
                    },
                    {
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
                            "landscape": "28 / 41 / span 3 / span 2",
                            "portrait": "32 / 18 / span 2 / span 6"
                        },
                        "label": "F8"
                    },
                    {
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
                            "landscape": "28 / 43 / span 3 / span 2",
                            "portrait": "32 / 25 / span 2 / span 6"
                        },
                        "label": "F9"
                    },
                    {
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
                            "landscape": "28 / 45 / span 3 / span 2",
                            "portrait": "35 / 11 / span 2 / span 6"
                        },
                        "label": "F10"
                    },
                    {
                        "component": "SingleTouchButton",
                        "binding": {
                            "type": "keyboard",
                            "key": {
                                "key": "F11",
                                "code": "F11",
                                "keyCode": "122"
                            }
                        },
                        "gridArea": {
                            "landscape": "28 / 47 / span 3 / span 2",
                            "portrait": "35 / 18 / span 2 / span 6"
                        },
                        "label": "F11"
                    },
                    {
                        "component": "SingleTouchButton",
                        "binding": {
                            "type": "keyboard",
                            "key": {
                                "key": "F12",
                                "code": "F12",
                                "keyCode": "123"
                            }
                        },
                        "gridArea": {
                            "landscape": "28 / 49 / span 3 / span 2",
                            "portrait": "35 / 25 / span 2 / span 6"
                        },
                        "label": "F12"
                    },
                    {
                        "component": "SingleTouchButton",
                        "binding": {
                            "type": "mouse",
                            "button": 2
                        },
                        "gridArea": {
                            "landscape": "18 / 5 / span 4 / span 4",
                            "portrait": "35 / 32 / span 2 / span 9"
                        },
                        "label": "ARMS"
                    },
                    {
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
            },
            {
                "id": "dos-qj-stunts",
                "name": "Stunts",
                "description": "4D Sports: Driving",
                "gameFocus": true,
                "hideAdditionalButtons": true,
                "defaultLayoutId": "layout-1",
                "currentLayoutId": "layout-1",
                "layouts": [
                ],
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
                        "component": "DualTouchButton",
                        "binding": {
                            "type": "keyboard",
                            "primary": {
                                "key": "ArrowLeft",
                                "code": "ArrowLeft",
                                "keyCode": "37"
                            },
                            "secondary": {
                                "key": "ArrowRight",
                                "code": "ArrowRight",
                                "keyCode": "39"
                            }
                        },
                        "gridArea": {
                            "landscape": "39 / 1 / span 14 / span 16",
                            "portrait": "45 / 1 / span 6 / span 18"
                        },
                        "labels": [
                            "LEFT",
                            "RIGHT"
                        ],
                        "options": {
                            "isHorizontal": true
                        }
                    },
                    {
                        "component": "DualTouchButton",
                        "binding": {
                            "type": "keyboard",
                            "primary": {
                                "key": "ArrowUp",
                                "code": "ArrowUp",
                                "keyCode": "38"
                            },
                            "secondary": {
                                "key": "ArrowDown",
                                "code": "ArrowDown",
                                "keyCode": "40"
                            }
                        },
                        "gridArea": {
                            "landscape": "27 / 43 / span 24 / span 8",
                            "portrait": "39 / 40 / span 12 / span 11"
                        },
                        "labels": [
                            "ACC",
                            "BRAKE"
                        ],
                        "options": {
                            "isHorizontal": false
                        }
                    },
                    {
                        "component": "SingleTouchButton",
                        "binding": {
                            "type": "keyboard",
                            "key": {
                                "key": "Enter",
                                "code": "Enter",
                                "keyCode": 13
                            }
                        },
                        "gridArea": {
                            "landscape": "27 / 35 / span 24 / span 8",
                            "portrait": "39 / 29 / span 12 / span 11"
                        },
                        "label": "ENTER"
                    },
                    {
                        "component": "SingleTouchButton",
                        "binding": {
                            "type": "keyboard",
                            "key": {
                                "key": "Escape",
                                "code": "Escape",
                                "keyCode": "27"
                            }
                        },
                        "gridArea": {
                            "landscape": "3 / 47 / span 4 / span 4",
                            "portrait": "26 / 42 / span 2 / span 9"
                        },
                        "label": "ESC"
                    },
                    {
                        "component": "SingleTouchButton",
                        "binding": {
                            "type": "keyboard",
                            "key": {
                                "key": "c",
                                "code": "KeyC",
                                "keyCode": "67"
                            }
                        },
                        "gridArea": {
                            "landscape": "8 / 47 / span 4 / span 4",
                            "portrait": "29 / 42 / span 2 / span 9"
                        },
                        "label": "CAM"
                    },
                    {
                        "component": "SingleTouchButton",
                        "binding": {
                            "type": "keyboard",
                            "key": {
                                "key": "d",
                                "code": "KeyD",
                                "keyCode": "68"
                            }
                        },
                        "gridArea": {
                            "landscape": "13 / 47 / span 4 / span 4",
                            "portrait": "32 / 42 / span 2 / span 9"
                        },
                        "label": "DASH"
                    }
                ]
            }
        ]
    },
    default_touch_controller: JOYSTICK_TOUCH_MODE.QUICKSHOT_KEYBOARD,
    disable_touch_input: false,
    fire_buttons: 1,
    keyboard: {
        shiftKey: 2,
        touch_caps_toggle: true,
        mode_labels: {
            retropad: 'Focus mode disabled',
            focusmode: 'Focus mode enabled'
        },
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
            "label": "F1",
            "key": {
                "key": 'F1',
                "code": 'F1'
            }
        },
        2: {
            "label": "ENTER",
            "key": {
                "key": 'Enter',
                "code": 'Enter'
            }
        },
        3: {
            "label": "ESC",
            "key": {
                "key": 'Escape',
                "code": 'Escape'
            }
        }
    },
    message: ["PC emulation is work-in-progress."]
};

export default DOS;
