import { SaveBrowser } from '../src/SaveBrowser.js';
import { VME } from '../src/VME.js';

const assert = (value, message) => { if (!value) throw new Error(message); };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate, message) {
    for (let i = 0; i < 250; i++) { if (predicate()) return; await wait(20); }
    throw new Error(message);
}

// Fresh isolated app only. Uses the real keyboard, mocked metadata and no IndexedDB/ROMs.
export async function runSaveSearchTests({ grid = false } = {}) {
    const viewKey = 'VME_INTERNAL.SAVE_BROWSER_VIEW';
    const previousView = localStorage.getItem(viewKey);
    localStorage.setItem(viewKey, grid ? 'grid' : 'coverflow');
    const root = document.getElementById('save-browser');
    assert(!root.classList.contains('show'), 'Start from the main menu');
    const url = pattern => performance.getEntriesByType('resource').find(entry => pattern.test(entry.name)).name;
    const { CLI } = await import(url(/\/cli\/CLI\.js(?:\?|$)/));
    const { KeyboardManager } = await import(url(/\/keyboard\/KeyboardManager\.js(?:\?|$)/));
    const originalInput = CLI.prototype.process_input, originalSound = KeyboardManager.prototype.playSound;
    let cli, keyboard;
    CLI.prototype.process_input = function (...args) { cli = this; return originalInput.apply(this, args); };
    KeyboardManager.prototype.playSound = function (...args) { keyboard = this; return originalSound.apply(this, args); };
    try {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'q', code: 'KeyQ', bubbles: true, cancelable: true }));
        document.dispatchEvent(new KeyboardEvent('keyup', { key: 'q', code: 'KeyQ', bubbles: true }));
    } finally { CLI.prototype.process_input = originalInput; KeyboardManager.prototype.playSound = originalSound; }
    assert(cli && keyboard, 'Could not capture CLI keyboard');
    cli.off(); cli.reset(); keyboard.clicks_off();
    const originalDisplay = root.style.display;
    const platformContainer = document.getElementById('platformFilterContainer');
    const originalFilterStyle = platformContainer.getAttribute('style');
    const originalFilterClass = platformContainer.className;
    const oldDropdown = document.getElementById('platformDropdownContainer');
    oldDropdown?.remove();
    const input = document.getElementById('saveBrowserSearchInput');
    const form = document.getElementById('saveBrowserSearch');
    const toggle = document.getElementById('saveBrowserSearchToggle');
    const count = document.getElementById('saveBrowserSearchCount');
    const originalCreate = URL.createObjectURL, originalRevoke = URL.revokeObjectURL;
    const screenshotUrls = new Set();
    let created = 0;
    const canvas = document.createElement('canvas'); canvas.width = 336; canvas.height = 240;
    canvas.getContext('2d').fillRect(0, 0, 336, 240);
    const screenshot = await new Promise(resolve => canvas.toBlob(resolve));
    URL.createObjectURL = blob => {
        const value = originalCreate.call(URL, blob);
        if (blob === screenshot) { screenshotUrls.add(value); created++; }
        return value;
    };
    URL.revokeObjectURL = value => { screenshotUrls.delete(value); originalRevoke.call(URL, value); };
    const archive = (entry, caption = `${entry} * bundle.zip`) => ({
        program_name: entry, caption,
        launch_core_config: { _vmeArchive: { version: 1, archiveName: 'bundle.zip', archiveHash: 'fred-archive', entryPath: entry, storage: 'entry' } },
    });
    const saves = [
        { id: 101, ...archive('Fred (v1).atr'), timestamp: 1 },
        { id: 102, ...archive('Fred (v1).atr'), timestamp: 2 },
        { id: 103, ...archive('Fred (v2).atr'), timestamp: 3 },
        { id: 201, program_name: 'Fred.d64', caption: 'Fred Commodore', platform_id: 'c64', timestamp: 4 },
        { id: 301, program_name: 'Lodz.xex', caption: 'Łódź Adventure', timestamp: 5 },
        { id: 401, ...archive('Fred (v3).atr', 'My Record'), timestamp: 6 },
    ].map(item => ({ platform_id: 'atari800', screenshot, rom_data_id: item.id, save_data_id: item.id, ...item }));
    let reads = 0, overlay, loaded = 0, blockReads = false, releaseRead;
    const gm = {
        hasGamepad: () => false, clearBrowserNavigation() {}, restoreFocusToButton() {},
        setBrowserPanelAction() {},
        initBrowserNavigation: (_nav, _buttons, _back, _dropdown, value) => { overlay = value; },
    };
    const browser = new SaveBrowser(
        { getGamepadManager: () => gm, getKeyboardManager: () => keyboard,
            toggleScreen: mode => { root.style.display = mode === VME.CURRENT_SCREEN.SAVE_BROWSER ? 'flex' : 'none'; } },
        { updatePlatform() {}, loadState() { loaded++; } },
        { getAllSaveMeta: async () => { reads++; if (blockReads) await new Promise(resolve => { releaseRead = resolve; }); return saves.map(item => ({ ...item })); },
            deleteSave: async id => { saves.splice(saves.findIndex(item => item.id === id), 1); },
            getSaveData: async id => ({ ...saves.find(item => item.id === id) }),
        },
        { reset() {} },
    );
    const key = (value, target = document) => {
        target.dispatchEvent(new KeyboardEvent('keydown', { key: value, code: value, bubbles: true, cancelable: true }));
        target.dispatchEvent(new KeyboardEvent('keyup', { key: value, bubbles: true }));
    };
    const cards = () => [...root.querySelectorAll('.flicking-panel, #save-grid .collection-grid-cell')];
    const activeId = () => root.querySelector('.flicking-panel.active, #save-grid .collection-grid-cell.focused')?.dataset.id;
    const query = async text => { input.value = text; input.dispatchEvent(new Event('input', { bubbles: true })); await wait(150); };
    const ready = async (view, size) => until(() => root.dataset.view === view && cards().length === size
        && !root.classList.contains('transitioning') && !document.getElementById('saveBrowserUiView').classList.contains('disabled') && !document.getElementById(view === 'game-list' ? 'saveBrowserUiOpen' : 'saveBrowserUiLoad').classList.contains('disabled'), 'Save Browser did not settle');
    const platform = async value => {
        const option = platformContainer.querySelector(`.custom-dropdown-option[data-value="${value}"]`);
        assert(option, 'Platform option disappeared after title filtering'); option.click();
        await until(() => !root.classList.contains('transitioning'), 'Platform filter did not settle'); await wait(350);
    };
    try {
        browser.open();
        await until(() => cards().length === 5 && !document.getElementById('saveBrowserUiView').classList.contains('disabled'), 'View toggle did not unlock when data arrived');
        let baselineReads = reads;
        const initialUrls = created;
        assert(root.querySelector('.view-enter'), 'The view toggle should become available before entrance animation finishes');
        assert(root.dataset.layout === (grid ? 'grid' : 'coverflow'), 'View preference was not restored');
        const switchView = async () => {
            const before = activeId(), expected = root.dataset.layout === 'grid' ? 'coverflow' : 'grid';
            const button = document.getElementById('saveBrowserUiView');
            button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            button.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            await until(() => root.dataset.layout === expected && activeId() === before, 'View toggle lost the selection');
            assert(document.querySelectorAll('#save-grid .collection-grid-cell').length <= 5, 'Grid retained old cards');
        };
        for (let i = 0; i < 12; i++) await switchView();
        const beforeKeyboardView = activeId();
        key('Enter', document.getElementById('saveBrowserUiView'));
        key(' ', document.getElementById('saveBrowserUiView'));
        assert(root.dataset.view === 'game-list' && activeId() === beforeKeyboardView, 'Keyboard view toggle activated a game');
        assert(reads === baselineReads && created === initialUrls, 'Layout switches reloaded metadata or screenshot URLs');
        assert(!root.classList.contains('toolbar-enter-pending'), 'Early layout toggle left the toolbar hidden');
        await wait(350); // let the opening animation settle after synthetic rapid switches
        root.focus(); key('Tab', root);
        let dropdown = platformContainer.querySelector('.custom-dropdown');
        assert(dropdown.classList.contains('open') && document.activeElement === dropdown && root.classList.contains('filter-editing'), 'Tab must open the filter and transfer keyboard focus: ' + JSON.stringify({ grid, open: dropdown.classList.contains('open'), active: document.activeElement?.outerHTML.slice(0, 120), root: root.className, platform: platformContainer.className, skin: document.body.classList.contains('gamepad-browser-skin') }));
        const beforeFilterId = activeId();
        key('ArrowDown', dropdown);
        assert(cards().length === 5 && activeId() === beforeFilterId && reads === baselineReads, 'Previewing a platform moved or filtered cards');
        key('Escape', dropdown);
        assert(!dropdown.classList.contains('open') && !root.classList.contains('filter-editing') && document.activeElement === root && activeId() === beforeFilterId, 'Escape must cancel the filter and restore card focus');
        key('Tab', root); key('ArrowDown', dropdown); key('ArrowDown', dropdown); key('Enter', dropdown);
        await ready('game-list', 1);
        assert(activeId() === '201' && root.dataset.view === 'game-list' && document.activeElement === root, 'Filter Enter must confirm without opening game saves');
        key('Tab', root);
        dropdown = platformContainer.querySelector('.custom-dropdown');
        key('ArrowUp', dropdown); key('ArrowUp', dropdown); key('Enter', dropdown);
        await ready('game-list', 5); await wait(350);
        baselineReads = reads;
        const visiblePlatforms = () => [...platformContainer.querySelectorAll('.custom-dropdown-option')].filter(option => !option.hidden).map(option => option.dataset.value);
        key('Tab', root); dropdown = platformContainer.querySelector('.custom-dropdown');
        key('a', dropdown); key('8', dropdown);
        assert(visiblePlatforms().join(',') === 'all,atari800' && platformContainer.querySelector('.custom-dropdown-query').textContent === 'a8', 'Typed platform query must narrow options and show its text');
        assert(cards().length === 5 && reads === baselineReads && !input.value, 'Typing in platform filter changed saves or title search');
        key('ArrowUp', dropdown); key('ArrowDown', dropdown); key('Enter', dropdown);
        await ready('game-list', 4);
        assert(platformContainer.querySelector('.custom-dropdown-selected').textContent === 'A800', 'Typed filter selected the wrong platform');
        key('Tab', root); key('z', dropdown); key('z', dropdown);
        assert(visiblePlatforms().join(',') === 'all' && platformContainer.querySelector('.custom-dropdown-option.focused').dataset.value === 'all' && cards().length === 4, 'Unmatched query must focus All platforms without applying it');
        key('Backspace', dropdown);
        assert(platformContainer.querySelector('.custom-dropdown-query').textContent === 'z', 'Backspace must remove one query character');
        key('Backspace', dropdown);
        assert(visiblePlatforms().length === 3 && platformContainer.querySelector('.custom-dropdown-query').hidden, 'Deleting query must restore all platform choices');
        for (const char of 'C64') key(char, dropdown);
        assert(visiblePlatforms().join(',') === 'all,c64', 'Case-insensitive platform filtering failed');
        key('ArrowUp', dropdown); key('ArrowDown', dropdown);
        assert(platformContainer.querySelector('.custom-dropdown-option.focused').dataset.value === 'c64', 'Arrows navigated into hidden platform options');
        key('Escape', dropdown);
        assert(cards().length === 4 && platformContainer.querySelector('.custom-dropdown-selected').textContent === 'A800', 'Escape applied the typed platform preview');
        key('Tab', root);
        assert(visiblePlatforms().length === 3 && platformContainer.querySelector('.custom-dropdown-query').hidden, 'Reopening must clear the platform query');
        key('[', dropdown); key('Enter', dropdown);
        await ready('game-list', 5);
        assert(platformContainer.querySelector('.custom-dropdown-selected').textContent === 'All platforms', 'Enter on an unmatched query must restore All platforms');
        baselineReads = reads;

        toggle.click(); await query('fred');
        assert(cards().length === 3 && count.textContent === '3 / 5', 'Save search must use displayed captions');
        await query('lodz'); assert(cards().length === 1 && activeId() === '301', 'Diacritic-insensitive save title');
        await query('record'); assert(cards().length === 1 && activeId() === '401', 'Custom save captions remain searchable');
        await query('bundle');
        assert(cards().length === 0 && document.getElementById('saveBrowserEmpty').textContent.includes('No matching'), 'Archive filename must not pollute displayed-title matching');
        key('Enter', input); await wait(150);
        assert(root.dataset.view === 'game-list' && loaded === 0, 'No results must never enter or load a stale save');
        await query('fred');
        assert(reads === baselineReads && created === initialUrls, 'Typing must not reload metadata or duplicate screenshot URLs');
        await platform('c64');
        assert(cards().length === 1 && activeId() === '201' && input.value === 'fred' && count.textContent === '1 / 1', 'Search and platform filters do not combine');
        await platform('atari800');
        assert(cards().length === 2 && count.textContent === '2 / 4', 'Platform choices must survive title filtering');
        // Do not wait for the debounce: Enter must apply the latest version query first.
        input.value = 'v1'; input.dispatchEvent(new Event('input', { bubbles: true })); key('Enter', input);
        await ready('game-saves', 2);
        assert(form.hidden && toggle.hidden && input.value === 'v1', 'Game-saves view must suspend search without clearing its query');
        assert(!overlay.search.isAvailable(), 'Gamepad search should not be advertised inside one game');
        assert(cards().map(card => card.dataset.id).join(',') === '102,101', 'Enter selected the wrong game/version');
        await switchView(); await switchView();
        assert(form.hidden && input.value === 'v1', "Switching game saves lost the suspended search");
        const pad = buttons => ({ buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: buttons.includes(i) })), axes: [0, 0] });
        assert(overlay.search.handleInput(pad([3])) === false, 'Y must not reopen search inside one game');
        key('Escape'); await ready('game-list', 1);
        assert(!form.hidden && !toggle.hidden && input.value === 'v1' && activeId() === '102' && count.textContent === '1 / 4', 'Back must restore the query, platform and selected game');
        assert(!form.classList.contains('editing'), 'Back should not reopen either keyboard');
        assert(created === initialUrls + 1, 'Returning from game saves recreated screenshot URLs');
        document.getElementById('saveBrowserSearchClear').click();
        assert(cards().length === 4 && count.textContent === '4 / 4', 'Clear must preserve the platform filter');
        key('Escape');
        assert(form.hidden && cards().length === 4 && root.classList.contains('show'), 'First Escape should only close search');
        const pressPad = button => { overlay.search.handleInput(pad([button])); overlay.search.handleInput(pad([])); };
        pressPad(3); assert(!document.getElementById('saveBrowserSearchKeyboard').hidden, 'Y opens save-search keyboard');
        pressPad(0); await wait(150); assert(input.value === 'A', 'Gamepad keyboard did not edit save query');
        pressPad(2); assert(document.getElementById('saveBrowserSearchKeyboard').hidden && loaded === 0, 'X must return to results without loading');
        pressPad(3); pressPad(1); assert(form.hidden && !input.value, 'B cancels save search');
        if (grid) {
            toggle.click(); await query('v1'); key('Enter', input); await ready('game-saves', 2);
            const remove = document.getElementById('saveBrowserUiDelete');
            remove.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            remove.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            await until(() => cards().length === 1 && activeId() === '101', 'Grid deletion lost the remaining save');
            await switchView(); await switchView();
            key('Enter'); await until(() => loaded === 1, 'Grid did not load the selected remaining save');
        }
        browser.close();
        assert(localStorage.getItem(viewKey) === (grid ? 'grid' : 'coverflow'), 'Layout preference was not saved');
        assert(screenshotUrls.size === 0, 'Close must revoke every cached screenshot URL');
        if (grid) {
            // A large library renders only the visible rows, even far from its old selection.
            for (let i = 0; i < 500; i++) saves.push({ id: 1000 + i, program_name: `Library ${i}.xex`, platform_id: 'atari800', timestamp: 1000 + i });
            browser.open();
            await until(() => !document.getElementById('saveBrowserUiView').classList.contains('disabled'), 'Large grid did not settle');
            const scroller = document.getElementById('save-grid');
            scroller.scrollTop = scroller.scrollHeight;
            scroller.dispatchEvent(new Event('scroll')); await wait(50);
            assert(cards().length > 0 && cards().length < 40, 'Large save grid rendered too many thumbnails');
            cards()[0].click();
            assert(Number(root.querySelector('.collection-grid-cell.focused')?.dataset.index) > 400, 'Offscreen selection was not restored into view');
            browser.close();
            assert(cards().length === 0 && screenshotUrls.size === 0, 'Large grid leaked cards or screenshot URLs');
        }
        // A pending metadata read cannot resurrect a closed browser.
        blockReads = true; browser.open(); browser.close(); releaseRead(); await wait(600);
        assert(cards().length === 0 && form.hidden && screenshotUrls.size === 0, 'Closed browser returned after a pending read');
        return { displayNameFilter: true, platformFilter: true, backRestoresFilterAndSelection: true,
            grid, keyboardPlatformFilter: true, typedPlatformFilter: true, earlyViewToggle: true, layoutSwitchesPreserveSelection: true, singleEnterSelectsGame: true, gamepadSearch: true, screenshotUrlsReleased: true, closedReadCancelled: true };
    } finally {
        browser.close();
        if (previousView === null) localStorage.removeItem(viewKey); else localStorage.setItem(viewKey, previousView);
        URL.createObjectURL = originalCreate; URL.revokeObjectURL = originalRevoke;
        document.getElementById('platformDropdownContainer')?.remove();
        if (oldDropdown) platformContainer.appendChild(oldDropdown);
        platformContainer.className = originalFilterClass;
        if (originalFilterStyle === null) platformContainer.removeAttribute('style'); else platformContainer.setAttribute('style', originalFilterStyle);
        keyboard.hideTouchKeyboard(false); cli.reset(); cli.on(); keyboard.clicks_on();
        root.classList.remove('show'); root.style.display = originalDisplay;
    }
}
