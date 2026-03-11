import { Nostalgist } from 'nostalgist';
import NES from './systems/NES.js';
import GB from './systems/GB.js';
import GBC from './systems/GBC.js';
import SMS from './systems/SMS.js';
import C64 from './systems/C64.js';
import C128 from './systems/C128.js';
import C264 from './systems/C264.js';
import A2600 from './systems/A2600.js';
import A5200 from './systems/A5200.js';
import A7800 from './systems/A7800.js';
import A800 from './systems/A800.js';
import CPC from './systems/CPC.js';
import VIC20 from './systems/VIC20.js';
import ZX80 from './systems/ZX80.js';
import Spectrum from './systems/Spectrum.js';
import PCE from './systems/PCE.js';
import MD from './systems/MD.js';
import Lynx from './systems/Lynx.js';
import GBA from './systems/GBA.js';
import SNK from './systems/SNK.js';
import Amiga from './systems/Amiga.js';
import Coleco from './systems/Coleco.js';
import SNES from './systems/SNES.js';
import Intv from './systems/Intv.js';
import MAME from './systems/MAME.js';
import XT from './systems/XT.js';
import PICO8 from './systems/PICO8.js';
import DOS from './systems/DOS.js';
import ST from './systems/ST.js';
import JSZip from 'jszip';
import { s, hide } from '../dom.js';
import { MD5, lib } from 'crypto-js';
import { EnvironmentManager } from '../EnvironmentManager.js';
import { StorageManager } from '../storage/StorageManager.js';
import { Debug } from '../Debug.js';
import { FileUtils } from '../utils/FileUtils.js';
import { DiskSetBuilder } from '../utils/DiskSetBuilder.js';
import { ToastManager } from '../ui/ToastManager.js';
import GameFocusManager from '../keyboard/GameFocusManager.js';
import { JOYSTICK_TOUCH_MODE } from '../Constants.js';

export const SelectedPlatforms = {
    NES, GB, GBC, GBA, SNES, SMS, PCE, MD, C64, Amiga, C128, C264, A2600, A5200, A800, A7800, Lynx, Coleco, CPC, VIC20, ZX80, Spectrum, SNK, Intv, MAME, XT, PICO8, DOS, ST
}

export class PlatformManager {
    #selected_platform;
    #model;
    #storage_manager;
    #network_manager;
    #keyboard_manager;
    #active_theme;
    #nostalgist;
    #vme;
    #cli;
    #resolved_deps;
    #program_name;
    #caption;

    #state;
    #sram;
    #pending_dos_state;
    #pending_st_state;
    #pending_st_state_path;
    #current_rom;
    #current_m3u_disks;
    #current_m3u_disk_index;
    #current_m3u_disk_files;
    #original_get_gamepads;
    #gamepad_filter;
    #handleGamepadConnectionBound;

    static VME_CFG_CURRENT_PLATFORM = 'VME_CFG.CURRENT_PLATFORM';
    static SOFTWARE_DIR_KEY = '.software';
    static DOS_SIDECAR_QUICK_CAPTURE_MS = 1200;
    static DOS_SIDECAR_POLL_INTERVAL_MS = 200;
    static DOS_RESTORE_ATTEMPTS_WITH_SIDECAR = 6;
    static DOS_RESTORE_DELAY_WITH_SIDECAR_MS = 900;
    static DOS_RESTORE_ATTEMPTS_WITHOUT_SIDECAR = 36;
    static DOS_RESTORE_DELAY_WITHOUT_SIDECAR_MS = 1500;
    static ST_STATE_POLL_INTERVAL_MS = 150;
    static ST_STATE_CAPTURE_TIMEOUT_MS = 12000;
    static ST_STATE_ROOT = '/home/web_user/retroarch/userdata/states';
    static ST_RESTORE_ATTEMPTS = 8;
    static ST_RESTORE_DELAY_MS = 500;

    constructor(app, cli, storage_manager, network_manager, keyboard_manager) {
        this.#vme = app;
        this.#cli = cli;
        this.#storage_manager = storage_manager;
        this.#network_manager = network_manager;
        this.#keyboard_manager = keyboard_manager;
        this.#handleGamepadConnectionBound = this.#handleGamepadConnection.bind(this);
        let platform_id = localStorage.getItem(PlatformManager.VME_CFG_CURRENT_PLATFORM);
        this.#selected_platform = Object.values(SelectedPlatforms).find(platform => platform.platform_id === platform_id) || SelectedPlatforms.NES;
        this.updatePlatform();
        this.#cli.set_default_handler(() => { this.updatePlatform() });
        window.addEventListener('gamepadconnected', this.#handleGamepadConnectionBound);
        window.addEventListener('gamepaddisconnected', this.#handleGamepadConnectionBound);
    }

    #handleGamepadConnection() {
        if (!this.#selected_platform) return;
        const hasGamepad = EnvironmentManager.hasGamepad();
        const keyboardMode = this.#getKeyboardMode();
        if (hasGamepad && this.#selected_platform.gamepad_filter) {
            this.#applyGamepadFilter(this.#selected_platform.gamepad_filter);
        } else {
            this.#applyGamepadFilter(null);
        }
    }

    #getLibretroUrl(core, extension) {
        const filename = `${core}_libretro.${extension}`;
        return new URL(`./libretro/${filename}`, window.location.href).href;
    }

    #applyGamepadFilter(filter) {
        if (!navigator.getGamepads) return;

        if (!filter) {
            if (this.#original_get_gamepads) {
                navigator.getGamepads = this.#original_get_gamepads;
            }
            this.#gamepad_filter = null;
            return;
        }

        if (!this.#original_get_gamepads) {
            this.#original_get_gamepads = navigator.getGamepads.bind(navigator);
        }

        this.#gamepad_filter = filter;

        navigator.getGamepads = () => {
            const pads = this.#original_get_gamepads();
            if (!pads) return pads;
            for (const pad of pads) {
                this.#filterGamepad(pad, this.#gamepad_filter);
            }
            return pads;
        };
    }

    #filterGamepad(pad, filter) {
        if (!pad) return pad;

        const buttons = pad.buttons.map(btn => ({
            pressed: !!btn?.pressed,
            touched: !!btn?.touched,
            value: btn?.value ?? 0
        }));

        const axes = pad.axes ? pad.axes.slice() : [];

        if (filter?.coalesceButtons?.length && Number.isInteger(filter.coalesceTarget)) {
            const target = buttons[filter.coalesceTarget];
            if (target) {
                const shouldPress = filter.coalesceButtons.some(idx => buttons[idx]?.pressed);
                if (shouldPress) {
                    target.pressed = true;
                    target.touched = true;
                    target.value = 1;
                }
            }

            if (filter.clearCoalesced !== false) {
                for (const idx of filter.coalesceButtons) {
                    if (idx === filter.coalesceTarget) continue;
                    const btn = buttons[idx];
                    if (btn) {
                        btn.pressed = false;
                        btn.touched = false;
                        btn.value = 0;
                    }
                }
            }
        }

        if (filter?.disableButtons?.length) {
            for (const idx of filter.disableButtons) {
                const btn = buttons[idx];
                if (btn) {
                    btn.pressed = false;
                    btn.touched = false;
                    btn.value = 0;
                }
            }
        }

        if (filter?.leftStickToDpad) {
            const threshold = Number.isFinite(filter.leftStickThreshold) ? filter.leftStickThreshold : 0.5;
            const x = axes[0] || 0;
            const y = axes[1] || 0;
            const dpad = {
                up: y <= -threshold,
                down: y >= threshold,
                left: x <= -threshold,
                right: x >= threshold
            };
            const ensureButton = (idx) => {
                if (!buttons[idx]) {
                    buttons[idx] = { pressed: false, touched: false, value: 0 };
                }
            };
            ensureButton(12);
            ensureButton(13);
            ensureButton(14);
            ensureButton(15);
            buttons[12].pressed = dpad.up;
            buttons[12].touched = dpad.up;
            buttons[12].value = dpad.up ? 1 : 0;
            buttons[13].pressed = dpad.down;
            buttons[13].touched = dpad.down;
            buttons[13].value = dpad.down ? 1 : 0;
            buttons[14].pressed = dpad.left;
            buttons[14].touched = dpad.left;
            buttons[14].value = dpad.left ? 1 : 0;
            buttons[15].pressed = dpad.right;
            buttons[15].touched = dpad.right;
            buttons[15].value = dpad.right ? 1 : 0;
        }

        try {
            Object.defineProperty(pad, 'buttons', { value: buttons, configurable: true });
        } catch (err) {
            for (let i = 0; i < buttons.length; i++) {
                try {
                    pad.buttons[i].pressed = buttons[i].pressed;
                    pad.buttons[i].touched = buttons[i].touched;
                    pad.buttons[i].value = buttons[i].value;
                } catch (innerErr) {
                }
            }
        }

        try {
            Object.defineProperty(pad, 'axes', { value: axes, configurable: true });
        } catch (err) {
            if (pad.axes && axes.length) {
                for (let i = 0; i < axes.length; i++) {
                    try {
                        pad.axes[i] = axes[i];
                    } catch (innerErr) {
                    }
                }
            }
        }

