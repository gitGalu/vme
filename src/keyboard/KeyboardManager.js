import { s } from '../dom.js';
import { createGuiButton } from '../GuiButton.js';
import Kb1Sound from '../assets/audio/gui_type1.mp3';
import Kb2Sound from '../assets/audio/gui_type2.mp3';
import Kb3Sound from '../assets/audio/gui_type3.mp3';
import Kb4Sound from '../assets/audio/gui_type4.mp3';
import Kb5Sound from '../assets/audio/gui_type5.mp3';
import Kb6Sound from '../assets/audio/gui_type6.mp3';
import Kb7Sound from '../assets/audio/gui_type7.mp3';
import Kb8Sound from '../assets/audio/gui_type8.mp3';
import { EnvironmentManager } from '../EnvironmentManager.js';
import { StorageManager } from '../storage/StorageManager.js';
import { VME } from '../VME.js';
import { UiManager } from '../ui/UiManager.js';

export class KeyboardManager {
    #mode;
    #layer;
    #cli;
    #audioContextInitialized = false;
    #mute
    audioContext;
    audioBuffers = {};

    #handleCliInputBound;
    #handleEmulationInputBound;
    #handleEmulationSpecialBound;

    static State = {
        OFF: 0, ON: 1
    };

    static Mode = {
        STRIP: 0, QWERTY: 1
    };

    static Layer = {
        A: 0, B: 1, C: 2
    };

    constructor(cli) {
        this.#cli = cli;
        this.keysDown = {};
        this.audioFiles = {
            'gui_type1': Kb1Sound,
            'gui_type2': Kb2Sound,
            'gui_type3': Kb3Sound,
            'gui_type4': Kb4Sound,
            'gui_type5': Kb5Sound,
            'gui_type6': Kb6Sound,
            'gui_type7': Kb7Sound,
            'gui_type8': Kb8Sound,
        };
        this.audioMap = {
            'Digit1': 'gui_type4',
            'Digit2': 'gui_type5',
            'Digit3': 'gui_type6',
            'Digit4': 'gui_type7',
            'Digit5': 'gui_type8',
            'Digit6': 'gui_type1',
            'Digit7': 'gui_type4',
            'Digit8': 'gui_type5',
            'Digit9': 'gui_type6',
            'Digit0': 'gui_type7',
            'KeyA': 'gui_type1',
            'KeyB': 'gui_type6',
            'KeyC': 'gui_type4',
            'KeyD': 'gui_type5',
            'KeyE': 'gui_type5',
            'KeyF': 'gui_type6',
            'KeyG': 'gui_type7',
            'KeyH': 'gui_type8',
            'KeyI': 'gui_type4',
            'KeyJ': 'gui_type1',
            'KeyK': 'gui_type4',
            'KeyL': 'gui_type5',
            'KeyM': 'gui_type8',
            'KeyN': 'gui_type7',
            'KeyO': 'gui_type5',
            'KeyP': 'gui_type6',
            'KeyQ': 'gui_type1',
            'KeyR': 'gui_type6',
            'KeyS': 'gui_type4',
            'KeyT': 'gui_type7',
            'KeyU': 'gui_type1',
            'KeyW': 'gui_type4',
            'KeyV': 'gui_type5',
            'KeyX': 'gui_type1',
            'KeyY': 'gui_type8',
            'KeyZ': 'gui_type8',
            'Space': 'gui_type1',
            'Enter': 'gui_type3',
            'Escape': 'gui_type2',
            'Backquote': 'gui_type1',
            'Minus': 'gui_type1',
            'Equal': 'gui_type4',
            'Backspace': 'gui_type2',
            'Tab': 'gui_type2',
            'CapsLock': 'gui_type3',
            'BracketLeft': 'gui_type7',
            'BracketRight': 'gui_type8',
            'Backslash': 'gui_type1',
            'Semicolon': 'gui_type6',
            'Quote': 'gui_type7',
            'Comma': 'gui_type1',
            'Period': 'gui_type4',
            'Slash': 'gui_type5',
            'ArrowUp': 'gui_type1',
            'ArrowLeft': 'gui_type4',
            'ArrowRight': 'gui_type6',
            'ArrowDown': 'gui_type5',

            'Shift': 'gui_type3',
        };
        this.initAudioContext();
        this.#mode = KeyboardManager.Mode.QWERTY;
        this.keydownHandlerBound = this.keydownHandler.bind(this);
        this.keyupHandlerBound = this.keyupHandler.bind(this);

        this.#handleCliInputBound = this.#handleCliInput.bind(this);
        this.#handleEmulationInputBound = this.#handleEmulationInput.bind(this);
        this.#handleEmulationSpecialBound = this.#handleEmulationSpecial.bind(this);

        this.#initTouchKeyboard();
        this.#initHiddenInputs();

        const elements = document.querySelectorAll('.kbCtrl');
        elements.forEach(element => {
            element.style.paddingTop = '0px';
        });
    }

