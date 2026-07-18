import { CommandBase } from './CommandBase.js';
import { tagAwareCompare } from '../utils/TagPriority.js';

export class FindCommand extends CommandBase {

    #platform_manager;

    constructor(platform_manager) {
        super();
        this.#platform_manager = platform_manager;
    }

    get_keywords() {
        return ['find'];
    }

    get_help() {
        return ['find [FILTER]', 'list filenames containing text'];
    }

    process_input(parameters) {
        if (this.#platform_manager.get_software_dir() == undefined) {
            this.cli.soft_msg('To use FIND command please import SOFTWARE DIRECTORY first.');
            return;
        }
    
        let results = [];
        var tokens = parameters.filter(Boolean);
        if (tokens.length > 0) {
            var expr = tokens.join(".*");
            if (expr.length < 3) {
                return;
            }
    
            var re = new RegExp(expr, "i");
    
            results = this.#platform_manager.get_software_dir().items.filter((val) => {
                if (val[4]) {
                    return re.test(val[4]);
                }
                return re.test(val[0]);
            });
        }
    
        const softwareDir = this.#platform_manager.get_software_dir();
        results.sort((a, b) => tagAwareCompare(softwareDir, a, b));
    
        let output = results.map(item => {
            const baseIndex = item[1];
            const softwareDir = this.#platform_manager.get_software_dir();
            const tag = softwareDir.tags ? softwareDir.tags[baseIndex] : null;
    
            let romName = item[0];
            let label = item[0];

            if (item[4]) {
                label = item[4];
            } 

            return {
                id: softwareDir.root + softwareDir.bases[baseIndex] + item[2],
                romName: romName,
                label: label,
                tag: tag,
                data: softwareDir.root + softwareDir.bases[baseIndex] + item[2]
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
            await this.#platform_manager.loadRomFileFromUrl(item.data, item.romName, item.label);
        } catch (error) {
            this.cli.message("LOADING...", "&nbsp;", "Error loading file.");
        }
    }

    selection_changed(item) {

    }
}