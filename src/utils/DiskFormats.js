import JSZip from 'jszip';

// A disk image format the browser build of a core cannot load (e.g. IPF needs the SPS CAPS
// library, which the emscripten PUAE cannot dlopen).
export class UnsupportedDiskFormatError extends Error {
    constructor(format, fileName) {
        super(`Unsupported disk image format: ${format} (${fileName})`);
        this.name = 'UnsupportedDiskFormatError';
        this.format = format;
        this.fileName = fileName;
    }
}

function getExtension(name) {
    const match = /\.([^./\\]+)$/.exec(String(name || ''));
    return match ? match[1].toLowerCase() : '';
}

/**
 * Throws UnsupportedDiskFormatError when the program is an unsupported disk image, or a ZIP
 * whose disk images are all unsupported ones (a ZIP that also holds a usable image is fine).
 * formats = { supported: ['adf', ...], unsupported: ['ipf', ...] } (platform `disk_formats`).
 */
export async function assertSupportedDiskFormat(blob, fileName, formats) {
    const unsupported = formats?.unsupported ?? [];
    if (unsupported.length === 0) {
        return;
    }

    const extension = getExtension(fileName);
    if (unsupported.includes(extension)) {
        throw new UnsupportedDiskFormatError(extension, fileName);
    }
    if (extension !== 'zip' || !(blob instanceof Blob)) {
        return;
    }

    let zip;
    try {
        zip = await JSZip.loadAsync(await blob.arrayBuffer());
    } catch {
        return; // not readable here - let the core decide
    }
    const names = Object.values(zip.files).filter(entry => !entry.dir).map(entry => entry.name);
    const supported = formats?.supported ?? [];
    if (names.some(name => supported.includes(getExtension(name)))) {
        return;
    }
    const blocked = names.find(name => unsupported.includes(getExtension(name)));
    if (blocked) {
        throw new UnsupportedDiskFormatError(getExtension(blocked), blocked);
    }
}
