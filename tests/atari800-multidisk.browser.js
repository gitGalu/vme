import JSZip from 'jszip';
import { Nostalgist } from 'nostalgist';
import { PlatformManager, SelectedPlatforms } from '../src/platforms/PlatformManager.js';
import { StorageManager } from '../src/storage/StorageManager.js';
import { HistoryManager } from '../src/history/HistoryManager.js';
import { archiveProgramChoices } from '../src/utils/Atari800DiskSets.js';
import { readProgramArchive, extractArchiveProgram, restoreArchiveProgram } from '../src/utils/ArchivePrograms.js';
import { showArchiveProgramPicker } from '../src/components/ArchiveProgramPicker.js';
import { CLI } from '../src/cli/CLI.js';
import { BackupCommand } from '../src/cli/BackupCommand.js';
import { RestoreBackupCommand } from '../src/cli/RestoreBackupCommand.js';

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const waitFor = async predicate => {
    for (let i = 0; i < 300; i++) {
        if (await predicate()) return;
        await new Promise(resolve => setTimeout(resolve, 10));
    }
    throw new Error('Timed out waiting for multi-disk test action.');
};

export async function runAtariMultidiskTests(storage, db) {
    const passed = [];
    const zip = new JSZip();
    const versions = ['v1', 'v2'].flatMap(v => [1, 2].map(s => `Polar Pierre (${v},s${s}).atr`));
    const ultima = ['A', 'B'].map(s => `Ultima V _ side ${s}.atr`);
    const publisher = ['A', 'B'].map(s => `Polar Pierre _ Datamost _ side ${s}.atr`);
    for (const name of [...versions, ...ultima, ...publisher]) zip.file(name, name);
    zip.file('other.xex', 'standalone'); zip.file('README.txt', 'ignore');
    const zipBlob = new Blob([await zip.generateAsync({ type: 'uint8array' })]);
    const archive = await readProgramArchive(zipBlob, SelectedPlatforms.A800.archive_program_extensions);
    const choices = archiveProgramChoices(archive.paths);
    assert(choices.length === 5 && choices.filter(c => c.members?.length === 2).length === 4, 'ZIP lists four distinct disk sets and one standalone program');
    const pickingCli = new CLI();
    const picking = showArchiveProgramPicker(choices, 'mixed.zip', pickingCli, { hideTouchKeyboard() {} });
    const row = [...document.querySelectorAll('#cors_results .corsrow')].find(row => row.textContent.includes('(v2)'));
    assert(row?.textContent.includes('[2 disks]'), 'CLI labels identify version and disk count');
    row.click(); row.click();
    assert(await picking === versions[2], 'CLI selects a complete version by its first member');
    const secondVersion = await extractArchiveProgram(archive, zipBlob, 'mixed.zip', versions[3]);
    assert(same(secondVersion.selectedNames, versions.slice(2)) && secondVersion.archiveSelection.entryPath === versions[2], 'Selecting either side produces the canonical version-specific set');
    const bundled = await JSZip.loadAsync(await secondVersion.saveBlob.arrayBuffer());
    assert(Object.values(bundled.files).filter(f => !f.dir).length === 3, 'Save bundle contains only playlist and selected two sides');
    const restored = await restoreArchiveProgram(secondVersion.saveBlob, secondVersion.archiveSelection, 1);
    assert(restored.diskIndex === 1 && same(restored.selectedNames, versions.slice(2)), 'Bundle restores original disk names and current index');
    assert(await restored.launchFiles[2].fileContent.text() === versions[3], 'Bundle restores the second side without the original ZIP');
    const again = await extractArchiveProgram(archive, zipBlob, 'mixed.zip', versions[2]);
    assert(same([...new Uint8Array(await secondVersion.saveBlob.arrayBuffer())], [...new Uint8Array(await again.saveBlob.arrayBuffer())]), 'Choosing either side yields the same saved payload');
    passed.push('Multi-disk ZIP grouping, CLI labels, version isolation and self-contained deterministic bundle');

    let selectedPath = versions[2], choiceCount = 0, launched, shellChoices, prints = [], commands = [], started = false;
    const app = {
        isGamepadLaunch: () => true,
        getGamepadManager: () => ({ setGuiNavigationEnabled() {} }),
        chooseArchiveProgram: async items => { choiceCount++; shellChoices = items; return selectedPath; },
        showArchiveLaunchSettings: async (_, settings) => settings.overrideValues,
        cancelPendingLaunch() {}, toggleScreen() {}, clearCollectionCache() {},
        emulationStarted: () => { started = true; }
    };
    const cli = new Proxy({}, { get: (_, name) => name === 'print' ? line => prints.push(line) : name === 'clear' ? () => { prints = []; } : () => {} });
    const city = [1, 2, 3, 4].map(n => `Alternate Reality the City - Disk ${n}.atr`);
    const files = new Map(city.map(name => [`https://test.invalid/games/${encodeURIComponent(name)}`, new Blob([name])]));
    files.set('/mixed.zip', zipBlob);
    const fetched = [];
    const network = { fetch: async url => {
        const key = String(url); fetched.push(key);
        if (key.includes('.wasm')) return new Response(new Blob(['wasm']));
        assert(files.has(key), `Unexpected download: ${key}`);
        return new Response(files.get(key));
    } };
    const previousUpdate = PlatformManager.prototype.updatePlatform;
    let manager;
    try {
        PlatformManager.prototype.updatePlatform = () => {};
        manager = new PlatformManager(app, cli, storage, network, new Proxy({}, { get: () => () => {} }));
    } finally { PlatformManager.prototype.updatePlatform = previousUpdate; }
    manager.setSelectedPlatform(SelectedPlatforms.A800);
    manager.startEmulation = (blob, caption, romName) => { launched = { blob, caption, romName }; };
    const previousConfigure = Nostalgist.configure, previousLaunch = Nostalgist.launch;
    Nostalgist.configure = () => {};
    try {
        manager.loadCorsFile({ root: 'https://test.invalid/', bases: ['games/'], items: city.map(name => [name, 0, encodeURIComponent(name), 0, name]) });
        manager.skipLaunchSettingsPromptOnce();
        await manager.loadRomFileFromUrl([...files.keys()][2], city[2], 'Alternate Reality'); document.body.click();
        const direct = launched.blob;
        assert(same(direct.selectedNames, city) && direct.launchFiles.length === 5, 'Direct images from imported JSON form an ordered four-disk set');
        assert(city.every(name => fetched.includes(`https://test.invalid/games/${encodeURIComponent(name)}`)), 'Every direct disk is downloaded');
        assert(direct.launchFiles[0].fileName === `${city[0].slice(0, -4)}.m3u` && await direct.saveBlob.text() === 'vme_disk_0.atr\nvme_disk_1.atr\nvme_disk_2.atr\nvme_disk_3.atr', 'Direct playlist and aliases are stable when launching disk three');
        const beforeDirect = await db.table('romData').count();
        const bios = SelectedPlatforms.A800.guessBIOS(city[0]), config = SelectedPlatforms.A800.guessConfig(city[0]);
        const directData = { diskNames: city, diskIndex: 2, diskFiles: direct.selectedDiskBlobs.map((blob, i) => ({ name: city[i], launch_name: direct.selectedLaunchNames[i], blob })) };
        await storage.storeState(new Blob(['direct-state']), direct.saveBlob, null, 'atari800', direct.primaryFileName, 'City', true, directData, null, null, null, bios, config);
        directData.diskIndex = 3;
        await storage.storeState(new Blob(['direct-state-later']), direct.saveBlob, null, 'atari800', direct.primaryFileName, 'City', true, directData, null, null, null, bios, config);
        assert(await db.table('romData').count() === beforeDirect + 5, 'Direct savestates deduplicate playlist and each disk');
        const directMeta = (await storage.getAllSaveMeta()).find(meta => meta.program_name === direct.primaryFileName);
        assert(directMeta.m3u_disk_rom_ids.length === 4 && directMeta.m3u_disk_index === 3, 'Quicksave retains all disk references and the latest disk index');
        await storage.storeState(new Blob(['other-game-state']), direct.saveBlob, null, 'atari800', 'Another Game.m3u', 'Other game', true, directData, null, null, null, bios, config);
        assert((await storage.getAllSaveMeta()).some(meta => meta.id === directMeta.id && meta.program_name === direct.primaryFileName), 'Games with identical generated playlists retain separate quicksaves');
        const differentDisks = { ...directData, diskFiles: directData.diskFiles.map((disk, i) => i === 3 ? { ...disk, blob: new Blob(['different fourth disk']) } : disk) };
        await storage.storeState(new Blob(['different-set-state']), direct.saveBlob, null, 'atari800', 'Another Game.m3u', 'Other disk set', true, differentDisks, null, null, null, bios, config);
        assert((await storage.getAllSaveMeta()).filter(meta => meta.program_name === 'Another Game.m3u' && meta.is_quicksave).length === 2, 'Sets with the same title and playlist but different disk bytes retain separate quicksaves');

        await manager.loadRomFileFromUrl('/mixed.zip', 'mixed.zip', 'Mixed'); document.body.click();
        assert(shellChoices.length === 5 && same(launched.blob.selectedNames, versions.slice(2)), 'SHELL chooser selects a version-specific set');
        assert(prints.includes(`- ${versions[2]}`) && prints.includes(`- ${versions[3]}`) && !prints.some(line => /^- .*mixed\.zip/.test(line)), 'Program loaded lists both sides without ZIP name');
        assert(HistoryManager.getAll().some(entry => same(entry.archiveSelection?.diskPaths, versions.slice(2))), 'History records the complete selected set');
        const beforeLocal = HistoryManager.getAll().length, lastBeforeLocal = StorageManager.getValue('atari800.LAST_FILE');
        await manager.loadLocalRom(zipBlob, 'local.zip'); document.body.click();
        assert(HistoryManager.getAll().length === beforeLocal && StorageManager.getValue('atari800.LAST_FILE') === lastBeforeLocal, 'Local multi-disk ZIP stays out of history and LAST');
        const bundleData = { diskNames: secondVersion.selectedNames, diskIndex: 1, diskFiles: secondVersion.selectedDiskBlobs.map((blob, i) => ({ name: secondVersion.selectedNames[i], launch_name: secondVersion.selectedLaunchNames[i], blob })) };
        const beforeBundle = await db.table('romData').count();
        await storage.storeState(new Blob(['bundle-state']), secondVersion.saveBlob, null, 'atari800', secondVersion.programName, 'Polar v2', false, bundleData, null, null, null, bios, { ...config, _vmeArchive: secondVersion.archiveSelection });
        assert(await db.table('romData').count() === beforeBundle + 1, 'Bundle saves do not duplicate embedded disk images in IndexedDB');
        const bundleMeta = (await storage.getAllSaveMeta()).find(meta => meta.program_name === versions[2]);
        assert(bundleMeta.m3u_disk_index === 1 && !bundleMeta.m3u_disk_rom_ids, 'Bundle stores current index without redundant disk references');
        passed.push('Direct JSON multi-disk launch, SHELL archive selection, saved disk references and payload deduplication');

        const bundleSave = await storage.getSaveData(bundleMeta.id);
        const choicesBeforeRestore = choiceCount;
        await manager.loadState('atari800', bundleSave.save_data, bundleSave.rom_data, bundleSave.program_name, bundleSave.caption, null, bundleSave.m3u_disks, bundleSave.m3u_disk_index, null, null, null, null, null, bundleSave.launch_bios, bundleSave.launch_core_config); document.body.click();
        assert(choiceCount === choicesBeforeRestore && launched.blob.diskIndex === 1 && same(launched.blob.selectedNames, versions.slice(2)), 'Archive savestate restores without chooser and preserves selected disk');
        let launchOptions;
        Nostalgist.launch = async options => {
            launchOptions = options;
            const instance = { sendCommand: command => commands.push(command) };
            await options.onLaunch(instance);
            return instance;
        };
        await PlatformManager.prototype.startEmulation.call(manager, launched.blob, launched.caption, launched.romName);
        assert(started && launchOptions.rom.length === 3 && same(manager.getCurrentM3uDisks(), versions.slice(2)) && manager.getCurrentM3uDiskIndex() === 1, 'Launch publishes disk list and index for desktop, touch and SHELL controls');
        assert(same(commands, ['DISK_EJECT_TOGGLE', 'DISK_NEXT', 'DISK_EJECT_TOGGLE']), 'Restoring Atari state synchronises libretro disk control by eject/select/insert');
        passed.push('Archive savestate restore, frontend disk controls and RetroArch disk-index synchronisation');

        const countBeforeBackup = (await storage.getAllSaveMeta()).length;
        let backupBlob;
        const backup = new BackupCommand(storage); backup.set_cli(cli);
        const anchorClick = HTMLAnchorElement.prototype.click;
        HTMLAnchorElement.prototype.click = function () { fetch(this.href).then(r => r.blob()).then(blob => { backupBlob = blob; }); };
        try { backup.process_input([], true); await waitFor(() => backupBlob); } finally { HTMLAnchorElement.prototype.click = anchorClick; }
        const backupZip = await JSZip.loadAsync(await backupBlob.arrayBuffer());
        assert(Object.keys(backupZip.files).filter(name => /\/disk_data_\d+\.bin$/.test(name)).length === 9, 'Backup includes all referenced direct disk images and distinct disk variants');
        await db.table('saveMeta').clear(); await db.table('saveData').clear(); await db.table('romData').clear();
        const restore = new RestoreBackupCommand(storage); restore.set_cli(cli);
        const inputClick = HTMLInputElement.prototype.click;
        HTMLInputElement.prototype.click = function () { Object.defineProperty(this, 'files', { value: [backupBlob] }); this.onchange({ target: this }); };
        try { restore.process_input([], true); await waitFor(async () => (await storage.getAllSaveMeta()).length === countBeforeBackup); } finally { HTMLInputElement.prototype.click = inputClick; }
        const metas = await storage.getAllSaveMeta();
        const directRestored = await storage.getSaveData(metas.find(meta => meta.program_name === direct.primaryFileName).id);
        assert(directRestored.m3u_disk_index === 3 && directRestored.m3u_disk_rom_ids.length === 4, 'Backup restores direct disk references and current index');
        for (let i = 0; i < 4; i++) assert(await (await storage.getRomData(directRestored.m3u_disk_rom_ids[i])).rom_data.text() === city[i], 'Restored reference points to correct disk bytes');
        await manager.loadState('atari800', directRestored.save_data, directRestored.rom_data, directRestored.program_name, directRestored.caption, null, directRestored.m3u_disks, directRestored.m3u_disk_index, directRestored.m3u_disk_rom_ids, directRestored.m3u_disk_launch_names, null, null, null, directRestored.launch_bios, directRestored.launch_core_config); document.body.click();
        assert(launched.blob.diskIndex === 3 && launched.blob.launchFiles.length === 5 && await launched.blob.saveBlob.text() === await direct.saveBlob.text(), 'Direct saved set restores from local references with a stable payload');
        const bundleRestored = await storage.getSaveData(metas.find(meta => meta.program_name === versions[2]).id);
        assert(bundleRestored.m3u_disk_index === 1 && same(bundleRestored.m3u_disks, versions.slice(2)), 'Backup restores bundle disk names and index');
        passed.push('Backup/restore retains all direct disk payloads, bundle names and active disk indices');
    } finally { Nostalgist.configure = previousConfigure; Nostalgist.launch = previousLaunch; }
    return passed;
}
