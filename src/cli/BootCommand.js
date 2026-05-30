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
            case "amiga":
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
            case "amiga":
                this.#loadText('', 'no-media.uae', this.#getNoMediaLaunchOptions());
                break;
            case "atari800":
                this.#load('/vme/assets/boot/empty', '[BASIC].atr', this.#getNoMediaLaunchOptions());
                break;
            case "spectrum":
                this.#load('/vme/assets/boot/zx.tzx', 'zx.tzx', this.#getNoMediaLaunchOptions());
                break;
            case "c64":
            case "c128":
            case "c264":
            case "vic20":
                this.#load('/vme/assets/boot/empty', 'empty.d64', this.#getNoMediaLaunchOptions());
                break;
        }
    }

    #load(path, fileName, launchOptions = null) {
        fetch(path)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Error loading file');
                }
                return response.blob();
            })
            .then(blob => {
                this.#pm.loadLocalRom(blob, fileName, launchOptions);
            })
            .catch(error => {
                console.error('Failed to load', error);
            });
    }

    #loadText(text, fileName, launchOptions = null) {
        const blob = new Blob([text], { type: 'text/plain' });
        this.#pm.loadLocalRom(blob, fileName, launchOptions);
    }

    #getNoMediaLaunchOptions() {
        return {
            statusMessage: 'Booting without media.'
        };
    }
}
