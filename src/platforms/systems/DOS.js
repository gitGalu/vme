
import JSZip from 'jszip';
import PlatformBase from '../PlatformBase.js';
import { JOYSTICK_TOUCH_MODE, MOUSE_TOUCH_MODE, TOUCH_INPUT } from '../../Constants.js';
import { KeyMaps } from '../../touch/KeyMaps.js';

// dosbox_pure_memory_size
const DOS_MEMORY_OPTIONS = Object.freeze([
    { value: 'none', label: 'No extended memory' },
    { value: '4', label: '4 MB' },
    { value: '8', label: '8 MB' },
    { value: '16', label: '16 MB' },
    { value: '24', label: '24 MB' },
    { value: '32', label: '32 MB' },
    { value: '48', label: '48 MB' },
    { value: '64', label: '64 MB' },
    { value: '96', label: '96 MB' },
    { value: '128', label: '128 MB' },
    { value: '224', label: '224 MB' },
    { value: '256', label: '256 MB' }
]);

// CPU profile: a single choice that sets BOTH the instruction set
// (dosbox_pure_cpu_type) AND the emulated speed (dosbox_pure_cycles), so the
// user picks a period-accurate machine rather than juggling two options.
// 'auto' cycles effectively means MAX (dosbox switches to max cycles for
// protected-mode games), i.e. the fastest this WASM build can run — hence
// "Auto (fastest)". The other profiles SLOW the machine down to a period, which
// is the real use case (games without a frame limiter are unplayable when the
// CPU is "too fast").
const DOS_CPU_PROFILES = Object.freeze({
    auto:      { label: 'Auto (fastest)',   cpu_type: 'auto',     cycles: 'auto' },
    '386_20':  { label: '~386 20 MHz',      cpu_type: '386',      cycles: '4720' },
    '386_33':  { label: '~386DX 33 MHz',    cpu_type: '386',      cycles: '7800' },
    '486_66':  { label: '~486DX2 66 MHz',   cpu_type: '486_slow', cycles: '26800' }
});

const DOS_CPU_OPTIONS = Object.freeze(
    Object.entries(DOS_CPU_PROFILES).map(([value, p]) => ({ value, label: p.label }))
);

// dosbox_pure_machine
const DOS_MACHINE_OPTIONS = Object.freeze([
    { value: 'svga', label: 'SVGA' },
    { value: 'vga', label: 'VGA' },
    { value: 'ega', label: 'EGA' },
    { value: 'cga', label: 'CGA' },
    { value: 'tandy', label: 'Tandy' },
    { value: 'hercules', label: 'Hercules' },
    { value: 'pcjr', label: 'PCjr' }
]);

// 3dfx Voodoo (dosbox_pure_voodoo). Only on/off is exposed; the card RAM is
// pinned to 8mb (core default, widest game compatibility) and rendering to
// perf=0 (software single-threaded). The multi-threaded renderer spawns
// cores-1 detached threads which hang against emscripten's fixed pthread pool.
const DOS_VOODOO_OPTIONS = Object.freeze([
    { value: 'off', label: 'Off' },
    { value: 'on', label: 'On (3dfx)' }
]);

const DOS_MEMORY_VALUES = new Set(DOS_MEMORY_OPTIONS.map(option => option.value));
const DOS_CPU_VALUES = new Set(DOS_CPU_OPTIONS.map(option => option.value));
const DOS_MACHINE_VALUES = new Set(DOS_MACHINE_OPTIONS.map(option => option.value));
const DOS_VOODOO_VALUES = new Set(DOS_VOODOO_OPTIONS.map(option => option.value));

function normalizeDosMemory(value, fallback = '16') {
    if (typeof value !== 'string') {
        return fallback;
    }
    const normalized = value.trim().toLowerCase();
    return DOS_MEMORY_VALUES.has(normalized) ? normalized : fallback;
}

function normalizeDosCpu(value, fallback = 'auto') {
    if (typeof value !== 'string') {
        return fallback;
    }
    const normalized = value.trim().toLowerCase();
    return DOS_CPU_VALUES.has(normalized) ? normalized : fallback;
}

function normalizeDosMachine(value, fallback = 'svga') {
    if (typeof value !== 'string') {
        return fallback;
    }
    const normalized = value.trim().toLowerCase();
    return DOS_MACHINE_VALUES.has(normalized) ? normalized : fallback;
}