        return pad;
    }

    #getKeyboardMode() {
        try {
            if (window.__VME_KB_MODE) {
                return window.__VME_KB_MODE;
            }
            return GameFocusManager.getInstance().isEnabled() ? 'focusmode' : 'retropad';
        } catch (err) {
            return 'retropad';
        }
    }

    async #prepareNostalgist(romName, caption) {
        s("#cors_query_prefix").style.display = "none";
        s('#cors_query_prefix').innerHTML = "";
        s("#cors_query").innerHTML = "load \"" + caption + "\"";
        s("#cors_results").innerHTML = "\n";
        this.#cli.print_progress("Loading ...");

        const self = this;

        let retroarchConfigOverrides = {};
        const keyboardMode = this.#getKeyboardMode();
        const hasGamepad = EnvironmentManager.hasGamepad();
        const effectiveKeyboardMode = keyboardMode;
        const hasSyntheticKeyboardJoy = !!this.#selected_platform.keyboard_joystick_mapping;

        window.__VME_KB_JOY_MAP = hasSyntheticKeyboardJoy
            ? this.#selected_platform.keyboard_joystick_mapping
            : null;

        if (EnvironmentManager.isDesktop() && this.#selected_platform.touch_controllers.length == 1 && this.#selected_platform.touch_controllers[0] == JOYSTICK_TOUCH_MODE.QUICKSHOT_KEYBOARD) {
            retroarchConfigOverrides = {
                ...this.#selected_platform.touch_controller_mapping
            }
        }

        if (hasSyntheticKeyboardJoy) {
            if (EnvironmentManager.hasTouch() && this.#selected_platform.touch_controller_mapping != undefined) {
                retroarchConfigOverrides = {
                    ...this.#selected_platform.touch_controller_mapping
                }
            } else if (this.#selected_platform.keyboard_controller_mapping != undefined) {
                retroarchConfigOverrides = this.#selected_platform.keyboard_controller_mapping;
            }

            if (hasGamepad && this.#selected_platform.gamepad_controller_mapping) {
                retroarchConfigOverrides = {
                    ...retroarchConfigOverrides,
                    ...this.#selected_platform.gamepad_controller_mapping
                }
            }
            this.#applyGamepadFilter(hasGamepad ? this.#selected_platform.gamepad_filter : null);
        } else if (EnvironmentManager.hasTouch() && this.#selected_platform.touch_controller_mapping != undefined) {
            retroarchConfigOverrides = {
                ...this.#selected_platform.touch_controller_mapping
            }
            this.#applyGamepadFilter(null);
        } else if (hasGamepad && effectiveKeyboardMode !== 'retropad') {
            if (this.#selected_platform.gamepad_controller_mapping) {
                retroarchConfigOverrides = {
                    ...this.#selected_platform.gamepad_controller_mapping
                }
            } else {
                retroarchConfigOverrides = {
                    input_player1_up: 'nul',
                    input_player1_left: 'nul',
                    input_player1_down: 'nul',
                    input_player1_right: 'nul',
                    input_player1_b: 'nul',
                    input_player1_a: 'nul',
                    input_player1_c: 'nul'
                }
            }
            this.#applyGamepadFilter(this.#selected_platform.gamepad_filter);
        } else if (this.#selected_platform.keyboard_controller_mapping != undefined) {
            retroarchConfigOverrides = this.#selected_platform.keyboard_controller_mapping;
            this.#applyGamepadFilter(hasGamepad ? this.#selected_platform.gamepad_filter : null);
        }

        Nostalgist.configure({
            bios: (typeof this.#selected_platform.guessBIOS === 'function') ? this.#selected_platform.guessBIOS(romName) : this.#selected_platform.bios,
            ...(this.#selected_platform.platform_id === 'dos' ? { sramType: 'pure.zip' } : {}),
            retroarchConfig: {
                rewind_enable: true,
                rewind_buffer_size: 20,
                rewind_granularity: (this.#selected_platform.rewind_granularity === undefined) ? 5 : this.#selected_platform.rewind_granularity,
                fastforward_ratio: (this.#selected_platform.fastforward_ratio === undefined) ? 10 : this.#selected_platform.fastforward_ratio,
                ...(this.#selected_platform.platform_id === 'dos' ? { video_gpu_screenshot: false } : {}),
                input_pause_toggle: false,
                video_scale_integer: (this.#selected_platform.force_scale === undefined) ? false : this.#selected_platform.force_scale,
                video_smooth: (this.#selected_platform.video_smooth === undefined) ? true : this.#selected_platform.video_smooth,
                savestate_thumbnail_enable: (typeof this.#selected_platform.savestate_thumbnail_enable === 'boolean')
                    ? this.#selected_platform.savestate_thumbnail_enable
                    : true,
                video_font_enable: false,
                input_menu_toggle: 'nul',

                input_game_focus_toggle: 'nul',
                input_auto_game_focus: '0',

                video_adaptive_vsync: true,
                video_vsync: true,
                ...retroarchConfigOverrides
            },
            retroarchCoreConfig: (typeof this.#selected_platform.guessConfig === 'function') ? this.#selected_platform.guessConfig(romName) : {},
            resolveBios(file) {
                let key = self.#selected_platform.platform_id + "." + file;
                let fileContent = self.#resolved_deps[key];
                let blob2 = new Blob([fileContent], { type: 'application/octet-stream' });
                return {
                    fileName: file,
                    fileContent: blob2
                };
            },
        });
    }

    async #restorePendingDosStatePostLaunch(nostalgist) {
        if (this.#selected_platform?.platform_id !== 'dos') {
            return;
        }
        const pendingState = this.#pending_dos_state;
        if (!(pendingState instanceof Blob)) {
            return;
        }

        this.#pending_dos_state = null;

        const hasDosSidecar = this.#isNonEmptyBlob(this.#sram);
        const maxAttempts = hasDosSidecar
            ? PlatformManager.DOS_RESTORE_ATTEMPTS_WITH_SIDECAR
            : PlatformManager.DOS_RESTORE_ATTEMPTS_WITHOUT_SIDECAR;
        const delayMs = hasDosSidecar
            ? PlatformManager.DOS_RESTORE_DELAY_WITH_SIDECAR_MS
            : PlatformManager.DOS_RESTORE_DELAY_WITHOUT_SIDECAR_MS;

        for (let i = 0; i < maxAttempts; i++) {
            if (i > 0) {
                await this.sleep(delayMs);
            }

            if (this.#nostalgist !== nostalgist || this.#selected_platform?.platform_id !== 'dos') {
                return;
            }

            try {
                await nostalgist.loadState(pendingState);
                return;
            } catch (error) {
                this.#warnDosDebug(`DOS post-launch restore attempt ${i + 1} failed:`, error);
                if (!hasDosSidecar && i === 0) {
                    this.#warnDosDebug('DOS restore fallback active: waiting for game boot, then retrying savestate load.');
                }
            }
        }

        console.warn('DOS restore: post-launch state could not be loaded after retries.');
    }

    getHtmlControls() {
        if (typeof this.#selected_platform.keyboard_controller_info === 'function') {
            const key = FileUtils.getFilenameWithoutExtension(romName);
            return this.#getControls(this.#selected_platform.keyboard_controller_info(key));
        } else {
            return this.#getControls(this.#selected_platform.keyboard_controller_info);
        }
    }

    #getControls(controlsMap) {
        let html = "<table>";

        for (const control in controlsMap) {
            if (controlsMap.hasOwnProperty(control)) {
                const description = controlsMap[control];
                html += `
                <tr class="kbControls-row">
                  <td class="kbControls-col-left">${control}</td>
                  <td class="kbControls-col-right">${description}</td>
                </tr>
              `;
            }
        }

        html += "</table>";

        return html;
    }



    #printControls(controlsMap) {
        this.#cli.print("&nbsp;");
        this.#cli.print("&nbsp;");
        this.#cli.print("Keyboard controls:");

        function padWithNbspRightAlign(text, maxLength) {
            const paddingLength = maxLength - text.length;
            const padding = '&nbsp;'.repeat(paddingLength > 0 ? paddingLength : 0);
            return padding + text;
        }

        const maxControlLength = Math.max(...Object.keys(controlsMap).map(key => key.length));

        for (const control in controlsMap) {
            if (controlsMap.hasOwnProperty(control)) {
                const description = controlsMap[control];
                this.#cli.print(`&nbsp;&nbsp;${padWithNbspRightAlign(control, maxControlLength)} - ${description}`);
            }
        }
    }

    #storeLastProgramInfo(filename, caption, romName) {
        const data = {
            filename: filename,
            caption: caption,
            romName: romName
        };
        const jsonString = JSON.stringify(data);
        StorageManager.storeValue(this.#selected_platform.platform_id + ".LAST_FILE", jsonString);
    }

    async loadRom(romSource, caption, isLocal = true, romName = caption) {
        let core = this.#selected_platform.core;
        let coreWasm = `./libretro/${core}_libretro.wasm`;

        let self = this;
        this.#state = null;
        this.#sram = null;
        this.#pending_dos_state = null;
        this.#pending_st_state = null;
        this.#pending_st_state_path = null;
        let progressMessage;
        let coreConfigOverrides = null;
        const originalRomSource = romSource;
        const originalRomName = romName;
        const originalCaption = caption;

        try {

            const gamepadManager = this.#vme.getGamepadManager();
            if (gamepadManager) {
                gamepadManager.setGuiNavigationEnabled(false);
            }
            self.#cli.set_loading(true);
            self.#cli.off();
            self.#keyboard_manager.clicks_off();

            const settingsElement = document.getElementById('settings');
            if (settingsElement) {
                settingsElement.style.pointerEvents = 'none';
            }

            const menuButtons = document.querySelectorAll('#menu-button-strip button, #menu-button-header-strip button');
            menuButtons.forEach(btn => {
                btn.style.pointerEvents = 'none';
            });

            self.#cli.clear();
            self.#cli.print_progress('Loading ... Please wait.');

            const downloadFile = async (url, text, useProxy) => {
                if (Debug.isEnabled()) {
                    Debug.updateMessage('load', `Preparing to download: ${url}`);
                }

                const response = await this.#network_manager.fetch(url, useProxy);

                let loaded = 0;
                const reader = response.body.getReader();
                const chunks = [];

                async function readStream() {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done || text == null) {
                            break;
                        }

                        loaded += value.length;
                        chunks.push(value);

                        const loadedKB = Math.floor(loaded / 1024);

                        progressMessage = `${text} ${loadedKB} KB`;

                        self.#cli.print_progress(progressMessage);
                    }

                    self.#cli.print_progress('Loading ... OK');
                    return new Blob(chunks);
                }

                return await readStream();
            };

            let romBlob;
            if (isLocal) {
                romBlob = romSource;
            } else {
                romBlob = await downloadFile.call(this, romSource, "Loading ...", true);
            }
            let launchRomInput = romBlob;
            let autoDiskSetInfo = null;

            if (!isLocal) {
                const autoDiskSet = await this.#buildAutoDiskM3uPackage(originalRomSource, originalRomName, romBlob, downloadFile);
                if (autoDiskSet) {
                    launchRomInput = autoDiskSet;
                    romBlob = autoDiskSet.primaryBlob;
                    romName = autoDiskSet.primaryFileName;
                    autoDiskSetInfo = autoDiskSet;
                    self.#cli.print_progress(`Loading multi-disk game (${autoDiskSet.totalDisks} disks) ...`);
                }
            }

            if (self.#isZipFile(romName) && this.#selected_platform.loader === 'unzip') {
                const zip = new JSZip();
                const zipContent = await zip.loadAsync(romBlob);

                if (Object.keys(zipContent.files).length === 0) {
                    throw new Error('No files found in the zip archive.');
                }

                const firstFileName = Object.keys(zipContent.files)[0];
                romName = firstFileName;
                caption = firstFileName;
                const firstFile = zipContent.files[firstFileName];
                romBlob = await firstFile.async('blob');
                launchRomInput = romBlob;
            } else if (self.#isZipFile(romName) && this.#selected_platform.loader === 'gemzip') {
                const zip = new JSZip();
                const zipContent = await zip.loadAsync(romBlob);

                if (Object.keys(zipContent.files).length === 0) {
                    throw new Error('No files found in the zip archive.');
                }

                const firstFileName = Object.keys(zipContent.files)[0];
                // normalize + take last path segment (JSZip keys can include folders)
                const base = firstFileName.split("/").pop();
                const lower = base.toLowerCase();

                const isDisk = lower.endsWith(".stx") || lower.endsWith(".st") || lower.endsWith(".msa") || lower.endsWith(".dim");

                if (isDisk) { 
                    romName = firstFileName;
                    caption = firstFileName;
                    const firstFile = zipContent.files[firstFileName];
                    romBlob = await firstFile.async('blob');
                    launchRomInput = romBlob;
                } else {
                    const folderName = "gemtest";
                    this.#selected_platform._gemdosZipContent = zipContent;
                    this.#selected_platform._gemdosFolderName = folderName;
                    coreConfigOverrides = {
                        hatarib_hardtype: "0",
                        hatarib_hardimg: `hatarib/${folderName}`,
                        hatarib_hardboot: "1"
                    };
                    const bootUrl = new URL("../assets/boot/st.zip", import.meta.url);
                    const bootResp = await fetch(bootUrl);
                    romBlob = await bootResp.blob();
                    romName = "st.zip";
                    caption = romName;
                    launchRomInput = romBlob;
                }
            }

            this.#prepareNostalgist(romName, caption);
            if (coreConfigOverrides) {
                const baseCoreConfig = (typeof this.#selected_platform.guessConfig === 'function')
                    ? this.#selected_platform.guessConfig(romName)
                    : {};
                Nostalgist.configure({
                    retroarchCoreConfig: {
                        ...baseCoreConfig,
                        ...coreConfigOverrides
                    }
                });
            }

            const wasmBlob = await downloadFile.call(this, coreWasm, "Loading ...", false);
            const wasmArrayBuffer = await wasmBlob.arrayBuffer();

            if (!isLocal) {
                self.#storeLastProgramInfo(originalRomSource, originalCaption, originalRomName);
            }

            self.#cli.clear();
            self.#cli.print("Loading complete.");
            if (autoDiskSetInfo) {
                self.#cli.print(`Auto M3U prepared (${autoDiskSetInfo.selectedNames.length}/${autoDiskSetInfo.totalDisks}):`);
                autoDiskSetInfo.selectedNames.forEach((name) => self.#cli.print(`- ${name}`));
                self.#cli.print("&nbsp;");
            }
            self.#cli.print("<span class='blinking2'>Press any key or click to start.</span>");

            hide('#cors_interface');
            hide('#header');
            hide('#menu-wrap');
            hide('#menu-spacer');
            hide('#toggle-keyboard');

            // Close onscreen keyboard if visible - user must use physical keyboard or mouse
            self.#keyboard_manager.hideTouchKeyboard();

            if (EnvironmentManager.isDesktop() && self.#selected_platform.keyboard_controller_info != undefined) {
                if (typeof self.#selected_platform.keyboard_controller_info === 'function') {
                    const key = FileUtils.getFilenameWithoutExtension(romName);
                    self.#printControls(self.#selected_platform.keyboard_controller_info(key));
                } else {
                    self.#printControls(self.#selected_platform.keyboard_controller_info);
                }
            }

            const launch = () => {
                // Remove all launch listeners
                document.body.removeEventListener('click', launch);
                document.body.removeEventListener('keydown', launch);
                self.startEmulation(launchRomInput, caption, romName, wasmArrayBuffer);
            };

            // Only allow keyboard or mouse to proceed - gamepad does not count as user gesture for AudioContext
            document.body.addEventListener('click', launch, { once: true });
            document.body.addEventListener('keydown', launch, { once: true });

        } catch (error) {
            console.log(error.stack);
            if (Debug.isEnabled()) {
                Debug.setMessage(`Error encountered: ${error}`);
            }

            const stack = error.stack || error;
            this.#cli.guru(stack, false);
            throw new Error('Error loading file.');
        }
    }

    async loadLocalRom(romBlob, caption) {
        return this.loadRom(romBlob, caption, true);
    }

    async loadRomFileFromUrl(filename, romName, caption) {
        if (Debug.isEnabled()) {
            Debug.setMessage(`Starting to load ROM file: ${caption}`);
        }

        console.log({
            "title": `${caption}`,
            "credits": "",
            "platform_id": `${this.#selected_platform.platform_id}`,
            "image": "",
            "filename": `${romName}`,
            "url": `${filename}`
        });

        return this.loadRom(filename, caption, false, romName);
    }

    async loadRomFile(blob, romName, caption, fromBrowser = false, browserType = null, closeCallback = null) {
        this.#prepareNostalgist(romName, caption);

        const gamepadManager = this.#vme.getGamepadManager();
        if (gamepadManager) {
            gamepadManager.setGuiNavigationEnabled(false);
        }
        this.#cli.set_loading(true);
        this.#cli.off();
        this.#keyboard_manager.clicks_off();

        const settingsElement = document.getElementById('settings');
        if (settingsElement) {
            settingsElement.style.pointerEvents = 'none';
        }

        const menuButtons = document.querySelectorAll('#menu-button-strip button, #menu-button-header-strip button');
        menuButtons.forEach(btn => {
            btn.style.pointerEvents = 'none';
        });

        const self = this;

        if (fromBrowser && browserType) {
            s("html").style.background = "#000000";
            s("body").style.background = "#000000";

            const hasGamepad = Array.from(navigator.getGamepads()).some(gp => gp?.connected);

            if (hasGamepad) {
                const overlayId = browserType === 'save' ? 'browserLoadingOverlay' : 'collectionBrowserLoadingOverlay';
                const messageId = browserType === 'save' ? 'browserLoadingMessage' : 'collectionBrowserLoadingMessage';
                const controlsId = browserType === 'save' ? 'browserLoadingControls' : 'collectionBrowserLoadingControls';
                const backgroundId = browserType === 'save' ? 'flicking-background' : 'collection-flicking-background';

                const overlay = document.getElementById(overlayId);
                const messageEl = document.getElementById(messageId);
                const controlsEl = document.getElementById(controlsId);
                const backgroundEl = document.getElementById(backgroundId);

                if (overlay && messageEl && controlsEl) {

                    if (backgroundEl) {
                        backgroundEl.classList.add('zoom-out');
                    }

                    messageEl.innerHTML = 'Loading complete.<br><span class="blinking2">Press any key or click to start.</span>';

                    if (EnvironmentManager.isDesktop() && self.#selected_platform.keyboard_controller_info != undefined) {
                        let controlsMap = self.#selected_platform.keyboard_controller_info;
                        if (typeof controlsMap === 'function') {
                            const key = FileUtils.getFilenameWithoutExtension(romName);
                            controlsMap = controlsMap(key);
                        }

                        controlsEl.innerHTML = '<div style="margin-top: 20px; font-size: 14px; color: #ffffff;">Keyboard controls:</div>' +
                            self.#getControls(controlsMap);
                    } else {
                        controlsEl.innerHTML = '';
                    }

                    overlay.style.display = 'flex';

                    self.#keyboard_manager.hideTouchKeyboard();

                    const launch = () => {
                        document.body.removeEventListener('click', launch);
                        document.body.removeEventListener('keydown', launch);

                        if (gamepadManager) {
                            gamepadManager.setGuiNavigationEnabled(false);
                        }

                        if (backgroundEl) {
                            backgroundEl.classList.remove('zoom-out');
                        }

                        overlay.style.display = 'none';

                        if (closeCallback) {
                            closeCallback();
                        }

                        self.startEmulation(blob, caption, romName);
                    };

                    document.body.addEventListener('click', launch, { once: true });
                    document.body.addEventListener('keydown', launch, { once: true });
                }
            } else {
                if (closeCallback) {
                    closeCallback();
                }
                self.startEmulation(blob, caption, romName);
            }
        } else {
            self.#vme.toggleScreen(100);

            self.#cli.clear();
            self.#cli.print("Loading complete.");
            self.#cli.print("<span class='blinking2'>Press any key or click to start.</span>");

            hide('#cors_interface');
            hide('#header');
            hide('#menu-wrap');
            hide('#menu-spacer');
            hide('#toggle-keyboard');

            self.#keyboard_manager.hideTouchKeyboard();

            if (EnvironmentManager.isDesktop() && self.#selected_platform.keyboard_controller_info != undefined) {
                if (typeof self.#selected_platform.keyboard_controller_info === 'function') {
                    const key = FileUtils.getFilenameWithoutExtension(romName);
                    self.#printControls(self.#selected_platform.keyboard_controller_info(key));
                } else {
                    self.#printControls(self.#selected_platform.keyboard_controller_info);
                }
            }

            const launch = () => {
                document.body.removeEventListener('click', launch);
                document.body.removeEventListener('keydown', launch);
                self.startEmulation(blob, caption, romName);
            };

            document.body.addEventListener('click', launch, { once: true });
            document.body.addEventListener('keydown', launch, { once: true });
        }
    }

    async loadRomFromCollection(platform_id, blob, program_name, caption, state, closeCallback = null) {
        if (closeCallback) {
            s("html").style.background = "#000000";
            s("body").style.background = "#000000";
        }

        if (platform_id == "md") platform_id = "smd"; //temp fix
        let platform = Object.values(SelectedPlatforms).find(platform => platform.platform_id === platform_id);
        this.#storage_manager.checkFiles(platform)
            .then(([deps, missingDeps, softFile]) => {
                this.#resolved_deps = deps;
                let selected = Object.values(SelectedPlatforms).find(platform => platform.platform_id === platform_id);
                this.setSelectedPlatform(selected);
                this.#state = state;
                this.#sram = null;
                this.#pending_dos_state = null;
                this.#pending_st_state = null;
                this.#pending_st_state_path = null;
                this.loadRomFile(blob, program_name, caption, true, 'collection', closeCallback);
            });
    }

    async startEmulation(blob, caption, romName, wasmArrayBuffer) {
        if (Debug.isEnabled()) {
            Debug.updateMessage('load', 'Preparing to start emulation.');
        }

        let self = this;

        this.#clearSoftwareDirCache();
        this.#vme.clearCollectionCache();

        const launchRom = this.#normalizeLaunchRomInput(blob, romName);
        this.#current_rom = launchRom.saveBlob;
        this.#current_m3u_disks = launchRom.diskNames;
        this.#current_m3u_disk_index = launchRom.diskIndex;
        this.#current_m3u_disk_files = launchRom.diskFiles;

        let storageManager = this.#storage_manager;
        let platform = this.#selected_platform;
        let core = this.#selected_platform.core;
        const coreJsUrl = this.#getLibretroUrl(core, 'js');
        const coreWasmUrl = this.#getLibretroUrl(core, 'wasm');
        const platformEmscriptenModule = this.#selected_platform.emscripten_module;
        const defaultLocateFile = (path) => {
            if (path.endsWith('.wasm')) {
                return coreWasmUrl;
            }
            if (path.endsWith('.js')) {
                return coreJsUrl;
            }
            return path;
        };
        const emscriptenModule = this.#selected_platform.uses_pthreads
            ? {
                mainScriptUrlOrBlob: coreJsUrl,
                locateFile: defaultLocateFile,
                ...(platformEmscriptenModule || {})
            }
            : platformEmscriptenModule;

        let errored = false;
        self.#program_name = launchRom.programName;

        if (this.getSelectedPlatform().touch_keyboard_reconfig != undefined) {
            this.#keyboard_manager.updateConfig(this.getSelectedPlatform().touch_keyboard_reconfig);
        }

        const gamepadManager = this.#vme.getGamepadManager();
        if (gamepadManager) {
            gamepadManager.setGuiNavigationEnabled(false);
        }

        try {
            this.#nostalgist = await Nostalgist.launch({
                core: core,
                rom: launchRom.nostalgistRom,
                async beforeLaunch(nostalgist) {
                    GameFocusManager.initialize(nostalgist);

                    if (StorageManager.getValue("SHADER") != "0" && typeof platform.shader === 'function') {
                        if (Debug.isEnabled()) {
                            Debug.updateMessage('load', 'Loading shaders.');
                        }
                        await platform.shader(nostalgist);
                    }

                    if (typeof platform.startup_beforelaunch === 'function') {
                        if (Debug.isEnabled()) {
                            Debug.updateMessage('load', 'Executing platform-specific startup sequence.');
                        }
                        await platform.startup_beforelaunch(nostalgist, storageManager);
                    }
                },
                state: self.#state,
                sram: self.#sram || undefined,
                async onLaunch(nostalgist) {
                    self.#caption = caption;
                    if (self.#selected_platform?.platform_id === 'dos' && self.#pending_dos_state instanceof Blob) {
                        void self.#restorePendingDosStatePostLaunch(nostalgist);
                    }
                    if (self.#selected_platform?.platform_id === 'st' && self.#pending_st_state instanceof Blob) {
                        void self.#restorePendingStStatePostLaunch(nostalgist);
                    }
                },
                shader: (StorageManager.getValue("SHADER") == "0" || typeof platform.shader === 'function') ? undefined : '1',
                resolveCoreJs(file) {
                    return coreJsUrl;
                },
                resolveCoreWasm(file) {
                    if (wasmArrayBuffer) {
                        return wasmArrayBuffer;
                    }
                    return coreWasmUrl;
                },
                resolveRom(file) {
                    if (Debug.isEnabled()) {
                        Debug.updateMessage('load', `Resolving ROM file.`);
                    }
                    return `${file}`
                },
                resolveShader(file) {
                    if (StorageManager.getValue("SHADER") == "0") { return []; }
                    return self.#selected_platform.shader;
                },
                emscriptenModule: emscriptenModule
            });
        }
        catch (error) {
            errored = true;

            if (Debug.isEnabled()) {
                Debug.updateMessage('error', `Error: ${error.message}`);
            }

            this.#cli.guru(error, false);
            console.error('Error importing Nostalgist:', error);
            return;
        }
        finally {
            if (!errored) {
                Debug.clearMessages();
                this.#setBgColor('#000000', false);
                this.#vme.emulationStarted();
            } else {
            }
        }
    }

    getNostalgist() {
        return this.#nostalgist;
    }

    getProgramName() {
        return this.#program_name;
    }

    getCurrentM3uDisks() {
        return Array.isArray(this.#current_m3u_disks) ? [...this.#current_m3u_disks] : [];
    }

    getCurrentM3uDiskIndex() {
        return Number.isInteger(this.#current_m3u_disk_index) ? this.#current_m3u_disk_index : null;
    }

    setCurrentM3uDiskIndex(index) {
        if (!Array.isArray(this.#current_m3u_disks) || this.#current_m3u_disks.length === 0) {
            this.#current_m3u_disk_index = null;
            return;
        }

        const max = this.#current_m3u_disks.length - 1;
        const next = Number.isInteger(index) ? Math.min(max, Math.max(0, index)) : null;
        this.#current_m3u_disk_index = next;
    }

    getCurrentM3uDiskFiles() {
        if (!Array.isArray(this.#current_m3u_disk_files)) {
            return [];
        }
        return this.#current_m3u_disk_files
            .filter((disk) => disk?.name && disk?.launch_name && disk?.blob instanceof Blob)
            .map((disk) => ({
                name: disk.name,
                launch_name: disk.launch_name,
                blob: disk.blob
            }));
    }

    get_software_dir() {
        return this.#model;
    }

    #clearSoftwareDirCache() {
        if (this.#model && Array.isArray(this.#model.items)) {
            this.#model.items.length = 0;
        }
        this.#model = undefined;
    }

    setSelectedPlatform(platform) {
        this.#selected_platform = platform;
        localStorage.setItem(PlatformManager.VME_CFG_CURRENT_PLATFORM, this.#selected_platform.platform_id);
    }

    getSelectedPlatform() {
        return this.#selected_platform;
    }

    getActiveTheme() {
        return this.#active_theme;
    }

    updatePlatform() {
        s('#platformLabel').innerHTML = "(" + this.#selected_platform.short_name + ")";
        this.theme(this.#selected_platform.theme);
        this.#keyboard_manager?.setTouchCapsEnabled(this.#selected_platform.keyboard?.touch_caps_toggle === true);
        this.#print_platform_status();
    }

    updateGamepadStatus() {
        const gamepadMsgEl = document.getElementById('gamepad-help-msg');
        if (gamepadMsgEl) {
            const hasGamepad = this.#vme.hasGamepad();
            gamepadMsgEl.textContent = this.#buildMenuHelpMessage(hasGamepad);
        }
    }

    #buildMenuHelpMessage(hasGamepad) {
        const base = hasGamepad ? 'Gamepad connected.' : 'Type HELP for info.';
        return `${base} Enter at least 4 letters to search for software.`;
    }

    #printPlatformStatus(platformName, reqs, soft) {
        this.#cli.print(platformName);
        this.#cli.print("&nbsp;[" + (reqs ? "x" : " ") + "] Ready");
        this.#cli.print("&nbsp;[" + (soft ? "x" : " ") + "] Software dir.");
        this.#cli.print("&nbsp;");
    }

    async #log_platform_status() {
        for (const key in SelectedPlatforms) {
            const platform = SelectedPlatforms[key];
            const [depsData, missingDeps, softwareFile] = await this.#storage_manager.checkFiles(platform);
            const allDepsAvailable = missingDeps.length === 0;
            this.#printPlatformStatus(platform.platform_name, allDepsAvailable && !platform.not_ready, softwareFile !== null);
        }
    }

    checkDependencies() {
        this.#log_platform_status();
    }

    #print_platform_status() {
        this.#storage_manager.checkFiles(this.#selected_platform)
            .then(([deps, missingDeps, softFile]) => {
                this.#resolved_deps = deps;
                let deps_satisfied = true;
                this.#cli.print(this.#selected_platform.platform_name);
                this.#cli.print("<p class='only-landscape'>" + ("=".repeat(this.#selected_platform.platform_name.length)) + "</p>");

                if (missingDeps.length > 0) {
                    deps_satisfied = false;
                    this.#cli.print('&nbsp;');
                    this.#cli.print('REQUIRED FILES missing:');

                    missingDeps.forEach(dependency => {
                        this.#cli.print('- ' + dependency);
                    });
                }

                if (softFile == undefined) {
                    this.#cli.print('&nbsp;');
                    deps_satisfied = false; //?
                    this.#cli.print('SOFTWARE DIRECTORY missing!');
                    this.#model = undefined;
                } else {
                    this.loadCorsFile(softFile);
                }

                this.#cli.print('&nbsp;');

                if (StorageManager.getValue("DEBUG") == "1") {
                    this.#cli.print("<span class='blinking2'>DEBUG MODE enabled.</span>");
                    this.#cli.print('&nbsp;');
                }
                const hasGamepad = this.#vme.hasGamepad();
                const menuHelpMessage = this.#buildMenuHelpMessage(hasGamepad);

                if (this.#selected_platform.message) {
                    this.#cli.print("<span class='blinking2'>" + this.#selected_platform.message + "</span>");
                    this.#cli.print('&nbsp;');
                    this.#cli.print('<span id="gamepad-help-msg">' + menuHelpMessage + '</span>');
                    if (hasGamepad) {
                        this.#printGamePadWarning();
                    }
                } else if (!deps_satisfied) {
                    this.#cli.print('Please import the missing file(s).');
                    this.#cli.print('&nbsp;');
                    this.#cli.print('Please refer to the VM/E Manual for instructions.')
                } else {
                    this.#cli.print(softFile.items.length + ' files available.');
                    this.#cli.print('&nbsp;');
                    this.#cli.print('<span id="gamepad-help-msg">' + menuHelpMessage + '</span>');
                    if (hasGamepad) {
                        this.#printGamePadWarning();
                    }
                }
            })
            .catch(error => {
                console.log(error.stack);
                this.#cli.guru(error, false);
                this.#cli.print('Error loading ' + this.#selected_platform.platform_name + ' core.');
            })
            .finally(() => {
                this.#cli.redraw();
            });
    }

    #printGamePadWarning() {
        this.#cli.print('Gamepad UI is work-in-progress.');
        this.#cli.print('Use front gamepad buttons to interact with the UI.');
    }

    #setBgColor(color, skipHtmlBody = false) {
        s("#settings").style.background = color;
        if (!skipHtmlBody) {
            s("body").style.background = color;
            s("html").style.background = color;
        }
    }

    theme(theme, skipBackground = false) {
        s("html").style.display = "block";
        document.documentElement.style.setProperty("--transform", "none");
        document.documentElement.style.setProperty("--color2", "");
        document.documentElement.style.setProperty("--color3", "");
        document.documentElement.style.setProperty("--fontsize", "1em");
        document.documentElement.style.setProperty("--portrait-fontsize", "80%");

        if (theme["--width"] == "double") {
            s("#settings").classList.add('doubleWidth');
        } else {
            s("#settings").classList.remove('doubleWidth');
        }

        this.#active_theme = theme;
        Object.keys(theme).forEach((prop) => {
            document.documentElement.style.setProperty(prop, theme[prop]);
        });
        this.#setBgColor(theme["--color0"], skipBackground);
    }

    importFile(key, file) {
        this.#storage_manager.storeFile(this.#selected_platform.platform_id + "." + key, file);
    }

    loadCorsFile(json) {
        try {
            if (json.proxy != undefined) {
                this.#network_manager.set_proxy(json.proxy);
            }

            if (this.#selected_platform.name_overrides) {
                json.items.forEach(item => {
                    if (typeof item[0] === 'string') {
                        const filenameWithoutExt = FileUtils.getFilenameWithoutExtension(item[0]);
                        if (this.#selected_platform.name_overrides[filenameWithoutExt]) {
                            item[4] = this.#selected_platform.name_overrides[filenameWithoutExt];
                        }
                    }
                });
            }

            this.#model = json;
        } catch (error) {
            console.log(error);
            this.#cli.guru(error, false);
            this.#cli.message('Error loading file.');
        }
    }

    importCorsFile(key, json) {
        try {
            var tryItems = [];
            json.items.forEach(disk => {
                var item = {};
                item.txt = (String)[disk[0]];
                item.url = json.root + json.bases[disk[1]] + disk[2];
                tryItems.push(item);
            });

            this.#model = json;
            this.#storage_manager.storeFile(key, json);
        } catch (error) {
            console.log('error', error);
            this.#cli.guru(error, false);
            this.#cli.message('Error loading file.');
        }
    }

    async loadCollectionFile(blob) {
        const zip = new JSZip();
        let roms = [];

        try {
            const content = await zip.loadAsync(blob);

            if (content.files['vme_collection.json']) {
                const vmeImportJson = await content.file('vme_collection.json').async('string');
                const vmeImport = JSON.parse(vmeImportJson);

                this.#cli.print('&nbsp;');
                this.#cli.print_progress(`Importing ...`);

                let itemCounts = vmeImport.list.length;

                let i = 0;

                let collectionUniqueName = vmeImport.id;
                let collectionTitle = vmeImport.name;

                const collectionImgFile = zip.file(vmeImport.image);
                let collectionImgBlob = null;
                if (collectionImgFile) {
                    collectionImgBlob = await collectionImgFile.async('blob');
                } else {
                    throw new Error("The image file is invalid: " + vmeImport.image);
                }

                for (const item of vmeImport.list) {

                    i++;
                    this.#cli.print_progress(`Importing ... (${i}/${itemCounts})`);

                    const platform = Object.values(SelectedPlatforms).find(platform => platform.platform_id === item.platform_id);
                    if (platform == undefined) {
                        throw new Error("Unsupported platform found.");
                    }

                    const [depsData, missingDeps, softwareFile] = await this.#storage_manager.checkFiles(platform);
                    if (missingDeps.length > 0) {
                        throw new Error("You are missing " + item.platform_id + " requirements.");
                    }

                    const imgFile = zip.file(item.image);
                    let imgBlob = null;
                    if (imgFile) {
                        imgBlob = await imgFile.async('blob');
                    } else {
                        throw new Error("The image file is invalid: " + item.image);
                    }

                    let blob = null;
                    if (item.url) {
                        const response = await this.#network_manager.fetch(item.url, false);
                        blob = await response.blob();
                    } else if (item.file) {
                        const romFile = zip.file(item.file);
                        if (romFile) {
                            blob = await romFile.async("blob");
                        } else {
                            throw new Error("The file is not found in the zip: " + item.file);
                        }
                    } else {
                        throw new Error("The rom file is invalid: " + item.url);
                    }

                    roms.push({
                        title: (item.title != null) ? item.title : "",
                        credits: (item.credits != null) ? item.credits : "",
                        description: (item.description != null) ? item.description : "",
                        platform_id: item.platform_id,
                        file: blob,
                        data_type: 'blob',
                        filename: item.filename,
                        image: imgBlob
                    });
                }

                const ok = await this.#storage_manager.storeCollection(collectionUniqueName, collectionTitle, collectionImgBlob, roms);

                if (ok) {
                    this.#cli.message("A new collection was successfully imported.");
                } else {
                    throw new Error();
                }

            } else {
                this.#cli.message("&nbsp;", "Error importing VME Collection archive.", "vme_collection.json not found in the ZIP file.");
                return;
            }
        } catch (error) {
            console.error('An error occurred:', error);
            this.#cli.guru(error, false);
            this.#cli.message("&nbsp;", "Error importing VME Collection archive.");
            return;
        }
    }

    async loadVmeImportFile(blob) {
        const zip = new JSZip();
        let ok = true;
        try {
            const content = await zip.loadAsync(blob);
            if (content.files['vme_import.json']) {
                const vmeImportJson = await content.file('vme_import.json').async('string');
                const vmeImport = JSON.parse(vmeImportJson);

                this.#cli.print('&nbsp;');
                let i = 1;
                let count = Object.keys(vmeImport.platforms).length;

                for (const platformId in vmeImport.platforms) {
                    this.#cli.print_progress(`Importing ... (${i++}/${count})`);

                    const platform = vmeImport.platforms[platformId];

                    let result = await this.#processFileInZip(platform.software, `${platformId}.software`, content);
                    if (!result) return;

                    if (platform.dependencies) {
                        for (const depKey in platform.dependencies) {
                            const depFilePath = platform.dependencies[depKey];
                            let result = await this.#processFileInZip(depFilePath, `${platformId}.${depKey}`, content);
                            if (!result) throw new Error("Error processing zip.");
                        }
                    }
                }
            } else {
                this.#cli.message("&nbsp;", "Error loading VME Import archive.", "vme_import.json not found in the ZIP file.");
                ok = false;
                return;
            }
        } catch (error) {
            console.error('An error occurred:', error);
            this.#cli.guru(error, true);
            this.#cli.message("&nbsp;", "Error loading VME Import archive.");
            ok = false;
            return;
        }
        if (ok) {
            this.#cli.message("Files have been successfully imported.");
        }
    }

    async #processFileInZip(filePath, tag, zipContent) {
        if (zipContent.files[filePath]) {
            let fileData;
            if (filePath.endsWith('.json')) {
                fileData = await zipContent.file(filePath).async('string');
                let json = JSON.parse(fileData);
                this.importCorsFile(tag, json);
            } else {
                fileData = await zipContent.file(filePath).async('arraybuffer');
                var wordArray = lib.WordArray.create(fileData);
                var md5 = MD5(wordArray).toString();
                await this.#storage_manager.storeFile(tag, fileData);
            }
            console.log(`Saved ${tag}`);
            return true;
        } else {
            console.error(`${filePath} not found in the ZIP file.`);
            this.#cli.message("&nbsp;", "Error loading VME Import archive.", "" + filePath + " not found.");
            return false;
        }
    }

    showThumbnail(text) {
        let platform_thumbnail_dir = this.getSelectedPlatform().thumbnail_dir;
        let imageUrl = `http://thumbnails.libretro.com/${platform_thumbnail_dir}/Named_Snaps/${text.replace('.zip', '.png')}`;

        if (this.dynamicImg) {
            this.dynamicImg.src = imageUrl;
            this.dynamicImg.style.display = 'block';
        }
    }

    hideThumbnail() {
        if (this.dynamicImg) {
            this.dynamicImg.style.display = 'none';
        }
    }

    #addHoverListener() {
        this.dynamicImg = document.createElement('img');
        this.dynamicImg.className = 'dynamic-image';
        this.dynamicImg.style.display = 'none';
        document.body.appendChild(this.dynamicImg);

        this.dynamicImg.addEventListener('error', () => {
            this.hideThumbnail();
        });

        const corsResults = document.getElementById('cors_results');
        corsResults.addEventListener('mouseover', (event) => {
            if (event.target.tagName === 'SPAN' && event.target.parentNode.classList.contains('corsrow')) {
                let text = event.target.textContent.trim();
                this.showThumbnail(text);
            }
        });

        corsResults.addEventListener('mouseout', (event) => {
            if (event.target.tagName === 'SPAN' && event.target.parentNode.classList.contains('corsrow')) {
                this.hideThumbnail();
            }
        });
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    #logDosDebug(...args) {
        if (Debug.isEnabled()) {
            console.info(...args);
        }
    }

    #warnDosDebug(...args) {
        if (Debug.isEnabled()) {
            console.warn(...args);
        }
    }

    #isNonEmptyBlob(blob) {
        return blob instanceof Blob && blob.size > 0;
    }

    #normalizeDosRomBaseName(rawName) {
        if (typeof rawName !== 'string' || rawName.length === 0) {
            return '';
        }

        const leafName = rawName.split(/[\\/]/).pop() || rawName;
        const sanitized = leafName.replace(/["%*/:<>?\\|]/g, '-');
        const dotIndex = sanitized.lastIndexOf('.');
        if (dotIndex <= 0) {
            return sanitized;
        }
        return sanitized.substring(0, dotIndex);
    }

    #getDosPureSramPath() {
        const nostalgist = this.#nostalgist;
        if (!nostalgist || typeof nostalgist.getEmulator !== 'function') {
            return null;
        }

        try {
            const emulator = nostalgist.getEmulator();
            const sramPath = emulator?.sramFilePath;
            if (typeof sramPath === 'string' && sramPath.toLowerCase().endsWith('.pure.zip')) {
                return sramPath;
            }
        } catch {
        }

        return null;
    }

    #readDosPureSidecarByPath(filePath) {
        if (typeof filePath !== 'string' || filePath.length === 0) {
            return null;
        }

        const nostalgist = this.#nostalgist;
        const FS = nostalgist?.getEmscriptenFS?.();
        if (!FS) {
            return null;
        }

        try {
            const stats = FS.stat(filePath);
            if (!stats || (typeof stats.size === 'number' && stats.size <= 0)) {
                return null;
            }
            const bytes = FS.readFile(filePath);
            return new Blob([bytes], { type: 'application/zip' });
        } catch {
            return null;
        }
    }

    #logDosSidecarDebugInfo(expectedPath = null) {
        const nostalgist = this.#nostalgist;
        const FS = nostalgist?.getEmscriptenFS?.();
        if (!FS) {
            return;
        }

        const listDir = (dir) => {
            try {
                const entries = FS.readdir(dir) || [];
                this.#warnDosDebug(`[DOS sidecar] ${dir}:`, entries);
            } catch {
            }
        };

        if (expectedPath) {
            this.#warnDosDebug(`[DOS sidecar] expected path: ${expectedPath}`);
        }
        listDir('/home/web_user/retroarch/userdata/saves');
        listDir('/home/web_user/retroarch/userdata/saves/DOSBox-pure');
        listDir('/home/web_user/retroarch/userdata/content');
    }

    #scanForDosPureSidecars(rootDir, { maxDepth = 6, maxEntries = 2000 } = {}) {
        const nostalgist = this.#nostalgist;
        const FS = nostalgist?.getEmscriptenFS?.();
        if (!FS) {
            return [];
        }

        const results = [];
        const queue = [{ dir: rootDir, depth: 0 }];
        let visited = 0;

        while (queue.length > 0 && visited < maxEntries) {
            const current = queue.shift();
            if (!current) {
                break;
            }

            let entries;
            try {
                entries = FS.readdir(current.dir) || [];
            } catch {
                continue;
            }

            for (const name of entries) {
                if (name === '.' || name === '..') {
                    continue;
                }
                visited += 1;

                const fullPath = `${current.dir}/${name}`;
                let stats = null;
                try {
                    stats = FS.stat(fullPath);
                } catch {
                    continue;
                }

                const mode = stats?.mode || 0;
                const isDir = typeof FS.isDir === 'function' ? FS.isDir(mode) : false;
                if (isDir) {
                    if (current.depth < maxDepth) {
                        queue.push({ dir: fullPath, depth: current.depth + 1 });
                    }
                    continue;
                }

                if (!String(name).toLowerCase().endsWith('.pure.zip')) {
                    continue;
                }

                const mtime = stats?.mtime;
                const mtimeMs = typeof mtime === 'number' ? mtime : (mtime instanceof Date ? mtime.getTime() : 0);
                const size = typeof stats?.size === 'number' ? stats.size : 0;
                const rawBase = String(name).slice(0, -'.pure.zip'.length);
                const baseName = this.#normalizeDosRomBaseName(rawBase);

                results.push({
                    name: String(name),
                    path: fullPath,
                    size,
                    mtimeMs,
                    baseName,
                    baseNameLower: baseName.toLowerCase()
                });
            }
        }

        return results;
    }

    #listDosPureSidecars() {
        const nostalgist = this.#nostalgist;
        if (!nostalgist) {
            return [];
        }

        const FS = nostalgist.getEmscriptenFS?.();
        if (!FS) {
            return [];
        }

        const savesDir = '/home/web_user/retroarch/userdata/saves/DOSBox-pure';
        let entries = [];
        try {
            entries = FS.readdir(savesDir) || [];
        } catch {
            return [];
        }

        const sidecars = entries.filter((name) =>
            name !== '.' && name !== '..' && String(name).toLowerCase().endsWith('.pure.zip')
        );
        if (sidecars.length === 0) {
            return [];
        }

        return sidecars.map((name) => {
            const path = `${savesDir}/${name}`;
            let mtimeMs = 0;
            let size = 0;
            try {
                const stats = FS.stat(path);
                if (typeof stats?.size === 'number') {
                    size = stats.size;
                }
                const mtime = stats?.mtime;
                if (typeof mtime === 'number') {
                    mtimeMs = mtime;
                } else if (mtime instanceof Date) {
                    mtimeMs = mtime.getTime();
                }
            } catch {
            }

            const lowerName = String(name).toLowerCase();
            const baseName = lowerName.endsWith('.pure.zip')
                ? String(name).slice(0, -'.pure.zip'.length)
                : String(name);
            const normalizedBaseName = this.#normalizeDosRomBaseName(baseName);

            return {
                name: String(name),
                path,
                size,
                mtimeMs,
                baseName: normalizedBaseName,
                baseNameLower: normalizedBaseName.toLowerCase()
            };
        });
    }

    #readDosPureSidecarBlob(preferredBaseName = null, minMtimeMs = null) {
        const sidecars = [
            ...this.#listDosPureSidecars(),
            ...this.#scanForDosPureSidecars('/home/web_user/retroarch/userdata/content')
        ];
        if (sidecars.length === 0) {
            return null;
        }

        const preferredLower = this.#normalizeDosRomBaseName(preferredBaseName || '').toLowerCase();
        let selected = null;

        if (preferredLower) {
            selected = sidecars.find((entry) => entry.baseNameLower === preferredLower) || null;
        }

        if (!selected) {
            let candidates = sidecars;
            if (Number.isFinite(minMtimeMs)) {
                const fresh = sidecars.filter((entry) => entry.mtimeMs >= minMtimeMs);
                if (fresh.length > 0) {
                    candidates = fresh;
                }
            }
            selected = candidates.sort((a, b) => {
                if (b.mtimeMs !== a.mtimeMs) {
                    return b.mtimeMs - a.mtimeMs;
                }
                return b.size - a.size;
            })[0] || null;
        }

        if (!selected) {
            return null;
        }

        const nostalgist = this.#nostalgist;
        const FS = nostalgist?.getEmscriptenFS?.();
        if (!FS) {
            return null;
        }

        try {
            const bytes = FS.readFile(selected.path);
            return new Blob([bytes], { type: 'application/zip' });
        } catch {
            return null;
        }
    }

    async #captureDosPureSidecar(options = {}) {
        const nostalgist = this.#nostalgist;
        if (!nostalgist) {
            return null;
        }

        const {
            maxWaitMs = PlatformManager.DOS_SIDECAR_QUICK_CAPTURE_MS,
            allowSlowFallback = false
        } = options;

        const preferredBaseName = this.#normalizeDosRomBaseName(this.#program_name || '');
        const expectedSramPath = this.#getDosPureSramPath();
        const emModule = nostalgist.getEmscriptenModule?.();

        // Ask core to flush savefiles (including *.pure.zip) if supported.
        try {
            if (emModule && typeof emModule._cmd_savefiles === 'function') {
                emModule._cmd_savefiles();
            }
        } catch {
        }

        const commandAt = Date.now();
        const deadline = commandAt + Math.max(0, maxWaitMs);

        while (Date.now() <= deadline) {
            const expectedBlob = this.#readDosPureSidecarByPath(expectedSramPath);
            if (this.#isNonEmptyBlob(expectedBlob)) {
                return expectedBlob;
            }

            const sidecar = this.#readDosPureSidecarBlob(preferredBaseName, commandAt - 1000);
            if (this.#isNonEmptyBlob(sidecar)) {
                return sidecar;
            }
            await this.sleep(PlatformManager.DOS_SIDECAR_POLL_INTERVAL_MS);
        }

        const expectedFallback = this.#readDosPureSidecarByPath(expectedSramPath);
        if (this.#isNonEmptyBlob(expectedFallback)) {
            return expectedFallback;
        }

        const fallback = this.#readDosPureSidecarBlob(preferredBaseName);
        if (this.#isNonEmptyBlob(fallback)) {
            return fallback;
        }

        if (!allowSlowFallback) {
            return null;
        }

        // Slow fallback: let Nostalgist wait for SRAM file with its internal logic.
        try {
            const slowResult = await Promise.race([
                nostalgist.saveSRAM?.() || Promise.resolve(null),
                this.sleep(25000).then(() => null)
            ]);
            if (this.#isNonEmptyBlob(slowResult)) {
                return slowResult;
            }
        } catch (error) {
            this.#warnDosDebug('DOS sidecar saveSRAM fallback failed:', error);
        }

        const fullScan = this.#scanForDosPureSidecars('/home/web_user/retroarch/userdata');
        if (fullScan.length > 0) {
            const preferredLower = this.#normalizeDosRomBaseName(preferredBaseName).toLowerCase();
            let selected = preferredLower
                ? fullScan.find((entry) => entry.baseNameLower === preferredLower) || null
                : null;

            if (!selected) {
                selected = fullScan.sort((a, b) => {
                    if (b.mtimeMs !== a.mtimeMs) {
                        return b.mtimeMs - a.mtimeMs;
                    }
                    return b.size - a.size;
                })[0] || null;
            }

            if (selected) {
                const deepFallback = this.#readDosPureSidecarByPath(selected.path);
                if (this.#isNonEmptyBlob(deepFallback)) {
                    return deepFallback;
                }
            }
        }

        this.#logDosSidecarDebugInfo(expectedSramPath);
        return null;
    }

    #isMultidiskEnabled() {
        return this.#selected_platform?.multidisk === true;
    }

    #isStDiskImageName(fileName) {
        const lower = String(fileName || '').toLowerCase();
        return lower.endsWith('.stx') || lower.endsWith('.st') || lower.endsWith('.msa') || lower.endsWith('.dim');
    }

    #isAtari800DiskImageName(fileName) {
        const lower = String(fileName || '').toLowerCase();
        return lower.endsWith('.atr') || lower.endsWith('.atx') || lower.endsWith('.xfd') || lower.endsWith('.dcm') || lower.endsWith('.pro');
    }

    async #resolveM3uLaunchFileFromSource(sourceFileName, sourceBlob) {
        if (this.#selected_platform.core !== 'hatarib' && this.#selected_platform.core !== 'atari800') {
            return {
                sourceFileName,
                launchFileName: sourceFileName,
                launchBlob: sourceBlob
            };
        }

        const isSupportedDiskName = (name) => {
            if (this.#selected_platform.core === 'hatarib') {
                return this.#isStDiskImageName(name);
            }
            if (this.#selected_platform.core === 'atari800') {
                return this.#isAtari800DiskImageName(name);
            }
            return false;
        };

        if (!this.#isZipFile(sourceFileName)) {
            if (!isSupportedDiskName(sourceFileName)) {
                return null;
            }
            return {
                sourceFileName,
                launchFileName: sourceFileName,
                launchBlob: sourceBlob
            };
        }

        const zip = new JSZip();
        const zipContent = await zip.loadAsync(sourceBlob);
        const fileNames = Object.keys(zipContent.files);
        if (fileNames.length === 0) {
            return null;
        }

        const diskEntryName = fileNames.find((name) => {
            const entry = zipContent.files[name];
            if (!entry || entry.dir) return false;
            const base = name.split('/').pop() || name;
            return isSupportedDiskName(base);
        });

        if (!diskEntryName) {
            return null;
        }

        const diskEntry = zipContent.files[diskEntryName];
        if (!diskEntry) {
            return null;
        }

        const launchBlob = await diskEntry.async('blob');
        const launchFileName = diskEntryName.split('/').pop() || diskEntryName;
        return {
            sourceFileName,
            launchFileName,
            launchBlob
        };
    }

    #extractDiskOrdinal(fileName) {
        const name = String(fileName || '');
        const m = name.match(/(?:disk|disc|side)\s*([0-9]+)/i);
        if (!m) {
            return null;
        }
        const parsed = Number.parseInt(m[1], 10);
        return Number.isInteger(parsed) ? parsed : null;
    }

    async #buildDiskM3uPackageFromArchive(selectedRomName, selectedBlob) {
        if (!this.#isZipFile(selectedRomName)) {
            return null;
        }
        if (this.#selected_platform.core !== 'hatarib' && this.#selected_platform.core !== 'atari800') {
            return null;
        }

        const zip = new JSZip();
        const zipContent = await zip.loadAsync(selectedBlob);
        const fileNames = Object.keys(zipContent.files);
        if (fileNames.length === 0) {
            return null;
        }

        const candidates = [];
        for (const entryName of fileNames) {
            const entry = zipContent.files[entryName];
            if (!entry || entry.dir) {
                continue;
            }
            const entryBlob = await entry.async('blob');
            const baseName = entryName.split('/').pop() || entryName;
            const resolved = await this.#resolveM3uLaunchFileFromSource(baseName, entryBlob);
            if (!resolved) {
                continue;
            }
            candidates.push({
                displayName: baseName,
                launchName: resolved.launchFileName,
                launchBlob: resolved.launchBlob
            });
        }

        if (candidates.length < 2) {
            return null;
        }

        candidates.sort((a, b) => {
            const diskA = this.#extractDiskOrdinal(a.displayName);
            const diskB = this.#extractDiskOrdinal(b.displayName);
            if (Number.isInteger(diskA) && Number.isInteger(diskB) && diskA !== diskB) {
                return diskA - diskB;
            }
            return a.displayName.localeCompare(b.displayName, undefined, { numeric: true, sensitivity: 'base' });
        });

        const launchFiles = candidates.map((candidate) => ({
            fileName: candidate.launchName,
            fileContent: candidate.launchBlob
        }));
        const selectedDisplayNames = candidates.map((candidate) => candidate.displayName);
        const launchNames = candidates.map((candidate) => candidate.launchName);
        const launchBlobs = candidates.map((candidate) => candidate.launchBlob);

        const m3uName = `${FileUtils.getFilenameWithoutExtension(selectedRomName)}.m3u`;
        const m3uBody = launchNames.join('\n');
        const m3uBlob = new Blob([m3uBody], { type: 'text/plain' });

        return {
            launchFiles: [{ fileName: m3uName, fileContent: m3uBlob }, ...launchFiles],
            primaryBlob: m3uBlob,
            saveBlob: selectedBlob,
            primaryFileName: m3uName,
            selectedNames: selectedDisplayNames,
            selectedDisplayNames: selectedDisplayNames,
            selectedLaunchNames: launchNames,
            selectedDiskBlobs: launchBlobs,
            totalDisks: candidates.length,
            diskIndex: 0
        };
    }

    #getSoftwareEntries() {
        if (!this.#model || !Array.isArray(this.#model.items) || !Array.isArray(this.#model.bases)) {
            return [];
        }

        return this.#model.items.map((item) => {
            const baseIndex = item[1];
            const url = this.#model.root + this.#model.bases[baseIndex] + item[2];
            return {
                romName: item[0],
                label: item[4] || item[0],
                url,
                size: item[3]
            };
        });
    }

    async #buildAutoDiskM3uPackage(selectedUrl, selectedRomName, selectedBlob, downloadFile) {
        if (!this.#isMultidiskEnabled()) {
            return null;
        }

        const archiveDiskSet = await this.#buildDiskM3uPackageFromArchive(selectedRomName, selectedBlob);
        if (archiveDiskSet) {
            this.#cli.print_progress(`Detected multi-disk archive (${archiveDiskSet.totalDisks} disks). Preparing M3U ...`);
            return archiveDiskSet;
        }

        const entries = this.#getSoftwareEntries();
        if (entries.length === 0) {
            return null;
        }

        const diskSet = DiskSetBuilder.buildBestSet(entries, selectedRomName, selectedUrl);
        if (!diskSet || !diskSet.isComplete || !diskSet.isConfident || diskSet.total < 2) {
            return null;
        }
        if (diskSet.selected.length !== diskSet.total) {
            return null;
        }
        this.#cli.print_progress(`Detected multi-disk set (${diskSet.total} disks). Preparing M3U ...`);

        const selectedFiles = [];
        const selectedSourceNames = [];
        const selectedLaunchNames = [];
        const selectedLaunchBlobs = [];
        for (let i = 0; i < diskSet.selected.length; i++) {
            const file = diskSet.selected[i];
            let fileBlob;
            if (file.url === selectedUrl && file.romName === selectedRomName) {
                fileBlob = selectedBlob;
            } else {
                fileBlob = await downloadFile.call(this, file.url, `Loading disk ${i + 1}/${diskSet.total} ...`, true);
            }
            const resolved = await this.#resolveM3uLaunchFileFromSource(file.romName, fileBlob);
            if (!resolved) {
                return null;
            }
            selectedFiles.push({
                fileName: resolved.launchFileName,
                fileContent: resolved.launchBlob
            });
            selectedSourceNames.push(file.romName);
            selectedLaunchNames.push(resolved.launchFileName);
            selectedLaunchBlobs.push(resolved.launchBlob);
        }

        const m3uName = `${FileUtils.getFilenameWithoutExtension(selectedRomName)}.m3u`;
        const m3uBody = selectedFiles.map((file) => file.fileName).join('\n');
        const m3uBlob = new Blob([m3uBody], { type: 'text/plain' });

        return {
            launchFiles: [{ fileName: m3uName, fileContent: m3uBlob }, ...selectedFiles],
            primaryBlob: m3uBlob,
            saveBlob: selectedBlob,
            primaryFileName: m3uName,
            selectedNames: selectedSourceNames,
            selectedDisplayNames: selectedSourceNames,
            selectedLaunchNames: selectedLaunchNames,
            selectedDiskBlobs: selectedLaunchBlobs,
            totalDisks: diskSet.total,
            diskIndex: 0
        };
    }

    async #ensureSoftwareDirLoaded() {
        if (this.#model && Array.isArray(this.#model.items)) {
            return true;
        }

        const [, , softFile] = await this.#storage_manager.checkFiles(this.#selected_platform);
        if (!softFile || !Array.isArray(softFile.items)) {
            return false;
        }

        this.loadCorsFile(softFile);
        return !!(this.#model && Array.isArray(this.#model.items));
    }

    #resolveSoftwareUrlByRomName(romName) {
        if (!this.#model || !Array.isArray(this.#model.items) || !Array.isArray(this.#model.bases)) {
            return null;
        }

        const wanted = String(romName || '').trim().toLowerCase();
        if (!wanted) {
            return null;
        }

        for (const item of this.#model.items) {
            const itemName = String(item?.[0] || '').trim().toLowerCase();
            if (itemName !== wanted) {
                continue;
            }
            const baseIndex = item[1];
            return this.#model.root + this.#model.bases[baseIndex] + item[2];
        }

        return null;
    }

    async #buildLaunchPackageFromSavedDiskRefs(diskNames, diskLaunchNames, diskRomIds, diskIndex, programName) {
        if (!Array.isArray(diskNames) || diskNames.length < 2) {
            return null;
        }
        if (!Array.isArray(diskRomIds) || diskRomIds.length !== diskNames.length) {
            return null;
        }

        const launchNames = Array.isArray(diskLaunchNames) && diskLaunchNames.length === diskNames.length
            ? [...diskLaunchNames]
            : [...diskNames];

        const launchFiles = [];
        for (let i = 0; i < diskRomIds.length; i++) {
            const romDataId = diskRomIds[i];
            if (!Number.isInteger(romDataId)) {
                return null;
            }
            const romData = await this.#storage_manager.getRomData(romDataId);
            if (!romData || !(romData.rom_data instanceof Blob)) {
                return null;
            }
            launchFiles.push({
                fileName: launchNames[i],
                fileContent: romData.rom_data
            });
        }

        const m3uName = (typeof programName === 'string' && programName.toLowerCase().endsWith('.m3u'))
            ? programName
            : `${FileUtils.getFilenameWithoutExtension(diskNames[0])}.m3u`;
        const m3uBody = launchNames.join('\n');
        const m3uBlob = new Blob([m3uBody], { type: 'text/plain' });
        const safeIndex = Number.isInteger(diskIndex)
            ? Math.min(diskNames.length - 1, Math.max(0, diskIndex))
            : 0;

        return {
            launchFiles: [{ fileName: m3uName, fileContent: m3uBlob }, ...launchFiles],
            primaryBlob: m3uBlob,
            saveBlob: launchFiles[safeIndex]?.fileContent || launchFiles[0].fileContent,
            primaryFileName: m3uName,
            selectedNames: [...diskNames],
            selectedDisplayNames: [...diskNames],
            selectedLaunchNames: [...launchNames],
            selectedDiskBlobs: launchFiles.map((entry) => entry.fileContent),
            totalDisks: diskNames.length,
            diskIndex: safeIndex
        };
    }

    async #buildLaunchPackageFromSavedDiskSet(diskNames, diskIndex, programName) {
        if (!Array.isArray(diskNames) || diskNames.length < 2) {
            return null;
        }
        if (!(await this.#ensureSoftwareDirLoaded())) {
            return null;
        }

        const launchFiles = [];
        const sourceDisplayNames = [];
        const launchFileNames = [];
        const launchBlobs = [];
        for (let i = 0; i < diskNames.length; i++) {
            const fileName = diskNames[i];
            const url = this.#resolveSoftwareUrlByRomName(fileName);
            if (!url) {
                return null;
            }
            const response = await this.#network_manager.fetch(url, true);
            const fileContent = await response.blob();
            const resolved = await this.#resolveM3uLaunchFileFromSource(fileName, fileContent);
            if (!resolved) {
                return null;
            }
            launchFiles.push({ fileName: resolved.launchFileName, fileContent: resolved.launchBlob });
            sourceDisplayNames.push(fileName);
            launchFileNames.push(resolved.launchFileName);
            launchBlobs.push(resolved.launchBlob);
        }

        const m3uName = (typeof programName === 'string' && programName.toLowerCase().endsWith('.m3u'))
            ? programName
            : `${FileUtils.getFilenameWithoutExtension(diskNames[0])}.m3u`;
        const m3uBody = launchFileNames.join('\n');
        const m3uBlob = new Blob([m3uBody], { type: 'text/plain' });
        const safeIndex = Number.isInteger(diskIndex)
            ? Math.min(diskNames.length - 1, Math.max(0, diskIndex))
            : 0;

        return {
            launchFiles: [{ fileName: m3uName, fileContent: m3uBlob }, ...launchFiles],
            primaryBlob: m3uBlob,
            saveBlob: launchFiles[safeIndex]?.fileContent || launchFiles[0].fileContent,
            primaryFileName: m3uName,
            selectedNames: [...diskNames],
            selectedDisplayNames: sourceDisplayNames,
            selectedLaunchNames: launchFileNames,
            selectedDiskBlobs: launchBlobs,
            totalDisks: diskNames.length,
            diskIndex: safeIndex
        };
    }

    #isDosExecutableFileName(fileName) {
        if (typeof fileName !== 'string' || fileName.length === 0) {
            return false;
        }
        const lower = fileName.toLowerCase();
        return lower.endsWith('.exe') || lower.endsWith('.com') || lower.endsWith('.bat');
    }

    #isDosSystemExecutable(fileName) {
        const systemExecutables = new Set([
            'autoexec.bat',
            'boot.com',
            'command.com',
            'config.com',
            'dos4gw.exe',
            'dos32a.exe',
            'cwstub.exe',
            'cwsdpmi.exe',
            'imgmount.com',
            'keyb.com',
            'label.com',
            'loadfix.com',
            'loadrom.com',
            'mem.com',
            'mixer.com',
            'puremenu.com',
            'remount.com',
            'windows.bat',
            'xcopy.com'
        ]);
        return systemExecutables.has(String(fileName || '').toLowerCase());
    }

    async #listDosZipExecutables(zipBlob) {
        if (!(zipBlob instanceof Blob)) {
            return [];
        }

        let zipContent;
        try {
            const zip = new JSZip();
            zipContent = await zip.loadAsync(zipBlob);
        } catch {
            return [];
        }

        const executables = [];
        for (const [entryName, entry] of Object.entries(zipContent.files)) {
            if (!entry || entry.dir || !this.#isDosExecutableFileName(entryName)) {
                continue;
            }
            const normalizedPath = String(entryName).replace(/\\/g, '/');
            const baseName = normalizedPath.split('/').pop() || normalizedPath;
            executables.push({
                path: normalizedPath,
                pathLower: normalizedPath.toLowerCase(),
                baseName,
                baseLower: baseName.toLowerCase()
            });
        }

        return executables;
    }

    async #guessDosExecutableHint(saveStateBlob, romBlob) {
        if (!(saveStateBlob instanceof Blob)) {
            return null;
        }

        const zipExecutables = await this.#listDosZipExecutables(romBlob);
        const userExecutables = zipExecutables.filter((entry) => !this.#isDosSystemExecutable(entry.baseName));
        if (userExecutables.length === 1) {
            return userExecutables[0].path;
        }

        let stateText;
        try {
            const buffer = await saveStateBlob.arrayBuffer();
            stateText = new TextDecoder('latin1').decode(buffer);
        } catch {
            return userExecutables[0]?.path || null;
        }

        const scoreByKey = new Map();
        const bump = (key, score) => {
            if (!key) {
                return;
            }
            scoreByKey.set(key, (scoreByKey.get(key) || 0) + score);
        };

        const zipByPath = new Map(zipExecutables.map((entry) => [entry.pathLower, entry.path]));
        const zipByBase = new Map();
        for (const entry of zipExecutables) {
            if (!zipByBase.has(entry.baseLower)) {
                zipByBase.set(entry.baseLower, entry.path);
            }
        }

        const pathRegex = /[A-Za-z]:\\[^\x00-\x1F\r\n]{1,220}\.(?:exe|com|bat)/gi;
        const bareRegex = /\b[A-Za-z0-9][A-Za-z0-9 _.-]{0,80}\.(?:exe|com|bat)\b/gi;

        const normalizeStatePath = (raw) => {
            const replaced = String(raw || '').replace(/\\/g, '/').trim();
            return replaced.replace(/^[A-Za-z]:\//, '').replace(/^\/+/, '');
        };

        let match;
        while ((match = pathRegex.exec(stateText)) !== null) {
            const normalized = normalizeStatePath(match[0]);
            const lower = normalized.toLowerCase();
            const base = normalized.split('/').pop() || normalized;
            const baseLower = base.toLowerCase();
            if (!this.#isDosExecutableFileName(base) || this.#isDosSystemExecutable(base)) {
                continue;
            }

            if (zipByPath.has(lower)) {
                bump(zipByPath.get(lower), 220);
            } else if (zipByBase.has(baseLower)) {
                bump(zipByBase.get(baseLower), 170);
            } else {
                bump(base, 80);
            }
        }

        while ((match = bareRegex.exec(stateText)) !== null) {
            const candidate = String(match[0] || '').trim();
            const baseLower = candidate.toLowerCase();
            if (!this.#isDosExecutableFileName(candidate) || this.#isDosSystemExecutable(candidate)) {
                continue;
            }
            if (zipByBase.has(baseLower)) {
                bump(zipByBase.get(baseLower), 40);
            } else {
                bump(candidate, 5);
            }
        }

        let bestKey = null;
        let bestScore = Number.NEGATIVE_INFINITY;
        for (const [key, score] of scoreByKey.entries()) {
            if (score > bestScore) {
                bestScore = score;
                bestKey = key;
            }
        }

        if (bestKey) {
            return bestKey;
        }
        return userExecutables[0]?.path || null;
    }

    async #buildDosExecutableLaunchPackage(archiveBlob, archiveName, executableHint) {
        if (!(archiveBlob instanceof Blob) || !this.#isZipFile(archiveName)) {
            return null;
        }

        let zipContent;
        try {
            const zip = new JSZip();
            zipContent = await zip.loadAsync(archiveBlob);
        } catch {
            return null;
        }

        const entries = Object.entries(zipContent.files)
            .filter(([, entry]) => entry && !entry.dir)
            .map(([entryName]) => ({
                path: String(entryName).replace(/\\/g, '/'),
                pathLower: String(entryName).replace(/\\/g, '/').toLowerCase()
            }));

        if (entries.length === 0) {
            return null;
        }

        const hintNormalized = String(executableHint || '').replace(/\\/g, '/').replace(/^[A-Za-z]:\//, '').replace(/^\/+/, '').toLowerCase();
        const hintBase = hintNormalized.split('/').pop() || hintNormalized;

        let target = entries.find((entry) => entry.pathLower === hintNormalized) || null;
        if (!target && hintBase) {
            target = entries.find((entry) => (entry.pathLower.split('/').pop() || '') === hintBase) || null;
        }
        if (!target) {
            target = entries.find((entry) => {
                const base = entry.path.split('/').pop() || entry.path;
                return this.#isDosExecutableFileName(base) && !this.#isDosSystemExecutable(base);
            }) || null;
        }
        if (!target) {
            return null;
        }

        const targetPathParts = target.path.split('/');
        const targetBaseName = targetPathParts.pop() || target.path;
        const targetDirectory = targetPathParts.join('/');
        const dosTargetDirectory = targetDirectory.replace(/\//g, '\\');
        const dosTargetBaseName = targetBaseName.replace(/\//g, '\\');
        const launchWrapperName = 'VMERUN.BAT';
        const launchWrapperScript = targetDirectory
            ? `@echo off\r\ncd "${dosTargetDirectory}"\r\n${dosTargetBaseName}\r\n`
            : `@echo off\r\n${dosTargetBaseName}\r\n`;

        const orderedEntries = [
            target,
            ...entries.filter((entry) => entry.pathLower !== target.pathLower)
        ];

        const launchFiles = [];
        const addLaunchFile = (fileName, fileContent) => {
            if (!fileName || launchFiles.some((file) => file.fileName === fileName)) {
                return;
            }
            launchFiles.push({ fileName, fileContent });
        };

        addLaunchFile(launchWrapperName, new Blob([launchWrapperScript], { type: 'text/plain' }));

        for (const entry of orderedEntries) {
            const zipEntry = zipContent.files[entry.path];
            if (!zipEntry || zipEntry.dir) {
                continue;
            }
            const fileBlob = await zipEntry.async('blob');
            addLaunchFile(entry.path, fileBlob);

            // DOS paths are case-insensitive, while emscripten FS is case-sensitive.
            // Add practical aliases so mixed-case lookups (e.g. data/GEN.dat) work.
            const pathParts = entry.path.split('/');
            const baseName = pathParts.pop() || entry.path;
            const baseDir = pathParts.join('/');

            const dirVariants = [...new Set([
                baseDir,
                baseDir.toLowerCase(),
                baseDir.toUpperCase()
            ])];
            const fileVariants = [...new Set([
                baseName,
                baseName.toLowerCase(),
                baseName.toUpperCase()
            ])];

            for (const dirVariant of dirVariants) {
                for (const fileVariant of fileVariants) {
                    const aliasPath = dirVariant ? `${dirVariant}/${fileVariant}` : fileVariant;
                    addLaunchFile(aliasPath, fileBlob);
                }
            }
        }

        if (launchFiles.length === 0) {
            return null;
        }

        return {
            launchFiles,
            primaryFileName: launchWrapperName,
            programName: archiveName,
            saveBlob: archiveBlob,
            suppressDiskUi: true
        };
    }

    #normalizeLaunchRomInput(romInput, fallbackName) {
        if (romInput && typeof romInput === 'object' && Array.isArray(romInput.launchFiles)) {
            const files = romInput.launchFiles
                .filter(file => file?.fileName && file?.fileContent)
                .map(file => ({
                    fileName: file.fileName,
                    fileContent: file.fileContent
                }));

            if (files.length > 0) {
                const suppressDiskUi = romInput.suppressDiskUi === true;
                const diskNames = suppressDiskUi
                    ? []
                    : (Array.isArray(romInput.selectedNames) && romInput.selectedNames.length > 0
                        ? [...romInput.selectedNames]
                        : files
                            .map((file) => file.fileName)
                            .filter((fileName) => !String(fileName).toLowerCase().endsWith('.m3u')));
                const diskDisplayNames = suppressDiskUi
                    ? []
                    : (Array.isArray(romInput.selectedDisplayNames) && romInput.selectedDisplayNames.length > 0
                        ? [...romInput.selectedDisplayNames]
                        : [...diskNames]);
                const diskLaunchNames = suppressDiskUi
                    ? []
                    : (Array.isArray(romInput.selectedLaunchNames) && romInput.selectedLaunchNames.length > 0
                        ? [...romInput.selectedLaunchNames]
                        : files
                            .map((file) => file.fileName)
                            .filter((fileName) => !String(fileName).toLowerCase().endsWith('.m3u')));
                const diskLaunchBlobs = suppressDiskUi
                    ? []
                    : (Array.isArray(romInput.selectedDiskBlobs) && romInput.selectedDiskBlobs.length > 0
                        ? [...romInput.selectedDiskBlobs]
                        : files
                            .filter((file) => !String(file.fileName).toLowerCase().endsWith('.m3u'))
                            .map((file) => file.fileContent));
                const diskIndex = suppressDiskUi
                    ? null
                    : (Number.isInteger(romInput.diskIndex) && diskNames.length > 0
                        ? Math.min(diskNames.length - 1, Math.max(0, romInput.diskIndex))
                        : (diskNames.length > 0 ? 0 : null));
                const diskFiles = [];
                if (!suppressDiskUi) {
                    const diskCount = Math.min(diskDisplayNames.length, diskLaunchNames.length, diskLaunchBlobs.length);
                    for (let i = 0; i < diskCount; i++) {
                        const blob = diskLaunchBlobs[i];
                        if (!(blob instanceof Blob)) {
                            continue;
                        }
                        diskFiles.push({
                            name: diskDisplayNames[i],
                            launch_name: diskLaunchNames[i],
                            blob
                        });
                    }
                }

                return {
                    nostalgistRom: files,
                    saveBlob: romInput.saveBlob || romInput.primaryBlob || files[0].fileContent,
                    programName: romInput.programName || romInput.primaryFileName || files[0].fileName || fallbackName,
                    diskNames: diskDisplayNames,
                    diskIndex,
                    diskFiles
                };
            }
        }

        return {
            nostalgistRom: {
                fileName: fallbackName,
                fileContent: romInput
            },
            saveBlob: romInput,
            programName: fallbackName,
            diskNames: [],
            diskIndex: null,
            diskFiles: []
        };
    }

    async #prepareDosRestoreLaunch(launchBlob, launchProgramName, dosExecHint) {
        let preparedLaunchBlob = launchBlob;
        let preparedLaunchProgramName = launchProgramName;
        let canAutoLoadState = false;

        if (!(preparedLaunchBlob instanceof Blob) || !this.#isZipFile(preparedLaunchProgramName)) {
            return {
                launchBlob: preparedLaunchBlob,
                launchProgramName: preparedLaunchProgramName,
                canAutoLoadState: true
            };
        }

        const normalizedHint = (typeof dosExecHint === 'string' && dosExecHint.trim().length > 0)
            ? dosExecHint.trim()
            : null;

        if (!normalizedHint) {
            return {
                launchBlob: preparedLaunchBlob,
                launchProgramName: preparedLaunchProgramName,
                canAutoLoadState
            };
        }

        try {
            const dosExecutableLaunch = await this.#buildDosExecutableLaunchPackage(
                preparedLaunchBlob,
                preparedLaunchProgramName,
                normalizedHint
            );
            if (dosExecutableLaunch) {
                preparedLaunchBlob = dosExecutableLaunch;
                preparedLaunchProgramName = dosExecutableLaunch.primaryFileName || preparedLaunchProgramName;
                canAutoLoadState = true;
                this.#logDosDebug('DOS restore using executable hint:', normalizedHint);
            }
        } catch (error) {
            console.warn('Failed to prepare DOS executable launch package from save hint:', error);
        }

        return {
            launchBlob: preparedLaunchBlob,
            launchProgramName: preparedLaunchProgramName,
            canAutoLoadState
        };
    }

    async #captureDosSaveArtifacts(saveData, romData) {
        let dosSram = null;
        let dosExecHint = null;

        try {
            dosExecHint = await this.#guessDosExecutableHint(saveData, romData);
            if (typeof dosExecHint === 'string' && dosExecHint.length > 0) {
                this.#logDosDebug('DOS executable hint captured for savestate:', dosExecHint);
            }
        } catch (error) {
            this.#warnDosDebug('Failed to detect DOS executable hint from savestate:', error);
        }

        try {
            dosSram = await this.#captureDosPureSidecar({
                maxWaitMs: PlatformManager.DOS_SIDECAR_QUICK_CAPTURE_MS,
                allowSlowFallback: false
            });
            if (!this.#isNonEmptyBlob(dosSram)) {
                this.#warnDosDebug('DOS sidecar (pure.zip) not found while saving state; restore may open executable chooser.');
            }
        } catch (error) {
            this.#warnDosDebug('Failed to capture DOSBox Pure sidecar (pure.zip) for savestate:', error);
        }

        return {
            dosSram: this.#isNonEmptyBlob(dosSram) ? dosSram : null,
            dosExecHint
        };
    }

    #isZipFile(fileName) {
        return typeof fileName === 'string' && fileName.toLowerCase().endsWith('.zip');
    }

    #getEmulatorStateFilePathSafe(nostalgist = null) {
        const instance = nostalgist || this.#nostalgist;
        if (!instance || typeof instance.getEmulator !== 'function') {
            return null;
        }
        try {
            const emulator = instance.getEmulator();
            return (typeof emulator?.stateFilePath === 'string' && emulator.stateFilePath.length > 0)
                ? emulator.stateFilePath
                : null;
        } catch {
            return null;
        }
    }

    #getStStateCandidates(expectedPath = null) {
        const candidates = new Set();
        if (typeof expectedPath === 'string' && expectedPath.length > 0) {
            candidates.add(expectedPath);
        }

        const fileName = (typeof expectedPath === 'string' && expectedPath.includes('/'))
            ? expectedPath.split('/').pop()
            : null;
        if (!fileName) {
            return [...candidates];
        }

        const FS = this.#nostalgist?.getEmscriptenFS?.();
        if (!FS) {
            return [...candidates];
        }

        const stateRoot = PlatformManager.ST_STATE_ROOT;
        const addCandidateDir = (dirName) => {
            if (typeof dirName !== 'string' || dirName.length === 0) {
                return;
            }
            candidates.add(`${stateRoot}/${dirName}/${fileName}`);
        };

        addCandidateDir(this.#selected_platform?.core);
        addCandidateDir('Hatari');
        addCandidateDir('hatarib');

        try {
            const entries = FS.readdir(stateRoot) || [];
            for (const entry of entries) {
                if (entry === '.' || entry === '..') {
                    continue;
                }
                addCandidateDir(entry);
            }
        } catch {
        }

        return [...candidates];
    }

    #unlinkStateCandidates(paths) {
        const FS = this.#nostalgist?.getEmscriptenFS?.();
        if (!FS || !Array.isArray(paths)) {
            return;
        }
        for (const filePath of paths) {
            if (typeof filePath !== 'string' || filePath.length === 0) {
                continue;
            }
            try {
                FS.unlink(filePath);
            } catch {
            }
        }
    }

    async #captureStStateFromFs() {
        const nostalgist = this.#nostalgist;
        const FS = nostalgist?.getEmscriptenFS?.();
        if (!nostalgist || !FS) {
            throw new Error('ST savestate capture failed: emulator filesystem is unavailable.');
        }

        const expectedPath = this.#getEmulatorStateFilePathSafe(nostalgist);
        const candidates = this.#getStStateCandidates(expectedPath);
        if (candidates.length === 0) {
            throw new Error('ST savestate capture failed: no state file candidates.');
        }

        this.#unlinkStateCandidates(candidates);
        nostalgist.sendCommand('SAVE_STATE');

        const deadline = Date.now() + PlatformManager.ST_STATE_CAPTURE_TIMEOUT_MS;
        while (Date.now() < deadline) {
            for (const filePath of candidates) {
                try {
                    const stats = FS.stat(filePath);
                    if (!stats || (typeof stats.size === 'number' && stats.size <= 0)) {
                        continue;
                    }
                    const bytes = FS.readFile(filePath);
                    let thumbnail;
                    try {
                        const thumbPath = `${filePath}.png`;
                        const thumbStats = FS.stat(thumbPath);
                        if (thumbStats && (typeof thumbStats.size !== 'number' || thumbStats.size > 0)) {
                            const thumbBytes = FS.readFile(thumbPath);
                            thumbnail = new Blob([thumbBytes], { type: 'image/png' });
                        }
                    } catch {
                        thumbnail = undefined;
                    }
                    if (!thumbnail) {
                        try {
                            thumbnail = await nostalgist.screenshot();
                        } catch {
                            thumbnail = undefined;
                        }
                    }
                    return {
                        state: new Blob([bytes], { type: 'application/octet-stream' }),
                        thumbnail,
                        statePath: filePath
                    };
                } catch {
                }
            }
            await new Promise((resolve) => setTimeout(resolve, PlatformManager.ST_STATE_POLL_INTERVAL_MS));
        }

        throw new Error(`ST savestate capture timed out after ${PlatformManager.ST_STATE_CAPTURE_TIMEOUT_MS}ms.`);
    }

    async #restorePendingStStatePostLaunch(nostalgist) {
        if (this.#selected_platform?.platform_id !== 'st') {
            return;
        }

        const pendingState = this.#pending_st_state;
        const pendingPath = this.#pending_st_state_path;
        if (!(pendingState instanceof Blob)) {
            return;
        }
        this.#pending_st_state = null;
        this.#pending_st_state_path = null;

        const FS = nostalgist?.getEmscriptenFS?.();
        if (!FS) {
            return;
        }

        const expectedPath = this.#getEmulatorStateFilePathSafe(nostalgist);
        const targetPaths = new Set();
        if (typeof pendingPath === 'string' && pendingPath.length > 0) {
            targetPaths.add(pendingPath);
        }
        for (const path of this.#getStStateCandidates(expectedPath || pendingPath || null)) {
            targetPaths.add(path);
        }

        const stateBytes = new Uint8Array(await pendingState.arrayBuffer());

        for (let i = 0; i < PlatformManager.ST_RESTORE_ATTEMPTS; i++) {
            if (i > 0) {
                await this.sleep(PlatformManager.ST_RESTORE_DELAY_MS);
            }

            if (this.#nostalgist !== nostalgist || this.#selected_platform?.platform_id !== 'st') {
                return;
            }

            try {
                for (const filePath of targetPaths) {
                    if (typeof filePath !== 'string' || filePath.length === 0) {
                        continue;
                    }
                    try {
                        const slash = filePath.lastIndexOf('/');
                        if (slash > 0) {
                            FS.mkdirTree(filePath.substring(0, slash));
                        }
                        FS.writeFile(filePath, stateBytes);
                        if (!filePath.endsWith('.auto')) {
                            FS.writeFile(`${filePath}.auto`, stateBytes);
                        }
                    } catch {
                    }
                }

                nostalgist.sendCommand('LOAD_STATE');
            } catch (error) {
                console.warn(`ST restore attempt ${i + 1} failed:`, error);
            }
        }
    }

    async loadState(platform_id, state, blob, program_name, caption, closeCallback = null, m3uDisks = null, m3uDiskIndex = null, m3uDiskRomIds = null, m3uDiskLaunchNames = null, dosSram = null, dosExecHint = null, stStatePath = null) {
        if (closeCallback) {
            s("html").style.background = "#000000";
            s("body").style.background = "#000000";
        }

        if (platform_id == "md") platform_id = "smd"; //temp fix

        if (platform_id != this.#selected_platform.platform_id) {
            let selected = Object.values(SelectedPlatforms).find(platform => platform.platform_id === platform_id);
            this.setSelectedPlatform(selected);
            if (!closeCallback) {
                this.updatePlatform();
            }
        }

        let launchBlob = blob;
        let launchProgramName = program_name;
        let dosCanAutoLoadState = false;

        if (this.#isMultidiskEnabled() && Array.isArray(m3uDisks) && m3uDisks.length > 1) {
            try {
                let restoredM3uLaunch = null;
                if (Array.isArray(m3uDiskRomIds) && m3uDiskRomIds.length === m3uDisks.length) {
                    restoredM3uLaunch = await this.#buildLaunchPackageFromSavedDiskRefs(
                        m3uDisks,
                        m3uDiskLaunchNames,
                        m3uDiskRomIds,
                        m3uDiskIndex,
                        program_name
                    );
                }

                if (!restoredM3uLaunch) {
                    restoredM3uLaunch = await this.#buildLaunchPackageFromSavedDiskSet(m3uDisks, m3uDiskIndex, program_name);
                }
                if (restoredM3uLaunch) {
                    launchBlob = restoredM3uLaunch;
                    launchProgramName = restoredM3uLaunch.primaryFileName;
                }
            } catch (error) {
                console.error('Failed to restore M3U disk set from save metadata:', error);
            }
        }

        if (platform_id === 'dos') {
            const prepared = await this.#prepareDosRestoreLaunch(launchBlob, launchProgramName, dosExecHint);
            launchBlob = prepared.launchBlob;
            launchProgramName = prepared.launchProgramName;
            dosCanAutoLoadState = prepared.canAutoLoadState;
        }

        const isDos = platform_id === 'dos';
        const isSt = platform_id === 'st';
        this.#state = (isDos || isSt) ? (isDos ? (dosCanAutoLoadState ? state : null) : null) : state;
        this.#pending_dos_state = isDos ? (dosCanAutoLoadState ? null : state) : null;
        this.#pending_st_state = isSt ? state : null;
        this.#pending_st_state_path = isSt && typeof stStatePath === 'string' ? stStatePath : null;
        if (isDos && dosCanAutoLoadState) {
            this.#logDosDebug('DOS restore mode: launch-time state autoload.');
        }
        this.#sram = dosSram instanceof Blob ? dosSram : null;
        await this.loadRomFile(launchBlob, launchProgramName, caption, true, 'save', closeCallback);
    }

    async saveState(isQuickSave = false) {
        try {
            const platform_id = this.#selected_platform.platform_id;
            const state = (platform_id === 'st')
                ? await this.#captureStStateFromFs()
                : await this.#nostalgist.saveState();
            if (!state || !state.state) {
                throw new Error('Savestate payload is empty.');
            }

            const save_data = state.state;
            const screenshot = state.thumbnail;
            const stStatePath = platform_id === 'st' && typeof state.statePath === 'string' ? state.statePath : null;

            const program_name = this.#program_name;
            const caption = this.#caption;
            const rom_data = this.#current_rom;
            let dosSram = null;
            let dosExecHint = null;
            if (platform_id === 'dos') {
                const dosArtifacts = await this.#captureDosSaveArtifacts(save_data, rom_data);
                dosSram = dosArtifacts.dosSram;
                dosExecHint = dosArtifacts.dosExecHint;
            }
            const m3uData = {
                diskNames: this.getCurrentM3uDisks(),
                diskIndex: this.getCurrentM3uDiskIndex(),
                diskFiles: this.getCurrentM3uDiskFiles()
            };

            const saved = await this.#storage_manager.storeState(
                save_data,
                rom_data,
                screenshot,
                platform_id,
                program_name,
                caption,
                isQuickSave,
                m3uData,
                dosSram,
                dosExecHint,
                stStatePath
            );

            if (saved) {
                ToastManager.enqueueToast(isQuickSave ? 'Quicksave created.' : 'Savestate created.');
            } else {
                ToastManager.enqueueToast('Failed to create savestate.', false, null, null, 2000);
                console.error('Savestate creation failed.');
            }
        } catch (error) {
            ToastManager.enqueueToast('Failed to create savestate.', false, null, null, 2000);
            console.error('Savestate creation failed with exception:', error);
        }
    }
}
