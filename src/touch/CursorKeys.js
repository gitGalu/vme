import { s, show, hide } from '../dom.js';
import { SingleTouchButton } from "./SingleTouchButton";
import { SingleTouchButtonKbListener } from './SingleTouchButtonKbListener.js';
import { KeyMaps } from './KeyMaps.js';
import { CursorKeysComponent } from './CursorKeysComponent.js';

export class CursorKeys {
    #keyConfig;
    #fireAListener;
    #fireAB1Listener;
    #fireAB2Listener;
    #fireA;
    #fireAB1;
    #fireAB2;

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

        const selectedPlatform = this.#platform_manager.getSelectedPlatform();
        const platformId = selectedPlatform.platform_id;

        if (platformId === 'spectrum') {
            const DEF = KeyMaps.ZX_CURSOR;
            this.#keyConfig = DEF;
            this.#fireAListener = new SingleTouchButtonKbListener(DEF.a.key, DEF.a.code, DEF.a.keyCode, s('canvas'));
            this.#fireA = new SingleTouchButton(bottomContainer, 'FIRE', undefined, 'cursorbf', this.#fireAListener);
        } else if (platformId === 'xt') {
            const DEF = KeyMaps.XT_ARROWS_SPACE_RETURN;
            this.#keyConfig = DEF;
            this.#fireAB1Listener = new SingleTouchButtonKbListener(' ', 'Space', '32', s('canvas'));
            this.#fireAB2Listener = new SingleTouchButtonKbListener('Enter', 'Enter', '13', s('canvas'));
            this.#fireAB1 = new SingleTouchButton(bottomContainer, 'SPACE', undefined, 'cursorb1', this.#fireAB1Listener);
            this.#fireAB2 = new SingleTouchButton(bottomContainer, 'RETURN', undefined, 'cursorb2', this.#fireAB2Listener);
        } else {
            new SingleTouchButton(bottomContainer, 'SPACE', undefined, 'cursorb1', new SingleTouchButtonKbListener(' ', 'Space', '32', s('canvas')));
            new SingleTouchButton(bottomContainer, 'ENTER', undefined, 'cursorb2', new SingleTouchButtonKbListener('Enter', 'Enter', '13', s('canvas')));
            this.#keyConfig = selectedPlatform.arrow_keys;
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

    updateKeyMap(value) {
        const selected = this.#platform_manager.getSelectedPlatform();
        const mapping = selected.touch_key_mapping?.keyMap?.[value];

        if (mapping) {
            this.#keyConfig = mapping;

            if (mapping.b !== undefined) {
                this.#fireAB1?.setLabel(mapping.a.label ?? 'BTN1');
                this.#fireAB1Listener?.updateKeyMapping(mapping.a);
                this.#fireAB2?.setLabel(mapping.b.label ?? 'BTN2');
                this.#fireAB2Listener?.updateKeyMapping(mapping.b);
            } else if (mapping.a) {
                this.#fireA?.setLabel(mapping.a.label ?? 'FIRE');
                this.#fireAListener?.updateKeyMapping(mapping.a);
            }
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
