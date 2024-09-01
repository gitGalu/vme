import Dexie from 'dexie';
import CryptoJS from 'crypto-js';
import { Debug } from '../Debug.js';

export class StorageManager {
    #db;

    static #LS_KEY_PREFIX = "VME_INTERNAL.";
    static #STORE_NAME = "VME";

    constructor() {
        this.#db = new Dexie(StorageManager.#STORE_NAME);

        this.#db.version(2).stores({
            files: "key, data",
            saveMeta: '++id, platform_id, program_name, save_data_id, rom_data_id, timestamp',
            saveData: '++id, save_data',
            romData: '++id, rom_data, hash'
        });

        this.#db.version(3).stores({
            files: "key, data",
            saveMeta: '++id, platform_id, program_name, save_data_id, rom_data_id, timestamp',
            saveData: '++id, save_data',
            romData: '++id, rom_data, hash, data_type',
            collectionMeta: '++id, collection_unique_name, collection_title, collection_image',
            collectionItemData: '++id, collection_id, platform_id, title, credits, description, image, rom_name, rom_data_id, rom_url, launched'
        }).upgrade(tx => {
            return tx.table('romData').toCollection().modify(item => {
                item.data_type = 'base64';
            });
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
        if (Debug.isEnabled()) {
            Debug.updateMessage('load', 'Storing file');
        }

        await this.#db.files.put({ key, data: data });
    }

    async getFile(key) {
        const file = await this.#db.files.where({ key }).first();
        return file ? file.data : null;
    }

    async deleteFile(key) {
        Debug.updateMessage('load', 'Deleting file');

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

    async storeCollection(collection_unique_name, collection_title, collection_image, items) {
        await this.deleteAllCollections();
        const precomputedItems = [];
        for (const item of items) {
            const hash = await this.#computeHash(item.file);
            const itemImageB64 = await this.blobToBase64(item.image);
            const existing = await this.#db.romData.where({ hash }).first();
            precomputedItems.push({ item, hash, existing, itemImageB64 });
        }

        try {
            await this.#db.transaction('rw', this.#db.collectionMeta, this.#db.collectionItemData, this.#db.romData, async () => {
                const collectionId = await this.#db.collectionMeta.add({
                    collection_unique_name: collection_unique_name,
                    collection_title: collection_title,
                    collection_image: collection_image
                });

                for (const { item, hash, existing, itemImageB64 } of precomputedItems) {
                    let romDataId;
                    if (!existing) {
                        romDataId = await this.#db.romData.add({ rom_data: item.file, hash, data_type: 'blob' });
                    } else {
                        romDataId = existing.id;
                    }

                    await this.#db.collectionItemData.add({
                        collection_id: collectionId,
                        platform_id: item.platform_id,
                        title: item.title,
                        credits: item.credits,
                        description: item.description,
                        image: itemImageB64,
                        rom_name: item.filename,
                        rom_data_id: romDataId,
                        launched: false
                    });
                }
            });
            return true;
        } catch (error) {
            console.error("Failed to save collection:", error);
            return false;
        }
    }

    async getCollectionItems() {
        const collectioneDataArray = await this.#db.collectionItemData.toArray();
        return collectioneDataArray.map(item => {
            if (item.screenshot) {
                item.collection_id = item.id;
                item.name = item.collection_name;
                item.image = this.base64ToBlob(item.collection_image);
            }
            return item;
        });
    }

    async getCollections() {
        const collectioneMetaArray = await this.#db.collectionMeta.toArray();
        return collectioneMetaArray.map(item => {
            if (item.screenshot) {
                item.collection_id = item.id;
                item.name = item.collection_name;
                item.image = this.base64ToBlob(item.collection_image);
            }
            return item;
        });
    }

    async storeState(save_data, rom_data, screenshot, platform_id, program_name) {
        const hash = await this.#computeHash(rom_data);

        const screenshotFix = await this.#fixScreenshot(platform_id, screenshot);
        const screenshotB64 = await this.blobToBase64(screenshotFix);
        const romB64 = rom_data;
        const saveB64 = await this.blobToBase64(save_data);

        try {
            await this.#db.transaction('rw', this.#db.saveMeta, this.#db.saveData, this.#db.romData, async () => {
                const existing = await this.#db.romData.where({ hash }).first();

                let romDataId;
                if (existing == undefined) {
                    romDataId = await this.#db.romData.add({ rom_data: romB64, hash, data_type: 'blob' });
                } else {
                    romDataId = existing.id;
                }

                let saveDataId = await this.#db.saveData.add({ save_data: saveB64 });

                await this.#db.saveMeta.add({
                    platform_id: platform_id,
                    program_name: program_name,
                    screenshot: screenshotB64,
                    rom_data_id: romDataId,
                    save_data_id: saveDataId,
                    timestamp: Date.now(),
                });
            });

        } catch (error) {
            console.error("Failed to save state:", error);
        }
    }

    #fixScreenshot(platform_id, blob) {
        if (platform_id != "atari2600" && platform_id != "amiga") {
            return blob;
        }

        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(blob);

            img.onload = () => {
                const width = img.width;
                const height = img.height;
                const ratio = width / height;

                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                if (platform_id == "atari2600" && ratio < 0.8) {
                    canvas.width = width * 2;
                    canvas.height = height;
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                } else if (platform_id == "amiga" && ratio > 2) {
                    canvas.width = width / 2;
                    canvas.height = height;
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                } else {
                    canvas.width = width;
                    canvas.height = height;
                    ctx.drawImage(img, 0, 0);
                }

                canvas.toBlob((newBlob) => {
                    URL.revokeObjectURL(url);
                    resolve(newBlob);
                }, 'image/png');
            };

            img.onerror = (error) => {
                URL.revokeObjectURL(url);
                reject(error);
            };

            img.src = url;
        });
    }

    async blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    base64ToBlob(base64) {
        const byteString = atob(base64.split(',')[1]);
        const mimeString = base64.split(',')[0].split(':')[1].split(';')[0];
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
        }
        return new Blob([ab], { type: mimeString });
    }

    async getAllSaveMeta() {
        const saveMetaArray = await this.#db.saveMeta.orderBy('timestamp').reverse().toArray();
        return saveMetaArray.map(item => {
            if (item.screenshot) {
                item.screenshot = this.base64ToBlob(item.screenshot);
            }
            return item;
        });
    }

    async getRomData(id) {
        const rom = await this.#db.romData.get(id);

        if (rom.data_type == 'base64') {
            rom.rom_data = this.base64ToBlob(rom.rom_data);
        }

        return rom;
    }

    async getSaveData(saveId) {
        const saveMeta = await this.#db.saveMeta.get(saveId);

        if (!saveMeta) {
            throw new Error('Save state not found.');
        }

        const saveData = await this.#db.saveData.get(saveMeta.save_data_id);
        const romData = await this.#db.romData.get(saveMeta.rom_data_id);

        let romBlob;
        if (romData.data_type == 'base64') {
            romBlob = this.base64ToBlob(romData.rom_data);
        } else {
            romBlob = romData.rom_data;
        }

        if (!saveData || !romData) {
            throw new Error('Save state or program data is missing.');
        }

        const saveBlob = this.base64ToBlob(saveData.save_data);

        return {
            platform_id: saveMeta.platform_id,
            program_name: saveMeta.program_name,
            save_data: saveBlob,
            rom_data: romBlob,
            timestamp: saveMeta.timestamp
        };
    }

    async deleteSave(id) {
        try {
            await this.#db.transaction('rw', this.#db.saveMeta, this.#db.saveData, this.#db.collectionItemData, this.#db.romData, async () => {
                const saveMetaEntry = await this.#db.saveMeta.get(id);
                if (saveMetaEntry) {
                    await this.#db.saveData.where('id').equals(saveMetaEntry.save_data_id).delete();
                    await this.#db.saveMeta.delete(id);

                    let saveSameRomCount = await this.#db.saveMeta.where('rom_data_id').equals(saveMetaEntry.rom_data_id).count();

                    let collectionSameRomCount = await this.#db.collectionItemData.where('rom_data_id').equals(saveMetaEntry.rom_data_id).count();

                    if ((collectionSameRomCount + saveSameRomCount) == 0) {
                        await this.#db.romData.where('id').equals(saveMetaEntry.rom_data_id).delete();
                    }
                }
            });
        } catch (error) {
            console.error(`Failed to delete entries with id ${id}:`, error);
        }
    }

    async deleteAllCollections() {
        try {
            await this.#db.transaction('rw', this.#db.collectionMeta, this.#db.collectionItemData, this.#db.saveMeta, this.#db.romData, async () => {
                const allCollections = await this.#db.collectionMeta.toArray();

                for (let collection of allCollections) {
                    const collectionId = collection.id;
                    const collectionItems = await this.#db.collectionItemData.where('collection_id').equals(collectionId).toArray();
                    if (collectionItems.length > 0) {
                        await this.#db.collectionItemData.where('collection_id').equals(collectionId).delete();
                        await this.#db.collectionMeta.delete(collectionId);

                        for (let item of collectionItems) {
                            const romDataId = item.rom_data_id;
                            let saveSameRomCount = await this.#db.saveMeta.where('rom_data_id').equals(romDataId).count();
                            let collectionSameRomCount = await this.#db.collectionItemData.where('rom_data_id').equals(romDataId).count();
                            if ((collectionSameRomCount + saveSameRomCount) == 0) {
                                await this.#db.romData.where('id').equals(romDataId).delete();
                            }
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Failed to delete collections:', error);
        }
    }
}