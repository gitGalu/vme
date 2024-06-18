import { s, addButtonEventListeners } from '../dom.js';
import { SingleTouchButton } from '../touch/SingleTouchButton.js';
import { TouchButtonListener } from '../touch/TouchButtonListener.js';
import { SingleTouchButtonJoyListener } from '../touch/SingleTouchButtonJoyListener.js';
import { SingleTouchButtonKbListener } from '../touch/SingleTouchButtonKbListener.js';
import { EnvironmentManager } from '../EnvironmentManager.js';
import { QuickJoy } from '../touch/QuickJoy.js';
import { QuickShot } from '../touch/QuickShot.js';
import { Hideaway } from '../touch/Hideaway.js';
import { JOYSTICK_TOUCH_MODE } from '../Constants.js';

export class UiManager {
    #platform_manager;
    #kb_manager;

    static #qj;
    static #qs;
    static #ha;

    static currentJoyTouchMode;
    static keyboardVisible;

    constructor(platform_manager, kb_manager) {
        this.#platform_manager = platform_manager;
        this.#kb_manager = kb_manager;
    }

    initFastUI() {
        var fastuiContainer = document.createElement('div');
        fastuiContainer.id = 'fastui';
        fastuiContainer.style.display = 'none';

        new SingleTouchButton(fastuiContainer, '<span style="font-size: 50%;">REWIND</span>', undefined, 'fastrewind', new RewindButtonListener(this.#platform_manager.getNostalgist()));
        new SingleTouchButton(fastuiContainer, '<span style="font-size: 50%;">FFD</span>', undefined, 'fastffd', new CommandButtonListener('FAST_FORWARD', this.#platform_manager.getNostalgist(), 'Fast Forward'));
        new SingleTouchButton(fastuiContainer, '<span style="font-size: 50%;">QUIT</span>', undefined, 'fastmenu', new ResetButtonListener());

        new SingleTouchButton(fastuiContainer, '<span style="font-size: 50%;">SAVE</span>', undefined, 'fastsave', new SaveButtonListener(this.#platform_manager));

        if (this.#platform_manager.getSelectedPlatform().keyboard) {
            new SingleTouchButton(fastuiContainer, '<span style="font-size: 50%;">KB</span>', undefined, 'fastkb', new KbListener(this.#kb_manager));
        }

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

        addButtonEventListeners(s('#desktopUiSave'),
            (pressed) => {

                if (pressed) {
                    let state = this.#platform_manager.saveState();
                    console.log(state);
                    state.then((data) => {
                    }).catch((error) => {
                        console.error('Error resolving state:', error);
                    });

                    self.#platform_manager.getNostalgist().sendCommand('REWIND');
                    intervalId = setInterval(() => {
                        self.#platform_manager.getNostalgist().sendCommand('REWIND');
                    }, 5);
                } else {
                    clearInterval(intervalId);
                }
            });

        addButtonEventListeners(s('#desktopUiRewind'),
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

        addButtonEventListeners(s('#desktopUiFfd'),
            (pressed) => {
                if (pressed) {

                    self.#platform_manager.getNostalgist().sendCommand('FAST_FORWARD');
                } else {
                    self.#platform_manager.getNostalgist().sendCommand('FAST_FORWARD');
                }
            });

        addButtonEventListeners(s('#desktopUiBack'),
            (pressed) => {
                location.reload();
            });
    }

    initControllerMenu() {
        new SingleTouchButton(s("#fastui"), '<span style="font-size: 50%;">JOY</span>', undefined, 'fastjoy', new class extends TouchButtonListener {
            constructor() {
                super();
            }
            trigger(s) {
                if (s) {
                    if (UiManager.keyboardVisible) {
                        UiManager.hideKeyboard();
                        UiManager.showJoystick();
                    } else {
                        if (UiManager.currentJoyTouchMode == JOYSTICK_TOUCH_MODE.QUICKJOY_PRIMARY) {
                            UiManager.toggleJoystick(JOYSTICK_TOUCH_MODE.QUICKSHOT_DYNAMIC);
                        } else if (UiManager.currentJoyTouchMode == JOYSTICK_TOUCH_MODE.QUICKSHOT_DYNAMIC) {
                            UiManager.toggleJoystick(JOYSTICK_TOUCH_MODE.HIDEAWAY);
                        } else if (UiManager.currentJoyTouchMode == JOYSTICK_TOUCH_MODE.HIDEAWAY) {
                            UiManager.toggleJoystick(JOYSTICK_TOUCH_MODE.QUICKJOY_PRIMARY);
                        }
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
            let kbKey = this.#platform_manager.getSelectedPlatform().additional_buttons[key].key;

            let listener;
            if (kbKey) {
                listener = new SingleTouchButtonKbListener(kbKey.key, kbKey.code, kbKey.keyCode);
            } else {
                listener = new SingleTouchButtonJoyListener(this.#platform_manager.getNostalgist(), keyCode);
            }
            new SingleTouchButton(container, '<span style="font-size: 50%;">' + label + '</span>', undefined, 'fast' + counter, listener);

            cell += 6;
            counter += 1;
        }
    }

    static hideJoystick() {
        if (UiManager.currentJoyTouchMode == JOYSTICK_TOUCH_MODE.HIDEAWAY) {
            this.#ha.hide();
        }
        s('#quickshots').style.display = 'none';
        s('#quickjoys').style.display = 'none';
    }

    static showJoystick() {
        if (UiManager.currentJoyTouchMode == JOYSTICK_TOUCH_MODE.QUICKSHOT_DYNAMIC) {
            s('#quickshots').style.display = 'grid';
        } else if (UiManager.currentJoyTouchMode == JOYSTICK_TOUCH_MODE.QUICKJOY_PRIMARY) {
            s('#quickjoys').style.display = 'grid';
        } else if (UiManager.currentJoyTouchMode == JOYSTICK_TOUCH_MODE.HIDEAWAY) {
        }
    }

    static hideKeyboard() {
        UiManager.keyboardVisible = false;
        s('#keyboardContainer').style.display = 'none';
    }

    static showKeyboard() {
        s('#keyboardContainer').style.display = 'block';
    }

    static toggleJoystick = (mode) => {
        if (EnvironmentManager.isDesktop() || EnvironmentManager.isQuest()) {
            return;
        }

        switch (mode) {
            case JOYSTICK_TOUCH_MODE.QUICKJOY_PRIMARY:
                UiManager.currentJoyTouchMode = JOYSTICK_TOUCH_MODE.QUICKJOY_PRIMARY;
                UiManager.osdMessage('QuickJoy', 1000);
                UiManager.#ha.hide();
                UiManager.#qs.hide();
                UiManager.#qj.mode(1);
                UiManager.#qj.show();
                break;
            case JOYSTICK_TOUCH_MODE.QUICKSHOT_DYNAMIC:
                UiManager.currentJoyTouchMode = JOYSTICK_TOUCH_MODE.QUICKSHOT_DYNAMIC;
                UiManager.osdMessage('QuickShot', 1000);
                UiManager.#qj.hide();
                UiManager.#ha.hide();
                UiManager.#qs.show();
                break;
            case JOYSTICK_TOUCH_MODE.HIDEAWAY:
                UiManager.currentJoyTouchMode = JOYSTICK_TOUCH_MODE.HIDEAWAY;
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

class SaveButtonListener extends TouchButtonListener {
    #platform_manager;

    constructor(platform_manager) {
        super();
        this.#platform_manager = platform_manager;
    }

    async trigger(s) {
        if (s) {
            this.#platform_manager.saveState();
        }
    }
}

class KbListener extends TouchButtonListener {
    #kb_manager;

    constructor(kb_manager) {
        super();
        this.#kb_manager = kb_manager;
    }

    trigger(s) {
        if (s) {
            UiManager.keyboardVisible = true;
            UiManager.hideJoystick();
            UiManager.showKeyboard();

            this.#kb_manager.showTouchKeyboard();
        }
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