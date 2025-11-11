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

        let lastIssuesSnapshot = null;

        while (hasRemainingIssues && passCount < this.#MAX_REPAIR_PASSES) {
            passCount++;
            const issues = await this.#checkDatabaseConsistency(db);
            lastIssuesSnapshot = issues;
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
                console.error("[CHKFIX] Repair transaction failed while attempting to resolve issues:", issues);
                return false;
            }
        }

        if (hasRemainingIssues) {
            this.cli.print("Error: Unable to fix all issues.");
            if (lastIssuesSnapshot) {
                console.error("[CHKFIX] Remaining unresolved issues after attempted repairs:", lastIssuesSnapshot);
                if (lastIssuesSnapshot.invalidScreenshots?.length) {
                    console.error("[CHKFIX] Unresolved invalid screenshots detail:", lastIssuesSnapshot.invalidScreenshots);
                }
            }
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
            await this.#checkScreenshots(data, issues);
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

    async #checkScreenshots(data, issues) {
        const collectionTitleById = new Map(
            (data.collectionMeta || []).map(meta => [meta.id, meta.collection_title])
        );

        const checkImage = async (imageData, buildDetail) => {
            if (!imageData) return;

            if (typeof imageData !== 'string') {
                const detail = buildDetail('Unsupported image data type');
                issues.invalidScreenshots.push(detail);
                console.warn("[CHKFIX] Invalid screenshot detected:", detail);
                return;
            }

            const isDataUrl = imageData.startsWith('data:');
            const isBlobUrl = imageData.startsWith('blob:');

            if (!isDataUrl && !isBlobUrl) {
                const detail = buildDetail('Unsupported image URL scheme');
                issues.invalidScreenshots.push(detail);
                console.warn("[CHKFIX] Invalid screenshot detected:", detail);
                return;
            }

            try {
                await new Promise((resolve, reject) => {
                    const img = new Image();
                    img.onload = resolve;
                    img.onerror = reject;
                    img.src = imageData;
                });
            } catch (error) {
                const detail = buildDetail('Corrupted or unreadable image data');
                issues.invalidScreenshots.push(detail);
                console.warn("[CHKFIX] Invalid screenshot detected:", detail, error);
            }
        };

        for (const meta of data.saveMeta) {
            await checkImage(meta.screenshot, (reason) => ({
                type: 'saveMeta',
                saveMetaId: meta.id,
                platformId: meta.platform_id,
                programName: meta.program_name,
                romDataId: meta.rom_data_id,
                caption: meta.caption,
                isQuicksave: Boolean(meta.is_quicksave),
                timestamp: meta.timestamp ?? null,
                reason
            }));
        }

        for (const item of data.collectionItems) {
            await checkImage(item.image, (reason) => ({
                type: 'collectionItem',
                collectionItemId: item.id,
                collectionId: item.collection_id,
                collectionTitle: collectionTitleById.get(item.collection_id) || null,
                platformId: item.platform_id,
                title: item.title,
                romName: item.rom_name,
                romDataId: item.rom_data_id,
                romUrl: item.rom_url || null,
                reason
            }));
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
                    this.#logIssuesPendingFix(issues);
                    await this.#fixMissingData(db, issues);
                    await this.#fixOrphanedData(db, issues);
                    await this.#fixInconsistentDataTypes(db, issues);
                }
            );
            return true;
        } catch (error) {
            console.error("Error fixing data issues:", error);
            return false;
        }
    }

    #logIssuesPendingFix(issues) {
        const nonEmptyIssues = Object.entries(issues)
            .filter(([, value]) => Array.isArray(value) && value.length > 0)
            .map(([key, value]) => ({ key, count: value.length }));

        if (nonEmptyIssues.length > 0) {
            console.log("[CHKFIX] Issues identified for repair:", nonEmptyIssues);
        }

        if (issues.invalidScreenshots.length > 0) {
            console.warn("[CHKFIX] Invalid screenshots queued for inspection:", issues.invalidScreenshots);
        }
    }

    async #fixOrphanedData(db, issues) {
        if (issues.orphanedSaveData.length > 0) {
            await db.saveData.where('id').anyOf(issues.orphanedSaveData).delete();
            console.log("[CHKFIX] Deleted orphaned save data records:", issues.orphanedSaveData);
        }

        if (issues.orphanedRomData.length > 0) {
            await db.romData.where('id').anyOf(issues.orphanedRomData).delete();
            console.log("[CHKFIX] Deleted orphaned ROM data records:", issues.orphanedRomData);
        }

        if (issues.orphanedCollectionItems.length > 0) {
            await db.collectionItemData.where('id').anyOf(issues.orphanedCollectionItems).delete();
            console.log("[CHKFIX] Deleted orphaned collection items:", issues.orphanedCollectionItems);
        }
    }

    async #fixMissingData(db, issues) {
        if (issues.missingSaveData.length > 0) {
            const saveMetaIds = issues.missingSaveData.map(issue => issue.saveMetaId);
            await db.saveMeta.where('id').anyOf(saveMetaIds).delete();
            this.cli.print(`Deleted ${saveMetaIds.length} save meta records with missing save data`);
            console.log("[CHKFIX] Deleted save meta records referencing missing save data:", issues.missingSaveData);
        }

        if (issues.missingRomData.length > 0) {
            const romIds = issues.missingRomData;
            await db.saveMeta.where('rom_data_id').anyOf(romIds).delete();
            await db.collectionItemData.where('rom_data_id').anyOf(romIds).delete();
            console.log("[CHKFIX] Removed references to missing ROM data records:", romIds);
        }
    }

    async #fixInconsistentDataTypes(db, issues) {
        if (issues.inconsistentDataTypes.length > 0) {
            await Promise.all(issues.inconsistentDataTypes.map(async issue => {
                await db.romData.where('id').equals(issue.romId).modify(rom => {
                    rom.data_type = 'blob';
                });
            }));
            console.log("[CHKFIX] Normalized ROM data_type to 'blob' for:", issues.inconsistentDataTypes);
        }
    }
}
