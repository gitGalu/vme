import { s } from '../../dom.js';
import { TouchControllerBase } from '../TouchControllerBase.js';
import { SingleTouchButton } from '../SingleTouchButton.js';
import { DualTouchButton } from '../DualTouchButton.js';
import { TripleTouchButton } from '../TripleTouchButton.js';
import { QuadrupleTouchButton } from '../QuadrupleTouchButton.js';
import { SextupleTouchButton } from '../SextupleTouchButton.js';
import { TouchpadComponent } from '../TouchpadComponent.js';
import { QuickshotComponent } from '../QuickshotComponent.js';
import { CursorKeysComponent } from '../CursorKeysComponent.js';
import { SingleTouchButtonJoyListener } from '../SingleTouchButtonJoyListener.js';
import { DualTouchButtonJoyListener } from '../DualTouchButtonJoyListener.js';
import { TripleTouchButtonJoyListener } from '../TripleTouchButtonJoyListener.js';
import { QuadrupleTouchButtonJoyListener } from '../QuadrupleTouchButtonJoyListener.js';
import { SextupleTouchButtonJoyListener } from '../SextupleTouchButtonJoyListener.js';
import { SingleTouchButtonKbListener } from '../SingleTouchButtonKbListener.js';
import { DualTouchButtonKbListener } from '../DualTouchButtonKbListener.js';

const ORIENTATION = {
    LANDSCAPE: 'landscape',
    PORTRAIT: 'portrait'
};


export class CustomControllerManager extends TouchControllerBase {
    #platformManager;
    #config;
    #container;
    #gridHost;
    #activePresetId = null;
    #activeElements = [];
    #onPresetActivated;
    #onPickerDismissed;
    #modal;
    #resizeHandler;
    #isGameFocusEnabledForActivePreset = true;

    constructor(platformManager, config, { onPresetActivated, onPickerDismissed } = {}) {
        super();
        this.#platformManager = platformManager;
        this.#config = config;
        this.#onPresetActivated = onPresetActivated;
        this.#onPickerDismissed = onPickerDismissed;
        this.#init();
    }

