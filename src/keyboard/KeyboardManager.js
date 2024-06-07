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

export class KeyboardManager {
    #mode;
    #layer;
    #cli;
    #audioContextInitialized = false;
    audioContext;
    audioBuffers = {}; 


    static State = {
        OFF: 0, ON: 1
    };

    static Mode = {
        STRIP: 0, QWERTY: 1
    };

    static Layer = {
        A: 0, B: 1
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

        this.#initTouchKeyboard();
        this.#initHiddenInputs();

        createGuiButton('toggle-keyboard', 'Keyboard', 'kb', () => {
            this.initAudioContext();
            this.toggleTouchKeyboard();
        });
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

                document.querySelectorAll('.layerA').forEach(function (el) {
                    el.style.visibility = 'visible';
                });

                document.querySelectorAll('.nostrip').forEach(function (el) {
                    el.style.display = 'block';
                });
            }
        });

        document.querySelector('#kbCtrlClear').addEventListener('click', (e) => {
            this.#cli.reset();
        });

        document.querySelector('#kbCtrlCross').addEventListener('click', (e) => {
            this.hideTouchKeyboard();
        });

        document.querySelector('#keyToggle').addEventListener('click', (e) => {
            if (this.#layer == KeyboardManager.Layer.A) {
                this.#layer = KeyboardManager.Layer.B;
                document.querySelectorAll('.layerA').forEach(function (el) {
                    el.style.visibility = 'hidden';
                });
                document.querySelectorAll('.layerB').forEach(function (el) {
                    el.style.visibility = 'visible';
                });
            } else if (this.#layer == KeyboardManager.Layer.B) {
                this.#layer = KeyboardManager.Layer.A;
                document.querySelectorAll('.layerB').forEach(function (el) {
                    el.style.visibility = 'hidden';
                });
                document.querySelectorAll('.layerA').forEach(function (el) {
                    el.style.visibility = 'visible';
                });
            }
        });

        document.querySelector('#keyboard').addEventListener('click', (e) => {
            const target = e.target;
            if (target.classList.contains('key')) {
                const keyValue = target.getAttribute('data-value');
                const keyCode = target.getAttribute('data-code');
                this.playSound(keyCode);
                this.#cli.process_input(keyValue);
            }
        });
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
        s("div#keyboardContainer").style.display = "none";

        if (!this.keysDown[e.code]) {
            this.keysDown[e.code] = true;
            this.playSound(e.code);
        }
    }

    keyupHandler(e) {
        this.keysDown[e.code] = false;
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

    showTouchKeyboard() {
        s('#keyboardContainer').classList.add('visible');
    }

    hideTouchKeyboard() {
        s('#keyboardContainer').classList.remove('visible');
    }
}