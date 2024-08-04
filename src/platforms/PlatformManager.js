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
import A800 from './systems/A800.js';
import CPC from './systems/CPC.js';
import VIC20 from './systems/VIC20.js';
import ZX80 from './systems/ZX80.js';
import Spectrum from './systems/Spectrum.js';
import PCE from './systems/PCE.js';
import MD from './systems/MD.js';
import Lynx from './systems/Lynx.js';
import GBA from './systems/GBA.js';
import JSZip from 'jszip';
import { s } from '../dom.js';
import { MD5, lib } from 'crypto-js';
import { EnvironmentManager } from '../EnvironmentManager.js';
import { StorageManager } from '../storage/StorageManager.js';

export const SelectedPlatforms = {
    NES, GB, GBC, GBA, SMS, PCE, MD, C64, C128, C264, A2600, A5200, A800, Lynx, CPC, VIC20, ZX80, Spectrum
}

export class PlatformManager {
    #selected_platform;
    #model;
    #storage_manager;
    #active_theme;
    #nostalgist;
    #vme;
    #cli;
    #resolved_deps;
    #program_name;

    #state;
    #current_rom;

    static VME_CFG_CURRENT_PLATFORM = 'VME_CFG.CURRENT_PLATFORM';
    static SOFTWARE_DIR_KEY = '.software';

    constructor(app, cli, storage_manager) {
        this.#vme = app;
        this.#cli = cli;
        this.#storage_manager = storage_manager;
        let platform_id = localStorage.getItem(PlatformManager.VME_CFG_CURRENT_PLATFORM);
        this.#selected_platform = Object.values(SelectedPlatforms).find(platform => platform.platform_id === platform_id) || SelectedPlatforms.NES;
        this.updatePlatform();
        this.#cli.set_default_handler(() => { this.updatePlatform() });
    }

    async #prepareNostalgist(caption) {
        s("#cors_query_prefix").style.display = "none";
        s('#cors_query_prefix').innerHTML = "";
        s("#cors_query").innerHTML = "load \"" + caption + "\"";
        s("#cors_results").innerHTML = "LOADING...";

        const self = this;

