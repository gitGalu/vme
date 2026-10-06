import assert from 'node:assert/strict';
import { buildAtari800DiskSet, archiveProgramChoices } from '../src/utils/Atari800DiskSets.js';
import { DiskSetBuilder } from '../src/utils/DiskSetBuilder.js';

const set = names => buildAtari800DiskSet(names.map(romName => ({ romName, url: `/games/${romName}` })), names[0]);
const city = [4, 2, 1, 3].map(n => `Alternate Reality the City - Disk ${n}.atr`);
assert.deepEqual(set(city).selected.map(d => d.diskNo), [1, 2, 3, 4]);
const tosec = [2, 1].map(n => `Game (1985)(Publisher)(Disk ${n} of 2)[cr Team].ATR`);
assert.deepEqual(set(tosec).selected.map(d => d.diskNo), [1, 2]);
for (const title of ['Ultima V _', 'Polar Pierre _ Datamost _']) {
    const sides = ['B', 'A'].map(side => `${title} side ${side}.atr`);
    assert.deepEqual(set(sides).selected.map(d => d.sideNo), [1, 2]);
}
const versions = ['v1', 'v2'].flatMap(v => [2, 1].map(s => `Polar Pierre (${v},s${s}).atr`));
assert.equal(set(versions).total, 2);
assert(set(versions).selected.every(d => d.romName.includes('(v1,')));
assert.equal(archiveProgramChoices(versions).length, 2);
const doubleSided = [2, 1].flatMap(d => ['B', 'A'].map(s => `Game (1985)(Disk ${d} of 2)(Side ${s}).atr`));
assert.deepEqual(set(doubleSided).selected.map(d => `${d.diskNo}:${d.sideNo}`), ['1:1', '1:2', '2:1', '2:2']);
assert.equal(set(['Game (Disk 1 of 3).atr', 'Game (Disk 2 of 3).atr']), null);
assert.equal(set(['Game Disk 1.atr', 'Game Disk 3.atr']), null);
assert.equal(set(['Game side B.atr', 'Game side C.atr']), null);
assert.equal(set(['Game side A.atr', 'Game side A.ATR', 'Game side B.atr']), null);
assert.equal(set(['Game Disk 1 (v1).atr', 'Game Disk 2 (v2).atr']), null);
assert.equal(set(['Game Disk 1 [a].atr', 'Game Disk 2 [b].atr']), null);
assert.equal(set(['one/Game Disk 1.atr', 'two/Game Disk 2.atr']), null);
assert.equal(set(['Game Disk 1.xex', 'Game Disk 2.xex']), null);
assert.equal(set(['Other Disk 1.atr', 'Game Disk 2.atr']), null);
assert.equal(buildAtari800DiskSet([
    { romName: 'Game Disk 1.atr', url: 'https://one.invalid/Game Disk 1.atr' },
    { romName: 'Game Disk 2.atr', url: 'https://two.invalid/Game Disk 2.atr' }
], 'Game Disk 1.atr'), null);
const legacy = DiskSetBuilder.buildBestSet(tosec.map(romName => ({ romName, url: `/games/${romName}` })), tosec[0]);
assert(legacy.isComplete && legacy.isConfident && legacy.total === 2, 'Existing ST/Amiga TOSEC grouping is unchanged');
console.log('Atari800 disk/side grouping and ST/Amiga compatibility checks passed.');
