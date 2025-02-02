import { s, show, hide } from '../dom.js';
import { SingleTouchButton } from "./SingleTouchButton";
import { DualTouchButton } from "./DualTouchButton";
import { SingleTouchButtonJoyListener } from "./SingleTouchButtonJoyListener";
import { DualTouchButtonJoyListener } from "./DualTouchButtonJoyListener";
import { SingleTouchButtonKbListener } from './SingleTouchButtonKbListener.js';
import { DualTouchButtonKbListener } from './DualTouchButtonKbListener.js';
import { KeyMaps } from './KeyMaps.js';

export class QuickJoy {
    #platform_manager;

    #lrKbListener;
    #udKbListener;
    #fireKbListener;

    constructor(platform_manager) {
        this.#platform_manager = platform_manager;
        this.#init();
    }

    #init() {
        var bottomContainer = document.createElement('div');
        bottomContainer.id = 'quickjoys';
        bottomContainer.classList.add('secondary');
        bottomContainer.style.position = 'fixed';
        bottomContainer.style.right = '0';
        bottomContainer.style.bottom = '0';
        bottomContainer.style.width = '100%';
        bottomContainer.style.height = '100%';
        bottomContainer.style.display = 'grid';
        bottomContainer.style.gap = '2px';
        bottomContainer.style.zIndex = '7777';
        bottomContainer.style.textAlign = 'center';
        bottomContainer.style.fontFamily = "Helvetica, Arial, sans-serif !important";
        bottomContainer.style.justifyContent = 'center';
        bottomContainer.style.gridTemplateColumns = 'repeat(50, 1fr)';
        bottomContainer.style.gridTemplateRows = 'repeat(50, 1fr)';
        bottomContainer.style.pointerEvents = 'none';

        let btns = this.#platform_manager.getSelectedPlatform().fire_buttons;

        let platform_id = this.#platform_manager.getSelectedPlatform().platform_id;

        if (platform_id == "spectrum") {
            const DEF = KeyMaps.ZX_CURSOR;
            this.#lrKbListener = new DualTouchButtonKbListener(DEF.left.key, DEF.left.code, DEF.left.keyCode, DEF.right.key, DEF.right.code, DEF.right.keyCode, s('canvas'));
            this.#udKbListener = new DualTouchButtonKbListener(DEF.up.key, DEF.up.code, DEF.up.keyCode, DEF.down.key, DEF.down.code, DEF.down.keyCode, s('canvas'));
            this.#fireKbListener = new SingleTouchButtonKbListener(DEF.fire.key, DEF.fire.code, DEF.fire.keyCode, s('canvas'));
            new DualTouchButton(bottomContainer, true, '\u2190', '\u2192', undefined, 'qjlr', this.#lrKbListener);
            new DualTouchButton(bottomContainer, false, '\u2191', '\u2193', undefined, 'qjud1', this.#udKbListener);
            new SingleTouchButton(bottomContainer, 'FIRE', undefined, 'qja', this.#fireKbListener);
        } else {
            new DualTouchButton(bottomContainer, true, '\u2190', '\u2192', undefined, 'qjlr', new DualTouchButtonJoyListener(this.#platform_manager.getNostalgist(), 'left', 'right'));
            if (btns == 1) {
                new DualTouchButton(bottomContainer, false, '\u2191', '\u2193', undefined, 'qjud1', new DualTouchButtonJoyListener(this.#platform_manager.getNostalgist(), 'up', 'down'));
                new SingleTouchButton(bottomContainer, 'FIRE', undefined, 'qja', new SingleTouchButtonJoyListener(this.#platform_manager.getNostalgist(), 'b'));
            } else if (btns == 2) {
                new DualTouchButton(bottomContainer, false, '\u2191', '\u2193', undefined, 'qjud2', new DualTouchButtonJoyListener(this.#platform_manager.getNostalgist(), 'up', 'down'));
                new DualTouchButton(bottomContainer, true, 'B', 'A', undefined, 'qjab', new DualTouchButtonJoyListener(this.#platform_manager.getNostalgist(), 'b', 'a'));
            }
        }

        bottomContainer.style.display = 'none';
        document.body.appendChild(bottomContainer);
    }

    show() {
        show("#quickjoys", "grid");
    }

    hide() {
        hide("#quickjoy");
        hide("#quickjoys");
    }

    updateKeyMap(value) {
        const keyMap = {
            'Interface 2 Left': KeyMaps.ZX_INTERFACE_2_LEFT,
            'Interface 2 Right': KeyMaps.ZX_INTERFACE_2_RIGHT,
            'Cursor': KeyMaps.ZX_CURSOR,
            'QAOP+Space': KeyMaps.ZX_QOAP
        }[value];
    
        if (keyMap) {
            this.#lrKbListener.updateKeyMapping(keyMap.left, keyMap.right);
            this.#udKbListener.updateKeyMapping(keyMap.up, keyMap.down);
            this.#fireKbListener.updateKeyMapping(keyMap.fire);
        }
    }
}