        let retroarchConfigOverrides = {};
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
        }

        Nostalgist.configure({
            bios: this.#selected_platform.bios,
            retroarchConfig: {
                rewind_enable: true,
                rewind_buffer_size: 20,
                rewind_granularity: 5,
                fastforward_ratio: 10,
                input_pause_toggle: false,
                video_scale_integer: (this.#selected_platform.force_scale === undefined) ? false : this.#selected_platform.force_scale,
                video_smooth: true,
                savestate_thumbnail_enable: true,
                video_font_enable: false,
                input_menu_toggle: 'nul',
                ...retroarchConfigOverrides
            },
            retroarchCoreConfig: (typeof this.#selected_platform.guessConfig === 'function') ? this.#selected_platform.guessConfig(caption) : {},
            resolveBios(file) {
                let key = self.#selected_platform.platform_id + "." + file;
                let fileContent = self.#resolved_deps[key];
                let blob2 = new Blob([fileContent], { type: 'application/octet-stream' });
                return blob2;
            },
        });
    }

    async loadRomFileFromUrl(filename, caption) {
        console.log(`

        {
            "title": "${caption}",
            "credits": "",
            "platform_id": "${this.#selected_platform.platform_id}",
            "image": "",
            "filename": "${caption}",
            "url": "${filename}"
        }

        `);

        try {
            this.#prepareNostalgist(caption);
            const response = await fetch(filename);
            const blob = await response.blob();
            this.#storeLastProgramInfo(filename, caption);
            this.startEmulation(blob, caption);
        } catch (error) {
            throw new Error('Error loading file.');
        }
    }

    #storeLastProgramInfo(filename, caption) {
        const data = {
            filename: filename,
            caption: caption
        };
        const jsonString = JSON.stringify(data);
        StorageManager.storeValue(this.#selected_platform.platform_id + ".LAST_FILE", jsonString);
    }

    async loadRomFile(blob, caption) {
        this.#prepareNostalgist(caption);
        this.startEmulation(blob, caption);
    }

    async loadRomFromCollection(platform_id, blob, caption, state) {
        if (platform_id == "md") platform_id = "smd"; //temp fix
        let platform = Object.values(SelectedPlatforms).find(platform => platform.platform_id === platform_id);
        this.#storage_manager.checkFiles(platform)
            .then(([deps, missingDeps, softFile]) => {
                this.#resolved_deps = deps;
                let selected = Object.values(SelectedPlatforms).find(platform => platform.platform_id === platform_id);
                this.setSelectedPlatform(selected);
                this.#state = state;
                this.loadRomFile(blob, caption);
            });
    }

    async startEmulation(blob, caption) {
        let self = this;

        this.#current_rom = blob;

        let platform = this.#selected_platform;
        let core = this.#selected_platform.core;

        this.#model = {};

        try {
            this.#nostalgist = await Nostalgist.launch({
                core: core,
                rom: {
                    fileName: caption,
                    fileContent: blob
                },
                async beforeLaunch(nostalgist) {
                    if (StorageManager.getValue("SHADER") == "0") return;
                    if (typeof platform.shader === 'function') {
                        await platform.shader(nostalgist);
                    }
                },
                state: self.#state,
                onLaunch(nostalgist) {
                    self.#program_name = caption;
                },
                shader: (StorageManager.getValue("SHADER") == "0" || typeof platform.shader === 'function') ? undefined : '1',
                resolveCoreJs(file) {
                    return `./libretro/${core}_libretro.js`
                },
                resolveCoreWasm(file) {
                    return `./libretro/${core}_libretro.wasm`
                },
                resolveRom(file) {
                    return `${file}`
                },
                resolveShader(file) {
                    if (StorageManager.getValue("SHADER") == "0") { return []; }
                    return self.#selected_platform.shader;
                }
            });
        }
        catch (error) {
            console.error('Error importing Nostalgist:', error);
            return;
        }
        finally {
            this.#setBgColor('#000000', false);
            this.#vme.emulationStarted();
        }
    }

    getNostalgist() {
        return this.#nostalgist;
    }

    get_software_dir() {
        return this.#model;
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
                if (this.#selected_platform.message) {
                    this.#cli.print("<span class='blinking2'>" + this.#selected_platform.message + "</span>");
                    this.#cli.print('&nbsp;');
                    this.#cli.print('Type HELP for info.');
                } else if (!deps_satisfied) {
                    this.#cli.print('Please import the missing file(s).');
                    this.#cli.print('&nbsp;');
                    this.#cli.print('Please refer to the VM/E Manual for instructions.')
                } else {
                    this.#cli.print(softFile.items.length + ' files available.');
                    this.#cli.print('&nbsp;');
                    this.#cli.print('Type HELP for info.');
                }
            })
            .catch(error => {
                console.log(error.stack);
                this.#cli.print('Error loading ' + this.#selected_platform.platform_name + ' core.');
            })
            .finally(() => {
                this.#cli.redraw();
            });
    }

    #setBgColor(color) {
        s("#settings").style.background = color;
        s("body").style.background = color;
        s("html").style.background = color;
    }

    theme(theme) {
        s("html").style.display = "block";
        document.documentElement.style.setProperty("--transform", "none");
        document.documentElement.style.setProperty("--color2", "");
        document.documentElement.style.setProperty("--color3", "");
        document.documentElement.style.setProperty("--fontsize", "1em");

        if (theme["--width"] == "double") {
            s("#settings").classList.add('doubleWidth');
        } else {
            s("#settings").classList.remove('doubleWidth');
        }

        this.#active_theme = theme;
        Object.keys(theme).forEach((prop) => {
            document.documentElement.style.setProperty(prop, theme[prop]);
        });
        this.#setBgColor(theme["--color0"], false);
    }

    importFile(key, file) {
        this.#storage_manager.storeFile(this.#selected_platform.platform_id + "." + key, file);
    }

    loadCorsFile(json) {
        try {
            var tryItems = [];
            json.items.forEach(disk => {
                var item = {};
                item.txt = (String)[disk[0]];
                item.url = json.root + json.bases[disk[1]] + disk[2];
                tryItems.push(item);
            });

            this.#model = json;
        } catch (error) {
            this.#cli.message('Error loading file.');
            console.log('error', error);
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
            this.#cli.message('Error loading file.');
            console.log('error', error);
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
                    throw new Error("The image file is invalid: " + item.image);
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
                        const response = await fetch(item.url);
                        blob = await response.blob();
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
                    this.#cli.message("A new collection have been successfully imported.");
                } else {
                    throw new Error();
                }

            } else {
                this.#cli.message("&nbsp;", "Error importing VME Collection archive.", "vme_collection.json not found in the ZIP file.");
                return;
            }
        } catch (error) {
            console.error('An error occurred:', error);
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

    //

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

    async loadState(platform_id, state, blob, caption) {
        if (platform_id == "md") platform_id = "smd"; //temp fix

        if (platform_id != this.#selected_platform.platform_id) {
            let selected = Object.values(SelectedPlatforms).find(platform => platform.platform_id === platform_id);
            this.setSelectedPlatform(selected);
            this.updatePlatform();
        }
        this.#state = state;
        await this.loadRomFile(blob, caption);
    }

    async saveState() {
        let state = await this.#nostalgist.saveState();

        const save_data = state.state;
        const screenshot = state.thumbnail;

        const platform_id = this.#selected_platform.platform_id;
        const program_name = this.#program_name;
        const rom_data = this.#current_rom;

        this.#storage_manager.storeState(save_data, rom_data, screenshot, platform_id, program_name);
    }
}