import { QJ_LABEL_COLOR, QJ_IDLE_COLOR, QJ_ACTIVE_COLOR } from '../Constants.js';

export class SingleTouchButton {
    #isFastControl;

    constructor(parent, label, gridArea, id, elListener, radius = '12px') {
        this.#isFastControl = parent.id === 'fastui';
        var div = this.#createContainer(label, gridArea, id, radius);
        parent.appendChild(div);

        this.el = div;
        if (!this.#isFastControl) this.el.style.color = QJ_LABEL_COLOR;
        this.state = false;
        this.elListener = elListener;
        var self = this;

        div.addEventListener(
            'touchstart',
            function (e) {
                e.preventDefault();
                e.stopPropagation();
                self.touch(e, true);
            },
            { passive: false }
        );

        div.addEventListener(
            'touchmove',
            function (e) {
                e.preventDefault();
                e.stopPropagation();
                self.touch(e, true);
            },
            { passive: false }
        );

        div.addEventListener(
            'touchend',
            function (e) {
                e.preventDefault();
                e.stopPropagation();
                self.touch(e, false);
            },
            { passive: false }
        );

        div.addEventListener(
            'touchcancel',
            function (e) {
                e.preventDefault();
                e.stopPropagation();
                self.touch(e, false);
            },
            { passive: false }
        );
    }

    touch(e, pressed) {
        var newState = false;

        if (pressed) {
            newState = true;
        }

        if (newState != this.state) {
            this.state = newState;
            this.elListener.trigger(this.state);
            if (this.#isFastControl) this.el.classList.toggle('is-active', this.state);
            else this.el.style.background = this.state ? QJ_ACTIVE_COLOR : QJ_IDLE_COLOR;
        }
    }

    #createContainer(label, gridArea, id, radius = '12px') {
        var div = document.createElement('div');
        div.classList.add('fast-button');
        if (this.#isFastControl) div.classList.add('fast-control', 'fast-control--trigger');
        div.dataset.interactiveElement = 'true'; // Mark as interactive for touchpad detection
        this.#setContent(div, label);
        if (gridArea != undefined) {
            div.style.gridArea = gridArea;
        }
        if (id != undefined) {
            div.id = id;
        }
        if (!this.#isFastControl) {
            div.style.backgroundColor = QJ_IDLE_COLOR;
            div.style.color = 'white';
            div.style.fontWeight = 'bold';
        }
        div.style.borderRadius = radius;
        div.style.display = 'flex';
        div.style.alignItems = 'center';
        div.style.justifyContent = 'center';
        div.style.pointerEvents = 'auto';
        div.style.touchAction = 'none';
        return div;
    }

    setLabel(label) {
        this.#setContent(this.el, label);
    }

    #setContent(element, label) {
        element.innerHTML = label;
        if (this.#isFastControl) {
            element.querySelectorAll('span').forEach(span => span.style.removeProperty('font-size'));
        }
    }
}
