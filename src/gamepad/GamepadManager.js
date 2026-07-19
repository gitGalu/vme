import { EnvironmentManager } from '../EnvironmentManager.js';
import { t } from '../i18n/shellStrings.js';

export class GamepadManager {
    constructor() {
        this.gamepads = new Map();
        this.animationContainer = null;
        this.animationFrameId = null;

        this.menuButtons = [];
        this.currentFocusIndex = 0;
        this.cliHasFocus = false;
        this.lastAxisValue = 0;
        this.lastAxisYValue = 0;
        this.lastDpadState = { left: false, right: false, up: false, down: false };
        this.lastAButtonState = false;
        this.lastBButtonState = false;
        this.lastYButtonState = false;
        this.axisDeadzone = 0.5;
        this.inputCooldown = false;
        this.cooldownDuration = 200;

        this.autoRepeatTimer = null;
        this.autoRepeatAction = null;
        this.autoRepeatInitialDelay = 500;
        this.autoRepeatInterval = 150;

        this.guiNavigationEnabled = true;

        this.keyboardKeys = [];
        this.keyboardGrid = [];
        this.currentKeyboardRow = 0;
        this.currentKeyboardCol = 0;
        this.keyboardHasFocus = false;

        this.listItems = [];
        this.currentListIndex = -1;
        this.listHasFocus = false;

        this.keyboardManager = null;
        this.cli = null;

        this.browserActive = false;
        this.browserTopBarFocus = false;
        this.browserButtons = [];
        this.browserCurrentButtonIndex = 0;
        this.browserFlicking = null;
        this.browserBackHandler = null;
        this.lastXButtonState = false;
        this.browserGamepadUsed = false;
        this.browserFlickingChangeHandler = null;
        this.browserDropdown = null;

        // Gamepad-mode entry: detect an EXPLICIT button press in the menu that switches
        // the UI from the classic CLI to the gamepad screen. Deliberately separate from
        // the existing navigation - easy to remove.
        this.menuTriggerEnabled = false;
        this.onMenuTrigger = null;
        this.menuTriggerWasIdle = true;

        // While the gamepad screen is active, classic CLI navigation is skipped and a
        // dedicated handler takes input (up/down + A=enter, B=exit).
        this.gamepadMenuActive = false;
        this.gamepadMenuHandlers = null;
        this.gamepadMenuLast = { up: false, down: false, left: false, right: false, a: false, b: false, x: false, y: false };
        this.gamepadMenuLastAxis = { x: 0, y: 0 };
        // After entering the menu we wait for the pad to be idle, so the (still-held)
        // button used to open the menu doesn't immediately activate the first item.
        this.gamepadMenuWaitIdle = true;

        this.init();
    }

    init() {
        this.createAnimationContainer();

        this.createFocusOutline();

        this.createLegendBar();

        window.addEventListener('gamepadconnected', (e) => this.handleGamepadConnected(e));
        window.addEventListener('gamepaddisconnected', (e) => this.handleGamepadDisconnected(e));

        this.startPolling();

        this.initKeyboardNavigationSupport();
    }

    initKeyboardNavigationSupport() {
        document.addEventListener('keydown', (e) => {
            if (!this.hasGamepad()) return;

            if (this.keyboardHasFocus || this.browserActive || this.cliHasFocus) return;

            if (this.listHasFocus) {
                switch(e.key) {
                    case 'ArrowUp':
                        e.preventDefault();
                        this.navigateList(-1);
                        break;
                    case 'ArrowDown':
                        e.preventDefault();
                        this.navigateList(1);
                        break;
                    case 'Enter':
                        e.preventDefault();
                        this.activateListItem();
                        break;
                    case 'Escape':
                        e.preventDefault();
                        this.clearListFocus();
                        this.updateFocus();
                        break;
                }
                return;
            }

            if (this.menuButtons.length === 0) return;

            switch(e.key) {
                case 'ArrowLeft':
                    e.preventDefault();
                    this.moveFocus(-1);
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    this.moveFocus(1);
                    break;
                case 'Tab':
                    e.preventDefault();
                    this.moveFocus(e.shiftKey ? -1 : 1);
                    break;
                case 'Enter':
                    e.preventDefault();
                    this.activateFocusedButton();
                    break;
            }
        });
    }

    createFocusOutline() {
        this.focusOutline = document.createElement('div');
        this.focusOutline.id = 'gamepad-focus-outline';
        this.focusOutline.className = 'gamepad-focus-outline';
        document.body.appendChild(this.focusOutline);
    }

    createLegendBar() {
        this.legendBar = document.createElement('div');
        this.legendBar.id = 'gamepad-legend-bar';
        this.legendBar.className = 'gamepad-legend-bar';

        document.body.appendChild(this.legendBar);

        // Default content (in case it's shown), but the bar starts HIDDEN - it appears
        // only when the shell/browser is active (doesn't cover the CLI after connecting a pad).
        this.showLegendActions();
    }

    /**
     * Renders the legend bar content.
     * @param {Array<{glyph?:string,label:string}>} items - no glyph => text only (a prompt).
     */
    setLegend(items) {
        if (!this.legendBar) return;
        this.legendBar.innerHTML = '';

        for (const it of items) {
            const item = document.createElement('div');
            item.className = 'gamepad-legend-item';

            if (it.glyph) {
                const glyph = document.createElement('span');
                glyph.className = 'gamepad-legend-glyph';
                glyph.dataset.button = it.glyph;
                glyph.textContent = it.glyph;
                item.appendChild(glyph);
            }

            const label = document.createElement('span');
            label.className = 'gamepad-legend-label';
            label.textContent = it.label;
            item.appendChild(label);

            this.legendBar.appendChild(item);
        }
    }

    /** "Pad connected, but gamepad mode inactive" state - a prompt. */
    showLegendPrompt() {
        this.legendBar?.classList.add('gamepad-legend-prompt');
        this.setLegend([
            { label: t('legend.prompt') }
        ]);
    }

    /**
     * Active gamepad-mode state - action glyphs. Glyphs are positional/neutral,
     * assume standard mapping; they don't mimic a brand (Xbox/PS/Nintendo).
     * @param {Array<{glyph:string,label:string}>} [actions]
     */
    showLegendActions(actions) {
        this.legendBar?.classList.remove('gamepad-legend-prompt');
        this.setLegend(actions || [
            { glyph: 'A', label: t('legend.open') },
            { glyph: 'B', label: t('legend.back') },
            { glyph: 'X', label: t('menu.search') },
            { glyph: 'Y', label: t('menu.platform') }
        ]);
    }

    showLegendBar() {
        if (this.legendBar) {
            this.legendBar.classList.add('visible');
        }
    }

    hideLegendBar() {
        if (this.legendBar) {
            this.legendBar.classList.remove('visible');
        }
    }

    createAnimationContainer() {
        this.animationContainer = document.createElement('div');
        this.animationContainer.id = 'gamepad-message-container';
        this.animationContainer.className = 'gamepad-message';
        document.body.appendChild(this.animationContainer);
    }

    handleGamepadConnected(event) {
        const gamepad = event.gamepad;
        console.log(`Gamepad connected: ${gamepad.id} (index: ${gamepad.index})`);

        this.gamepads.set(gamepad.index, gamepad);
        // No 'Gamepad connected' toast - it was redundant (the pad only reveals itself once
        // a button is pressed, so the user already knows it works) and confusing. Only the
        // 'disconnected' toast remains (informs about losing the pad).
    }

    handleGamepadDisconnected(event) {
        const gamepad = event.gamepad;
        console.log(`Gamepad disconnected: ${gamepad.id} (index: ${gamepad.index})`);

        this.gamepads.delete(gamepad.index);

        this.showAnimation('disconnect');

        if (!this.hasGamepad()) {
            this.hideLegendBar();
        }
    }

    showAnimation(type) {
        if (this.animationFrameId) {
            clearTimeout(this.animationFrameId);
            this.animationFrameId = null;
        }

        // Currently called only for 'disconnect' (the 'connected' toast was removed as redundant).
        this.animationContainer.textContent =
            type === 'connect' ? 'Gamepad connected' : 'Gamepad disconnected';

        this.animationContainer.classList.remove('show', 'hide');

        void this.animationContainer.offsetWidth;

        this.animationContainer.classList.add('show');

        const duration = 2000;
        this.animationFrameId = setTimeout(() => {
            this.hideAnimation();
        }, duration);
    }

    hideAnimation() {
        if (this.animationFrameId) {
            clearTimeout(this.animationFrameId);
            this.animationFrameId = null;
        }

        this.animationContainer.classList.remove('show');
        this.animationContainer.classList.add('hide');

        setTimeout(() => {
            this.animationContainer.classList.remove('hide');
            this.animationContainer.textContent = '';
        }, 300);
    }

