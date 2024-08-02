import { CommandBase } from './CommandBase.js';

export class BrowseCommand extends CommandBase {
    #collection_browser;

    constructor(collection_browser) {
        super();
        this.#collection_browser = collection_browser;
    }

    get_keywords() {
        return ['c'];
    }

    get_help() {
        return ['c', 'open compilations browser'];
    }

    process_input(input, is_enter_pressed) {
        this.cli.clear();
        this.cli.print("Press ENTER to open Compilations Browser.");
        if (!is_enter_pressed) {
            return;
        } else {
            this.#collection_browser.open();
        }
    }
}