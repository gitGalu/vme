import { s, addButtonEventListeners } from '../dom.js';
import { SingleTouchButton } from '../touch/SingleTouchButton.js';
import { MultiSelectTouchButton } from '../touch/MultiSelectTouchButton.js';
import { TouchButtonListener } from '../touch/TouchButtonListener.js';
import { SingleTouchButtonJoyListener } from '../touch/SingleTouchButtonJoyListener.js';
import { SingleTouchButtonKbListener } from '../touch/SingleTouchButtonKbListener.js';
import { EnvironmentManager } from '../EnvironmentManager.js';
import { QuickJoy } from '../touch/QuickJoy.js';
import { QuickShot } from '../touch/QuickShot.js';
import { Mousepad } from '../touch/Mousepad.js';
import { Hideaway } from '../touch/Hideaway.js';
import { CursorKeys } from '../touch/CursorKeys.js';
import { JOYSTICK_TOUCH_MODE, FAST_BTN_RADIUS } from '../Constants.js';
import { CustomControllerManager } from '../touch/custom/CustomControllerManager.js';
import { FileUtils } from '../utils/FileUtils.js';
import GameFocusManager from '../keyboard/GameFocusManager.js';
import { TOUCH_INPUT } from '../Constants.js';

function getJoystickModeName(mode) {
    switch (mode) {
        case JOYSTICK_TOUCH_MODE.QUICKJOY_PRIMARY:
            return 'QuickJoy';
        case JOYSTICK_TOUCH_MODE.QUICKSHOT_DYNAMIC:
            return 'QuickShot';
        case JOYSTICK_TOUCH_MODE.QUICKSHOT_KEYBOARD:
            return 'Cursor Keys';
        case JOYSTICK_TOUCH_MODE.HIDEAWAY:
            return 'Auto Hide';
        default:
            return 'Joystick';
    }
}

export class UiManager {
    static #platform_manager;
    static #kb_manager;

    static #qj;
    static #qs;
    static #ha;
    static #mousepad;
    static #ck;
    static #customControllerManager;
    static #keymapSelector;
    static #joystickSelector;
    static #specialButton;

    static #currentInputMethod;
    static #previousInputMethod;
    static #currentControllerIndex = 0;
    static #currentJoyTouchMode;

    #eventListeners = [];
    #kb_mode_change_handler_bound;

    constructor(platform_manager, kb_manager) {
        UiManager.#platform_manager = platform_manager;
        UiManager.#kb_manager = kb_manager;

        this.#kb_mode_change_handler_bound = this.#kbModeChangeHandler.bind(this);
    }

