import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { createGuiButton } from './GuiButton.js';
import { EnvironmentManager } from './EnvironmentManager.js';

export class ButtonManager {
    #cli;

    constructor(cli) {
        this.#cli = cli;
    }

    addButtons() {
        this.addSystemButton();
        this.addHelpButton();
        this.addSaveBrowserButton();
        this.addCollectionButton();
        this.addFsButton();
        this.addAboutButton();
        this.addTourButton();
    }

    addSystemButton() {
        createGuiButton('menu-item-system', 'S', 'S', () => {
            this.#cli.inject('sys ');
        });
    }

    addHelpButton() {
        createGuiButton('menu-item-help', 'H', 'H', () => {
            this.#cli.inject('help');
        });
    }

    addSaveBrowserButton() {
        createGuiButton('menu-item-savestates', 'R', 'R', () => {
            this.#cli.inject('r', true);
        });
    }

    addCollectionButton() {
        createGuiButton('menu-item-compilations', 'C', 'C', () => {
            this.#cli.inject('c', true);
        });
    }

    addAboutButton() {
        createGuiButton('menu-item-about', 'A', 'A', () => {
            this.#cli.inject('about');
        });
    }

    addFsButton() {
        if (EnvironmentManager.isQuest()) {
            createGuiButton('full-screen', 'Fullscreen', 'Fs', () => {
                let element = document.documentElement;

                const requestFullscreen = () => {
                    if (element.requestFullscreen) {
                        element.requestFullscreen();
                    } else if (element.mozRequestFullScreen) {
                        element.mozRequestFullScreen();
                    } else if (element.webkitRequestFullscreen) {
                        element.webkitRequestFullscreen();
                    } else if (element.msRequestFullscreen) {
                        element.msRequestFullscreen();
                    }
                };

                const exitFullscreen = () => {
                    if (document.exitFullscreen) {
                        document.exitFullscreen();
                    } else if (document.mozCancelFullScreen) {
                        document.mozCancelFullScreen();
                    } else if (document.webkitExitFullscreen) {
                        document.webkitExitFullscreen();
                    } else if (document.msExitFullscreen) {
                        document.msExitFullscreen();
                    }
                };

                if (!document.fullscreenElement && !document.mozFullScreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement) {
                    requestFullscreen();
                } else {
                    exitFullscreen();
                }
            });
        }
    }

    addTourButton() {
        createGuiButton('menu-item-tour', '?', '?', () => {
            const steps = [];
            steps.push({ element: '#menu-item-system', popover: { title: 'Switch platforms', description: '<p>Click here to display the list of available emulated platforms.</p>', side: "right", align: 'start' } });
            steps.push({ element: '#menu-item-help', popover: { title: 'List available commands', description: '<p>Click here to show the list of available CLI commands.</p><p>Some commands require confirmation by pressing ENTER, while others update the results automatically as you type.</p>', side: "right", align: 'start' } });
            steps.push({ element: '#menu-item-savestates', popover: { title: 'Open Save Browser', description: '<p>Click here to browse and load save states.</p>', side: "right", align: 'start' } });
            if (document.querySelector('#full-screen')) {
                steps.push({ element: '#full-screen', popover: { title: 'Toggle fullscreen', description: '<p>Click here to toggle fullscreen mode on and off.</p>', side: "right", align: 'start' } });
            }
            if (document.querySelector('#full-screen')) {
                steps.push({ element: '#toggle-keyboard', popover: { title: 'Toggle on-screen keyboard', description: '<p>Click here to show the on-screen keyboard.</p>', side: "right", align: 'start' } });
            }
            steps.push({ element: '#menu-item-compilations', popover: { title: 'Open Compilations Browser', description: '<p>Click here to browse software compilations.</p>', side: "right", align: 'start' } });
            steps.push({ element: '#menu-item-about', popover: { title: 'About VM/E', description: '<p>Click here to display the "About VM/E" information, including credits and licensing details.</p>', side: "right", align: 'start' } });
            steps.push({ element: '#cors_interface', popover: { title: 'VM/E CLI Shell', description: '<p>Use the VM/E shell by entering CLI commands or performing search queries.</p><p>If you have imported a software list for the current platform, you can start typing the name of the file you are looking for. After entering a few characters, you will see a list of files that match your search query.</p>', side: "right", align: 'start' } });

            const driverObj = driver({
                animate: false,
                showProgress: false,
                overlayOpacity: "0.66",
                stagePadding: 10,
                smoothScroll: false,
                steps: steps
            });

            driverObj.drive();
        });
    }
}