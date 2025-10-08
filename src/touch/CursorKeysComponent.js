const DEFAULT_KEYMAP = {
    up: { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
    down: { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
    left: { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 },
    right: { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 }
};

const DIRECTIONS = ['up', 'down', 'left', 'right'];

export class CursorKeysComponent {
    static #BASE_SIZE_RATIO = 0.6;
    static #THUMB_SIZE_RATIO = 0.45;
    static #MIN_BASE_SIZE = 60;
    static #MAX_BASE_SIZE = 120;
    static #DEAD_ZONE_RATIO = 0.28;

    #mapping;
    #activeTouchId = null;
    #activeDirections = new Set();
    #keysDown = new Set();
    #showHint = true;
    #target = document;
    #styleVariant;

    #joystickBase = null;
    #joystickThumb = null;
    #baseSize = 0;
    #thumbSize = 0;
    #maxRadius = 0;
    #deadZoneRadius = 0;
    #baseCenter = { x: 0, y: 0 };
    #hint;

    #onTouchStartBound;
    #onTouchMoveBound;
    #onTouchEndBound;

    constructor(parent, gridArea, id, _platformManager, options = {}) {
        const providedStyle = options?.style ?? 'transparent';
        this.#styleVariant = typeof providedStyle === 'string' ? providedStyle.toLowerCase() : 'transparent';

        this.el = document.createElement('div');
        this.el.classList.add('cursor-keys-component');
        this.el.dataset.interactiveElement = 'true'; // Mark as interactive for touchpad detection
        this.el.style.position = 'relative';
        this.el.style.width = '100%';
        this.el.style.height = '100%';
        this.el.style.display = 'flex';
        this.el.style.alignItems = 'center';
        this.el.style.justifyContent = 'center';
        this.el.style.borderRadius = '12px';
        this.el.style.touchAction = 'none';
        this.el.style.pointerEvents = 'auto';
        this.el.style.userSelect = 'none';
        this.el.style.overflow = 'visible';

        this.#applyStyleVariant();

        if (gridArea) {
            this.el.style.gridArea = gridArea;
        }
        if (id) {
            this.el.id = id;
        }

        this.#hint = document.createElement('div');
        this.#hint.textContent = 'CURSOR';
        this.#hint.style.pointerEvents = 'none';
        this.#hint.style.color = 'rgba(255, 255, 255, 0.35)';
        this.#hint.style.fontFamily = 'helvetica, Arial, sans-serif';
        this.#hint.style.fontSize = '11px';
        this.#hint.style.fontWeight = 'bold';
        this.#hint.style.letterSpacing = '0.1em';
        this.#hint.style.textTransform = 'uppercase';
        this.#hint.style.transition = 'opacity 120ms ease';
        this.el.appendChild(this.#hint);

        parent.appendChild(this.el);

        this.#showHint = options?.showHint !== false;
        if (!this.#showHint) {
            this.#hint.style.display = 'none';
        }

        this.#target = options?.target ?? document;

        this.#mapping = this.#buildMapping(options?.keys);

        this.#onTouchStartBound = (e) => this.#onTouchStart(e);
        this.#onTouchMoveBound = (e) => this.#onTouchMove(e);
        this.#onTouchEndBound = (e) => this.#onTouchEnd(e);

        this.el.addEventListener('touchstart', this.#onTouchStartBound, { passive: false });
        this.el.addEventListener('touchmove', this.#onTouchMoveBound, { passive: false });
        this.el.addEventListener('touchend', this.#onTouchEndBound, { passive: false });
        this.el.addEventListener('touchcancel', this.#onTouchEndBound, { passive: false });
    }

    #applyStyleVariant() {
        const borderColor = 'rgba(255, 255, 255, 0.15)';

        switch (this.#styleVariant) {
            case 'filled':
                this.el.style.background = 'rgba(136, 136, 136, 0.25)';
                this.el.style.border = 'none';
                break;
            case 'outline':
                this.el.style.background = 'transparent';
                this.el.style.border = `2px solid ${borderColor}`;
                break;
            case 'transparent':
            default:
                this.el.style.background = 'transparent';
                this.el.style.border = 'none';
                break;
        }
    }

    destroy() {
        this.cancelActiveTouch();
        this.el.removeEventListener('touchstart', this.#onTouchStartBound);
        this.el.removeEventListener('touchmove', this.#onTouchMoveBound);
        this.el.removeEventListener('touchend', this.#onTouchEndBound);
        this.el.removeEventListener('touchcancel', this.#onTouchEndBound);
        this.#removeJoystickElements();
        this.#resetKeyboardState();
    }

    cancelActiveTouch() {
        if (this.#activeTouchId !== null) {
            this.#updateDirections([]);
            this.#removeJoystickElements();
            this.#activeTouchId = null;
            this.#setHintVisible(true);
        }
    }

    setKeys(customKeys = {}) {
        this.#mapping = this.#buildMapping(customKeys);
    }

    #buildMapping(customKeys = {}) {
        const result = {};
        DIRECTIONS.forEach((dir) => {
            const fallback = DEFAULT_KEYMAP[dir];
            const override = customKeys?.[dir] ?? {};
            const key = this.#normalizeKey(override.key, fallback.key);
            const code = this.#normalizeCode(override.code, override.key, fallback.code);
            const keyCode = this.#normalizeKeyCode(override.keyCode, override.key, fallback.keyCode);
            result[dir] = { key, code, keyCode };
        });
        return result;
    }

    #normalizeKey(value, fallback) {
        if (typeof value === 'string' && value.trim().length > 0) {
            return value;
        }
        return fallback;
    }

    #normalizeCode(value, keyValue, fallback) {
        if (typeof value === 'string' && value.trim().length > 0) {
            return value;
        }
        if (typeof keyValue === 'string' && keyValue.length === 1) {
            const upper = keyValue.toUpperCase();
            if (upper >= 'A' && upper <= 'Z') {
                return `Key${upper}`;
            }
        }
        return fallback;
    }

    #normalizeKeyCode(value, keyValue, fallback) {
        if (value !== undefined && value !== null && `${value}`.trim() !== '') {
            const parsed = Number(value);
            if (!Number.isNaN(parsed)) {
                return parsed;
            }
        }
        if (typeof keyValue === 'string' && keyValue.length === 1) {
            const upper = keyValue.toUpperCase();
            if (upper.length === 1) {
                return upper.charCodeAt(0);
            }
        }
        const fallbackNumber = Number(fallback);
        return Number.isNaN(fallbackNumber) ? 0 : fallbackNumber;
    }

    #onTouchStart(event) {
        event.preventDefault();
        if (this.#activeTouchId !== null) {
            return;
        }

        const touch = Array.from(event.changedTouches).find((t) => this.#containsTouch(t));
        if (!touch) {
            return;
        }

        this.#activeTouchId = touch.identifier;
        this.#createJoystickElements(touch);
        this.#setHintVisible(false);
    }

    #onTouchMove(event) {
        if (this.#activeTouchId === null || !this.#joystickBase || !this.#joystickThumb) {
            return;
        }
        event.preventDefault();

        const touch = Array.from(event.touches).find((t) => t.identifier === this.#activeTouchId);
        if (!touch) {
            return;
        }

        const localPoint = this.#getLocalPoint(touch);
        this.#updateThumbPosition(localPoint);
    }

    #onTouchEnd(event) {
        if (this.#activeTouchId === null) {
            return;
        }
        event.preventDefault();

        const ended = Array.from(event.changedTouches).some((t) => t.identifier === this.#activeTouchId);
        if (!ended) {
            return;
        }

        this.#updateDirections([]);
        this.#removeJoystickElements();
        this.#activeTouchId = null;
        this.#setHintVisible(true);
    }

    #containsTouch(touch) {
        const rect = this.el.getBoundingClientRect();
        return touch.clientX >= rect.left && touch.clientX <= rect.right &&
            touch.clientY >= rect.top && touch.clientY <= rect.bottom;
    }

    #getLocalPoint(touch) {
        const rect = this.el.getBoundingClientRect();
        return {
            x: touch.clientX - rect.left,
            y: touch.clientY - rect.top
        };
    }

    #createJoystickElements(touch) {
        this.#removeJoystickElements();

        const rect = this.el.getBoundingClientRect();
        const minDim = Math.min(rect.width, rect.height);
        const maxAllowed = Math.min(minDim, CursorKeysComponent.#MAX_BASE_SIZE);
        if (maxAllowed <= 0) {
            return;
        }
        const baseSize = Math.min(
            Math.max(minDim * CursorKeysComponent.#BASE_SIZE_RATIO, CursorKeysComponent.#MIN_BASE_SIZE),
            maxAllowed
        );
        const thumbSize = baseSize * CursorKeysComponent.#THUMB_SIZE_RATIO;

        this.#baseSize = baseSize;
        this.#thumbSize = thumbSize;
        this.#maxRadius = baseSize / 2;
        this.#deadZoneRadius = baseSize * CursorKeysComponent.#DEAD_ZONE_RATIO;

        const localPoint = this.#getLocalPoint(touch);
        const baseHalf = baseSize / 2;

        const centerX = localPoint.x;
        const centerY = localPoint.y;
        this.#baseCenter = { x: centerX, y: centerY };

        const base = document.createElement('div');
        base.style.position = 'absolute';
        base.style.width = `${baseSize}px`;
        base.style.height = `${baseSize}px`;
        base.style.left = `${centerX - baseHalf}px`;
        base.style.top = `${centerY - baseHalf}px`;
        base.style.border = '2px solid rgba(255, 255, 255, 0.25)';
        base.style.borderRadius = '50%';
        base.style.background = 'rgba(255, 255, 255, 0.07)';
        base.style.pointerEvents = 'none';
        base.style.boxShadow = '0 0 12px rgba(0, 0, 0, 0.35) inset';
        this.el.appendChild(base);
        this.#joystickBase = base;

        const thumbHalf = thumbSize / 2;
        const thumb = document.createElement('div');
        thumb.style.position = 'absolute';
        thumb.style.width = `${thumbSize}px`;
        thumb.style.height = `${thumbSize}px`;
        thumb.style.borderRadius = '50%';
        thumb.style.background = 'rgba(255, 255, 255, 0.25)';
        thumb.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.45)';
        thumb.style.pointerEvents = 'none';
        thumb.style.left = `${centerX - thumbHalf}px`;
        thumb.style.top = `${centerY - thumbHalf}px`;
        this.el.appendChild(thumb);
        this.#joystickThumb = thumb;

        this.#updateThumbPosition(localPoint);
    }

    #updateThumbPosition(point) {
        if (!this.#joystickThumb) return;
        const dx = point.x - this.#baseCenter.x;
        const dy = point.y - this.#baseCenter.y;
        let distance = Math.sqrt(dx * dx + dy * dy);

        let clampedX = point.x;
        let clampedY = point.y;
        if (distance > this.#maxRadius) {
            const ratio = this.#maxRadius / distance;
            clampedX = this.#baseCenter.x + dx * ratio;
            clampedY = this.#baseCenter.y + dy * ratio;
            distance = this.#maxRadius;
        }

        const thumbHalf = this.#thumbSize / 2;
        this.#joystickThumb.style.left = `${clampedX - thumbHalf}px`;
        this.#joystickThumb.style.top = `${clampedY - thumbHalf}px`;

        if (distance > this.#deadZoneRadius) {
            const angleRad = Math.atan2(dy, dx);
            let angleDeg = angleRad * (180 / Math.PI);
            if (angleDeg < 0) angleDeg += 360;
            this.#updateDirections(this.#getDirections(angleDeg));
        } else {
            this.#updateDirections([]);
        }
    }

    #removeJoystickElements() {
        if (this.#joystickBase) {
            this.#joystickBase.remove();
            this.#joystickBase = null;
        }
        if (this.#joystickThumb) {
            this.#joystickThumb.remove();
            this.#joystickThumb = null;
        }
    }

    #setHintVisible(visible) {
        if (this.#hint && this.#showHint) {
            this.#hint.style.opacity = visible ? '1' : '0';
        }
    }

    #getDirections(angleDeg) {
        if (angleDeg >= 337.5 || angleDeg < 22.5) return ['right'];
        if (angleDeg >= 22.5 && angleDeg < 67.5) return ['right', 'down'];
        if (angleDeg >= 67.5 && angleDeg < 112.5) return ['down'];
        if (angleDeg >= 112.5 && angleDeg < 157.5) return ['down', 'left'];
        if (angleDeg >= 157.5 && angleDeg < 202.5) return ['left'];
        if (angleDeg >= 202.5 && angleDeg < 247.5) return ['left', 'up'];
        if (angleDeg >= 247.5 && angleDeg < 292.5) return ['up'];
        return ['up', 'right'];
    }

    #updateDirections(newDirections) {
        const newSet = new Set(newDirections);
        const toRelease = [...this.#activeDirections].filter((dir) => !newSet.has(dir));
        const toPress = [...newSet].filter((dir) => !this.#activeDirections.has(dir));

        toRelease.forEach((dir) => {
            this.#keyUp(dir);
            this.#activeDirections.delete(dir);
        });

        toPress.forEach((dir) => {
            this.#keyDown(dir);
            this.#activeDirections.add(dir);
        });
    }

    #keyDown(direction) {
        const mapping = this.#mapping[direction];
        if (!mapping) return;
        const identifier = this.#keyIdentifier(mapping);
        if (this.#keysDown.has(identifier)) return;
        this.#keysDown.add(identifier);
        this.#dispatchKeyboardEvent('keydown', mapping);
    }

    #keyUp(direction) {
        const mapping = this.#mapping[direction];
        if (!mapping) return;
        const identifier = this.#keyIdentifier(mapping);
        if (!this.#keysDown.has(identifier)) return;
        this.#keysDown.delete(identifier);
        this.#dispatchKeyboardEvent('keyup', mapping);
    }

    #keyIdentifier(mapping) {
        return `${mapping.key}|${mapping.code}|${mapping.keyCode}`;
    }

    #dispatchKeyboardEvent(type, mapping) {
        const keyCode = Number(mapping.keyCode ?? 0);
        const event = new KeyboardEvent(type, {
            key: mapping.key,
            code: mapping.code,
            keyCode,
            which: keyCode,
            bubbles: true,
            cancelable: true
        });
        this.#target.dispatchEvent(event);
    }

    #resetKeyboardState() {
        if (this.#keysDown.size === 0) return;
        this.#keysDown.forEach((identifier) => {
            const [key, code, keyCode] = identifier.split('|');
            this.#dispatchKeyboardEvent('keyup', { key, code, keyCode: Number(keyCode) });
        });
        this.#keysDown.clear();
    }
}
