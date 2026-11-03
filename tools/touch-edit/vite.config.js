import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export default defineConfig(({ command }) => {
    if (command === 'build') {
        throw new Error('Touch editor is a local development tool. Run npm run touch-edit.');
    }

    return {
        root: fileURLToPath(new URL('.', import.meta.url)),
        base: '/',
        publicDir: false,
        cacheDir: fileURLToPath(new URL('../../node_modules/.vite/touch-edit', import.meta.url)),
        server: {
            host: true,
            port: 8082,
            strictPort: true,
            fs: { allow: [fileURLToPath(new URL('../../', import.meta.url))] },
            https: ['1', 'true'].includes(process.env.VITE_HTTPS) ? {
                key: readFileSync(new URL('../../certs/dev-key.pem', import.meta.url)),
                cert: readFileSync(new URL('../../certs/dev-cert.pem', import.meta.url)),
            } : undefined,
        },
    };
});