    hasPresets() {
        return Array.isArray(this.#config?.presets) && this.#config.presets.length > 0;
    }

    openPresetPicker() {
        if (!this.hasPresets()) {
            return;
        }

        if (this.#modal) {
            return;
        }

        const overlay = document.createElement('div');
        overlay.className = 'custom-controller-modal';
        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) {
                this.#closeModal(true);
            }
        });

        const dialog = document.createElement('div');
        dialog.className = 'custom-controller-dialog';

        const description = document.createElement('p');
        description.className = 'custom-controller-dialog__hint';
        description.textContent = 'Select custom touch controller scheme';
        dialog.appendChild(description);

        const list = document.createElement('div');
        list.className = 'custom-controller-dialog__list';

        this.#config.presets.forEach((preset) => {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'custom-controller-dialog__item';
            item.dataset.presetId = preset.id;

            const name = document.createElement('span');
            name.className = 'custom-controller-dialog__item-name';
            name.textContent = preset.name;
            item.appendChild(name);

            if (preset.description) {
                const desc = document.createElement('span');
                desc.className = 'custom-controller-dialog__item-description';
                desc.textContent = preset.description;
                item.appendChild(desc);
            }

            item.addEventListener('click', () => {
                this.setActivePreset(preset.id);
                this.#closeModal();
            });

            list.appendChild(item);
        });

        dialog.appendChild(list);

        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        this.#modal = overlay;
    }

    setActivePreset(presetId) {
        const preset = this.#config.presets.find(p => p.id === presetId);
        if (!preset) {
            return;
        }

        this.#activePresetId = presetId;
        this.#isGameFocusEnabledForActivePreset = this.#shouldEnableGameFocus(preset);
        this.#renderPreset(preset);

        if (typeof this.#onPresetActivated === 'function') {
            this.#onPresetActivated(preset);
        }
    }

    getActivePreset() {
        return this.#config.presets.find(p => p.id === this.#activePresetId) ?? null;
    }

    isGameFocusEnabled() {
        return this.#isGameFocusEnabledForActivePreset;
    }

    show() {
        if (!this.#container) {
            return;
        }
        const preset = this.getActivePreset();
        if (!preset) {
            return;
        }
        this.#container.style.display = 'block';
    }

    hide() {
        if (!this.#container) {
            return;
        }
        this.#container.style.display = 'none';
    }

    destroy() {
        this.#clearActiveElements();
        if (this.#container) {
            this.#container.remove();
            this.#container = null;
        }
        this.#gridHost = null;
        this.#closeModal();

        if (this.#resizeHandler) {
            window.removeEventListener('resize', this.#resizeHandler);
            this.#resizeHandler = null;
        }

        this.#isGameFocusEnabledForActivePreset = true;
    }

    #init() {
        this.#initFullViewport();

        this.#resizeHandler = () => {
            const preset = this.getActivePreset();
            if (preset) {
                this.#renderPreset(preset);
            }
        };

        window.addEventListener('resize', this.#resizeHandler);
    }

    #renderPreset(preset) {
        const orientation = this.#getOrientation();
        const layout = preset.layout?.[orientation] ?? preset.layout?.default;

        if (!layout) {
            return;
        }

        this.#clearActiveElements();

        this.#gridHost.style.gridTemplateColumns = 'repeat(50, 1fr)';
        this.#gridHost.style.gridTemplateRows = 'repeat(50, 1fr)';


        preset.elements?.forEach(elementDef => {
            const areaDefinition = elementDef.gridArea?.[orientation] ?? elementDef.gridArea?.default ?? elementDef.gridArea;
            this.#mountElement(elementDef, areaDefinition);
        });
    }

    #shouldEnableGameFocus(preset) {
        if (typeof preset?.gameFocus === 'boolean') {
            return preset.gameFocus;
        }
        const defaults = this.#config?.focus_defaults ?? this.#config?.focusDefaults;
        if (defaults && typeof defaults[preset.id] === 'boolean') {
            return defaults[preset.id];
        }
        return true;
    }

    #initFullViewport() {
        this.#container = document.createElement('div');
        this.#container.id = 'custom-touch-controller';
        this.#container.style.display = 'none';

        this.#gridHost = document.createElement('div');
        this.#gridHost.className = 'custom-touch-controller__grid';

        this.#container.appendChild(this.#gridHost);
        document.body.appendChild(this.#container);
    }



    #mountElement(elementDef, gridArea) {
        const nostalgist = this.#platformManager.getNostalgist();
        const canvas = s('canvas');

        if (!elementDef?.component) {
            return;
        }

        if (!this.#validateGridArea(gridArea)) {
            return;
        }

        let instance = null;
        let releaseFn = () => {};

        switch (elementDef.component) {
            case 'SingleTouchButton': {
                const listener = this.#createSingleListener(elementDef.binding, nostalgist, canvas);
                const label = elementDef.label ?? 'BTN';
                instance = new SingleTouchButton(
                    this.#gridHost,
                    label,
                    gridArea,
                    elementDef.id,
                    listener,
                    elementDef.radius
                );
                releaseFn = () => {
                    if (listener && typeof listener.trigger === 'function') {
                        listener.trigger(false);
                    }
                };
                break;
            }
            case 'DualTouchButton': {
                const listener = this.#createDualListener(elementDef.binding, nostalgist, canvas);
                if (!listener) {
                    return;
                }
                const labels = elementDef.labels || [elementDef.label1 ?? 'L', elementDef.label2 ?? 'R'];
                const isHorizontal = elementDef.options?.isHorizontal ?? true;

                instance = new DualTouchButton(
                    this.#gridHost,
                    isHorizontal,
                    labels[0],
                    labels[1],
                    gridArea,
                    elementDef.id,
                    listener,
                    elementDef.radius
                );
                releaseFn = () => {
                    if (listener && typeof listener.trigger === 'function') {
                        listener.trigger(0);
                    }
                    if (instance && typeof instance.destroy === 'function') {
                        instance.destroy();
                    }
                };
                break;
            }
            case 'TripleTouchButton': {
                const listener = this.#createMultiListener(elementDef.binding, nostalgist, 3);
                if (!listener) {
                    return;
                }
                const labels = elementDef.labels || ['BTN1', 'BTN2', 'BTN3'];
                const isHorizontal = elementDef.options?.isHorizontal ?? true;

                instance = new TripleTouchButton(
                    this.#gridHost,
                    isHorizontal,
                    labels[0],
                    labels[1],
                    labels[2],
                    gridArea,
                    elementDef.id,
                    listener,
                    elementDef.radius
                );
                releaseFn = () => {
                    if (listener && typeof listener.trigger === 'function') {
                        listener.trigger(0);
                    }
                    if (instance && typeof instance.destroy === 'function') {
                        instance.destroy();
                    }
                };
                break;
            }
            case 'QuadrupleTouchButton': {
                const listener = this.#createMultiListener(elementDef.binding, nostalgist, 4);
                if (!listener) {
                    return;
                }
                const labels = elementDef.labels || ['BTN1', 'BTN2', 'BTN3', 'BTN4'];
                const layout = elementDef.options?.layout ?? QuadrupleTouchButton.Layout.ABCD;

                instance = new QuadrupleTouchButton(
                    this.#gridHost,
                    labels[0],
                    labels[1],
                    labels[2],
                    labels[3],
                    gridArea,
                    elementDef.id,
                    listener,
                    layout,
                    elementDef.radius
                );
                releaseFn = () => {
                    if (listener && typeof listener.trigger === 'function') {
                        listener.trigger(0);
                    }
                    if (instance && typeof instance.destroy === 'function') {
                        instance.destroy();
                    }
                };
                break;
            }
            case 'SextupleTouchButton': {
                const listener = this.#createMultiListener(elementDef.binding, nostalgist, 6);
                if (!listener) {
                    return;
                }
                const labels = elementDef.labels || ['BTN1', 'BTN2', 'BTN3', 'BTN4', 'BTN5', 'BTN6'];
                const layout = elementDef.options?.layout ?? SextupleTouchButton.Layout.TWO_ROWS;

                instance = new SextupleTouchButton(
                    this.#gridHost,
                    labels[0],
                    labels[1],
                    labels[2],
                    labels[3],
                    labels[4],
                    labels[5],
                    gridArea,
                    elementDef.id,
                    listener,
                    layout,
                    elementDef.radius
                );
                releaseFn = () => {
                    if (listener && typeof listener.trigger === 'function') {
                        listener.trigger(0);
                    }
                    if (instance && typeof instance.destroy === 'function') {
                        instance.destroy();
                    }
                };
                break;
            }
            case 'TouchpadComponent': {
                instance = new TouchpadComponent(
                    this.#gridHost,
                    gridArea,
                    elementDef.id,
                    this.#platformManager,
                    elementDef.options
                );
                releaseFn = () => {
                    if (instance && typeof instance.destroy === 'function') {
                        instance.destroy();
                    }
                };
                break;
            }
            case 'QuickshotComponent': {
                instance = new QuickshotComponent(
                    this.#gridHost,
                    gridArea,
                    elementDef.id,
                    this.#platformManager,
                    elementDef.options
                );
                releaseFn = () => {
                    if (instance && typeof instance.destroy === 'function') {
                        instance.destroy();
                    }
                };
                break;
            }
            case 'CursorKeysComponent': {
                instance = new CursorKeysComponent(
                    this.#gridHost,
                    gridArea,
                    elementDef.id,
                    this.#platformManager,
                    elementDef.options
                );
                releaseFn = () => {
                    if (instance && typeof instance.destroy === 'function') {
                        instance.destroy();
                    }
                };
                break;
            }
            default:
                return;
        }

        if (instance) {
            // Safari
            this.#addSizeBasedClasses(instance.el, gridArea);
            this.#activeElements.push({ instance, release: releaseFn });
        }
    }

    #createSingleListener(binding, nostalgist, target) {
        if (!binding) {
            return new SingleTouchButtonJoyListener(nostalgist, 'b');
        }

        switch (binding.type) {
            case 'joy':
                return new SingleTouchButtonJoyListener(nostalgist, binding.press ?? 'b');
            case 'keyboard':
                if (!binding.key) {
                    return new SingleTouchButtonJoyListener(nostalgist, 'b');
                }
                return new SingleTouchButtonKbListener(binding.key.key, binding.key.code, binding.key.keyCode, target ?? document);
            default:
                return new SingleTouchButtonJoyListener(nostalgist, 'b');
        }
    }

    #createDualListener(binding, nostalgist, target) {
        if (!binding) {
            return null;
        }

        switch (binding.type) {
            case 'joy':
                if (!binding.primary || !binding.secondary) {
                    return null;
                }
                return new DualTouchButtonJoyListener(nostalgist, binding.primary, binding.secondary);
            case 'keyboard':
                if (!binding.primary || !binding.secondary) {
                    return null;
                }
                return new DualTouchButtonKbListener(
                    binding.primary.key,
                    binding.primary.code,
                    binding.primary.keyCode,
                    binding.secondary.key,
                    binding.secondary.code,
                    binding.secondary.keyCode,
                    target ?? document
                );
            default:
                return null;
        }
    }

    #clearActiveElements() {
        this.#activeElements.forEach(({ release }) => {
            if (typeof release === 'function') {
                release();
            }
        });
        this.#activeElements = [];

        if (this.#gridHost) {
            this.#gridHost.innerHTML = '';
        }
    }

    #closeModal(canceled = false) {
        if (this.#modal) {
            const modalEl = this.#modal;
            const handleAnimationEnd = () => {
                modalEl.removeEventListener('animationend', handleAnimationEnd);
                modalEl.remove();
            };

            modalEl.dataset.state = 'closing';
            modalEl.addEventListener('animationend', handleAnimationEnd, { once: true });

            // Fallback removal if the browser does not emit animation events
            setTimeout(() => {
                if (modalEl.parentNode) {
                    modalEl.remove();
                }
            }, 220);

            this.#modal = null;

            if (canceled && typeof this.#onPickerDismissed === 'function') {
                this.#onPickerDismissed();
            }
        }
    }

    #validateGridArea(gridAreaString) {
        if (!gridAreaString || typeof gridAreaString !== 'string') {
            return false;
        }

        const parts = gridAreaString.trim().split(' / ');
        if (parts.length !== 4) {
            return false;
        }

        const [rowStart, colStart, rowSpan, colSpan] = parts;

        // Validate row start (positive integer)
        if (!/^\d+$/.test(rowStart.trim()) || parseInt(rowStart, 10) < 1) {
            return false;
        }

        // Validate col start (positive integer)
        if (!/^\d+$/.test(colStart.trim()) || parseInt(colStart, 10) < 1) {
            return false;
        }

        // Validate row span (span N format)
        if (!rowSpan.trim().startsWith('span ') || !/^span \d+$/.test(rowSpan.trim())) {
            return false;
        }

        // Validate col span (span N format)
        if (!colSpan.trim().startsWith('span ') || !/^span \d+$/.test(colSpan.trim())) {
            return false;
        }

        return true;
    }

    #createMultiListener(binding, nostalgist, buttonCount) {
        if (!binding || binding.type !== 'joy') {
            return null;
        }

        const inputs = [];
        for (let i = 1; i <= buttonCount; i++) {
            const inputKey = `input${i}`;
            if (!binding[inputKey]) {
                return null;
            }
            inputs.push(binding[inputKey]);
        }

        switch (buttonCount) {
            case 3:
                return new TripleTouchButtonJoyListener(nostalgist, inputs[0], inputs[1], inputs[2]);
            case 4:
                return new QuadrupleTouchButtonJoyListener(nostalgist, inputs[0], inputs[1], inputs[2], inputs[3]);
            case 6:
                return new SextupleTouchButtonJoyListener(nostalgist, inputs[0], inputs[1], inputs[2], inputs[3], inputs[4], inputs[5]);
            default:
                return null;
        }
    }

    #getOrientation() {
        return window.innerWidth >= window.innerHeight ? ORIENTATION.LANDSCAPE : ORIENTATION.PORTRAIT;
    }

    #addSizeBasedClasses(element, gridArea) {
        if (!element || !gridArea) return;

        const parts = gridArea.trim().split(' / ');
        if (parts.length !== 4) return;

        const rowSpanMatch = parts[2].match(/span (\d+)/);
        const colSpanMatch = parts[3].match(/span (\d+)/);

        if (!rowSpanMatch || !colSpanMatch) return;

        const rowSpan = parseInt(rowSpanMatch[1], 10);
        const colSpan = parseInt(colSpanMatch[1], 10);

        if ((rowSpan === 2 && colSpan >= 3 && colSpan <= 9) ||
            (rowSpan >= 4 && rowSpan <= 6 && colSpan >= 4 && colSpan <= 9)) {
            element.classList.add('custom-small-button');
        }
        else if ((rowSpan === 5 || rowSpan === 6) && (colSpan === 5 || colSpan === 6 || colSpan === 10)) {
            element.classList.add('custom-medium-button');
        }
    }
}
