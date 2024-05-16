import { CommandBase } from './CommandBase.js';

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
            this.cli.soft_msg('To use FIND command please import SOFTWARE DIRECTORY first.')
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
                return re.test(val[0]);
            });
        }

        results.sort((a, b) => (a[0] > b[0]) ? 1 : -1);

        let output = results.map(item => {
            return {
                id: this.#platform_manager.get_software_dir().root + this.#platform_manager.get_software_dir().bases[item[1]] + item[2],
                label: item[0],
                data: this.#platform_manager.get_software_dir().root + this.#platform_manager.get_software_dir().bases[item[1]] + item[2]
            }
        });

        this.show_results(output);
    }

    is_selection_enabled() {
        return true;
    }

    exit_selection() {
        return true;
    }

    process_selection(item) {
        this.cli.set_loading(true);
        this.#platform_manager.loadRomFileFromUrl(item.data, item.label);
    }

    selection_changed(item) {

    }
}