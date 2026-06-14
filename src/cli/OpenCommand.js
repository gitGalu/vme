import { CommandBase } from './CommandBase.js';
import { MD5, CryptoJS, enc, lib } from 'crypto-js';

export class OpenCommand extends CommandBase {

    #platform_manager;

    constructor(platform_manager) {
        super();
        this.#platform_manager = platform_manager;
        this.#initDragArea();
    }

    #initDragArea() {
        const dropArea = document.getElementById('settings');

        let dragging = false;

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, preventDefaults, false);
            document.body.addEventListener(eventName, preventDefaults, false);
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            dropArea.addEventListener(eventName, highlight.bind(this), false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, unhighlight.bind(this), false);
        });

        dropArea.addEventListener('drop', handleDrop.bind(this), false);

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        function highlight(e) {
            dropArea.classList.add('dragging');
            if (!dragging) {
                dragging = true;
                this.cli.clear();
                this.cli.soft_msg("<span class='blinking2'>Drop the file to open it.</span>");
            }
        }

        function unhighlight(e) {
            dragging = false;
            this.cli.clear();
            dropArea.classList.remove('dragging');
        }

        function handleDrop(e) {
            const dt = e.dataTransfer;
            const files = dt.files;

            if (files.length > 0) {
                this.#openFromDrag(files[0]);
            }
        }
    }

    #openFromDrag(file) {
        this.#import(file, file.name);
    }

    get_keywords() {
        return ['open'];
    }

    get_help() {
        return ['open', 'import/open local file'];
    }

    process_input(input, is_enter_pressed) {
        let arg = input.join().toUpperCase();

        if (!is_enter_pressed) {
            this.cli.clear();
            this.cli.print("Press ENTER to open local file.");
            this.cli.redraw();
            return;
        } else {
            if (arg === "IA") {
                this.#resync();
                return;
            }
            if (arg === "COL") {
                this.#openCollectionFromAssets('../assets/vme_collection.zip');
                return;
            }
            if (arg === "A8") {
                this.#openCollectionFromAssets('../assets/a8_vme_collection.zip');
                return;
            }
            this.#openFile();
        }
    }

    is_selection_enabled() {
        return false;
    }

    is_enter_required() {
        return true;
    }

    #findDep(md5sum) {
        let platform = this.#platform_manager.getSelectedPlatform();

        for (const dependency of platform.dependencies) {
            if (dependency.accepted.includes(md5sum)) {
                return dependency;
            }
        }
    }

    #import(file, filename, onResult = null) {
        this.cli.set_loading(true);

        const self = this;
        // Report non-ROM import result to gamepad mode (gamepad shows its own 'notify'
        // screen). When from gamepad, skip cli.message() - it appends 'Press any key to
        // continue' and registers global listeners that reload the page on next key/click.
        const fromGamepad = typeof onResult === 'function';
        const report = (ok, message) => {
            if (fromGamepad) onResult({ ok, message });
        };
        const cliMessage = (...args) => {
            if (!fromGamepad) self.cli.message(...args);
        };

        if (filename.endsWith(".json")) { // software dir
            const reader = new FileReader();

            reader.onload = function (e) {
                const textContent = e.target.result;
                let key = "" + self.#platform_manager.getSelectedPlatform().platform_id + ".software";
                try {
                    let json = JSON.parse(textContent);
                    self.#platform_manager.importCorsFile(key, json);
                    cliMessage("&nbsp;", "Successfully imported software directory.");
                    report(true, 'Software directory imported.');
                } catch (error) {
                    cliMessage("&nbsp;", "Failed to read file.", "Not a valid software directory file.");
                    report(false, 'Not a valid software directory file.');
                    return;
                }
            };

            reader.onerror = function (e) {
                console.error("Failed to read file!", e);
                report(false, 'Failed to read file.');
            };

            reader.readAsText(file);
        } else if (filename.includes("vme_import")) { // dependency bundle
            Promise.resolve(self.#platform_manager.loadVmeImportFile(file))
                .then(() => report(true, 'Dependencies imported.'))
                .catch((err) => { console.error(err); report(false, 'Failed to import dependencies.'); });
        } else if (filename.includes("vme_collection")) { // collection file
            Promise.resolve(self.#platform_manager.loadCollectionFile(file))
                .then(() => report(true, 'Collection imported.'))
                .catch((err) => { console.error(err); report(false, 'Failed to import collection.'); });
        } else {
            var reader = new FileReader();

            reader.onload = function (e) {
                var wordArray = lib.WordArray.create(e.target.result);
                var md5 = MD5(wordArray).toString();
                let dep = self.#findDep(md5);
                if (dep != undefined) { // single dependency
                    self.#platform_manager.importFile(dep.key, file);
                    cliMessage("&nbsp;", "Successfully imported " + dep.type);
                    report(true, `Imported ${dep.type}.`);
                } else { // other file (rom) - przejdzie do EMULATION; NIE raportujemy.
                    const blob = new Blob([e.target.result], { type: file.type });
                    self.#platform_manager.loadLocalRom(blob, filename);
                }
            };

            reader.onerror = function (e) {
                console.error("Failed to read file!", e);
                report(false, 'Failed to read file.');
            };

            reader.readAsArrayBuffer(file);
        }
    }

    async #resync() {
        const self = this;
        const url = new URL('../assets/vme_import.zip', import.meta.url).href;

        self.cli.set_loading(true);
        self.cli.clear();
        self.cli.print("Loading ...");

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
            }
            const blob = await response.blob();
            await self.#platform_manager.loadVmeImportFile(blob);
        } catch (error) {
            console.error("Error loading local vme_import.zip:", error);
            self.cli.guru(error, false);
            self.cli.message("&nbsp;", "Error loading VM/E Import archive.", "File not found or unreadable.");
        }
    }

    async #openCollectionFromAssets(assetPath = '../assets/vme_collection.zip') {
        const self = this;
        const url = new URL(assetPath, import.meta.url).href;

        self.cli.set_loading(true);
        self.cli.clear();
        self.cli.print("Loading ...");

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
            }
            const blob = await response.blob();
            await self.#platform_manager.loadCollectionFile(blob);
        } catch (error) {
            console.error(`Error loading collection asset (${assetPath}):`, error);
            self.cli.guru(error, false);
            self.cli.message("&nbsp;", "Error importing VM/E Collection archive.", "File not found or unreadable.");
        }
    }

    /**
     * Public entry - opens the native file picker (e.g. from the gamepad menu).
     * @param {Function} [onResult] - ({ok:boolean, message:string}) => void.
     *        Called after a NON-ROM import (success/error) so gamepad mode can show a
     *        confirmation screen. NOT called for ROMs (those transition to EMULATION).
     */
    openFilePicker(onResult = null) {
        this.#openFile(onResult);
    }

    #openFile(onResult = null) {
        const self = this;

        var input = document.createElement('input');
        input.type = 'file';
        input.id = 'vme-file-input';
        input.style.display = 'none';
        document.body.appendChild(input);
        document.getElementById('vme-file-input').click();
        document.getElementById('vme-file-input').addEventListener('change', function (event) {
            self.cli.set_loading(true);

            var file = event.target.files[0];
            var filename = file.name;

            self.cli.clear();
            self.cli.print("Loading " + filename + " ...");

            self.#import(file, filename, onResult);
        });
    }
}
