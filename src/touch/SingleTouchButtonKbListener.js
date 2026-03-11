import { TouchButtonListener  } from "./TouchButtonListener";
import {
    dispatchSyntheticKeyboardEvent,
    getSyntheticKeyboardTarget
} from '../keyboard/SyntheticKeyboard.js';

export class SingleTouchButtonKbListener extends TouchButtonListener {
    #target;
    #key;
    #code;
    #keyCode;
    #shiftKey;
    #ctrlKey;
    #altKey;
    #metaKey;

    constructor(key, code, keyCode, target = getSyntheticKeyboardTarget(document), modifiers = {}) {
        super();
        this.#key = key;
        this.#code = code;
        this.#keyCode = keyCode;
        this.#target = target;
        this.#shiftKey = modifiers.shiftKey ?? false;
        this.#ctrlKey = modifiers.ctrlKey ?? false;
        this.#altKey = modifiers.altKey ?? false;
        this.#metaKey = modifiers.metaKey ?? false;
        this.trigger = this.trigger.bind(this);
    }

    trigger(s) {
        if (s) {
            this.#simulateKeydown();
        } else {
            this.#simulateKeyup();
        }
    }

    updateKeyMapping({ key, code, keyCode }) {
        this.#simulateKeyup();
    
        this.#key = key;
        this.#code = code;
        this.#keyCode = keyCode;
    }

    #simulateKeydown() {
        dispatchSyntheticKeyboardEvent('keydown', {
            key: this.#key,
            code: this.#code,
            keyCode: this.#keyCode,
            shiftKey: this.#shiftKey,
            ctrlKey: this.#ctrlKey,
            altKey: this.#altKey,
            metaKey: this.#metaKey,
            target: this.#target
        });
    }

    #simulateKeyup() {
        dispatchSyntheticKeyboardEvent('keyup', {
            key: this.#key,
            code: this.#code,
            keyCode: this.#keyCode,
            shiftKey: this.#shiftKey,
            ctrlKey: this.#ctrlKey,
            altKey: this.#altKey,
            metaKey: this.#metaKey,
            target: this.#target
        });
    }
}
