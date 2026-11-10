import { readFile, mkdir, copyFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

// Export individual BIOS files for manual OPEN imports. No firmware is bundled in the app.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, process.argv[2] || '../blueMSX-libretro/system/bluemsx');
const output = resolve(root, 'build/msx/roms');
const files = JSON.parse(await readFile(resolve(root, 'src/platforms/msx-system.json'), 'utf8'));
await mkdir(output, { recursive: true });
for (const file of files) {
    const path = resolve(source, file.path);
    const bytes = await readFile(path);
    if (!file.accepted.includes(createHash('md5').update(bytes).digest('hex'))) {
        throw new Error(`Unexpected BIOS checksum: ${file.key}`);
    }
    await copyFile(path, resolve(output, file.key));
}
console.log(`Prepared ${files.length} individual MSX ROMs in ${output}`);
