import { CommandBase } from "./CommandBase";
import { StorageManager } from "../storage/StorageManager";

export class LastCommand extends CommandBase {
    #platform_manager;

    constructor(platform_manager) {
        super();
        this.#platform_manager = platform_manager;
    }

    get_keywords() {
        return ['l'];
    }

    get_help() {
        return ['l', 're-launch last program for the selected platform'];
    }

    process_input(input, is_enter_pressed) {
        let jsonString = StorageManager.getValue(this.#platform_manager.getSelectedPlatform().platform_id + ".LAST_FILE", undefined);
        if (jsonString == undefined) {
        } else {
            const data = JSON.parse(jsonString);
            this.cli.print("Press ENTER to load:");
            this.cli.print("&nbsp;");
            this.cli.print("<p style='margin-left: 1ch;'>" + data.caption);
            if (!is_enter_pressed) {
                return;
            }
            this.#load(data.filename, data.caption);
        }
    }

    #load(filename, caption) {
        this.cli.set_loading(true);
        this.#platform_manager.loadRomFileFromUrl(filename, caption);
    }

}