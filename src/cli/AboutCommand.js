import { CommandBase } from './CommandBase.js';
import { EnvironmentManager } from '../EnvironmentManager.js';

export class AboutCommand extends CommandBase {
    #pm;

    constructor(platform_manager) {
        super();
        this.#pm = platform_manager;
    }

    get_keywords() {
        return ['about'];
    }

    get_help() {
        return ['about', 'show VM/E information'];
    }

    process_input(input) {
        this.#print();
    }

    #print_info(usage, quota) {
        this.cli.print("&nbsp;")
        this.cli.print("Environment");
        this.cli.print("------------");

        let mobile = EnvironmentManager.isSmartphone();
        let tablet = EnvironmentManager.isTablet();
        let quest = EnvironmentManager.isQuest();
        let gamepad = EnvironmentManager.hasGamepad();
        let installed = EnvironmentManager.isStandalone();

        this.cli.print("&nbsp;[" + (installed ? "x" : " ") + "] Installed");
        this.cli.print("&nbsp;[" + (mobile ? "x" : " ") + "] Smartphone");
        this.cli.print("&nbsp;[" + (tablet ? "x" : " ") + "] Tablet");
        this.cli.print("&nbsp;[" + (quest ? "x" : " ") + "] Meta Quest Browser");
        this.cli.print("&nbsp;[" + (gamepad ? "x" : " ") + "] Gamepad / Joystick");

        this.cli.print("&nbsp;");
        this.cli.print("Emulated systems");
        this.cli.print("---------------");
        this.#pm.checkDependencies();

        this.cli.redraw();
    }

    #print() {
        this.cli.print('Virtual Machine / Emulator');
        this.cli.print('Prerelease');
        this.cli.print('<div id="flip-image-outer"><div id="flip-image-container"></div></div>');
        this.cli.print('Developed by Michal Galinski');
        this.cli.print("&nbsp;")
        this.cli.print('Built using Nostalgist.js and Libretro.');
        this.cli.print("&nbsp;")
        this.cli.print('Click to <a href="https://github.com/gitGalu/VME">Visit Project Website</a>');
        this.cli.print("&nbsp;")
        this.cli.print('Click to <a href="https://github.com/gitGalu/vme/blob/main/CHANGES.md">View Changelog</a>');
        this.cli.print("&nbsp;")
        this.#print_info();
    }
}