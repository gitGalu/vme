import { TouchButtonListener } from "./TouchButtonListener";

export class SingleTouchMouseButtonListener extends TouchButtonListener {
    #target;
    #button;
    #buttonsMask;

    constructor(target = document, button = 0) {
        super();
        this.#target = target;
        this.#button = button;
        this.#buttonsMask = button === 2 ? 2 : 1;
        this.trigger = this.trigger.bind(this);
    }

    trigger(pressed) {
        const type = pressed ? 'mousedown' : 'mouseup';
        const event = new MouseEvent(type, {
            button: this.#button,
            buttons: pressed ? this.#buttonsMask : 0,
            bubbles: true,
            cancelable: true
        });

        this.#target.dispatchEvent(event);
    }
}
