import { TouchButtonListener  } from "./TouchButtonListener";

export class SingleTouchButtonKbListener extends TouchButtonListener {
    #target;
    #key;
    #code;
    #keyCode;

    constructor(key, code, keyCode, target = document) {
        super();
        this.#key = key;
        this.#code = code;
        this.#keyCode = keyCode;
        this.#target = target;
        this.trigger = this.trigger.bind(this);
    }

    trigger(s) {
        if (s) {
            this.#simulateKeydown();
        } else {
            this.#simulateKeyup();
        }
    }

    #simulateKeydown() {
        let event = new KeyboardEvent('keydown', {
            key: this.#key,
            code: this.#code,
            keyCode: this.#keyCode,
            charCode: this.#keyCode,
            bubbles: true,
            cancelable: true
        });
    
        this.#target.dispatchEvent(event);
    }

    #simulateKeyup() {
        let event = new KeyboardEvent('keyup', {
            key: this.#key,
            code: this.#code,
            keyCode: this.#keyCode,
            charCode: this.#keyCode,
            bubbles: true,
            cancelable: true
        });
    
        this.#target.dispatchEvent(event);
    }
}