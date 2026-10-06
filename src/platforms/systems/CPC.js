import PlatformBase from '../PlatformBase.js';
import { JOYSTICK_TOUCH_MODE } from '../../Constants.js';

const CPC_MODEL_OPTIONS = Object.freeze([
    { value: '6128', label: 'CPC 6128' },
    { value: '464', label: 'CPC 464 (tape)' },
    { value: '664', label: 'CPC 664' },
    { value: '6128+ (experimental)', label: 'CPC 6128+ (experimental)' }
]);

const CPC_RAM_OPTIONS = Object.freeze([
    { value: '64', label: '64 KB (464/664)' },
    { value: '128', label: '128 KB' },
    { value: '192', label: '192 KB' },
    { value: '576', label: '576 KB' }
]);

const CPC_MONITOR_OPTIONS = Object.freeze([
    { value: 'color', label: 'Color CRT' },
    { value: 'green', label: 'Green CRT' },
    { value: 'white', label: 'White CRT' }
]);

const CPC_AUTOBOOT_OPTIONS = Object.freeze([
    { value: 'enabled', label: 'Automatic' },
    { value: 'disabled', label: 'Manual' }
]);

const CPC_MODEL_VALUES = new Set(CPC_MODEL_OPTIONS.map(option => option.value));
const CPC_RAM_VALUES = new Set(CPC_RAM_OPTIONS.map(option => option.value));

function guessCpcLaunchOverrides(fileName) {
    const name = String(fileName || '');
    const isTape = /\.(?:cdt|tap)(?:\.zip)?$/i.test(name) || /\[(?:tape|cdt)\]/i.test(name);
    let model = '6128';
    let ram = '128';

    if (/\[664\]/i.test(name)) model = '664';
    if (/basic 1\.0/i.test(name)) model = isTape ? '464' : '664';

    if (/\[576k\]/i.test(name)) ram = '576';
    if (/\[128k\]/i.test(name)) ram = '128';
    if (/\[064k\]/i.test(name)) ram = '64';

    return { model, ram, monitor: 'color', autoboot: 'enabled' };
}

function buildCpcLaunchSettings(fileName, overrides = null) {
    const guessedOverrides = guessCpcLaunchOverrides(fileName);
    const overrideInput = overrides && typeof overrides === 'object' ? overrides : {};
    const name = String(fileName || '');
    const isDirectDisk = /\.dsk(?:\.zip)?$/i.test(name);
    const isTape = /\.(?:cdt|tap)(?:\.zip)?$/i.test(name) || /\[(?:tape|cdt)\]/i.test(name);
    const canAutobootDisk = !isTape && /\.(?:dsk|m3u|zip)$/i.test(name);
    const modelOptions = isDirectDisk
        ? CPC_MODEL_OPTIONS.filter(option => option.value !== '464')
        : CPC_MODEL_OPTIONS;
    const selectedModel = CPC_MODEL_VALUES.has(overrideInput.model) ? overrideInput.model : guessedOverrides.model;
    // Cap32 changes a directly loaded DSK from 464 to 664 at launch.
    const model = isDirectDisk && selectedModel === '464' ? '664' : selectedModel;
    const selectedRam = CPC_RAM_VALUES.has(overrideInput.ram) ? overrideInput.ram : guessedOverrides.ram;
    const monitor = CPC_MONITOR_OPTIONS.some(option => option.value === overrideInput.monitor)
        ? overrideInput.monitor
        : guessedOverrides.monitor;
    const autoboot = canAutobootDisk && CPC_AUTOBOOT_OPTIONS.some(option => option.value === overrideInput.autoboot)
        ? overrideInput.autoboot
        : guessedOverrides.autoboot;
    // Cap32 raises 6128/6128+ machines to 128 KB when 64 KB is requested.
    const ram = selectedRam === '64' && (model === '6128' || model === '6128+ (experimental)')
        ? '128'
        : selectedRam;
    if (guessedOverrides.ram === '64'
        && (guessedOverrides.model === '6128' || guessedOverrides.model === '6128+ (experimental)')) {
        guessedOverrides.ram = '128';
    }

    return {
        coreConfig: {
            cap32_model: model,
            cap32_ram: ram,
            cap32_scr_tube: monitor,
            cap32_autorun: autoboot,
            cap32_statusbar: 'disabled',
            cap32_floppy_sound: 'enabled',
            // VM/E applies the filename defaults above so Autoconfig choices can override them.
            cap32_filename_flags: 'disabled'
        },
        overrideValues: { model, ram, monitor, autoboot },
        guessedOverrides,
        overrideSchema: [
            { id: 'model', label: 'Model', options: modelOptions },
            { id: 'ram', label: 'RAM', options: CPC_RAM_OPTIONS },
            { id: 'monitor', label: 'Monitor', options: CPC_MONITOR_OPTIONS },
            ...(canAutobootDisk ? [{ id: 'autoboot', label: 'Disk autoboot', options: CPC_AUTOBOOT_OPTIONS }] : [])
        ]
    };
}

