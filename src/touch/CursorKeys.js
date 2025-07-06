import { s, show, hide } from '../dom.js';
import { SingleTouchButton } from "./SingleTouchButton";
import { SingleTouchButtonKbListener } from './SingleTouchButtonKbListener.js';
import { KeyMaps } from './KeyMaps.js';

export class CursorKeys {
    static #DEAD_ZONE_RADIUS = 30;

    #keyConfig;
    #fireAListener;
    #fireAB1Listener;
    #fireAB2Listener;
    #fireA;
    #fireAB1;
    #fireAB2;
    #target;

    #joystickBase;
    #joystickThumb;
    #joystickContainer;
    #activeTouchId = null;
    #activeDirections = new Set();

    #platform_manager;

    constructor(platform_manager) {
        this.#platform_manager = platform_manager;
        this.#target = s('canvas');
        this.#init();
        this.#activeDirections = new Set();
    }

    #init() {
        var bottomContainer = document.createElement('div');
        bottomContainer.id = 'cursorkeys';
        bottomContainer.style.display = 'none';
        bottomContainer.style.position = 'fixed';
        bottomContainer.style.right = '0';
        bottomContainer.style.bottom = '0';
        bottomContainer.style.width = '100%';
        bottomContainer.style.height = '100%';
        bottomContainer.style.display = 'none';
        bottomContainer.style.gap = '2px';
        bottomContainer.style.zIndex = '7777';
        bottomContainer.style.textAlign = 'center';
        bottomContainer.style.fontFamily = "Helvetica, Arial, sans-serif !important";
        bottomContainer.style.justifyContent = 'center';
        bottomContainer.style.gridTemplateColumns = 'repeat(50, 1fr)';
        bottomContainer.style.gridTemplateRows = 'repeat(50, 1fr)';
        bottomContainer.style.pointerEvents = 'none';

        if (this.#platform_manager.getSelectedPlatform().platform_id == "spectrum") {
            const DEF = KeyMaps.ZX_CURSOR;
            this.#keyConfig = DEF;
            this.#fireAListener = new SingleTouchButtonKbListener(DEF.a.key, DEF.a.code, DEF.a.keyCode, s('canvas'));
            this.#fireA = new SingleTouchButton(bottomContainer, 'FIRE', undefined, 'cursorbf', this.#fireAListener);
        } else if (this.#platform_manager.getSelectedPlatform().platform_id == "xt") {
            const DEF = KeyMaps.XT_ARROWS_SPACE_RETURN;
            this.#keyConfig = DEF;
            this.#fireAB1Listener = new SingleTouchButtonKbListener(' ', 'Space', '32', s('canvas'));
            this.#fireAB2Listener = new SingleTouchButtonKbListener('Enter', 'Enter', '13', s('canvas'));
            this.#fireAB1 = new SingleTouchButton(bottomContainer, 'SPACE', undefined, 'cursorb1', this.#fireAB1Listener);
            this.#fireAB2 = new SingleTouchButton(bottomContainer, 'RETURN', undefined, 'cursorb2', this.#fireAB2Listener)
        } else {
            new SingleTouchButton(bottomContainer, 'SPACE', undefined, 'cursorb1', new SingleTouchButtonKbListener(' ', 'Space', '32', s('canvas')));
            new SingleTouchButton(bottomContainer, 'ENTER', undefined, 'cursorb2', new SingleTouchButtonKbListener('Enter', 'Enter', '13', s('canvas')));
            this.#keyConfig = this.#platform_manager.getSelectedPlatform().arrow_keys;
        }

        document.body.appendChild(bottomContainer);

        this.#joystickContainer = document.createElement('div');
        this.#joystickContainer.id = 'cursors';
        this.#joystickContainer.style.overflow = 'hidden';
        this.#joystickContainer.style.position = 'absolute';
        this.#joystickContainer.style.right = '0';
        this.#joystickContainer.style.bottom = '0';
        this.#joystickContainer.style.width = '100%';
        this.#joystickContainer.style.height = '100%';
        this.#joystickContainer.style.zIndex = '666';
        this.#joystickContainer.style.display = 'none';
        document.body.appendChild(this.#joystickContainer);

        this.#joystickContainer.addEventListener('touchstart', this.#onTouchStart);
        this.#joystickContainer.addEventListener('touchmove', this.#onTouchMove);
        this.#joystickContainer.addEventListener('touchend', this.#onTouchEnd);
        this.#joystickContainer.addEventListener('touchcancel', this.#onTouchEnd);
    }

    updateKeyMap(value) {
        const keyMap = this.#platform_manager.getSelectedPlatform().touch_key_mapping.keyMap[value];

        if (keyMap) {
            this.#keyConfig = keyMap;

            if (this.#keyConfig.b != undefined) {
                this.#fireAB1.setLabel(keyMap.a.label);
                this.#fireAB1Listener.updateKeyMapping(keyMap.a);
                this.#fireAB2.setLabel(keyMap.b.label);
                this.#fireAB2Listener.updateKeyMapping(keyMap.b);
            } else {
                this.#fireA.setLabel('FIRE');
                this.#fireAListener.updateKeyMapping(keyMap.a);
            }
        }
    }

