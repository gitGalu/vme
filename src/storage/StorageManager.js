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

        this.#db.version(4).stores({
            files: "key, data",
            saveMeta: '++id, platform_id, program_name, save_data_id, rom_data_id, timestamp, caption',
            saveData: '++id, save_data',
            romData: '++id, rom_data, hash, data_type',
            collectionMeta: '++id, collection_unique_name, collection_title, collection_image',
            collectionItemData: '++id, collection_id, platform_id, title, credits, description, image, rom_name, rom_data_id, rom_url, launched'
        });

        this.#db.version(5).stores({
            files: "key, data",
            saveMeta: '++id, platform_id, program_name, save_data_id, rom_data_id, timestamp, caption, is_quicksave',
            saveData: '++id, save_data',
            romData: '++id, rom_data, hash, data_type',
            collectionMeta: '++id, collection_unique_name, collection_title, collection_image',
            collectionItemData: '++id, collection_id, platform_id, title, credits, description, image, rom_name, rom_data_id, rom_url, launched'
        });

        this.#db.version(6).stores({
            files: "key, data",
            saveMeta: '++id, platform_id, program_name, save_data_id, rom_data_id, timestamp, caption, is_quicksave, *m3u_disk_rom_ids',
            saveData: '++id, save_data',
            romData: '++id, rom_data, hash, data_type',
            collectionMeta: '++id, collection_unique_name, collection_title, collection_image',
            collectionItemData: '++id, collection_id, platform_id, title, credits, description, image, rom_name, rom_data_id, rom_url, launched'
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

    async #getOrCreateRomDataIdByHash(hash, blob) {
        const existing = await this.#db.romData.where({ hash }).first();
        if (existing != undefined) {
            return existing.id;
        }
        return await this.#db.romData.add({ rom_data: blob, hash, data_type: 'blob' });
    }

    #extractM3uRomIds(saveMetaEntry) {
        if (!Array.isArray(saveMetaEntry?.m3u_disk_rom_ids)) {
            return [];
        }
        return saveMetaEntry.m3u_disk_rom_ids.filter((id) => Number.isInteger(id));
    }

    async #collectSaveReferencedRomIds() {
        const saveMetaEntries = await this.#db.saveMeta.toArray();
        const referenced = new Set();

        for (const saveMetaEntry of saveMetaEntries) {
            if (Number.isInteger(saveMetaEntry?.rom_data_id)) {
                referenced.add(saveMetaEntry.rom_data_id);
            }
            for (const romId of this.#extractM3uRomIds(saveMetaEntry)) {
                referenced.add(romId);
            }
        }

        return referenced;
    }

    async storeState(save_data, rom_data, screenshot, platform_id, program_name, caption, isQuickSave = false, m3uData = null) {
        const hash = await this.#computeHash(rom_data);

        const screenshotFix = await this.#fixScreenshot(platform_id, screenshot);
        const screenshotB64 = await this.blobToBase64(screenshotFix);
        const romB64 = rom_data;
        const saveB64 = await this.blobToBase64(save_data);
        const diskNames = Array.isArray(m3uData?.diskNames) ? m3uData.diskNames.filter(Boolean) : [];
        const diskIndex = Number.isInteger(m3uData?.diskIndex) ? m3uData.diskIndex : null;
        const diskFiles = Array.isArray(m3uData?.diskFiles)
            ? m3uData.diskFiles.filter((disk) => disk && disk.blob instanceof Blob)
            : [];
        const hasDiskSet = diskNames.length > 1;
        const hasLocalDiskSet = hasDiskSet && diskFiles.length === diskNames.length;
        const diskFileHashes = hasLocalDiskSet
            ? await Promise.all(diskFiles.map((disk) => this.#computeHash(disk.blob)))
            : [];

        try {
            await this.#db.transaction('rw', this.#db.saveMeta, this.#db.saveData, this.#db.romData, async () => {
                const existing = await this.#db.romData.where({ hash }).first();

                let romDataId;
                if (existing == undefined) {
                    romDataId = await this.#db.romData.add({ rom_data: romB64, hash, data_type: 'blob' });
                } else {
                    romDataId = existing.id;
                }

                let m3uDiskRomIds;
                let m3uDiskLaunchNames;
                if (hasLocalDiskSet) {
                    m3uDiskRomIds = [];
                    m3uDiskLaunchNames = [];
                    for (let i = 0; i < diskFiles.length; i++) {
                        const diskFile = diskFiles[i];
                        const diskRomId = await this.#getOrCreateRomDataIdByHash(diskFileHashes[i], diskFile.blob);
                        m3uDiskRomIds.push(diskRomId);
                        m3uDiskLaunchNames.push(diskFile.launch_name || diskFile.name || diskNames[i]);
                    }
                }

                if (isQuickSave) {
                    const existingQuickSave = await this.#db.saveMeta
                        .where('rom_data_id')
                        .equals(romDataId)
                        .filter(save => save.is_quicksave === true && save.platform_id === platform_id)
                        .first();

                    if (existingQuickSave) {
                        await this.#db.saveData.delete(existingQuickSave.save_data_id);

                        let saveDataId = await this.#db.saveData.add({ save_data: saveB64 });

                        await this.#db.saveMeta.update(existingQuickSave.id, {
                            screenshot: screenshotB64,
                            save_data_id: saveDataId,
                            timestamp: Date.now(),
                            caption: (program_name !== caption) ? caption : undefined,
                            m3u_disks: hasDiskSet ? diskNames : undefined,
                            m3u_disk_index: hasDiskSet ? diskIndex : undefined,
                            m3u_disk_rom_ids: hasLocalDiskSet ? m3uDiskRomIds : undefined,
                            m3u_disk_launch_names: hasLocalDiskSet ? m3uDiskLaunchNames : undefined
                        });
                    } else {
                        let saveDataId = await this.#db.saveData.add({ save_data: saveB64 });

                        await this.#db.saveMeta.add({
                            platform_id: platform_id,
                            program_name: program_name,
                            screenshot: screenshotB64,
                            rom_data_id: romDataId,
                            save_data_id: saveDataId,
                            timestamp: Date.now(),
                            caption: (program_name !== caption) ? caption : undefined,
                            is_quicksave: true,
                            m3u_disks: hasDiskSet ? diskNames : undefined,
                            m3u_disk_index: hasDiskSet ? diskIndex : undefined,
                            m3u_disk_rom_ids: hasLocalDiskSet ? m3uDiskRomIds : undefined,
                            m3u_disk_launch_names: hasLocalDiskSet ? m3uDiskLaunchNames : undefined
                        });
                    }
                } else {
                    let saveDataId = await this.#db.saveData.add({ save_data: saveB64 });

                    await this.#db.saveMeta.add({
                        platform_id: platform_id,
                        program_name: program_name,
                        screenshot: screenshotB64,
                        rom_data_id: romDataId,
                        save_data_id: saveDataId,
                        timestamp: Date.now(),
                        caption: (program_name !== caption) ? caption : undefined,
                        is_quicksave: false,
                        m3u_disks: hasDiskSet ? diskNames : undefined,
                        m3u_disk_index: hasDiskSet ? diskIndex : undefined,
                        m3u_disk_rom_ids: hasLocalDiskSet ? m3uDiskRomIds : undefined,
                        m3u_disk_launch_names: hasLocalDiskSet ? m3uDiskLaunchNames : undefined
                    });
                }
            });

        } catch (error) {
            console.error("Failed to save state:", error);
        }
    }

    #fixScreenshot(platform_id, blob) {
        if (platform_id != "atari2600" && platform_id != "amiga" && platform_id != "dos") {
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
                let targetWidth = width;
                let targetHeight = height;

                if (platform_id == "atari2600" && ratio < 0.8) {
                    targetWidth = width * 2;
                    targetHeight = height;
                } else if (platform_id == "amiga" && ratio > 2) {
                    targetWidth = width / 2;
                    targetHeight = height;
                }

                if (platform_id == "dos") {
                    const maxWidth = 640;
                    const maxHeight = 480;
                    const widthScale = maxWidth / targetWidth;
                    const heightScale = maxHeight / targetHeight;
                    const scale = Math.min(1, widthScale, heightScale);
                    if (scale < 1) {
                        targetWidth = Math.max(1, Math.round(targetWidth * scale));
                        targetHeight = Math.max(1, Math.round(targetHeight * scale));
                    }
                }

                canvas.width = targetWidth;
                canvas.height = targetHeight;
                ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

                canvas.toBlob((newBlob) => {
                    URL.revokeObjectURL(url);
                    resolve(newBlob || blob);
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

    async getSaveMetaScreenshot(id) {
        const saveMeta = await this.#db.saveMeta.get(id);
        if (saveMeta && saveMeta.screenshot) {
            return this.base64ToBlob(saveMeta.screenshot);
        }
        return null;
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

        const romData = await this.#db.romData.get(saveMeta.rom_data_id);
        const saveData = await this.#db.saveData.get(saveMeta.save_data_id);

        if (!saveData || !romData) {
            throw new Error('Save state or program data is missing.');
        }

        let romBlob;
        if (romData.data_type == 'base64') {
            romBlob = this.base64ToBlob(romData.rom_data);
        } else {
            romBlob = romData.rom_data;
        }

        const saveBlob = this.base64ToBlob(saveData.save_data);

        return {
            platform_id: saveMeta.platform_id,
            program_name: saveMeta.program_name,
            save_data: saveBlob,
            rom_data: romBlob,
            timestamp: saveMeta.timestamp,
            caption: saveMeta.caption,
            m3u_disks: saveMeta.m3u_disks,
            m3u_disk_index: saveMeta.m3u_disk_index,
            m3u_disk_rom_ids: saveMeta.m3u_disk_rom_ids,
            m3u_disk_launch_names: saveMeta.m3u_disk_launch_names
        };
    }

    async deleteSave(id) {
        try {
            await this.#db.transaction('rw', this.#db.saveMeta, this.#db.saveData, this.#db.collectionItemData, this.#db.romData, async () => {
                const saveMetaEntry = await this.#db.saveMeta.get(id);
                if (saveMetaEntry) {
                    const candidateRomIds = new Set();
                    if (Number.isInteger(saveMetaEntry.rom_data_id)) {
                        candidateRomIds.add(saveMetaEntry.rom_data_id);
                    }
                    for (const romId of this.#extractM3uRomIds(saveMetaEntry)) {
                        candidateRomIds.add(romId);
                    }

                    await this.#db.saveData.where('id').equals(saveMetaEntry.save_data_id).delete();
                    await this.#db.saveMeta.delete(id);

                    const saveReferencedRomIds = await this.#collectSaveReferencedRomIds();
                    for (const romId of candidateRomIds) {
                        const collectionSameRomCount = await this.#db.collectionItemData.where('rom_data_id').equals(romId).count();
                        if (collectionSameRomCount === 0 && !saveReferencedRomIds.has(romId)) {
                            await this.#db.romData.where('id').equals(romId).delete();
                        }
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
                await this.#db.collectionItemData.clear();
                await this.#db.collectionMeta.clear();

                const saveReferencedRomIds = await this.#collectSaveReferencedRomIds();
                const allRomData = await this.#db.romData.toArray();
                for (const romEntry of allRomData) {
                    if (!saveReferencedRomIds.has(romEntry.id)) {
                        await this.#db.romData.where('id').equals(romEntry.id).delete();
                    }
                }
            });
        } catch (error) {
            console.error('Failed to delete collections:', error);
        }
    }

    getDataBase() {
        return this.#db;
    }
}
