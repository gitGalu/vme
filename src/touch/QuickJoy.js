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
        bottomContainer.style.zIndex = '2147483647';
        bottomContainer.style.textAlign = 'center';
        bottomContainer.style.fontFamily = "Helvetica, Arial, sans-serif !important";
        bottomContainer.style.justifyContent = 'center';
        bottomContainer.style.gridTemplateColumns = 'repeat(50, 1fr)';
        bottomContainer.style.gridTemplateRows = 'repeat(50, 1fr)';
        bottomContainer.style.pointerEvents = 'none';

        //lr
        new DualTouchButton(bottomContainer, true, '\u21e6', '\u21e8', undefined, 'qjlr', new DualTouchButtonJoyListener(this.#platform_manager.getNostalgist(), 'left', 'right'));

        if (this.#platform_manager.getSelectedPlatform().fire_buttons == 1) {
            //ud
            new DualTouchButton(bottomContainer, false, '\u21e7', '\u21e9', undefined, 'qjud1', new DualTouchButtonJoyListener(this.#platform_manager.getNostalgist(), 'up', 'down'));
            //fire
            new SingleTouchButton(bottomContainer, 'FIRE', undefined, 'qja', new SingleTouchButtonJoyListener(this.#platform_manager.getNostalgist(), 'b'));

            // this.#setCSS(

            // );

        } else if (this.#platform_manager.getSelectedPlatform().fire_buttons == 2) {
            //ud
            new DualTouchButton(bottomContainer, false, '\u21e7', '\u21e9', undefined, 'qjud2', new DualTouchButtonJoyListener(this.#platform_manager.getNostalgist(), 'up', 'down'));
            //fire
            new DualTouchButton(bottomContainer, true, 'B', 'A', undefined, 'qjab', new DualTouchButtonJoyListener(this.#platform_manager.getNostalgist(), 'b', 'a'));
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

    #setCSS(...rules) {
        var style = document.createElement('style');
        document.head.appendChild(style);
        var sheet = style.sheet;

        rules.forEach(rule => {
            sheet.insertRule(rule, sheet.cssRules.length);
        });
    }
}