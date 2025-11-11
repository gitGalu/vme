import { EnvironmentManager } from '../EnvironmentManager.js';

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

        this.init();
    }

    init() {
        this.createAnimationContainer();

        this.createFocusOutline();

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

        this.showAnimation('connect');
    }

    handleGamepadDisconnected(event) {
        const gamepad = event.gamepad;
        console.log(`Gamepad disconnected: ${gamepad.id} (index: ${gamepad.index})`);

        this.gamepads.delete(gamepad.index);

        this.showAnimation('disconnect');
    }

    showAnimation(type) {
        if (this.animationFrameId) {
            clearTimeout(this.animationFrameId);
            this.animationFrameId = null;
        }

        const message = type === 'connect' ? 'Gamepad connected' : 'Gamepad disconnected';
        this.animationContainer.textContent = message;

        this.animationContainer.classList.remove('show', 'hide');

        void this.animationContainer.offsetWidth;

        this.animationContainer.classList.add('show');

        this.animationFrameId = setTimeout(() => {
            this.hideAnimation();
        }, 2000);
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

                    this.pollMenuNavigation(gamepad);
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

    initBrowserNavigation(flicking, buttonIds, backHandler, dropdown = null) {
        this.browserActive = true;
        this.browserFlicking = flicking;
        this.browserBackHandler = backHandler;
        this.browserTopBarFocus = false;
        this.browserDropdown = dropdown;

        this.browserButtons = buttonIds.map(id => document.getElementById(id)).filter(btn => btn !== null);
        this.browserCurrentButtonIndex = 0;

        this.browserGamepadUsed = false;

        this.browserFlickingChangeHandler = () => {
            if (!this.browserTopBarFocus && this.browserGamepadUsed && this.browserFlicking.currentPanel) {
                this.updateBrowserPanelFocus();
            }
        };

        if (this.browserFlicking) {
            this.browserFlicking.on('changed', this.browserFlickingChangeHandler);
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
    }

    handleBrowserNavigation(gamepad) {
        if (!this.browserActive || !gamepad) return;

        if (!this.browserGamepadUsed) {
            const anyButtonPressed = gamepad.buttons.some(button => button && button.pressed);
            const anyAxisMoved = gamepad.axes.some(axis => Math.abs(axis) > this.axisDeadzone);

            if (anyButtonPressed || anyAxisMoved) {
                this.browserGamepadUsed = true;
                document.body.classList.add('gamepad-browser-active');

                if (!this.browserTopBarFocus) {
                    this.updateBrowserPanelFocus();
                }
            }
        }

        const xButton = gamepad.buttons[2] && gamepad.buttons[2].pressed;

        if (xButton && !this.lastXButtonState) {
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

        if (dpadUp && !this.lastDpadState.up) {
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

        if (this.animationFrameId) {
            clearTimeout(this.animationFrameId);
        }

        this.stopAutoRepeat();

        this.gamepads.clear();
    }
}
