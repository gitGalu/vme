import { s, show, hide } from '../dom.js';
import { SingleTouchButton } from "./SingleTouchButton";
import { SingleTouchButtonKbListener } from "./SingleTouchButtonKbListener";

export class Mousepad {

    #lx = -1;
    #ly = -1;
    #mouseSpeed = 1;
    #activeTouchId = null;

    constructor() {
        this.#init();
    }

    #init() {
        const bottomContainer = document.createElement('div');
        bottomContainer.id = 'mousepads';
        bottomContainer.style.position = 'fixed';
        bottomContainer.style.right = '0';
        bottomContainer.style.bottom = '0';
        bottomContainer.style.width = '100%';
        bottomContainer.style.height = '100%';
        bottomContainer.style.display = 'none';
        bottomContainer.style.zIndex = '7777';
        bottomContainer.style.pointerEvents = 'auto';
        bottomContainer.style.touchAction = 'none';

        const mousetouch = (e, started) => {
            if (started === false) {
                this.#lx = -1;
                this.#ly = -1;
                this.#activeTouchId = null;
            } else {
                var touch = e.changedTouches[0];
                var dx = touch.clientX * this.#mouseSpeed;
                var dy = touch.clientY * this.#mouseSpeed;
                if (this.#lx != -1 && this.#activeTouchId === touch.identifier) {
                    this.#simulateMouseMove(dx - this.#lx, dy - this.#ly);
                }
                this.#lx = dx;
                this.#ly = dy;
            }
        };

        bottomContainer.addEventListener('touchstart', (e) => {
            var touch = e.changedTouches[0];
            const targetId = e.target.id;

            if (!targetId || (targetId !== 'lmb' && targetId !== 'rmb')) {
                this.#activeTouchId = touch.identifier;
                mousetouch(e, true);
            } else {
                e.stopPropagation();
                e.preventDefault();
            }
        });

        bottomContainer.addEventListener('touchmove', (e) => {
            var touch = e.changedTouches[0];
            if (this.#activeTouchId !== null && this.#activeTouchId === touch.identifier) {
                mousetouch(e, true);
            }
        });

        bottomContainer.addEventListener('touchend', (e) => {
            var touch = e.changedTouches[0];
            if (this.#activeTouchId !== null && this.#activeTouchId === touch.identifier) {
                e.preventDefault();
                mousetouch(e, false);
            }
        });

        bottomContainer.addEventListener('touchcancel', (e) => mousetouch(e, false));

        new SingleTouchButton(bottomContainer, 'LMB', undefined, 'lmb', new SingleTouchButtonKbListener('F13', 'F13', '124', s('canvas')));
        new SingleTouchButton(bottomContainer, 'RMB', undefined, 'rmb', new SingleTouchButtonKbListener('F14', 'F14', '125', s('canvas')));

        document.body.appendChild(bottomContainer);

        bottomContainer.addEventListener('click', () => {
            bottomContainer.requestPointerLock();
        });

        document.addEventListener('pointerlockchange', this.#lockChangeAlert.bind(this), false);
    }

    #lockChangeAlert() {
        if (document.pointerLockElement === s('#mousepads')) {
            console.log('The pointer is now locked.');
        } else {
            console.log('The pointer is unlocked.');
        }
    }

    #simulateMouseMove(deltaX, deltaY) {
        const mouseMoveEvent = new MouseEvent('mousemove', {
            movementX: deltaX,
            movementY: deltaY,
            bubbles: true,
            cancelable: true
        });

        s('canvas').dispatchEvent(mouseMoveEvent);
    }

    show() {
        show("#mousepads", "grid");
    }

    hide() {
        hide("#mousepads");
    }
}
