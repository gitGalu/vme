// Hold-to-scroll for the Save/Collection coverflow on the keyboard. The OS key repeat can't be
// used: Flicking rejects next()/prev() while a slide animates, so most repeat events were dropped
// and holding an arrow advanced only about once a second. Instead the first press moves one card,
// and while the key stays down further moves start slow and speed up, with each slide's animation
// shortened to fit its interval.

const FIRST_PAUSE = 150;      // after the first (normal-speed) slide, before repeating
const START_INTERVAL = 300;
const MIN_INTERVAL = 110;
const ACCELERATION = 0.85;    // interval multiplier per repeated step
const MIN_DURATION = 80;

export class CarouselKeyRepeat {
    #step;
    #key = null;
    #run = 0;
    #timer = null;
    #onKeyUp = (event) => {
        if (event.key === this.#key) this.stop();
    };
    #onBlur = () => this.stop();

    /** step(direction, duration) moves one card (duration undefined = default) and returns a Promise. */
    constructor(step) {
        this.#step = step;
    }

    press(event, direction) {
        if (event.repeat) return;
        this.stop();
        this.#key = event.key;
        const run = ++this.#run;
        document.addEventListener('keyup', this.#onKeyUp);
        window.addEventListener('blur', this.#onBlur);

        this.#move(run, direction, undefined).then(() => {
            if (run !== this.#run) return;
            this.#timer = setTimeout(() => this.#repeat(run, direction, START_INTERVAL), FIRST_PAUSE);
        }, () => this.#stopRun(run));
    }

    stop() {
        this.#run++;
        this.#key = null;
        clearTimeout(this.#timer);
        this.#timer = null;
        document.removeEventListener('keyup', this.#onKeyUp);
        window.removeEventListener('blur', this.#onBlur);
    }

    #repeat(run, direction, interval) {
        if (run !== this.#run) return;
        const startedAt = performance.now();
        this.#move(run, direction, Math.max(MIN_DURATION, interval - 30)).then(() => {
            if (run !== this.#run) return;
            const wait = Math.max(0, interval - (performance.now() - startedAt));
            const next = Math.max(MIN_INTERVAL, interval * ACCELERATION);
            this.#timer = setTimeout(() => this.#repeat(run, direction, next), wait);
        }, () => this.#stopRun(run));   // edge of a non-circular list, or interrupted by a drag
    }

    #move(run, direction, duration) {
        if (run !== this.#run) return Promise.reject();
        try {
            return Promise.resolve(this.#step(direction, duration));
        } catch (e) {
            return Promise.reject(e);
        }
    }

    #stopRun(run) {
        if (run === this.#run) this.stop();
    }
}
