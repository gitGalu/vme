import { QJ_LABEL_COLOR, QJ_IDLE_COLOR, QJ_ACTIVE_COLOR } from '../Constants.js';

export class QuadrupleTouchButton {
    constructor(parent, label1, label2, label3, label4, gridArea, id, elListener, radius = '12px', allowSimultaneous = false) {
        var container = document.createElement('div');
        container.classList.add('fast-button');
        if (gridArea != undefined) {
            container.style.gridArea = gridArea;
        }
        if (id != undefined) {
            container.id = id;
        }
        container.style.display = 'grid';
        container.style.gridTemplateColumns = '1fr 1fr';
        container.style.gridTemplateRows = '1fr 3fr';
        container.style.gap = '8px';

        var el1 = document.createElement('div');
        var el2 = document.createElement('div');
        var el3 = document.createElement('div');
        var el4 = document.createElement('div');
        el1.style.borderRadius = radius;
        el2.style.borderRadius = radius;
        el3.style.borderRadius = radius;
        el4.style.borderRadius = radius;
        el1.style.pointerEvents = 'auto';
        el2.style.pointerEvents = 'auto';
        el3.style.pointerEvents = 'auto';
        el4.style.pointerEvents = 'auto';
        el1.style.color = QJ_LABEL_COLOR;
        el2.style.color = QJ_LABEL_COLOR;
        el3.style.color = QJ_LABEL_COLOR;
        el4.style.color = QJ_LABEL_COLOR;
        el1.style.backgroundColor = QJ_IDLE_COLOR;
        el2.style.backgroundColor = QJ_IDLE_COLOR;
        el3.style.backgroundColor = QJ_IDLE_COLOR;
        el4.style.backgroundColor = QJ_IDLE_COLOR;

        const d = '100%';
        el1.style.width = d;
        el2.style.width = d;
        el3.style.width = d; 
        el4.style.width = d;
        el1.style.height = d;
        el2.style.height = d;
        el3.style.height = d;
        el4.style.height = d;

        [el1, el2, el3, el4].forEach(el => {
            el.style.display = 'flex';
            el.style.justifyContent = 'center';
            el.style.alignItems = 'center';
        });

        parent.appendChild(container);
        container.appendChild(el1);
        container.appendChild(el2);
        container.appendChild(el3);
        container.appendChild(el4);

        this.container = container;
        this.elListener = elListener;
        this.state = 0;
        this.allowSimultaneous = allowSimultaneous;
        this.simultaneousTimeout = null;

        this.el1 = el1;
        this.el2 = el2;
        this.el3 = el3;
        this.el4 = el4;

        el1.textContent = label1;
        el2.textContent = label2;
        el3.textContent = label3;
        el4.textContent = label4;

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
            d = this.container.offsetWidth;
            var dHeight = this.container.offsetHeight;
            var vX = e.changedTouches[0].clientX - this.container.getBoundingClientRect().left;
            var vY = e.changedTouches[0].clientY - this.container.getBoundingClientRect().top;

            if (vX < d / 2 && vY < dHeight / 4) {
                newState = 1;
            } else if (vX >= d / 2 && vY < dHeight / 4) {
                newState = 2;
            } else if (vX < d / 2 && vY >= dHeight / 4) {
                newState = 3;
            } else {
                newState = 4;
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
            this.el4.style.background = this.state === 4 ? QJ_ACTIVE_COLOR : QJ_IDLE_COLOR;
        }
    }
}