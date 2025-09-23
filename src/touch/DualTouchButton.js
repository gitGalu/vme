import { QJ_LABEL_COLOR, QJ_IDLE_COLOR, QJ_ACTIVE_COLOR } from '../Constants.js';

export class DualTouchButton {
    constructor(parent, isHorizontal, label1, label2, gridArea, id, elListener, radius = '12px') {
        this.touchIdentifiers = new Map();
        this.el1 = null;
        this.el2 = null;
        this.container = null;
        this.state = 0;
        this.isHorizontal = isHorizontal;
        this.elListener = elListener;

        const container = document.createElement('div');
        container.classList.add('fast-button');
        
        if (gridArea !== undefined) {
            container.style.gridArea = gridArea;
        }
        if (id !== undefined) {
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
        container.style.touchAction = 'none';

        const el1 = document.createElement('div');
        const el2 = document.createElement('div');

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

        Object.entries(buttonStyles).forEach(([key, value]) => {
            el1.style[key] = value;
            el2.style[key] = value;
        });

        el1.innerHTML = label1;
        el2.innerHTML = label2;

        this.el1 = el1;
        this.el2 = el2;
        this.container = container;

        container.appendChild(el1);
        container.appendChild(el2);

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
        const rect = this.container.getBoundingClientRect();
        
        if (this.isHorizontal) {
            const width = rect.width;
            const x = touch.clientX - rect.left;
            
            return x < (width / 2) ? 1 : 2;
        } else {
            const height = rect.height;
            const y = touch.clientY - rect.top;
            
            return y < (height / 2) ? 1 : 2;
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