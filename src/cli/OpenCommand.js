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
        if (!is_enter_pressed) {
            this.cli.clear();
            this.cli.print("Press ENTER to open local file.");
            this.cli.redraw();
            return;
        }
        this.#openFile();
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

    #import(file, filename) {
        const self = this;

        if (filename.endsWith(".json")) { // software dir
            const reader = new FileReader();

            reader.onload = function (e) {
                const textContent = e.target.result;
                let key = "" + self.#platform_manager.getSelectedPlatform().platform_id + ".software";
                try {
                    let json = JSON.parse(textContent);
                    self.#platform_manager.importCorsFile(key, json);
                    self.cli.message("&nbsp;", "Successfully imported software directory.");
                } catch (error) {
                    self.cli.message("&nbsp;", "Failed to read file.", "Not a valid software directory file.");
                    return;
                }
            };

            reader.onerror = function (e) {
                console.error("Failed to read file!", e);
            };

            reader.readAsText(file);
        } else if (filename.includes("vme_import")) { // dependency bundle
            self.#platform_manager.loadVmeImportFile(file);
        } else { 
            var reader = new FileReader();

            reader.onload = function (e) {
                var wordArray = lib.WordArray.create(e.target.result);
                var md5 = MD5(wordArray).toString();
                let dep = self.#findDep(md5);
                if (dep != undefined) { // single dependency
                    self.#platform_manager.importFile(dep.key, file);
                    self.cli.message("&nbsp;", "Successfully imported " + dep.type);
                } else { // other file (rom)
                    const blob = new Blob([e.target.result], { type: file.type });
                    self.#platform_manager.loadRomFile(blob, filename);
                }
            };

            reader.readAsArrayBuffer(file);
        }
    }

    #openFile() {
        const self = this;

        var input = document.createElement('input');
        input.type = 'file';
        input.id = 'vme-file-input';
        input.style.display = 'none';
        document.body.appendChild(input);
        document.getElementById('vme-file-input').click();
        document.getElementById('vme-file-input').addEventListener('change', function (event) {
            var file = event.target.files[0];
            var filename = file.name;

            self.cli.set_loading(true);
            self.cli.clear();
            self.cli.print("Loading " + filename + " ...");

            self.#import(file, filename);
        });
    }
}