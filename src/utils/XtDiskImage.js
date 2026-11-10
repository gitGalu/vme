import JSZip from 'jszip';

const SECTOR = 512;
const PARTITION_START = 63;
const CLUSTERS = 4080;
const ROOT_ENTRIES = 512;
const FAT_SECTORS = 12;
const DATA_SECTOR = 1 + 2 * FAT_SECTORS + ROOT_ENTRIES / 16;
const encoder = new TextEncoder();

function directory(name) {
    return { name, children: new Map(), attribute: 0x10 };
}

function insert(root, path, bytes = null, attribute = null) {
    const parts = path.split('/');
    let parent = root;
    for (const [index, name] of parts.entries()) {
        const key = name.toUpperCase();
        const last = index === parts.length - 1;
        let node = parent.children.get(key);
        if (node && (!node.children || (last && bytes !== null))) {
            throw new Error(`Conflicting DOS filename in ZIP: ${path}`);
        }
        if (!node) {
            node = last && bytes !== null ? { name, bytes, attribute: 0x20 } : directory(name);
            parent.children.set(key, node);
        }
        if (last && attribute !== null) node.attribute = attribute;
        parent = node;
    }
}

function shortNames(parent) {
    const used = new Set();
    const valid = /^[A-Z0-9!#$%&'()@^_`{}~-]{1,8}(?:\.[A-Z0-9!#$%&'()@^_`{}~-]{1,3})?$/;
    // Reserve original 8.3 names before generating aliases for longer names.
    for (const node of parent.children.values()) {
        const upper = node.name.toUpperCase();
        if (valid.test(upper)) used.add(upper);
    }
    for (const node of parent.children.values()) {
        let alias = node.name.toUpperCase();
        if (!valid.test(alias)) {
            const dot = alias.lastIndexOf('.');
            const stem = (dot > 0 ? alias.slice(0, dot) : alias).replace(/[^A-Z0-9]/g, '_') || 'FILE';
            const extension = dot > 0 ? alias.slice(dot + 1).replace(/[^A-Z0-9]/g, '_').slice(0, 3) : '';
            for (let index = 1; ; index++) {
                const suffix = `~${index}`;
                alias = stem.slice(0, 8 - suffix.length) + suffix + (extension ? `.${extension}` : '');
                if (!used.has(alias)) break;
            }
        }
        used.add(alias);
        const [stem, extension = ''] = alias.split('.');
        node.shortName = stem.padEnd(8) + extension.padEnd(3);
        node.longEntries = node.name === alias ? 0 : Math.ceil(node.name.length / 13);
        if (node.children) shortNames(node);
    }
}

function entryCount(parent) {
    return [...parent.children.values()].reduce((sum, node) => sum + 1 + node.longEntries, 0);
}

function shortEntry(name, attribute, cluster, size = 0) {
    const bytes = new Uint8Array(32);
    const view = new DataView(bytes.buffer);
    bytes.set(encoder.encode(name));
    bytes[11] = attribute;
    view.setUint16(24, 0x21, true); // 1980-01-01
    view.setUint16(26, cluster, true);
    view.setUint32(28, size, true);
    return bytes;
}

function entries(node) {
    const result = [];
    let checksum = 0;
    for (const byte of encoder.encode(node.shortName)) {
        checksum = (((checksum & 1) << 7) + (checksum >> 1) + byte) & 255;
    }
    const offsets = [1, 3, 5, 7, 9, 14, 16, 18, 20, 22, 24, 28, 30];
    for (let index = node.longEntries; index > 0; index--) {
        const bytes = new Uint8Array(32).fill(255);
        const view = new DataView(bytes.buffer);
        bytes[0] = index | (index === node.longEntries ? 0x40 : 0);
        bytes[11] = 0x0f;
        bytes[12] = 0;
        bytes[13] = checksum;
        view.setUint16(26, 0, true);
        offsets.forEach((offset, i) => {
            const position = (index - 1) * 13 + i;
            view.setUint16(offset, position < node.name.length ? node.name.charCodeAt(position)
                : position === node.name.length ? 0 : 0xffff, true);
        });
        result.push(bytes);
    }
    result.push(shortEntry(node.shortName, node.attribute, node.cluster, node.bytes?.length || 0));
    return result;
}

function chs(lba) {
    const cylinder = Math.floor(lba / (16 * 63));
    return [Math.floor(lba / 63) % 16, (lba % 63 + 1) | ((cylinder >> 2) & 0xc0), cylinder & 255];
}

// Keep the FreeDOS template's FAT12 boot loader and grow clusters as needed.
// The resulting IMG is a real hard disk: the archive is its writable C: volume.
export function buildXtDiskImage(gameFiles, system, { ems = false } = {}) {
    const root = directory('');
    const reserved = new Set(['KERNEL.SYS', 'FDCONFIG.SYS', 'VMEBOOT']);
    for (const file of gameFiles) {
        if (reserved.has(file.path.split('/')[0].toUpperCase())) {
            throw new Error(`ZIP conflicts with the DOS boot files: ${file.path}`);
        }
    }
    insert(root, 'KERNEL.SYS', system['KERNEL.SYS'], 0x06);
    insert(root, 'VMEBOOT', null, 0x12);
    for (const name of ['COMMAND.COM', 'LTEMM.EXE', 'USE!UMBS.SYS', 'CTMOUSE.EXE']) {
        insert(root, `VMEBOOT/${name}`, system[name]);
    }
    insert(root, 'FDCONFIG.SYS', encoder.encode([
        'DOS=UMB', 'LASTDRIVE=Z', 'BUFFERS=20', 'FILES=40',
        ...(ems ? ['DEVICE=C:\\VMEBOOT\\LTEMM.EXE /p:D000 /n /q'] : []),
        'DEVICE=C:\\VMEBOOT\\USE!UMBS.SYS C880-D000 E000-FD80',
        'SHELLHIGH=C:\\VMEBOOT\\COMMAND.COM C:\\VMEBOOT /E:2048 /P=C:\\VMEBOOT\\VMERUN.BAT', ''
    ].join('\r\n')), 0x06);
    insert(root, 'VMEBOOT/VMERUN.BAT', encoder.encode([
        '@ECHO OFF', 'SET COMSPEC=C:\\VMEBOOT\\COMMAND.COM', 'PATH C:\\;C:\\VMEBOOT',
        'LOADHIGH C:\\VMEBOOT\\CTMOUSE.EXE', 'C:', 'CD \\',
        'IF EXIST C:\\AUTOEXEC.BAT CALL C:\\AUTOEXEC.BAT', ''
    ].join('\r\n')));
    for (const file of gameFiles) insert(root, file.path, file.bytes);
    shortNames(root);
    if (entryCount(root) > ROOT_ENTRIES) throw new Error('Too many files in the ZIP root directory for DOS.');
    const nodes = [];
    const collect = parent => {
        for (const node of parent.children.values()) {
            node.parent = parent;
            node.size = node.children ? (2 + entryCount(node)) * 32 : node.bytes.length;
            nodes.push(node);
            if (node.children) collect(node);
        }
    };
    collect(root);
    let sectorsPerCluster = 8;
    const needed = () => nodes.reduce((sum, node) => sum + Math.ceil(node.size / (sectorsPerCluster * SECTOR)), 0);
    while (needed() > CLUSTERS && sectorsPerCluster < 64) sectorsPerCluster *= 2;
    if (needed() > CLUSTERS) throw new Error('ZIP contents exceed the supported XT disk size (about 127 MB).');
    const clusterBytes = sectorsPerCluster * SECTOR;
    const totalSectors = DATA_SECTOR + CLUSTERS * sectorsPerCluster;
    const image = new Uint8Array((PARTITION_START + totalSectors) * SECTOR);
    const view = new DataView(image.buffer);
    image.set(system['mbr.bin']);
    image.fill(0, 446, 510);
    image[446] = 0x80;
    image.set(chs(PARTITION_START), 447);
    image[450] = 1; // FAT12
    image.set(chs(PARTITION_START + totalSectors - 1), 451);
    view.setUint32(454, PARTITION_START, true);
    view.setUint32(458, totalSectors, true);
    const partition = PARTITION_START * SECTOR;
    image.set(system['boot.bin'], partition);
    view.setUint16(partition + 11, SECTOR, true);
    image[partition + 13] = sectorsPerCluster;
    view.setUint16(partition + 14, 1, true);
    image[partition + 16] = 2;
    view.setUint16(partition + 17, ROOT_ENTRIES, true);
    view.setUint16(partition + 19, totalSectors <= 0xffff ? totalSectors : 0, true);
    view.setUint16(partition + 22, FAT_SECTORS, true);
    view.setUint32(partition + 28, PARTITION_START, true);
    view.setUint32(partition + 32, totalSectors > 0xffff ? totalSectors : 0, true);
    image.set(encoder.encode('VME GAME   '), partition + 43);
    const fat = new Uint8Array(FAT_SECTORS * SECTOR);
    const setFat = (cluster, value) => {
        const offset = cluster + (cluster >> 1);
        if (cluster & 1) {
            fat[offset] = (fat[offset] & 15) | ((value & 15) << 4);
            fat[offset + 1] = value >> 4;
        } else {
            fat[offset] = value & 255;
            fat[offset + 1] = (fat[offset + 1] & 0xf0) | (value >> 8);
        }
    };
    setFat(0, 0xff8);
    setFat(1, 0xfff);
    let nextCluster = 2;
    root.cluster = 0;
    for (const node of nodes) {
        const count = Math.ceil(node.size / clusterBytes);
        node.cluster = count ? nextCluster : 0;
        for (let i = 0; i < count; i++, nextCluster++) {
            setFat(nextCluster, i === count - 1 ? 0xfff : nextCluster + 1);
        }
    }
    image.set(fat, partition + SECTOR);
    image.set(fat, partition + (1 + FAT_SECTORS) * SECTOR);
    const writeDirectory = (node, offset) => {
        const records = node === root ? [] : [
            shortEntry('.          ', 0x10, node.cluster),
            shortEntry('..         ', 0x10, node.parent.cluster)
        ];
        for (const child of node.children.values()) records.push(...entries(child));
        for (const record of records) { image.set(record, offset); offset += 32; }
    };
    writeDirectory(root, partition + (1 + 2 * FAT_SECTORS) * SECTOR);
    for (const node of nodes) {
        const offset = partition + DATA_SECTOR * SECTOR + (node.cluster - 2) * clusterBytes;
        if (node.children) writeDirectory(node, offset);
        else if (node.bytes.length) image.set(node.bytes, offset);
    }
    return new Blob([image], { type: 'application/octet-stream' });
}

export async function readXtArchive(blob) {
    const zip = await JSZip.loadAsync(await blob.arrayBuffer(), { checkCRC32: true });
    const files = [];
    for (const entry of Object.values(zip.files)) {
        const original = entry.unsafeOriginalName || entry.name;
        const path = original.replaceAll('\\', '/').replace(/\/$/, '');
        if (path.split('/').some(part => part === '__MACOSX' || part.startsWith('.'))) continue;
        if (!path || path.startsWith('/') || /[:\x00-\x1f]/.test(path)
            || path.split('/').some(part => !part || part === '..' || part === '.' || part.length > 255)) {
            throw new Error(`Invalid DOS path in ZIP: ${original}`);
        }
        files.push({ path, bytes: entry.dir ? null : await entry.async('uint8array') });
    }
    if (!files.some(file => file.bytes !== null)) throw new Error('The XT ZIP archive contains no files.');
    return files;
}

export async function prepareXtLaunchRom({ launchRomInput, romName, launchSettings }, systemUrl) {
    if (!(launchRomInput instanceof Blob) || !/\.zip$/i.test(romName || '')) return launchRomInput;
    const files = await readXtArchive(launchRomInput);
    const regularFiles = files.filter(file => file.bytes !== null);
    let image;
    if (regularFiles.length === 1 && /\.img$/i.test(regularFiles[0].path)) {
        image = new Blob([regularFiles[0].bytes]);
    } else {
        const response = await fetch(systemUrl);
        if (!response.ok) throw new Error('Could not load the XT DOS boot files.');
        const zip = await JSZip.loadAsync(await response.arrayBuffer(), { checkCRC32: true });
        const system = Object.fromEntries(await Promise.all(Object.values(zip.files)
            .filter(file => !file.dir).map(async file => [file.name, await file.async('uint8array')])));
        image = buildXtDiskImage(files, system, {
            ems: launchSettings?.coreConfig?.virtualxt_ems === 'enabled'
        });
    }
    return {
        launchFiles: [{ fileName: 'vme_xt.img', fileContent: image }],
        primaryFileName: 'vme_xt.img',
        programName: romName,
        saveBlob: launchRomInput,
        suppressDiskUi: true
    };
}
