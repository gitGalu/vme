const DEFAULT_HINT = 'QUICKSHOT';

const DEFAULT_KEYMAP = {
    up: { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
    down: { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
    left: { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 },
    right: { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 }
};

// 8 sectors clockwise from "right" (screen space, y grows downwards); sector i is centered at i * 45°.
const SECTOR_DIRECTIONS = [
    ['right'],
    ['right', 'down'],
    ['down'],
    ['down', 'left'],
    ['left'],
    ['left', 'up'],
    ['up'],
    ['up', 'right']
];

/**
 * Digital 8-way touch directional control.
 *
 * placement 'floating': a stick appears under the finger and is dragged along when the finger
 * travels past the follow radius, so reversing direction never needs a long trip back.
 * placement 'static': a D-pad with a fixed home position (bottom-left of the zone, level with the
 * action buttons). The direction depends only on the angle from its fixed center, so the same spot
 * on the screen always means the same direction; the finger may slide past the D-pad's rim.
 *
 * Output is digital: a dead zone with hysteresis decides "neutral vs pressed", angular sectors with
 * a slight cardinal bias and hysteresis decide the direction, so the output does not flicker on
 * sector boundaries and accidental diagonals are rarer.
 */
export class QuickshotComponent {
    static Placement = Object.freeze({
        FLOATING: 'floating',
        STATIC: 'static'
    });

    // Where a full-screen stick may be grabbed: the left thumb's half of the screen
    // (lower half in portrait, where the game image is on top). Fractions of the element.
    static FULLSCREEN_ZONE = Object.freeze({
        landscape: { left: 0, top: 0, right: 0.5, bottom: 1 },
        portrait: { left: 0, top: 0.5, right: 0.55, bottom: 1 }
    });

    // Geometry, relative to the base radius unless stated otherwise.
    static #BASE_SIZE_VIEWPORT_RATIO = 0.3;   // base diameter vs the shorter viewport side
    static #MIN_BASE_SIZE = 104;              // px
    static #MAX_BASE_SIZE = 150;              // px
    static #THUMB_SIZE_RATIO = 0.45;          // thumb diameter vs base diameter
    static #DEAD_ZONE_ENGAGE = 0.22;          // deflection needed to press a direction
    static #DEAD_ZONE_RELEASE = 0.14;         // deflection below which directions are released
    static #FOLLOW_RADIUS = 0.65;             // floating: base follows the finger beyond this

    // Static D-pad, relative to the D-pad radius unless stated otherwise.
    static #DPAD_SIZE_RATIO = 1.25;           // D-pad diameter vs the floating stick's base diameter
    static #DPAD_ARM_WIDTH = 0.36;            // arm width vs D-pad diameter
    static #DPAD_DEAD_ZONE_ENGAGE = 0.16;     // distance from center needed to press a direction
    static #DPAD_DEAD_ZONE_RELEASE = 0.1;     // distance below which directions are released
    static #DPAD_CAPTURE_RADIUS = 1.6;        // touch must start this close to the center
    static #HOME_OFFSET = 1.5;                // home center distance from the zone's left edge (and bottom edge without alignTo)
    static #HOME_MIN_BOTTOM_OFFSET = 1.05;    // alignTo: keep the home center at least this far above the bottom edge

    // Direction sectors, in degrees. Cardinal 50° + diagonal 40° = 90° per quadrant.
    static #CARDINAL_HALF_ANGLE = 25;
    static #DIAGONAL_HALF_ANGLE = 20;
    static #ANGLE_HYSTERESIS = 8;

    static #DPAD_IDLE_OPACITY = '0.6';
    static #IDLE_FILL = 'rgba(136, 136, 136, 0.267)';
    static #ACTIVE_FILL = 'rgba(200, 200, 200, 0.45)';

    #nostalgist = null;
    #mode = 'nostalgist';
    #mapping;
    #keysDown = new Set();

    #placement;
    #zone;
    #alignTo;

    #activeTouchId = null;
    #activeDirections = new Set();
    #sector = null;

    #stick = null;
    #joystickBase = null;
    #joystickThumb = null;
    #dpad = null;
    #dpadArms = {};
    #insetProbe = null;
    #rect = null;
    #radius = 0;
    #center = { x: 0, y: 0 };
    #home = { x: 0, y: 0 };
    #hint;
    #showHint = true;
    #target = document;
    #styleVariant;

    #onTouchStartBound;
    #onTouchMoveBound;
    #onTouchEndBound;
    #onResizeBound;

    constructor(parent, gridArea, id, platformManager, options = {}) {
        const providedStyle = options?.style ?? 'transparent';
        this.#styleVariant = typeof providedStyle === 'string' ? providedStyle.toLowerCase() : 'transparent';

        this.#placement = QuickshotComponent.#normalizePlacement(options?.placement);
        this.#zone = options?.zone ?? null;
        this.#alignTo = typeof options?.alignTo === 'function' ? options.alignTo : null;

        this.el = document.createElement('div');
        this.el.classList.add('quickshot-component');
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

        // Apply style variant
        this.#applyStyleVariant();

        if (gridArea) {
            this.el.style.gridArea = gridArea;
        }
        if (id) {
            this.el.id = id;
        }

        this.#hint = document.createElement('div');
        this.#hint.textContent = options?.label || DEFAULT_HINT;
        this.#hint.style.pointerEvents = 'none';
        this.#hint.style.color = 'rgba(255, 255, 255, 0.35)';
        this.#hint.style.fontFamily = 'helvetica, Arial, sans-serif';
        this.#hint.style.fontSize = '11px';
        this.#hint.style.fontWeight = 'bold';
        this.#hint.style.letterSpacing = '0.1em';
        this.#hint.style.textTransform = 'uppercase';
        this.#hint.style.transition = 'opacity 120ms ease';
        this.el.appendChild(this.#hint);

        this.#createStickElements();

        parent.appendChild(this.el);

        this.#showHint = options?.showHint !== false;
        if (!this.#showHint) {
            this.#hint.style.display = 'none';
        }

        this.#target = options?.target ?? document;

        this.#initializeInputMode(platformManager, options);

        this.#onTouchStartBound = (event) => this.#onTouchStart(event);
        this.#onTouchMoveBound = (event) => this.#onTouchMove(event);
        this.#onTouchEndBound = (event) => this.#onTouchEnd(event);
        this.#onResizeBound = () => this.refresh();

        this.el.addEventListener('touchstart', this.#onTouchStartBound, { passive: false });
        this.el.addEventListener('touchmove', this.#onTouchMoveBound, { passive: false });
        this.el.addEventListener('touchend', this.#onTouchEndBound, { passive: false });
        this.el.addEventListener('touchcancel', this.#onTouchEndBound, { passive: false });
        window.addEventListener('resize', this.#onResizeBound);

        this.refresh();
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
        window.removeEventListener('resize', this.#onResizeBound);
        this.#stick?.remove();
        this.#dpad?.remove();
        this.#insetProbe?.remove();
        this.#resetKeyboardState();
    }

    cancelActiveTouch() {
        if (this.#activeTouchId !== null) {
            this.#releaseTouch();
        }
    }

    setKeys(customKeys = {}) {
        this.#mapping = this.#buildMapping(customKeys);
    }

    setPlacement(placement) {
        const normalized = QuickshotComponent.#normalizePlacement(placement);
        if (normalized === this.#placement) {
            return;
        }
        this.cancelActiveTouch();
        this.#placement = normalized;
        this.refresh();
    }

    getPlacement() {
        return this.#placement;
    }

    /**
     * Re-measures the stick (size, home position) and redraws its idle state. Call after the
     * component becomes visible; it is also called on window resize.
     */
    refresh() {
        if (this.#activeTouchId !== null) {
            return;
        }
        if (!this.#measure()) {
            this.#stick.style.display = 'none';
            this.#dpad.style.display = 'none';
            return;
        }
        this.#showIdle();
    }

    static #normalizePlacement(value) {
        return value === QuickshotComponent.Placement.STATIC
            ? QuickshotComponent.Placement.STATIC
            : QuickshotComponent.Placement.FLOATING;
    }

    #onTouchStart(event) {
        event.preventDefault();
        if (this.#activeTouchId !== null) {
            return;
        }

        if (!this.#measure()) {
            return;
        }

        const isStatic = this.#placement === QuickshotComponent.Placement.STATIC;
        const captureRadius = this.#radius * QuickshotComponent.#DPAD_CAPTURE_RADIUS;

        let touch = null;
        let point = null;
        for (const candidate of Array.from(event.changedTouches)) {
            const local = this.#getLocalPoint(candidate);
            if (!this.#isInZone(local)) {
                continue;
            }
            if (isStatic && Math.hypot(local.x - this.#home.x, local.y - this.#home.y) > captureRadius) {
                continue;
            }
            touch = candidate;
            point = local;
            break;
        }
        if (!touch) {
            return;
        }

        this.#activeTouchId = touch.identifier;
        this.#sector = null;
        this.#setHintVisible(false);
        if (isStatic) {
            this.#dpad.style.opacity = '1';
            this.#updateDpad(point);
        } else {
            this.#moveStickTo(point);
            this.#stick.style.display = 'block';
            this.#stick.style.opacity = '1';
            this.#updateStick(point);
        }
    }

    #onTouchMove(event) {
        if (this.#activeTouchId === null) {
            return;
        }
        event.preventDefault();

        const touch = Array.from(event.changedTouches).find((t) => t.identifier === this.#activeTouchId);
        if (!touch) {
            return;
        }

        const point = this.#getLocalPoint(touch);
        if (this.#placement === QuickshotComponent.Placement.STATIC) {
            this.#updateDpad(point);
        } else {
            this.#updateStick(point);
        }
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

        this.#releaseTouch();
    }

    #releaseTouch() {
        this.#updateDirections([]);
        this.#sector = null;
        this.#activeTouchId = null;
        this.#setHintVisible(true);
        this.refresh();
    }

    #measure() {
        const rect = this.el.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
            return false;
        }
        this.#rect = rect;

        const viewportMin = Math.min(window.innerWidth, window.innerHeight);
        const preferred = Math.min(
            Math.max(viewportMin * QuickshotComponent.#BASE_SIZE_VIEWPORT_RATIO, QuickshotComponent.#MIN_BASE_SIZE),
            QuickshotComponent.#MAX_BASE_SIZE
        );
        const baseSize = Math.min(preferred, rect.width, rect.height);
        const thumbSize = baseSize * QuickshotComponent.#THUMB_SIZE_RATIO;
        const dpadSize = Math.min(preferred * QuickshotComponent.#DPAD_SIZE_RATIO, rect.width, rect.height);

        this.#setSize(this.#joystickBase, baseSize);
        this.#setSize(this.#joystickThumb, thumbSize);
        this.#layoutDpad(dpadSize);
        this.#radius = (this.#placement === QuickshotComponent.Placement.STATIC ? dpadSize : baseSize) / 2;

        const zone = this.#getZoneRect();
        const insets = this.#getSafeInsets();
        const offset = this.#radius * QuickshotComponent.#HOME_OFFSET;
        const minX = this.#radius;
        const maxX = rect.width - this.#radius;
        const minY = this.#radius;
        const maxY = rect.height - this.#radius;
        this.#home = {
            x: Math.min(Math.max(zone.left + insets.left + offset, minX), Math.max(minX, maxX)),
            y: Math.min(Math.max(this.#getHomeY(zone, insets, offset), minY), Math.max(minY, maxY))
        };
        return true;
    }

    // Static home height: level with the action buttons' axis (alignTo), but not too close to the bottom edge.
    #getHomeY(zone, insets, offset) {
        const lowest = zone.bottom - insets.bottom - this.#radius * QuickshotComponent.#HOME_MIN_BOTTOM_OFFSET;
        const alignRect = this.#alignTo?.()?.getBoundingClientRect();
        if (alignRect && alignRect.height > 0) {
            return Math.min(alignRect.top + alignRect.height / 2 - this.#rect.top, lowest);
        }
        return zone.bottom - insets.bottom - offset;
    }

    #setSize(element, size) {
        element.style.width = `${size}px`;
        element.style.height = `${size}px`;
        element.style.left = `${-size / 2}px`;
        element.style.top = `${-size / 2}px`;
    }

    #getZoneRect() {
        const width = this.#rect.width;
        const height = this.#rect.height;
        const portrait = window.matchMedia
            ? window.matchMedia('(orientation: portrait)').matches
            : height > width;
        const fractions = (portrait ? this.#zone?.portrait : this.#zone?.landscape) ?? this.#zone;
        const f = {
            left: fractions?.left ?? 0,
            top: fractions?.top ?? 0,
            right: fractions?.right ?? 1,
            bottom: fractions?.bottom ?? 1
        };
        return {
            left: f.left * width,
            top: f.top * height,
            right: f.right * width,
            bottom: f.bottom * height
        };
    }

    // Safe-area insets (notch, home indicator) that overlap this element.
    #getSafeInsets() {
        const probe = this.#insetProbe;
        const safeLeft = probe.offsetWidth;
        const safeBottom = probe.offsetHeight;
        return {
            left: Math.max(0, safeLeft - this.#rect.left),
            bottom: Math.max(0, safeBottom - (window.innerHeight - this.#rect.bottom))
        };
    }

    #isInZone(point) {
        const zone = this.#getZoneRect();
        return point.x >= zone.left && point.x <= zone.right &&
            point.y >= zone.top && point.y <= zone.bottom;
    }

    #getLocalPoint(touch) {
        const rect = this.#rect || this.el.getBoundingClientRect();
        return {
            x: touch.clientX - rect.left,
            y: touch.clientY - rect.top
        };
    }

    #createStickElements() {
        const probe = document.createElement('div');
        probe.style.position = 'absolute';
        probe.style.left = '0';
        probe.style.bottom = '0';
        probe.style.width = 'env(safe-area-inset-left, 0px)';
        probe.style.height = 'env(safe-area-inset-bottom, 0px)';
        probe.style.visibility = 'hidden';
        probe.style.pointerEvents = 'none';
        this.el.appendChild(probe);
        this.#insetProbe = probe;

        const stick = document.createElement('div');
        stick.style.position = 'absolute';
        stick.style.left = '0';
        stick.style.top = '0';
        stick.style.width = '0';
        stick.style.height = '0';
        stick.style.display = 'none';
        stick.style.pointerEvents = 'none';
        stick.style.transition = 'opacity 120ms ease';
        stick.style.willChange = 'transform';

        const base = document.createElement('div');
        base.style.position = 'absolute';
        base.style.boxSizing = 'border-box';
        base.style.border = '2px solid rgba(255, 255, 255, 0.25)';
        base.style.borderRadius = '50%';
        base.style.background = 'rgba(136, 136, 136, 0.07)';
        stick.appendChild(base);

        const thumb = document.createElement('div');
        thumb.style.position = 'absolute';
        thumb.style.borderRadius = '50%';
        thumb.style.background = QuickshotComponent.#IDLE_FILL;
        thumb.style.willChange = 'transform';
        stick.appendChild(thumb);

        this.el.appendChild(stick);
        this.#stick = stick;
        this.#joystickBase = base;
        this.#joystickThumb = thumb;

        this.#createDpadElements();
    }

    #createDpadElements() {
        const dpad = document.createElement('div');
        dpad.style.position = 'absolute';
        dpad.style.left = '0';
        dpad.style.top = '0';
        dpad.style.width = '0';
        dpad.style.height = '0';
        dpad.style.display = 'none';
        dpad.style.pointerEvents = 'none';
        dpad.style.transition = 'opacity 120ms ease';

        const center = document.createElement('div');
        center.style.position = 'absolute';
        center.style.background = QuickshotComponent.#IDLE_FILL;
        dpad.appendChild(center);

        // Arrow triangles drawn with borders; `side` is the border that forms the visible triangle.
        const arrowSide = { up: 'borderBottom', down: 'borderTop', left: 'borderRight', right: 'borderLeft' };
        ['up', 'down', 'left', 'right'].forEach((direction) => {
            const arm = document.createElement('div');
            arm.style.position = 'absolute';
            arm.style.display = 'flex';
            arm.style.alignItems = 'center';
            arm.style.justifyContent = 'center';
            arm.style.background = QuickshotComponent.#IDLE_FILL;

            const arrow = document.createElement('div');
            arrow.style.width = '0';
            arrow.style.height = '0';
            arrow.dataset.side = arrowSide[direction];
            arm.appendChild(arrow);

            dpad.appendChild(arm);
            this.#dpadArms[direction] = arm;
        });

        this.el.appendChild(dpad);
        this.#dpad = dpad;
        this.#dpadArms.center = center;
    }

    #layoutDpad(size) {
        const half = size / 2;
        const armWidth = size * QuickshotComponent.#DPAD_ARM_WIDTH;
        const armHalf = armWidth / 2;
        const gap = 2;
        const armLength = half - armHalf - gap;
        const corner = `${Math.round(armWidth * 0.25)}px`;
        const arrowSize = armWidth * 0.2;

        const place = (element, left, top, width, height) => {
            element.style.left = `${left}px`;
            element.style.top = `${top}px`;
            element.style.width = `${width}px`;
            element.style.height = `${height}px`;
        };
        place(this.#dpadArms.center, -armHalf, -armHalf, armWidth, armWidth);
        place(this.#dpadArms.up, -armHalf, -half, armWidth, armLength);
        place(this.#dpadArms.down, -armHalf, armHalf + gap, armWidth, armLength);
        place(this.#dpadArms.left, -half, -armHalf, armLength, armWidth);
        place(this.#dpadArms.right, armHalf + gap, -armHalf, armLength, armWidth);

        this.#dpadArms.up.style.borderRadius = `${corner} ${corner} 0 0`;
        this.#dpadArms.down.style.borderRadius = `0 0 ${corner} ${corner}`;
        this.#dpadArms.left.style.borderRadius = `${corner} 0 0 ${corner}`;
        this.#dpadArms.right.style.borderRadius = `0 ${corner} ${corner} 0`;

        ['up', 'down', 'left', 'right'].forEach((direction) => {
            const arrow = this.#dpadArms[direction].firstChild;
            const side = arrow.dataset.side;
            arrow.style.border = `${arrowSize}px solid transparent`;
            arrow.style[side] = `${arrowSize * 1.3}px solid rgba(255, 255, 255, 0.35)`;
            // Collapse the border opposite to the visible one so the triangle stays centered.
            const opposite = { borderBottom: 'borderTop', borderTop: 'borderBottom', borderLeft: 'borderRight', borderRight: 'borderLeft' }[side];
            arrow.style[opposite] = '0';
        });
    }

    #showIdle() {
        const isStatic = this.#placement === QuickshotComponent.Placement.STATIC;
        this.#setThumbOffset(0, 0);
        this.#joystickThumb.style.background = QuickshotComponent.#IDLE_FILL;
        this.#stick.style.display = 'none';
        this.#highlightDpad(null);

        if (!isStatic) {
            this.#dpad.style.display = 'none';
            return;
        }
        this.#dpad.style.transform = `translate(${this.#home.x}px, ${this.#home.y}px)`;
        this.#dpad.style.opacity = QuickshotComponent.#DPAD_IDLE_OPACITY;
        this.#dpad.style.display = 'block';
    }

    #highlightDpad(sector) {
        const pressed = sector === null ? [] : SECTOR_DIRECTIONS[sector];
        ['up', 'down', 'left', 'right'].forEach((direction) => {
            this.#dpadArms[direction].style.background = pressed.includes(direction)
                ? QuickshotComponent.#ACTIVE_FILL
                : QuickshotComponent.#IDLE_FILL;
        });
    }

    // D-pad: direction from the angle around the fixed home center, no following.
    #updateDpad(point) {
        const dx = point.x - this.#home.x;
        const dy = point.y - this.#home.y;
        const sector = this.#resolveSector(dx, dy,
            QuickshotComponent.#DPAD_DEAD_ZONE_ENGAGE, QuickshotComponent.#DPAD_DEAD_ZONE_RELEASE);

        if (sector !== this.#sector) {
            this.#sector = sector;
            this.#highlightDpad(sector);
            this.#updateDirections(sector === null ? [] : SECTOR_DIRECTIONS[sector]);
        }
    }

    #moveStickTo(point) {
        this.#center = { x: point.x, y: point.y };
        this.#stick.style.transform = `translate(${point.x}px, ${point.y}px)`;
    }

    #setThumbOffset(x, y) {
        this.#joystickThumb.style.transform = `translate(${x}px, ${y}px)`;
    }

    #updateStick(point) {
        let dx = point.x - this.#center.x;
        let dy = point.y - this.#center.y;
        let distance = Math.hypot(dx, dy);

        // Drag the base along so the finger never gets further than the follow radius.
        const followRadius = this.#radius * QuickshotComponent.#FOLLOW_RADIUS;
        if (distance > followRadius) {
            const shift = 1 - followRadius / distance;
            this.#moveStickTo({ x: this.#center.x + dx * shift, y: this.#center.y + dy * shift });
            dx = point.x - this.#center.x;
            dy = point.y - this.#center.y;
            distance = followRadius;
        }
        const thumbScale = 1 / QuickshotComponent.#FOLLOW_RADIUS;

        let thumbX = dx * thumbScale;
        let thumbY = dy * thumbScale;
        const thumbDistance = distance * thumbScale;
        if (thumbDistance > this.#radius) {
            const ratio = this.#radius / thumbDistance;
            thumbX *= ratio;
            thumbY *= ratio;
        }
        this.#setThumbOffset(thumbX, thumbY);

        const sector = this.#resolveSector(dx, dy,
            QuickshotComponent.#DEAD_ZONE_ENGAGE, QuickshotComponent.#DEAD_ZONE_RELEASE);

        if (sector !== this.#sector) {
            this.#sector = sector;
            this.#joystickThumb.style.background = sector === null
                ? QuickshotComponent.#IDLE_FILL
                : QuickshotComponent.#ACTIVE_FILL;
            this.#updateDirections(sector === null ? [] : SECTOR_DIRECTIONS[sector]);
        }
    }

    // Dead zone with hysteresis (engage/release, relative to the radius), then the angular sector.
    #resolveSector(dx, dy, engageRatio, releaseRatio) {
        const threshold = this.#radius * (this.#sector === null ? engageRatio : releaseRatio);
        if (Math.hypot(dx, dy) < threshold) {
            return null;
        }
        let angle = Math.atan2(dy, dx) * (180 / Math.PI);
        if (angle < 0) angle += 360;
        return this.#getSector(angle);
    }

    static #sectorHalfAngle(sector) {
        return sector % 2 === 0
            ? QuickshotComponent.#CARDINAL_HALF_ANGLE
            : QuickshotComponent.#DIAGONAL_HALF_ANGLE;
    }

    static #angleDistance(a, b) {
        const diff = Math.abs(a - b) % 360;
        return diff > 180 ? 360 - diff : diff;
    }

    #getSector(angleDeg) {
        const current = this.#sector;
        if (current !== null &&
            QuickshotComponent.#angleDistance(angleDeg, current * 45) <=
            QuickshotComponent.#sectorHalfAngle(current) + QuickshotComponent.#ANGLE_HYSTERESIS) {
            return current;
        }
        for (let sector = 0; sector < SECTOR_DIRECTIONS.length; sector++) {
            if (QuickshotComponent.#angleDistance(angleDeg, sector * 45) <= QuickshotComponent.#sectorHalfAngle(sector)) {
                return sector;
            }
        }
        return Math.round(angleDeg / 45) % SECTOR_DIRECTIONS.length;
    }

    #setHintVisible(visible) {
        if (this.#hint && this.#showHint) {
            this.#hint.style.opacity = visible ? '1' : '0';
        }
    }

    #updateDirections(newDirections) {
        const newDirectionsSet = new Set(newDirections);

        const keysToRelease = new Set([...this.#activeDirections].filter(x => !newDirectionsSet.has(x)));
        const keysToPress = new Set([...newDirectionsSet].filter(x => !this.#activeDirections.has(x)));

        keysToRelease.forEach(direction => {
            this.#keyUp(direction);
            this.#activeDirections.delete(direction);
        });

        keysToPress.forEach(direction => {
            this.#keyDown(direction);
            this.#activeDirections.add(direction);
        });
    }

    #keyDown(direction) {
        if (this.#mode === 'keyboard') {
            const mapping = this.#mapping[direction];
            if (!mapping) return;
            const identifier = this.#keyIdentifier(mapping);
            if (this.#keysDown.has(identifier)) return;
            this.#keysDown.add(identifier);
            this.#dispatchKeyboardEvent('keydown', mapping);
            return;
        }
        if (this.#nostalgist) {
            this.#nostalgist.pressDown(direction);
        }
    }

    #keyUp(direction) {
        if (this.#mode === 'keyboard') {
            const mapping = this.#mapping[direction];
            if (!mapping) return;
            const identifier = this.#keyIdentifier(mapping);
            if (!this.#keysDown.has(identifier)) return;
            this.#keysDown.delete(identifier);
            this.#dispatchKeyboardEvent('keyup', mapping);
            return;
        }
        if (this.#nostalgist) {
            this.#nostalgist.pressUp(direction);
        }
    }

    #initializeInputMode(platformManager, options) {
        const mode = options?.mode === 'keyboard' ? 'keyboard' : 'nostalgist';
        this.#mode = mode;

        if (mode === 'keyboard') {
            this.#mapping = this.#buildMapping(options?.keys);
        } else {
            this.#nostalgist = platformManager.getNostalgist();
            this.#mapping = this.#buildMapping();
        }
    }

    #buildMapping(customKeys = {}) {
        const result = {};
        Object.keys(DEFAULT_KEYMAP).forEach((dir) => {
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
        if (this.#mode !== 'keyboard' || this.#keysDown.size === 0) return;
        this.#keysDown.forEach((identifier) => {
            const [key, code, keyCode] = identifier.split('|');
            this.#dispatchKeyboardEvent('keyup', { key, code, keyCode: Number(keyCode) });
        });
        this.#keysDown.clear();
    }
}
