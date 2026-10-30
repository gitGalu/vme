import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AppVersion } from '../src/startup/AppVersion.js';

function memoryStorage(previousVersion) {
    const values = new Map(previousVersion === undefined ? [] : [[AppVersion.STORAGE_KEY, previousVersion]]);
    return {
        values,
        getValue: key => values.get(key),
        storeValue: (key, value) => values.set(key, value),
    };
}

test('first launch establishes a baseline without reporting an update', () => {
    const storage = memoryStorage();
    const version = new AppVersion('0.97', storage);
    assert.deepEqual(version.info, {
        currentVersion: '0.97', previousVersion: null, isFirstRun: true, isUpdate: false,
    });
    assert.equal(storage.values.size, 0, 'detection does not write before successful startup');
    assert.equal(version.remember(), true);
    assert.equal(storage.getValue(AppVersion.STORAGE_KEY), '0.97');
    assert.equal(new AppVersion('0.97', storage).info.isFirstRun, false);
});

test('a release upgrade is detected once and a refresh does not repeat it', () => {
    const storage = memoryStorage('0.96');
    const version = new AppVersion('0.97', storage);
    assert.deepEqual(version.info, {
        currentVersion: '0.97', previousVersion: '0.96', isFirstRun: false, isUpdate: true,
    });
    assert.equal(new AppVersion('0.97', storage).info.isUpdate, true, 'failed startup can retry');
    version.remember();
    assert.equal(new AppVersion('0.97', storage).info.isUpdate, false);
    assert.equal(version.info.isUpdate, true, 'startup information remains a stable snapshot');
    assert(Object.isFrozen(version.info));
});

test('version components are numeric and missing trailing zeros are equivalent', () => {
    for (const [previous, current] of [['0.9', '0.10'], ['0.99', '0.100'], ['0.97', '1.0'], ['1.2.9', '1.2.10']]) {
        assert.equal(new AppVersion(current, memoryStorage(previous)).info.isUpdate, true, `${previous} -> ${current}`);
    }
    for (const [previous, current] of [['0.97', '0.97.0'], ['1.0.0', '1.0'], ['0.98', '0.97'], ['1.0', '0.99']]) {
        assert.equal(new AppVersion(current, memoryStorage(previous)).info.isUpdate, false, `${previous} -> ${current}`);
    }
});

test('invalid saved values establish a fresh baseline', () => {
    for (const previous of ['', 'undefined', 'null', '{}', '0.97junk']) {
        const storage = memoryStorage(previous);
        const version = new AppVersion('0.97', storage);
        assert.equal(version.info.isUpdate, false);
        assert.equal(version.info.isFirstRun, true);
        version.remember();
        assert.equal(storage.getValue(AppVersion.STORAGE_KEY), '0.97');
    }
});

test('unavailable storage does not interrupt startup or report an update', () => {
    const version = new AppVersion('0.97', {
        getValue() { throw new Error('SecurityError'); },
        storeValue() { throw new Error('SecurityError'); },
    });
    assert.equal(version.info.isUpdate, false);
    assert.equal(version.remember(), false);
});

test('a failed write preserves the update for a later launch', () => {
    const storage = memoryStorage('0.96');
    storage.storeValue = () => { throw new Error('QuotaExceededError'); };
    const version = new AppVersion('0.97', storage);
    assert.equal(version.info.isUpdate, true);
    assert.equal(version.remember(), false);
    assert.equal(new AppVersion('0.97', storage).info.isUpdate, true);
});

test('PWA first launch is independent of ordinary browser visits', () => {
    const storage = memoryStorage('0.97');
    const firstPwa = new AppVersion('0.97', storage, AppVersion.PWA_STORAGE_KEY);
    assert.equal(firstPwa.info.isFirstRun, true);
    assert.equal(firstPwa.info.isUpdate, false);
    firstPwa.remember();
    assert.equal(storage.getValue(AppVersion.PWA_STORAGE_KEY), '0.97');
    assert.equal(new AppVersion('0.97', storage, AppVersion.PWA_STORAGE_KEY).info.isFirstRun, false);
});

test('a browser upgrade does not consume an update in the PWA', () => {
    const storage = memoryStorage('0.97');
    storage.storeValue(AppVersion.PWA_STORAGE_KEY, '0.96');
    new AppVersion('0.97', storage).remember();
    const pwa = new AppVersion('0.97', storage, AppVersion.PWA_STORAGE_KEY);
    assert.equal(pwa.info.isUpdate, true);
    pwa.remember();
    assert.equal(new AppVersion('0.97', storage, AppVersion.PWA_STORAGE_KEY).info.isUpdate, false);
    assert.equal(storage.getValue(AppVersion.STORAGE_KEY), '0.97');
});
