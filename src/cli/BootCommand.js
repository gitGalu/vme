import { CommandBase } from './CommandBase.js';

export class BootCommand extends CommandBase {
    #pm;

    constructor(platform_manager) {
        super();
        this.#pm = platform_manager;
    }

    get_keywords() {
        return ['nmb'];
    }

    get_help() {
        return ['nmb', 'boot without media'];
    }

    process_input(input, is_enter_pressed) {
        if (!is_enter_pressed) {
            this.#print(this.#pm.getSelectedPlatform());
        } else {
            this.#boot(this.#pm.getSelectedPlatform());
        }
    }

    #print(platform) {
        switch (platform.platform_id) {
            case "atari800":
            case "spectrum":
            case "c64":
            case "c128":
            case "c264":
            case "vic20":
                this.cli.print("Press ENTER to boot the machine without media inserted.");
                break;
            default:
                this.cli.print("This platform does not support the BOOT command.");
        }
        this.cli.redraw();
    }

    async #boot(platform) {
        switch (platform.platform_id) {
            case "atari800":
                this.#load('/vme/assets/boot/empty', '[BASIC].atr');
                break;
            case "spectrum":
                this.#load('/vme/assets/boot/zx.tzx', 'zx.tzx');
                break;
            case "c64":
            case "c128":
            case "c264":
            case "vic20":
                this.#load('/vme/assets/boot/empty', 'empty.d64');
                break;
        }
    }

    #load(path, fileName) {
        fetch(path)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Error loading file');
                }
                return response.blob();
            })
            .then(blob => {
                this.#pm.loadLocalRom(blob, fileName);
            })
            .catch(error => {
                console.error('Failed to load', error);
            });
    }
}