    initButtons() {
        createGuiButton('toggle-keyboard', 'Show Keyboard', 'Kb', () => {
            this.initAudioContext();
            setTimeout(() => {
                this.showTouchKeyboard();
            }, 50);
        }, true, ".xx", "settings");
    }

    clicks_on() {
        document.addEventListener('keydown', this.keydownHandlerBound);
        document.addEventListener('keyup', this.keyupHandlerBound);
    }

    clicks_off() {
        document.removeEventListener('keydown', this.keydownHandlerBound);
        document.removeEventListener('keyup', this.keyupHandlerBound);
    }

    initAudioContext() {
        if (!this.#audioContextInitialized) {
            try {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                this.loadAllAudioFiles();
                this.#audioContextInitialized = true;
            } catch (error) {
                console.error("Failed to initialize AudioContext:", error);
            }
        }
    }

    async loadAllAudioFiles() {
        const audioDataPromises = Object.entries(this.audioFiles).map(([key, url]) =>
            fetch(url)
                .then(response => response.arrayBuffer())
                .then(arrayBuffer => this.audioContext.decodeAudioData(arrayBuffer))
                .then(audioBuffer => {
                    this.audioBuffers[key] = audioBuffer;
                })
                .catch(error => console.error(`Error loading audio file ${key}:`, error))
        );

        await Promise.all(audioDataPromises);
    }

    playSound(key) {
        if (this.#mute) return;
        if (!this.audioContext) {
            console.error("AudioContext is not initialized.");
            return;
        }

        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume().then(() => {
                this.playSoundHelper(key);
            }).catch(error => {
                console.error("Error resuming AudioContext:", error);
            });
        } else {
            this.playSoundHelper(key);
        }
    }

    playSoundHelper(key) {
        const soundName = this.audioMap[key];
        const audioBuffer = this.audioBuffers[soundName];
        if (audioBuffer) {
            const source = this.audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(this.audioContext.destination);
            source.start(0);
        }
    }

    #initTouchKeyboard() {
        this.#layer = KeyboardManager.Layer.A;

        document.querySelector('#kbCtrlArrow').addEventListener('click', (e) => {
            if (this.#mode == KeyboardManager.Mode.QWERTY) {
                this.#mode = KeyboardManager.Mode.STRIP;
                s('#keyboard').classList.remove('keyboardQwerty');
                s('#keyboard').classList.add('keyboardStrip');
                s('#kbCtrlArrow').innerHTML = '&#x25B3;';

                document.querySelectorAll('.layerA').forEach(function (el) {
                    el.style.visibility = 'visible';
                });
                document.querySelectorAll('.layerB').forEach(function (el) {
                    el.style.visibility = 'visible';
                });
                document.querySelectorAll('.layerC').forEach(function (el) {
                    el.style.visibility = 'visible';
                });

                document.querySelectorAll('.nostrip').forEach(function (el) {
                    el.style.display = 'none';
                });
            } else if (this.#mode == KeyboardManager.Mode.STRIP) {
                this.#mode = KeyboardManager.Mode.QWERTY;
                s('#keyboard').classList.remove('keyboardStrip');
                s('#keyboard').classList.add('keyboardQwerty');
                s('#kbCtrlArrow').innerHTML = '&#x25BD;';

                this.#layer = KeyboardManager.Layer.A;
                document.querySelectorAll('.layerB').forEach(function (el) {
                    el.style.visibility = 'hidden';
                });
                document.querySelectorAll('.layerC').forEach(function (el) {
                    el.style.visibility = 'hidden';
                });
                document.querySelectorAll('.layerA').forEach(function (el) {
                    el.style.visibility = 'visible';
                });

                document.querySelectorAll('.nostrip').forEach(function (el) {
                    el.style.display = 'block';
                });
            }
        });

