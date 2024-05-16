import { s, show, hide } from '../dom.js';

export class Hideaway {
    static timeoutId;

    constructor() {
    }

    #reappear(event) {
        event.preventDefault();
        clearTimeout(Hideaway.timeoutId);
        show("#fastui", "grid");

        Hideaway.timeoutId = setTimeout(() => {
            hide("#fastui");
        }, 2000);
    }

    show() {
        hide("#fastui");
        document.addEventListener('click', this.#reappear);
        document.addEventListener('touchstart', this.#reappear);
        clearTimeout(Hideaway.timeoutId);
    }

    hide() {
        clearTimeout(Hideaway.timeoutId);
        document.removeEventListener('click', this.#reappear);
        document.removeEventListener('touchstart', this.#reappear);
        show("#fastui", "grid");
    }
}