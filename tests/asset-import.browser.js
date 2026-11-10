import JSZip from 'jszip';
import { GamepadMenu } from '../src/gamepad/GamepadMenu.js';
import { GamepadKeyboard } from '../src/gamepad/GamepadKeyboard.js';
import { PlatformManager } from '../src/platforms/PlatformManager.js';
import { t } from '../src/i18n/shellStrings.js';

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate) {
    for (let i = 0; i < 200; i++) {
        if (predicate()) return;
        await wait(20);
    }
    throw new Error('Timed out waiting for import UI');
}
async function zipBlob(files) {
    const zip = new JSZip();
    for (const [path, value] of Object.entries(files)) zip.file(path, value);
    return zip.generateAsync({ type: 'blob' });
}

// Run in the normal app's main menu, in a fresh isolated browser context.
// Import methods and fetch are mocked for the shell checks; importer storage is in memory.
export async function runAssetImportTests() {
    const original = {
        open: GamepadMenu.prototype.open,
        getGamepads: navigator.getGamepads,
        fetch: window.fetch,
        dependencies: PlatformManager.prototype.loadVmeImportFile,
        collection: PlatformManager.prototype.loadCollectionFile,
    };
    let menu, failImport = false, missing = false;
    const requests = [], imports = [];
    const pad = { id: 'Import test', index: 0, connected: true, mapping: 'standard',
        axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
    const results = [];
    try {
        GamepadMenu.prototype.open = function (...args) { menu = this; return original.open.apply(this, args); };
        navigator.getGamepads = () => [pad];
        await wait(100);
        pad.buttons[0].pressed = true;
        await until(() => menu?.isOpen());
        pad.buttons[0].pressed = false;
        await wait(100);
        window.fetch = async url => {
            requests.push(String(url));
            return new Response('test bundle', { status: missing ? 404 : 200 });
        };
        for (const [method, kind] of [['loadVmeImportFile', 'dependencies'], ['loadCollectionFile', 'collection']]) {
            PlatformManager.prototype[method] = async (blob, options) => {
                imports.push({ kind, options, size: blob.size });
                return failImport ? { ok: false, error: { message: 'Invalid archive' } } : { ok: true };
            };
        }
        const select = label => {
            for (let i = 0; i < 20; i++) {
                if (menu.getVrSnapshot().rows.some(row => row.focused && row.label === label)) {
                    menu.activate(); return;
                }
                menu.navigate(1, 0);
            }
            throw new Error(`Menu item missing: ${label}`);
        };
        const key = character => {
            const row = GamepadKeyboard.ROWS.findIndex(keys => keys.includes(character));
            const col = GamepadKeyboard.ROWS[row].indexOf(character);
            const focus = menu.getVrSnapshot().keyboard.focus;
            menu.navigate(row - focus.row, 0);
            menu.navigate(0, col - menu.getVrSnapshot().keyboard.focus.col);
            menu.activate();
        };
        const submit = async code => {
            menu.close();
            menu.open();
            select(t('menu.settings'));
            select(t('settings.enterCode'));
            for (const character of code) key(character);
            key('↵');
            await until(() => menu.getVrSnapshot().rows.length > 0);
        };
        for (const [code, filename, kind] of [
            ['IA', 'vme_import.zip', 'dependencies'],
            ['A8', 'a8_vme_collection.zip', 'collection'],
            ['COL', 'vme_collection.zip', 'collection'],
        ]) {
            await submit(code);
            const expected = new URL(`assets/${filename}`, new URL(import.meta.env.BASE_URL, location.origin)).href;
            assert(requests.at(-1) === expected, `${code}: archive must use the app base path`);
            assert(imports.at(-1).kind === kind && imports.at(-1).options.reportToCli === false,
                `${code}: correct importer without CLI reload listeners`);
            assert(menu.getVrSnapshot().isNotice === 'ok', `${code}: success notice`);
        }
        failImport = true;
        await submit('A8');
        assert(menu.getVrSnapshot().isNotice === 'error', 'Rejected archive must not show success');
        const before = imports.length;
        missing = true;
        await submit('IA');
        assert(menu.getVrSnapshot().isNotice === 'error' && imports.length === before,
            'Missing private archive must show an error without invoking the importer');
        const fetched = requests.length;
        await submit('UNKNOWN');
        assert(menu.getVrSnapshot().isNotice === 'error' && requests.length === fetched,
            'Unknown code must not fetch an archive');
        results.push('Shell: IA/A8/COL, base path, quiet import, failed import, HTTP 404, unknown code');
    } finally {
        pad.buttons[0].pressed = false;
        menu?.requestCloseToCli();
        GamepadMenu.prototype.open = original.open;
        navigator.getGamepads = original.getGamepads;
        window.fetch = original.fetch;
        PlatformManager.prototype.loadVmeImportFile = original.dependencies;
        PlatformManager.prototype.loadCollectionFile = original.collection;
    }

    const cliCalls = [], stored = [], collections = [];
    let rejectStorage = false;
    const cli = Object.fromEntries(['print', 'print_progress', 'message', 'guru'].map(method =>
        [method, (...args) => cliCalls.push({ method, args })]));
    cli.set_default_handler = () => {};
    const updatePlatform = PlatformManager.prototype.updatePlatform;
    let manager;
    try {
        PlatformManager.prototype.updatePlatform = () => {};
        manager = new PlatformManager({}, cli, {
            storeFile: async (key, data) => {
                await wait(10);
                if (rejectStorage) throw new Error('Storage unavailable');
                stored.push({ key, data });
            },
            checkFiles: async () => [[], []],
            storeCollection: async (...args) => { collections.push(args); return true; },
        }, {}, {});
    } finally { PlatformManager.prototype.updatePlatform = updatePlatform; }
    const quiet = { reportToCli: false };
    const bundle = await zipBlob({
        'vme_import.json': JSON.stringify({ platforms: { atari800: { software: 'software.json', dependencies: { os: 'os.rom' } } } }),
        'software.json': JSON.stringify({ root: '/', bases: [''], items: [['Test.xex', 0, 'test.xex']] }),
        'os.rom': 'test ROM',
    });
    assert((await manager.loadVmeImportFile(bundle, quiet)).ok && stored.length === 2,
        'IA success must wait for software directory and dependency storage');
    for (const files of [
        { 'other.txt': 'no manifest' },
        { 'vme_import.json': '{' },
        { 'vme_import.json': JSON.stringify({ platforms: { atari800: { software: 'missing.json' } } }) },
        { 'vme_import.json': JSON.stringify({ platforms: { atari800: { software: 'bad.json' } } }), 'bad.json': '{}' },
        { 'vme_import.json': JSON.stringify({ platforms: { atari800: { software: 'software.json', dependencies: { os: 'missing.rom' } } } }),
            'software.json': JSON.stringify({ root: '/', bases: [''], items: [] }) },
    ]) assert(!(await manager.loadVmeImportFile(await zipBlob(files), quiet)).ok, 'Invalid IA archive must return failure');
    rejectStorage = true;
    assert(!(await manager.loadVmeImportFile(bundle, quiet)).ok, 'Storage failure must not show IA success');
    rejectStorage = false;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const image = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    const collection = await zipBlob({
        'vme_collection.json': JSON.stringify({ id: 'test', name: 'Test', image: 'cover.png', list: [
            { platform_id: 'nes', filename: 'test.nes', file: 'test.nes', image: 'cover.png' },
        ] }),
        'cover.png': image,
        'test.nes': 'test ROM',
    });
    assert((await manager.loadCollectionFile(collection, quiet)).ok && collections.length === 1,
        'Quiet collection import must validate and store the collection successfully');
    assert(!(await manager.loadCollectionFile(await zipBlob({ 'other.txt': 'no manifest' }), quiet)).ok,
        'Invalid collection must return failure');
    assert(cliCalls.length === 0, 'Quiet imports must never display CLI messages or Guru overlays');
    await manager.loadVmeImportFile(bundle);
    assert(cliCalls.some(call => call.method === 'message'), 'CLI imports must retain their completion message');
    results.push('Importers: storage completion, missing/invalid manifests and files, quiet errors, CLI compatibility');
    return results;
}
