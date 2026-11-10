import { VME } from '../src/VME.js';
import { StorageManager } from '../src/storage/StorageManager.js';
import { PlatformManager } from '../src/platforms/PlatformManager.js';
import { CollectionBrowser } from '../src/CollectionBrowser.js';
import { GamepadMenu } from '../src/gamepad/GamepadMenu.js';
import { t } from '../src/i18n/shellStrings.js';

const assert = (value, message) => { if (!value) throw new Error(message); };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate, message) {
    for (let i = 0; i < 300; i++) {
        if (predicate()) return;
        await wait(20);
    }
    throw new Error(message);
}

// Run from the normal app's main menu in a fresh isolated browser context.
// Uses the real shell, browsers and launch preparation, with mocked storage and core startup.
export async function runShellBrowserLaunchTests() {
    const restore = [];
    const patch = (object, key, value) => {
        const original = object[key];
        restore.push(() => { object[key] = original; });
        object[key] = value;
        return original;
    };
    let menu, collection, app, started = 0, saved = false, releaseRead, rejectRead;
    const canvas = document.createElement('canvas'); canvas.width = 336; canvas.height = 240;
    const screenshot = await new Promise(resolve => canvas.toBlob(resolve));
    const image = canvas.toDataURL();
    const state = { id: 11, platform_id: 'nes', program_name: 'test.nes', caption: 'Test game',
        rom_data_id: 1, rom_data: new Blob(['ROM']), save_data: new Blob(['STATE']), timestamp: 100, screenshot };
    const pad = { index: 0, id: 'Launch test', connected: true, mapping: 'standard', axes: [0, 0, 0, 0],
        buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
    const launchScreen = document.getElementById('gamepad-launch');
    const status = document.getElementById('gamepadLaunchStatus');
    const deferredRead = () => new Promise((resolve, reject) => { releaseRead = resolve; rejectRead = reject; });
    const results = [];
    try {
        const originalOpen = patch(GamepadMenu.prototype, 'open', function (...args) {
            menu = this; return originalOpen.apply(this, args);
        });
        const originalCollection = patch(CollectionBrowser.prototype, 'open', function (...args) {
            collection = this; return originalCollection.apply(this, args);
        });
        const originalBegin = patch(VME.prototype, 'beginBrowserLaunch', function (...args) {
            app = this; return originalBegin.apply(this, args);
        });
        patch(StorageManager.prototype, 'getCollectionItems', async () => [1, 2, 3].map(id => ({
            id, rom_data_id: id, platform_id: 'nes', rom_name: `test${id}.nes`, title: id === 1 ? 'Test game' : `Other ${id}`, image,
        })));
        patch(StorageManager.prototype, 'getAllSaveMeta', async () => saved ? [{ ...state }] : []);
        patch(StorageManager.prototype, 'getRomData', deferredRead);
        patch(StorageManager.prototype, 'getSaveData', deferredRead);
        patch(StorageManager.prototype, 'checkFiles', async () => [[], [], null]);
        patch(PlatformManager.prototype, 'startEmulation', async () => { started++; });
        patch(navigator, 'getGamepads', () => [pad]);
        await wait(100);
        pad.buttons[0].pressed = true;
        await until(() => menu?.isOpen(), 'Shell did not open');
        pad.buttons[0].pressed = false;
        await wait(100);

        const select = label => {
            for (let i = 0; i < 20; i++) {
                if (menu.getVrSnapshot().rows.some(row => row.focused && row.label === label)) {
                    menu.activate(); return;
                }
                menu.navigate(1, 0);
            }
            throw new Error(`Missing menu item: ${label}`);
        };
        const enter = () => {
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
            document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
        };
        for (const source of ['collection', 'continue', 'save', 'failed-read', 'failed-preparation']) {
            saved = source === 'continue' || source === 'save';
            releaseRead = rejectRead = null;
            if (source === 'save') {
                select(t('menu.saves'));
                await until(() => !document.getElementById('saveBrowserUiOpen').classList.contains('disabled'), 'Save list not ready');
                enter();
                await until(() => document.getElementById('save-browser').dataset.view === 'game-saves'
                    && !document.getElementById('saveBrowserUiLoad').classList.contains('disabled'), 'Save cards not ready');
                enter();
            } else {
                select(t('menu.collections'));
                await until(() => document.querySelector('#collection-grid .collection-grid-cell.focused')
                    && !document.getElementById('collectionBrowserUiLoad').classList.contains('disabled'), 'Collection not ready');
                collection.activateCurrentGame();
                if (source === 'continue') collection.selectLaunchChoice();
            }
            await until(() => releaseRead, 'Browser did not request data');
            assert(launchScreen.classList.contains('visible') && !launchScreen.classList.contains('awaiting')
                && status.textContent === t('launch.loading'), `${source}: loading must appear before storage resolves`);
            assert(document.getElementById('gamepadLaunchTitle').textContent === 'Test game', `${source}: wrong launch title`);
            assert(!document.querySelector('#collection-grid .zoom-out'), 'Shell launch must not animate away just one card');
            assert(!app.getGamepadManager().guiNavigationEnabled, 'Cards must not receive pad navigation during loading');

            let originalLoad;
            if (source === 'failed-preparation') {
                originalLoad = patch(PlatformManager.prototype, 'loadRomFromCollection', async () => { throw new Error('Preparation failed'); });
            }
            if (source === 'failed-read') rejectRead(new Error('Storage failed'));
            else releaseRead(source === 'continue' || source === 'save' ? { ...state } : { rom_data: state.rom_data });
            if (source.startsWith('failed')) {
                await until(() => !launchScreen.classList.contains('visible'), 'Failed launch left the loading screen open');
                if (originalLoad) PlatformManager.prototype.loadRomFromCollection = originalLoad;
                assert(app.getGamepadManager().guiNavigationEnabled, 'Failure must restore browser navigation');
                assert(document.querySelector('#collection-grid .collection-grid-cell.focused'), 'Failure lost the selected card');
                collection.close();
            } else {
                await until(() => launchScreen.classList.contains('awaiting'), `${source}: missing press-to-start prompt`);
                assert(status.textContent === t('launch.press'), `${source}: wrong ready message`);
                const before = started;
                document.body.click();
                await until(() => started === before + 1, `${source}: confirmation did not start the game`);
                assert(app.isGamepadLaunch(), 'Launch lost its shell origin');
                assert(!app.getGamepadManager().browserActive, 'Browser navigation remained active after confirmation');
            }
            results.push(source);
            app.abortBrowserLaunch();
            app.toggleScreen(VME.CURRENT_SCREEN.MENU);
            await until(() => menu.isOpen(), 'Did not return to shell');
        }
        return { passed: results, starts: started };
    } finally {
        app?.abortBrowserLaunch();
        menu?.requestCloseToCli();
        restore.reverse().forEach(undo => undo());
    }
}
