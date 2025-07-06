export class KeyMaps {
    static ZX_CURSOR = {
        up: { key: '7', code: 'Digit7', keyCode: 55 },
        down: { key: '6', code: 'Digit6', keyCode: 54 },
        left: { key: '5', code: 'Digit5', keyCode: 53 },
        right: { key: '8', code: 'Digit8', keyCode: 56 },
        a: { key: '0', code: 'Digit0', keyCode: 48 }
    }

    static ZX_INTERFACE_2_LEFT = {
        up: { key: '9', code: 'Digit9', keyCode: 57 },
        down: { key: '8', code: 'Digit8', keyCode: 56 },
        left: { key: '6', code: 'Digit6', keyCode: 54 },
        right: { key: '7', code: 'Digit7', keyCode: 55 },
        a: { key: '0', code: 'Digit0', keyCode: 48 }
    }

    static ZX_INTERFACE_2_RIGHT = {
        up: { key: '4', code: 'Digit4', keyCode: 52 },
        down: { key: '3', code: 'Digit3', keyCode: 51 },
        left: { key: '1', code: 'Digit1', keyCode: 49 },
        right: { key: '2', code: 'Digit2', keyCode: 50 },
        a: { key: '5', code: 'Digit5', keyCode: 53 }
    }

    static ZX_QOAP = {
        up: { key: 'q', code: 'KeyQ', keyCode: 81 },
        down: { key: 'a', code: 'KeyA', keyCode: 65 },
        left: { key: 'o', code: 'KeyO', keyCode: 79 },
        right: { key: 'p', code: 'KeyP', keyCode: 80 },
        a: { key: ' ', code: 'Space', keyCode: 32 }
    }

    static ZX_ULTIMATE = {
        up: { key: 'r', code: 'KeyR', keyCode: 84 },
        down: { key: 'e', code: 'KeyE', keyCode: 83 },
        left: { key: 'q', code: 'KeyQ', keyCode: 81 },
        right: { key: 'w', code: 'KeyW', keyCode: 82 },
        a: { key: 't', code: 'Space', keyCode: 84 }
    }

    static ZX_DEATHCHASE = {
        up: { key: '9', code: 'Digit9', keyCode: 57 },
        down: { key: '8', code: 'Digit8', keyCode: 56 },
        left: { key: '1', code: 'Digit1', keyCode: 49 },
        right: { key: '0', code: 'Digit0', keyCode: 48 },
        a: { key: 'B', code: 'KeyB', keyCode: 66 }
    }

    // XT

    static XT_ARROWS_SPACE_RETURN = {
        up: { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
        down: { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
        left: { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 },
        right: { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 },
        a: { key: 'Enter', code: 'Enter', keyCode: 13, label: 'RETURN' },
        b: { key: 'x', code: 'KeyX', keyCode: 88, label: 'X' }
    }

    static XT_ARROWS_SPACE_X = {
        up: { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
        down: { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
        left: { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 },
        right: { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 },
        a: { key: ' ', code: 'Space', keyCode: 32, label: 'SPACE' },
        b: { key: 'x', code: 'KeyX', keyCode: 88, label: 'X' }
    }

    static XT_ARROWS_SPACE_CTRL = {
        up: { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
        down: { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
        left: { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 },
        right: { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 },
        a: { key: ' ', code: 'Space', keyCode: 32, label: 'SPACE' },
        b: { key: 'Control', code: 'ControlLeft', keyCode: 17, label: 'CTRL' }
    }

    static XT_ARROWS_Z_X = {
        up: { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
        down: { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
        left: { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 },
        right: { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 },
        a: { key: 'z', code: 'KeyZ', keyCode: 90, label: 'Z' },
        b: { key: 'x', code: 'KeyX', keyCode: 88, label: 'X' }
    }

    static XT_ARROWS_SPACE_A = {
        up: { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
        down: { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
        left: { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 },
        right: { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 },
        a: { key: ' ', code: 'Space', keyCode: 32, label: 'SPACE' },
        b: { key: 'a', code: 'KeyA', keyCode: 65, label: 'A' }
    }

    static XT_ARROWS_SPACE_SHIFT = {
        up: { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
        down: { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
        left: { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 },
        right: { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 },
        a: { key: ' ', code: 'Space', keyCode: 32, label: 'SPACE' },
        b: { key: 'Shift', code: 'ShiftLeft', keyCode: 16, label: 'SHIFT' }
    }
}