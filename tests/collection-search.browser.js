import { CollectionBrowser } from '../src/CollectionBrowser.js';

const assert = (value, message) => { if (!value) throw new Error(message); };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate, message) {
    for (let i = 0; i < 250; i++) {
        if (predicate()) return;
        await wait(20);
    }
    throw new Error(message);
}

// Mock storage and launches only: never imports a ROM or changes IndexedDB.
export async function runCollectionSearchTests() {
    const root = document.getElementById('collection-browser');
    assert(!root.classList.contains('show'), 'Start from the main menu in a fresh isolated context');
    const keys = ['BOOT_TO', 'COLLECTION_BROWSER_VIEW', 'COLLECTION_BROWSER_COLLECTION_INDEX', 'COLLECTION_BROWSER_ITEM_INDEX'];
    const saved = keys.map(key => [`VME_INTERNAL.${key}`, localStorage.getItem(`VME_INTERNAL.${key}`)]);
    const originalDisplay = root.style.display;
    const image = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="336" height="240"><rect width="336" height="240" fill="#234650"/></svg>');
    const titles = ['Fred', 'Fred: The Return', 'Łódź Adventure', 'Literal [Test]', ...Array.from({ length: 82 }, (_, i) => `Game ${i + 5}`)];
    const items = titles.map((title, index) => ({ id: index + 1, rom_data_id: index + 1, rom_name: `game-${index + 1}.xex`, title, platform_id: 'atari800', image, credits: '1991, Studio' }));
    const form = document.getElementById('collectionBrowserSearch');
    const input = document.getElementById('collectionBrowserSearchInput');
    const count = document.getElementById('collectionBrowserSearchCount');
    const view = document.getElementById('collectionBrowserUiView');
    let reads = 0, launched = null, launchCount = 0, overlay;
    const gm = {
        clearBrowserNavigation() {}, restoreFocusToButton() {}, hasGamepad: () => false,
        initBrowserNavigation: (_nav, _buttons, _back, _dropdown, value) => { overlay = value; },
    };
    const browser = new CollectionBrowser(
        { getGamepadManager: () => gm, toggleScreen: () => { root.style.display = 'flex'; } },
        { updatePlatform() {}, loadRomFromCollection: (...args) => { launched = args; launchCount++; } },
        {
            getAllSaveMeta: async () => [{ id: 987, rom_data_id: 1, platform_id: 'atari800', timestamp: 1 }],
            getCollectionItems: async () => { reads++; return items.map(item => ({ ...item })); },
            getRomData: async id => ({ rom_data: new Blob([String(id)]) }),
        },
        { reset() {} },
    );
    const key = (value, target = document, options = {}) => {
        target.dispatchEvent(new KeyboardEvent('keydown', { key: value, code: value, bubbles: true, cancelable: true, ...options }));
        target.dispatchEvent(new KeyboardEvent('keyup', { key: value, bubbles: true }));
    };
    const query = async value => {
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await wait(150);
    };
    const cells = () => [...root.querySelectorAll(root.dataset.view === 'grid' ? '.collection-grid-cell' : '.flicking-panel')];
    const activeId = () => root.querySelector(root.dataset.view === 'grid' ? '.collection-grid-cell.focused' : '.flicking-panel.active')?.dataset.id;
    const switchView = async () => {
        const next = root.dataset.view === 'grid' ? 'coverflow' : 'grid';
        view.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        view.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        await until(() => root.dataset.view === next && !view.classList.contains('disabled'), 'View switch did not settle');
    };
    const checks = [];
    try {
        for (const mode of ['grid', 'coverflow']) {
            localStorage.setItem('VME_INTERNAL.COLLECTION_BROWSER_VIEW', mode);
            await browser.open(1, 2);
            await until(() => !view.classList.contains('disabled'), 'Initial view not ready');
            assert(activeId() === '2', 'Initial selection not restored');
            const initialReads = reads;
            key('Enter', document.getElementById('collectionBrowserSearchToggle'));
            await wait(120);
            assert(!launched, 'Enter on the search button must not launch the selected game');
            key('f');
            assert((input.readOnly || document.activeElement === input) && input.value === 'f', 'Typing opens and seeds search');
            await query('  FRED  ');
            assert(count.textContent === '2 / 86' && cells().length === 2, 'Case/space insensitive filter');
            assert(activeId() === '2', 'Filtering preserves a matching selection');
            assert(cells().find(cell => cell.dataset.id === '1').dataset.save === '987', 'Restore metadata stays attached to its game');
            const selected = activeId();
            key('ArrowLeft', input); key('Backspace', input);
            assert(activeId() === selected && root.classList.contains('show'), 'Editing keys must not navigate/close cards');
            await query('lodz');
            assert(cells().length === 1 && cells()[0].dataset.id === '3', 'Polish title searchable without diacritics');
            await query('[test]');
            assert(cells().length === 1 && cells()[0].dataset.id === '4', 'Query treated literally');
            await query('nothing-matches');
            assert(cells().length === 0 && document.getElementById('collectionBrowserEmpty').textContent.includes('No matching'), 'No-result state');
            assert(document.getElementById('collectionBrowserUiLoad').classList.contains('disabled'), 'No-result launch disabled');
            key('Enter', input); key('Enter');
            assert(!launched, 'Empty results never launch');
            key('Escape');
            assert(root.classList.contains('show') && input.value === '' && activeId() === '2', 'Escape clears the filter and restores original selection');
            assert(reads === initialReads, 'Typing/clearing must not re-read collection or screenshots');
            document.getElementById('collectionBrowserSearchToggle').click();
            await query('fred');
            await switchView();
            assert(input.value === 'fred' && cells().length === 2 && count.textContent === '2 / 86', 'Query survives view switch');
            document.getElementById('collectionBrowserSearchClear').click();
            assert(count.textContent === '86 / 86', 'Clear button restores the collection');
            await query('nothing');
            key('Escape');
            assert(cells().length > 0 && activeId() === '2', 'Selection survives clearing after a view switch');
            // Debounced work must not reopen a closed browser.
            input.value = 'pending'; input.dispatchEvent(new Event('input', { bubbles: true }));
            browser.close(); await wait(150);
            assert(input.value === '' && form.hidden && root.querySelectorAll('.collection-grid-cell, .flicking-panel').length === 0, 'Close cancels pending filter and clears results');
            checks.push(mode);
        }
        localStorage.setItem('VME_INTERNAL.COLLECTION_BROWSER_VIEW', 'grid');
        await browser.open(1, 22);
        await until(() => activeId() === '22', 'Scroll restoration fixture not ready');
        const grid = document.getElementById('collection-grid');
        const initialScroll = grid.scrollTop;
        const initialTop = root.querySelector('.collection-grid-cell.focused').getBoundingClientRect().top;
        document.getElementById('collectionBrowserSearchToggle').click();
        await query('game 86');
        document.getElementById('collectionBrowserSearchClear').click();
        assert(activeId() === '22', 'Clearing must restore the original game');
        document.getElementById('collectionBrowserSearchClose').click();
        await wait(100);
        assert(Math.abs(grid.scrollTop - initialScroll) <= 1
            && Math.abs(root.querySelector('.collection-grid-cell.focused').getBoundingClientRect().top - initialTop) <= 1,
        'Closing an already-cleared search must restore the original grid offset');
        browser.close();

        localStorage.setItem('VME_INTERNAL.COLLECTION_BROWSER_VIEW', 'grid');
        await browser.open();
        const pad = buttons => ({ buttons: Array.from({ length: 16 }, (_, index) => ({ pressed: buttons.includes(index) })), axes: [0, 0] });
        const pressPad = button => { overlay.search.handleInput(pad([button])); overlay.search.handleInput(pad([])); };
        pressPad(3);
        assert(!document.getElementById('collectionBrowserSearchKeyboard').hidden && input.readOnly, 'Y opens gamepad keyboard');
        pressPad(0); await wait(150);
        assert(input.value === 'A', 'A types the focused keyboard key');
        pressPad(2);
        assert(document.getElementById('collectionBrowserSearchKeyboard').hidden && !launched, 'X ends typing without launching');
        pressPad(3); // reopen the keyboard after X
        pressPad(3); await wait(150);
        assert(input.value === '', 'Y deletes without leaving search');
        pressPad(1);
        assert(form.hidden && input.value === '', 'B cancels gamepad search');
        browser.close();
        for (const mode of ['grid', 'coverflow']) {
            const open = async () => {
                launched = null;
                localStorage.setItem('VME_INTERNAL.COLLECTION_BROWSER_VIEW', mode);
                await browser.open(1, 1);
                await until(() => !view.classList.contains('disabled'), 'Confirmation fixture not ready');
                document.getElementById('collectionBrowserSearchToggle').click();
            };
            const pending = value => {
                input.value = value;
                input.dispatchEvent(new Event('input', { bubbles: true }));
            };
            // An un-applied no-match query must not launch the previously visible game.
            await open();
            pending('nothing-matches'); key('Enter', input);
            await wait(150);
            assert(!launched && cells().length === 0, 'Pending empty results launched a stale card');
            browser.close();

            await open();
            await query('fred');
            key('ArrowDown', input);
            assert(document.activeElement !== input && activeId() === '1' && !launched, 'Down must transfer to cards without skipping the selected result');
            key('ArrowRight');
            await until(() => activeId() === '2' && !view.classList.contains('disabled'), 'Card arrows did not navigate after Down');
            key('Enter');
            await until(() => launched, 'Card Enter did not launch');
            assert(launched[3] === 'Fred: The Return', 'Card navigation launched the wrong game');
            browser.close();

            // Confirmation during IME composition or held Enter must not launch a card.
            await open();
            await query('fred');
            key('Enter', input, { isComposing: true });
            key('Enter', input, { repeat: true });
            await wait(150);
            assert(!launched, 'Composing/repeated Enter must not launch');
            const before = launchCount;
            pending('return'); // no debounce wait: the one Enter must flush this first
            key('Enter', input);
            await until(() => launched, 'One search Enter did not launch');
            assert(launched[2] === 'game-2.xex' && launched[3] === 'Fred: The Return', 'Search Enter launched a stale result');
            assert(launchCount === before + 1, 'Search Enter launched more than once');
            browser.close();

            // Some mobile keyboards send a native form submit instead of keydown.
            await open();
            const nativeBefore = launchCount;
            pending('return');
            form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
            await until(() => launched, 'Native search submit did not activate the card');
            assert(launched[3] === 'Fred: The Return' && launchCount === nativeBefore + 1, 'Native submit launched a stale/duplicate game');
            browser.close();
        }
        return { views: checks, storageReadsDuringTyping: 0, padKeyboard: true,
            singleEnter: true, downToCards: true, pendingQueries: true, nativeSubmit: true, launchTitle: launched[3] };
    } finally {
        browser.close();
        saved.forEach(([key, value]) => value === null ? localStorage.removeItem(key) : localStorage.setItem(key, value));
        root.classList.remove('show'); root.style.display = originalDisplay;
        document.getElementById('collectionBrowserUi').style.display = '';
    }
}
