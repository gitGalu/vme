import { s, show, hide } from '../dom.js';
import { SingleTouchButton } from "./SingleTouchButton";
import { DualTouchButton } from "./DualTouchButton";
import { SingleTouchButtonJoyListener } from "./SingleTouchButtonJoyListener";
import { DualTouchButtonJoyListener } from "./DualTouchButtonJoyListener";

export class QuickJoy {
    #platform_manager;

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

        //lr
        new DualTouchButton(bottomContainer, true, '\u2190', '\u2192', undefined, 'qjlr', new DualTouchButtonJoyListener(this.#platform_manager.getNostalgist(), 'left', 'right'));

        let btns = this.#platform_manager.getSelectedPlatform().fire_buttons;

        if (btns == 1) {
            //ud
            new DualTouchButton(bottomContainer, false, '\u2191', '\u2193', undefined, 'qjud1', new DualTouchButtonJoyListener(this.#platform_manager.getNostalgist(), 'up', 'down'));
            //fire
            new SingleTouchButton(bottomContainer, 'FIRE', undefined, 'qja', new SingleTouchButtonJoyListener(this.#platform_manager.getNostalgist(), 'b'));
        } else if (btns == 2) {
            //ud
            new DualTouchButton(bottomContainer, false, '\u2191', '\u2193', undefined, 'qjud2', new DualTouchButtonJoyListener(this.#platform_manager.getNostalgist(), 'up', 'down'));
            //fire
            new DualTouchButton(bottomContainer, true, 'B', 'A', undefined, 'qjab', new DualTouchButtonJoyListener(this.#platform_manager.getNostalgist(), 'b', 'a'));
        } else if (btns == 3) {

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

    mode(mode) {
        const container = s('#quickjoys');
        container.classList.toggle('primary');
        container.classList.toggle('secondary');
    }
}