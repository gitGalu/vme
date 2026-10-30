import { CollectionBrowser } from '../src/CollectionBrowser.js';
import { EnvironmentManager } from '../src/EnvironmentManager.js';

const assert = (value, message) => { if (!value) throw new Error(message); };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate, message) {
    for (let i = 0; i < 200; i++) { if (predicate()) return; await wait(20); }
    throw new Error(message);
}

// Run in a fresh touch-enabled app. Reuses the real CLI keyboard; storage/launches are mocked.
export async function runCollectionTouchSearchTests() {
    assert(EnvironmentManager.hasTouch(), 'Use a touch-enabled browser context');
    const root = document.getElementById('collection-browser');
    assert(!root.classList.contains('show'), 'Start from the main menu');
    const moduleUrl = pattern => performance.getEntriesByType('resource').find(entry => pattern.test(entry.name)).name;
    const { CLI } = await import(moduleUrl(/\/cli\/CLI\.js(?:\?|$)/));
    const { KeyboardManager } = await import(moduleUrl(/\/keyboard\/KeyboardManager\.js(?:\?|$)/));
    const originalInput = CLI.prototype.process_input, originalSound = KeyboardManager.prototype.playSound;
    let cli, keyboard;
    CLI.prototype.process_input = function (...args) { cli = this; return originalInput.apply(this, args); };
    KeyboardManager.prototype.playSound = function (...args) { keyboard = this; return originalSound.apply(this, args); };
    try {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'q', code: 'KeyQ', bubbles: true, cancelable: true }));
        document.dispatchEvent(new KeyboardEvent('keyup', { key: 'q', code: 'KeyQ', bubbles: true }));
    } finally {
        CLI.prototype.process_input = originalInput;
        KeyboardManager.prototype.playSound = originalSound;
    }
    assert(cli && keyboard, 'Could not capture the real CLI keyboard');
    cli.off(); cli.reset(); keyboard.clicks_off();
    const keys = ['BOOT_TO', 'COLLECTION_BROWSER_VIEW', 'COLLECTION_BROWSER_COLLECTION_INDEX', 'COLLECTION_BROWSER_ITEM_INDEX'];
    const saved = keys.map(key => [`VME_INTERNAL.${key}`, localStorage.getItem(`VME_INTERNAL.${key}`)]);
    const originalDisplay = root.style.display;
    const keyboardElement = document.getElementById('keyboard');
    const container = document.getElementById('keyboardContainer');
    const input = document.getElementById('collectionBrowserSearchInput');
    const count = document.getElementById('collectionBrowserSearchCount');
    const image = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="336" height="240"><rect width="336" height="240" fill="#234650"/></svg>');
    const items = ['Fred', 'Fred: The Return'].map((title, i) => ({ id: i + 1, rom_data_id: i + 1, rom_name: `game-${i + 1}.xex`, title, platform_id: 'atari800', image }));
    let launched;
    const browser = new CollectionBrowser(
        { getGamepadManager: () => null, getKeyboardManager: () => keyboard, toggleScreen: () => { root.style.display = 'flex'; } },
        { updatePlatform() {}, loadRomFromCollection: (...args) => { launched = args; } },
        { getAllSaveMeta: async () => [], getCollectionItems: async () => items.map(item => ({ ...item })), getRomData: async () => ({ rom_data: new Blob(['test']) }) },
        { reset() {} },
    );
    const touch = (id, type) => {
        const target = document.getElementById(id), rect = target.getBoundingClientRect();
        const point = { identifier: 1, target, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 };
        // WebKit does not expose a constructible Touch; use the properties read by the handlers.
        const event = new Event(type, { bubbles: true, cancelable: true });
        Object.defineProperties(event, {
            touches: { value: type === 'touchend' ? [] : [point] }, changedTouches: { value: [point] },
        });
        target.dispatchEvent(event);
    };
    const tap = id => { touch(id, 'touchstart'); touch(id, 'touchend'); };
    const type = text => { for (const char of text) tap('key' + char.toUpperCase()); };
    const cliText = () => document.getElementById('cors_query').textContent;
    const open = async mode => {
        localStorage.setItem('VME_INTERNAL.COLLECTION_BROWSER_VIEW', mode);
        await browser.open();
        await until(() => !document.getElementById('collectionBrowserUiView').classList.contains('disabled'), 'Browser not ready');
        document.getElementById('collectionBrowserSearchToggle').click();
        assert(input.readOnly && input.inputMode === 'none' && document.activeElement !== input, 'Touch field could summon a system keyboard');
        assert(container.classList.contains('visible') && keyboardElement.classList.contains('keyboardQwerty'), 'CLI QWERTY keyboard not shown');
        assert(+getComputedStyle(container).zIndex > +getComputedStyle(root).zIndex, 'Keyboard is underneath the browser');
        await wait(150);
    };
    const initiallyQwerty = keyboardElement.classList.contains('keyboardQwerty');
    try {
        // Search temporarily uses QWERTY even if the user last left the CLI in strip mode.
        if (initiallyQwerty) document.getElementById('kbCtrlArrow').click();
        await open('grid');
        type('fred'); await wait(150);
        assert(input.value.toLowerCase() === 'fred' && count.textContent === '2 / 2', 'Touch letters did not filter');
        assert(cliText() === '', 'Search text leaked into the CLI');
        tap('keySpace'); type('return'); await wait(150);
        assert(input.value.toLowerCase() === 'fred return' && count.textContent === '1 / 2', 'Touch space did not filter');
        document.getElementById('kbCtrlClear').click();
        assert(input.value === '' && count.textContent === '2 / 2', 'Keyboard Clear did not clear only the filter');
        type('fredxxxxxx');
        const before = input.value.length;
        touch('keyBackspace', 'touchstart');
        await until(() => input.value.length < before - 2, 'Held Backspace did not repeat');
        document.getElementById('kbCtrlCross').click();
        const stopped = input.value;
        await wait(500); touch('keyBackspace', 'touchend');
        assert(input.value === stopped && !container.classList.contains('visible'), 'Hide did not stop held deletion');
        assert(keyboardElement.classList.contains('keyboardStrip'), 'Previous CLI layout was not restored');
        input.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'touch' }));
        assert(container.classList.contains('visible') && document.activeElement !== input, 'Touching the field did not reopen the CLI keyboard');
        document.getElementById('collectionBrowserSearchClose').click();
        assert(!container.classList.contains('visible') && !document.body.classList.contains('browser-text-keyboard'), 'Closing search left keyboard active');
        browser.close();
        if (initiallyQwerty) document.getElementById('kbCtrlArrow').click();

        await open('coverflow');
        type('return'); tap('keyEnter');
        await until(() => launched, 'VM/E keyboard Enter did not launch');
        assert(launched[2] === 'game-2.xex', 'Touch Enter launched a stale result');
        assert(!container.classList.contains('visible') && cliText() === '', 'Enter left the keyboard active or changed CLI text');
        browser.close();
        // A fresh CLI keystroke must once again go to the CLI, without touching the search.
        keyboard.showTouchKeyboard(); tap('keyA');
        assert(cliText().toLowerCase() === 'a' && input.value === '', 'Keyboard did not return to CLI');
        return { sharedCliKeyboard: true, systemKeyboardSuppressed: true, heldBackspace: true,
            closeRestoresLayout: true, cliInputRestored: true, launchTitle: launched[3] };
    } finally {
        browser.close(); keyboard.hideTouchKeyboard(false); cli.reset(); cli.on(); keyboard.clicks_on();
        if (keyboardElement.classList.contains('keyboardQwerty') !== initiallyQwerty) document.getElementById('kbCtrlArrow').click();
        saved.forEach(([key, value]) => value === null ? localStorage.removeItem(key) : localStorage.setItem(key, value));
        root.classList.remove('show'); root.style.display = originalDisplay;
        document.getElementById('collectionBrowserUi').style.display = '';
    }
}
