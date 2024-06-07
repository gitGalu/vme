import { CommandBase } from './CommandBase.js';

export class RestoreCommand extends CommandBase {
    #save_browser;

    constructor(save_browser) {
        super();
        this.#save_browser = save_browser;
    }

    get_keywords() {
        return ['r'];
    }

    get_help() {
        return ['r', 'open save browser'];
    }

    process_input(input, is_enter_pressed) {
        this.cli.clear();
        this.cli.print("Press ENTER to open Save Browser.");
        if (!is_enter_pressed) {
            return;
        } else {
            this.#save_browser.open();
        }
    }
}