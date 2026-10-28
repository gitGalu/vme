// Auto Hide: no on-screen controls; a tap shows the fast UI for a moment.
// Hiding is done with body classes rather than the inline display style, so other code
// re-showing #fastui (e.g. EnvironmentManager.forceTouch on resize/rotation) cannot undo it.
const AUTOHIDE_CLASS = 'fastui-autohide';
const PEEK_CLASS = 'fastui-peek';

export class Hideaway {
    static timeoutId;

    constructor() {
    }

    #reappear(event) {
        event.preventDefault();
        clearTimeout(Hideaway.timeoutId);
        document.body.classList.add(PEEK_CLASS);

        Hideaway.timeoutId = setTimeout(() => {
            document.body.classList.remove(PEEK_CLASS);
        }, 2000);
    }

    show() {
        clearTimeout(Hideaway.timeoutId);
        document.body.classList.remove(PEEK_CLASS);
        document.body.classList.add(AUTOHIDE_CLASS);
        document.addEventListener('click', this.#reappear);
        document.addEventListener('touchstart', this.#reappear);
    }

    hide() {
        clearTimeout(Hideaway.timeoutId);
        document.removeEventListener('click', this.#reappear);
        document.removeEventListener('touchstart', this.#reappear);
        document.body.classList.remove(AUTOHIDE_CLASS, PEEK_CLASS);
    }
}