        document.querySelector('#kbCtrlClear').addEventListener('click', (e) => {
            if (!this.#cli.is_loading()) {
                this.#cli.reset();
            }
        });

        document.querySelector('#kbCtrlCross').addEventListener('click', (e) => {
            this.hideTouchKeyboard();
        });

        document.querySelector('#keyShift').addEventListener('click', (e) => {
            if (this.#layer == KeyboardManager.Layer.A) {
                //todo caps
            } else if (this.#layer == KeyboardManager.Layer.B) {
                this.#layer = KeyboardManager.Layer.C;
                document.querySelectorAll('.layerB').forEach(function (el) {
                    el.style.visibility = 'hidden';
                });
                document.querySelectorAll('.layerC').forEach(function (el) {
                    el.style.visibility = 'visible';
                });
            } else if (this.#layer == KeyboardManager.Layer.C) {
                this.#layer = KeyboardManager.Layer.B;
                document.querySelectorAll('.layerC').forEach(function (el) {
                    el.style.visibility = 'hidden';
                });
                document.querySelectorAll('.layerB').forEach(function (el) {
                    el.style.visibility = 'visible';
                });
            }
        });

        document.querySelector('#keyToggle').addEventListener('click', (e) => {
            if (this.#layer == KeyboardManager.Layer.A) {
                document.querySelector('#keyShift').innerHTML = 'MORE';
                this.#layer = KeyboardManager.Layer.B;
                document.querySelectorAll('.layerA').forEach(function (el) {
                    el.style.visibility = 'hidden';
                });
                document.querySelectorAll('.layerC').forEach(function (el) {
                    el.style.visibility = 'hidden';
                });
                document.querySelectorAll('.layerB').forEach(function (el) {
                    el.style.visibility = 'visible';
                });
            } else if (this.#layer == KeyboardManager.Layer.B) {
                this.#layer = KeyboardManager.Layer.A;
                document.querySelector('#keyShift').innerHTML = 'CAPS';
                document.querySelectorAll('.layerB').forEach(function (el) {
                    el.style.visibility = 'hidden';
                });
                document.querySelectorAll('.layerC').forEach(function (el) {
                    el.style.visibility = 'hidden';
                });
                document.querySelectorAll('.layerA').forEach(function (el) {
                    el.style.visibility = 'visible';
                });
            }
        });