    initFastUI() {
        var fastuiContainer = document.createElement('div');
        fastuiContainer.id = 'fastui';
        fastuiContainer.style.display = 'none';

        new MultiSelectTouchButton(fastuiContainer, ['QUIT', 'Confirm'], undefined, 'fastmenu', new QuitConfirmListener(), 0, FAST_BTN_RADIUS, false, null, 'QUIT');

        if (!UiManager.#platform_manager.getSelectedPlatform().rewind_disabled) {
            new SingleTouchButton(fastuiContainer, '<span style="font-size: 50%;">REWIND</span>', undefined, 'fastrewind', new RewindButtonListener(UiManager.#platform_manager.getNostalgist()), FAST_BTN_RADIUS);
        }

        if (!UiManager.#platform_manager.getSelectedPlatform().ffd_disabled) {
            new SingleTouchButton(fastuiContainer, '<span style="font-size: 50%;">FFD</span>', undefined, 'fastffd', new FastForwardListener(UiManager.#platform_manager.getNostalgist()), FAST_BTN_RADIUS);
        }

        if (!UiManager.#platform_manager.getSelectedPlatform().savestates_disabled) {
            new MultiSelectTouchButton(fastuiContainer, ['QUICKSAVE', 'SAVE'], undefined, 'fastsave', new SaveButtonListener(UiManager.#platform_manager), 0, FAST_BTN_RADIUS, false, null, 'SAVE', true);
        }

        if (UiManager.#platform_manager.getSelectedPlatform().keyboard) {
            new SingleTouchButton(fastuiContainer, '<span style="font-size: 50%;">KB</span>', undefined, 'fastkb', new InputSwitchListener(TOUCH_INPUT.KEYBOARD), FAST_BTN_RADIUS);
        }

        if (UiManager.#platform_manager.getSelectedPlatform().joyport_toggle) {
            new SingleTouchButton(fastuiContainer, '<span style="font-size: 50%;">JOYPORT</span>', undefined, 'fastjoyport', new RightControlListener(), FAST_BTN_RADIUS);
        }

        UiManager.#specialButton = new SingleTouchButton(fastuiContainer, '<span style="font-size: 50%;">CUSTOM</span>', undefined, 'fastcustom', new InputSwitchListener(TOUCH_INPUT.CUSTOM), FAST_BTN_RADIUS);
        UiManager.#specialButton.el.style.display = 'none';

        if (UiManager.#platform_manager.getSelectedPlatform().arrow_keys) {
            new SingleTouchButton(fastuiContainer, '<span style="font-size: 50%;">ARROWS</span>', undefined, 'fastcursors', new InputSwitchListener(TOUCH_INPUT.CURSORS), FAST_BTN_RADIUS);
        }

        this.#placeItems(fastuiContainer);

        var fastuiMsg = document.createElement('div');
        fastuiMsg.id = 'fastui-msg';
        fastuiMsg.style.display = 'none';
        fastuiContainer.appendChild(fastuiMsg);

        document.body.appendChild(fastuiContainer);
    }

    initDesktopUI() {
        const desktopUi = document.getElementById('desktopUi');

        if (UiManager.#platform_manager.getSelectedPlatform().savestates_disabled) {
            document.getElementById('desktopUiSave').style.display = "none";
        }

        if (UiManager.#platform_manager.getSelectedPlatform().rewind_disabled) {
            document.getElementById('desktopUiRewind').style.display = "none";
        }

        let timeout;

        function addMouseMoveListenerToCanvas(observer) {
            desktopUi.classList.add('visible');

            timeout = setTimeout(function() {
                desktopUi.classList.remove('visible');
            }, 3000);

            desktopUi.addEventListener('mousemove', function () {
                desktopUi.classList.add('visible');
                clearTimeout(timeout);
            });

            desktopUi.addEventListener('mouseleave', function () {
                timeout = setTimeout(function () {
                    desktopUi.classList.remove('visible');
                }, 1000);
            });
        }

        function checkNodeForCanvas(node, observer) {
            if (node.nodeName === 'CANVAS') {
                addMouseMoveListenerToCanvas(observer);
                return true;
            }
            if (node.querySelector && node.querySelector('canvas')) {
                addMouseMoveListenerToCanvas(observer);
                return true;
            }
            return false;
        }

        const observer = new MutationObserver(function (mutations) {
            for (const mutation of mutations) {
                if (mutation.addedNodes && mutation.addedNodes.length > 0) {
                    for (const node of mutation.addedNodes) {
                        if (checkNodeForCanvas(node, observer)) {
                            return;
                        }
                    }
                }
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });

        addMouseMoveListenerToCanvas(observer);

        let intervalId = null;
        let self = this;

        addButtonEventListeners(s('#desktopUiFs'),
            (pressed) => {
                if (pressed) {
                    if (!document.fullscreenElement) {
                        document.documentElement.requestFullscreen().then(() => {
                            EnvironmentManager.resizeCanvas(UiManager.#platform_manager.getNostalgist());
                        }).catch((err) => {
                            console.log(err);
                        });

                    } else {
                        document.exitFullscreen().then(() => {
                            EnvironmentManager.resizeCanvas(UiManager.#platform_manager.getNostalgist());
                        }).catch((err) => {
                            console.log(err);
                        });

                    }
                }
            });

        this.initSaveButton();

        addButtonEventListeners(s('#desktopUiRewind'),
            (pressed) => {
                if (pressed) {
                    UiManager.#platform_manager.getNostalgist().sendCommand('REWIND');
                    intervalId = setInterval(() => {
                        UiManager.#platform_manager.getNostalgist().sendCommand('REWIND');
                    }, 5);
                } else {
                    clearInterval(intervalId);
                }
            });

        const kbModeSelection = document.getElementById('kbModeContainer');
        if (UiManager.#platform_manager.getSelectedPlatform().keyboard != undefined) {
            kbModeSelection.style.display = 'flex';
            kbModeSelection.classList.add('none');
            kbModeSelection.removeEventListener('change', this.#kb_mode_change_handler_bound)
            kbModeSelection.addEventListener('change', this.#kb_mode_change_handler_bound);
            this.#eventListeners.push({ element: kbModeSelection, handler: this.#kb_mode_change_handler_bound });
        } else {
            const select = document.getElementById('kbMode');
            const valueToRemove = 'focusmode';

            for (let i = 0; i < select.options.length; i++) {
                if (select.options[i].value === valueToRemove) {
                    select.remove(i);
                    break;
                }
            }
        }

        if (UiManager.#platform_manager.getSelectedPlatform().touch_controllers.length && UiManager.#platform_manager.getSelectedPlatform().touch_controllers[0] == JOYSTICK_TOUCH_MODE.QUICKSHOT_KEYBOARD) {
            const select = document.getElementById('kbMode');
            const valueToRemove = 'retropad';

            for (let i = 0; i < select.options.length; i++) {
                if (select.options[i].value === valueToRemove) {
                    select.remove(i);
                    break;
                }
            }

            select.disabled = true;

            GameFocusManager.getInstance().enable();
        }

        this.#addKeyboardControlsPopover();

        addButtonEventListeners(s('#desktopUiBack'),
            (pressed) => {
                location.reload();
            });

        this.initControlsButton();

        if (UiManager.#platform_manager.getSelectedPlatform().mouse_controllers || "lightgun" == this.#getOverridenControllerType()) {
            s('#canvas').addEventListener('click', () => {
                s('#canvas').requestPointerLock();
            });
        }
    }

    #addKeyboardControlsPopover() {
        const popover = document.createElement('div');
        popover.id = 'kbModePopover';
        popover.className = 'kb-mode-popover';
        popover.innerHTML = UiManager.#platform_manager.getHtmlControls();

        document.body.appendChild(popover);

        function isRetropadSelected() {
            const kbModeSelect = document.getElementById('kbMode');
            return kbModeSelect && kbModeSelect.value === 'retropad';
        }

        function showPopover(e) {
            if (!isRetropadSelected()) return;

            const popover = document.getElementById('kbModePopover');

            const offset = 15;
            popover.style.left = `${e.clientX + offset}px`;
            popover.style.top = `${e.clientY + 2 * offset}px`;

            const rect = popover.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            if (rect.right > viewportWidth) {
                popover.style.left = `${e.clientX - rect.width - offset}px`;
            }

            if (rect.bottom > viewportHeight) {
                popover.style.top = `${e.clientY - rect.height - offset}px`;
            }

            popover.style.display = 'block';
        }

        function hidePopover() {
            const popover = document.getElementById('kbModePopover');
            popover.style.display = 'none';
        }

        kbMode.addEventListener('mousemove', showPopover);
        kbMode.addEventListener('mouseleave', hidePopover);

        document.getElementById('kbMode').addEventListener('change', function () {
            if (!isRetropadSelected()) {
                hidePopover();
            }
        });
    }

    #kbModeChangeHandler(event) {
        const mode = event.target.value;
        if ("retropad" == mode) {
            GameFocusManager.getInstance().disable();
        } else if ("focusmode" == mode) {
            GameFocusManager.getInstance().enable();
        }
    }

    #getOverridenControllerType() {
        const controller_overrides = UiManager.#platform_manager.getSelectedPlatform().controller_overrides;
        const controller_types = UiManager.#platform_manager.getSelectedPlatform().controller_types;

        if (controller_overrides) {
            const program_name = UiManager.#platform_manager.getProgramName();
            const key = FileUtils.getFilenameWithoutExtension(program_name);
            const controller_type = controller_overrides[key];
            const overriden_type = controller_types[controller_type];

            return overriden_type;
        }
        return undefined;
    }

    initTouchControllerMenu() {
        if (UiManager.#keymapSelector) {
            UiManager.#keymapSelector.destroy();
            UiManager.#keymapSelector = undefined;
        }

        const overridenController = this.#getOverridenControllerType();
        if (overridenController) {
            if ("lightgun" == overridenController) {
                UiManager.hideKeyboard();
                UiManager.hideJoystick();
                UiManager.showMousepad();
            }
        } else {
            const touch_controllers = UiManager.#platform_manager.getSelectedPlatform().touch_controllers;
            if (touch_controllers.length > 1) {
                const joystickOptions = touch_controllers.map(mode => getJoystickModeName(mode));

                UiManager.#joystickSelector = new MultiSelectTouchButton(
                    s("#fastui"),
                    joystickOptions,
                    undefined,
                    'fastjoy',
                    new JoystickSelectorListener(touch_controllers),
                    UiManager.#currentControllerIndex,
                    FAST_BTN_RADIUS,
                    false, // No arrow
                    () => UiManager.isInJoystickMode(),
                    'JOY',
                    true // Show all options
                );
            } else if (touch_controllers.length === 1) {
                new SingleTouchButton(s("#fastui"), '<span style="font-size: 50%;">JOY</span>', undefined, 'fastjoy', new InputSwitchListener(TOUCH_INPUT.JOYSTICK), FAST_BTN_RADIUS);
            }

            class KeymapOptionsListener extends TouchButtonListener {
                trigger(event) {
                    if (event.selected) {
                        UiManager.#qj.updateKeyMap(event.label);
                        UiManager.#ck.updateKeyMap(event.label);
                    }
                }
            }

            if (UiManager.#platform_manager.getSelectedPlatform().platform_id == "spectrum") {
                UiManager.#keymapSelector = new MultiSelectTouchButton(
                    document.getElementById('fastui'),
                    ['Cursor', 'Interface 2', 'QAOP', 'QWRE', '1890'],
                    undefined,
                    'fastspectrumjoy',
                    new KeymapOptionsListener(),
                    0,
                    FAST_BTN_RADIUS
                );
            } else if (UiManager.#platform_manager.getSelectedPlatform().platform_id == "xt") {
                UiManager.#keymapSelector = new MultiSelectTouchButton(
                    document.getElementById('fastui'),
                    ['Spc+Ret', 'Spc+X', 'Spc+Ctrl', 'Z+X', 'Spc+A', 'Spc+Shift'],
                    undefined,
                    'fastspectrumjoy',
                    new KeymapOptionsListener(),
                    0,
                    FAST_BTN_RADIUS
                );
            }

            const mouse_controllers = UiManager.#platform_manager.getSelectedPlatform().mouse_controllers;
            if (mouse_controllers == undefined || mouse_controllers.length == 0) return;

            new SingleTouchButton(s("#fastui"), '<span style="font-size: 50%;">MOUSE</span>', undefined, 'fastmouse', new InputSwitchListener(TOUCH_INPUT.MOUSE), FAST_BTN_RADIUS);
        }
    }

    initControlsButton() {
        const controlsButton = document.getElementById('desktopUiControls');
        const controlsMenu = document.getElementById('controlsMenu');
        const nostalgist = UiManager.#platform_manager.getNostalgist();

        const menuOptions = [];

        let keys = Object.keys(UiManager.#platform_manager.getSelectedPlatform().additional_buttons);
        if (keys.length > 0) {
            for (let i = 0; i < keys.length; i++) {
                let key = keys[i];
                let label = UiManager.#platform_manager.getSelectedPlatform().additional_buttons[key].label;
                let keyCode = UiManager.#platform_manager.getSelectedPlatform().additional_buttons[key].keyCode;
                let kbKey = UiManager.#platform_manager.getSelectedPlatform().additional_buttons[key].key;

                menuOptions.push({
                    name: label, action: () => {
                        if (kbKey) {
                            simulateKeypress(kbKey.key, kbKey.code, kbKey.key.keyCode);
                        } else {
                            nostalgist.press({ button: keyCode, player: 1, time: 100 });
                        }
                    }
                });
            }

        } else {
            controlsButton.style.display = "none";
        }

        function simulateKeydown(key, code, keyCode) {
            let event = new KeyboardEvent('keydown', {
                key: key,
                code: code,
                keyCode: keyCode,
                charCode: keyCode,
                bubbles: true,
                cancelable: true
            });

            document.dispatchEvent(event);
        }

        function simulateKeyup(key, code, keyCode) {
            let event = new KeyboardEvent('keyup', {
                key: key,
                code: code,
                keyCode: keyCode,
                charCode: keyCode,
                bubbles: true,
                cancelable: true
            });

            document.dispatchEvent(event);
        }

        function simulateKeypress(key, code, keyCode) {
            simulateKeydown(key, code, keyCode);
            setTimeout(() => {
                simulateKeyup(key, code, keyCode);
            }, 50);
        }

        function createMenu() {
            controlsMenu.innerHTML = '';
            menuOptions.forEach(option => {
                const menuItem = document.createElement('div');
                menuItem.textContent = option.name;
                menuItem.className = 'menu-item';
                menuItem.addEventListener('click', option.action);
                controlsMenu.appendChild(menuItem);
            });
        }

        function toggleMenu() {
            if (controlsMenu.style.display === 'none' || controlsMenu.style.display === '') {
                const rect = controlsButton.getBoundingClientRect();
                controlsMenu.style.position = 'absolute';
                controlsMenu.style.padding = '8px 16px';
                controlsMenu.style.top = `${rect.bottom}px`;
                controlsMenu.style.left = `${rect.left}px`;
                controlsMenu.style.display = 'block';
                controlsMenu.style.fontSize = '10pt';
            } else {
                controlsMenu.style.display = 'none';
            }
        }

        controlsButton.addEventListener('click', toggleMenu);
        createMenu();
    }

    initSaveButton() {
        const saveButton = document.getElementById('desktopUiSave');
        const saveMenu = document.getElementById('saveMenu');

        const menuOptions = [
            {
                name: 'Quicksave',
                action: () => {
                    saveMenu.style.display = 'none';
                    UiManager.#platform_manager.saveState(true);
                }
            },
            {
                name: 'Save',
                action: () => {
                    saveMenu.style.display = 'none';
                    UiManager.#platform_manager.saveState(false);
                }
            }
        ];

        function createMenu() {
            saveMenu.innerHTML = '';
            menuOptions.forEach(option => {
                const menuItem = document.createElement('div');
                menuItem.textContent = option.name;
                menuItem.className = 'menu-item';
                menuItem.addEventListener('click', option.action);
                saveMenu.appendChild(menuItem);
            });
        }

        function toggleMenu() {
            if (saveMenu.style.display === 'none' || saveMenu.style.display === '') {
                const rect = saveButton.getBoundingClientRect();
                saveMenu.style.position = 'absolute';
                saveMenu.style.padding = '8px 16px';
                saveMenu.style.top = `${rect.bottom}px`;
                saveMenu.style.left = `${rect.left}px`;
                saveMenu.style.display = 'block';
                saveMenu.style.fontSize = '10pt';
            } else {
                saveMenu.style.display = 'none';
            }
        }

        // Close menu when clicking outside
        document.addEventListener('click', (event) => {
            if (!saveButton.contains(event.target) && !saveMenu.contains(event.target)) {
                saveMenu.style.display = 'none';
            }
        });

        saveButton.addEventListener('click', toggleMenu);
        createMenu();
    }

    initQuickJoy() {
        UiManager.#qj = new QuickJoy(UiManager.#platform_manager);
    }

    initQuickshot() {
        UiManager.#qs = new QuickShot(UiManager.#platform_manager);
    }

    initMousepad() {
        UiManager.#mousepad = new Mousepad(UiManager.#platform_manager);
    }

    initHideaway() {
        UiManager.#ha = new Hideaway();
    }

    initCursorKeys() {
        UiManager.#ck = new CursorKeys(UiManager.#platform_manager);
    }

    initCustomControllers() {
        if (UiManager.#customControllerManager) {
            UiManager.#customControllerManager.destroy();
            UiManager.#customControllerManager = undefined;
        }

        const config = UiManager.#platform_manager.getSelectedPlatform().custom_controllers;

        if (config && Array.isArray(config.presets) && config.presets.length > 0) {
            UiManager.#customControllerManager = new CustomControllerManager(
                UiManager.#platform_manager,
                config,
                {
                    onPresetActivated: (preset) => {
                        const focusManager = GameFocusManager.getInstance();
                        const wantsGameFocus = UiManager.#customControllerManager.isGameFocusEnabled();
                        if (wantsGameFocus) {
                            focusManager.enable();
                        } else {
                            focusManager.disable();
                        }
                        UiManager.#currentInputMethod = TOUCH_INPUT.CUSTOM;
                        UiManager.showTouchOnly(UiManager.#customControllerManager);
                    },
                    onPickerDismissed: () => {
                        if (UiManager.#currentInputMethod === TOUCH_INPUT.CUSTOM && !UiManager.#customControllerManager?.getActivePreset()) {
                            UiManager.toggleInputMethod(TOUCH_INPUT.JOYSTICK, true);
                        }
                    }
                }
            );

            const specialButtonConfig = config.special_button || {};
            const label = specialButtonConfig.label ?? 'CUSTOM';

            if (UiManager.#specialButton) {
                UiManager.#specialButton.el.innerHTML = `<span style="font-size: 50%;">${label}</span>`;
                UiManager.#specialButton.el.style.display = 'flex';
            }
        } else if (UiManager.#specialButton) {
            UiManager.#specialButton.el.style.display = 'none';
        }
    }

    #placeItems(container) {
        let cell = 3;
        let counter = 1;

        let keys = Object.keys(UiManager.#platform_manager.getSelectedPlatform().additional_buttons);
        keys.reverse();
        for (let i = 0; i < keys.length; i++) {
            let key = keys[i];
            let label = UiManager.#platform_manager.getSelectedPlatform().additional_buttons[key].label;
            let keyCode = UiManager.#platform_manager.getSelectedPlatform().additional_buttons[key].keyCode;
            let kbKey = UiManager.#platform_manager.getSelectedPlatform().additional_buttons[key].key;

            let listener;
            if (kbKey) {
                listener = new SingleTouchButtonKbListener(kbKey.key, kbKey.code, kbKey.keyCode);
            } else {
                listener = new SingleTouchButtonJoyListener(UiManager.#platform_manager.getNostalgist(), keyCode);
            }
            new SingleTouchButton(container, '<span style="font-size: 50%;">' + label + '</span>', undefined, 'fast' + counter, listener, FAST_BTN_RADIUS);

            cell += 6;
            counter += 1;
        }
    }

    static hideJoystick() {
        if (UiManager.#currentJoyTouchMode == JOYSTICK_TOUCH_MODE.HIDEAWAY) {
            this.#ha.hide();
        }
        s('#quickshots').style.display = 'none';
        s('#quickjoys').style.display = 'none';
        UiManager.hideCustomControllers();
    }

    static hideCursors() {
        s('#cursorkeys').style.display = 'none';
    }

    static showCursors() {
        s('#cursorkeys').style.display = 'grid';
    }

    static showJoystick() {
        if (EnvironmentManager.isDesktop() || EnvironmentManager.isQuest()) return;

        if (UiManager.#currentJoyTouchMode == JOYSTICK_TOUCH_MODE.QUICKSHOT_DYNAMIC) {
            s('#quickshots').style.display = 'grid';
        } else if (UiManager.#currentJoyTouchMode == JOYSTICK_TOUCH_MODE.QUICKJOY_PRIMARY) {
            s('#quickjoys').style.display = 'grid';
        } else if (UiManager.#currentJoyTouchMode == JOYSTICK_TOUCH_MODE.HIDEAWAY) {
        } else if (UiManager.#currentJoyTouchMode == JOYSTICK_TOUCH_MODE.QUICKSHOT_KEYBOARD) {
            s('#cursorkeys').style.display = 'grid';
        }
    }

    static hideKeyboard() {
        s('#keyboardContainer').style.display = 'none';
    }

    static showKeyboard() {
        s('#keyboardContainer').style.display = 'block';
    }

    static hideMousepad() {
        s('#mousepads').style.display = 'none';
    }

    static showMousepad() {
        if (EnvironmentManager.isDesktop() || EnvironmentManager.isQuest()) return;
        s('#mousepads').style.display = 'grid';
    }

    static showTouchOnly = (el) => {
        if (EnvironmentManager.isDesktop() || EnvironmentManager.isQuest()) {
            return;
        }

        const elements = [
            UiManager.#ha,
            UiManager.#qs,
            UiManager.#qj,
            UiManager.#mousepad,
            UiManager.#ck,
            UiManager.#customControllerManager
        ].filter(Boolean);

        elements.forEach((e) => {
            if (e !== el) {
                e.hide();
            }
        });

        el.show();
    };

    static setCurrentJoyTouchMode(mode) {
        UiManager.#currentInputMethod = TOUCH_INPUT.JOYSTICK;
        UiManager.#currentJoyTouchMode = mode;
        UiManager.toggleInputMethod(TOUCH_INPUT.JOYSTICK, true);
    }

    static selectJoystickByIndex(index, touch_controllers) {
        const selectedMode = touch_controllers[index];
        UiManager.#currentControllerIndex = index;
        UiManager.#currentJoyTouchMode = selectedMode;

        if (UiManager.#joystickSelector) {
            UiManager.#joystickSelector.setSelectedIndex(index);
        }

        UiManager.toggleInputMethod(TOUCH_INPUT.JOYSTICK, true);
    }

    static updateJoystickSelectorIndex() {
        if (UiManager.#joystickSelector && UiManager.#currentInputMethod === TOUCH_INPUT.JOYSTICK) {
            UiManager.#joystickSelector.setSelectedIndex(UiManager.#currentControllerIndex);
        }
    }

    static isInJoystickMode() {
        return UiManager.#currentInputMethod === TOUCH_INPUT.JOYSTICK;
    }

    static toggleInputMethod(inputMethod, skipPre = false) {
        if (EnvironmentManager.isDesktop() || EnvironmentManager.isQuest()) {
            return;
        }

        if (inputMethod == UiManager.#currentInputMethod && !skipPre) {
            if (inputMethod == TOUCH_INPUT.KEYBOARD) return;
            if (inputMethod == TOUCH_INPUT.CURSORS) return;
            if (inputMethod == TOUCH_INPUT.MOUSE) return;
            if (inputMethod == TOUCH_INPUT.JOYSTICK) {
                const touch_controllers = UiManager.#platform_manager.getSelectedPlatform().touch_controllers;
                UiManager.#currentControllerIndex = (UiManager.#currentControllerIndex + 1) % touch_controllers.length;
                UiManager.#currentJoyTouchMode = touch_controllers[UiManager.#currentControllerIndex];
            }
            if (inputMethod == TOUCH_INPUT.CUSTOM) {
                UiManager.toggleSpecial(false, true);
                return;
            }
        }

        switch (UiManager.#currentInputMethod) {
            case TOUCH_INPUT.KEYBOARD:
                GameFocusManager.getInstance().disable();
                break;
            case TOUCH_INPUT.CURSORS:
                GameFocusManager.getInstance().disable();
                break;
            case TOUCH_INPUT.CUSTOM:
                GameFocusManager.getInstance().disable();
                break;
        }

        if (inputMethod == TOUCH_INPUT.KEYBOARD) {
            UiManager.#previousInputMethod = this.#currentInputMethod;
        }

        const previousInputMethod = UiManager.#currentInputMethod;
        UiManager.#currentInputMethod = inputMethod;

        switch (inputMethod) {
            case TOUCH_INPUT.JOYSTICK:
                this.toggleJoystick(false);
                break;
            case TOUCH_INPUT.MOUSE:
                this.toggleMousePad(false);
                break;
            case TOUCH_INPUT.CURSORS:
                this.toggleCursors(false);
                break;
            case TOUCH_INPUT.KEYBOARD:
                this.toggleKeyboard(false);
                break;
            case TOUCH_INPUT.CUSTOM:
                this.toggleSpecial(false, previousInputMethod === TOUCH_INPUT.CUSTOM);
                break;
        }
    }

    static toggleKeyboard = (showSplash) => {
        GameFocusManager.getInstance().enable();
        UiManager.hideJoystick();
        UiManager.hideCursors();
        UiManager.hideMousepad();
        UiManager.hideCustomControllers();
        UiManager.showKeyboard();
        UiManager.#kb_manager.showTouchKeyboard();
    }

    static keyboardClosed = () => {
        if (UiManager.#previousInputMethod != undefined) {
            UiManager.toggleInputMethod(UiManager.#previousInputMethod);
        }
    }

    static toggleJoystick = (showSplash) => {
        switch (UiManager.#currentJoyTouchMode) {
            case JOYSTICK_TOUCH_MODE.QUICKJOY_PRIMARY:
                if (showSplash) UiManager.osdMessage('QuickJoy', 1000);
                UiManager.showTouchOnly(UiManager.#qj);
                break;
            case JOYSTICK_TOUCH_MODE.QUICKSHOT_DYNAMIC:
                if (showSplash) UiManager.osdMessage('QuickShot', 1000);
                UiManager.showTouchOnly(UiManager.#qs);
                break;
            case JOYSTICK_TOUCH_MODE.QUICKSHOT_KEYBOARD:
                if (showSplash) UiManager.osdMessage('QuickShot', 1000);
                UiManager.showTouchOnly(UiManager.#ck);
                break;
            case JOYSTICK_TOUCH_MODE.HIDEAWAY:
                if (showSplash) UiManager.osdMessage('Auto Hide', 1000);
                UiManager.showTouchOnly(UiManager.#ha);
                break;
        }
    }

    static toggleMousePad = (showSplash) => {
        if (showSplash) UiManager.osdMessage('Trackpad', 1000);
        UiManager.showTouchOnly(UiManager.#mousepad);
    }

    static toggleCursors = (showSplash) => {
        if (showSplash) UiManager.osdMessage('Cursor keys', 1000);
        GameFocusManager.getInstance().enable();
        UiManager.showTouchOnly(UiManager.#ck);
    }

    static toggleSpecial = (showSplash, forcePicker = false) => {
        if (!UiManager.#customControllerManager) {
            return;
        }

        if (forcePicker || !UiManager.#customControllerManager.getActivePreset()) {
            UiManager.#customControllerManager.openPresetPicker();
            return;
        }

        const focusManager = GameFocusManager.getInstance();
        if (UiManager.#customControllerManager.isGameFocusEnabled()) {
            focusManager.enable();
        } else {
            focusManager.disable();
        }

        if (showSplash) {
            const preset = UiManager.#customControllerManager.getActivePreset();
            if (preset?.name) {
                UiManager.osdMessage(preset.name, 1000);
            }
        }

        UiManager.showTouchOnly(UiManager.#customControllerManager);
    }

    static hideCustomControllers() {
        if (UiManager.#customControllerManager) {
            UiManager.#customControllerManager.hide();
        }
    }

    static osdMessage(message, timeInMs = null) {
        const msgDiv = document.getElementById('fastui-msg');

        function fadeOut() {
            msgDiv.style.opacity = '0';
            setTimeout(() => msgDiv.style.display = 'none', 250);
        }

        if (msgDiv.fadeOutTimeout) {
            clearTimeout(msgDiv.fadeOutTimeout);
            msgDiv.fadeOutTimeout = null;
        }

        if (message === null) {
            fadeOut();
            return;
        }

        msgDiv.textContent = message;
        msgDiv.style.display = 'grid';
        setTimeout(() => msgDiv.style.opacity = '1', 0);

        if (timeInMs !== null) {
            msgDiv.fadeOutTimeout = setTimeout(() => {
                fadeOut();
                msgDiv.fadeOutTimeout = null;
            }, timeInMs);
        }
    }
}

class RightControlListener extends TouchButtonListener {
    constructor() {
        super();
    }

    trigger(s) {
        if (s) {
            const rightControlEvent = new KeyboardEvent('keydown', {
                key: 'Control',
                code: 'ControlRight',
                location: 2,
                ctrlKey: true,
                bubbles: true,
                cancelable: true
            });

            document.dispatchEvent(rightControlEvent);
        }
    }
}

class RewindButtonListener extends TouchButtonListener {
    #nostalgist;
    #intervalId;
    static #command = 'REWIND';

    constructor(nostalgist) {
        super();
        this.#nostalgist = nostalgist;
    }

    trigger(s) {
        if (s) {
            this.#nostalgist.sendCommand(RewindButtonListener.#command);
            this.#intervalId = setInterval(() => {
                this.#nostalgist.sendCommand(RewindButtonListener.#command);
            }, 5);
        } else {
            clearInterval(this.#intervalId);
        }
    }
}

class CommandButtonListener extends TouchButtonListener {
    #command;
    #nostalgist;

    constructor(command, nostalgist, message) {
        super();
        this.#command = command;
        this.#nostalgist = nostalgist;
        this.message = message;
    }

    trigger(s) {
        this.#nostalgist.sendCommand(this.#command);
    }
}

class FastForwardListener extends TouchButtonListener {
    static #command = 'FAST_FORWARD';
    #nostalgist;
    #isActive = false;

    constructor(nostalgist) {
        super();
        this.#nostalgist = nostalgist;
    }

    trigger(s) {
        if (s !== this.#isActive) {
            this.#isActive = s;
            this.#nostalgist.sendCommand(FastForwardListener.#command);
        }
    }
}

class SaveButtonListener extends TouchButtonListener {
    #platform_manager;

    constructor(platform_manager) {
        super();
        this.#platform_manager = platform_manager;
    }

    async trigger(event) {
        if (event && event.selected && event.index !== undefined) {
            const isQuickSave = event.index === 0;
            this.#platform_manager.saveState(isQuickSave);
        } else if (event === true) {
            this.#platform_manager.saveState(false);
        }
    }
}

class InputSwitchListener extends TouchButtonListener {
    #inputMethod;

    constructor(inputMethod) {
        super();
        this.#inputMethod = inputMethod;
    }

    trigger(s) {
        if (s) {
            UiManager.toggleInputMethod(this.#inputMethod);
        }
    }
}

class ResetButtonListener extends TouchButtonListener {
    constructor() {
        super();
    }

    trigger(s) {
        if (s) {
            location.reload();
        }
    }
}

class QuitConfirmListener extends TouchButtonListener {
    constructor() {
        super();
    }

    trigger(event) {
        if (event.selected && event.index === 1 && event.label === 'Confirm') {
            location.reload();
        }
    }
}

class JoystickSelectorListener extends TouchButtonListener {
    #touch_controllers;

    constructor(touch_controllers) {
        super();
        this.#touch_controllers = touch_controllers;
    }

    trigger(event) {
        if (event && event.selected && event.index !== undefined) {
            UiManager.selectJoystickByIndex(event.index, this.#touch_controllers);
        } else {
            UiManager.toggleInputMethod(TOUCH_INPUT.JOYSTICK);

            UiManager.updateJoystickSelectorIndex();
        }
    }
}
