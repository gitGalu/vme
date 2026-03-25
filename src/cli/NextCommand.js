import { CommandBase } from './CommandBase.js';
import { StorageManager } from '../storage/StorageManager.js';

export class NextCommand extends CommandBase {

    static #DISK_RE = /\(\s*disk\s*\d+\s*of\s*\d+\s*\)/ig;

    #platform_manager;
    #previewOffset = 0;

    constructor(platform_manager) {
        super();
        this.#platform_manager = platform_manager;
    }

    get_keywords() {
        return ['nxt', 'next'];
    }

    get_help() {
        return ['nxt', 'load the next program from the current software directory'];
    }

    process_input(parameters, is_enter_pressed, inputContext = {}) {
        const model = this.#platform_manager.get_software_dir();
        if (model == undefined) {
            this.cli.soft_msg('To use NXT command please import SOFTWARE DIRECTORY first.');
            return;
        }

        const entries = this.#getSortedEntries(model);
        if (entries.length === 0) {
            this.cli.soft_msg('The current SOFTWARE DIRECTORY is empty.');
            return;
        }

        if (inputContext.advanceBySpace) {
            this.#previewOffset += 1;
        } else if (!is_enter_pressed) {
            this.#previewOffset = 0;
        }

        const nextGroup = this.#getNextGroup(entries, this.#previewOffset);
        if (!nextGroup) {
            this.cli.soft_msg('Unable to determine the next program.');
            return;
        }

        this.cli.print('Press ENTER to load or SPACE to choose next:');
        this.cli.print('&nbsp;');
        this.cli.print(`<p style='margin-left: 1ch;'>${nextGroup.entry.label}</p>`);

        if (!is_enter_pressed) {
            return;
        }

        this.#previewOffset = 0;
        this.#load(nextGroup.entry.data, nextGroup.entry.romName, nextGroup.entry.label);
    }

    is_enter_required() {
        return true;
    }

    consumes_space() {
        return true;
    }

    #getSortedEntries(model) {
        return model.items
            .map((item) => {
                const baseIndex = item[1];
                return {
                    romName: item[0],
                    label: item[4] || item[0],
                    data: model.root + model.bases[baseIndex] + item[2],
                    groupKey: this.#getGroupKey(item[0], item[4] || item[0])
                };
            })
            .sort((a, b) => {
                const byGroup = a.groupKey.localeCompare(b.groupKey, undefined, { sensitivity: 'base' });
                if (byGroup !== 0) {
                    return byGroup;
                }

                const byLabel = a.label.localeCompare(b.label, undefined, { sensitivity: 'base' });
                if (byLabel !== 0) {
                    return byLabel;
                }

                const byRomName = a.romName.localeCompare(b.romName, undefined, { sensitivity: 'base' });
                if (byRomName !== 0) {
                    return byRomName;
                }

                return a.data.localeCompare(b.data, undefined, { sensitivity: 'base' });
            });
    }

    #getGroupKey(romName, label) {
        const source = String(romName || label || '');
        const withoutExtension = source.replace(/\.[^.]+$/, '');
        const withoutDisk = withoutExtension.replace(NextCommand.#DISK_RE, ' ');

        return withoutDisk
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    }

    #getGroups(entries) {
        const groups = [];

        for (const entry of entries) {
            const lastGroup = groups[groups.length - 1];
            if (lastGroup && lastGroup.key === entry.groupKey) {
                lastGroup.entries.push(entry);
                continue;
            }

            groups.push({
                key: entry.groupKey,
                entry,
                entries: [entry]
            });
        }

        return groups;
    }

    #getNextGroup(entries, advanceCount = 0) {
        const groups = this.#getGroups(entries);
        if (groups.length === 0) {
            return null;
        }

        const lastFileJson = StorageManager.getValue(this.#platform_manager.getSelectedPlatform().platform_id + '.LAST_FILE', undefined);
        if (lastFileJson == undefined) {
            return groups[advanceCount % groups.length];
        }

        let lastFile;
        try {
            lastFile = JSON.parse(lastFileJson);
        } catch (error) {
            return groups[advanceCount % groups.length];
        }

        const currentIndex = entries.findIndex((entry) => entry.data === lastFile.filename);
        if (currentIndex === -1) {
            return groups[advanceCount % groups.length];
        }

        const currentGroupKey = entries[currentIndex].groupKey;
        const currentGroupIndex = groups.findIndex((group) => group.key === currentGroupKey);
        if (currentGroupIndex === -1) {
            return groups[advanceCount % groups.length];
        }

        return groups[(currentGroupIndex + 1 + advanceCount) % groups.length];
    }

    async #load(filename, romName, caption) {
        this.cli.set_loading(true);
        try {
            await this.#platform_manager.loadRomFileFromUrl(filename, romName, caption);
        } catch (error) {
            this.cli.message_clear('Error loading file.');
        }
    }
}
