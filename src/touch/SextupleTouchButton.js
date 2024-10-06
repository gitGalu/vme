import { QJ_LABEL_COLOR, QJ_IDLE_COLOR, QJ_ACTIVE_COLOR } from '../Constants.js';

export class SextupleTouchButton {

    static Layout = {
        TWO_ROWS: 10
    };

    #layout;

    constructor(parent, label1, label2, label3, label4, label5, label6, gridArea, id, elListener, layout = SextupleTouchButton.Layout.TWO_ROWS, radius = '12px', allowSimultaneous = false) {
        this.#layout = layout;
        var container = document.createElement('div');
        container.classList.add('fast-button');
        if (gridArea != undefined) {
            container.style.gridArea = gridArea;
        }
        if (id != undefined) {
            container.id = id;
        }
        container.style.display = 'grid';

        if (layout == SextupleTouchButton.Layout.TWO_ROWS) {
            container.style.gridTemplateColumns = '1fr 1fr 1fr';
            container.style.gridTemplateRows = '1fr 1fr';
        } 
        
        container.style.gap = '8px';

        var el1 = document.createElement('div');
        var el2 = document.createElement('div');
        var el3 = document.createElement('div');
        var el4 = document.createElement('div');
        var el5 = document.createElement('div');
        var el6 = document.createElement('div');
        [el1, el2, el3, el4, el5, el6].forEach(el => {
            el.style.borderRadius = radius;
            el.style.pointerEvents = 'auto';
            el.style.color = QJ_LABEL_COLOR;
            el.style.backgroundColor = QJ_IDLE_COLOR;
            el.style.display = 'flex';
            el.style.justifyContent = 'center';
            el.style.alignItems = 'center';
            el.style.width = '100%';
            el.style.height = '100%';
        });

        parent.appendChild(container);
        [el1, el2, el3, el4, el5, el6].forEach(el => container.appendChild(el));

        this.container = container;
        this.elListener = elListener;
        this.state = 0;
        this.allowSimultaneous = allowSimultaneous;

        this.el1 = el1;
        this.el2 = el2;
        this.el3 = el3;
        this.el4 = el4;
        this.el5 = el5;
        this.el6 = el6;

        el1.textContent = label1;
        el2.textContent = label2;
        el3.textContent = label3;
        el4.textContent = label4;
        el5.textContent = label5;
        el6.textContent = label6;

        container.addEventListener('touchstart', e => this.touch(e, true));
        container.addEventListener('touchmove', e => this.touch(e, true));
        container.addEventListener('touchend', e => {
            e.preventDefault();
            this.touch(e, false);
        });
    }

    touch(e, pressed) {
        var newState = 0;
        var d = this.container.offsetWidth;
        var dHeight = this.container.offsetHeight;
        var vX = e.changedTouches[0].clientX - this.container.getBoundingClientRect().left;
        var vY = e.changedTouches[0].clientY - this.container.getBoundingClientRect().top;

        if (pressed) {
            if (this.#layout == SextupleTouchButton.Layout.TWO_ROWS) {
                if (vY < dHeight / 2) {
                    if (vX < d / 3) newState = 1;
                    else if (vX < (2 * d) / 3) newState = 2;
                    else newState = 3;
                } else {
                    if (vX < d / 3) newState = 4;
                    else if (vX < (2 * d) / 3) newState = 5;
                    else newState = 6;
                }
            } 
        } else {
            newState = 0;
        }

        if (newState !== this.state) {
            this.state = newState;
            this.elListener.trigger(this.state);
            [this.el1, this.el2, this.el3, this.el4, this.el5, this.el6].forEach((el, i) => {
                el.style.background = this.state === i + 1 ? QJ_ACTIVE_COLOR : QJ_IDLE_COLOR;
            });
        }
    }
}
