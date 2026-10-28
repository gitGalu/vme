export const QJ_IDLE_COLOR = '#88888844';
export const QJ_ACTIVE_COLOR = '#88888866';
export const QJ_LABEL_COLOR = '#88888888';

export const BOOT_TO = 'BOOT_TO';
export const COLLECTION_BROWSER_COLLECTION_INDEX = 'COLLECTION_BROWSER_COLLECTION_INDEX';
export const COLLECTION_BROWSER_ITEM_INDEX = 'COLLECTION_BROWSER_ITEM_INDEX';
export const BOOT_TO_COLLECTION_BROWSER = 'COMPILATIONS';

export const FAST_BTN_RADIUS = '6px';

export const TOUCH_INPUT = {
    JOYSTICK: 100,
    MOUSE: 300,
    KEYBOARD: 500,
    CURSORS: 600,
    CUSTOM: 700,
    SPECIAL: 700
}

export const JOYSTICK_TOUCH_MODE = {
    QUICKJOY_PRIMARY: 100,
    QUICKSHOT_DYNAMIC: 200,
    QUICKSHOT_STATIC: 210,
    QUICKSHOT_KEYBOARD: 300,
    QUICKSHOT_KEYBOARD_STATIC: 310,
    HIDEAWAY: 1000,
};

// True when every touch joystick mode of a platform emits keyboard events (no retropad stick).
export function isKeyboardOnlyTouchControllers(touchControllers) {
    return Array.isArray(touchControllers) && touchControllers.length > 0 &&
        touchControllers.every((mode) =>
            mode === JOYSTICK_TOUCH_MODE.QUICKSHOT_KEYBOARD ||
            mode === JOYSTICK_TOUCH_MODE.QUICKSHOT_KEYBOARD_STATIC);
}

export const MOUSE_TOUCH_MODE = {
    TRACKPAD_BUTTONS: 100
};
