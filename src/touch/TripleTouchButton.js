import { QJ_LABEL_COLOR, QJ_IDLE_COLOR, QJ_ACTIVE_COLOR } from '../Constants.js';

export class TripleTouchButton {
    constructor(parent, isHorizontal, label1, label2, label3, gridArea, id, elListener, radius = '12px', allowSimultaneous = false) {
        var container = document.createElement('div');
        container.classList.add('fast-button');
        if (gridArea != undefined) {
            container.style.gridArea = gridArea;
        }
        if (id != undefined) {
            container.id = id;
        }
        container.style.display = 'flex';
        container.style.flexDirection = isHorizontal ? 'row' : 'column';
        container.style.alignItems = 'center';
        container.style.justifyContent = 'center';
        container.style.gap = '8px';

        var el1 = document.createElement('div');
        var el2 = document.createElement('div');
        var el3 = document.createElement('div');
        el1.style.borderRadius = radius;
        el2.style.borderRadius = radius;
        el3.style.borderRadius = radius;
        el1.style.pointerEvents = 'auto';
        el2.style.pointerEvents = 'auto';
        el3.style.pointerEvents = 'auto';
        el1.style.color = QJ_LABEL_COLOR;
        el2.style.color = QJ_LABEL_COLOR;
        el3.style.color = QJ_LABEL_COLOR;
        el1.style.backgroundColor = QJ_IDLE_COLOR;
        el2.style.backgroundColor = QJ_IDLE_COLOR;
        el3.style.backgroundColor = QJ_IDLE_COLOR;
        el1.style.width = '100%';
        el2.style.width = '100%';
        el3.style.width = '100%';
        el1.style.height = '100%';
        el2.style.height = '100%';
        el3.style.height = '100%';

        if (isHorizontal) {
            el1.style.transform = 'translateY(50px)';
            el2.style.transform = 'translateY(25px)';
            el3.style.transform = 'translateY(0px)';
        }

        [el1, el2, el3].forEach(el => {
            el.style.display = 'flex';
            el.style.justifyContent = 'center';
            el.style.alignItems = 'center';
            el.style.height = '100%';
        });

        parent.appendChild(container);
        container.appendChild(el1);
        container.appendChild(el2);
        container.appendChild(el3);

        this.container = container;
        this.isHorizontal = isHorizontal;
        this.elListener = elListener;
        this.state = 0;
        this.allowSimultaneous = allowSimultaneous;
        this.simultaneousTimeout = null;

        this.el1 = el1;
        this.el2 = el2;
        this.el3 = el3;

        el1.textContent = label1;
        el2.textContent = label2;
        el3.textContent = label3;

        container.addEventListener('touchstart', e => this.touch(e, true));
        container.addEventListener('touchmove', e => this.touch(e, true));
        container.addEventListener('touchend', e => {
            e.preventDefault();
            this.touch(e, false);
        });
    }

    touch(e, pressed) {
        var newState = 0;
        var d, v;

        if (pressed) {
            if (this.isHorizontal) {
                d = this.container.offsetWidth;
                v = e.changedTouches[0].clientX - this.container.getBoundingClientRect().left;
            } else {
                d = this.container.offsetHeight;
                v = e.changedTouches[0].clientY - this.container.getBoundingClientRect().top;
            }

            const segment = d / 3;
            if (v < segment) {
                newState = 1;
            } else if (v < segment * 2) {
                newState = 2;
            } else {
                newState = 3;
            }
        } else {
            newState = 0;
        }

        if (newState !== this.state) {
            this.state = newState;
            this.elListener.trigger(this.state);
            this.el1.style.background = this.state === 1 ? QJ_ACTIVE_COLOR : QJ_IDLE_COLOR;
            this.el2.style.background = this.state === 2 ? QJ_ACTIVE_COLOR : QJ_IDLE_COLOR;
            this.el3.style.background = this.state === 3 ? QJ_ACTIVE_COLOR : QJ_IDLE_COLOR;
        }
    }
}