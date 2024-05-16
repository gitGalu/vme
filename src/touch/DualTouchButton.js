import { QJ_LABEL_COLOR, QJ_IDLE_COLOR, QJ_ACTIVE_COLOR } from '../Constants.js';

export class DualTouchButton {
    constructor(parent, isHorizontal, label1, label2, gridArea, id, elListener, radius = '12px', allowSimultaneous = false) {
        var container = document.createElement('div');
        container.classList.add('fast-button');
        if (gridArea != undefined) {
            container.style.gridArea = gridArea;
        }
        if (id != undefined) {
            container.id = id;
        }
        container.style.display = 'flex';
        if (!isHorizontal) {
            container.style.flexDirection = 'column';
        }
        container.style.alignItems = 'center';
        container.style.fontWeight = 'bold';
        container.style.justifyContent = 'center';
        container.style.gap = '2px';

        var el1 = document.createElement('div');
        var el2 = document.createElement('div');
        el1.style.borderRadius = radius;
        el2.style.borderRadius = radius;
        el1.style.pointerEvents = 'auto';
        el2.style.pointerEvents = 'auto';
        el1.style.color = QJ_LABEL_COLOR;
        el2.style.color = QJ_LABEL_COLOR;
        el1.style.backgroundColor = QJ_IDLE_COLOR;
        el2.style.backgroundColor = QJ_IDLE_COLOR;
        el1.style.width = '100%';
        el2.style.width = '100%';
        el1.style.height = '100%';
        el2.style.height = '100%';
        el1.style.display = 'flex';
        el1.style.justifyContent = 'center';
        el1.style.alignItems = 'center';
        el2.style.display = 'flex';
        el2.style.justifyContent = 'center';
        el2.style.alignItems = 'center';

        this.el1 = el1;
        this.el2 = el2;

        parent.appendChild(container);
        container.appendChild(el1);
        container.appendChild(el2);

        this.container = container;
        this.isHorizontal = isHorizontal;
        this.elListener = elListener;
        this.state = 0;

        this.allowSimultaneous = allowSimultaneous;
        this.simultaneousTimeout = null;

        var self = this;

        if (this.el1 != null)
            this.el1.textContent = label1;

        if (this.el2 != null)
            this.el2.textContent = label2;

        this.container.addEventListener('touchstart', function (e) {
            self.touch(e, true);
        });

        this.container.addEventListener('touchmove', function (e) {
            self.touch(e, true);
        });

        this.container.addEventListener('touchend', function (e) {
            e.preventDefault();
            self.touch(e, false);
        });
    }

    touch(e, pressed) {
        var newState = 0;

        if (pressed) {
            if (this.isHorizontal) {
                var d = this.container.offsetWidth;
                var v = e.changedTouches[0].clientX - this.container.getBoundingClientRect().left;
            } else {
                var d = this.container.offsetHeight;
                var v = e.changedTouches[0].clientY - this.container.getBoundingClientRect().top;
            }

            if (v < (d / 2)) {
                newState = 1;
            } else {
                newState = 2;
            }
        } else {
            newState = 0;
        }

        if (newState != this.state) {
            this.state = newState;
            this.elListener.trigger(this.state);

            this.el1.style.background = this.state == 1 ? QJ_ACTIVE_COLOR : QJ_IDLE_COLOR;
            this.el2.style.background = this.state == 2 ? QJ_ACTIVE_COLOR : QJ_IDLE_COLOR;
        }
    }
}
