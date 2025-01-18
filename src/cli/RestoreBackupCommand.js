import { CommandBase } from './CommandBase.js';
import JSZip from 'jszip';

export class RestoreBackupCommand extends CommandBase {
    #storageManager;

    constructor(storageManager) {
        super();
        this.#storageManager = storageManager;
    }

    get_keywords() {
        return ['restore'];
    }

    get_help() {
        return ['restore', "Restores save states from a ZIP file"];
    }

    process_input(input, is_enter_pressed) {
        if (!is_enter_pressed) {
            this.cli.clear();
            this.cli.print("Press ENTER to open a ZIP file and restore save states.");
            return;
        } else {
            this.cli.set_loading(true);
            this.#import();
        }
    }

    async #import() {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.onchange = async (e) => {
            const file = e.target.files[0];
            await this.#restoreBackup(file);
        };
        
        fileInput.click();
    }

    async #restoreBackup(zipFile) {
        const zip = await JSZip.loadAsync(zipFile);
        const files = Object.keys(zip.files);
        const platformDirs = new Set(files.map(f => f.split('/')[0]));

        const savestateFiles = files.filter(f => {
            return /(^|\/)save_.*\.json$/.test(f);
        });

        const totalSavestates = savestateFiles.length;
        let processedItems = 0;
        let importedSaves = 0;
        let skippedSaves = 0;
        let failedItems = 0;

        this.cli.print(`Restoring ${totalSavestates} save states...`);

        try {
            const operations = [];

            for (const platformId of platformDirs) {
                const platformFiles = files.filter(f => f.startsWith(platformId + '/'));
                const programs = new Set(platformFiles.map(f => f.split('/')[1]));

                for (const program of programs) {
                    const programPath = `${platformId}/${program}`;
                    const romMetadataFile = zip.file(`${programPath}/rom_data.json`);

                    if (!romMetadataFile) continue;

                    const romMetadata = JSON.parse(await romMetadataFile.async('string'));
                    const romDataFile = zip.file(`${programPath}/rom_data.bin`);
                    const romArrayBuffer = await romDataFile.async('arraybuffer');
                    const romBlob = new Blob([romArrayBuffer]);

                    const saveFiles = platformFiles.filter(f =>
                        f.startsWith(programPath + '/save_') && f.endsWith('.json'));

                    for (const saveMetadataPath of saveFiles) {
                        try {
                            const basePath = saveMetadataPath.replace('.json', '');
                            const saveDataPath = basePath + '.bin';
                            const screenshotPath = basePath + '.png';

                            const saveMetadata = JSON.parse(await zip.file(saveMetadataPath).async('string'));
                            const saveArrayBuffer = await zip.file(saveDataPath).async('arraybuffer');
                            const saveBlob = new Blob([saveArrayBuffer]);

                            let screenshot = null;
                            const screenshotFile = zip.file(screenshotPath);
                            if (screenshotFile) {
                                const screenshotArrayBuffer = await screenshotFile.async('arraybuffer');
                                screenshot = new Blob([screenshotArrayBuffer], { type: 'image/png' });
                            }

                            operations.push({
                                platformId,
                                programName: romMetadata.program_name,
                                romBlob,
                                saveBlob,
                                saveMetadata,
                                screenshot
                            });

                            processedItems++;
                        } catch (error) {
                            this.cli.message(`Failed to prepare save state from ${saveMetadataPath}`);
                            failedItems++;
                        }
                    }
                }
            }

            for (const op of operations) {
                try {
                    const existingSaves = await this.#storageManager.getAllSaveMeta();
                    const existingSave = existingSaves.find(save =>
                        save.platform_id === op.platformId &&
                        save.program_name === op.programName &&
                        save.timestamp === op.saveMetadata.timestamp
                    );

                    if (existingSave) {
                        skippedSaves++;
                        continue;
                    }

                    await this.#storageManager.storeState(
                        op.saveBlob,
                        op.romBlob,
                        op.screenshot,
                        op.platformId,
                        op.programName,
                        op.saveMetadata.caption
                    );

                    importedSaves++;
                } catch (error) {
                    failedItems++;
                }
            }

            let msgs = [];
            msgs.push('&nbsp;');
            msgs.push('Results:');
            msgs.push(`&nbsp;Imported: ${importedSaves}`);
            msgs.push(`&nbsp;&nbsp;Skipped: ${skippedSaves}`);
            msgs.push(`&nbsp;&nbsp;&nbsp;Failed: ${failedItems}`);
            this.cli.message(...msgs);
        } catch (error) {
            this.cli.message('Failed to restore save states.');
            throw error;
        }
    }
}