import { s } from '../dom.js';

const DEFAULT_LABEL = 'TOUCHPAD';

export class TouchpadComponent {
    #platformManager;
    #nostalgist;
    #lx;
    #ly;
    #mouseSpeed;
    #activeTouchId;
    #styleVariant;
    #labelText;
    #hasExplicitLabel;

    constructor(parent, gridArea, id, platformManager, options = {}) {
        const providedStyle = options?.style ?? 'filled';
        this.#styleVariant = typeof providedStyle === 'string' ? providedStyle.toLowerCase() : 'filled';

        this.#hasExplicitLabel = options ? Object.prototype.hasOwnProperty.call(options, 'label') : false;
        if (this.#hasExplicitLabel) {
            this.#labelText = typeof options.label === 'string' ? options.label : '';
        } else {
            this.#labelText = DEFAULT_LABEL;
        }

        this.el = this.#createContainer(gridArea, id);
        parent.appendChild(this.el);

        this.#platformManager = platformManager;
        this.#nostalgist = platformManager.getNostalgist();

        this.#lx = -1;
        this.#ly = -1;
        this.#mouseSpeed = 1;
        this.#activeTouchId = null;

        this.#initTouchHandlers();
    }

    #createContainer(gridArea, id) {
        const div = document.createElement('div');
        const normalizedStyle = this.#styleVariant;

        div.classList.add('touchpad-component');
        div.classList.add(`touchpad-component--${normalizedStyle}`);

        if (gridArea) {
            div.style.gridArea = gridArea;
        }
        if (id) {
            div.id = id;
        }

        // Base styling applied to all variants
        const borderColor = 'rgba(255, 255, 255, 0.15)';
        const textColor = 'rgba(255, 255, 255, 0.55)';

        div.dataset.touchpadStyle = normalizedStyle;
        div.style.position = 'relative';
        div.style.display = 'flex';
        div.style.alignItems = 'center';
        div.style.justifyContent = 'center';
        div.style.borderRadius = '12px';
        div.style.color = textColor;
        div.style.fontFamily = 'helvetica, Arial, sans-serif';
        div.style.fontSize = '12px';
        div.style.letterSpacing = '0.08em';
        div.style.textTransform = 'uppercase';
        div.style.fontWeight = 'bold';
        div.style.pointerEvents = 'auto';
        div.style.touchAction = 'none';
        div.style.userSelect = 'none';

        const rawLabel = this.#labelText ?? '';
        const trimmedLabel = typeof rawLabel === 'string' ? rawLabel.trim() : '';
        const hasExplicitLabel = this.#hasExplicitLabel;

        const ariaLabel = (hasExplicitLabel && trimmedLabel.length > 0) ? trimmedLabel : DEFAULT_LABEL;
        let visualLabel;
        if (normalizedStyle === 'filled' || normalizedStyle === 'tab') {
            visualLabel = hasExplicitLabel ? trimmedLabel : DEFAULT_LABEL;
        } else {
            visualLabel = hasExplicitLabel ? trimmedLabel : '';
        }

        div.setAttribute('role', 'region');
        div.setAttribute('aria-label', ariaLabel);

        switch (normalizedStyle) {
            case 'transparent': {
                div.style.backgroundColor = 'transparent';
                div.style.border = 'none';
                break;
            }
            case 'outline': {
                div.style.backgroundColor = 'transparent';
                div.style.border = `2px solid ${borderColor}`;
                break;
            }
            case 'tab': {
                div.style.backgroundColor = 'transparent';
                div.style.border = 'none';
                const tab = document.createElement('div');
                tab.textContent = visualLabel;
                tab.style.position = 'absolute';
                tab.style.bottom = '0';
                tab.style.left = '0';
                tab.style.right = '0';
                tab.style.margin = '0 auto';
                tab.style.textAlign = 'center';
                tab.style.padding = '6px 0';
                tab.style.borderRadius = '0 0 12px 12px';
                tab.style.border = `2px solid ${borderColor}`;
                tab.style.borderTop = '0';
                tab.style.backgroundColor = 'transparent';
                tab.style.color = textColor;
                tab.style.pointerEvents = 'none';
                tab.style.letterSpacing = '0.08em';
                tab.style.textTransform = 'uppercase';
                div.appendChild(tab);
                break;
            }
            case 'filled':
            default: {
                div.style.backgroundColor = 'rgba(136, 136, 136, 0.25)';
                div.style.border = 'none';
                break;
            }
        }

        if (normalizedStyle === 'filled' && visualLabel) {
            div.textContent = visualLabel;
        }

        return div;
    }

    #initTouchHandlers() {
        const mousetouch = (e, started) => {
            if (started === false) {
                this.#lx = -1;
                this.#ly = -1;
                this.#activeTouchId = null;
            } else {
                const touch = e.changedTouches[0];
                const rect = this.el.getBoundingClientRect();
                const dx = (touch.clientX - rect.left) * this.#mouseSpeed;
                const dy = (touch.clientY - rect.top) * this.#mouseSpeed;

                if (this.#lx !== -1 && this.#activeTouchId === touch.identifier) {
                    this.#simulateMouseMove(dx - this.#lx, dy - this.#ly);
                }
                this.#lx = dx;
                this.#ly = dy;
            }
        };

        this.el.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (this.#activeTouchId === null) {
                const touch = e.changedTouches[0];
                this.#activeTouchId = touch.identifier;
                mousetouch(e, true);
            }
        });

        this.el.addEventListener('touchmove', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const touches = Array.from(e.changedTouches).filter(touch =>
                touch.identifier === this.#activeTouchId
            );
            if (touches.length > 0) {
                mousetouch(e, true);
            }
        });

        this.el.addEventListener('touchend', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const touches = Array.from(e.changedTouches).filter(touch =>
                touch.identifier === this.#activeTouchId
            );
            if (touches.length > 0) {
                mousetouch(e, false);
            }
        });

        this.el.addEventListener('touchcancel', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const touches = Array.from(e.changedTouches).filter(touch =>
                touch.identifier === this.#activeTouchId
            );
            if (touches.length > 0) {
                mousetouch(e, false);
            }
        });
    }

    #simulateMouseMove(deltaX, deltaY) {
        const mouseMoveEvent = new MouseEvent('mousemove', {
            movementX: deltaX,
            movementY: deltaY,
            bubbles: true,
            cancelable: true
        });

        s('canvas').dispatchEvent(mouseMoveEvent);
    }

    destroy() {
        if (this.el && this.el.parentNode) {
            this.el.remove();
        }
    }
}
