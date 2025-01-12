import { CommandBase } from './CommandBase.js';

export class ClearallCommand extends CommandBase {
    #confirmation_code;

    constructor() {
        super();
    }

    get_keywords() {
        return ['clearall'];
    }

    get_help() {
        return ['clearall', 'completely resets the VM/E system by wiping all settings and saved data.'];
    }

    process_input(input, is_enter_pressed) {
        let arg = input.join().toUpperCase();

        if (!is_enter_pressed) {
            if (arg.startsWith("ACKNOWLEDGED") && (this.#confirmation_code != undefined)) {
                this.#show_final_confirmation();
                return;
            } else {
                this.#confirmation_code = null;
                this.cli.clear();
                this.cli.print("Type CLEARALL ACKNOWLEDGED and press ENTER to wipe all the data.");
            }
        } else {
            if (arg == ("ACKNOWLEDGED," + this.#confirmation_code)) {
                this.cli.clear();
                this.cli.print("Wiping all data...");
                setTimeout(() => {
                    this.#nuke();
                }, 500);
            } else if (arg == "ACKNOWLEDGED") {
                this.#confirmation_code = this.#get_random_code();
                this.#show_final_confirmation();
            } else {
                this.#confirmation_code = null;
                this.cli.clear();
                this.cli.print("Type CLEARALL ACKNOWLEDGED and press ENTER to nuke all the data.");
            }
        }
    }

    #get_random_code() {
        return Math.floor(1000 + Math.random() * 9000);
    }

    #show_final_confirmation() {
        this.cli.clear();
        this.cli.print("This action will permanently erase all saved data.");
        this.cli.print("&nbsp;");
        this.cli.print("If you are absolutely sure, type:");
        this.cli.print("&nbsp;");
        this.cli.print("&nbsp;CLEARALL ACKNOWLEDGED " + this.#confirmation_code);
        this.cli.print("&nbsp;");
        this.cli.print("and press ENTER to proceed.");
        this.cli.print("&nbsp;");
        this.cli.print("There is no undo.");
    }

    #nuke() {
        localStorage.clear();
        indexedDB.deleteDatabase('VME');
        
        this.cli.print("&nbsp;");
        this.cli.print("All data wiped.");

        setTimeout(() => {
            window.location.reload();
        }, 500);
    }
}