    show() {
        show("#cursorkeys", "grid");
        show("#cursors", "block");
    }

    hide() {
        hide("#cursorkeys");
        hide("#cursors");
    }

    #getDistance(point1, point2) {
        let dx = point2.x - point1.x;
        let dy = point2.y - point1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    #getDirections(angleDeg) {
        if (angleDeg >= 337.5 || angleDeg < 22.5) {
            return ['right'];
        } else if (angleDeg >= 22.5 && angleDeg < 67.5) {
            return ['right', 'down'];
        } else if (angleDeg >= 67.5 && angleDeg < 112.5) {
            return ['down'];
        } else if (angleDeg >= 112.5 && angleDeg < 157.5) {
            return ['down', 'left'];
        } else if (angleDeg >= 157.5 && angleDeg < 202.5) {
            return ['left'];
        } else if (angleDeg >= 202.5 && angleDeg < 247.5) {
            return ['left', 'up'];
        } else if (angleDeg >= 247.5 && angleDeg < 292.5) {
            return ['up'];
        } else {
            return ['up', 'right'];
        }
    }

    #createJoystickElements(touch) {
        this.#joystickBase = document.createElement('div');
        this.#joystickBase.classList.add('cursor-base');
        this.#joystickBase.style.left = `${touch.pageX - 50}px`;
        this.#joystickBase.style.top = `${touch.pageY - 50}px`;
        this.#joystickContainer.appendChild(this.#joystickBase);

        this.#joystickThumb = document.createElement('div');
        this.#joystickThumb.classList.add('cursor-thumb');
        this.#joystickThumb.style.left = `${touch.pageX - 25}px`;
        this.#joystickThumb.style.top = `${touch.pageY - 25}px`;
        this.#joystickContainer.appendChild(this.#joystickThumb);
    }

    #onTouchEnd = (event) => {
        event.preventDefault();
        for (let touch of event.changedTouches) {
            if (touch.identifier === this.#activeTouchId) {
                this.#updateDirections([]);
                if (this.#joystickBase && this.#joystickThumb) {
                    this.#joystickBase.remove();
                    this.#joystickThumb.remove();
                }
                this.#activeTouchId = null;
            }
        }
    }

    #onTouchStart = (event) => {
        event.preventDefault();
        if (this.#activeTouchId === null) {
            for (let touch of event.touches) {
                if (touch.target.id === 'cursors') {
                    this.#activeTouchId = touch.identifier;
                    this.#createJoystickElements(touch);
                    break;
                }
            }
        }
    }

    #onTouchMove = (event) => {
        event.preventDefault();
        for (let touch of event.touches) {
            if (touch.identifier === this.#activeTouchId) {
                let baseRect = this.#joystickBase.getBoundingClientRect();
                let baseCenter = {
                    x: baseRect.left + baseRect.width / 2,
                    y: baseRect.top + baseRect.height / 2
                };

                let distance = this.#getDistance(baseCenter, { x: touch.pageX, y: touch.pageY });

                if (distance > baseRect.width / 2) {
                    let angle = Math.atan2(touch.pageY - baseCenter.y, touch.pageX - baseCenter.x);
                    this.#joystickBase.style.left = `${touch.pageX - baseRect.width / 2 - Math.cos(angle) * baseRect.width / 2}px`;
                    this.#joystickBase.style.top = `${touch.pageY - baseRect.height / 2 - Math.sin(angle) * baseRect.height / 2}px`;
                }

                this.#joystickThumb.style.left = `${touch.pageX - 25}px`;
                this.#joystickThumb.style.top = `${touch.pageY - 25}px`;

                let angle = Math.atan2(touch.pageY - baseCenter.y, touch.pageX - baseCenter.x);
                let angleDeg = angle * (180 / Math.PI);
                if (angleDeg < 0) angleDeg += 360;

                if (distance > CursorKeys.#DEAD_ZONE_RADIUS) {
                    let directions = this.#getDirections(angleDeg);
                    this.#updateDirections(directions);
                } else {
                    this.#updateDirections([]);
                }
            }
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

    #simulateKeyEvent(direction, eventType) {
        const keyConfig = this.#keyConfig[direction];

        if (!keyConfig) return;

        const event = new KeyboardEvent(eventType, {
            key: keyConfig.key,
            code: keyConfig.code,
            keyCode: keyConfig.keyCode,
            charCode: keyConfig.keyCode,
            bubbles: true,
            cancelable: true
        });
        this.#target.dispatchEvent(event);
    }

    #keyDown(direction) {
        this.#simulateKeyEvent(direction, 'keydown');
    }

    #keyUp(direction) {
        this.#simulateKeyEvent(direction, 'keyup');
    }
}