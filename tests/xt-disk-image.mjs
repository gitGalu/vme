import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';
import { buildXtDiskImage, readXtArchive, prepareXtLaunchRom } from '../src/utils/XtDiskImage.js';

const systemUrl = new URL('../src/assets/xt-system.zip', import.meta.url);
const systemZip = await readFile(new URL('../src/assets/xt-system.zip', import.meta.url));
const archive = await JSZip.loadAsync(systemZip);
const system = Object.fromEntries(await Promise.all(Object.values(archive.files)
    .map(async entry => [entry.name, await entry.async('uint8array')])));
const bytes = text => new TextEncoder().encode(text);

// Read the produced disk independently, following its BPB, FAT chains, and
// directory records rather than depending on the builder's internal layout.
async function readDisk(blob) {
    const data = new Uint8Array(await blob.arrayBuffer());
    const view = new DataView(data.buffer);
    assert.equal(view.getUint16(510, true), 0xaa55);
    assert.equal(data[446], 0x80);
    assert.equal(data[450], 1);
    const partition = view.getUint32(454, true) * 512;
    assert.equal(view.getUint16(partition + 510, true), 0xaa55);
    const sector = view.getUint16(partition + 11, true);
    const clusterBytes = sector * data[partition + 13];
    const fatBytes = view.getUint16(partition + 22, true) * sector;
    const fat = partition + view.getUint16(partition + 14, true) * sector;
    const root = fat + data[partition + 16] * fatBytes;
    const rootSize = view.getUint16(partition + 17, true) * 32;
    const firstData = root + rootSize;
    assert.deepEqual(data.slice(fat, fat + fatBytes), data.slice(fat + fatBytes, fat + 2 * fatBytes));
    const chain = first => {
        const chunks = [];
        const visited = new Set();
        for (let cluster = first; cluster >= 2 && cluster < 0xff8;) {
            assert.ok(!visited.has(cluster), 'FAT chain must not loop');
            visited.add(cluster);
            const position = firstData + (cluster - 2) * clusterBytes;
            assert.ok(position + clusterBytes <= data.length);
            chunks.push(data.slice(position, position + clusterBytes));
            const pair = view.getUint16(fat + Math.floor(cluster * 1.5), true);
            cluster = cluster % 2 ? pair >>> 4 : pair & 0xfff;
        }
        const result = new Uint8Array(chunks.length * clusterBytes);
        chunks.forEach((chunk, index) => result.set(chunk, index * clusterBytes));
        return result;
    };
    const files = new Map();
    const aliases = new Map();
    const walk = (buffer, prefix = '') => {
        const table = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
        const longParts = [];
        for (let offset = 0; offset + 32 <= buffer.length; offset += 32) {
            if (!buffer[offset]) break;
            const record = buffer.slice(offset, offset + 32);
            if (record[0] === 0xe5) continue;
            if (record[11] === 15) {
                const part = [1,3,5,7,9,14,16,18,20,22,24,28,30]
                    .map(pos => table.getUint16(offset + pos, true))
                    .filter(code => code !== 0 && code !== 0xffff).map(code => String.fromCharCode(code)).join('');
                longParts[(record[0] & 31) - 1] = part;
                continue;
            }
            const stem = new TextDecoder().decode(record.slice(0, 8)).trim();
            const extension = new TextDecoder().decode(record.slice(8, 11)).trim();
            const alias = stem + (extension ? `.${extension}` : '');
            const name = longParts.length ? longParts.join('') : alias;
            longParts.length = 0;
            if (alias === '.' || alias === '..' || record[11] & 8) continue;
            const path = prefix + name;
            aliases.set(path, alias);
            const cluster = table.getUint16(offset + 26, true);
            if (record[11] & 16) walk(chain(cluster), `${path}/`);
            else files.set(path, chain(cluster).slice(0, table.getUint32(offset + 28, true)));
        }
    };
    walk(data.slice(root, root + rootSize));
    return { files, aliases, data, view, partition, clusterBytes };
}

