import JSZip from 'jszip';
import Dexie from 'dexie';
import { Nostalgist } from 'nostalgist';
import { readProgramArchive, extractArchiveProgram, restoreArchiveProgram, saveGameKey } from '../src/utils/ArchivePrograms.js';
import { showArchiveProgramPicker } from '../src/components/ArchiveProgramPicker.js';
import { StorageManager } from '../src/storage/StorageManager.js';
import { HistoryManager } from '../src/history/HistoryManager.js';
import { PlatformManager, SelectedPlatforms } from '../src/platforms/PlatformManager.js';
import { BackupCommand } from '../src/cli/BackupCommand.js';
import { RestoreBackupCommand } from '../src/cli/RestoreBackupCommand.js';
import { LastCommand } from '../src/cli/LastCommand.js';
import { RecentCommand } from '../src/cli/RecentCommand.js';
import { CLI } from '../src/cli/CLI.js';
import { GamepadMenu } from '../src/gamepad/GamepadMenu.js';
import { runAtariMultidiskTests } from './atari800-multidisk.browser.js';
import { runCliArchiveCancelTest } from './cli-archive-cancel.browser.js';
import { runCliArchiveMenuTest } from './cli-archive-menu.browser.js';
import { runCliSelectionTest } from './cli-selection.browser.js';

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const waitFor = async predicate => {
    for (let i = 0; i < 200; i++) {
        const value = await predicate();
        if (value) return value;
        await new Promise(resolve => setTimeout(resolve, 10));
    }
    throw new Error('Timed out waiting for test action.');
};
const rejects = async (action, message) => { let rejected = false; try { await action(); } catch { rejected = true; } assert(rejected, message); };
const makeZip = async files => {
    const zip = new JSZip();
    for (const [name, data] of Object.entries(files)) zip.file(name, data, { date: new Date('1980-01-01T00:00:00Z') });
    return new Blob([await zip.generateAsync({ type: 'uint8array' })]);
};

