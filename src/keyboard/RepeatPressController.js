const REPEAT_DELAY_MS = 400;
const REPEAT_INTERVAL_MS = 70;

// One held CLI control at a time; emulator keys keep their own press/release handling.
export class RepeatPressController {
    #enabled;
    #held = null;
    #cleanup = [];

    constructor(enabled) {
        this.#enabled = enabled;
        this.#listen(window, 'mouseup', () => {
            if (this.#held?.touchId === null) this.cancel();
        }, true);
        for (const type of ['touchend', 'touchcancel']) {
            this.#listen(window, type, event => {
                if ([...event.changedTouches].some(touch => touch.identifier === this.#held?.touchId)) this.cancel();
            }, { capture: true, passive: true });
        }
        for (const type of ['mousemove', 'touchmove']) {
            this.#listen(window, type, event => this.#move(event), { capture: true, passive: true });
        }
        this.#listen(window, 'blur', () => this.cancel());
        this.#listen(document, 'visibilitychange', () => {
            if (document.hidden) this.cancel();
        });
    }

    #listen(target, type, handler, options) {
        target.addEventListener(type, handler, options);
        this.#cleanup.push(() => target.removeEventListener(type, handler, options));
    }

    bind(element, action) {
        if (!element) return;
        const press = event => {
            if (!this.#enabled() || (event.type === 'mousedown' && event.button !== 0)) return;
            event.preventDefault();
            event.stopPropagation();
            this.cancel();
            const held = {
                element, action, timer: null,
                touchId: event.type === 'touchstart' ? event.changedTouches[0].identifier : null
            };
            this.#held = held;
            element.classList.add('active');
            action();
            if (this.#held === held) {
                held.timer = setTimeout(() => this.#repeat(held), REPEAT_DELAY_MS);
            }
        };
        this.#listen(element, 'touchstart', press, { passive: false });
        this.#listen(element, 'mousedown', press);
        this.#listen(element, 'click', event => {
            if (!this.#enabled()) return;
            event.preventDefault();
            event.stopPropagation();
            // Physical clicks already acted on press; retain programmatic/gamepad clicks.
            if (event.detail === 0) {
                this.cancel();
                action();
            }
        });
    }

    #repeat(held) {
        if (this.#held !== held) return;
        if (!this.#enabled() || !held.element.isConnected) {
            this.cancel();
            return;
        }
        held.action();
        if (this.#held === held) {
            held.timer = setTimeout(() => this.#repeat(held), REPEAT_INTERVAL_MS);
        }
    }

    #move(event) {
        const held = this.#held;
        if (!held) return;
        const point = event.type === 'touchmove'
            ? [...event.touches].find(touch => touch.identifier === held.touchId)
            : held.touchId === null ? event : null;
        if (!point) return;
        const rect = held.element.getBoundingClientRect();
        if (point.clientX < rect.left || point.clientX > rect.right
            || point.clientY < rect.top || point.clientY > rect.bottom) this.cancel();
    }

    cancel() {
        if (!this.#held) return;
        clearTimeout(this.#held.timer);
        this.#held.element.classList.remove('active');
        this.#held = null;
    }

    destroy() {
        this.cancel();
        this.#cleanup.forEach(remove => remove());
        this.#cleanup = [];
    }
}
