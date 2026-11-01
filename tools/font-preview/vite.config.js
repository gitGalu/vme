import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const repository = fileURLToPath(new URL('../../', import.meta.url));
const { version } = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
const useHttps = ['1', 'true'].includes(process.env.VITE_HTTPS);

export default defineConfig(({ command }) => {
    if (command === 'build') {
        throw new Error('Font preview is a local development tool. Run npm run font-preview.');
    }

    return {
        root,
        base: '/',
        publicDir: false,
        cacheDir: fileURLToPath(new URL('../../node_modules/.vite/font-preview', import.meta.url)),
        resolve: {
            alias: { nostalgist: fileURLToPath(new URL('../../nostalgist.js', import.meta.url)) },
        },
        define: { __APP_VERSION__: JSON.stringify(version) },
        server: {
            host: true,
            port: 8081,
            strictPort: true,
            fs: { allow: [repository] },
            https: useHttps ? {
                key: readFileSync(new URL('../../certs/dev-key.pem', import.meta.url)),
                cert: readFileSync(new URL('../../certs/dev-cert.pem', import.meta.url)),
            } : undefined,
            headers: {
                'Cross-Origin-Opener-Policy': 'same-origin',
                'Cross-Origin-Embedder-Policy': 'require-corp',
            },
        },
    };
});
