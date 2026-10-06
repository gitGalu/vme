import PlatformBase from '../PlatformBase.js';
import { JOYSTICK_TOUCH_MODE } from '../../Constants.js';

const APPLE2_MACHINE_OPTIONS = Object.freeze([
    { value: 'Apple //e (enhanced)', label: 'Apple //e (enhanced)' },
    { value: 'Apple II (original)', label: 'Apple II' },
    { value: 'Apple II Plus', label: 'Apple II Plus' }
]);

const APPLE2_VIDEO_MODE_OPTIONS = Object.freeze([
    { value: 'Color (RGB Card/Monitor)', label: 'Color (RGB card/monitor)' },
    { value: 'Color (Composite Idealized)', label: 'Color (composite idealized)' },
    { value: 'Color (Composite Monitor)', label: 'Color (composite monitor)' },
    { value: 'Color TV', label: 'Color TV' },
    { value: 'B&W TV', label: 'B&W TV' },
    { value: 'Monochrome (Amber)', label: 'Monochrome (amber)' },
    { value: 'Monochrome (Green)', label: 'Monochrome (green)' },
    { value: 'Monochrome (White)', label: 'Monochrome (white)' }
]);

const APPLE2_REFRESH_OPTIONS = Object.freeze([
    { value: '60Hz', label: '60 Hz' },
    { value: '50Hz', label: '50 Hz' }
]);

const APPLE2_SOUND_CARD_OPTIONS = Object.freeze([
    { value: 'Mockingboard C', label: 'Mockingboard C' },
    { value: 'Phasor', label: 'Phasor' },
    { value: 'Empty', label: 'None (speaker only)' }
]);

const APPLE2_SLOT5_OPTIONS = Object.freeze([
    { value: 'Empty', label: 'None' },
    { value: 'Mockingboard C', label: 'Mockingboard C' },
    { value: 'Phasor', label: 'Phasor' },
    { value: 'SAM', label: 'SAM speech card' },
    { value: 'Z80 SoftCard', label: 'Z80 SoftCard (CP/M)' }
]);

const APPLE2_VIDEO_CARD_OPTIONS = Object.freeze([
    { value: 'Empty', label: 'None' },
    { value: 'Video HD', label: 'VidHD (Super Hi-Res)' }
]);

const APPLE2_DEFAULTS = Object.freeze({
    machine: APPLE2_MACHINE_OPTIONS[0].value,
    video_mode: APPLE2_VIDEO_MODE_OPTIONS[0].value,
    refresh: APPLE2_REFRESH_OPTIONS[0].value,
    sound_card: APPLE2_SOUND_CARD_OPTIONS[0].value,
    slot5: APPLE2_SLOT5_OPTIONS[0].value,
    video_card: APPLE2_VIDEO_CARD_OPTIONS[0].value
});

function selectedOption(options, value, fallback) {
    return options.some(option => option.value === value) ? value : fallback;
}

function buildApple2LaunchSettings(overrides = null) {
    const selected = overrides && typeof overrides === 'object' ? overrides : {};
    const machine = selectedOption(APPLE2_MACHINE_OPTIONS, selected.machine, APPLE2_DEFAULTS.machine);
    const video_mode = selectedOption(APPLE2_VIDEO_MODE_OPTIONS, selected.video_mode, APPLE2_DEFAULTS.video_mode);
    const refresh = selectedOption(APPLE2_REFRESH_OPTIONS, selected.refresh, APPLE2_DEFAULTS.refresh);
    const sound_card = selectedOption(APPLE2_SOUND_CARD_OPTIONS, selected.sound_card, APPLE2_DEFAULTS.sound_card);
    const slot5 = selectedOption(APPLE2_SLOT5_OPTIONS, selected.slot5, APPLE2_DEFAULTS.slot5);
    const video_card = selectedOption(APPLE2_VIDEO_CARD_OPTIONS, selected.video_card, APPLE2_DEFAULTS.video_card);

    return {
        coreConfig: {
            applewin_machine: machine,
            applewin_video_mode: video_mode,
            applewin_video_refresh_rate: refresh,
            applewin_slot4: sound_card,
            applewin_slot5: slot5,
            applewin_slot3: video_card
        },
        overrideValues: { machine, video_mode, refresh, sound_card, slot5, video_card },
        guessedOverrides: { ...APPLE2_DEFAULTS },
        overrideSchema: [
            { id: 'machine', label: 'Machine', options: APPLE2_MACHINE_OPTIONS },
            { id: 'video_mode', label: 'Video mode', options: APPLE2_VIDEO_MODE_OPTIONS },
            { id: 'refresh', label: 'Refresh', options: APPLE2_REFRESH_OPTIONS },
            { id: 'sound_card', label: 'Sound card (slot 4)', options: APPLE2_SOUND_CARD_OPTIONS },
            { id: 'slot5', label: 'Additional card (slot 5)', options: APPLE2_SLOT5_OPTIONS },
            { id: 'video_card', label: 'Video card (slot 3)', options: APPLE2_VIDEO_CARD_OPTIONS }
        ]
    };
}

const Apple2 = {
    ...PlatformBase,
    platform_id: 'apple2',
    core: 'applewin',
    multidisk: true,
    platform_name: 'Apple II',
    short_name: 'Apple II',
    libretro_thumbnails_system: 'Apple - II',
    theme: {
        '--color0': '#101810',
        '--color1': '#80ff80',
        '--color2': '#4acb4a',
        '--color3': '#c5ffc5',
        '--font': 'Apple2',
        '--cursorwidth': '0.5em'
    },
    force_scale: true,
    video_smooth: false,
    shader: ['assets/shaders/crt/crt-geom.glslp', 'assets/shaders/crt/shaders/crt-geom.glsl'],
    resolveLaunchSettings: (_fileName, overrides = null) => buildApple2LaunchSettings(overrides),
    guessConfig: () => buildApple2LaunchSettings().coreConfig,
    keyboard_controller_info: {
        'Arrow Keys': 'Joystick directions',
        'X': 'Joystick button 0',
        'Z': 'Joystick button 1'
    },
    touch_controllers: [
        JOYSTICK_TOUCH_MODE.QUICKSHOT_DYNAMIC,
        JOYSTICK_TOUCH_MODE.HIDEAWAY
    ],
    default_touch_controller: JOYSTICK_TOUCH_MODE.QUICKSHOT_DYNAMIC,
    fire_buttons: 2,
    additional_buttons: {}
};

export default Apple2;
