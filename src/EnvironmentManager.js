import { createGuiButton } from './GuiButton.js';
import { UiManager } from './ui/UiManager.js';
import { s, show, hide } from './dom.js';
import { isMobile, isTablet } from 'react-device-detect';

export class EnvironmentManager {
    static #container = document.getElementById('menu-button-strip');
    static #deviceTypes = new Set();

    constructor() {
        EnvironmentManager.detectDevice();
        EnvironmentManager.updateDeviceType(); 

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

        document.querySelectorAll('.clabel').forEach(label => {
            label.dataset.originalText = label.textContent;
        });
    }

    static updateDeviceType() {
        if (EnvironmentManager.isDesktop() || EnvironmentManager.isQuest()) {
            EnvironmentManager.forceDesktop();
        } else if (EnvironmentManager.hasTouch()) {
            EnvironmentManager.forceTouch();
        }
    }

    static isDesktop() {
        let result = ((EnvironmentManager.#deviceTypes.has('desktop') && (EnvironmentManager.#deviceTypes.has('keyboard') && !(EnvironmentManager.#deviceTypes.has('touch')))));
        return result;
    }

    static isNotPortrait() {
        return window.innerWidth > window.innerHeight;
    }

    static hasGamepad() {
        return navigator.getGamepads ? Array.from(navigator.getGamepads()).some(g => g !== null) : false;
    }

    static isMobile() {
        return isMobile;
    }

    static isSmartphone() {
        return isMobile && !isTablet;
    }

    static isTablet() {
        return isTablet;
    }

    static isStandalone() {
        return (window.navigator.standalone) || window.matchMedia('(display-mode: standalone)').matches;
    }

    static isQuest() {
        var ua = navigator.userAgent;

        if (ua.includes('OculusBrowser') || ua.includes('Quest')) {
            return true;
        }

        return false;
    }

    static hasTouch() {
        let result = (EnvironmentManager.#deviceTypes.has('touch'));
        return result;
    }

    static forceTouch() {
        hide('#desktopUi');
        show('#fastui', 'grid');
        UiManager.toggleJoystick(); //todo
    }

    static forceDesktop() {
        hide('#fastui');
        show('#desktopUi', 'flex');
        if (EnvironmentManager.isDesktop()) {
            hide("#toggle-keyboard");
        } else {
            show("#toggle-keyboard");
        }
        UiManager.toggleJoystick(); //todo
    }

    static isGamepadConnected() {
        const gamepads = navigator.getGamepads();
        for (const gamepad of gamepads) {
            if (gamepad) {
                return true;
            }
        }
        return false;
    }

    static detectDevice() {
        if ('ontouchstart' in window) {
            EnvironmentManager.#deviceTypes.add('touch');
        } else {
            EnvironmentManager.#deviceTypes.add('desktop');
        }
        if ('onkeydown' in window) {
            EnvironmentManager.#deviceTypes.add('keyboard');
        }
        if (EnvironmentManager.isGamepadConnected()) {
            EnvironmentManager.#deviceTypes.add('gamepad');
        }

        EnvironmentManager.updateDeviceType();
    }

    static ellipsizeLabels = (theme) => {
        let scale = 1;

        if (theme["--width"] == "double") {
            scale = 2;
        }

        let labels = document.querySelectorAll('.clabel');

        labels.forEach(label => {
            label.innerHTML = label.dataset.originalText;
        });

        let totalWidth = 0;
        labels.forEach(label => {
            totalWidth += label.offsetWidth;
            const style = window.getComputedStyle(label);
            totalWidth += parseFloat(style.marginLeft) + parseFloat(style.marginRight);
        });

        if (totalWidth > EnvironmentManager.#container.offsetWidth / scale) {
            labels.forEach(label => {
                label.innerHTML = "&nbsp;" + label.dataset.shortcut + "&nbsp;";
            });
        }
    }

    static resizeCanvas = (nostalgist) => {
        if (nostalgist == undefined) return;
        let w =  window.innerWidth;
        let h = window.innerHeight;
        if (w < h) h = h / 2;
        nostalgist.resize({ width: w, height: h});
    }
}