export async function runArchiveTests() {
    assert(!(await indexedDB.databases()).some(db => db.name === 'VME'), 'Use a fresh isolated browser context; VM/E data already exists.');
    const passed = [];
    const platform = SelectedPlatforms.A800;
    const zipBlob = await makeZip({
        'z/game.xex': 'Z', 'a/game [BASIC] [128K].XEX': 'A', 'README.txt': 'ignore',
        '__MACOSX/ghost.xex': 'ignore', '.hidden.xex': 'ignore', '../escape.xex': 'ignore',
        'set/list.m3u': '#EXTM3U\n../disks/one.atr\n../other/one.atr\n',
        'disks/one.atr': 'disk-one', 'other/one.atr': 'disk-two'
    });
    const archive = await readProgramArchive(zipBlob, platform.archive_program_extensions);
    assert(JSON.stringify(archive.paths) === JSON.stringify(['a/game [BASIC] [128K].XEX', 'disks/one.atr', 'other/one.atr', 'set/list.m3u', 'z/game.xex']), 'Candidate filtering and deterministic sort');
    await rejects(async () => readProgramArchive(await makeZip({ 'readme.txt': 'none' }), platform.archive_program_extensions), 'No supported files must fail');
    passed.push('ZIP filtering, subdirectories, uppercase extensions, traversal rejection');

    const first = await extractArchiveProgram(archive, zipBlob, 'pack [STEREO].zip', archive.paths[0]);
    const second = await extractArchiveProgram(archive, zipBlob, 'pack [STEREO].zip', 'z/game.xex');
    assert(await first.saveBlob.text() === 'A' && first.saveBlob.size === 1, 'Only selected file is stored');
    const restored = await restoreArchiveProgram(first.saveBlob, first.archiveSelection);
    assert(await restored.launchFiles[0].fileContent.text() === 'A', 'Restore from extracted payload');
    await rejects(() => extractArchiveProgram(archive, zipBlob, 'pack.zip', 'missing.xex'), 'Missing remembered member must fail');
    await rejects(() => extractArchiveProgram(archive, zipBlob, 'pack.zip', archive.paths[0], { archiveHash: 'changed' }), 'Changed archive must fail');
    const guessed = platform.resolveLaunchSettings(first.archiveSelection.entryPath, null, { archiveName: 'pack [STEREO] [1MB].zip' });
    assert(guessed.coreConfig.atari800_system === '130XE (128K)' && guessed.coreConfig.atari800_internalbasic === 'enabled' && guessed.coreConfig.atari800_pokey_stereo === 'enabled', 'Member tags take precedence, outer tags remain fallback');
    passed.push('Selected payload, self-contained restore, remembered member and archive integrity, autoconfig');

    const playlist = await extractArchiveProgram(archive, zipBlob, 'pack.zip', 'set/list.m3u');
    const playlistAgain = await extractArchiveProgram(archive, zipBlob, 'pack.zip', 'set/list.m3u');
    const bundle = await JSZip.loadAsync(await playlist.saveBlob.arrayBuffer());
    assert(Object.keys(bundle.files).length === 3, 'Bundle includes only playlist dependencies');
    assert(JSON.stringify([...new Uint8Array(await playlist.saveBlob.arrayBuffer())]) === JSON.stringify([...new Uint8Array(await playlistAgain.saveBlob.arrayBuffer())]), 'Bundle serialization must be deterministic for deduplication');
    const restoredPlaylist = await restoreArchiveProgram(playlist.saveBlob, playlist.archiveSelection);
    assert(restoredPlaylist.launchFiles.length === 3 && await restoredPlaylist.launchFiles[1].fileContent.text() === 'disk-one' && await restoredPlaylist.launchFiles[2].fileContent.text() === 'disk-two', 'Duplicate basenames retain distinct content');
    const badBlob = await makeZip({ 'bad.m3u': 'missing.atr', 'ok.atr': 'ok' });
    const badArchive = await readProgramArchive(badBlob, platform.archive_program_extensions);
    await rejects(() => extractArchiveProgram(badArchive, badBlob, 'bad.zip', 'bad.m3u'), 'Missing playlist reference must fail');
    passed.push('M3U dependencies, relative paths, duplicate basenames, deterministic minimal bundle');

    const pickerCli = new CLI();
    const keyboard = { showTouchKeyboard() {}, hideTouchKeyboard() {} };
    const picking = showArchiveProgramPicker(archive.paths, 'pack.zip', pickerCli, keyboard);
    assert(document.querySelector('#cors_results .corsrow span.highlight'), 'CLI selection starts highlighted');
    assert(!document.querySelector('.archive-program-modal'), 'ZIP selection uses CLI, not a modal');
    pickerCli.move_selection('down');
    pickerCli.confirm_selection();
    assert(await picking === archive.paths[1], 'CLI arrows and confirmation select exact path');
    const filtering = showArchiveProgramPicker(archive.paths, 'pack.zip', pickerCli, keyboard);
    pickerCli.set_selection_index(archive.paths.length);
    pickerCli.process_input('z');
    assert(document.querySelectorAll('#cors_results .corsrow').length === 2, 'Filtering resets out-of-range selection and retains Cancel');
    pickerCli.process_input('enter');
    assert(await filtering === 'z/game.xex', 'CLI filtering and ENTER select matching file');
    const cancelling = showArchiveProgramPicker(archive.paths, 'pack.zip', pickerCli, keyboard);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert(await cancelling === null && !document.querySelector('.rnd-hint'), 'ESC cancels and cleans up CLI chooser');
    const clearing = showArchiveProgramPicker(archive.paths, 'pack.zip', pickerCli, keyboard);
    pickerCli.reset();
    assert(await clearing === null, 'Touch Clear cancels the pending choice');
    const tapping = showArchiveProgramPicker(archive.paths, 'pack.zip', pickerCli, keyboard);
    const tapRow = document.querySelectorAll('#cors_results .corsrow')[2];
    tapRow.click();
    assert(pickerCli.get_selection_index() === 2, 'First tap highlights CLI row');
    tapRow.click();
    assert(await tapping === archive.paths[2], 'Second tap confirms CLI row');
    const safePicking = showArchiveProgramPicker(['<img src=x>.xex', 'normal.xex'], '<b>pack.zip</b>', pickerCli, keyboard);
    assert(!document.querySelector('#cors_results img') && !document.querySelector('.rnd-hint b'), 'File names and title remain plain text');
    pickerCli.process_input('escape');
    await safePicking;
    passed.push('CLI picker: arrows, ENTER, filtering, ESC, touch Clear, tap selection, safe text');

    const storage = new StorageManager();
    const state = new Blob(['state']);
    const save = (program, quick = false) => storage.storeState(state, program.saveBlob, null, 'atari800', program.programName, program.programName, quick, null, null, null, null, guessed.bios, { ...guessed.coreConfig, _vmeArchive: program.archiveSelection });
    await save(first, true);
    await save(second, true);
    await save(first, true);
    await save(first);
    await save(playlist);
    let metas = await storage.getAllSaveMeta();
    assert(metas.length === 4 && metas.filter(x => x.is_quicksave).length === 2, 'Separate quicksave per member, repeated quicksave replaces itself');
    const db = new Dexie('VME'); await db.open();
    assert(await db.table('romData').count() === 3, 'One copy of each selected payload across saves');
    assert(new Set(metas.map(saveGameKey)).size === 3, 'Save browser identities separate members');
    const newZip = await makeZip({ 'copy.xex': 'A', 'README.txt': 'different zip' });
    const copy = await extractArchiveProgram(await readProgramArchive(newZip, platform.archive_program_extensions), newZip, 'different.zip', 'copy.xex');
    await save(copy);
    assert(await db.table('romData').count() === 3, 'Identical extracted files deduplicate across archives');
    passed.push('IndexedDB deduplication across saves and ZIPs; quicksave and save browser isolation');

    // Exercise backup/restore through public CLI actions, intercepting browser file pick/download.
    const cli = new Proxy({}, { get: () => () => {} });
    const backup = new BackupCommand(storage); backup.set_cli(cli);
    const anchorClick = HTMLAnchorElement.prototype.click;
    let backupBlob = null;
    HTMLAnchorElement.prototype.click = function () { fetch(this.href).then(response => response.blob()).then(blob => { backupBlob = blob; }); };
    try { backup.process_input([], true); await waitFor(() => backupBlob); } finally { HTMLAnchorElement.prototype.click = anchorClick; }
    const backupZip = await JSZip.loadAsync(await backupBlob.arrayBuffer());
    const backupStates = Object.keys(backupZip.files).filter(name => /\/save_.*\.json$/.test(name));
    assert(backupStates.length === 5, 'Backup retains all states even if timestamps collide');
    await db.table('saveMeta').clear(); await db.table('saveData').clear(); await db.table('romData').clear();
    const restore = new RestoreBackupCommand(storage); restore.set_cli(cli);
    const inputClick = HTMLInputElement.prototype.click;
    HTMLInputElement.prototype.click = function () { Object.defineProperty(this, 'files', { value: [backupBlob] }); this.onchange({ target: this }); };
    try { restore.process_input([], true); await waitFor(async () => (await storage.getAllSaveMeta()).length === 5); } finally { HTMLInputElement.prototype.click = inputClick; }
    const afterBackup = await storage.getAllSaveMeta();
    assert(afterBackup.every(meta => meta.launch_core_config?._vmeArchive), 'Backup restores member metadata');
    for (const meta of afterBackup) {
        const data = await storage.getSaveData(meta.id);
        await restoreArchiveProgram(data.rom_data, data.launch_core_config._vmeArchive);
    }
    passed.push('CLI backup/restore with extracted payloads and playlist bundle');

    // Test launch orchestration without running WASM: capture startEmulation and core settings.
    for (const id of ['settings', 'platformLabel', 'cors_query_prefix', 'cors_query', 'cors_results', 'gamepad-menu', 'gamepad-menu-inner']) {
        if (!document.getElementById(id)) { const element = document.createElement('div'); element.id = id; document.body.append(element); }
    }
    let selectedPath = archive.paths[0];
    let shell = true, cancelCount = 0, choiceCount = 0, configMember = null, launched = null, coreOptions = null;
    const app = {
        isGamepadLaunch: () => shell,
        getGamepadManager: () => ({ setGuiNavigationEnabled() {} }),
        chooseArchiveProgram: async () => { choiceCount++; return selectedPath; },
        showArchiveLaunchSettings: async (title, settings) => { configMember = title; return settings.overrideValues; },
        cancelPendingLaunch: () => { cancelCount++; }, toggleScreen() {}
    };
    const previousUpdate = PlatformManager.prototype.updatePlatform;
    PlatformManager.prototype.updatePlatform = () => {};
    const manager = new PlatformManager(app, cli, storage, { fetch: async url => new Response(String(url).includes('.wasm') ? new Blob(['wasm']) : zipBlob) }, new Proxy({}, { get: () => () => {} }));
    PlatformManager.prototype.updatePlatform = previousUpdate;
    manager.setSelectedPlatform(platform);
    manager.startEmulation = (blob, caption, romName) => { launched = { blob, caption, romName }; };
    const configure = Nostalgist.configure;
    Nostalgist.configure = options => { if (options.retroarchCoreConfig) coreOptions = options.retroarchCoreConfig; };
    try {
        HistoryManager.clear();
        manager.skipLaunchSettingsPromptOnce();
        await manager.loadRomFileFromUrl('/pack.zip', 'pack.zip', 'Pack');
        assert(configMember.startsWith(selectedPath) && !Object.keys(coreOptions).some(key => key.startsWith('_')), 'Autoconfig occurs after archive choice, metadata stays out of core options');
        document.body.click();
        assert(launched.romName === selectedPath && await launched.blob.saveBlob.text() === 'A', 'Launch uses selected extracted file');
        assert(HistoryManager.getAll().length === 1 && HistoryManager.getAll()[0].archiveSelection.entryPath === selectedPath, 'Remote selection enters history');
        const last = JSON.parse(StorageManager.getValue('atari800.LAST_FILE'));
        assert(last.archiveSelection.entryPath === selectedPath && last.romName === 'pack.zip', 'LAST remembers archive plus member');
        const lastCommand = new LastCommand(manager); lastCommand.set_cli(cli);
        selectedPath = 'z/game.xex';
        const choicesBeforeLast = choiceCount;
        const lastReady = new Promise(resolve => document.addEventListener('vme:awaiting-launch-gesture', resolve, { once: true }));
        lastCommand.process_input([], true);
        await lastReady; document.body.click();
        assert(choiceCount === choicesBeforeLast + 1 && launched.romName === selectedPath, 'LAST reopens ZIP chooser and launches newly selected member');
        assert(launched.caption === `${selectedPath} · pack.zip`, 'LAST caption names the newly selected member and source ZIP');
        const recent = new RecentCommand(manager); recent.set_cli(cli);
        await recent.process_selection({ data: '/pack.zip', romName: 'pack.zip', __platformId: 'atari800', __caption: 'Pack', __archiveSelection: first.archiveSelection });
        document.body.click();
        assert(launched.romName === first.archiveSelection.entryPath, 'CLI history replays recorded member');
        await manager.loadRomFileFromUrl('/pack.zip', 'pack.zip', 'Pack'); document.body.click();
        assert(HistoryManager.getAll().length === 2, 'Remote members of one ZIP have separate history entries');
        const lastBeforeLocal = StorageManager.getValue('atari800.LAST_FILE');
        await manager.loadLocalRom(zipBlob, 'local.zip'); document.body.click();
        assert(HistoryManager.getAll().length === 2 && StorageManager.getValue('atari800.LAST_FILE') === lastBeforeLocal, 'Local ZIP choice changes neither history nor LAST');
        selectedPath = null;
        await manager.loadLocalRom(zipBlob, 'cancel.zip');
        assert(cancelCount === 1 && HistoryManager.getAll().length === 2, 'Cancelling does not record a launch');
        const data = await storage.getSaveData(afterBackup.find(meta => meta.launch_core_config._vmeArchive.entryPath === archive.paths[0]).id);
        await manager.loadState(data.platform_id, data.save_data, data.rom_data, data.program_name, data.caption, null, null, null, null, null, null, null, null, data.launch_bios, data.launch_core_config);
        document.body.click();
        assert(launched.romName === archive.paths[0] && await launched.blob.saveBlob.text() === 'A', 'Saved launch restores selected payload without source ZIP or chooser');
        await manager.loadState('atari800', state, zipBlob, 'legacy.zip', 'Legacy', null, null, null, null, null, null, null, null, guessed.bios, guessed.coreConfig); document.body.click();
        assert(launched.blob === zipBlob, 'Legacy ZIP savestate keeps original launch behavior');
        assert(!SelectedPlatforms.Amiga.archive_program_extensions && !SelectedPlatforms.A5200.archive_program_extensions, 'Only Atari 800 opts in');
    } finally { Nostalgist.configure = configure; }
    passed.push('Launch integration: selected autoconfig, CLI LAST/history, local exclusion, cancellation, new and legacy restores, platform opt-in');

    const menu = new GamepadMenu();
    menu.setRootView(() => ({ title: 'Root', items: [] }));
    menu.open();
    let backed = false;
    menu.pushView({ title: 'Archive', items: [], onBack: () => { backed = true; } });
    menu.back(); assert(backed, 'Gamepad Back invokes pending chooser cancellation'); menu.close();
    passed.push('Gamepad chooser Back callback');
    passed.push(await runCliArchiveCancelTest());
    passed.push(runCliSelectionTest());
    passed.push(await runCliArchiveMenuTest());
    passed.push(...await runAtariMultidiskTests(storage, db));
    db.close();
    return { passed: passed.length, cases: passed };
}
