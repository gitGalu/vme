import { TouchButtonListener } from './TouchButtonListener.js';

export class DualTouchButtonKbListener extends TouchButtonListener {
    #target;
    #code1;
    #key1;
    #keyCode1;
    #code2;
    #key2;
    #keyCode2;

    constructor(key1, code1, keyCode1, key2, code2, keyCode2, target = document) {
        super();
        this.#target = target;
        this.#code1 = code1;
        this.#key1 = key1;
        this.#keyCode1 = keyCode1;
        this.#code2 = code2;
        this.#key2 = key2;
        this.#keyCode2 = keyCode2;
        this.previous = 0;
        this.trigger = this.trigger.bind(this);
    }

    trigger(s) {
        if (s > 0) {
            if (s == 1) {
                this.#simulateKeyEvent(this.#key1, this.#code1, this.#keyCode1, 'keydown');
            } else {
                this.#simulateKeyEvent(this.#key2, this.#code2, this.#keyCode2, 'keydown');
            }
        }
        if (this.previous > 0) {
            if (this.previous == 1) {
                this.#simulateKeyEvent(this.#key1, this.#code1, this.#keyCode1, 'keyup');
            } else {
                this.#simulateKeyEvent(this.#key2, this.#code2, this.#keyCode2, 'keyup');
            }
        }
        this.previous = s;
    }

    updateKeyMapping(key1Data, key2Data) {
        this.#simulateKeyEvent(this.#key1, this.#code1, this.#keyCode1, 'keyup');
        this.#simulateKeyEvent(this.#key2, this.#code2, this.#keyCode2, 'keyup');
    
        ({ key: this.#key1, code: this.#code1, keyCode: this.#keyCode1 } = key1Data);
        ({ key: this.#key2, code: this.#code2, keyCode: this.#keyCode2 } = key2Data);
    }

    #simulateKeyEvent(key, code, keyCode, eventType) {
        let event = new KeyboardEvent(eventType, {
            key: key,
            code: code,
            keyCode: keyCode,
            charCode: keyCode,
            bubbles: true,
            cancelable: true
        });
    
        this.#target.dispatchEvent(event);
    }

}