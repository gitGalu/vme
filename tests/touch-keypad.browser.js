import { KeypadTouchButton } from '../src/touch/KeypadTouchButton.js';
import Jaguar from '../src/platforms/systems/Jaguar.js';
import Coleco from '../src/platforms/systems/Coleco.js';

const assert = (value, message) => { if (!value) throw new Error(message); };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

export function previewTouchKeypad(platformId = 'jaguar') {
    const platform = platformId === 'coleco' ? Coleco : Jaguar;
    window.__keypadPreview?.destroy();
    document.getElementById('fastui')?.remove();
    const parent = document.createElement('div');
    parent.id = 'fastui';
    parent.dataset.platformId = platform.platform_id;
    parent.style.display = 'grid';
    const additionalButtons = platform.touch_keypad?.replace_additional_buttons
        ? [] : Object.values(platform.additional_buttons).reverse();
    additionalButtons.forEach((button, index) => {
        const element = document.createElement('div');
        element.id = `fast${index + 1}`;
        element.textContent = button.label;
        parent.appendChild(element);
    });
    document.body.appendChild(parent);
    const keypad = new KeypadTouchButton(parent, platform.touch_keypad);
    window.__keypadPreview = keypad;
    return { parent, keypad };
}

export async function runTouchKeypadTests(platformId = 'jaguar') {
    const { parent, keypad } = previewTouchKeypad(platformId);
    const canvas = document.createElement('canvas');
    document.body.appendChild(canvas);
    const events = [];
    const record = event => events.push([event.type, event.key, event.code, event.keyCode]);
    canvas.addEventListener('keydown', record);
    canvas.addEventListener('keyup', record);
    const trigger = parent.querySelector('.touch-keypad__trigger');
    const panel = parent.querySelector('.touch-keypad__panel');
    const key = label => [...panel.children].find(button => button.textContent === label);
    const center = element => {
        const rect = element.getBoundingClientRect();
        return { clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 };
    };
    const pointer = (type, element, { id = 1, point = center(element) } = {}) => {
        const event = new PointerEvent(type, {
            bubbles: true, cancelable: true, pointerType: 'touch', pointerId: id,
            button: 0, ...point
        });
        element.dispatchEvent(event);
        return event;
    };
    const tap = element => { pointer('pointerdown', element); pointer('pointerup', element); };
    const open = () => { if (panel.hidden) tap(trigger); };
    const reset = () => { keypad.close(); events.length = 0; };
    const types = () => events.map(event => `${event[0]}:${event[2]}`).join(',');
    try {
        pointer('pointerdown', trigger);
        assert(!panel.hidden && events.length === 0, 'Press opens a preview without pressing a key');
        pointer('pointerup', trigger);
        assert(!panel.hidden, 'A tap pins the panel open');
        tap(trigger);
        assert(panel.hidden && events.length === 0, 'A second tap closes without sending a key');

        open();
        pointer('pointerdown', panel);
        pointer('pointerup', panel);
        assert(!panel.hidden, 'Touching panel padding keeps the keypad open');
        let outsideTouches = 0;
        const outsideTouch = event => { outsideTouches++; event.stopPropagation(); };
        canvas.addEventListener('pointerdown', outsideTouch);
        const outsideEvent = pointer('pointerdown', canvas);
        pointer('pointerup', canvas);
        canvas.removeEventListener('pointerdown', outsideTouch);
        assert(panel.hidden && !events.length, 'Touching outside closes even when another control stops propagation');
        assert(outsideTouches === 1 && !outsideEvent.defaultPrevented, 'Outside touch still reaches its intended control');

        reset(); open();
        pointer('pointerdown', key('1'));
        pointer('pointerdown', canvas, { id: 2 });
        pointer('pointerup', key('1'));
        assert(panel.hidden && types() === 'keydown:Digit1,keyup:Digit1', 'An outside touch closes and releases a held key once');
        reset();

        pointer('pointerdown', trigger);
        pointer('pointermove', trigger, { point: center(key('2')) });
        pointer('pointermove', trigger, { point: center(key('5')) });
        assert(events.length === 0 && key('5').classList.contains('is-active'), 'Drag highlights without typing intermediate keys');
        pointer('pointerup', trigger, { point: center(key('5')) });
        assert(types() === 'keydown:Digit5', 'Drag release presses only the selected key');
        await wait(110);
        assert(panel.hidden && types() === 'keydown:Digit5,keyup:Digit5', 'A drag gets a core-visible pulse and closes');

        reset();
        for (const label of ['2', '3']) {
            pointer('pointerdown', trigger);
            pointer('pointerup', trigger, { point: center(key(label)) });
        }
        await wait(110);
        assert(panel.hidden && types() === 'keydown:Digit2,keyup:Digit2,keydown:Digit3,keyup:Digit3', 'Rapid drags keep transient selection without leaving a pinned panel');

        reset();
        pointer('pointerdown', trigger);
        pointer('pointermove', trigger, { point: center(key('7')) });
        pointer('pointercancel', trigger);
        assert(panel.hidden && !events.length, 'Cancelling a drag does not select');
        pointer('pointerdown', trigger);
        pointer('pointerup', trigger, { point: { clientX: 1, clientY: 1 } });
        assert(panel.hidden && !events.length, 'Releasing outside cancels selection');

        reset(); open();
        pointer('pointerdown', key('1'));
        await wait(110);
        assert(types() === 'keydown:Digit1', 'A grid key remains held until release');
        pointer('pointerup', canvas, { id: 2 });
        assert(types() === 'keydown:Digit1', 'Another finger does not release a held key');
        pointer('pointermove', key('1'), { point: { clientX: 1, clientY: 1 } });
        pointer('pointerup', key('1'));
        assert(types() === 'keydown:Digit1,keyup:Digit1' && !panel.hidden, 'Leaving a key releases it and preserves the pinned panel');
        events.length = 0;
        for (const label of ['*', '#', '0']) tap(key(label));
        assert(types() === 'keydown:Minus,keyup:Minus,keydown:Equal,keyup:Equal,keydown:Digit0,keyup:Digit0', 'Special keypad labels map to core keyboard keys');
        assert(events[0][3] === 189 && events[2][3] === 187, 'Special keys include Emscripten key codes');

        reset(); open();
        pointer('pointerdown', trigger);
        pointer('pointerup', trigger, { point: center(key('9')) });
        await wait(110);
        assert(!panel.hidden && types() === 'keydown:Digit9,keyup:Digit9', 'Dragging from a pinned panel keeps it open');

        for (const type of ['pointercancel', 'lostpointercapture']) {
            reset(); open(); pointer('pointerdown', key('4')); pointer(type, key('4'));
            assert(panel.hidden && types() === 'keydown:Digit4,keyup:Digit4', `${type} releases held input`);
        }
        for (const type of ['blur', 'pagehide', 'resize']) {
            reset(); open(); pointer('pointerdown', key('6')); window.dispatchEvent(new Event(type));
            assert(panel.hidden && types() === 'keydown:Digit6,keyup:Digit6', `${type} closes and releases input`);
        }
        reset(); open(); pointer('pointerdown', key('6'));
        const hiddenDescriptor = Object.getOwnPropertyDescriptor(document, 'hidden');
        try {
            Object.defineProperty(document, 'hidden', { configurable: true, value: true });
            document.dispatchEvent(new Event('visibilitychange'));
        } finally {
            if (hiddenDescriptor) Object.defineProperty(document, 'hidden', hiddenDescriptor);
            else delete document.hidden;
        }
        assert(panel.hidden && types() === 'keydown:Digit6,keyup:Digit6', 'A backgrounded document releases input');
        reset(); open(); pointer('pointerdown', key('8'));
        parent.style.display = 'none'; await wait(0);
        assert(panel.hidden && types() === 'keydown:Digit8,keyup:Digit8', 'Hiding fast UI releases input');
        parent.style.display = 'grid';

        reset(); open(); pointer('pointerdown', key('7'));
        document.body.classList.add('gamepad-emulation'); await wait(0);
        assert(panel.hidden && types() === 'keydown:Digit7,keyup:Digit7', 'Switching to gamepad UI releases keypad input');
        document.body.classList.remove('gamepad-emulation');

        reset(); open();
        const rect = panel.getBoundingClientRect();
        assert(rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight, 'Panel fits the viewport');
        assert(key('1').getBoundingClientRect().width >= 44, 'Touch targets are at least 44 pixels');
        reset();
        pointer('pointerdown', trigger);
        pointer('pointerup', trigger, { point: center(key('3')) });
        keypad.close(); await wait(110);
        assert(types() === 'keydown:Digit3,keyup:Digit3', 'Closing during a pulse releases once without delayed key presses');

        reset(); open(); pointer('pointerdown', key('2'));
        keypad.destroy(); pointer('pointerup', window, { point: { clientX: 1, clientY: 1 } });
        assert(types() === 'keydown:Digit2,keyup:Digit2' && !parent.querySelector('#fastkeypad'), 'Destroy releases input and removes controls');
    } finally {
        keypad.destroy(); parent.remove(); canvas.remove();
    }
    return 'PASS: tap/drag selection, held keys, keypad mappings, pointer isolation, cancellation, lifecycle cleanup and viewport layout';
}
