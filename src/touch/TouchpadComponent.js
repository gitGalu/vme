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
    #tapToClick;
    #touchStartTime;
    #touchStartX;
    #touchStartY;
    #anywhere;
    #parent;
    #touchTarget;

    constructor(parent, gridArea, id, platformManager, options = {}) {
        const providedStyle = options?.style ?? 'filled';
        this.#styleVariant = typeof providedStyle === 'string' ? providedStyle.toLowerCase() : 'filled';

        this.#hasExplicitLabel = options ? Object.prototype.hasOwnProperty.call(options, 'label') : false;
        if (this.#hasExplicitLabel) {
            this.#labelText = typeof options.label === 'string' ? options.label : '';
        } else {
            this.#labelText = DEFAULT_LABEL;
        }

        this.#anywhere = options?.anywhere ?? false;
        this.#parent = parent;

        this.el = this.#createContainer(gridArea, id);
        parent.appendChild(this.el);

        this.#platformManager = platformManager;
        this.#nostalgist = platformManager.getNostalgist();

        this.#lx = -1;
        this.#ly = -1;
        this.#mouseSpeed = 1;
        this.#activeTouchId = null;
        this.#tapToClick = options?.tapToClick ?? false;
        this.#touchStartTime = 0;
        this.#touchStartX = 0;
        this.#touchStartY = 0;

        // Determine touch target: if "anywhere" mode, listen on parent container
        this.#touchTarget = this.#anywhere ? parent : this.el;

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

        // In "anywhere" mode, hide the touchpad visual element
        if (this.#anywhere) {
            div.style.display = 'none';
            div.style.pointerEvents = 'none';
        }

        return div;
    }

    #isTouchOnOtherElement(touch) {
        if (!this.#anywhere) {
            return false;
        }

        const element = document.elementFromPoint(touch.clientX, touch.clientY);
        if (!element) {
            return false;
        }

        let current = element;
        while (current && current !== this.#parent) {
            if (current === this.#touchTarget || current === this.el) {
                current = current.parentElement;
                continue;
            }

            if (current.dataset && current.dataset.interactiveElement === 'true') {
                return true;
            }

            const style = window.getComputedStyle(current);
            const pointerEvents = style.pointerEvents;
            if (pointerEvents === 'auto') {
                if (current.classList.contains('quickshot-component') ||
                    current.classList.contains('touchpad-component') ||
                    current.classList.contains('cursor-keys-component') ||
                    current.matches('[class*="touch-button"]')) {
                    return true;
                }
            }

            current = current.parentElement;
        }

        return false;
    }

    #initTouchHandlers() {
        const mousetouch = (e, started) => {
            if (started === false) {
                this.#lx = -1;
                this.#ly = -1;
                this.#activeTouchId = null;
            } else {
                const touch = e.changedTouches[0];
                const rect = this.#anywhere ? this.#parent.getBoundingClientRect() : this.el.getBoundingClientRect();
                const dx = (touch.clientX - rect.left) * this.#mouseSpeed;
                const dy = (touch.clientY - rect.top) * this.#mouseSpeed;

                if (this.#lx !== -1 && this.#activeTouchId === touch.identifier) {
                    this.#simulateMouseMove(dx - this.#lx, dy - this.#ly);
                }
                this.#lx = dx;
                this.#ly = dy;
            }
        };

        this.#touchTarget.addEventListener('touchstart', (e) => {
            if (this.#anywhere) {
                const touch = e.changedTouches[0];
                if (this.#isTouchOnOtherElement(touch)) {
                    return;
                }
            }

            e.preventDefault();
            e.stopPropagation();

            if (this.#activeTouchId === null) {
                const touch = e.changedTouches[0];
                this.#activeTouchId = touch.identifier;

                if (this.#tapToClick) {
                    this.#touchStartTime = Date.now();
                    this.#touchStartX = touch.clientX;
                    this.#touchStartY = touch.clientY;
                }

                mousetouch(e, true);
            }
        });

        this.#touchTarget.addEventListener('touchmove', (e) => {
            if (this.#activeTouchId === null) {
                return;
            }

            e.preventDefault();
            e.stopPropagation();

            const touches = Array.from(e.changedTouches).filter(touch =>
                touch.identifier === this.#activeTouchId
            );
            if (touches.length > 0) {
                mousetouch(e, true);
            }
        });

        this.#touchTarget.addEventListener('touchend', (e) => {
            if (this.#activeTouchId === null) {
                return;
            }

            e.preventDefault();
            e.stopPropagation();

            const touches = Array.from(e.changedTouches).filter(touch =>
                touch.identifier === this.#activeTouchId
            );
            if (touches.length > 0) {
                if (this.#tapToClick) {
                    const touch = touches[0];
                    const touchDuration = Date.now() - this.#touchStartTime;
                    const dx = touch.clientX - this.#touchStartX;
                    const dy = touch.clientY - this.#touchStartY;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    const TAP_MAX_DURATION = 300; // ms
                    const TAP_MAX_DISTANCE = 10; // px

                    if (touchDuration < TAP_MAX_DURATION && distance < TAP_MAX_DISTANCE) {
                        this.#simulateMouseClick();
                    }
                }

                mousetouch(e, false);
            }
        });

        this.#touchTarget.addEventListener('touchcancel', (e) => {
            if (this.#activeTouchId === null) {
                return;
            }

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

    #simulateMouseClick() {
        const canvas = s('canvas');

        const mouseDownEvent = new MouseEvent('mousedown', {
            button: 0,
            buttons: 1,
            bubbles: true,
            cancelable: true
        });

        const mouseUpEvent = new MouseEvent('mouseup', {
            button: 0,
            buttons: 0,
            bubbles: true,
            cancelable: true
        });

        canvas.dispatchEvent(mouseDownEvent);
        setTimeout(() => {
            canvas.dispatchEvent(mouseUpEvent);
        }, 50);
    }

    destroy() {
        if (this.el && this.el.parentNode) {
            this.el.remove();
        }
    }
}
