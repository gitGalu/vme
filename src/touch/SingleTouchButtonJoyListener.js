import { TouchButtonListener  } from "./TouchButtonListener";

export class SingleTouchButtonJoyListener extends TouchButtonListener {
    #nostalgist; 

    constructor(nostalgist, input) {
        super();
        this.#nostalgist = nostalgist;
        this.input = input;
        this.trigger = this.trigger.bind(this);
    }

    trigger(s) {
        if (s) {
            this.#nostalgist.pressDown(this.input);
        } else {
            this.#nostalgist.pressUp(this.input);
        }
    }
}