    startPolling() {
        const poll = () => {
            const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];

            for (let i = 0; i < gamepads.length; i++) {
                const gamepad = gamepads[i];
                if (gamepad) {
                    if (!this.gamepads.has(gamepad.index)) {
                        this.gamepads.set(gamepad.index, gamepad);
                        this.handleGamepadConnected({ gamepad });
                    }

                    if (this.gamepadMenuActive) {
                        this.pollGamepadMenu(gamepad);
                    } else if (this.ingameMenuHandlers) {
                        // In-game (pad mode): detect long-press Start -> in-game menu.
                        this.pollIngameTrigger(gamepad);
                    } else {
                        this.detectMenuTrigger(gamepad);
                        this.pollMenuNavigation(gamepad);
                    }
                }
            }

            requestAnimationFrame(poll);
        };

        requestAnimationFrame(poll);
    }

    setManagers(keyboardManager, cli) {
        this.keyboardManager = keyboardManager;
        this.cli = cli;
    }

    /**
     * Enables/disables detection of entering gamepad mode from the menu.
     * @param {boolean} enabled
     * @param {Function} [onTrigger] callback fired on the first button press
     */
    /** Whether the shell trigger is active (we're on the MENU screen). */
    isMenuTriggerEnabled() {
        return !!this.menuTriggerEnabled;
    }

    /**
     * Enable/disable the pad's in-game menu (long-press Start).
     * @param {?object} handlers { openMenu, isMenuOpen, navigate(d), activate, close } or null.
     */
    setIngameMenu(handlers) {
        this.ingameMenuHandlers = handlers || null;
        this.ingameStartHeldSince = 0;
        this.ingameLongPressFired = false;
        this.ingameLast = { up: false, down: false, a: false, b: false };
    }

    /**
     * In-game polling (pad mode): a LONG-PRESS of one of the triggers opens the menu;
     * when open - navigation. Triggers: Start (9), Select (8), R3 (11).
     */
    pollIngameTrigger(gamepad) {
        const h = this.ingameMenuHandlers;
        if (!h) return;

        const menuOpen = h.isMenuOpen?.();

        if (menuOpen) {
            // Menu open -> navigate with D-pad/left stick, A=select, B=close.
            // The RIGHT stick is free here - XR uses it for screen placement
            // (distance/size), streamed continuously while deflected.
            if (h.adjustScreen) {
                const rx = gamepad.axes[2] || 0;
                const ry = gamepad.axes[3] || 0;
                if (Math.abs(rx) > this.axisDeadzone || Math.abs(ry) > this.axisDeadzone) {
                    h.adjustScreen(rx, ry);
                }
            }
            const up = gamepad.buttons[12]?.pressed || (gamepad.axes[1] || 0) < -this.axisDeadzone;
            const down = gamepad.buttons[13]?.pressed || (gamepad.axes[1] || 0) > this.axisDeadzone;
            const a = gamepad.buttons[0]?.pressed || false;
            const b = gamepad.buttons[1]?.pressed || false;
            const L = this.ingameLast;
            if (up && !L.up) h.navigate?.(-1);
            if (down && !L.down) h.navigate?.(1);
            if (a && !L.a) h.activate?.();
            if (b && !L.b) h.close?.();
            this.ingameLast = { up, down, a, b };
            // Reset long-press state so it doesn't fire again right after closing.
            this.ingameStartHeldSince = 0;
            this.ingameLongPressFired = false;
            return;
        }

        // Joystick bridge (joystick-via-keyboard platforms): d-pad/left stick + fire
        // -> keys (on A800 fire also goes through the '-' key, not joypad). Fire = action
        // buttons (0/1/2/3), since the filter may merge 0+1.
        if (h.joystick) {
            h.joystick({
                up: (gamepad.buttons[12]?.pressed) || (gamepad.axes[1] || 0) < -this.axisDeadzone || false,
                down: (gamepad.buttons[13]?.pressed) || (gamepad.axes[1] || 0) > this.axisDeadzone || false,
                left: (gamepad.buttons[14]?.pressed) || (gamepad.axes[0] || 0) < -this.axisDeadzone || false,
                right: (gamepad.buttons[15]?.pressed) || (gamepad.axes[0] || 0) > this.axisDeadzone || false,
                fire: (gamepad.buttons[0]?.pressed) || (gamepad.buttons[1]?.pressed) || false
            });
        }

        // Menu closed -> measure the hold of ANY trigger (Start/Select/R3).
        const LONG_PRESS_MS = 550;
        const triggerHeld =
            (gamepad.buttons[9]?.pressed) ||   // Start
            (gamepad.buttons[8]?.pressed) ||   // Select
            (gamepad.buttons[11]?.pressed) ||  // R3 (right stick click)
            false;

        if (triggerHeld) {
            if (!this.ingameStartHeldSince) {
                this.ingameStartHeldSince = performance.now();
                this.ingameLongPressFired = false;
            } else if (!this.ingameLongPressFired
                       && performance.now() - this.ingameStartHeldSince >= LONG_PRESS_MS) {
                this.ingameLongPressFired = true;
                h.openMenu?.();
            }
        } else {
            this.ingameStartHeldSince = 0;
            this.ingameLongPressFired = false;
        }
    }

    setMenuTrigger(enabled, onTrigger = null) {
        this.menuTriggerEnabled = enabled;
        if (onTrigger) {
            this.onMenuTrigger = onTrigger;
        }
        // Require an idle state (no button) before counting a press, so a held button
        // from a previous context doesn't fire immediately.
        this.menuTriggerWasIdle = false;
    }

    /**
     * Activates/deactivates input routing to the gamepad screen.
     * @param {boolean} active
     * @param {{navigate:Function, activate:Function, back:Function,
     *          toggleFilter?:Function, backspace?:Function}} [handlers]
     *        navigate(deltaRow, deltaCol) | activate() | back() | toggleFilter() | backspace()
     */
    setGamepadMenuActive(active, handlers = null) {
        this.gamepadMenuActive = active;
        if (handlers) {
            this.gamepadMenuHandlers = handlers;
        }
        this.gamepadMenuLast = { up: false, down: false, left: false, right: false, a: false, b: false, x: false, y: false };
        this.gamepadMenuLastAxis = { x: 0, y: 0 };
        this.gamepadMenuWaitIdle = true;
        this.stopAutoRepeat();
    }

    pollGamepadMenu(gamepad) {
        const h = this.gamepadMenuHandlers;
        if (!h) return;

        const a = gamepad.buttons[0]?.pressed || false;
        const b = gamepad.buttons[1]?.pressed || false;
        const x = gamepad.buttons[2]?.pressed || false;
        const y = gamepad.buttons[3]?.pressed || false;
        const dpadUp = gamepad.buttons[12]?.pressed || false;
        const dpadDown = gamepad.buttons[13]?.pressed || false;
        const dpadLeft = gamepad.buttons[14]?.pressed || false;
        const dpadRight = gamepad.buttons[15]?.pressed || false;
        const axisX = gamepad.axes[0] || 0;
        const axisY = gamepad.axes[1] || 0;

        // Until the pad returns to idle, ignore input (see gamepadMenuWaitIdle).
        // IMPORTANT: we check ONLY buttons/axes used by the shell (A/B/X/Y, d-pad, sticks),
        // NOT Start/Select/bumpers etc. Otherwise a Start button (9) "stuck" in getGamepads
        // - seen after leaving the Save Browser - blocked waitIdle forever (dead shell).
        if (this.gamepadMenuWaitIdle) {
            const SHELL_BUTTONS = [0, 1, 2, 3, 12, 13, 14, 15];   // A,B,X,Y + d-pad
            const anyButton = SHELL_BUTTONS.some(i => gamepad.buttons[i] && gamepad.buttons[i].pressed);
            const anyAxis = gamepad.axes.some(ax => Math.abs(ax) > this.axisDeadzone);
            if (!anyButton && !anyAxis) {
                this.gamepadMenuWaitIdle = false;
            }
            this.gamepadMenuLast = { up: dpadUp, down: dpadDown, left: dpadLeft, right: dpadRight, a, b, x, y };
            this.gamepadMenuLastAxis = { x: axisX, y: axisY };
            return;
        }

        // Edge actions: A=enter, B=back, X=toggle filter, Y=backspace.
        const L = this.gamepadMenuLast;
        if (a && !L.a) h.activate?.();
        if (b && !L.b) h.back?.();
        if (x && !L.x) h.toggleFilter?.();
        if (y && !L.y) h.backspace?.();

        // Directions: D-pad or left stick, with auto-repeat.
        const up = dpadUp || (axisY < -this.axisDeadzone);
        const down = dpadDown || (axisY > this.axisDeadzone);
        const left = dpadLeft || (axisX < -this.axisDeadzone);
        const right = dpadRight || (axisX > this.axisDeadzone);
        const wasUp = L.up || (this.gamepadMenuLastAxis.y < -this.axisDeadzone);
        const wasDown = L.down || (this.gamepadMenuLastAxis.y > this.axisDeadzone);
        const wasLeft = L.left || (this.gamepadMenuLastAxis.x < -this.axisDeadzone);
        const wasRight = L.right || (this.gamepadMenuLastAxis.x > this.axisDeadzone);

        if (up && !wasUp) {
            this.startAutoRepeat(() => h.navigate?.(-1, 0));
        } else if (down && !wasDown) {
            this.startAutoRepeat(() => h.navigate?.(1, 0));
        } else if (left && !wasLeft) {
            this.startAutoRepeat(() => h.navigate?.(0, -1));
        } else if (right && !wasRight) {
            this.startAutoRepeat(() => h.navigate?.(0, 1));
        } else if (!up && !down && !left && !right &&
                   (wasUp || wasDown || wasLeft || wasRight)) {
            this.stopAutoRepeat();
        }

        this.gamepadMenuLast = { up: dpadUp, down: dpadDown, left: dpadLeft, right: dpadRight, a, b, x, y };
        this.gamepadMenuLastAxis = { x: axisX, y: axisY };
    }

    detectMenuTrigger(gamepad) {
        if (!this.menuTriggerEnabled || !gamepad) return;

        const anyButton = gamepad.buttons.some(b => b && b.pressed);
        const anyAxis = gamepad.axes.some(a => Math.abs(a) > this.axisDeadzone);
        const active = anyButton || anyAxis;

        if (!this.menuTriggerWasIdle) {
            // Wait for the pad to be idle before we start listening.
            if (!active) {
                this.menuTriggerWasIdle = true;
            }
            return;
        }

        if (active) {
            this.menuTriggerWasIdle = false;
            if (this.onMenuTrigger) {
                this.onMenuTrigger();
            }
        }
    }

    initMenuNavigation() {
        this.menuButtons = [
            document.getElementById('menu-item-system'),
            document.getElementById('menu-item-help'),
            document.getElementById('menu-item-savestates'),
            document.getElementById('menu-item-compilations'),
            document.getElementById('menu-item-open'),
            document.getElementById('menu-item-about')
        ].filter(btn => btn !== null);

        if (this.menuButtons.length > 0) {
            this.currentFocusIndex = 0;
            this.cliHasFocus = false;
            this.updateFocus();
        }
    }

    pollMenuNavigation(gamepad) {
        if (!gamepad) {
            return;
        }

        if (!this.guiNavigationEnabled) {
            return;
        }

        if (this.browserActive) {
            this.handleBrowserNavigation(gamepad);
            return;
        }

        // The old gamepad CLI navigation (below) is DISABLED - replaced by the gamepad
        // shell. The CLI is operated with mouse/keyboard. We keep the dead code but don't
        // run it (it caused, among others, an aero-glass outline around the CLI on connect).
        return;

        /* eslint-disable no-unreachable */
        const aButton = gamepad.buttons[0] && gamepad.buttons[0].pressed;

        const bButton = gamepad.buttons[1] && gamepad.buttons[1].pressed;

        const yButton = gamepad.buttons[3] && gamepad.buttons[3].pressed;

        if (bButton && !this.lastBButtonState) {
            this.stopAutoRepeat();

            if (this.listHasFocus) {
                this.clearListFocus();

                if (this.cli) {
                    this.cli.clear();
                    document.getElementById('cors_query').textContent = '';
                }

                this.cliHasFocus = true;
                this.addCliFocus();
            } else if (this.keyboardHasFocus || this.cliHasFocus) {
                this.keyboardHasFocus = false;
                this.cliHasFocus = false;

                const allKeys = document.querySelectorAll('.key');
                allKeys.forEach(key => key.classList.remove('keyboard-gamepad-focused'));

                if (this.keyboardManager) {
                    this.keyboardManager.hideTouchKeyboard();
                }

                this.updateFocus();
            }
        }

        if (yButton && !this.lastYButtonState) {
            this.stopAutoRepeat();

            if (this.listHasFocus) {
                this.clearListFocus();

                if (this.cli) {
                    this.cli.set_selection_mode(false);
                }

                this.cliHasFocus = true;
                this.addCliFocus();
            } else if (this.keyboardHasFocus) {
                this.keyboardHasFocus = false;
                this.cliHasFocus = false;

                const allKeys = document.querySelectorAll('.key');
                allKeys.forEach(key => key.classList.remove('keyboard-gamepad-focused'));

                if (this.keyboardManager) {
                    this.keyboardManager.hideTouchKeyboard();
                }

                const listContainer = document.getElementById('cors_results');
                if (listContainer) {
                    const items = Array.from(listContainer.querySelectorAll('.corsrow'));
                    if (items.length > 0) {
                        this.listItems = items;
                        this.currentListIndex = 0;
                        this.listHasFocus = true;
                        this.updateListFocus();
                    } else {
                        this.updateFocus();
                    }
                } else {
                    this.updateFocus();
                }
            } else if (!this.cliHasFocus && !this.keyboardHasFocus) {
                this.cliHasFocus = true;

                if (this.menuButtons.length > 0) {
                    this.menuButtons[this.currentFocusIndex].classList.remove('gamepad-focused');
                }

                this.addCliFocus();
            }
        }

        const xButton = gamepad.buttons[2] && gamepad.buttons[2].pressed;

        if (xButton && !this.lastXButtonState) {
            if (this.keyboardHasFocus) {
                const backspaceKey = document.getElementById('keyBackspace');
                if (backspaceKey && this.cli && !this.cli.is_loading()) {
                    const clickEvent = new MouseEvent('click', {
                        bubbles: true,
                        cancelable: true,
                        view: window
                    });
                    backspaceKey.dispatchEvent(clickEvent);
                }
            }
        }

        if (aButton && !this.lastAButtonState) {
            if (this.listHasFocus) {
                this.activateListItem();
            } else if (this.keyboardHasFocus) {
                this.activateKeyboardKey();
            } else if (this.menuButtons.length > 0 && !this.cliHasFocus) {
                this.activateFocusedButton();
            }
        }

        this.lastAButtonState = aButton;
        this.lastBButtonState = bButton;
        this.lastYButtonState = yButton;
        this.lastXButtonState = xButton;

        if (this.menuButtons.length === 0) {
            return;
        }

        if (this.inputCooldown) {
            return;
        }

        const dpadUp = gamepad.buttons[12] && gamepad.buttons[12].pressed;
        const dpadDown = gamepad.buttons[13] && gamepad.buttons[13].pressed;
        const dpadLeft = gamepad.buttons[14] && gamepad.buttons[14].pressed;
        const dpadRight = gamepad.buttons[15] && gamepad.buttons[15].pressed;

        const axisX = gamepad.axes[0] || 0;
        const axisY = gamepad.axes[1] || 0;

        if (this.listHasFocus) {
            if (dpadUp && !this.lastDpadState.up) {
                this.startAutoRepeat(() => this.navigateList(-1));
            } else if (dpadDown && !this.lastDpadState.down) {
                this.startAutoRepeat(() => this.navigateList(1));
            }
            else if (!dpadUp && this.lastDpadState.up) {
                this.stopAutoRepeat();
            } else if (!dpadDown && this.lastDpadState.down) {
                this.stopAutoRepeat();
            }
            else if (Math.abs(axisY) > this.axisDeadzone) {
                if (axisY < -this.axisDeadzone && this.lastAxisYValue >= -this.axisDeadzone) {
                    this.startAutoRepeat(() => this.navigateList(-1));
                } else if (axisY > this.axisDeadzone && this.lastAxisYValue <= this.axisDeadzone) {
                    this.startAutoRepeat(() => this.navigateList(1));
                }
            }
            else if (Math.abs(axisY) <= this.axisDeadzone && Math.abs(this.lastAxisYValue) > this.axisDeadzone) {
                this.stopAutoRepeat();
            }
        }
        else if (this.keyboardHasFocus) {
            if (dpadUp && !this.lastDpadState.up) {
                this.startAutoRepeat(() => this.navigateKeyboard(-1, 0));
            } else if (dpadDown && !this.lastDpadState.down) {
                this.startAutoRepeat(() => this.navigateKeyboard(1, 0));
            } else if (dpadLeft && !this.lastDpadState.left) {
                this.startAutoRepeat(() => this.navigateKeyboard(0, -1));
            } else if (dpadRight && !this.lastDpadState.right) {
                this.startAutoRepeat(() => this.navigateKeyboard(0, 1));
            }
            else if (!dpadUp && this.lastDpadState.up) {
                this.stopAutoRepeat();
            } else if (!dpadDown && this.lastDpadState.down) {
                this.stopAutoRepeat();
            } else if (!dpadLeft && this.lastDpadState.left) {
                this.stopAutoRepeat();
            } else if (!dpadRight && this.lastDpadState.right) {
                this.stopAutoRepeat();
            }
            else if (Math.abs(axisY) > this.axisDeadzone) {
                if (axisY < -this.axisDeadzone && this.lastAxisYValue >= -this.axisDeadzone) {
                    this.startAutoRepeat(() => this.navigateKeyboard(-1, 0));
                } else if (axisY > this.axisDeadzone && this.lastAxisYValue <= this.axisDeadzone) {
                    this.startAutoRepeat(() => this.navigateKeyboard(1, 0));
                }
            } else if (Math.abs(axisX) > this.axisDeadzone) {
                if (axisX < -this.axisDeadzone && this.lastAxisValue >= -this.axisDeadzone) {
                    this.startAutoRepeat(() => this.navigateKeyboard(0, -1));
                } else if (axisX > this.axisDeadzone && this.lastAxisValue <= this.axisDeadzone) {
                    this.startAutoRepeat(() => this.navigateKeyboard(0, 1));
                }
            }
            else if (Math.abs(axisY) <= this.axisDeadzone && Math.abs(this.lastAxisYValue) > this.axisDeadzone) {
                this.stopAutoRepeat();
            } else if (Math.abs(axisX) <= this.axisDeadzone && Math.abs(this.lastAxisValue) > this.axisDeadzone) {
                this.stopAutoRepeat();
            }
        }
        else {
            if (this.canScrollContent()) {
                if (dpadDown && !this.lastDpadState.down) {
                    this.startAutoRepeat(() => this.scrollContent(1));
                } else if (dpadUp && !this.lastDpadState.up) {
                    this.startAutoRepeat(() => this.scrollContent(-1));
                }
                else if (!dpadDown && this.lastDpadState.down) {
                    this.stopAutoRepeat();
                } else if (!dpadUp && this.lastDpadState.up) {
                    this.stopAutoRepeat();
                }
                else if (Math.abs(axisY) > this.axisDeadzone) {
                    if (axisY > this.axisDeadzone && this.lastAxisYValue <= this.axisDeadzone) {
                        this.startAutoRepeat(() => this.scrollContent(1));
                    } else if (axisY < -this.axisDeadzone && this.lastAxisYValue >= -this.axisDeadzone) {
                        this.startAutoRepeat(() => this.scrollContent(-1));
                    }
                }
                else if (Math.abs(axisY) <= this.axisDeadzone && Math.abs(this.lastAxisYValue) > this.axisDeadzone) {
                    this.stopAutoRepeat();
                }
            }

            if (dpadLeft && !this.lastDpadState.left) {
                this.startAutoRepeat(() => this.moveFocus(-1));
            } else if (dpadRight && !this.lastDpadState.right) {
                this.startAutoRepeat(() => this.moveFocus(1));
            }
            else if (!dpadLeft && this.lastDpadState.left) {
                this.stopAutoRepeat();
            } else if (!dpadRight && this.lastDpadState.right) {
                this.stopAutoRepeat();
            }
            else if (Math.abs(axisX) > this.axisDeadzone) {
                if (axisX < -this.axisDeadzone && this.lastAxisValue >= -this.axisDeadzone) {
                    this.startAutoRepeat(() => this.moveFocus(-1));
                } else if (axisX > this.axisDeadzone && this.lastAxisValue <= this.axisDeadzone) {
                    this.startAutoRepeat(() => this.moveFocus(1));
                }
            }
            else if (Math.abs(axisX) <= this.axisDeadzone && Math.abs(this.lastAxisValue) > this.axisDeadzone) {
                this.stopAutoRepeat();
            }
        }

        this.lastDpadState.up = dpadUp;
        this.lastDpadState.down = dpadDown;
        this.lastDpadState.left = dpadLeft;
        this.lastDpadState.right = dpadRight;
        this.lastAxisValue = axisX;
        this.lastAxisYValue = axisY;
    }

    canScrollContent() {
        const container = document.getElementById('cors_results');
        if (!container) return false;

        const listItems = container.querySelectorAll('.corsrow');
        if (listItems.length > 0) return false;

        const hasContent = container.children.length > 0;
        const isScrollable = container.scrollHeight > container.clientHeight;

        return hasContent && isScrollable;
    }

    scrollContent(direction) {
        const container = document.getElementById('cors_results');
        if (!container) return;

        const scrollAmount = container.offsetHeight;
        container.scrollTop += direction * scrollAmount;
    }

    moveFocus(delta) {
        if (this.menuButtons.length === 0) return;

        this.menuButtons[this.currentFocusIndex].classList.remove('gamepad-focused');

        this.currentFocusIndex += delta;
        if (this.currentFocusIndex < 0) {
            this.currentFocusIndex = this.menuButtons.length - 1;
        } else if (this.currentFocusIndex >= this.menuButtons.length) {
            this.currentFocusIndex = 0;
        }

        this.updateFocus();
    }

    moveFocusVertical(delta) {
        if (delta > 0) {
            if (!this.cliHasFocus && !this.listHasFocus && this.menuButtons.length > 0) {
                this.cliHasFocus = true;
                this.menuButtons[this.currentFocusIndex].classList.remove('gamepad-focused');
                this.addCliFocus();
                this.startInputCooldown();
            }
        } else {
            if ((this.cliHasFocus || this.listHasFocus) && this.menuButtons.length > 0) {
                this.cliHasFocus = false;
                this.keyboardHasFocus = false;
                this.removeCliFocus();

                const allKeys = document.querySelectorAll('.key');
                allKeys.forEach(key => key.classList.remove('keyboard-gamepad-focused'));

                this.clearListFocus();

                this.updateFocus();
                this.startInputCooldown();
            }
        }
    }

    addCliFocus() {
        this.stopAutoRepeat();

        if (this.menuButtons.length > 0) {
            this.menuButtons.forEach(btn => btn.classList.remove('gamepad-focused'));
        }

        if (this.keyboardManager) {
            this.showKeyboardForGamepad();

            requestAnimationFrame(() => {
                if (this.focusOutline) {
                    this.focusOutline.classList.add('no-transition');
                }

                this.initKeyboardNavigation();

                const animationDuration = 650;
                const startTime = Date.now();

                const updateFocusPosition = () => {
                    const elapsed = Date.now() - startTime;
                    if (elapsed < animationDuration && this.keyboardHasFocus) {
                        this.updateKeyboardFocus();
                        requestAnimationFrame(updateFocusPosition);
                    } else if (this.focusOutline) {
                        this.focusOutline.classList.remove('no-transition');
                    }
                };

                updateFocusPosition();
            });
        }
    }

    initKeyboardNavigation() {
        const allKeys = Array.from(document.querySelectorAll('.key'));
        this.keyboardKeys = allKeys.filter(key => {
            const style = window.getComputedStyle(key);
            return style.visibility === 'visible' && style.display !== 'none';
        });

        // layer detection
        const hasOnlyLayerA = this.keyboardKeys.some(key =>
            key.classList.contains('layerA') &&
            !key.classList.contains('layerB') &&
            !key.classList.contains('layerC')
        );
        const hasLayerB = this.keyboardKeys.some(key =>
            key.classList.contains('layerB') &&
            !key.classList.contains('layerA') &&
            !key.classList.contains('layerC')
        );
        const hasLayerC = this.keyboardKeys.some(key =>
            key.classList.contains('layerC') &&
            !key.classList.contains('layerA') &&
            !key.classList.contains('layerB')
        );

        if (hasOnlyLayerA) {
            this.keyboardGrid = [
                ['keyQ', 'keyW', 'keyE', 'keyR', 'keyT', 'keyY', 'keyU', 'keyI', 'keyO', 'keyP'],
                ['keyA', 'keyS', 'keyD', 'keyF', 'keyG', 'keyH', 'keyJ', 'keyK', 'keyL'],
                ['keyShift', 'keyZ', 'keyX', 'keyC', 'keyV', 'keyB', 'keyN', 'keyM', 'keyBackspace'],
                ['keyToggle', 'keySpace', 'keyEnter']
            ];
        } else if (hasLayerB) {
            this.keyboardGrid = [
                ['key0', 'key1', 'key2', 'key3', 'key4', 'key5', 'key6', 'key7', 'key8', 'key9'],
                ['keyMinus', 'keySlash', 'keyColon', 'keySemicolon', 'keyBracketLeft', 'keyBracketRight', 'keyDollar', 'keyAmpersand', 'keyAt', 'keyQuote'],
                ['keyShift', 'keyPeriod', 'keyComma', 'keyQuestion', 'keyExclamation', 'keyApostrophe', 'keyBackspace'],
                ['keyToggle', 'keySpace', 'keyEnter']
            ];
        } else if (hasLayerC) {
            this.keyboardGrid = [
                ['key1', 'key2', 'key3', 'key4', 'key5', 'key6', 'key7', 'key8', 'key9', 'key0'],
                ['keyMinus', 'keySlash', 'keyColon', 'keySemicolon', 'keyLeftParen', 'keyRightParen', 'keyDollar', 'keyAmpersand', 'keyAt', 'keyQuote'],
                ['keyShift', 'keyPeriod', 'keyComma', 'keyQuestion', 'keyExclamation', 'keyApostrophe', 'keyBackspace'],
                ['keyToggle', 'keySpace', 'keyEnter']
            ];
        } else {
            this.keyboardGrid = [
                ['keyQ', 'keyW', 'keyE', 'keyR', 'keyT', 'keyY', 'keyU', 'keyI', 'keyO', 'keyP'],
                ['keyA', 'keyS', 'keyD', 'keyF', 'keyG', 'keyH', 'keyJ', 'keyK', 'keyL'],
                ['keyShift', 'keyZ', 'keyX', 'keyC', 'keyV', 'keyB', 'keyN', 'keyM', 'keyBackspace'],
                ['keyToggle', 'keySpace', 'keyEnter']
            ];
        }

        this.keyboardGrid = this.keyboardGrid.map(row =>
            row.filter(keyId => document.getElementById(keyId) !== null)
        ).filter(row => row.length > 0);

        if (this.currentKeyboardRow >= this.keyboardGrid.length) {
            this.currentKeyboardRow = 0;
        }
        if (this.currentKeyboardCol >= this.keyboardGrid[this.currentKeyboardRow].length) {
            this.currentKeyboardCol = 0;
        }

        this.keyboardHasFocus = true;
        this.updateKeyboardFocus();
    }

    updateKeyboardFocus() {
        if (!this.keyboardHasFocus || this.keyboardGrid.length === 0) return;

        const allKeys = document.querySelectorAll('.key');
        allKeys.forEach(key => key.classList.remove('keyboard-gamepad-focused'));

        const currentKeyId = this.keyboardGrid[this.currentKeyboardRow][this.currentKeyboardCol];
        const currentKey = document.getElementById(currentKeyId);
        if (currentKey) {
            currentKey.classList.add('keyboard-gamepad-focused');
            this.updateFocusOutline(currentKey);
        }
    }

    navigateKeyboard(deltaRow, deltaCol) {
        if (!this.keyboardHasFocus) return;

        if (deltaRow !== 0) {
            const currentKeyId = this.keyboardGrid[this.currentKeyboardRow][this.currentKeyboardCol];
            const currentKey = document.getElementById(currentKeyId);

            if (currentKey) {
                const currentRect = currentKey.getBoundingClientRect();
                const currentCenter = currentRect.left + currentRect.width / 2;

                this.currentKeyboardRow += deltaRow;
                if (this.currentKeyboardRow < 0) {
                    this.currentKeyboardRow = this.keyboardGrid.length - 1;
                } else if (this.currentKeyboardRow >= this.keyboardGrid.length) {
                    this.currentKeyboardRow = 0;
                }

                const newRow = this.keyboardGrid[this.currentKeyboardRow];
                let closestIndex = 0;
                let closestDistance = Infinity;

                for (let i = 0; i < newRow.length; i++) {
                    const keyId = newRow[i];
                    const keyElement = document.getElementById(keyId);
                    if (keyElement) {
                        const keyRect = keyElement.getBoundingClientRect();
                        const keyCenter = keyRect.left + keyRect.width / 2;
                        const distance = Math.abs(keyCenter - currentCenter);

                        if (distance < closestDistance) {
                            closestDistance = distance;
                            closestIndex = i;
                        }
                    }
                }

                this.currentKeyboardCol = closestIndex;
            } else {
                this.currentKeyboardRow += deltaRow;
                if (this.currentKeyboardRow < 0) {
                    this.currentKeyboardRow = this.keyboardGrid.length - 1;
                } else if (this.currentKeyboardRow >= this.keyboardGrid.length) {
                    this.currentKeyboardRow = 0;
                }

                const maxCol = this.keyboardGrid[this.currentKeyboardRow].length - 1;
                if (this.currentKeyboardCol > maxCol) {
                    this.currentKeyboardCol = maxCol;
                }
            }
        }

        if (deltaCol !== 0) {
            this.currentKeyboardCol += deltaCol;
            const maxCol = this.keyboardGrid[this.currentKeyboardRow].length - 1;
            if (this.currentKeyboardCol < 0) {
                this.currentKeyboardCol = maxCol;
            } else if (this.currentKeyboardCol > maxCol) {
                this.currentKeyboardCol = 0;
            }
        }

        this.updateKeyboardFocus();
    }

    activateKeyboardKey() {
        if (!this.keyboardHasFocus) return;

        const currentKeyId = this.keyboardGrid[this.currentKeyboardRow][this.currentKeyboardCol];
        const currentKey = document.getElementById(currentKeyId);

        if (currentKey && this.cli) {
            if (!this.cli.is_loading()) {
                const clickEvent = new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    view: window
                });
                currentKey.dispatchEvent(clickEvent);

                // If toggle or shift key was pressed, rebuild the grid after a short delay
                if (currentKeyId === 'keyToggle' || currentKeyId === 'keyShift') {
                    setTimeout(() => {
                        this.initKeyboardNavigation();
                    }, 100);
                }
            }
        }
    }

    removeCliFocus() {
    }

    showKeyboardForGamepad() {
        if (EnvironmentManager.isQuest()) {
            document.getElementById('cors_hidden_input').focus();
            this.keyboardManager.showTouchKeyboard();
        } else {
            this.keyboardManager.showTouchKeyboard();
        }
    }

    updateFocus() {
        if (this.menuButtons.length === 0) return;

        this.menuButtons.forEach(btn => btn.classList.remove('gamepad-focused'));

        if (!this.cliHasFocus) {
            this.menuButtons[this.currentFocusIndex].classList.add('gamepad-focused');
            this.updateFocusOutline(this.menuButtons[this.currentFocusIndex]);
        } else {
            this.hideFocusOutline();
        }
    }

    updateFocusOutline(element) {
        if (!element || !this.focusOutline) return;

        const rect = element.getBoundingClientRect();
        const padding = 10;

        this.focusOutline.style.left = `${rect.left - padding}px`;
        this.focusOutline.style.top = `${rect.top - padding}px`;
        this.focusOutline.style.width = `${rect.width + padding * 2}px`;
        this.focusOutline.style.height = `${rect.height + padding * 2}px`;
        this.focusOutline.classList.add('visible');
    }

    hideFocusOutline() {
        if (this.focusOutline) {
            this.focusOutline.classList.remove('visible');
        }
    }

    startInputCooldown() {
        this.inputCooldown = true;
        setTimeout(() => {
            this.inputCooldown = false;
        }, this.cooldownDuration);
    }

    startAutoRepeat(action) {
        this.stopAutoRepeat();

        this.autoRepeatAction = action;

        action();

        this.autoRepeatTimer = setTimeout(() => {
            this.autoRepeatTimer = setInterval(() => {
                if (this.autoRepeatAction) {
                    this.autoRepeatAction();
                }
            }, this.autoRepeatInterval);
        }, this.autoRepeatInitialDelay);
    }

    stopAutoRepeat() {
        if (this.autoRepeatTimer) {
            clearTimeout(this.autoRepeatTimer);
            clearInterval(this.autoRepeatTimer);
            this.autoRepeatTimer = null;
        }
        this.autoRepeatAction = null;
    }

    activateFocusedButton() {
        if (this.menuButtons.length === 0) return;

        const focusedButton = this.menuButtons[this.currentFocusIndex];
        if (focusedButton) {
            const rect = focusedButton.getBoundingClientRect();
            const x = rect.left + rect.width / 2;
            const y = rect.top + rect.height / 2;

            const mouseDownEvent = new MouseEvent('mousedown', {
                bubbles: true,
                cancelable: true,
                view: window,
                button: 0,
                clientX: x,
                clientY: y
            });
            focusedButton.dispatchEvent(mouseDownEvent);

            setTimeout(() => {
                const mouseUpEvent = new MouseEvent('mouseup', {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                    button: 0,
                    clientX: x,
                    clientY: y
                });
                window.dispatchEvent(mouseUpEvent);

                setTimeout(() => {
                    this.checkForListItems();
                }, 100);
            }, 50);
        }
    }

    checkForListItems() {
        const listContainer = document.getElementById('cors_results');
        if (!listContainer) return;

        const items = Array.from(listContainer.querySelectorAll('.corsrow'));

        if (items.length > 0) {
            this.listItems = items;
            this.currentListIndex = 0;
            this.listHasFocus = true;

            if (this.menuButtons.length > 0) {
                this.menuButtons[this.currentFocusIndex].classList.remove('gamepad-focused');
            }

            this.updateListFocus();
        }
    }

    updateListFocus() {
        if (!this.listHasFocus || this.listItems.length === 0) return;

        this.listItems.forEach(item => {
            const span = item.querySelector('span');
            if (span) {
                span.classList.remove('highlight');
            }
        });

        if (this.currentListIndex >= 0 && this.currentListIndex < this.listItems.length) {
            const currentItem = this.listItems[this.currentListIndex];
            const span = currentItem.querySelector('span');
            if (span) {
                span.classList.add('highlight');

                const container = document.getElementById('cors_results');
                const needsScroll = container && !this.isElementInViewport(currentItem, container);

                if (needsScroll) {
                    currentItem.scrollIntoView({ behavior: 'auto', block: 'start' });
                    requestAnimationFrame(() => {
                        this.updateFocusOutline(span);
                    });
                } else {
                    this.updateFocusOutline(span);
                }
            }

            if (this.cli) {
                this.cli.selected_command?.selection_changed(currentItem);
            }
        }
    }

    isElementInViewport(element, container) {
        const elementRect = element.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        return (
            elementRect.top >= containerRect.top &&
            elementRect.bottom <= containerRect.bottom
        );
    }

    navigateList(delta) {
        if (!this.listHasFocus || this.listItems.length === 0) return;

        this.currentListIndex += delta;

        if (this.currentListIndex < 0) {
            this.currentListIndex = this.listItems.length - 1;
        } else if (this.currentListIndex >= this.listItems.length) {
            this.currentListIndex = 0;
        }

        this.updateListFocus();
    }

    activateListItem() {
        if (!this.listHasFocus || this.listItems.length === 0) return;
        if (this.currentListIndex < 0 || this.currentListIndex >= this.listItems.length) return;

        this.stopAutoRepeat();

        const selectedItem = this.listItems[this.currentListIndex];
        if (selectedItem) {
            const clickEvent = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window
            });
            selectedItem.dispatchEvent(clickEvent);

            setTimeout(() => {
                const listContainer = document.getElementById('cors_results');
                const items = listContainer ? listContainer.querySelectorAll('.corsrow') : [];

                if (items.length === 0) {
                    this.clearListFocus();
                    this.updateFocus();
                }
            }, 100);
        }
    }

    simulateEscKey() {
        const keyDownEvent = new KeyboardEvent('keydown', {
            key: 'Escape',
            code: 'Escape',
            keyCode: 27,
            which: 27,
            bubbles: true,
            cancelable: true
        });
        document.dispatchEvent(keyDownEvent);

        setTimeout(() => {
            const keyUpEvent = new KeyboardEvent('keyup', {
                key: 'Escape',
                code: 'Escape',
                keyCode: 27,
                which: 27,
                bubbles: true,
                cancelable: true
            });
            document.dispatchEvent(keyUpEvent);
        }, 50);
    }

    clearMenuFocus() {
        this.menuButtons.forEach(btn => btn.classList.remove('gamepad-focused'));
        this.currentFocusIndex = 0;
        this.cliHasFocus = false;
        this.keyboardHasFocus = false;
        this.listHasFocus = false;
        this.removeCliFocus();

        const allKeys = document.querySelectorAll('.key');
        allKeys.forEach(key => key.classList.remove('keyboard-gamepad-focused'));

        this.clearListFocus();

        this.stopAutoRepeat();

        this.hideFocusOutline();
    }

    restoreFocusToButton(buttonId) {
        const buttonIndex = this.menuButtons.findIndex(btn => btn && btn.id === buttonId);
        if (buttonIndex >= 0) {
            this.currentFocusIndex = buttonIndex;
            this.cliHasFocus = false;
            this.keyboardHasFocus = false;
            this.listHasFocus = false;
            this.updateFocus();
        }
    }

    clearListFocus() {
        if (this.listItems.length > 0) {
            this.listItems.forEach(item => {
                const span = item.querySelector('span');
                if (span) {
                    span.classList.remove('highlight');
                }
            });
        }
        this.listItems = [];
        this.currentListIndex = -1;
        this.listHasFocus = false;

        this.stopAutoRepeat();
    }

    getGamepads() {
        return Array.from(this.gamepads.values());
    }

    getGamepad(index) {
        return this.gamepads.get(index);
    }

    hasGamepad() {
        return this.gamepads.size > 0;
    }

    setGuiNavigationEnabled(enabled) {
        this.guiNavigationEnabled = enabled;

        if (!enabled) {
            this.clearMenuFocus();
            this.hideFocusOutline();
        }
    }

    initBrowserNavigation(flicking, buttonIds, backHandler, dropdown = null, overlay = null, onFirstGamepadUse = null) {
        this.browserActive = true;
        this.browserFlicking = flicking;
        this.browserBackHandler = backHandler;
        this.browserTopBarFocus = false;
        this.browserDropdown = dropdown;
        // Platform-selection overlay (skin mode) - { show, isOpen, navigate, select, hide }.
        this.browserOverlay = overlay;
        // Callback on first pad use (enabling the skin - e.g. Collection autostart).
        this.browserOnFirstGamepadUse = onFirstGamepadUse;
        // Default A label on the panel (Collection Browser: 'Load'). Save Browser
        // overrides to 'Select'/'Load' per view via setBrowserPanelAction.
        this.browserPanelActionLabel = 'Load';

        this.browserButtons = buttonIds.map(id => document.getElementById(id)).filter(btn => btn !== null);
        this.browserCurrentButtonIndex = 0;

        this.browserGamepadUsed = false;
        this.lastBrowserTopBarFocus = false;

        // Legend bar (pad control panel) only when a pad is actually connected.
        if (this.hasGamepad()) {
            this.updateBrowserLegend();
            this.showLegendBar();
        }

        this.browserFlickingChangeHandler = () => {
            if (!this.browserTopBarFocus && this.browserGamepadUsed && this.browserFlicking.currentPanel) {
                this.updateBrowserPanelFocus();
            }
        };

        if (this.browserFlicking) {
            this.browserFlicking.on('changed', this.browserFlickingChangeHandler);
        }
    }

    /**
     * A action label on the cover panel (depends on the browser view):
     * game list -> 'Select' (enter the game's saves), game saves -> 'Load'.
     */
    setBrowserPanelAction(label) {
        this.browserPanelActionLabel = label || 'Load';
        if (this.browserActive && !this.browserTopBarFocus) {
            this.updateBrowserLegend();
        }
    }

    updateBrowserLegend() {
        // Legend depends on focus context (cover panel vs bar/filter).
        // In skin mode: X = switch between the carousel and platform selection.
        const skin = document.body.classList.contains('gamepad-browser-skin');
        // browserPanelActionLabel is 'Select'/'Load' -> translate via legend.* (fallback: Load).
        const panelLabel = this.browserPanelActionLabel === 'Select' ? t('legend.select') : t('legend.load');
        if (this.browserTopBarFocus) {
            this.showLegendActions([
                { glyph: 'A', label: t('legend.select') },
                { glyph: 'B', label: t('legend.back') },
                { glyph: 'X', label: t('legend.covers') }
            ]);
        } else {
            this.showLegendActions([
                { glyph: 'A', label: panelLabel },
                { glyph: 'B', label: t('legend.back') },
                { glyph: 'X', label: skin ? t('menu.platform') : t('legend.menu') }
            ]);
        }
    }

    clearBrowserNavigation() {
        if (this.browserFlicking && this.browserFlickingChangeHandler) {
            this.browserFlicking.off('changed', this.browserFlickingChangeHandler);
        }

        this.browserActive = false;
        this.browserTopBarFocus = false;
        this.browserButtons = [];
        this.browserCurrentButtonIndex = 0;
        this.browserFlicking = null;
        this.browserBackHandler = null;
        this.browserOverlay = null;
        this.browserOnFirstGamepadUse = null;
        this.browserFlickingChangeHandler = null;
        this.browserDropdown = null;

        document.querySelectorAll('.browser-button-focused').forEach(btn => {
            btn.classList.remove('browser-button-focused');
        });

        document.body.classList.remove('gamepad-browser-active');

        document.querySelectorAll('.flicking-panel').forEach(panel => {
            panel.classList.remove('active');
        });

        this.hideFocusOutline();

        // Closing the browser -> hide the legend bar. If we return to the shell,
        // #enterGamepadMenu shows it again; in the CLI it should be hidden (doesn't cover the UI).
        this.hideLegendBar();
    }

    handleBrowserNavigation(gamepad) {
        if (!this.browserActive || !gamepad) return;

        if (!this.browserGamepadUsed) {
            const anyButtonPressed = gamepad.buttons.some(button => button && button.pressed);
            const anyAxisMoved = gamepad.axes.some(axis => Math.abs(axis) > this.axisDeadzone);

            if (anyButtonPressed || anyAxisMoved) {
                this.browserGamepadUsed = true;
                document.body.classList.add('gamepad-browser-active');

                // Is the first use a DIRECTION (D-pad / left stick)? Directions are harmless
                // (carousel navigation) - they may act immediately. ACTION buttons (A/B/X/Y...)
                // on first use only "wake" the skin and are SWALLOWED, so an action
                // (e.g. loading a save) doesn't fire by accident (see browserOnFirstGamepadUse).
                const dirPressed =
                    gamepad.buttons[12]?.pressed || gamepad.buttons[13]?.pressed ||
                    gamepad.buttons[14]?.pressed || gamepad.buttons[15]?.pressed || anyAxisMoved;

                const wokeSkin = !!this.browserOnFirstGamepadUse;
                // First pad use in the browser - allow enabling the skin (e.g. Collection autostart).
                this.browserOnFirstGamepadUse?.();

                if (!this.browserTopBarFocus) {
                    this.updateBrowserPanelFocus();
                }

                // If the skin just turned on and the first use is an ACTION button (not a
                // direction) -> SWALLOW the press: store states as "pressed" and return,
                // so the action doesn't fire this cycle. The user releases and presses again.
                if (wokeSkin && !dirPressed) {
                    this.lastAButtonState = gamepad.buttons[0]?.pressed || false;
                    this.lastBButtonState = gamepad.buttons[1]?.pressed || false;
                    this.lastXButtonState = gamepad.buttons[2]?.pressed || false;
                    this.lastYButtonState = gamepad.buttons[3]?.pressed || false;
                    return;
                }
            }
        }

        // Platform-selection overlay (skin mode) - when open, it takes over all control.
        if (this.browserOverlay && this.browserOverlay.isOpen()) {
            this.#pollBrowserOverlay(gamepad);
            this.lastXButtonState = gamepad.buttons[2]?.pressed || false;
            this.lastAButtonState = gamepad.buttons[0]?.pressed || false;
            this.lastBButtonState = gamepad.buttons[1]?.pressed || false;
            this.lastDpadState.up = gamepad.buttons[12]?.pressed || false;
            this.lastDpadState.down = gamepad.buttons[13]?.pressed || false;
            return;
        }

        const xButton = gamepad.buttons[2] && gamepad.buttons[2].pressed;

        if (xButton && !this.lastXButtonState) {
            // Skin mode: X opens the overlay ONLY if the overlay wants it (Save Browser:
            // platform filter). Collection Browser: A opens the overlay (xOpens=false).
            if (this.browserOverlay && this.browserOverlay.xOpens) {
                this.browserOverlay.show();
            } else if (!this.browserOverlay) {
                // Classic behavior: toggle focus carousel <-> topbar.
                this.browserTopBarFocus = !this.browserTopBarFocus;
                if (this.browserTopBarFocus) {
                    this.updateBrowserButtonFocus();
                    document.querySelectorAll('.flicking-panel').forEach(panel => {
                        panel.classList.remove('active');
                    });
                } else {
                    this.browserButtons.forEach(btn => btn.classList.remove('browser-button-focused'));
                    this.updateBrowserPanelFocus();
                    if (this.browserFlicking && this.browserFlicking.currentPanel) {
                        this.browserFlicking.currentPanel.element.classList.add('active');
                    }
                }
            }

            this.startInputCooldown();
        }

        this.lastXButtonState = xButton;

        const aButton = gamepad.buttons[0] && gamepad.buttons[0].pressed;

        if (aButton && !this.lastAButtonState) {
            if (this.browserTopBarFocus) {
                const button = this.browserButtons[this.browserCurrentButtonIndex];
                if (this.browserDropdown && button && button.id === 'platformDropdownContainer') {
                    if (this.browserDropdown.isDropdownOpen()) {
                        this.browserDropdown.gamepadSelect();
                    } else {
                        this.browserDropdown.gamepadOpen();
                    }
                } else {
                    this.activateBrowserButton();
                }
            } else {
                const enterEvent = new KeyboardEvent('keydown', {
                    key: 'Enter',
                    code: 'Enter',
                    keyCode: 13,
                    which: 13,
                    bubbles: true,
                    cancelable: true
                });
                document.dispatchEvent(enterEvent);
            }
            this.startInputCooldown();
        }

        const bButton = gamepad.buttons[1] && gamepad.buttons[1].pressed;

        if (bButton && !this.lastBButtonState) {
            if (this.browserTopBarFocus && this.browserDropdown) {
                const button = this.browserButtons[this.browserCurrentButtonIndex];
                if (button && button.id === 'platformDropdownContainer' && this.browserDropdown.isDropdownOpen()) {
                    this.browserDropdown.gamepadClose();
                    this.startInputCooldown();
                    this.lastBButtonState = bButton;
                    return;
                }
            }

            if (this.browserBackHandler) {
                this.browserBackHandler();
                setTimeout(() => {
                    if (this.browserTopBarFocus) {
                        document.querySelectorAll('.flicking-panel').forEach(panel => {
                            panel.classList.remove('active');
                        });
                    }
                }, 100);
            }
            this.startInputCooldown();
        }

        this.lastAButtonState = aButton;
        this.lastBButtonState = bButton;

        if (this.inputCooldown) {
            return;
        }

        const dpadUp = gamepad.buttons[12] && gamepad.buttons[12].pressed;
        const dpadDown = gamepad.buttons[13] && gamepad.buttons[13].pressed;
        const dpadLeft = gamepad.buttons[14] && gamepad.buttons[14].pressed;
        const dpadRight = gamepad.buttons[15] && gamepad.buttons[15].pressed;

        const axisX = gamepad.axes[0] || 0;
        const axisY = gamepad.axes[1] || 0;

        // Grid mode (Collection grid): up/down move whole rows, not topbar focus. Left/right fall
        // through to the carousel branch below (prev()/next() == focusPrev/focusNext on the grid).
        const isGrid = this.browserFlicking && this.browserFlicking.isGrid;
        if (isGrid) {
            if (dpadUp && !this.lastDpadState.up) {
                this.startAutoRepeat(() => this.browserFlicking.verticalNav(-1));
            } else if (dpadDown && !this.lastDpadState.down) {
                this.startAutoRepeat(() => this.browserFlicking.verticalNav(1));
            } else if (!dpadUp && this.lastDpadState.up) {
                this.stopAutoRepeat();
            } else if (!dpadDown && this.lastDpadState.down) {
                this.stopAutoRepeat();
            } else if (axisY < -this.axisDeadzone && this.lastAxisYValue >= -this.axisDeadzone) {
                this.startAutoRepeat(() => this.browserFlicking.verticalNav(-1));
            } else if (axisY > this.axisDeadzone && this.lastAxisYValue <= this.axisDeadzone) {
                this.startAutoRepeat(() => this.browserFlicking.verticalNav(1));
            } else if (Math.abs(axisY) <= this.axisDeadzone && Math.abs(this.lastAxisYValue) > this.axisDeadzone) {
                this.stopAutoRepeat();
            }
        } else if (dpadUp && !this.lastDpadState.up) {
            if (!this.browserTopBarFocus) {
                this.browserTopBarFocus = true;
                this.updateBrowserButtonFocus();
                document.querySelectorAll('.flicking-panel').forEach(panel => {
                    panel.classList.remove('active');
                });
                this.startInputCooldown();
            }
        } else if (dpadDown && !this.lastDpadState.down) {
            if (this.browserTopBarFocus) {
                this.browserTopBarFocus = false;
                this.browserButtons.forEach(btn => btn.classList.remove('browser-button-focused'));
                this.updateBrowserPanelFocus();
                if (this.browserFlicking && this.browserFlicking.currentPanel) {
                    this.browserFlicking.currentPanel.element.classList.add('active');
                }
                this.startInputCooldown();
            }
        }
        else if (Math.abs(axisY) > this.axisDeadzone) {
            if (axisY < -this.axisDeadzone && this.lastAxisYValue >= -this.axisDeadzone) {
                if (!this.browserTopBarFocus) {
                    this.browserTopBarFocus = true;
                    this.updateBrowserButtonFocus();
                    document.querySelectorAll('.flicking-panel').forEach(panel => {
                        panel.classList.remove('active');
                    });
                    this.startInputCooldown();
                }
            } else if (axisY > this.axisDeadzone && this.lastAxisYValue <= this.axisDeadzone) {
                if (this.browserTopBarFocus) {
                    this.browserTopBarFocus = false;
                    this.browserButtons.forEach(btn => btn.classList.remove('browser-button-focused'));
                    this.updateBrowserPanelFocus();
                    if (this.browserFlicking && this.browserFlicking.currentPanel) {
                        this.browserFlicking.currentPanel.element.classList.add('active');
                    }
                    this.startInputCooldown();
                }
            }
        }

        if (this.browserTopBarFocus) {
            const button = this.browserButtons[this.browserCurrentButtonIndex];
            const isDropdownFocused = this.browserDropdown && button && button.id === 'platformDropdownContainer';
            const isDropdownOpen = isDropdownFocused && this.browserDropdown.isDropdownOpen();

            if (isDropdownOpen) {
                if (dpadUp && !this.lastDpadState.up) {
                    this.startAutoRepeat(() => this.browserDropdown.gamepadNavigate('up'));
                } else if (dpadDown && !this.lastDpadState.down) {
                    this.startAutoRepeat(() => this.browserDropdown.gamepadNavigate('down'));
                }
                else if (!dpadUp && this.lastDpadState.up) {
                    this.stopAutoRepeat();
                } else if (!dpadDown && this.lastDpadState.down) {
                    this.stopAutoRepeat();
                }
                else if (Math.abs(axisY) > this.axisDeadzone) {
                    if (axisY < -this.axisDeadzone && this.lastAxisYValue >= -this.axisDeadzone) {
                        this.startAutoRepeat(() => this.browserDropdown.gamepadNavigate('up'));
                    } else if (axisY > this.axisDeadzone && this.lastAxisYValue <= this.axisDeadzone) {
                        this.startAutoRepeat(() => this.browserDropdown.gamepadNavigate('down'));
                    }
                }
                else if (Math.abs(axisY) <= this.axisDeadzone && Math.abs(this.lastAxisYValue) > this.axisDeadzone) {
                    this.stopAutoRepeat();
                }
            } else {
                if (dpadLeft && !this.lastDpadState.left) {
                    this.startAutoRepeat(() => this.navigateBrowserButtons(-1));
                } else if (dpadRight && !this.lastDpadState.right) {
                    this.startAutoRepeat(() => this.navigateBrowserButtons(1));
                }
                else if (!dpadLeft && this.lastDpadState.left) {
                    this.stopAutoRepeat();
                } else if (!dpadRight && this.lastDpadState.right) {
                    this.stopAutoRepeat();
                }
                else if (Math.abs(axisX) > this.axisDeadzone) {
                    if (axisX < -this.axisDeadzone && this.lastAxisValue >= -this.axisDeadzone) {
                        this.startAutoRepeat(() => this.navigateBrowserButtons(-1));
                    } else if (axisX > this.axisDeadzone && this.lastAxisValue <= this.axisDeadzone) {
                        this.startAutoRepeat(() => this.navigateBrowserButtons(1));
                    }
                }
                else if (Math.abs(axisX) <= this.axisDeadzone && Math.abs(this.lastAxisValue) > this.axisDeadzone) {
                    this.stopAutoRepeat();
                }
            }
        } else {
            if (this.browserFlicking && !this.browserFlicking.animating) {
                if (dpadLeft && !this.lastDpadState.left) {
                    this.startAutoRepeat(() => {
                        if (this.browserFlicking && !this.browserFlicking.animating) {
                            this.browserFlicking.prev().catch(() => {});
                        }
                    });
                } else if (dpadRight && !this.lastDpadState.right) {
                    this.startAutoRepeat(() => {
                        if (this.browserFlicking && !this.browserFlicking.animating) {
                            this.browserFlicking.next().catch(() => {});
                        }
                    });
                }
                else if (Math.abs(axisX) > this.axisDeadzone) {
                    if (axisX < -this.axisDeadzone && this.lastAxisValue >= -this.axisDeadzone) {
                        this.startAutoRepeat(() => {
                            if (this.browserFlicking && !this.browserFlicking.animating) {
                                this.browserFlicking.prev().catch(() => {});
                            }
                        });
                    } else if (axisX > this.axisDeadzone && this.lastAxisValue <= this.axisDeadzone) {
                        this.startAutoRepeat(() => {
                            if (this.browserFlicking && !this.browserFlicking.animating) {
                                this.browserFlicking.next().catch(() => {});
                            }
                        });
                    }
                }
            }

            if (!dpadLeft && this.lastDpadState.left) {
                this.stopAutoRepeat();
            } else if (!dpadRight && this.lastDpadState.right) {
                this.stopAutoRepeat();
            } else if (Math.abs(axisX) <= this.axisDeadzone && Math.abs(this.lastAxisValue) > this.axisDeadzone) {
                this.stopAutoRepeat();
            }
        }

        this.lastDpadState.up = dpadUp;
        this.lastDpadState.down = dpadDown;
        this.lastDpadState.left = dpadLeft;
        this.lastDpadState.right = dpadRight;
        this.lastAxisValue = axisX;
        this.lastAxisYValue = axisY;

        // Refresh the legend only when the focus context changed (panel <-> topbar).
        if (this.browserTopBarFocus !== this.lastBrowserTopBarFocus) {
            this.updateBrowserLegend();
            this.lastBrowserTopBarFocus = this.browserTopBarFocus;
        }
    }

    navigateBrowserButtons(delta) {
        if (this.browserButtons.length === 0) return;

        this.browserCurrentButtonIndex += delta;

        if (this.browserCurrentButtonIndex < 0) {
            this.browserCurrentButtonIndex = this.browserButtons.length - 1;
        } else if (this.browserCurrentButtonIndex >= this.browserButtons.length) {
            this.browserCurrentButtonIndex = 0;
        }

        this.updateBrowserButtonFocus();
    }

    updateBrowserButtonFocus() {
        this.browserButtons.forEach(btn => btn.classList.remove('browser-button-focused'));

        if (this.browserButtons[this.browserCurrentButtonIndex]) {
            this.browserButtons[this.browserCurrentButtonIndex].classList.add('browser-button-focused');
            this.updateFocusOutline(this.browserButtons[this.browserCurrentButtonIndex]);
        }
    }

    updateBrowserPanelFocus() {
        this.hideFocusOutline();
    }

    /** Drive the platform-selection overlay (skin mode): D-pad up/down, A=select, B/X=close. */
    #pollBrowserOverlay(gamepad) {
        const o = this.browserOverlay;
        const a = gamepad.buttons[0]?.pressed || false;
        const b = gamepad.buttons[1]?.pressed || false;
        const x = gamepad.buttons[2]?.pressed || false;
        const up = gamepad.buttons[12]?.pressed || (gamepad.axes[1] || 0) < -this.axisDeadzone;
        const down = gamepad.buttons[13]?.pressed || (gamepad.axes[1] || 0) > this.axisDeadzone;
        const wasUp = this.lastDpadState.up || (this.lastAxisYValue < -this.axisDeadzone);
        const wasDown = this.lastDpadState.down || (this.lastAxisYValue > this.axisDeadzone);

        if (a && !this.lastAButtonState) o.select();
        else if ((b && !this.lastBButtonState) || (x && !this.lastXButtonState)) o.hide();
        else if (up && !wasUp) o.navigate(-1);
        else if (down && !wasDown) o.navigate(1);

        this.lastAxisYValue = gamepad.axes[1] || 0;
    }

    activateBrowserButton() {
        const button = this.browserButtons[this.browserCurrentButtonIndex];
        if (!button || button.classList.contains('disabled')) return;

        const clickEvent = new MouseEvent('mousedown', {
            bubbles: true,
            cancelable: true,
            view: window,
            button: 0
        });
        button.dispatchEvent(clickEvent);

        setTimeout(() => {
            const mouseUpEvent = new MouseEvent('mouseup', {
                bubbles: true,
                cancelable: true,
                view: window,
                button: 0
            });
            window.dispatchEvent(mouseUpEvent);
        }, 50);
    }

    destroy() {
        window.removeEventListener('gamepadconnected', this.handleGamepadConnected);
        window.removeEventListener('gamepaddisconnected', this.handleGamepadDisconnected);

        if (this.animationContainer && this.animationContainer.parentNode) {
            this.animationContainer.parentNode.removeChild(this.animationContainer);
        }

        if (this.legendBar && this.legendBar.parentNode) {
            this.legendBar.parentNode.removeChild(this.legendBar);
        }

        if (this.animationFrameId) {
            clearTimeout(this.animationFrameId);
        }

        this.stopAutoRepeat();

        this.gamepads.clear();
    }
}
