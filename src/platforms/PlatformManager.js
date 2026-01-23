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
import JSZip from 'jszip';
import { s, hide } from '../dom.js';
import { MD5, lib } from 'crypto-js';
import { EnvironmentManager } from '../EnvironmentManager.js';
import { StorageManager } from '../storage/StorageManager.js';
import { Debug } from '../Debug.js';
import { FileUtils } from '../utils/FileUtils.js';
import { ToastManager } from '../ui/ToastManager.js';
import GameFocusManager from '../keyboard/GameFocusManager.js';
import { JOYSTICK_TOUCH_MODE } from '../Constants.js';

export const SelectedPlatforms = {
    NES, GB, GBC, GBA, SNES, SMS, PCE, MD, C64, Amiga, C128, C264, A2600, A5200, A800, A7800, Lynx, Coleco, CPC, VIC20, ZX80, Spectrum, SNK, Intv, MAME, XT, PICO8
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
    #current_rom;

    static VME_CFG_CURRENT_PLATFORM = 'VME_CFG.CURRENT_PLATFORM';
    static SOFTWARE_DIR_KEY = '.software';

    constructor(app, cli, storage_manager, network_manager, keyboard_manager) {
        this.#vme = app;
        this.#cli = cli;
        this.#storage_manager = storage_manager;
        this.#network_manager = network_manager;
        this.#keyboard_manager = keyboard_manager;
        let platform_id = localStorage.getItem(PlatformManager.VME_CFG_CURRENT_PLATFORM);
        this.#selected_platform = Object.values(SelectedPlatforms).find(platform => platform.platform_id === platform_id) || SelectedPlatforms.NES;
        this.updatePlatform();
        this.#cli.set_default_handler(() => { this.updatePlatform() });
    }

    async #prepareNostalgist(romName, caption) {
        s("#cors_query_prefix").style.display = "none";
        s('#cors_query_prefix').innerHTML = "";
        s("#cors_query").innerHTML = "load \"" + caption + "\"";
        s("#cors_results").innerHTML = "\n";
        this.#cli.print_progress("Loading ...");

        const self = this;

        let retroarchConfigOverrides = {};

        if (EnvironmentManager.isDesktop() && this.#selected_platform.touch_controllers.length == 1 && this.#selected_platform.touch_controllers[0] == JOYSTICK_TOUCH_MODE.QUICKSHOT_KEYBOARD) {
            retroarchConfigOverrides = {
                ...this.#selected_platform.touch_controller_mapping
            }
        }

        if (EnvironmentManager.hasTouch() && this.#selected_platform.touch_controller_mapping != undefined) {
            retroarchConfigOverrides = {
                ...this.#selected_platform.touch_controller_mapping
            }
        } else if (EnvironmentManager.hasGamepad()) {
            retroarchConfigOverrides = {
                input_player1_up: 'nul',
                input_player1_left: 'nul',
                input_player1_down: 'nul',
                input_player1_right: 'nul',
                input_player1_b: 'nul',
                input_player1_a: 'nul',
                input_player1_c: 'nul'
            }
        } else if (this.#selected_platform == SelectedPlatforms.Amiga) {
            retroarchConfigOverrides = {
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
                input_player1_r2: 'nul'
            }
        } else if (this.#selected_platform.keyboard_controller_mapping != undefined) {
            retroarchConfigOverrides = this.#selected_platform.keyboard_controller_mapping;
        }

        Nostalgist.configure({
            bios: (typeof this.#selected_platform.guessBIOS === 'function') ? this.#selected_platform.guessBIOS(romName) : this.#selected_platform.bios,
            retroarchConfig: {
                rewind_enable: true,
                rewind_buffer_size: 20,
                rewind_granularity: (this.#selected_platform.rewind_granularity === undefined) ? 5 : this.#selected_platform.rewind_granularity,
                fastforward_ratio: (this.#selected_platform.fastforward_ratio === undefined) ? 10 : this.#selected_platform.fastforward_ratio,
                input_pause_toggle: false,
                video_scale_integer: (this.#selected_platform.force_scale === undefined) ? false : this.#selected_platform.force_scale,
                video_smooth: (this.#selected_platform.video_smooth === undefined) ? true : this.#selected_platform.video_smooth,
                savestate_thumbnail_enable: true,
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
        let progressMessage;

        try {
            this.#prepareNostalgist(romName, caption);

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
            }

            const wasmBlob = await downloadFile.call(this, coreWasm, "Loading ...", false);
            const wasmArrayBuffer = await wasmBlob.arrayBuffer();

            if (!isLocal) {
                self.#storeLastProgramInfo(romSource, caption, romName);
            }

            self.#cli.clear();
            self.#cli.print("Loading complete.");
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
                self.startEmulation(romBlob, caption, romName, wasmArrayBuffer);
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

        this.#current_rom = blob;

        let storageManager = this.#storage_manager;
        let platform = this.#selected_platform;
        let core = this.#selected_platform.core;

        let errored = false;
        self.#program_name = romName;

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
                rom: {
                    fileName: romName,
                    fileContent: blob
                },
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
                async onLaunch(nostalgist) {
                    self.#caption = caption;
                },
                shader: (StorageManager.getValue("SHADER") == "0" || typeof platform.shader === 'function') ? undefined : '1',
                resolveCoreJs(file) {
                    return `./libretro/${core}_libretro.js`
                },
                resolveCoreWasm(file) {
                    if (wasmArrayBuffer) {
                        return wasmArrayBuffer;
                    }
                    return `./libretro/${core}_libretro.wasm`
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
                }
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
        this.#print_platform_status();
    }

    updateGamepadStatus() {
        const gamepadMsgEl = document.getElementById('gamepad-help-msg');
        if (gamepadMsgEl) {
            const hasGamepad = this.#vme.hasGamepad();
            gamepadMsgEl.textContent = hasGamepad ? 'Gamepad connected.' : 'Type HELP for info.';
        }
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

                if (this.#selected_platform.message) {
                    this.#cli.print("<span class='blinking2'>" + this.#selected_platform.message + "</span>");
                    this.#cli.print('&nbsp;');
                    this.#cli.print('<span id="gamepad-help-msg">' + (hasGamepad ? 'Gamepad connected.' : 'Type HELP for info.') + '</span>');
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
                    this.#cli.print('<span id="gamepad-help-msg">' + (hasGamepad ? 'Gamepad connected.' : 'Type HELP for info.') + '</span>');
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

    #isZipFile(fileName) {
        return typeof fileName === 'string' && fileName.toLowerCase().endsWith('.zip');
    }

    async loadState(platform_id, state, blob, program_name, caption, closeCallback = null) {
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
        this.#state = state;
        await this.loadRomFile(blob, program_name, caption, true, 'save', closeCallback);
    }

    async saveState(isQuickSave = false) {
        let state = await this.#nostalgist.saveState();

        const save_data = state.state;
        const screenshot = state.thumbnail;

        const platform_id = this.#selected_platform.platform_id;
        const program_name = this.#program_name;
        const caption = this.#caption;
        const rom_data = this.#current_rom;

        this.#storage_manager.storeState(save_data, rom_data, screenshot, platform_id, program_name, caption, isQuickSave).then(() => {
            ToastManager.enqueueToast(isQuickSave ? 'Quicksave created.' : 'Savestate created.');
        });
    }
}
