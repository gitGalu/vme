import { CLI } from '../src/cli/CLI.js';
import { KeyboardManager } from '../src/keyboard/KeyboardManager.js';
import { VME } from '../src/VME.js';

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const waitFor = async predicate => {
    for (let i = 0; i < 150; i++) {
        if (predicate()) return;
        await wait(10);
    }
    throw new Error('Timed out waiting for held CLI key.');
};

export async function runCliKeyRepeatTest() {
    const fixture = document.createElement('div');
    fixture.innerHTML = `<button id="toggle-keyboard">Kb</button><input id="cors_hidden_input">
      <div id="keyboardContainer"><div class="kbCtrlContainer">
        <span class="kbCtrl" id="kbCtrlClear">Clear</span><span class="kbCtrl" id="kbCtrlArrow">Mode</span><span class="kbCtrl" id="kbCtrlCross">Hide</span>
      </div><div id="keyboard" class="keyboardQwerty">
        <div id="keyboardSelection"><span class="key" id="keySelUp">Up</span><span class="key" id="keySelDown">Down</span><span class="key" id="keySelEnter">OK</span></div>
        <span class="key layerA" id="keyBackspace" data-value="backspace" data-code="Backspace">BSP</span>
        <span class="key layerA" id="keyA" data-value="a" data-code="KeyA">A</span>
        <span class="key" id="keyShift">Shift</span><span class="key" id="keyToggle">Toggle</span>
      </div></div>`;
    document.body.append(fixture);
    const cli = new CLI();
    const initAudio = KeyboardManager.prototype.initAudioContext;
    const playSound = KeyboardManager.prototype.playSound;
    let keyboard;
    KeyboardManager.prototype.initAudioContext = () => {};
    KeyboardManager.prototype.playSound = () => {};
    try { keyboard = new KeyboardManager(cli); }
    finally { KeyboardManager.prototype.initAudioContext = initAudio; }
    const query = () => document.getElementById('cors_query').textContent;
    const bsp = document.getElementById('keyBackspace');
    const mouse = (element, type, detail = 0, outside = false) => {
        const rect = element.getBoundingClientRect();
        element.dispatchEvent(new MouseEvent(type, {
            button: 0, detail, bubbles: true, cancelable: true,
            clientX: outside ? rect.right + 100 : rect.left + rect.width / 2,
            clientY: rect.top + rect.height / 2
        }));
    };
    const touch = (element, type, outside = false, identifier = 1) => {
        const rect = element.getBoundingClientRect();
        const point = new Touch({ identifier, target: element,
            clientX: outside ? rect.right + 100 : rect.left + rect.width / 2,
            clientY: rect.top + rect.height / 2 });
        element.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true,
            touches: type === 'touchend' || type === 'touchcancel' ? [] : [point], changedTouches: [point] }));
    };
    const text = 'abcdefghijklmnopqrst';
    const fresh = () => { cli.inject(text, false); keyboard.showTouchKeyboard(); };
    const expectStopped = async (read, message) => {
        const before = read(); await wait(450); assert(read() === before, message);
    };
    try {
        keyboard.updateMode(VME.CURRENT_SCREEN.MENU);
        fresh();
        mouse(bsp, 'mousedown');
        assert(query().length === text.length - 1, 'Mouse press deletes immediately');
        mouse(bsp, 'mouseup'); mouse(bsp, 'click', 1);
        assert(query().length === text.length - 1, 'Physical mouse click does not duplicate the initial press');
        bsp.click();
        assert(query().length === text.length - 2, 'Programmatic/gamepad click still deletes once');
        mouse(bsp, 'mousedown');
        await waitFor(() => query().length <= text.length - 5);
        mouse(bsp, 'mouseup');
        await expectStopped(query, 'Mouse release stops deletion');

        fresh(); touch(bsp, 'touchstart');
        assert(query().length === text.length - 1, 'Touch press deletes immediately');
        touch(bsp, 'touchend', false, 2);
        await waitFor(() => query().length <= text.length - 3);
        touch(bsp, 'touchcancel');
        await expectStopped(query, 'Touch cancellation stops deletion; another finger does not cancel the held key');
        fresh(); touch(bsp, 'touchstart'); touch(bsp, 'touchmove', true);
        await expectStopped(query, 'Sliding outside the key stops deletion');
        touch(bsp, 'touchend');
        fresh(); mouse(bsp, 'mousedown'); mouse(bsp, 'mousemove', 0, true);
        await expectStopped(query, 'Dragging the mouse outside the key stops deletion');
        mouse(bsp, 'mouseup');

        fresh(); mouse(bsp, 'mousedown'); window.dispatchEvent(new Event('blur'));
        await expectStopped(query, 'Losing focus stops deletion');
        mouse(bsp, 'mouseup');
        fresh(); mouse(bsp, 'mousedown'); keyboard.hideTouchKeyboard(false);
        await expectStopped(query, 'Hiding the keyboard stops deletion');
        mouse(bsp, 'mouseup');
        fresh(); mouse(bsp, 'mousedown'); cli.set_loading(true);
        await expectStopped(query, 'Loading blocks further held-key actions');
        mouse(bsp, 'mouseup'); cli.set_loading(false);

        const choices = Array.from({ length: 30 }, (_, i) => ({ label: `Game ${i}`, data: i }));
        const choosing = cli.chooseFromList(choices);
        keyboard.showTouchKeyboard();
        const down = document.getElementById('keySelDown');
        const up = document.getElementById('keySelUp');
        mouse(down, 'mousedown');
        assert(cli.get_selection_index() === 1, 'Mouse arrow acts on press');
        await waitFor(() => cli.get_selection_index() >= 3);
        mouse(down, 'mouseup'); mouse(down, 'click', 1);
        await expectStopped(() => cli.get_selection_index(), 'Arrow release stops selection movement');
        const index = cli.get_selection_index();
        touch(up, 'touchstart');
        await waitFor(() => cli.get_selection_index() <= index - 3);
        touch(up, 'touchend');
        await expectStopped(() => cli.get_selection_index(), 'Touch arrow release stops selection movement');
        cli.process_input('escape'); await choosing;

        fresh(); mouse(bsp, 'mousedown');
        keyboard.updateMode(VME.CURRENT_SCREEN.EMULATION);
        await expectStopped(query, 'Changing to emulation cancels CLI repeat');
        mouse(bsp, 'mouseup');
        const emuEvents = [];
        const onKey = event => { if (event.code === 'Backspace') emuEvents.push(event.type); };
        document.addEventListener('keydown', onKey); document.addEventListener('keyup', onKey);
        try {
            touch(bsp, 'touchstart'); await wait(500); touch(bsp, 'touchend');
            assert(emuEvents.join(',') === 'keydown,keyup', 'Emulator receives one keydown/keyup pair, without CLI repeat');
        } finally { document.removeEventListener('keydown', onKey); document.removeEventListener('keyup', onKey); }
    } finally {
        keyboard.hideTouchKeyboard(false); keyboard.updateMode(VME.CURRENT_SCREEN.MENU);
        cli.reset(); fixture.remove(); KeyboardManager.prototype.playSound = playSound;
    }
    return 'Held CLI keys: mouse/touch Backspace and arrows, single taps, gamepad clicks, release/drag/cancel/blur/hide/loading and emulator isolation';
}
