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
        const tokens = parameters.filter(Boolean);

        if (tokens.length === 0) {
            results = Object.entries(SelectedPlatforms);
        } else {
            const t = tokens[0].toLowerCase();
            results = Object.entries(SelectedPlatforms).filter(([key, p]) =>
                key.toLowerCase().includes(t) ||
                p.platform_name.toLowerCase().includes(t) ||
                p.short_name.toLowerCase().includes(t)
            );
        }

        // Sort by platform name (case-insensitive) then platform_id
        results.sort((a, b) => {
            const nameCmp = a[1].platform_name.localeCompare(
                b[1].platform_name,
                undefined,
                { sensitivity: "base", numeric: true }
            );
            if (nameCmp !== 0) return nameCmp;

            return String(a[1].platform_id).localeCompare(String(b[1].platform_id), undefined, {
                sensitivity: "base",
                numeric: true
            });
        });

        const output = results.map(([, p]) => ({
            id: p.platform_id,
            label: p.platform_name,
            data: p.platform_id
        }));

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
