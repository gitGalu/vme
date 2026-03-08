import { s, show, hide } from '../dom.js';
import { SingleTouchButton } from "./SingleTouchButton";
import { SingleTouchButtonKbListener } from './SingleTouchButtonKbListener.js';
import { CursorKeysComponent } from './CursorKeysComponent.js';

export class CursorKeys {
    #keyConfig;
    #fireAListener;
    #fireAB1Listener;
    #fireAB2Listener;
    #fireA;
    #fireAB1;
    #fireAB2;
    #bottomContainer;

    #joystickContainer;
    #joystickComponent;

    #platform_manager;

    constructor(platform_manager) {
        this.#platform_manager = platform_manager;
        this.#init();
    }

    #init() {
        const bottomContainer = document.createElement('div');
        bottomContainer.id = 'cursorkeys';
        bottomContainer.style.display = 'none';
        bottomContainer.style.position = 'fixed';
        bottomContainer.style.right = '0';
        bottomContainer.style.bottom = '0';
        bottomContainer.style.width = '100%';
        bottomContainer.style.height = '100%';
        bottomContainer.style.gap = '2px';
        bottomContainer.style.zIndex = '7777';
        bottomContainer.style.textAlign = 'center';
        bottomContainer.style.fontFamily = "Helvetica, Arial, sans-serif !important";
        bottomContainer.style.justifyContent = 'center';
        bottomContainer.style.gridTemplateColumns = 'repeat(50, 1fr)';
        bottomContainer.style.gridTemplateRows = 'repeat(50, 1fr)';
        bottomContainer.style.pointerEvents = 'none';
        this.#bottomContainer = bottomContainer;

        const selectedPlatform = this.#platform_manager.getSelectedPlatform();
        const defaultMapping = selectedPlatform.touch_key_mapping?.default;
        this.#keyConfig = defaultMapping || selectedPlatform.arrow_keys;
        this.#setActionButtons(defaultMapping);

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
        this.#joystickContainer.style.pointerEvents = 'auto';
        document.body.appendChild(this.#joystickContainer);

        this.#joystickComponent = new CursorKeysComponent(
            this.#joystickContainer,
            null,
            'cursor-stick',
            this.#platform_manager,
            { keys: this.#keyConfig, showHint: false, target: s('canvas') }
        );

        this.#joystickComponent.setKeys(this.#keyConfig);
    }

    #clearActionButtons() {
        this.#fireA?.el?.remove();
        this.#fireAB1?.el?.remove();
        this.#fireAB2?.el?.remove();

        this.#fireA = undefined;
        this.#fireAB1 = undefined;
        this.#fireAB2 = undefined;
        this.#fireAListener = undefined;
        this.#fireAB1Listener = undefined;
        this.#fireAB2Listener = undefined;
    }

    #setActionButtons(mapping) {
        this.#clearActionButtons();

        if (!this.#bottomContainer) {
            return;
        }

        const target = s('canvas');
        const hasPrimaryAction = mapping && typeof mapping.a === 'object';
        const hasSecondaryAction = mapping && typeof mapping.b === 'object';

        if (hasPrimaryAction && hasSecondaryAction) {
            const a = mapping.a;
            const b = mapping.b;
            this.#fireAB1Listener = new SingleTouchButtonKbListener(a.key, a.code, a.keyCode, target);
            this.#fireAB2Listener = new SingleTouchButtonKbListener(b.key, b.code, b.keyCode, target);
            this.#fireAB1 = new SingleTouchButton(this.#bottomContainer, a.label ?? 'BTN1', undefined, 'cursorb1', this.#fireAB1Listener);
            this.#fireAB2 = new SingleTouchButton(this.#bottomContainer, b.label ?? 'BTN2', undefined, 'cursorb2', this.#fireAB2Listener);
            return;
        }

        if (hasPrimaryAction) {
            const a = mapping.a;
            this.#fireAListener = new SingleTouchButtonKbListener(a.key, a.code, a.keyCode, target);
            this.#fireA = new SingleTouchButton(this.#bottomContainer, a.label ?? 'FIRE', undefined, 'cursorbf', this.#fireAListener);
            return;
        }

        this.#fireAB1Listener = new SingleTouchButtonKbListener(' ', 'Space', '32', target);
        this.#fireAB2Listener = new SingleTouchButtonKbListener('Enter', 'Enter', '13', target);
        this.#fireAB1 = new SingleTouchButton(this.#bottomContainer, 'SPACE', undefined, 'cursorb1', this.#fireAB1Listener);
        this.#fireAB2 = new SingleTouchButton(this.#bottomContainer, 'ENTER', undefined, 'cursorb2', this.#fireAB2Listener);
    }

    updateKeyMap(value) {
        const selected = this.#platform_manager.getSelectedPlatform();
        const mapping = selected.touch_key_mapping?.keyMap?.[value];

        if (mapping) {
            this.#keyConfig = mapping;
            this.#setActionButtons(mapping);
        }

        this.#joystickComponent?.setKeys(this.#keyConfig);
    }

    show() {
        show('#cursorkeys', 'grid');
        show('#cursors', 'block');
    }

    hide() {
        hide('#cursorkeys');
        hide('#cursors');
        this.#joystickComponent?.cancelActiveTouch?.();
    }
}
