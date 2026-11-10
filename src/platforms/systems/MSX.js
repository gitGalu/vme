import PlatformBase from '../PlatformBase.js';
import { JOYSTICK_TOUCH_MODE } from '../../Constants.js';
import systemFiles from '../msx-system.json';
import msxConfig from '../../assets/msx/Machines/MSX/config.ini?url';
import msx2Config from '../../assets/msx/Machines/MSX2/config.ini?url';
import msx2pConfig from '../../assets/msx/Machines/MSX2+/config.ini?url';
import turboConfig from '../../assets/msx/Machines/MSXturboR/config.ini?url';
import romDatabase from '../../assets/msx/Databases/msxromdb.xml?url';
import tapeDatabase from '../../assets/msx/Databases/msxcaswavdb.xml?url';
import systemDatabase from '../../assets/msx/Databases/msxsysromdb.xml?url';

const systemAssets = {
    'Machines/MSX/config.ini': msxConfig,
    'Machines/MSX2/config.ini': msx2Config,
    'Machines/MSX2+/config.ini': msx2pConfig,
    'Machines/MSXturboR/config.ini': turboConfig,
    'Databases/msxromdb.xml': romDatabase,
    'Databases/msxcaswavdb.xml': tapeDatabase,
    'Databases/msxsysromdb.xml': systemDatabase
};

const SYSTEM_DIR = '/home/web_user/retroarch/userdata/system';
const MACHINE_OPTIONS = [
    { value: 'MSX', label: 'MSX' },
    { value: 'MSX2', label: 'MSX2' },
    { value: 'MSX2+', label: 'MSX2+' },
    { value: 'MSXturboR', label: 'MSX turbo R' }
];
const REFRESH_OPTIONS = [
    { value: 'Auto', label: 'Automatic' },
    { value: '50Hz', label: '50 Hz (PAL)' },
    { value: '60Hz', label: '60 Hz (NTSC)' }
];
const INPUT_OPTIONS = [
    { value: 'joystick', label: 'Joystick' },
    { value: 'keyboard', label: 'Cursor keys / Space / Return' }
];

function buildLaunchSettings(fileName, overrides = null) {
    const name = String(fileName || '');
    const guessedMachine = /(?:turbo\s*r|msxtr)/i.test(name) ? 'MSXturboR'
        : /msx2\+|msx2p/i.test(name) ? 'MSX2+'
        : /\.mx1(?:\.zip)?$/i.test(name) || /\bmsx1\b/i.test(name) ? 'MSX'
        : /\.mx2(?:\.zip)?$/i.test(name) || /\bmsx2\b/i.test(name) ? 'MSX2'
        : 'MSX';
    const selected = overrides || {};
    const machine = MACHINE_OPTIONS.some(option => option.value === selected.machine) ? selected.machine : guessedMachine;
    const refresh = REFRESH_OPTIONS.some(option => option.value === selected.refresh) ? selected.refresh : 'Auto';
    const input = INPUT_OPTIONS.some(option => option.value === selected.input) ? selected.input : 'joystick';
    return {
        bios: [],
        coreConfig: {
            bluemsx_msxtype: machine,
            bluemsx_vdp_synctype: refresh,
            bluemsx_cartmapper: 'Auto',
            bluemsx_overscan: 'enabled',
            bluemsx_auto_rewind_cas: 'ON',
            bluemsx_ym2413_enable: 'enabled',
            bluemsx_nospritelimits: 'OFF',
            _vmeMsxInput: input
        },
        overrideValues: { machine, refresh, input },
        guessedOverrides: { machine: guessedMachine, refresh: 'Auto', input: 'joystick' },
        overrideSchema: [
            { id: 'machine', label: 'Machine', options: MACHINE_OPTIONS },
            { id: 'refresh', label: 'Refresh', options: REFRESH_OPTIONS },
            { id: 'input', label: 'Controls', options: INPUT_OPTIONS }
        ]
    };
}

