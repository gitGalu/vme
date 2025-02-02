import { CommandBase } from './CommandBase.js';

export class CheckFixCommand extends CommandBase {
    #storage_manager;
    #MAX_REPAIR_PASSES = 5;

    constructor(storage_manager) {
        super();
        this.#storage_manager = storage_manager;
    }

    get_keywords() {
        return ['chkfix'];
    }

    get_help() {
        return ['chkfix', 'data integrity check and repair tool'];
    }

    process_input(input, is_enter_pressed) {
        if (!is_enter_pressed) {
            this.cli.clear();
            this.cli.print("Press ENTER to run data integrity check and repair tool.");
            return;
        } else {
            this.cli.set_loading(true);
            this.#checkAndFixDatabase(this.#storage_manager.getDataBase()).then(() => {
                let msgs = [];
                this.cli.message(...msgs);
            });
        }
    }

    async #checkAndFixDatabase(db) {
        this.cli.print("Starting data check...");

        let passCount = 0;
        let hasRemainingIssues = true;
        let repairStarted = false;

        while (hasRemainingIssues && passCount < this.#MAX_REPAIR_PASSES) {
            passCount++;
            const issues = await this.#checkDatabaseConsistency(db);
            hasRemainingIssues = Object.values(issues).some(arr => arr.length > 0);

            if (!hasRemainingIssues) {
                if (!repairStarted) {
                    this.cli.print("No issues found.");
                } else {
                    this.cli.print("All issues have been fixed.");
                }
                return true;
            }

            if (!repairStarted) {
                this.cli.print("Found data consistency issues. Attempting to fix...");
                repairStarted = true;
            }

            const fixed = await this.#fixDatabaseIssues(db, issues);
            if (!fixed) {
                this.cli.print("Error: Repair failed.");
                return false;
            }
        }

        if (hasRemainingIssues) {
            this.cli.print("Error: Unable to fix all issues.");
            return false;
        }

        return true;
    }

    async #checkDatabaseConsistency(db) {
        const issues = {
            orphanedSaveData: [],
            orphanedRomData: [],
            missingRomData: [],
            missingSaveData: [],
            orphanedCollectionItems: [],
            inconsistentDataTypes: [],
            invalidScreenshots: []
        };

        try {
            const data = await this.#fetchDatabaseData(db);
            await this.#checkScreenshots(data.saveMeta, data.collectionItems, issues);
            await this.#checkSaveDataConsistency(data, issues, db);
            await this.#checkRomDataConsistency(data, issues, db);
            await this.#checkCollectionConsistency(data, issues);
            await this.#checkDataTypes(data.romData, issues);

            return issues;
        } catch (error) {
            console.error("Error checking data consistency:", error);
            throw error;
        }
    }

    async #fetchDatabaseData(db) {
        return {
            saveMeta: await db.saveMeta.toArray(),
            saveData: await db.saveData.toArray(),
            romData: await db.romData.toArray(),
            collectionMeta: await db.collectionMeta.toArray(),
            collectionItems: await db.collectionItemData.toArray()
        };
    }

    async #checkScreenshots(saveMeta, collectionItems, issues) {
        const checkImage = async (imageData, id, type) => {
            if (!imageData) return;

            try {
                if (!imageData.startsWith('data:image/')) {
                    issues.invalidScreenshots.push({
                        [type]: id,
                        reason: 'Invalid image data format'
                    });
                    return;
                }

                await new Promise((resolve, reject) => {
                    const img = new Image();
                    img.onload = resolve;
                    img.onerror = reject;
                    img.src = imageData;
                });
            } catch (error) {
                issues.invalidScreenshots.push({
                    [type]: id,
                    reason: 'Corrupted image data'
                });
            }
        };

        for (const meta of saveMeta) {
            await checkImage(meta.screenshot, meta.id, 'saveMetaId');
        }

        for (const item of collectionItems) {
            await checkImage(item.image, item.id, 'collectionItemId');
        }
    }

    async #checkSaveDataConsistency(data, issues, db) {
        const saveDataIds = new Set(data.saveMeta.map(meta => meta.save_data_id));
        
        for (const save of data.saveData) {
            if (!saveDataIds.has(save.id)) {
                issues.orphanedSaveData.push(save.id);
            }
        }

        for (const meta of data.saveMeta) {
            const saveExists = await db.saveData.get(meta.save_data_id);
            if (!saveExists) {
                issues.missingSaveData.push({
                    saveMetaId: meta.id,
                    missingSaveDataId: meta.save_data_id
                });
            }
        }
    }

    async #checkRomDataConsistency(data, issues, db) {
        const romReferences = new Set();
        data.saveMeta.forEach(meta => romReferences.add(meta.rom_data_id));
        data.collectionItems.forEach(item => romReferences.add(item.rom_data_id));

        for (const romId of romReferences) {
            const romExists = await db.romData.get(romId);
            if (!romExists) {
                issues.missingRomData.push(romId);
            }
        }

        const validRomIds = new Set(romReferences);
        for (const rom of data.romData) {
            if (!validRomIds.has(rom.id)) {
                issues.orphanedRomData.push(rom.id);
            }
        }
    }

    async #checkCollectionConsistency(data, issues) {
        const collectionIds = new Set(data.collectionMeta.map(meta => meta.id));
        
        for (const item of data.collectionItems) {
            if (!collectionIds.has(item.collection_id)) {
                issues.orphanedCollectionItems.push(item.id);
            }
        }
    }

    #checkDataTypes(romData, issues) {
        for (const rom of romData) {
            if (rom.data_type !== 'base64' && rom.data_type !== 'blob') {
                issues.inconsistentDataTypes.push({
                    romId: rom.id,
                    invalidType: rom.data_type
                });
            }
        }
    }

    async #fixDatabaseIssues(db, issues) {
        try {
            await db.transaction('rw',
                [db.saveMeta, db.saveData, db.romData, db.collectionMeta, db.collectionItemData],
                async () => {
                    await this.#fixMissingData(db, issues);
                    await this.#fixOrphanedData(db, issues);
                    await this.#fixInconsistentDataTypes(db, issues);
                }
            );
            return true;
        } catch (error) {
            this.cli.print("Error fixing data issues:", error);
            return false;
        }
    }

    async #fixOrphanedData(db, issues) {
        if (issues.orphanedSaveData.length > 0) {
            await db.saveData.where('id').anyOf(issues.orphanedSaveData).delete();
            console.log(`Deleted ${issues.orphanedSaveData.length} orphaned save data records`);
        }

        if (issues.orphanedRomData.length > 0) {
            await db.romData.where('id').anyOf(issues.orphanedRomData).delete();
            console.log(`Deleted ${issues.orphanedRomData.length} orphaned ROM data records`);
        }

        if (issues.orphanedCollectionItems.length > 0) {
            await db.collectionItemData.where('id').anyOf(issues.orphanedCollectionItems).delete();
            console.log(`Deleted ${issues.orphanedCollectionItems.length} orphaned collection items`);
        }
    }

    async #fixMissingData(db, issues) {
        if (issues.missingSaveData.length > 0) {
            const saveMetaIds = issues.missingSaveData.map(issue => issue.saveMetaId);
            await db.saveMeta.where('id').anyOf(saveMetaIds).delete();
            this.cli.print(`Deleted ${saveMetaIds.length} save meta records with missing save data`);
        }

        if (issues.missingRomData.length > 0) {
            const romIds = issues.missingRomData;
            await db.saveMeta.where('rom_data_id').anyOf(romIds).delete();
            await db.collectionItemData.where('rom_data_id').anyOf(romIds).delete();
            console.log(`Cleaned up references to ${romIds.length} missing ROM data records`);
        }
    }

    async #fixInconsistentDataTypes(db, issues) {
        if (issues.inconsistentDataTypes.length > 0) {
            await Promise.all(issues.inconsistentDataTypes.map(async issue => {
                await db.romData.where('id').equals(issue.romId).modify(rom => {
                    rom.data_type = 'blob';
                });
            }));
            console.log(`Fixed ${issues.inconsistentDataTypes.length} inconsistent data type records`);
        }
    }
}