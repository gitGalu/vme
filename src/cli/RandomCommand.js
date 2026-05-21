import { CommandBase } from './CommandBase.js';
import { s } from '../dom.js';

export class RandomCommand extends CommandBase {

    #platform_manager;
    #currentItem = null;

    constructor(platform_manager) {
        super();
        this.#platform_manager = platform_manager;
    }

    get_keywords() {
        return ['rnd'];
    }

    get_help() {
        return ['rnd', 'roll a random program; arrows reroll, OK loads'];
    }

    process_input(parameters, is_enter_pressed) {
        const model = this.#platform_manager.get_software_dir();
        if (model == undefined) {
            this.cli.soft_msg('To use RND command please import SOFTWARE DIRECTORY first.');
            this.#currentItem = null;
            return;
        }

        if (!Array.isArray(model.items) || model.items.length === 0) {
            this.cli.soft_msg('The current SOFTWARE DIRECTORY is empty.');
            this.#currentItem = null;
            return;
        }

        if (!is_enter_pressed) {
            this.cli.clear();
            this.cli.print('Press ENTER to roll a random program.');
            this.cli.redraw();
            this.#currentItem = null;
            return;
        }

        this.#rollAndShow(model);
    }

    is_enter_required() {
        return true;
    }

    is_selection_enabled() {
        return true;
    }

    exit_selection() {
        return true;
    }

    handle_navigation(direction) {
        const model = this.#platform_manager.get_software_dir();
        if (!model || !Array.isArray(model.items) || model.items.length === 0) return false;
        if (!this.#currentItem) return false;
        this.#rollAndShow(model);
        return true;
    }

    async process_selection(item) {
        this.cli.set_loading(true);
        try {
            await this.#platform_manager.loadRomFileFromUrl(item.data, item.romName, item.label);
        } catch (error) {
            this.cli.message('LOADING...', '&nbsp;', 'Error loading random file.');
        }
    }

    selection_changed(item) {
    }

    #rollAndShow(model) {
        const raw = model.items[Math.floor(Math.random() * model.items.length)];
        const baseIndex = raw[1];
        const tag = model.tags ? model.tags[baseIndex] : null;
        const romName = raw[0];
        const label = raw[4] || raw[0];
        const data = model.root + model.bases[baseIndex] + raw[2];

        const item = {
            id: data,
            romName,
            label,
            tag,
            data
        };
        this.#currentItem = item;
        this.show_results([item], true);
        this.cli.set_selection_index(0);
        this.cli.update();
        this.#prependHint();
    }

    #prependHint() {
        const container = s('#cors_results');
        if (!container) return;
        const hint = document.createElement('p');
        hint.classList.add('rnd-hint');
        hint.innerHTML = 'Use &uarr;/&darr; to roll again, ENTER to load.<br>&nbsp;';
        container.prepend(hint);
    }
}