        document.querySelectorAll('.key').forEach(function (el) {
            el.addEventListener('touchstart', function () {
                el.classList.add('active');
            });

            el.addEventListener('touchend', function () {
                el.classList.remove('active');
            });

            el.addEventListener('touchcancel', function () {
                el.classList.remove('active');
            });
        });
    }

    #handleCliInput(e) {
        const target = e.target;
        if (target.classList.contains('key')) {
            const keyValue = target.getAttribute('data-value');
            const keyCode = target.getAttribute('data-code');
            this.playSound(keyCode);
            if (!this.#cli.is_loading()) {
                this.#cli.process_input(keyValue);
            }
        }
    }

    #handleEmulationSpecial(e) {
        const type = e.type;

        if (type == "touchstart") {
            this.#simulateKeyEvent('Escape', 'Escape', 'keydown');
        } else if (type == "touchend") {
            this.#simulateKeyEvent('Escape', 'Escape', 'keyup');
        }
    }

    #handleEmulationInput(e) {
        const type = e.type;
        const target = e.target;
        const key = target.getAttribute('data-value');
        const code = target.getAttribute('data-code');
        const shift = target.getAttribute('data-shift');

        if (shift) {
            if (type == "touchstart") {
                this.#simulateKeyEvent('Shift', 'ShiftRight', 'keydown', { keyCode: 16, which: 16, shiftKey: true, location: 2 });
                this.#simulateKeyEvent(key, code, 'keydown', { shiftKey: true, location: 2 });
            } else if (type == "touchend") {
                this.#simulateKeyEvent('Shift', 'ShiftRight', 'keyup', { keyCode: 16, which: 16, shiftKey: true, location: 2 });
                this.#simulateKeyEvent(key, code, 'keyup', { shiftKey: true, location: 2 });
            }
        } else {
            if (type == "touchstart") {
                this.#simulateKeyEvent(key, code, 'keydown');
            } else if (type == "touchend") {
                this.#simulateKeyEvent(key, code, 'keyup');
            }
        }
    }

    #initHiddenInputs() {
        let self = this;
        document.getElementById('cors_hidden_input').addEventListener('input', function (event) {
            var customDiv = document.getElementById('cors_query');
            customDiv.textContent = this.value;
            self.#cli.parse_hidden_input();
        });
    }

    keydownHandler(e) {
        if (EnvironmentManager.isDesktop()) {
            s("div#keyboardContainer").style.display = "none";
        }

        if (!this.keysDown[e.code]) {
            this.keysDown[e.code] = true;
            this.playSound(e.code);
        }
    }

    keyupHandler(e) {
        this.keysDown[e.code] = false;
    }

    updateMode(mode) {
        switch (mode) {
            case VME.CURRENT_SCREEN.MENU:
                this.#mute = false;
                document.querySelector('#keyboard').addEventListener('click', this.#handleCliInputBound);
                break;
            case VME.CURRENT_SCREEN.EMULATION:
                this.#mute = true;
                document.querySelector('#keyboard').removeEventListener('click', this.#handleCliInputBound);
                document.querySelector('#keyboard').addEventListener('touchstart', this.#handleEmulationInputBound);
                document.querySelector('#keyboard').addEventListener('touchend', this.#handleEmulationInputBound);

                document.querySelector('#kbCtrlClear').addEventListener('touchstart', this.#handleEmulationSpecialBound);
                document.querySelector('#kbCtrlClear').addEventListener('touchend', this.#handleEmulationSpecialBound);

                break;
        }
    }

    toggleTouchKeyboard() {
        let element = s('#keyboardContainer');
        let isVisible = element.classList.contains('visible');
        if (isVisible) {
            this.hideTouchKeyboard();
        } else {
            if ((StorageManager.getValue("SYSKB") == "1") || EnvironmentManager.isQuest()) {
                document.getElementById('cors_hidden_input').focus();
            } else {
                this.showTouchKeyboard();
            }
        }
    }

    #simulateKeyEvent(key, code, type, options = {}) {
        const event = new KeyboardEvent(type, {
            key: key,
            code: code,
            keyCode: options.keyCode || key.charCodeAt(0),
            which: options.which || key.charCodeAt(0),
            shiftKey: options.shiftKey || false,
            location: options.location || 0,
            bubbles: true,
            cancelable: true
        });
        document.dispatchEvent(event);
    }

    showTouchKeyboard() {
        const btn = document.querySelector('#toggle-keyboard');
        btn.style.visibility = "hidden";

        const elements = document.querySelectorAll('.kbCtrl');
        elements.forEach(element => {
            element.style.paddingTop = '6px';
        });

        s('#keyboardContainer').classList.add('visible');
    }

    hideTouchKeyboard() {
        UiManager.keyboardVisible = false;
        UiManager.showJoystick();
        const elements = document.querySelectorAll('.kbCtrl');
        elements.forEach(element => {
            element.style.paddingTop = '0px';
        });

        s('#keyboardContainer').classList.remove('visible');

        const btn = document.querySelector('#toggle-keyboard');
        btn.style.visibility = "visible";
    }
}