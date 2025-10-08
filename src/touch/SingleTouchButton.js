import { QJ_LABEL_COLOR, QJ_IDLE_COLOR, QJ_ACTIVE_COLOR } from '../Constants.js';

export class SingleTouchButton {
    constructor(parent, label, gridArea, id, elListener, radius = '12px') {
        var div = this.#createContainer(label, gridArea, id, radius);
        parent.appendChild(div);

        this.el = div;
        this.el.style.color = QJ_LABEL_COLOR;
        this.state = false;
        this.elListener = elListener;
        var self = this;

        div.addEventListener('touchstart', function (e) {
            self.touch(e, true);
        });

        div.addEventListener('touchmove', function (e) {
            self.touch(e, true);
        });

        div.addEventListener('touchend', function (e) {
            self.touch(e, false);
        });
    }

    touch(e, pressed) {
        var newState = false;

        if (pressed) {
            newState = true;
        }

        if (newState != this.state) {
            this.state = newState;
            this.elListener.trigger(this.state);
            this.el.style.background = this.state ? QJ_ACTIVE_COLOR : QJ_IDLE_COLOR;
        }
    }

    #createContainer(label, gridArea, id, radius = '12px') {
        var div = document.createElement('div');
        div.classList.add('fast-button');
        div.dataset.interactiveElement = 'true'; // Mark as interactive for touchpad detection
        div.innerHTML = label;
        if (gridArea != undefined) {
            div.style.gridArea = gridArea;
        }
        if (id != undefined) {
            div.id = id;
        }
        div.style.backgroundColor = QJ_IDLE_COLOR
        div.style.borderRadius = radius;
        div.style.display = 'flex';
        div.style.alignItems = 'center';
        div.style.color = 'white';
        div.style.fontWeight = 'bold';
        div.style.justifyContent = 'center';
        div.style.pointerEvents = 'auto';
        return div;
    }

    setLabel(label) {
        this.el.innerHTML = label;
    }
}