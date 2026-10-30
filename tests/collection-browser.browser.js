import JSZip from 'jszip';
import Flicking from '@egjs/flicking';
import { CollectionBrowser } from '../src/CollectionBrowser.js';
import { CollectionGrid } from '../src/CollectionGrid.js';

const assert = (value, message) => { if (!value) throw new Error(message); };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate, message) {
    const deadline = performance.now() + 10000;
    while (!predicate()) {
        if (performance.now() > deadline) throw new Error(message);
        await wait(20);
    }
}

async function collectionItems(zipUrl) {
    if (zipUrl) {
        const response = await fetch(zipUrl);
        assert(response.ok, 'Collection ZIP unavailable');
        const zip = await JSZip.loadAsync(await response.arrayBuffer());
        const meta = JSON.parse(await zip.file('vme_collection.json').async('string'));
        return Promise.all(meta.list.map(async (item, index) => ({
            ...item, id: index + 1, rom_data_id: index + 1,
            image: 'data:image/png;base64,' + await zip.file(item.image).async('base64'),
        })));
    }
    return Array.from({ length: 86 }, (_, index) => ({
        id: index + 1, rom_data_id: index + 1, platform_id: 'atari800',
        title: `Game ${index + 1}`, credits: '',
        image: 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="336" height="240"><rect width="336" height="240" fill="#234"/><text x="20" y="120" fill="white">${index}</text></svg>`),
    }));
}

// Run in the normal app, in an isolated browser context. Uses no IndexedDB or ROMs.
export async function runCollectionBrowserTests({ zipUrl, switches = 12 } = {}) {
    assert(!document.getElementById('collection-browser').classList.contains('show'), 'Start from the main menu in a fresh isolated context');
    const items = await collectionItems(zipUrl);
    const keys = ['BOOT_TO', 'COLLECTION_BROWSER_VIEW', 'COLLECTION_BROWSER_COLLECTION_INDEX', 'COLLECTION_BROWSER_ITEM_INDEX'];
    const saved = keys.map(key => [`VME_INTERNAL.${key}`, localStorage.getItem(`VME_INTERNAL.${key}`)]);
    const originalResizeObserver = window.ResizeObserver;
    const originalAppend = Flicking.prototype.append;
    const gridObservers = new Set();
    let appendCalls = 0, itemReads = 0, largestGridAppend = 0;
    const cells = document.querySelector('#collection-grid .collection-grid-cells');
    const mutations = new MutationObserver(records => {
        for (const record of records) largestGridAppend = Math.max(largestGridAppend, record.addedNodes.length);
    });
    mutations.observe(cells, { childList: true });
    window.ResizeObserver = class extends originalResizeObserver {
        observe(target, ...args) {
            if (target.id === 'collection-grid') gridObservers.add(this);
            return super.observe(target, ...args);
        }
        disconnect() {
            gridObservers.delete(this);
            return super.disconnect();
        }
    };
    Flicking.prototype.append = function (...args) {
        appendCalls++;
        return originalAppend.apply(this, args);
    };
    const viewButton = document.getElementById('collectionBrowserUiView');
    const root = document.getElementById('collection-browser');
    const originalDisplay = root.style.display;
    const instance = new CollectionBrowser(
        { getGamepadManager: () => null, toggleScreen: () => { root.style.display = 'flex'; } },
        { updatePlatform: () => {} },
        {
            getAllSaveMeta: async () => { await wait(25); return []; },
            getCollectionItems: async () => {
                itemReads++;
                await wait(25);
                return items.map(item => ({ ...item }));
            },
        },
        { reset: () => {} },
    );
    let standalone;
    const pressView = () => {
        viewButton.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        viewButton.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    };
    try {
        localStorage.setItem('VME_INTERNAL.COLLECTION_BROWSER_VIEW', 'grid');
        await Promise.all(Array.from({ length: 8 }, () => instance.open()));
        assert(gridObservers.size === 1, 'Only the latest pending open may build a grid');
        assert(itemReads === 1, 'Cancelled opens stop before loading collection images');
        instance.close();
        assert(gridObservers.size === 0, 'Close releases every grid observer');

        const cancelled = instance.open();
        instance.close();
        await cancelled;
        assert(gridObservers.size === 0 && cells.childElementCount === 0, 'A closed browser cannot reappear after a database read');

        await instance.open(1, items.at(-1).id);
        assert(cells.childElementCount < items.length, 'Restoring a distant selection keeps the grid virtualized');
        await until(() => cells.querySelector('.focused')?.dataset.id === String(items.at(-1).id), 'Restored focus is visible');
        for (let index = 0; index < switches; index++) {
            const previousMode = root.dataset.view;
            const expectedMode = previousMode === 'grid' ? 'coverflow' : 'grid';
            const beforeAppend = appendCalls;
            pressView();
            for (let repeat = 0; repeat < 5; repeat++) pressView();
            await until(() => root.dataset.view === expectedMode && !viewButton.classList.contains('disabled'), 'View switch did not settle');
            if (expectedMode === 'grid') {
                assert(gridObservers.size === 1, 'Exactly one live grid after switching');
                assert(cells.childElementCount < items.length, 'Grid mounts only a visible window');
                assert(document.querySelector('#collection-flicking .flicking-camera').childElementCount === 0, 'Grid releases the coverflow DOM');
                await until(() => cells.querySelector('.focused')?.dataset.id === String(items.at(-1).id), 'Grid preserves selection across a switch');
            } else {
                assert(gridObservers.size === 0, 'Coverflow releases the grid observer');
                assert(appendCalls - beforeAppend === 1, 'Coverflow appends all panels in one layout pass');
                const panels = root.querySelectorAll('.flicking-panel');
                assert(panels.length === items.length, 'All coverflow items remain available');
                assert([...panels].every(panel => !panel.style.opacity && !panel.style.transition), 'Cards have no separate opacity animations');
                assert(root.querySelector('.flicking-panel.active')?.dataset.id === String(items.at(-1).id), 'Coverflow preserves selection across a switch');
            }
        }
        instance.close();
        await wait(450);
        assert(gridObservers.size === 0 && cells.childElementCount === 0, 'No delayed grid resurrection');
        assert(root.querySelectorAll('.flicking-panel').length === 0, 'Close releases every coverflow image');

        // Scrolling away from focus must not expand the rendered range back to it.
        standalone = new CollectionGrid({ items, onActivate: () => {} });
        standalone.open(items.length - 1);
        document.getElementById('collection-grid').scrollTop = 0;
        document.getElementById('collection-grid').dispatchEvent(new Event('scroll'));
        assert(cells.childElementCount < items.length, 'Manual scroll stays bounded with a distant selection');
        assert(standalone.currentPanel.element.dataset.id === String(items.at(-1).id), 'Offscreen selection keeps its launch metadata');
        standalone.scrollFocusedIntoView(true);
        await until(() => cells.contains(standalone.currentPanel.element), 'The selected cell is reused when scrolled back into view');
        await Promise.resolve();
        assert(largestGridAppend < items.length, 'No transient render of the entire collection');
        return { items: items.length, switches, leakedObservers: 0, largestGridAppend };
    } finally {
        instance.close();
        standalone?.destroy();
        mutations.disconnect();
        window.ResizeObserver = originalResizeObserver;
        Flicking.prototype.append = originalAppend;
        gridObservers.forEach(observer => observer.disconnect());
        saved.forEach(([key, value]) => value === null ? localStorage.removeItem(key) : localStorage.setItem(key, value));
        root.classList.remove('show');
        root.style.display = originalDisplay;
    }
}