test('ZIP becomes a bootable C: disk with all game files and subdirectories', async () => {
    const payload = Uint8Array.from({ length: 17003 }, (_, index) => index % 251);
    const disk = await readDisk(buildXtDiskImage([
        { path: 'GAME.COM', bytes: bytes('test executable') },
        { path: 'LEVELS/FIRST/DATA.BIN', bytes: payload },
        { path: 'EMPTY', bytes: null },
        { path: 'ZERO.DAT', bytes: new Uint8Array() }
    ], system));
    assert.deepEqual(disk.files.get('KERNEL.SYS'), system['KERNEL.SYS']);
    assert.deepEqual(disk.files.get('VMEBOOT/COMMAND.COM'), system['COMMAND.COM']);
    assert.deepEqual(disk.files.get('LEVELS/FIRST/DATA.BIN'), payload);
    assert.deepEqual(disk.files.get('GAME.COM'), bytes('test executable'));
    assert.equal(disk.files.get('ZERO.DAT').length, 0);
    assert.ok(![...disk.files.keys()].some(path => /^(GAMES|FREEDOS|UTILS)\//.test(path)));
    assert.match(new TextDecoder().decode(disk.files.get('VMEBOOT/VMERUN.BAT')), /C:\\AUTOEXEC\.BAT/);
});

test('long names and case are preserved without stealing existing DOS aliases', async () => {
    const disk = await readDisk(buildXtDiskImage([
        { path: 'Long Folder/read me please.txt', bytes: bytes('long') },
        { path: 'Long Folder/README~1.TXT', bytes: bytes('existing') },
        { path: 'Long Folder/read me again.txt', bytes: bytes('other') }
    ], system));
    assert.deepEqual(disk.files.get('Long Folder/read me please.txt'), bytes('long'));
    assert.deepEqual(disk.files.get('Long Folder/README~1.TXT'), bytes('existing'));
    const aliases = [...disk.aliases].filter(([path]) => path.startsWith('Long Folder/')).map(([, alias]) => alias);
    assert.equal(new Set(aliases).size, 3);
});

test('ZIP boot omits the EMS driver by default and installs it only when requested', async () => {
    for (const ems of [false, true]) {
        const disk = await readDisk(buildXtDiskImage([], system, { ems }));
        const config = new TextDecoder().decode(disk.files.get('FDCONFIG.SYS'));
        assert.equal(config.includes('DEVICE=C:\\VMEBOOT\\LTEMM.EXE'), ems);
    }
    const disk = await readDisk(buildXtDiskImage([], system));
    assert.ok(!new TextDecoder().decode(disk.files.get('FDCONFIG.SYS')).includes('LTEMM.EXE'));
});

test('disk grows past 32 MB with correct large-volume BPB and FAT chains', async () => {
    const payload = new Uint8Array(34 * 1024 * 1024);
    payload[0] = 91;
    payload[payload.length - 1] = 173;
    const disk = await readDisk(buildXtDiskImage([{ path: 'LARGE.DAT', bytes: payload }], system));
    assert.ok(disk.clusterBytes >= 16384);
    assert.equal(disk.view.getUint16(disk.partition + 19, true), 0);
    assert.ok(disk.view.getUint32(disk.partition + 32, true) > 65535);
    assert.deepEqual(disk.files.get('LARGE.DAT'), payload);
});

test('archives retain folders and reject DOS filename collisions and boot file replacement', async () => {
    const zip = new JSZip();
    zip.file('GAME/DATA.DAT', 'data');
    zip.folder('GAME/EMPTY');
    const files = await readXtArchive(new Blob([await zip.generateAsync({ type: 'uint8array' })]));
    assert.ok(files.some(file => file.path === 'GAME/EMPTY' && file.bytes === null));
    assert.throws(() => buildXtDiskImage([
        { path: 'DATA.DAT', bytes: bytes('one') }, { path: 'data.dat', bytes: bytes('two') }
    ], system), /Conflicting DOS filename/);
    for (const path of ['KERNEL.SYS', 'fdconfig.sys', 'VMEBOOT/COMMAND.COM']) {
        assert.throws(() => buildXtDiskImage([{ path, bytes: bytes('overwrite') }], system), /boot files/);
    }
});

test('XT launch hook handles ZIP games and single archived IMG, preserving the original payload', async () => {
    const zip = new JSZip();
    zip.file('DATA.TXT', 'game data');
    const input = new Blob([await zip.generateAsync({ type: 'uint8array' })]);
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async url => {
        assert.ok(String(url).endsWith('/xt-system.zip'));
        return new Response(systemZip);
    };
    try {
        const prepared = await prepareXtLaunchRom({ launchRomInput: input, romName: 'game.zip' }, systemUrl);
        assert.equal(prepared.programName, 'game.zip');
        assert.equal(prepared.saveBlob, input);
        assert.match(prepared.launchFiles[0].fileName, /\.img$/);
        const disk = await readDisk(prepared.launchFiles[0].fileContent);
        assert.deepEqual(disk.files.get('DATA.TXT'), bytes('game data'));
        assert.ok(!new TextDecoder().decode(disk.files.get('FDCONFIG.SYS')).includes('LTEMM.EXE'));
        const enabled = await prepareXtLaunchRom({
            launchRomInput: input, romName: 'game.zip',
            launchSettings: { coreConfig: { virtualxt_ems: 'enabled' } }
        }, systemUrl);
        const enabledDisk = await readDisk(enabled.launchFiles[0].fileContent);
        assert.match(new TextDecoder().decode(enabledDisk.files.get('FDCONFIG.SYS')), /DEVICE=C:\\VMEBOOT\\LTEMM\.EXE/);
    } finally { globalThis.fetch = originalFetch; }
    const img = new JSZip();
    img.file('disk.img', bytes('original disk image'));
    const zippedImage = new Blob([await img.generateAsync({ type: 'uint8array' })]);
    const prepared = await prepareXtLaunchRom({ launchRomInput: zippedImage, romName: 'disk.zip' }, systemUrl);
    assert.equal(await prepared.launchFiles[0].fileContent.text(), 'original disk image');
    assert.equal(await prepareXtLaunchRom({ launchRomInput: input, romName: 'plain.img' }, systemUrl), input);
});
