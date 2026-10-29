import { dispatchSyntheticKeyboardEvent, getSyntheticKeyboardTarget } from '../keyboard/SyntheticKeyboard.js';

// A tap pins the keypad open; a drag from the trigger selects on release.
export class KeypadTouchButton {
    #parent;
    #root;
    #trigger;
    #panel;
    #keys = new Map();
    #open = false;
    #gesture = null;
    #held = null;
    #preview = null;
    #pulseTimer = null;
    #closeAfterPulse = false;
    #events = new AbortController();
    #visibilityObserver;

    constructor(parent, config) {
        this.#parent = parent;
        this.#root = document.createElement('div');
        this.#root.id = 'fastkeypad';
        this.#root.dataset.interactiveElement = 'true';

        this.#trigger = document.createElement('button');
        this.#trigger.type = 'button';
        this.#trigger.tabIndex = -1;
        this.#trigger.className = 'fast-button fast-control fast-control--trigger touch-keypad__trigger';
        this.#trigger.innerHTML = '<span>KEYPAD</span>';
        this.#trigger.setAttribute('aria-controls', 'touch-keypad-panel');
        this.#trigger.setAttribute('aria-expanded', 'false');

        this.#panel = document.createElement('div');
        this.#panel.id = 'touch-keypad-panel';
        this.#panel.className = 'fast-popup touch-keypad__panel';
        this.#panel.hidden = true;
        this.#panel.setAttribute('role', 'group');
        this.#panel.setAttribute('aria-label', 'Keypad');

        for (const key of config.keys) {
            const button = document.createElement('button');
            button.type = 'button';
            button.tabIndex = -1;
            button.className = 'fast-button fast-control fast-control--option touch-keypad__key';
            button.textContent = key.label;
            button.setAttribute('aria-label', `Keypad ${key.label}`);
            this.#keys.set(button, key);
            this.#panel.appendChild(button);
        }
        this.#root.append(this.#trigger, this.#panel);
        parent.appendChild(this.#root);

        const options = { signal: this.#events.signal };
        document.addEventListener('pointerdown', event => {
            if (this.#open && !this.#root.contains(event.target)) this.close();
        }, { ...options, capture: true });
        this.#root.addEventListener('pointerdown', event => this.#pointerDown(event), options);
        window.addEventListener('pointermove', event => this.#pointerMove(event), options);
        window.addEventListener('pointerup', event => this.#pointerUp(event), options);
        window.addEventListener('pointercancel', event => this.#cancelPointer(event), options);
        this.#root.addEventListener('lostpointercapture', event => this.#cancelPointer(event), options);
        this.#root.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            // Pointer activation is handled above; support accessibility clicks too.
            if (event.detail !== 0) return;
            if (this.#trigger.contains(event.target)) {
                if (this.#open) this.close(); else this.#show();
            } else if (this.#keys.has(event.target)) {
                this.#pulse(event.target, false);
            }
        }, options);
        // Existing joystick controls use Touch Events. Keep keypad touches local.
        for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) {
            this.#root.addEventListener(type, event => {
                event.preventDefault();
                event.stopPropagation();
            }, { ...options, passive: false });
        }
        window.addEventListener('blur', () => this.close(), options);
        window.addEventListener('pagehide', () => this.close(), options);
        window.addEventListener('resize', () => this.close(), options);
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) this.close();
        }, options);
        this.#visibilityObserver = new MutationObserver(() => {
            if (this.#open && !this.#root.getClientRects().length) this.close();
        });
        this.#visibilityObserver.observe(parent, { attributes: true, attributeFilter: ['style', 'class'] });
        this.#visibilityObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }

    #show() {
        this.#open = true;
        this.#panel.hidden = false;
        this.#trigger.setAttribute('aria-expanded', 'true');
        this.#position();
    }

    #position() {
        const trigger = this.#trigger.getBoundingClientRect();
        const anchor = (this.#parent.querySelector('#fast1') || this.#trigger).getBoundingClientRect();
        const host = this.#parent.getBoundingClientRect();
        const padding = getComputedStyle(this.#parent);
        const left = host.left + (parseFloat(padding.paddingLeft) || 0) + 8;
        const top = host.top + (parseFloat(padding.paddingTop) || 0) + 8;
        const right = host.right - (parseFloat(padding.paddingRight) || 0) - 8;
        const bottom = host.bottom - (parseFloat(padding.paddingBottom) || 0) - 8;
        const panel = this.#panel.getBoundingClientRect();
        this.#panel.style.left = `${Math.max(left, Math.min(trigger.left - panel.width - 8, right - panel.width))}px`;
        this.#panel.style.top = `${Math.max(top, Math.min(anchor.top, bottom - panel.height))}px`;
    }

    #pointerDown(event) {
        if (event.button !== 0 || this.#gesture) return;
        const button = event.target.closest('button');
        if (button !== this.#trigger && !this.#keys.has(button)) return;
        event.preventDefault();
        event.stopPropagation();
        const closePending = this.#closeAfterPulse;
        this.#cancelPulse();
        if (closePending) this.close();
        const wasOpen = this.#open;
        if (!wasOpen) this.#show();
        this.#gesture = {
            id: event.pointerId, button, wasOpen,
            x: event.clientX, y: event.clientY, dragged: false
        };
        try { button.setPointerCapture(event.pointerId); } catch { /* Synthetic test events have no native pointer. */ }
        if (button !== this.#trigger) this.#hold(button);
    }

    #keyAt(event) {
        const button = document.elementFromPoint(event.clientX, event.clientY)?.closest('.touch-keypad__key');
        return this.#keys.has(button) ? button : null;
    }

    #pointerMove(event) {
        const gesture = this.#gesture;
        if (!gesture || gesture.id !== event.pointerId) return;
        event.preventDefault();
        event.stopPropagation();
        if (Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 10) gesture.dragged = true;
        const key = this.#keyAt(event);
        if (gesture.button === this.#trigger) {
            this.#setPreview(key);
        } else {
            this.#hold(key === gesture.button ? key : null);
        }
    }

    #pointerUp(event) {
        const gesture = this.#gesture;
        if (!gesture || gesture.id !== event.pointerId) return;
        event.preventDefault();
        event.stopPropagation();
        const selected = this.#keyAt(event);
        this.#finishGesture();
        if (gesture.button !== this.#trigger) return;
        if (selected) {
            this.#pulse(selected, !gesture.wasOpen);
        } else {
            const rect = this.#trigger.getBoundingClientRect();
            const onTrigger = event.clientX >= rect.left && event.clientX <= rect.right &&
                event.clientY >= rect.top && event.clientY <= rect.bottom;
            if (!onTrigger || gesture.dragged || gesture.wasOpen) this.close();
        }
    }

    #cancelPointer(event) {
        if (this.#gesture?.id === event.pointerId) this.close();
    }

    #finishGesture() {
        const gesture = this.#gesture;
        this.#gesture = null;
        this.#hold(null);
        this.#setPreview(null);
        if (gesture?.button.hasPointerCapture(gesture.id)) gesture.button.releasePointerCapture(gesture.id);
    }

    #setPreview(button) {
        this.#preview?.classList.remove('is-active');
        this.#preview = button;
        button?.classList.add('is-active');
    }

    #hold(button) {
        if (this.#held?.button === button) return;
        if (this.#held) {
            const { button: previous, key, target } = this.#held;
            this.#held = null;
            previous.classList.remove('is-active');
            dispatchSyntheticKeyboardEvent('keyup', { ...key, target });
        }
        if (button) {
            const key = this.#keys.get(button);
            const target = getSyntheticKeyboardTarget(document);
            this.#held = { button, key, target };
            button.classList.add('is-active');
            dispatchSyntheticKeyboardEvent('keydown', { ...key, target });
        }
    }

    #pulse(button, closeAfter) {
        this.#cancelPulse();
        this.#closeAfterPulse = closeAfter;
        this.#hold(button);
        // A drag's down/up at the same instant could fall between core polls.
        this.#pulseTimer = setTimeout(() => {
            this.#pulseTimer = null;
            this.#closeAfterPulse = false;
            this.#hold(null);
            if (closeAfter) this.close();
        }, 80);
    }

    #cancelPulse() {
        clearTimeout(this.#pulseTimer);
        this.#pulseTimer = null;
        this.#closeAfterPulse = false;
        this.#hold(null);
    }

    close() {
        this.#finishGesture();
        this.#cancelPulse();
        this.#open = false;
        this.#panel.hidden = true;
        this.#trigger.setAttribute('aria-expanded', 'false');
    }

    destroy() {
        this.close();
        this.#events.abort();
        this.#visibilityObserver.disconnect();
        this.#root.remove();
    }
}
