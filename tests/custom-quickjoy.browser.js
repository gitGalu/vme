import DOS from '../src/platforms/systems/DOS.js';
import { QuickJoy } from '../src/touch/QuickJoy.js';
import { CustomControllerManager } from '../src/touch/custom/CustomControllerManager.js';

const assert = (value, message) => { if (!value) throw new Error(message); };
const presetIds = ['dos-qj-space', 'dos-qj-shift', 'dos-qj-stunts'];
const referenceIds = { 'left-right': 'qjlr', 'up-down': 'qjud1', action: 'qja' };

// Run in a fresh app context, without starting a core or changing storage.
export function runCustomQuickJoyTests() {
    assert(!document.querySelector('#quickjoys, #custom-touch-controller'), 'Start from a fresh app context');
    const canvas = document.createElement('canvas');
    canvas.hidden = true;
    document.body.prepend(canvas);
    const events = [];
    const record = event => events.push({ type: event.type, code: event.code });
    canvas.addEventListener('keydown', record);
    canvas.addEventListener('keyup', record);
    const core = { pressDown() {}, pressUp() {} };
    const reference = new QuickJoy({
        getSelectedPlatform: () => ({ fire_buttons: 1 }),
        getNostalgist: () => core,
    });
    let manager;

    const touch = (element, pressed, xFraction = 0.5, yFraction = 0.5) => {
        const rect = element.getBoundingClientRect();
        const event = new Event(pressed ? 'touchstart' : 'touchend', { bubbles: true, cancelable: true });
        Object.defineProperty(event, 'changedTouches', { value: [{
            identifier: 1,
            clientX: rect.left + rect.width * xFraction,
            clientY: rect.top + rect.height * yFraction,
        }] });
        element.dispatchEvent(event);
    };
    const checkKey = (element, code, xFraction, yFraction) => {
        events.length = 0;
        touch(element, true, xFraction, yFraction);
        assert(events.some(event => event.type === 'keydown' && event.code === code), `Missing keydown: ${code}`);
        touch(element, false, xFraction, yFraction);
        assert(events.some(event => event.type === 'keyup' && event.code === code), `Missing keyup: ${code}`);
    };

    try {
        reference.show();
        const expected = Object.fromEntries(Object.entries(referenceIds).map(([role, id]) => {
            const element = document.getElementById(id);
            return [role, {
                rect: element.getBoundingClientRect(),
                children: Array.from(element.children, child => child.getBoundingClientRect()),
            }];
        }));
        reference.hide();
        const presets = DOS.custom_controllers.presets.filter(preset => presetIds.includes(preset.id));
        assert(presets.length === 3, 'All three DOS quickjoy presets are covered');
        manager = new CustomControllerManager({ getNostalgist: () => core }, { presets });

        const checkLayout = preset => {
            const grid = document.querySelector('.custom-touch-controller__grid');
            const style = getComputedStyle(grid);
            assert(style.gridTemplateRows.split(' ').length === 50, 'Custom grid must retain exactly 50 rows');
            assert(style.gridTemplateColumns.split(' ').length === 50, 'Custom grid must retain exactly 50 columns');
            assert(document.querySelectorAll('.custom-touch-controller__grid').length === 1, 'Custom controllers use one shared grid');
            assert(grid.querySelectorAll('[data-quickjoy-role]').length === 3, 'One control per quickjoy role');
            for (const definition of preset.elements.filter(element => element.quickjoyRole)) {
                const role = definition.quickjoyRole;
                const element = grid.querySelector(`[data-quickjoy-role="${role}"]`);
                const actual = element.getBoundingClientRect();
                for (const property of ['left', 'top', 'width', 'height']) {
                    assert(Math.abs(actual[property] - expected[role].rect[property]) < 0.2,
                        `${preset.id}: ${role} ${property} differs from standard QuickJoy`);
                }
                if (definition.component === 'DualTouchButton') {
                    Array.from(element.children).forEach((child, index) => {
                        const rect = child.getBoundingClientRect();
                        for (const property of ['width', 'height']) {
                            assert(Math.abs(rect[property] - expected[role].children[index][property]) < 0.2,
                                `${preset.id}: ${role} touch target ${property}`);
                        }
                    });
                    const horizontal = definition.options?.isHorizontal ?? true;
                    checkKey(element, definition.binding.primary.code, horizontal ? 0.25 : 0.5, horizontal ? 0.5 : 0.25);
                    checkKey(element, definition.binding.secondary.code, horizontal ? 0.75 : 0.5, horizontal ? 0.5 : 0.75);
                } else {
                    checkKey(element, definition.binding.key.code, 0.5, 0.5);
                }
            }
        };

        for (const preset of presets) {
            manager.setActivePreset(preset.id);
            manager.show();
            checkLayout(preset);
            const left = document.querySelector('[data-quickjoy-role="left-right"]');
            const code = preset.elements.find(element => element.quickjoyRole === 'left-right').binding.primary.code;
            events.length = 0;
            touch(left, true, 0.25, 0.5);
            window.dispatchEvent(new Event('resize'));
            assert(events.some(event => event.type === 'keyup' && event.code === code), 'Resize releases a held direction');
            checkLayout(preset);
        }
        return { presets: presetIds, standardDimensions: true, sharedGrid: '50x50', keyboardBindings: true, resizeRelease: true };
    } finally {
        canvas.removeEventListener('keydown', record);
        canvas.removeEventListener('keyup', record);
        manager?.destroy();
        document.getElementById('quickjoys')?.remove();
        canvas.remove();
    }
}
