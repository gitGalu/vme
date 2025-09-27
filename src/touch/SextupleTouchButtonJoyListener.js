import { TouchButtonListener } from './TouchButtonListener.js';

export class SextupleTouchButtonJoyListener extends TouchButtonListener {
    #nostalgist;

    constructor(nostalgist, input1, input2, input3, input4, input5, input6) {
        super();
        this.#nostalgist = nostalgist;
        this.input1 = input1;
        this.input2 = input2;
        this.input3 = input3;
        this.input4 = input4;
        this.input5 = input5;
        this.input6 = input6;
        this.previous = 0;
        this.trigger = this.trigger.bind(this);
    }

    trigger(s) {
        if (s > 0) {
            this.#nostalgist.pressDown(
                s === 1 ? this.input1 : (s === 2 ? this.input2 : (s === 3 ? this.input3 : 
                (s === 4 ? this.input4 : (s === 5 ? this.input5 : this.input6))))
            );
        }
        if (this.previous > 0) {
            this.#nostalgist.pressUp(
                this.previous === 1 ? this.input1 : (this.previous === 2 ? this.input2 : 
                (this.previous === 3 ? this.input3 : (this.previous === 4 ? this.input4 : 
                (this.previous === 5 ? this.input5 : this.input6))))
            );
        }
        this.previous = s;
    }
}