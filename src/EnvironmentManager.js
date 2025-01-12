import { createGuiButton } from './GuiButton.js';
import { UiManager } from './ui/UiManager.js';
import { s, show, hide } from './dom.js';
import { isMobile, isTablet } from 'react-device-detect';

export class EnvironmentManager {
    static #deviceTypes = new Set();

    constructor() {
        EnvironmentManager.detectDevice();
        EnvironmentManager.updateDeviceType(); 
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
    }

    static forceDesktop() {
        hide('#fastui');
        show('#desktopUi', 'flex');
        if (EnvironmentManager.isDesktop()) {
            hide("#toggle-keyboard");
        } else {
            show("#toggle-keyboard");
        }
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

    static resizeCanvas = (nostalgist) => {
        const isFullscreen = document.fullscreenElement != null;
        if (isFullscreen) return;
        if (nostalgist == undefined) return;
        let w =  window.innerWidth;
        let h = window.innerHeight;
        if (w < h) h = h / 2;
        nostalgist.resize({ width: w, height: h});
    }
}
