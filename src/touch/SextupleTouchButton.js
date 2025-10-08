import { QJ_LABEL_COLOR, QJ_IDLE_COLOR, QJ_ACTIVE_COLOR } from '../Constants.js';

export class SextupleTouchButton {
    static Layout = {
        TWO_ROWS: 10
    };

    #layout;

    constructor(parent, label1, label2, label3, label4, label5, label6, gridArea, id, elListener, layout = SextupleTouchButton.Layout.TWO_ROWS, radius = '12px') {
        this.touchIdentifiers = new Map();
        this.#layout = layout;
        this.el1 = null;
        this.el2 = null;
        this.el3 = null;
        this.el4 = null;
        this.el5 = null;
        this.el6 = null;
        this.container = null;
        this.state = 0;
        this.elListener = elListener;

        const container = document.createElement('div');
        container.classList.add('fast-button');
        container.dataset.interactiveElement = 'true'; // Mark as interactive for touchpad detection
        if (gridArea !== undefined) {
            container.style.gridArea = gridArea;
        }
        if (id !== undefined) {
            container.id = id;
        }

        container.style.display = 'grid';
        container.style.gap = '8px';
        container.style.touchAction = 'none';

        if (layout === SextupleTouchButton.Layout.TWO_ROWS) {
            container.style.gridTemplateColumns = '1fr 1fr 1fr';
            container.style.gridTemplateRows = '1fr 1fr';
        }

        const buttons = [
            document.createElement('div'),
            document.createElement('div'),
            document.createElement('div'),
            document.createElement('div'),
            document.createElement('div'),
            document.createElement('div')
        ];

        const buttonStyles = {
            borderRadius: radius,
            pointerEvents: 'auto',
            color: QJ_LABEL_COLOR,
            backgroundColor: QJ_IDLE_COLOR,
            width: '100%',
            height: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
        };

        buttons.forEach((el, index) => {
            Object.entries(buttonStyles).forEach(([key, value]) => {
                el.style[key] = value;
            });
            el.textContent = [label1, label2, label3, label4, label5, label6][index];
        });

        [this.el1, this.el2, this.el3, this.el4, this.el5, this.el6] = buttons;
        this.container = container;

        buttons.forEach(el => container.appendChild(el));
        parent.appendChild(container);

        this.handleTouchStart = this.handleTouchStart.bind(this);
        this.handleTouchMove = this.handleTouchMove.bind(this);
        this.handleTouchEnd = this.handleTouchEnd.bind(this);
        this.handleTouchCancel = this.handleTouchCancel.bind(this);

        container.addEventListener('touchstart', this.handleTouchStart, { passive: false });
        container.addEventListener('touchmove', this.handleTouchMove, { passive: false });
        container.addEventListener('touchend', this.handleTouchEnd, { passive: false });
        container.addEventListener('touchcancel', this.handleTouchCancel, { passive: false });
    }

    handleTouchStart(e) {
        e.preventDefault();
        e.stopPropagation();
        Array.from(e.changedTouches).forEach(touch => {
            const position = this.getTouchPosition(touch);
            this.touchIdentifiers.set(touch.identifier, position);
        });
        this.updateState();
    }

    handleTouchMove(e) {
        e.preventDefault();
        e.stopPropagation();
        Array.from(e.changedTouches).forEach(touch => {
            if (this.touchIdentifiers.has(touch.identifier)) {
                const position = this.getTouchPosition(touch);
                this.touchIdentifiers.set(touch.identifier, position);
            }
        });
        this.updateState();
    }

    handleTouchEnd(e) {
        e.preventDefault();
        e.stopPropagation();
        Array.from(e.changedTouches).forEach(touch => {
            this.touchIdentifiers.delete(touch.identifier);
        });
        this.updateState();
    }

    handleTouchCancel(e) {
        e.preventDefault();
        e.stopPropagation();
        this.handleTouchEnd(e);
    }

    getTouchPosition(touch) {
        if (this.#layout === SextupleTouchButton.Layout.TWO_ROWS) {
            const rect = this.container.getBoundingClientRect();
            const width = rect.width;
            const height = rect.height;
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;

            if (y < height / 2) {
                // Top row
                if (x < width / 3) return 1;
                if (x < (2 * width) / 3) return 2;
                return 3;
            } else {
                // Bottom row
                if (x < width / 3) return 4;
                if (x < (2 * width) / 3) return 5;
                return 6;
            }
        }
        return 0;
    }

    updateState() {
        let newState = 0;
        if (this.touchIdentifiers.size > 0) {
            const positions = Array.from(this.touchIdentifiers.values());
            newState = positions[positions.length - 1];
        }
        if (newState !== this.state) {
            this.state = newState;
            [this.el1, this.el2, this.el3, this.el4, this.el5, this.el6].forEach((el, i) => {
                el.style.backgroundColor = this.state === i + 1 ? QJ_ACTIVE_COLOR : QJ_IDLE_COLOR;
            });
            this.elListener.trigger(this.state);
        }
    }

    destroy() {
        if (this.container) {
            this.container.removeEventListener('touchstart', this.handleTouchStart);
            this.container.removeEventListener('touchmove', this.handleTouchMove);
            this.container.removeEventListener('touchend', this.handleTouchEnd);
            this.container.removeEventListener('touchcancel', this.handleTouchCancel);
        }
    }
}