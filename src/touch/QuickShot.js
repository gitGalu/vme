import { s, show, hide } from '../dom.js';
import { SingleTouchButton } from "./SingleTouchButton";
import { DualTouchButton } from "./DualTouchButton";
import { SingleTouchButtonJoyListener } from "./SingleTouchButtonJoyListener";
import { DualTouchButtonJoyListener } from "./DualTouchButtonJoyListener";

export class QuickShot {
    static #DEAD_ZONE_RADIUS = 30;

    #platform_manager;
    #nostalgist;

    #joystickBase;
    #joystickThumb;
    #joystickContainer;
    #activeTouchId = null;
    #activeDirections = new Set();

    constructor(platform_manager) {
        this.#platform_manager = platform_manager;
        this.#nostalgist = platform_manager.getNostalgist();
        this.#init();
        this.#activeDirections = new Set();
    }

    #init() {
        var bottomContainer = document.createElement('div');
        bottomContainer.id = 'quickshots';
        bottomContainer.style.display = 'none';
        bottomContainer.style.position = 'fixed';
        bottomContainer.style.right = '0';
        bottomContainer.style.bottom = '0';
        bottomContainer.style.width = '100%';
        bottomContainer.style.height = '100%';
        bottomContainer.style.display = 'none';
        bottomContainer.style.gap = '2px';
        bottomContainer.style.zIndex = '2147483647';
        bottomContainer.style.textAlign = 'center';
        bottomContainer.style.fontFamily = "Helvetica, Arial, sans-serif !important";
        bottomContainer.style.justifyContent = 'center';
        bottomContainer.style.gridTemplateColumns = 'repeat(23, 1fr)';
        bottomContainer.style.gridTemplateRows = 'repeat(10, 1fr)';
        bottomContainer.style.pointerEvents = 'none';

        if (this.#platform_manager.getSelectedPlatform().fire_buttons == 2) {
            new DualTouchButton(bottomContainer, true, 'B', 'A', undefined, 'qsab', new DualTouchButtonJoyListener(this.#nostalgist, 'b', 'a'), '12px');
        } else if (this.#platform_manager.getSelectedPlatform().fire_buttons == 1) {
            new SingleTouchButton(bottomContainer, 'A', undefined, 'qsa', new SingleTouchButtonJoyListener(this.#nostalgist, 'b'));
        } else if (this.#platform_manager.getSelectedPlatform().fire_buttons == 4) {
            new DualTouchButton(bottomContainer, true, 'B', 'A', undefined, 'qsab4', new DualTouchButtonJoyListener(this.#nostalgist, 'b', 'a'), '12px');
            new DualTouchButton(bottomContainer, true, 'Y', 'X', undefined, 'qsxy4', new DualTouchButtonJoyListener(this.#nostalgist, 1, 9), '12px');
        }

        document.body.appendChild(bottomContainer);

        this.#joystickContainer = document.createElement('div');
        this.#joystickContainer.style.display = 'non';
        this.#joystickContainer.id = 'quickshot';
        this.#joystickContainer.style.position = 'absolute';
        this.#joystickContainer.style.right = '0';
        this.#joystickContainer.style.bottom = '0';
        this.#joystickContainer.style.width = '100%';
        this.#joystickContainer.style.height = '100%';
        this.#joystickContainer.style.height = '375px !important';
        this.#joystickContainer.style.zIndex = '2147483640';
        this.#joystickContainer.style.display = 'none';
        document.body.appendChild(this.#joystickContainer);

        this.#joystickContainer.addEventListener('touchstart', this.#onTouchStart);
        this.#joystickContainer.addEventListener('touchmove', this.#onTouchMove);
        this.#joystickContainer.addEventListener('touchend', this.#onTouchEnd);   
        this.#joystickContainer.addEventListener('touchcancel', this.#onTouchEnd);
    }

    show() {
        show("#quickshots", "grid");
        show("#quickshot", "block");
    }

    hide() {
        hide("#quickshot");
        hide("#quickshots");
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
        this.#joystickBase.classList.add('joystick-base');
        this.#joystickBase.style.left = `${touch.pageX - 50}px`;
        this.#joystickBase.style.top = `${touch.pageY - 50}px`;
        this.#joystickContainer.appendChild(this.#joystickBase);

        this.#joystickThumb = document.createElement('div');
        this.#joystickThumb.classList.add('joystick-thumb');
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
                if (touch.target.id === 'quickshot') {
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

                if (distance > QuickShot.#DEAD_ZONE_RADIUS) {
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

    #keyDown(dir) {
        this.#nostalgist.pressDown(dir);
    }

    #keyUp(dir) {
        this.#nostalgist.pressUp(dir);
    }
}