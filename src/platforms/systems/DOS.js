
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
                        "id": "lr",
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
                        "id": "ud",
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
                        "id": "space",
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
                        "id": "lr",
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
                        "id": "ud",
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
                        "id": "shift",
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
                        "id": "pinball-left-shift",
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
                        "id": "pinball-up",
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
                        "id": "pinball-ok",
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
                        "id": "pinball-down",
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
                        "id": "pinball-right-shift",
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
                        "id": "pinball-plunger",
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
                        "id": "pinball-tilt",
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
                        "id": "pinball-left-shift",
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
                        "id": "pinball-right-shift",
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
                        "id": "pinball-plunger",
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
                        "id": "pinball-tilt",
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
                        "id": "pinball-y",
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
                        "id": "pinball-n",
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
                        "id": "pinball-up",
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
                        "id": "pinball-down",
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
            }
        ]
    },
    default_touch_controller: JOYSTICK_TOUCH_MODE.QUICKSHOT_KEYBOARD,
    disable_touch_input: false,
    fire_buttons: 1,
    keyboard: {
        shiftKey: 2,
        mode_labels: {
            retropad: 'Focus mode disabled',
            focusmode: 'Focus mode enabled'
        },
        overrides: {
        }
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
