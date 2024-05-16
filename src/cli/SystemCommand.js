import { CommandBase } from './CommandBase.js';
import { SelectedPlatforms } from '../platforms/PlatformManager.js';

export class SystemCommand extends CommandBase {

    #platform_manager;

    constructor(platform_manager) {
        super();
        this.#platform_manager = platform_manager; 
    }

    get_keywords() {
        return ['sys'];
    }

    get_help() {
        return ['sys [FILTER]', 'switch to system [FILTER]'];
    }

    process_input(parameters) {
        let results = [];
        var tokens = parameters.filter(Boolean);
        if (tokens.length == 0) {
            results = Object.entries(SelectedPlatforms);
        } else {
            results = Object.entries(SelectedPlatforms).filter((val) => {
                return val[0].toLowerCase().includes(tokens[0].toLowerCase()) || val[1].platform_name.toLowerCase().includes(tokens[0].toLowerCase());
            });
        }
        results.sort((a, b) =>
            a[1].platform_name.localeCompare(b[1].platform_name)
        );
        // results.sort((a, b) => (a[0] > b[0]) ? 1 : -1);

        let output = results.map(item => {
            return {
                id: item[1].platform_id,
                label: item[1].short_name + " - " + item[1].platform_name,
                data: item[1].platform_id
            }
        });

        this.show_results(output);
    }

    is_selection_enabled() {
        return true;
    }

    process_selection(item) {
        this.cli.set_loading(true);
        let selected = Object.values(SelectedPlatforms).find(platform => platform.platform_id === item.id);
        this.#platform_manager.setSelectedPlatform(selected);
        this.cli.reset();
        this.#platform_manager.updatePlatform();
    }
}
