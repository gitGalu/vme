const KEY_CODE_BY_CODE = {
    Backspace: 8,
    Tab: 9,
    Enter: 13,
    ShiftLeft: 16,
    ShiftRight: 16,
    ControlLeft: 17,
    ControlRight: 17,
    AltLeft: 18,
    AltRight: 18,
    Pause: 19,
    CapsLock: 20,
    Escape: 27,
    Space: 32,
    PageUp: 33,
    PageDown: 34,
    End: 35,
    Home: 36,
    ArrowLeft: 37,
    ArrowUp: 38,
    ArrowRight: 39,
    ArrowDown: 40,
    Insert: 45,
    Delete: 46,
    MetaLeft: 91,
    MetaRight: 92,
    ContextMenu: 93,
    NumpadMultiply: 106,
    NumpadAdd: 107,
    NumpadSubtract: 109,
    NumpadDecimal: 110,
    NumpadDivide: 111,
    Semicolon: 186,
    Equal: 187,
    Comma: 188,
    Minus: 189,
    Period: 190,
    Slash: 191,
    Backquote: 192,
    BracketLeft: 219,
    Backslash: 220,
    BracketRight: 221,
    Quote: 222
};

const SPECIAL_KEY_BY_NAME = {
    alt: 'Alt',
    backspace: 'Backspace',
    ctrl: 'Control',
    control: 'Control',
    del: 'Delete',
    delete: 'Delete',
    down: 'ArrowDown',
    enter: 'Enter',
    esc: 'Escape',
    escape: 'Escape',
    home: 'Home',
    ins: 'Insert',
    insert: 'Insert',
    left: 'ArrowLeft',
    meta: 'Meta',
    pagedown: 'PageDown',
    pageup: 'PageUp',
    right: 'ArrowRight',
    shift: 'Shift',
    space: ' ',
    tab: 'Tab',
    up: 'ArrowUp'
};

function normalizeModifierKey(code) {
    if (typeof code !== 'string') {
        return null;
    }
    if (code.startsWith('Shift')) {
        return 'Shift';
    }
    if (code.startsWith('Control')) {
        return 'Control';
    }
    if (code.startsWith('Alt')) {
        return 'Alt';
    }
    if (code.startsWith('Meta')) {
        return 'Meta';
    }
    return null;
}

export function getSyntheticKeyboardTarget(fallback = document) {
    return document.querySelector('#emuscreen canvas, canvas') || fallback;
}

export function normalizeKeyboardKey(key, code) {
    if (typeof code === 'string' && code === 'Space') {
        return ' ';
    }

    const modifierKey = normalizeModifierKey(code);
    if (modifierKey) {
        return modifierKey;
    }

    if (typeof code === 'string' && code.startsWith('Arrow')) {
        return code;
    }

    if (typeof code === 'string' && /^F\d{1,2}$/.test(code)) {
        return code;
    }

    if (typeof key !== 'string') {
        return key;
    }

    const normalized = SPECIAL_KEY_BY_NAME[key.toLowerCase()];
    if (normalized) {
        return normalized;
    }

    return key;
}

export function inferKeyboardKeyCode(key, code, fallback = 0) {
    const numericFallback = Number(fallback);
    if (Number.isInteger(numericFallback) && numericFallback > 0) {
        return numericFallback;
    }

    if (typeof code === 'string' && code.length > 0) {
        if (Object.hasOwn(KEY_CODE_BY_CODE, code)) {
            return KEY_CODE_BY_CODE[code];
        }

        if (code.startsWith('Key') && code.length === 4) {
            return code.charCodeAt(3);
        }

        if (code.startsWith('Digit') && code.length === 6) {
            return code.charCodeAt(5);
        }

        if (code.startsWith('Numpad') && code.length === 7) {
            const digit = Number(code.at(-1));
            if (Number.isInteger(digit)) {
                return 96 + digit;
            }
        }

        if (/^F\d{1,2}$/.test(code)) {
            const fnNumber = Number.parseInt(code.slice(1), 10);
            if (fnNumber >= 1 && fnNumber <= 24) {
                return 111 + fnNumber;
            }
        }
    }

    const normalizedKey = normalizeKeyboardKey(key, code);
    if (typeof normalizedKey === 'string' && normalizedKey.length === 1) {
        return normalizedKey.toUpperCase().charCodeAt(0);
    }

    const specialKey = typeof normalizedKey === 'string'
        ? SPECIAL_KEY_BY_NAME[normalizedKey.toLowerCase()]
        : null;
    if (specialKey && Object.hasOwn(KEY_CODE_BY_CODE, specialKey)) {
        return KEY_CODE_BY_CODE[specialKey];
    }

    return 0;
}

export function dispatchSyntheticKeyboardEvent(type, {
    key,
    code,
    keyCode,
    which,
    target,
    ...options
} = {}) {
    const resolvedTarget = target || getSyntheticKeyboardTarget(document);
    const resolvedKey = normalizeKeyboardKey(key, code);
    const resolvedKeyCode = inferKeyboardKeyCode(resolvedKey, code, keyCode ?? which);

    const event = new KeyboardEvent(type, {
        key: resolvedKey,
        code,
        keyCode: resolvedKeyCode,
        which: which ?? resolvedKeyCode,
        charCode: resolvedKeyCode,
        bubbles: true,
        cancelable: true,
        ...options
    });

    resolvedTarget.dispatchEvent(event);
    return event;
}
