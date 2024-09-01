import { CommandBase } from './CommandBase.js';
import { StorageManager } from '../storage/StorageManager.js';
import { Debug } from '../Debug.js';

export class SetCommand extends CommandBase {
    #SYSTEM_PARAMETERS = {
        SHADER: {
            validValues: ["0", "1"],
            description: "enable CRT/LCD screen effect"
        },
        LINES: {
            validValues: ["SINGLE", "MULTI"],
            description: "single or multi line results"
        },
        SYSKB: {
            validValues: ["0", "1"],
            description: "use system touchscreen keyboard"
        },
        DEBUG: {
            validValues: ["0", "1"],
            description: "enable debug information",
            onChange: (newValue) => {
                Debug.setVisible(newValue == 1);
            }
        }
    };

    get_keywords() {
        return ['set'];
    }

    get_help() {
        return ['set [PARAM] [VALUE]', 'configure system parameter'];
    }

    process_input(tokens, is_enter_pressed) {
        if (!tokens.length) {
            this.cli.print("Configure system parameter:");
            this.cli.print("&nbsp;");
            Object.entries(this.#SYSTEM_PARAMETERS).sort(([key1], [key2]) => key1.localeCompare(key2)).forEach(([key, item]) => {
                this.#print_command(key, item);
            });
            return;
        }

        const key = tokens[0].toUpperCase();
        const item = this.#SYSTEM_PARAMETERS[key];
        const value = tokens[1];

        if (item != undefined) {
            this.#print_command(key, item);
            this.cli.print("Enter new value and press ENTER.");
            this.cli.print("Enter DEFAULT as a value to reset.");
        }

        if (is_enter_pressed) {
            if (tokens.length == 2) {
                if (this.#SYSTEM_PARAMETERS.hasOwnProperty(key)) {
                    const paramDetails = this.#SYSTEM_PARAMETERS[key];

                    if (value.toUpperCase() == "DEFAULT") {
                        StorageManager.clearValue(key, value);
                        this.cli.clear();
                        this.#print_command(key, item);
                        this.cli.print("Default value restored.");

                        if (paramDetails.onChange && typeof paramDetails.onChange === "function") {
                            paramDetails.onChange(value);
                        }

                    } else if (paramDetails.validValues.includes(value.toUpperCase())) {
                        StorageManager.storeValue(key, value);
                        this.cli.clear();
                        this.#print_command(key, item);
                        this.cli.print("Configuration has been saved.");

                        if (paramDetails.onChange && typeof paramDetails.onChange === "function") {
                            paramDetails.onChange(value);
                        }
                    } else {
                        this.cli.print("&nbsp;");
                        this.cli.print("Invalid value.");
                    }
                } else {
                    this.cli.print("&nbsp;")
                    this.cli.print("Invalid parameter.")
                }
            }
        }
    }

    #print_command(key, item) {
        let value = StorageManager.getValue(key.toUpperCase());
        let current = "";
        if (value != undefined) {
            current = "&nbsp;=&nbsp;" + value.toUpperCase();
        }
        this.cli.print("<p style='margin-left: 1ch;'>" + key.toUpperCase() + current + "</p>");
        this.cli.print("<p style='margin-left: 2ch;'>" + item.description + "</p>");
        this.cli.print("<p style='margin-left: 2ch;'>(&nbsp;" + item.validValues.join(" | ") + "&nbsp;)" + "</p>");
        this.cli.print("&nbsp;");
    }

    is_selection_enabled() {
        return false;
    }

    is_enter_required() {
        return false;
    }
}