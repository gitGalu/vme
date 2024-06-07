import Dexie from 'dexie';
import CryptoJS from 'crypto-js';

export class StorageManager {
    #db;

    static #LS_KEY_PREFIX = "VME_INTERNAL.";
    static #STORE_NAME = "VME";
    static #STORE_VERSION = 2;

    constructor() {
        this.#db = new Dexie(StorageManager.#STORE_NAME);
        this.#db.version(StorageManager.#STORE_VERSION).stores({
            files: "key, data",
            saveMeta: '++id, platform_id, program_name, save_data_id, rom_data_id, timestamp',
            saveData: '++id, save_data',
            romData: '++id, rom_data, hash'
        });
    }

    async #computeHash(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = function (event) {
                const data = event.target.result;
                const wordArray = CryptoJS.lib.WordArray.create(data);
                const hash = CryptoJS.SHA256(wordArray).toString();
                resolve(hash);
            };
            reader.onerror = function (error) {
                reject(error);
            };
            reader.readAsArrayBuffer(blob);
        });
    }

    static storeValue(key, value) {
        localStorage.setItem(StorageManager.#LS_KEY_PREFIX + key, value);
    }

    static clearValue(key) {
        localStorage.removeItem(StorageManager.#LS_KEY_PREFIX + key);
    }

    static getValue(key, defValue) {
        let val = localStorage.getItem(StorageManager.#LS_KEY_PREFIX + key);
        return (val != undefined) ? val : defValue;
    }

    async storeFile(key, data) {
        await this.#db.files.put({ key, data: data });
    }

    async getFile(key) {
        const file = await this.#db.files.where({ key }).first();
        return file ? file.data : null;
    }

    async deleteFile(key) {
        await this.#db.files.where({ key }).delete();
    }

    async checkFiles(platform) {
        return new Promise(async (resolve) => {

            let depsData = {};
            let missingDeps = [];
            if (platform.dependencies) {
                const modifiedDependencies = platform.dependencies.map(dep => ({
                    ...dep,
                    key: platform.platform_id + "." + dep.key
                }));

                for (const dep of modifiedDependencies) {
                    const data = await this.getFile(dep.key);
                    if (data) {
                        depsData[dep.key] = data;
                    } else {
                        missingDeps.push(dep.type);
                    }
                }
            } else {
            }

            const additionalFileKey = platform.platform_id + ".software";
            const additionalFileData = await this.getFile(additionalFileKey) || null;

            resolve([depsData, missingDeps, additionalFileData]);
        });
    }

    async storeState(save_data, rom_data, screenshot, platform_id, program_name) {
        const hash = await this.#computeHash(rom_data);

        try {
            await this.#db.transaction('rw', this.#db.saveMeta, this.#db.saveData, this.#db.romData, async () => {
                const existing = await this.#db.romData.where({ hash }).first();

                let romDataId;
                if (existing == undefined) {
                    romDataId = await this.#db.romData.add({ rom_data: rom_data, hash });
                } else {
                    romDataId = existing.id;
                }

                let saveDataId = await this.#db.saveData.add({ save_data });

                await this.#db.saveMeta.add({
                    platform_id: platform_id,
                    program_name: program_name,
                    screenshot: screenshot,
                    rom_data_id: romDataId,
                    save_data_id: saveDataId,
                    timestamp: Date.now(),
                });
            });
        } catch (error) {
            console.error("Failed to save state:", error);
        }
    }

    async getAllSaveMeta() {
        return this.#db.saveMeta.orderBy('timestamp').reverse().toArray();
    }

    async getSaveData(saveId) {
        const saveMeta = await this.#db.saveMeta.get(saveId);

        if (!saveMeta) {
            throw new Error('Save state not found.');
        }

        const saveData = await this.#db.saveData.get(saveMeta.save_data_id);
        const romData = await this.#db.romData.get(saveMeta.rom_data_id);

        if (!saveData || !romData) {
            throw new Error('Save state or program data is missing.');
        }

        return {
            platform_id: saveMeta.platform_id,
            program_name: saveMeta.program_name,
            save_data: saveData.save_data,
            rom_data: romData.rom_data,
            timestamp: saveMeta.timestamp
        };
    }

    async deleteSave(id) {
        try {
            await this.#db.transaction('rw', this.#db.saveMeta, this.#db.saveData, this.#db.romData, async () => {
                const saveMetaEntry = await this.#db.saveMeta.get(id);
                if (saveMetaEntry) {
                    await this.#db.saveData.where('id').equals(saveMetaEntry.save_data_id).delete();
                    await this.#db.saveMeta.delete(id);

                    let sameRomCount = await this.#db.saveMeta.where('rom_data_id').equals(saveMetaEntry.rom_data_id).count();

                    if (sameRomCount == 0) {
                        await this.#db.romData.where('id').equals(saveMetaEntry.rom_data_id).delete();
                    }
                }
            });
        } catch (error) {
            console.error(`Failed to delete entries with id ${id}:`, error);
        }
    }
}