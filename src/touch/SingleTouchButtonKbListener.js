import { TouchButtonListener  } from "./TouchButtonListener";

export class SingleTouchButtonKbListener extends TouchButtonListener {

    constructor(key, code, keyCode) {
        super();
        this.key = key;
        this.code = code;
        this.keyCode = keyCode;
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
            key: this.key,
            code: this.code,
            keyCode: this.keyCode,
            charCode: this.keyCode,
            bubbles: true,
            cancelable: true
        });
    
        document.dispatchEvent(event);
    }

    #simulateKeyup() {
        let event = new KeyboardEvent('keyup', {
            key: this.key,
            code: this.code,
            keyCode: this.keyCode,
            charCode: this.keyCode,
            bubbles: true,
            cancelable: true
        });
    
        document.dispatchEvent(event);
    }
}