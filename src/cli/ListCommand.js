import { CommandBase } from './CommandBase.js';
import { StorageManager } from '../storage/StorageManager.js';

export class ListCommand extends CommandBase {

    #platform_manager;

    constructor(platform_manager) {
        super();
        this.#platform_manager = platform_manager;
    }

    get_keywords() {
        return ['list'];
    }

    get_help() {
        return ['list [FILTER]', 'list files starting with text'];
    }

    process_input(parameters) {
        if (this.#platform_manager.get_software_dir() == undefined) {
            this.cli.soft_msg('To use LIST command please import SOFTWARE DIRECTORY first.');
            return;
        }

        let model = this.#platform_manager.get_software_dir();
        let results = [];
        var tokens = parameters.filter(Boolean);
        if (tokens.length == 0) {
            return;
        } else if (tokens.length > 0) {
            results = model.items.filter((val) => {
                return val[0].toLowerCase().startsWith(tokens[0].toLowerCase());
            });
        }

        results.sort((a, b) => {
            const tagA = model.tags ? model.tags[a[1]] : null;
            const tagB = model.tags ? model.tags[b[1]] : null;

            if ((tagA && tagB) || (!tagA && !tagB)) {
                return a[0].localeCompare(b[0]);
            }

            return tagA ? -1 : 1;
        });

        let output = results.map(item => {
            const baseIndex = item[1];
            const tag = model.tags ? model.tags[baseIndex] : null;

            let label = item[0];

            return {
                id: model.root + model.bases[baseIndex] + item[2],
                label: label,
                tag: tag,
                data: model.root + model.bases[baseIndex] + item[2]
            };
        });

        this.show_results(output);
    }

    is_selection_enabled() {
        return true;
    }

    exit_selection() {
        return true;
    }

    async process_selection(item) {
        this.cli.set_loading(true);
        try {
            await this.#platform_manager.loadRomFileFromUrl(item.data, item.label);
        } catch (error) {
            this.cli.message("LOADING...", "&nbsp;", "Error loading file.");
        }
    }

    selection_changed(item) {
    }
}