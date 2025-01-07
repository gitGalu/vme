import { s, show, hide } from '../dom.js';
import { SingleTouchButton } from "./SingleTouchButton";
import { SingleTouchButtonKbListener } from "./SingleTouchButtonKbListener";
import { SingleTouchButtonJoyListener } from "./SingleTouchButtonJoyListener";
import { FileUtils } from '../utils/FileUtils.js';

export class Mousepad {

    #platform_manager;
    #nostalgist;

    #lx = -1;
    #ly = -1;
    #mouseSpeed = 1;
    #activeTouchId = null;

    constructor(platform_manager) {
        this.#platform_manager = platform_manager;
        this.#nostalgist = platform_manager.getNostalgist();
        this.#init();
    }

    #init() {
        const bottomContainer = document.createElement('div');
        bottomContainer.id = 'mousepads';
        bottomContainer.style.position = 'fixed';
        bottomContainer.style.right = '0';
        bottomContainer.style.bottom = '0';
        bottomContainer.style.width = '100%';
        bottomContainer.style.height = '100%';
        bottomContainer.style.display = 'none';
        bottomContainer.style.zIndex = '7777';
        bottomContainer.style.pointerEvents = 'auto';
        bottomContainer.style.touchAction = 'none';

        const controller_overrides = this.#platform_manager.getSelectedPlatform().controller_overrides;
        const controller_types = this.#platform_manager.getSelectedPlatform().controller_types;
        const platform_id = this.#platform_manager.getSelectedPlatform().platform_id;
        let buttonsCount = 2;

        if (controller_overrides) {
            const program_id = this.#platform_manager.getProgramName();
            const button_overrides = this.#platform_manager.getSelectedPlatform().button_overrides;
            const key = FileUtils.getFilenameWithoutExtension(program_id);
            const controller_type = controller_overrides[key];
            const overriden_type = controller_types[controller_type];

            if ("lightgun" == overriden_type) {
                this.#mouseSpeed = 2.5;
                if (button_overrides && button_overrides[key] != undefined) {
                    buttonsCount = button_overrides[key];
                }
            }
        }

        const mousetouch = (e, started) => {
            if (started === false) {
                this.#lx = -1;
                this.#ly = -1;
                this.#activeTouchId = null;
            } else {
                var touch = e.changedTouches[0];
                var dx = touch.clientX * this.#mouseSpeed;
                var dy = touch.clientY * this.#mouseSpeed;
                if (this.#lx != -1 && this.#activeTouchId === touch.identifier) {
                    this.#simulateMouseMove(dx - this.#lx, dy - this.#ly);
                }
                this.#lx = dx;
                this.#ly = dy;
            }
        };

        bottomContainer.addEventListener('touchstart', (e) => {
            const touches = e.changedTouches;
            if (this.#activeTouchId === null) {
                const touch = touches[0];
                const targetId = e.target.id;
        
                const allowedTargetIds = ['lmb', 'rmb', 'mb1', 'mb31', 'mb32', 'mb33'];
        
                if (!targetId || !allowedTargetIds.includes(targetId)) {
                    this.#activeTouchId = touch.identifier;
                    mousetouch(e, true);
                } else {
                    e.stopPropagation();
                    e.preventDefault();
                }
            } else {
                e.stopPropagation();
                e.preventDefault();
            }
        });
        
        bottomContainer.addEventListener('touchmove', (e) => {
            const touches = Array.from(e.changedTouches).filter(touch => touch.identifier === this.#activeTouchId);
            if (touches.length > 0) {
                mousetouch(e, true);
            }
        });
        
        bottomContainer.addEventListener('touchend', (e) => {
            const touches = Array.from(e.changedTouches).filter(touch => touch.identifier === this.#activeTouchId);
            if (touches.length > 0) {
                e.preventDefault();
                mousetouch(e, false);
                this.#activeTouchId = null;
            }
        });
        
        bottomContainer.addEventListener('touchcancel', (e) => {
            const touches = Array.from(e.changedTouches).filter(touch => touch.identifier === this.#activeTouchId);
            if (touches.length > 0) {
                mousetouch(e, false);
                this.#activeTouchId = null;
            }
        });

        if (platform_id == "amiga") {
            new SingleTouchButton(bottomContainer, 'LMB', undefined, 'lmb', new SingleTouchButtonKbListener('F13', 'F13', '124', s('canvas')));
            new SingleTouchButton(bottomContainer, 'RMB', undefined, 'rmb', new SingleTouchButtonKbListener('F14', 'F14', '125', s('canvas')));
        } else if (platform_id == "mame") {
            if (buttonsCount == 1) {
                new SingleTouchButton(bottomContainer, '1', undefined, 'mb1', new SingleTouchButtonJoyListener(this.#nostalgist, 'b'));
            } else if (buttonsCount == 2) {
                new SingleTouchButton(bottomContainer, '1', undefined, 'lmb', new SingleTouchButtonJoyListener(this.#nostalgist, 'b'));
                new SingleTouchButton(bottomContainer, '2', undefined, 'rmb', new SingleTouchButtonJoyListener(this.#nostalgist, 'a'));
            } else {
                new SingleTouchButton(bottomContainer, '1', undefined, 'mb31', new SingleTouchButtonJoyListener(this.#nostalgist, 'b'));
                new SingleTouchButton(bottomContainer, '2', undefined, 'mb32', new SingleTouchButtonJoyListener(this.#nostalgist, 'a'));
                new SingleTouchButton(bottomContainer, '3', undefined, 'mb33', new SingleTouchButtonJoyListener(this.#nostalgist, 'c'));
            }
        }

        document.body.appendChild(bottomContainer);
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

    show() {
        show("#mousepads", "grid");
    }

    hide() {
        hide("#mousepads");
    }
}