const CPC = {
    ...PlatformBase,
    platform_id: 'cpc',
    core: 'cap32',
    multidisk: true,
    platform_name: 'Amstrad CPC',
    short_name: 'CPC',
    libretro_thumbnails_system: 'Amstrad - CPC',
    theme: {
        '--color0': '#000060',
        '--color1': '#d6e121',
        '--color2': '#000000',
        '--color3': '#ea3323',
        '--font': 'AmstradCPC',
        '--cursorwidth': '1em'
    },
    resolveLaunchSettings: (fileName, overrides = null) => buildCpcLaunchSettings(fileName, overrides),
    guessConfig: (fileName) => buildCpcLaunchSettings(fileName).coreConfig,
    savestates_disabled: false,
    force_scale: true,
    shader: ['assets/shaders/crt/crt-geom.glslp', 'assets/shaders/crt/shaders/crt-geom.glsl'],
    keyboard_controller_info: {
        "Arrow Keys": "Joystick Directions",
        "Z": "Joystick Fire"
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
        JOYSTICK_TOUCH_MODE.HIDEAWAY
    ],
    touch_controller_mapping: {
        input_player1_up: 'F13',
        input_player1_left: 'F14', 
        input_player1_down: 'F15',
        input_player1_right: 'F11', 
        input_player1_b: 'b',
        input_player1_a: 'b'
    },
    fire_buttons: 1,
    jump_button_supported: true,
    keyboard: {
        shiftKey: 1,
        overrides: {
        }
    },
    touch_keyboard_reconfig: {
        keyMappings: {
            'keyQ': {
                value: 'a',
                code: 'KeyA'
            },
            'keyW': {
                value: 'z',
                code: 'KeyZ'
            },
            'keyA': {
                value: 'q',
                code: 'KeyQ'
            },
            'keyZ': {
                value: 'w',
                code: 'KeyW'
            },
            'keyM': {
                value: ';',
                code: 'Semicolon'
            },
            'key1': {
                value: '1',
                code: 'Digit1',
                shift: true
            },
            // 'key2': { 
            //     value: '2',
            //     code: 'Digit2',
            //     shift: true
            // },
            // 'key3': {
            //     value: '3',
            //     code: 'Digit3',
            //     shift: true
            // },
            'key4': {
                value: '4',
                code: 'Digit4',
                shift: true
            },
            'key5': {
                value: '5',
                code: 'Digit5',
                shift: true
            },
            // 'key6': {
            //     value: '6',
            //     code: 'Digit6',
            //     shift: true
            // },
            // 'key7': {
            //     value: '7',
            //     code: 'Digit7',
            //     shift: true
            // },
            'key8': {
                value: '8',
                code: 'Digit8',
                shift: true
            },
            'key9': {
                value: '9',
                code: 'Digit9',
                shift: true
            },
            'key0': {
                value: '0',
                code: 'Digit0',
                shift: true
            }
        },
    },
    additional_buttons: {
    }
};

export default CPC;
