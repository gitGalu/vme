import { TouchButtonListener } from './TouchButtonListener.js';

export class DualTouchButtonJoyListener extends TouchButtonListener {
    #nostalgist;

    constructor(nostalgist, input1, input2) {
        super();
        this.#nostalgist = nostalgist;
        this.input1 = input1;
        this.input2 = input2;
        this.previous = 0;
        this.trigger = this.trigger.bind(this);
    }

    trigger(s) {
        if (s > 0) {
            this.#nostalgist.pressDown(s == 1 ? this.input1 : this.input2);
        }
        if (this.previous > 0) {
            this.#nostalgist.pressUp(this.previous == 1 ? this.input1 : this.input2);
        }
        this.previous = s;
    }
}