import { CommandBase } from './CommandBase.js';
import { MD5, CryptoJS, enc, lib } from 'crypto-js';

export class OpenCommand extends CommandBase {

    #platform_manager;

    constructor(platform_manager) {
        super();
        this.#platform_manager = platform_manager;
    }

    get_keywords() {
        return ['open'];
    }

    get_help() {
        return ['open', 'import/open local file'];
    }

    process_input(input, is_enter_pressed) {
        if (!is_enter_pressed) {
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

            if (filename.endsWith(".json")) { // software dir
                const reader = new FileReader();

                reader.onload = function (e) {
                    const textContent = e.target.result;
                    let key = "" + self.#platform_manager.getSelectedPlatform().platform_id + ".software";
                    try {
                        let json = JSON.parse(textContent);
                        self.#platform_manager.loadCorsFile(key, json);
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
            } else if (filename.endsWith("vme_import.zip")) { // dependency bundle
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
        });
    }
}