const MSX = {
    ...PlatformBase,
    platform_id: 'msx',
    core: 'bluemsx',
    core_asset_version: 'e3086eb-vme1',
    multidisk: true,
    platform_name: 'MSX',
    short_name: 'MSX',
    libretro_thumbnails_system: 'Microsoft - MSX',
    theme: {
        '--color0': '#000080',
        '--color1': '#ffffff',
        '--color2': '#00c0c0',
        '--color3': '#ffff80',
        '--font': 'MSXWidth40, monospace',
        '--cursorwidth': '1ch'
    },
    dependencies: systemFiles.map(file => ({
        key: file.key,
        type: `MSX system ROM (${file.key})`,
        required: true,
        accepted: file.accepted
    })),
    startup_beforelaunch: async function (nostalgist, storageManager, coreConfig) {
        const FS = nostalgist.getEmscriptenFS();
        const machine = coreConfig?.bluemsx_msxtype || 'MSX';
        const roms = await Promise.all(systemFiles.map(async file => ({
            ...file, bytes: await storageManager.getFileBytes(`msx.${file.key}`)
        })));
        const missing = roms.filter(file => !file.bytes);
        if (missing.length) throw new Error(`Missing MSX system ROMs: ${missing.map(file => file.key).join(', ')}. Import them with OPEN.`);
        for (const [path, url] of Object.entries(systemAssets)) {
            if (path.startsWith('Machines/') && path !== `Machines/${machine}/config.ini`) continue;
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Failed to load blueMSX system file: ${path}`);
            const destination = `${SYSTEM_DIR}/${path}`;
            FS.mkdirTree(destination.slice(0, destination.lastIndexOf('/')));
            FS.writeFile(destination, new Uint8Array(await response.arrayBuffer()));
        }
        for (const file of roms) {
            if (!file.bytes) continue;
            const destination = `${SYSTEM_DIR}/${file.path}`;
            FS.mkdirTree(destination.slice(0, destination.lastIndexOf('/')));
            FS.writeFile(destination, file.bytes);
        }
        // Device selection belongs in RetroArch's config, not its core-options file.
        // This hook runs after Nostalgist writes the config and before RetroArch starts.
        const configPath = '/home/web_user/retroarch/userdata/retroarch.cfg';
        const config = FS.readFile(configPath, { encoding: 'utf8' });
        const device = coreConfig?._vmeMsxInput === 'keyboard' ? 257 : 1;
        FS.writeFile(configPath, config.replace(/^input_libretro_device_p1\s*=.*$/gm, '')
            + `\ninput_libretro_device_p1 = "${device}"\n`);
    },
    resolveLaunchSettings: (fileName, overrides = null) => buildLaunchSettings(fileName, overrides),
    guessConfig: fileName => buildLaunchSettings(fileName).coreConfig,
    // States made with the temporary minimal configuration disabled MSX-MUSIC.
    migrateSavedCoreConfig: config => ({ ...config, bluemsx_ym2413_enable: 'enabled' }),
    force_scale: true,
    video_smooth: false,
    shader: ['assets/shaders/crt/crt-geom.glslp', 'assets/shaders/crt/shaders/crt-geom.glsl'],
    keyboard_controller_info: {
        'Arrow Keys': 'Joystick directions (or cursor keys)',
        'X': 'Button 1 (Return in cursor mode)',
        'Z': 'Button 2 (Space in cursor mode)',
        'Right Shift': 'Core virtual keyboard'
    },
    keyboard_controller_mapping: {
        input_player1_a: 'x',
        input_player1_b: 'z',
        input_player1_start: 'nul',
        input_player1_select: 'rshift'
    },
    // Use keys absent from the MSX matrix so touch controls never type Z/X or cursors.
    touch_controller_mapping: {
        input_player1_up: 'f13',
        input_player1_left: 'f14',
        input_player1_down: 'f15',
        input_player1_right: 'numlock',
        input_player1_b: 'f6',
        input_player1_a: 'f7',
        input_player1_start: 'nul',
        input_player1_select: 'f8'
    },
    touch_controllers: [
        JOYSTICK_TOUCH_MODE.QUICKJOY_PRIMARY,
        JOYSTICK_TOUCH_MODE.QUICKSHOT_DYNAMIC,
        JOYSTICK_TOUCH_MODE.QUICKSHOT_STATIC,
        JOYSTICK_TOUCH_MODE.HIDEAWAY
    ],
    default_touch_controller: JOYSTICK_TOUCH_MODE.QUICKSHOT_DYNAMIC,
    fire_buttons: 2,
    keyboard: { shiftKey: 2, overrides: {} },
    additional_keyboard: {
        layerF: [
            { id: 'keyF14', value: 'F1', code: 'F1', label: 'F1' },
            { id: 'keyF15', value: 'F2', code: 'F2', label: 'F2' },
            { id: 'keyF16', value: 'F3', code: 'F3', label: 'F3' },
            { id: 'keyF24', value: 'F4', code: 'F4', label: 'F4' },
            { id: 'keyF25', value: 'F5', code: 'F5', label: 'F5' },
            { id: 'keyF34', value: 'End', code: 'End', label: 'STOP' },
            { id: 'keyF35', value: 'Home', code: 'Home', label: 'CLS' },
            { id: 'keyF36', value: 'PageUp', code: 'PageUp', label: 'SELECT' },
            { id: 'keyFL11', value: 'shift', code: 'ShiftLeft', label: 'SHIFT' },
            { id: 'keyFR11', value: 'Alt', code: 'AltLeft', label: 'GRAPH' }
        ]
    },
    additional_buttons: {
        1: { label: 'RETURN', key: { key: 'Enter', code: 'Enter' } },
        2: { label: 'SPACE', key: { key: ' ', code: 'Space' } },
        3: { label: 'F1', key: { key: 'F1', code: 'F1' } }
    }
};

export default MSX;
