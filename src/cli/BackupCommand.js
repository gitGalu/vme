import { CommandBase } from './CommandBase.js';
import JSZip from 'jszip';

export class BackupCommand extends CommandBase {
    #storageManager;

    constructor(storageManager) {
        super();
        this.#storageManager = storageManager;
    }

    get_keywords() {
        return ['backup'];
    }

    get_help() {
        return ['backup', "Creates and downloads a ZIP file containing all local save states"];
    }

    process_input(input, is_enter_pressed) {
        if (!is_enter_pressed) {
            this.cli.clear();
            this.cli.print("Press ENTER to create and download a ZIP file containing all local save states.");
            return;
        } else {
            this.cli.set_loading(true);
            this.#export();
        }
    }

    async #export() {
        const backupZip = await this.#createBackup();
        const link = document.createElement('a');
        link.href = URL.createObjectURL(backupZip);
        link.download = 'vme_savestates_backup.zip';

        window.onfocus = () => {
            this.cli.message('');
            window.onfocus = null;
        };

        link.click();
    }

    #sanitizeFilename(filename) {
        return filename.replace(/[^a-z0-9-_]/gi, '_');
    }

    async #createBackup() {
        const zip = new JSZip();
        const saveMetas = await this.#storageManager.getAllSaveMeta();
        let totalItems = saveMetas.length;
        let processedItems = 0;
        let failedItems = 0;

        this.cli.print(`Starting backup of ${totalItems} save states...`);

        for (const saveMeta of saveMetas) {
            try {
                const saveData = await this.#storageManager.getSaveData(saveMeta.id);

                const platformDir = saveData.platform_id;
                const programDir = `${platformDir}/${this.#sanitizeFilename(saveData.program_name)}`;
                const saveTimestamp = new Date(saveData.timestamp).toISOString().replace(/[:]/g, '-');

                const romFilename = `${programDir}/rom_data`;
                if (!zip.file(romFilename)) {
                    const romMetadata = {
                        program_name: saveData.program_name,
                        platform_id: saveData.platform_id,
                        timestamp: saveData.timestamp
                    };
                    zip.file(`${romFilename}.json`, JSON.stringify(romMetadata, null, 2));

                    const romArrayBuffer = await saveData.rom_data.arrayBuffer();
                    zip.file(`${romFilename}.bin`, romArrayBuffer);
                }

                const saveFilename = `${programDir}/save_${saveTimestamp}`;

                const saveMetadata = {
                    timestamp: saveData.timestamp,
                    caption: saveData.caption,
                    program_name: saveData.program_name,
                    platform_id: saveData.platform_id
                };
                zip.file(`${saveFilename}.json`, JSON.stringify(saveMetadata, null, 2));

                const saveArrayBuffer = await saveData.save_data.arrayBuffer();
                zip.file(`${saveFilename}.bin`, saveArrayBuffer);

                if (saveMeta.screenshot) {
                    const screenshotArrayBuffer = await saveMeta.screenshot.arrayBuffer();
                    zip.file(`${saveFilename}.png`, screenshotArrayBuffer);
                }

                processedItems++;
            } catch (error) {
                this.cli.error(`Failed to backup save state (id: ${saveMeta.id})`);
                console.error(error);
                failedItems++;
            }
        }

        const zipBlob = await zip.generateAsync({ type: 'blob' });

        let msgs = [];
        msgs.push('&nbsp;');
        msgs.push('Results:');
        msgs.push(`&nbsp;Processed: ${processedItems}`);
        msgs.push(`&nbsp;&nbsp;&nbsp;&nbsp;Failed: ${failedItems}`);
        this.cli.message(...msgs);

        return zipBlob;
    }
}