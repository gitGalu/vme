import { s, show, hide } from '../dom.js';
import { SingleTouchButton } from "./SingleTouchButton";
import { DualTouchButton } from "./DualTouchButton";
import { TripleTouchButton } from "./TripleTouchButton";
import { SingleTouchButtonJoyListener } from "./SingleTouchButtonJoyListener";
import { DualTouchButtonJoyListener } from "./DualTouchButtonJoyListener";
import { TripleTouchButtonJoyListener } from "./TripleTouchButtonJoyListener";
import { QuadrupleTouchButton } from './QuadrupleTouchButton.js';
import { QuadrupleTouchButtonJoyListener } from './QuadrupleTouchButtonJoyListener.js';
import { SextupleTouchButton } from './SextupleTouchButton.js';
import { SextupleTouchButtonJoyListener } from './SextupleTouchButtonJoyListener.js';
import { FileUtils } from '../utils/FileUtils.js';
import { QuickshotComponent } from './QuickshotComponent.js';

export class QuickShot {
    #platform_manager;
    #nostalgist;

    #joystickContainer;
    #joystickComponent;

    constructor(platform_manager) {
        this.#platform_manager = platform_manager;
        this.#nostalgist = platform_manager.getNostalgist();
        this.#init();
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
        bottomContainer.style.zIndex = '7777';
        bottomContainer.style.textAlign = 'center';
        bottomContainer.style.fontFamily = "Helvetica, Arial, sans-serif !important";
        bottomContainer.style.justifyContent = 'center';
        bottomContainer.style.gridTemplateColumns = 'repeat(23, 1fr)';
        bottomContainer.style.gridTemplateRows = 'repeat(10, 1fr)';
        bottomContainer.style.pointerEvents = 'none';

        let buttonsCount = this.#platform_manager.getSelectedPlatform().fire_buttons;
        let platform_id = this.#platform_manager.getSelectedPlatform().platform_id;
        let button_overrides = this.#platform_manager.getSelectedPlatform().button_overrides;
        let program_id = FileUtils.getFilenameWithoutExtension(this.#platform_manager.getProgramName());

        if (button_overrides && button_overrides[program_id] != undefined) {
            buttonsCount = button_overrides[program_id];
        }

        if (buttonsCount == 1) {
            new SingleTouchButton(bottomContainer, 'A', undefined, 'qsa', new SingleTouchButtonJoyListener(this.#nostalgist, 'b'));
        } else if (buttonsCount == 2) {
            if (platform_id == "snk" || platform_id == "mame") {
                new DualTouchButton(bottomContainer, true, 'A', 'B', undefined, 'qsab', new DualTouchButtonJoyListener(this.#nostalgist, 'b', 'a'), '12px');
            } else if (platform_id == "pico-8") {
                new DualTouchButton(bottomContainer, true, 'X', 'O', undefined, 'qsab', new DualTouchButtonJoyListener(this.#nostalgist, 'b', 'a'), '12px');
            } else {
                new DualTouchButton(bottomContainer, true, 'B', 'A', undefined, 'qsab', new DualTouchButtonJoyListener(this.#nostalgist, 'b', 'a'), '12px');
            }
        } else if (buttonsCount == 3) {
            if (platform_id == "snk" || platform_id == "mame") {
                new TripleTouchButton(bottomContainer, true, 'A', 'B', 'C', undefined, 'qsabc3', new TripleTouchButtonJoyListener(this.#nostalgist, 'b', 'a', 'y'));
            } else if (platform_id == "intv") {
                new TripleTouchButton(bottomContainer, true, 'T', 'L', 'R', undefined, 'qsabc3', new TripleTouchButtonJoyListener(this.#nostalgist, 'y', 'a', 'b'));
            } else {
                new TripleTouchButton(bottomContainer, true, 'A', 'B', 'C', undefined, 'qsabc3', new TripleTouchButtonJoyListener(this.#nostalgist, 'y', 'b', 'a'));
            }
        } else if (buttonsCount == 4) {
            if (platform_id == "gba") {
                new QuadrupleTouchButton(bottomContainer, 'L', 'R', 'B', 'A', undefined, 'qs4', new QuadrupleTouchButtonJoyListener(this.#nostalgist, 'l', 'r', 'b', 'a'), QuadrupleTouchButton.Layout.ABLR);
            } else if (platform_id == "snk" || platform_id == "mame") {
                new QuadrupleTouchButton(bottomContainer, 'C', 'D', 'A', 'B', undefined, 'qsab4', new QuadrupleTouchButtonJoyListener(this.#nostalgist, 'x', 'y', 'a', 'b'), QuadrupleTouchButton.Layout.ABCD);
            } 
        } else if (buttonsCount == 6 || buttonsCount == 5) {
            new SextupleTouchButton(bottomContainer, 'L', 'A', 'Y', 'R', 'X', 'B', undefined, 'qs6tr', new SextupleTouchButtonJoyListener(this.#nostalgist, 'l', 'a', 'y', 'r', 'x', 'b'), QuadrupleTouchButton.Layout.TWO_ROWS);
        }

        document.body.appendChild(bottomContainer);

        this.#joystickContainer = document.createElement('div');
        this.#joystickContainer.id = 'quickshot';
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

        this.#joystickComponent = new QuickshotComponent(
            this.#joystickContainer,
            null,
            'quickshot-stick',
            this.#platform_manager,
            { mode: 'nostalgist', showHint: false, target: s('canvas') }
        );
    }

    show() {
        show("#quickshots", "grid");
        show("#quickshot", "block");
    }

    hide() {
        hide("#quickshot");
        hide("#quickshots");
        this.#joystickComponent?.cancelActiveTouch?.();
    }
}