function normalizeDosVoodoo(value, fallback = 'off') {
    if (typeof value !== 'string') {
        return fallback;
    }
    const normalized = value.trim().toLowerCase();
    return DOS_VOODOO_VALUES.has(normalized) ? normalized : fallback;
}

function buildDosLaunchSettings(fileName, overrides = null) {
    const guessedMemory = '16';
    const guessedCpu = 'auto';
    const guessedMachine = 'svga';
    const guessedVoodoo = 'off';
    const overrideInput = overrides && typeof overrides === 'object' ? overrides : {};
    const memory = normalizeDosMemory(overrideInput.memory, guessedMemory);
    const cpu = normalizeDosCpu(overrideInput.cpu, guessedCpu);
    const machine = normalizeDosMachine(overrideInput.machine, guessedMachine);
    const voodoo = normalizeDosVoodoo(overrideInput.voodoo, guessedVoodoo);
    // The CPU override is a profile key that maps to both an instruction set
    // and an emulated speed.
    const cpuProfile = DOS_CPU_PROFILES[cpu] || DOS_CPU_PROFILES.auto;

    const coreConfig = {
        dosbox_pure_memory_size: memory,
        dosbox_pure_cpu_type: cpuProfile.cpu_type,
        dosbox_pure_cycles: cpuProfile.cycles,
        dosbox_pure_machine: machine,
        // 3dfx Voodoo: only on/off is user-facing. When on, pin the card to 8mb
        // (core default, widest compatibility) and rendering to software
        // single-threaded (perf=0). The multi-threaded renderer spawns cores-1
        // detached threads which hang against emscripten's fixed pthread pool
        // (no exception, just a freeze), so it's not exposed here.
        dosbox_pure_voodoo: voodoo === 'on' ? '8mb' : 'off',
        dosbox_pure_voodoo_perf: '0',
        dosbox_pure_voodoo_scale: '1',
        dosbox_pure_savestate: 'load-save',
        video_gpu_screenshot: 'false'
    };

    return {
        coreConfig,
        overrideValues: { memory, cpu, machine, voodoo },
        guessedOverrides: {
            memory: guessedMemory,
            cpu: guessedCpu,
            machine: guessedMachine,
            voodoo: guessedVoodoo
        },
        overrideSchema: [
            {
                id: 'memory',
                label: 'Memory',
                options: DOS_MEMORY_OPTIONS
            },
            {
                id: 'cpu',
                label: 'CPU',
                options: DOS_CPU_OPTIONS
            },
            {
                id: 'machine',
                label: 'Graphics',
                options: DOS_MACHINE_OPTIONS
            },
            {
                id: 'voodoo',
                label: '3dfx',
                options: DOS_VOODOO_OPTIONS
            }
        ]
    };
}

