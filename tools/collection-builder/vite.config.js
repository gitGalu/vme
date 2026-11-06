import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { collectionDownloads } from './server/downloads.js';

export default defineConfig(({ command }) => {
  if (command === 'build') throw new Error('Run npm run collection-builder for this development tool.');
  return {
    root: fileURLToPath(new URL('.', import.meta.url)),
    base: '/', publicDir: false,
    resolve: { alias: { nostalgist: fileURLToPath(new URL('../../nostalgist.js', import.meta.url)) } },
    define: { __APP_VERSION__: JSON.stringify(JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).version) },
    cacheDir: fileURLToPath(new URL('../../node_modules/.vite/collection-builder', import.meta.url)),
    plugins: [collectionDownloads()],
    server: {
      host: '127.0.0.1', port: 8083, strictPort: true,
      fs: { allow: [fileURLToPath(new URL('../../', import.meta.url))] },
      https: ['1', 'true'].includes(process.env.VITE_HTTPS) ? {
        key: readFileSync(new URL('../../certs/dev-key.pem', import.meta.url)),
        cert: readFileSync(new URL('../../certs/dev-cert.pem', import.meta.url))
      } : undefined
    }
  };
});
