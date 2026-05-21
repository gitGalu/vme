import { CommandBase } from './CommandBase.js';
import { HistoryManager } from '../history/HistoryManager.js';
import { SelectedPlatforms } from '../platforms/PlatformManager.js';

export class RecentCommand extends CommandBase {
    #platform_manager;

    constructor(platform_manager) {
        super();
        this.#platform_manager = platform_manager;
    }

    get_keywords() {
        return ['recent', 'rec'];
    }

    get_help() {
        return ['recent [platform|.]', 'show recently played games (filter by platform id or "." for current)'];
    }

    process_input(parameters) {
        const arg = (parameters || []).filter(Boolean)[0];
        let filter = null;
        let unresolvedArg = null;
        if (arg) {
            if (arg === '.') {
                filter = this.#platform_manager.getSelectedPlatform()?.platform_id || null;
            } else {
                const lower = arg.toLowerCase();
                const match = Object.values(SelectedPlatforms).find(p =>
                    p.platform_id?.toLowerCase() === lower ||
                    p.short_name?.toLowerCase() === lower
                );
                filter = match ? match.platform_id : lower;
                unresolvedArg = match ? null : arg;
            }
        }

        const entries = HistoryManager.getAll(filter);
        if (entries.length === 0) {
            if (filter) {
                const platform = Object.values(SelectedPlatforms).find(p => p.platform_id === filter);
                if (platform) {
                    this.cli.soft_msg(`No recent games for ${platform.short_name}.`);
                } else {
                    this.cli.soft_msg('No recent games yet.');
                }
            } else {
                this.cli.soft_msg('No recent games yet.');
            }
            return;
        }

        const output = entries.map(entry => {
            const platform = Object.values(SelectedPlatforms).find(p => p.platform_id === entry.platformId);
            const tagBase = platform ? platform.short_name : entry.platformId;
            const ago = HistoryManager.formatRelative(entry.ts);
            return {
                id: entry.romPath,
                romName: entry.romName,
                label: `${entry.label} — ${ago}`,
                tag: tagBase,
                data: entry.romPath,
                __platformId: entry.platformId,
                __caption: entry.label
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
            const targetPlatformId = item.__platformId;
            const current = this.#platform_manager.getSelectedPlatform();
            if (targetPlatformId && current && current.platform_id !== targetPlatformId) {
                const target = Object.values(SelectedPlatforms).find(p => p.platform_id === targetPlatformId);
                if (target) {
                    this.#platform_manager.setSelectedPlatform(target);
                    this.#platform_manager.updatePlatform({ printStatus: false });
                    this.cli.clear();
                    this.cli.print(target.platform_name);
                    this.cli.print('&nbsp;');
                    this.cli.print('Loading...');
                }
            }
            await this.#platform_manager.loadRomFileFromUrl(item.data, item.romName, item.__caption || item.romName);
        } catch (error) {
            this.cli.message('LOADING...', '&nbsp;', 'Error loading file.');
        }
    }
}