// Auto-supply the 3dfx Glide driver (GLIDE2X.OVL) when Voodoo is on, WITHOUT
// repacking the user's game ZIP. Uses dosbox_pure's native ZIP dependency:
// a child ZIP containing an empty marker file "<parentname>.parent" makes the
// core mount <parentname> (found in the same dir) as the base C: drive and
// overlay the child's files on top. So we load a small child ZIP holding
// GLIDE2X.OVL + the marker; the game ZIP sits beside it as the parent, mounted
// as the base and left completely untouched. The child is what gets launched.
async function buildDosVoodooLaunchPackage(gameBlob, romName, execHint = null) {
    const glideUrl = new URL('../../assets/boot/glide.zip', import.meta.url);
    const glideArrayBuffer = await (await fetch(glideUrl)).arrayBuffer();

    // Fixed, special-char-free names so the content-dir names match the
    // ".parent" marker exactly. nostalgist launches rom[0], so the child
    // (glide) ZIP must be first.
    const gameName = 'VME3DFX.ZIP';
    const childName = 'VMEGLID3.ZIP';

    // Resolve the exe to auto-start ONLY when we have an explicit execHint (a
    // save's LASTRUN.DBP). We deliberately do NOT guess an exe on a first
    // launch: like the non-3dfx path, a first launch should show dosbox's start
    // menu so the user picks the program (guessing picks a random EXE — the
    // installer, a Windows variant, a tool). The hint is only available on
    // restore, which is exactly when we want to auto-relaunch the same exe.
    //
    // Use the hint's path VERBATIM — it is the exact path dosbox ran the exe
    // from (including any subdirectory, e.g. TRIP\TRIP.EXE). Do NOT look it up
    // by basename in the game ZIP: that drops the directory and would cd to the
    // wrong place (running TRIP.EXE from C:\ instead of C:\TRIP).
    let gameExe = null;
    if (execHint) {
        const dosPath = String(execHint)
            .replace(/\//g, '\\')       // to DOS separators
            .replace(/^[A-Za-z]:\\/, '') // strip any drive prefix
            .replace(/^\\+/, '')         // strip leading backslashes
            .trim();
        if (/\.(exe|com|bat)$/i.test(dosPath)) {
            gameExe = dosPath;
        }
    }

    // DOSBOX.BAT: dosbox_pure runs C:\DOSBOX.BAT (if present) instead of its
    // default launcher. PATH C:\ lets a game exe in a subdirectory find
    // GLIDE2X.OVL in the root.
    //   - Restore (have exe): cd into the exe's dir and run it, so the game
    //     boots straight to where the save expects it.
    //   - First launch (no exe): hand off to the start menu (Z:PUREMENU -BOOT)
    //     so the user picks the program, exactly like non-3dfx.
    let dosboxBat;
    if (gameExe) {
        const slash = gameExe.lastIndexOf('\\');
        const exeDir = slash >= 0 ? gameExe.slice(0, slash) : '';
        const exeFile = slash >= 0 ? gameExe.slice(slash + 1) : gameExe;
        // No quotes around the cd argument: DOS/dosbox .BAT treats "trip" as a
        // literal name including the quotes, so cd fails and the exe runs from
        // C:\ root. DOS dir names have no spaces (8.3), so bare is correct.
        dosboxBat = '@echo off\r\nPATH C:\\;%PATH%\r\n'
            + (exeDir ? `cd ${exeDir}\r\n` : '')
            + `${exeFile}\r\n`;
    } else {
        dosboxBat = '@echo off\r\nPATH C:\\;%PATH%\r\nZ:PUREMENU -BOOT\r\n';
    }

    // Build the child ZIP: GLIDE2X.OVL (driver, C:\ root), DOSBOX.BAT (above),
    // and an empty "<game>.parent" marker so the core mounts the game ZIP
    // underneath as the C: base.
    const glideZip = await JSZip.loadAsync(glideArrayBuffer);
    const ovl = await glideZip.file(/glide2x\.ovl/i)[0].async('uint8array');
    const childZip = new JSZip();
    childZip.file('GLIDE2X.OVL', ovl);
    childZip.file('DOSBOX.BAT', dosboxBat);
    childZip.file(`${gameName}.parent`, new Uint8Array(0));
    const childBlob = await childZip.generateAsync({ type: 'blob' });

    return {
        launchFiles: [
            { fileName: childName, fileContent: childBlob },
            { fileName: gameName, fileContent: gameBlob }
        ],
        // primaryFileName = the file nostalgist actually launches (the child).
        // But game IDENTITY (save states / game profiles: programName, romHash,
        // archiveHash) must be derived from the GAME, not the child. The child
        // glide ZIP is identical for every 3dfx title, so using it would collide
        // all 3dfx games onto one profile and load the wrong save/menu. Set
        // saveBlob to the game blob and programName to the original game name.
        primaryFileName: childName,
        saveBlob: gameBlob,
        programName: romName,
        suppressDiskUi: true
    };
}

const DOS = {
    ...PlatformBase,
    platform_id: 'dos',
    core: 'dosbox_pure',
    uses_pthreads: true,
    platform_name: 'DOS PC (Pentium + SB + SVGA)',
    short_name: 'DOS',
    libretro_thumbnails_system: 'DOS',
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
    resolveLaunchSettings: (fileName, overrides = null) => buildDosLaunchSettings(fileName, overrides),
    guessConfig: (fileName) => buildDosLaunchSettings(fileName).coreConfig,
    prepareLaunchRom: async ({ launchRomInput, romName, launchSettings }) => {
        // Only when 3dfx is enabled AND the content is a plain ZIP blob we can
        // overlay. Anything else (already a multi-file package, non-Blob) is
        // passed through untouched.
        const voodoo = normalizeDosVoodoo(launchSettings?.overrideValues?.voodoo, 'off');
        if (voodoo !== 'on' || !(launchRomInput instanceof Blob)) {
            return launchRomInput;
        }
        if (!String(romName || '').toLowerCase().endsWith('.zip')) {
            return launchRomInput;
        }
        // execHint (from a save's LASTRUN.DBP) lets us auto-start the exact game
        // exe on restore; absent at first launch (we auto-detect it instead).
        const execHint = launchSettings?.dosExecHint || null;
        return buildDosVoodooLaunchPackage(launchRomInput, romName, execHint);
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
            },
            // {
            //     "id": "dos-qj-pop2",
            //     "name": "Prince of Persia 2",
            //     "description": "The Shadow and the Flame",
            //     "gameFocus": true,
            //     "defaultLayoutId": "layout-1",
            //     "currentLayoutId": "layout-1",
            //     "layouts": [
            //     ],
            //     "layout": {
            //         "landscape": {
            //             "columns": 50,
            //             "rows": 50
            //         },
            //         "portrait": {
            //             "columns": 50,
            //             "rows": 50
            //         }
            //     },
            //     "elements": [
            //         {
            //             "component": "DualTouchButton",
            //             "binding": {
            //                 "type": "keyboard",
            //                 "primary": {
            //                     "key": "ArrowLeft",
            //                     "code": "ArrowLeft",
            //                     "keyCode": "37"
            //                 },
            //                 "secondary": {
            //                     "key": "ArrowRight",
            //                     "code": "ArrowRight",
            //                     "keyCode": "39"
            //                 }
            //             },
            //             "gridArea": {
            //                 "landscape": "39 / 1 / span 14 / span 16",
            //                 "portrait": "45 / 1 / span 6 / span 18"
            //             },
            //             "labels": [
            //                 "LEFT",
            //                 "RIGHT"
            //             ],
            //             "options": {
            //                 "isHorizontal": true
            //             }
            //         },
            //         {
            //             "component": "DualTouchButton",
            //             "binding": {
            //                 "type": "keyboard",
            //                 "primary": {
            //                     "key": "ArrowUp",
            //                     "code": "ArrowUp",
            //                     "keyCode": "38"
            //                 },
            //                 "secondary": {
            //                     "key": "ArrowDown",
            //                     "code": "ArrowDown",
            //                     "keyCode": "40"
            //                 }
            //             },
            //             "gridArea": {
            //                 "landscape": "27 / 43 / span 24 / span 8",
            //                 "portrait": "39 / 40 / span 12 / span 11"
            //             },
            //             "labels": [
            //                 "JUMP",
            //                 "DOWN"
            //             ],
            //             "options": {
            //                 "isHorizontal": false
            //             }
            //         },
            //         {
            //             "component": "DualTouchButton",
            //             "binding": {
            //                 "type": "keyboard",
            //                 "primary": {
            //                     "key": "Control",
            //                     "code": "ControlLeft",
            //                     "keyCode": "17"
            //                 },
            //                 "secondary": {
            //                     "key": "Shift",
            //                     "code": "ShiftLeft",
            //                     "keyCode": "16"
            //                 }
            //             },
            //             "gridArea": {
            //                 "landscape": "27 / 35 / span 24 / span 8",
            //                 "portrait": "39 / 29 / span 12 / span 11"
            //             },
            //             "labels": [
            //                 "SWORD",
            //                 "ACTION"
            //             ],
            //             "options": {
            //                 "isHorizontal": false
            //             }
            //         }
            //     ]
            // }
            {
                "id": "dos-qj-pop2",
                "name": "Prince of Persia 2",
                "description": "The Shadow and the Flame",
                "gameFocus": true,
                "defaultLayoutId": "layout-1",
                "currentLayoutId": "layout-1",
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
                                "key": "Control",
                                "code": "ControlLeft",
                                "keyCode": "17"
                            },
                            "secondary": {
                                "key": "Shift",
                                "code": "ShiftLeft",
                                "keyCode": "16"
                            }
                        },
                        "gridArea": {
                            "landscape": "26 / 35 / span 25 / span 16",
                            "portrait": "39 / 31 / span 12 / span 20"
                        },
                        "labels": [
                            "SWORD",
                            "ACTION"
                        ],
                        "options": {
                            "isHorizontal": true
                        }
                    },
                    {
                        "component": "QuickshotComponent",
                        "binding": {
                            "type": "keyboard",
                            "primary": {
                                "key": "Control",
                                "code": "ControlLeft",
                                "keyCode": "17"
                            },
                            "secondary": {
                                "key": "Shift",
                                "code": "ShiftLeft",
                                "keyCode": "16"
                            }
                        },
                        "gridArea": {
                            "landscape": "26 / 1 / span 25 / span 34",
                            "portrait": "39 / 1 / span 12 / span 30"
                        },
                        "options": {
                            "label": " ",
                            "mode": "keyboard"
                        }
                    }
                ]
            }
        ]
    },
    game_profiles: [
        {
            id: 'dos-worms',
            match: {
                execHash: '7ad8cf06463c6a19b5fefa627b2711d42e53694ac32e6ffa3cd3a110ca0519d4'
            },
            touch: {
                inputMethod: TOUCH_INPUT.CUSTOM,
                customPresetId: 'preset-worms'
            }
        },
        {
            id: 'dos-stunts',
            match: {
                execHash: [
                    '15d4200c06459e263e2734d5715b067fa95a5bdaa3bab603582c728d6b12cb28',
                    '83363c040b465c94ea1d84dae9bbdba10831f1b992e378123eac6f90692bb7c5'
                ]
            },
            touch: {
                inputMethod: TOUCH_INPUT.CUSTOM,
                customPresetId: 'dos-qj-stunts'
            }
        },
        {
            id: 'dos-qj-shift',
            match: {
                execHash: [
                    'b648ce9a783f7de00ce2a61979ed096ba272f3ffe860ab5a24ebc5af62c33e76',
                    '2f7ce29565d7912a0c7d06ec6b74df7dfe907ca5c0fbef824c1ba86455f24d60',
                    'bee42771e080ca2786313fd1ca3d07076157b357ea92695300792f57636ab478',
                    'c9091214d40197bb14ca67cb1410bee43874649007e67344b8e3e67ca4fa9f0f',
                    'bd1716a2ff83dcfd68995a481214ac61a81a98a954acd0ed2d76b372e54fcaa5'
                ]
            },
            touch: {
                inputMethod: TOUCH_INPUT.CUSTOM,
                customPresetId: 'dos-qj-shift'
            }
        },
        {
            id: 'dos-qj-space',
            match: {
                execHash: [
                    '7a6fc1113498a45f3af96bc3e6fa68bfd3205c1b6575927e4194683c2d8a3cbb',
                    '10e937e87c48f12e220862b140b7a501c809854ad5de0cb473a0fc58add54e5c',
                    'cc904eb16f517aa01560b5df955a8eaa1bd90c5ecae3886f17c504d5e4888059',
                    'a6a7526911e5ba75dc82270578256dcb59f3b39392ef820df3df8e49b02f84c7',
                    '3779a52c1a5ccd4f8ad879af24df93e46a431a25beaf55d2691e6bd84abbfadd'
                ]
            },
            touch: {
                inputMethod: TOUCH_INPUT.CUSTOM,
                customPresetId: 'dos-qj-space'
            }
        },
        {
            id: 'dos-pinball-tristan',
            match: {
                execHash: [
                    'eadce78787496dd9d1da1642a87f83c8275795aba2472977732b7c4f859cf42a',
                    'b7a1fb0e6c8f775eedc5ad01b1b6de058753aeac4ad09b8fb764293e68ac52ce',
                    'bb99ec8d17a7bf841c43293609b3907e7268accc347192091cd345623375d130'
                ]
            },
            touch: {
                inputMethod: TOUCH_INPUT.CUSTOM,
                customPresetId: 'dos-pinball-tristan'
            }
        },
        {
            id: 'dos-pinball-epic',
            match: {
                execHash: [
                    'b7751c099d6adae76ab55d306a0550bf664b98ebfbae980782847de857c872da',
                    '4f3c1b051de9dfc99b5b0ccf99aeac7dff5c9dd6dfbf9f8a69a6165adf1c3982',
                    'b53155c6a123e4adb57db6f4cd47a8d68a81e6061f77c79c27b2b4789a842c56',
                    '6c7d7c288da0e80fd2c1c0f0ffac78435018fbd31713e7564caad7c980db4605'
                ]
            },
            touch: {
                inputMethod: TOUCH_INPUT.CUSTOM,
                customPresetId: 'dos-pinball-epic'
            }
        },
        {
            id: 'dos-qj-pop2',
            match: {
                execHash: '2a4268b4c42dd808947edcc4e4fe9646ef33f1bfb4e5361b6267fadbaf112dbd'
            },
            touch: {
                inputMethod: TOUCH_INPUT.CUSTOM,
                customPresetId: 'dos-qj-pop2'
            }
        }
    ],
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
    }
};

export default DOS;
