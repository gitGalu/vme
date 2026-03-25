import { CommandBase } from './CommandBase.js';

export class RandomCommand extends CommandBase {

    #platform_manager;

    constructor(platform_manager) {
        super();
        this.#platform_manager = platform_manager;
    }

    get_keywords() {
        return ['rnd'];
    }

    get_help() {
        return ['rnd', 'load a random program from the current software directory'];
    }

    process_input(parameters, is_enter_pressed) {
        const model = this.#platform_manager.get_software_dir();
        if (model == undefined) {
            this.cli.soft_msg('To use RND command please import SOFTWARE DIRECTORY first.');
            return;
        }

        if (!Array.isArray(model.items) || model.items.length === 0) {
            this.cli.soft_msg('The current SOFTWARE DIRECTORY is empty.');
            return;
        }

        if (!is_enter_pressed) {
            this.cli.clear();
            this.cli.print('Press ENTER to load a random program.');
            this.cli.redraw();
            return;
        }

        const randomItem = model.items[Math.floor(Math.random() * model.items.length)];
        const baseIndex = randomItem[1];

        let romName = randomItem[0];
        let label = randomItem[0];

        if (randomItem[4]) {
            label = randomItem[4];
        }

        const data = model.root + model.bases[baseIndex] + randomItem[2];

        this.#load(data, romName, label);
    }

    is_enter_required() {
        return true;
    }

    async #load(filename, romName, caption) {
        this.cli.set_loading(true);
        try {
            await this.#platform_manager.loadRomFileFromUrl(filename, romName, caption);
        } catch (error) {
            this.cli.message('LOADING...', '&nbsp;', 'Error loading random file.');
        }
    }
}
