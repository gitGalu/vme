import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';

const files = JSON.parse(await readFile(new URL('../src/platforms/msx-system.json', import.meta.url), 'utf8'));

test('each MSX model has individual ROM dependencies for every file referenced by its machine configuration', async () => {
    const paths = new Set();
    const hashes = new Set();
    for (const file of files) {
        assert.equal(file.key, file.path.split('/').pop());
        assert.ok(!paths.has(file.path), 'Dependency paths must be unique');
        paths.add(file.path);
        for (const hash of file.accepted) {
            assert.match(hash, /^[a-f0-9]{32}$/);
            assert.ok(!hashes.has(hash), 'OPEN must recognise each ROM unambiguously');
            hashes.add(hash);
        }
    }
    for (const model of ['MSX', 'MSX2', 'MSX2+', 'MSXturboR']) {
        const config = await readFile(new URL(`../src/assets/msx/Machines/${model}/config.ini`, import.meta.url), 'utf8');
        const referenced = [...config.matchAll(/"(Machines\/[^"\r\n]+)"/g)].map(match => match[1]);
        assert.deepEqual(files.filter(file => file.machines.includes(model)).map(file => file.path).sort(), referenced.sort());
    }
});
