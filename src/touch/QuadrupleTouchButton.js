import { QJ_LABEL_COLOR, QJ_IDLE_COLOR, QJ_ACTIVE_COLOR } from '../Constants.js';

export class QuadrupleTouchButton {
    static Layout = {
        ABCD: 10,
        ABLR: 50
    };

    #layout;

    constructor(parent, label1, label2, label3, label4, gridArea, id, elListener, layout = QuadrupleTouchButton.Layout.ABCD, radius = '12px') {
        this.touchIdentifiers = new Map();
        this.#layout = layout;
        this.el1 = null;
        this.el2 = null;
        this.el3 = null;
        this.el4 = null;
        this.container = null;
        this.state = 0;
        this.elListener = elListener;
        this._rect = null;

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
        container.style.gridTemplateColumns = '1fr 1fr';
        container.style.gap = '8px';
        container.style.touchAction = 'none';

        if (layout === QuadrupleTouchButton.Layout.ABCD) {
            container.style.gridTemplateRows = '1fr 1fr';
        } else if (layout === QuadrupleTouchButton.Layout.ABLR) {
            container.style.gridTemplateRows = '1fr 3fr';
        }

        const el1 = document.createElement('div');
        const el2 = document.createElement('div');
        const el3 = document.createElement('div');
        const el4 = document.createElement('div');

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

        [el1, el2, el3, el4].forEach(el => {
            Object.entries(buttonStyles).forEach(([key, value]) => {
                el.style[key] = value;
            });
        });

        el1.textContent = label1;
        el2.textContent = label2;
        el3.textContent = label3;
        el4.textContent = label4;

        this.el1 = el1;
        this.el2 = el2;
        this.el3 = el3;
        this.el4 = el4;
        this.container = container;

        container.appendChild(el1);
        container.appendChild(el2);
        container.appendChild(el3);
        container.appendChild(el4);
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
        this._rect = this.container.getBoundingClientRect();
        Array.from(e.changedTouches).forEach(touch => {
            const position = this.getTouchPosition(touch);
            this.touchIdentifiers.set(touch.identifier, position);
        });
        this.updateState();
    }

    handleTouchMove(e) {
        e.preventDefault();
        e.stopPropagation();
        if (!this._rect) {
            this._rect = this.container.getBoundingClientRect();
        }
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
        if (this.touchIdentifiers.size === 0) {
            this._rect = null;
        }
        this.updateState();
    }

    handleTouchCancel(e) {
        e.preventDefault();
        e.stopPropagation();
        this.handleTouchEnd(e);
    }

    getTouchPosition(touch) {
        const rect = this._rect || this.container.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;

        const topRowHeightFraction = this.#layout === QuadrupleTouchButton.Layout.ABCD ? 2 : 4;
        
        if (x < width / 2) {
            if (y < height / topRowHeightFraction) {
                return 1; // Top-left
            } else {
                return 3; // Bottom-left
            }
        } else {
            if (y < height / topRowHeightFraction) {
                return 2; // Top-right
            } else {
                return 4; // Bottom-right
            }
        }
    }

    updateState() {
        let newState = 0;
        if (this.touchIdentifiers.size > 0) {
            const positions = Array.from(this.touchIdentifiers.values());
            newState = positions[positions.length - 1];
        }
        if (newState !== this.state) {
            this.state = newState;
            this.el1.style.backgroundColor = this.state === 1 ? QJ_ACTIVE_COLOR : QJ_IDLE_COLOR;
            this.el2.style.backgroundColor = this.state === 2 ? QJ_ACTIVE_COLOR : QJ_IDLE_COLOR;
            this.el3.style.backgroundColor = this.state === 3 ? QJ_ACTIVE_COLOR : QJ_IDLE_COLOR;
            this.el4.style.backgroundColor = this.state === 4 ? QJ_ACTIVE_COLOR : QJ_IDLE_COLOR;
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
