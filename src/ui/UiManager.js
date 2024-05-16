import { s, show, hide } from '../dom.js';
import { SingleTouchButton } from '../touch/SingleTouchButton.js';
import { TouchButtonListener } from '../touch/TouchButtonListener.js';
import { SingleTouchButtonJoyListener } from '../touch/SingleTouchButtonJoyListener.js';
import { DualTouchButton } from '../touch/DualTouchButton.js';
import { DualTouchButtonJoyListener } from '../touch/DualTouchButtonJoyListener.js';
import { VME } from '../VME.js';
import { EnvironmentManager } from '../EnvironmentManager.js';
import { QuickJoy } from '../touch/QuickJoy.js';
import { QuickShot } from '../touch/QuickShot.js';
import { Hideaway } from '../touch/Hideaway.js';


export class UiManager {
    #platform_manager;
    #vme;

    static #qj;
    static #qs;
    static #ha;

    static currentJoyTouchMode;

    constructor(vme, platform_manager) {
        this.#vme = vme;
        this.#platform_manager = platform_manager;
    }

    initFastUI() {
        var fastuiContainer = document.createElement('div');
        fastuiContainer.id = 'fastui';
        fastuiContainer.style.display = 'none';

        new SingleTouchButton(fastuiContainer, '<span style="font-size: 50%;">REWIND</span>', undefined, 'fastrewind', new RewindButtonListener(this.#platform_manager.getNostalgist()));
        new SingleTouchButton(fastuiContainer, '<span style="font-size: 50%;">FFD</span>', undefined, 'fastffd', new CommandButtonListener('FAST_FORWARD', this.#platform_manager.getNostalgist(), 'Fast Forward'));
        new SingleTouchButton(fastuiContainer, '<span style="font-size: 50%;">MENU</span>', undefined, 'fastmenu', new ResetButtonListener());

        this.#placeItems(fastuiContainer);

        var fastuiMsg = document.createElement('div');
        fastuiMsg.id = 'fastui-msg';
        fastuiMsg.style.display = 'none';
        fastuiContainer.appendChild(fastuiMsg);

        document.body.appendChild(fastuiContainer);
    }

    initDesktopUI() {
        const desktopUi = document.getElementById('desktopUi');
        let timeout;

        function addMouseMoveListenerToCanvas(observer) {

            desktopUi.addEventListener('mousemove', function () {
                desktopUi.classList.add('visible');
                clearTimeout(timeout);
            });

            desktopUi.addEventListener('mouseleave', function () {
                timeout = setTimeout(function () {
                    desktopUi.classList.remove('visible');
                }, 1000);
            });
        }

        function checkNodeForCanvas(node, observer) {
            if (node.nodeName === 'CANVAS') {
                addMouseMoveListenerToCanvas(observer);
                return true;
            }
            if (node.querySelector && node.querySelector('canvas')) {
                addMouseMoveListenerToCanvas(observer);
                return true;
            }
            return false;
        }

        const observer = new MutationObserver(function (mutations) {
            for (const mutation of mutations) {
                if (mutation.addedNodes && mutation.addedNodes.length > 0) {
                    for (const node of mutation.addedNodes) {
                        if (checkNodeForCanvas(node, observer)) {
                            return;
                        }
                    }
                }
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });

        addMouseMoveListenerToCanvas(observer);




        let intervalId = null;
        let self = this;

        this.addButtonEventListeners(s('#desktopUiRewind'),
            (pressed) => {
                if (pressed) {
                    self.#platform_manager.getNostalgist().sendCommand('REWIND');
                    intervalId = setInterval(() => {
                        self.#platform_manager.getNostalgist().sendCommand('REWIND');
                    }, 5);
                } else {
                    clearInterval(intervalId);
                }
            });

        this.addButtonEventListeners(s('#desktopUiFfd'),
            (pressed) => {
                console.log('pizd');
                if (pressed) {

                    self.#platform_manager.getNostalgist().sendCommand('FAST_FORWARD');
                } else {
                    self.#platform_manager.getNostalgist().sendCommand('FAST_FORWARD');
                }
            });

        this.addButtonEventListeners(s('#desktopUiBack'),
            (pressed) => {
                location.reload();
            });
    }


    addButtonEventListeners(button, handleAction) {
        let isPressed = false;

        const handleEvent = (pressed) => {
            console.log(pressed);
            handleAction(pressed);
        };

        button.addEventListener('mousedown', () => {
            isPressed = true;
            handleEvent(true);
        });
        button.addEventListener('mouseup', () => {
            if (isPressed) {
                handleEvent(false);
                isPressed = false;
            }
        });
        button.addEventListener('mouseleave', () => {
            if (isPressed) {
                handleEvent(false);
                isPressed = false;
            }
        });
    }

    initControllerMenu() {
        new SingleTouchButton(s("#fastui"), '<span style="font-size: 50%;">JOY</span>', undefined, 'fastjoy', new class extends TouchButtonListener {
            constructor() {
                super();
            }
            trigger(s) {
                if (s) {
                    if (UiManager.currentJoyTouchMode == VME.JOYSTICK_TOUCH_MODE.QUICKJOY_PRIMARY) {
                        UiManager.toggleJoystick(VME.JOYSTICK_TOUCH_MODE.QUICKSHOT_DYNAMIC);
                    } else if (UiManager.currentJoyTouchMode == VME.JOYSTICK_TOUCH_MODE.QUICKSHOT_DYNAMIC) {
                        UiManager.toggleJoystick(VME.JOYSTICK_TOUCH_MODE.HIDEAWAY);
                    } else if (UiManager.currentJoyTouchMode == VME.JOYSTICK_TOUCH_MODE.HIDEAWAY) {
                        UiManager.toggleJoystick(VME.JOYSTICK_TOUCH_MODE.QUICKJOY_PRIMARY);
                    }
                }
            }
        });
    }

    initQuickJoy() {
        UiManager.#qj = new QuickJoy(this.#platform_manager);
    }

    initQuickshot() {
        UiManager.#qs = new QuickShot(this.#platform_manager);
    }

    initHideaway() {
        UiManager.#ha = new Hideaway();
    }

    #placeItems(container) {
        let cell = 3;
        let counter = 1;

        let keys = Object.keys(this.#platform_manager.getSelectedPlatform().additional_buttons);
        keys.reverse();
        for (let i = 0; i < keys.length; i++) {
            let key = keys[i];
            let label = this.#platform_manager.getSelectedPlatform().additional_buttons[key].label;
            let keyCode = this.#platform_manager.getSelectedPlatform().additional_buttons[key].keyCode;
            new SingleTouchButton(container, '<span style="font-size: 50%;">' + label + '</span>', undefined, 'fast' + counter, new SingleTouchButtonJoyListener(this.#platform_manager.getNostalgist(), keyCode));
            cell += 6;
            counter += 1;
        }
    }

    static toggleJoystick = (mode) => {
        if (EnvironmentManager.isDesktop()) {
            return;
        }

        switch (mode) {
            case VME.JOYSTICK_TOUCH_MODE.QUICKJOY_PRIMARY:
                UiManager.currentJoyTouchMode = VME.JOYSTICK_TOUCH_MODE.QUICKJOY_PRIMARY;
                UiManager.osdMessage('QuickJoy', 1000);
                UiManager.#ha.hide();
                UiManager.#qs.hide();
                UiManager.#qj.mode(1);
                UiManager.#qj.show();
                break;
            case VME.JOYSTICK_TOUCH_MODE.QUICKSHOT_DYNAMIC:
                UiManager.currentJoyTouchMode = VME.JOYSTICK_TOUCH_MODE.QUICKSHOT_DYNAMIC;
                UiManager.osdMessage('QuickShot', 1000);
                UiManager.#qj.hide();
                UiManager.#ha.hide();
                UiManager.#qs.show();
                break;
            case VME.JOYSTICK_TOUCH_MODE.HIDEAWAY:
                UiManager.currentJoyTouchMode = VME.JOYSTICK_TOUCH_MODE.HIDEAWAY;
                UiManager.osdMessage('Auto Hide', 1000);
                UiManager.#qj.hide();
                UiManager.#qs.hide();
                UiManager.#ha.show();
                break;
        }
    }

    static osdMessage(message, timeInMs = null) {
        const msgDiv = document.getElementById('fastui-msg');

        function fadeOut() {
            msgDiv.style.opacity = '0';
            setTimeout(() => msgDiv.style.display = 'none', 250);
        }

        if (msgDiv.fadeOutTimeout) {
            clearTimeout(msgDiv.fadeOutTimeout);
            msgDiv.fadeOutTimeout = null;
        }

        if (message === null) {
            fadeOut();
            return;
        }

        msgDiv.textContent = message;
        msgDiv.style.display = 'grid';
        setTimeout(() => msgDiv.style.opacity = '1', 0);

        if (timeInMs !== null) {
            msgDiv.fadeOutTimeout = setTimeout(() => {
                fadeOut();
                msgDiv.fadeOutTimeout = null;
            }, timeInMs);
        }
    }
}

class RewindButtonListener extends TouchButtonListener {
    #nostalgist;
    #intervalId;
    static #command = 'REWIND';

    constructor(nostalgist) {
        super();
        this.#nostalgist = nostalgist;
    }

    trigger(s) {
        if (s) {
            this.#nostalgist.sendCommand(RewindButtonListener.#command);
            this.#intervalId = setInterval(() => {
                this.#nostalgist.sendCommand(RewindButtonListener.#command);
            }, 5);
        } else {
            clearInterval(this.#intervalId);
        }
    }
}

class CommandButtonListener extends TouchButtonListener {
    #command;
    #nostalgist;

    constructor(command, nostalgist, message) {
        super();
        this.#command = command;
        this.#nostalgist = nostalgist;
        this.message = message;
    }

    trigger(s) {
        this.#nostalgist.sendCommand(this.#command);
    }
}

class ResetButtonListener extends TouchButtonListener {
    constructor() {
        super();
    }

    trigger(s) {
        if (s) {
            location.reload();
        }
    }
}

class SizeButtonListener extends TouchButtonListener {
    constructor() {
        super();
        this.clicked = false;
    }

    trigger(s) {
        if (!s) {
            this.clicked = false;
            return;
        }

        if (!this.clicked) {
            this.clicked = true;
            var el = document.querySelector('#emulator');

            if (this.screenSize == VME.SCREEN_SIZE.SMALLER) {
                el.classList.remove("smaller");
                el.classList.add("bigger");
                this.screenSize = VME.SCREEN_SIZE.BIGGER;
            } else if (this.screenSize == VME.SCREEN_SIZE.BIGGER) {
                el.classList.remove("bigger");
                el.classList.add("smaller");
                this.screenSize = VME.SCREEN_SIZE.SMALLER;
            }
        }
    }
}
