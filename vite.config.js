import { defineConfig } from 'vite';
import { readFileSync } from 'fs';
import obfuscator from 'rollup-plugin-obfuscator';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'node:fs';
import path from 'node:path';

const packageJson = JSON.parse(readFileSync('package.json', 'utf-8'));
const version = packageJson.version;

const useHttps = process.env.VITE_HTTPS === '1' || process.env.VITE_HTTPS === 'true';
const base = process.env.VITE_BASE || '/vme/';
const pwaStartUrl = process.env.VITE_PWA_START_URL || 'https://gitgalu.github.io/vme/?source=pwa';
const pwaScope = process.env.VITE_PWA_SCOPE || '';

const LAN_HOST = process.env.VITE_LAN_HOST || '192.168.50.41';

const CERT_KEY = path.resolve('certs/dev-key.pem');
const CERT_CERT = path.resolve('certs/dev-cert.pem');

// Import bundles (vme_import.zip, vme_collection.zip, a8_vme_collection.zip - CLI 'OPEN IA/COL/A8')
// live outside git and are published only by `build:server` (own server, not GitHub Pages).
const PRIVATE_ASSETS_DIR = path.resolve('private-assets');

export default defineConfig(({ command }) => {
  const includePrivateAssets = command === 'serve'
    ? fs.existsSync(PRIVATE_ASSETS_DIR)
    : process.env.VITE_PRIVATE_ASSETS === '1';

  return {
    base,
    root: 'src',
    resolve: {
      alias: {
        nostalgist: path.resolve(__dirname, 'nostalgist.js'),
      },
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
      },
      mangle: {
        reserved: ['Nostalgist'],
      },
      obfuscatorOptions: {
        compact: true,
        controlFlowFlattening: true,
        controlFlowFlatteningThreshold: 0.75,
        deadCodeInjection: true,
        deadCodeInjectionThreshold: 0.4,
        debugProtection: true,
        debugProtectionInterval: true,
        disableConsoleOutput: true,
        renameGlobals: false,
        stringArray: true,
        stringArrayEncoding: ['base64'],
        stringArrayThreshold: 0.75,
      },
    },
    define: {
      __APP_VERSION__: JSON.stringify(version),
    },
    esbuild: {
      exclude: /node_modules/,
    },
    plugins: [
      viteStaticCopy({
        targets: [
          { src: 'libretro/*', dest: 'libretro' },
          { src: 'assets/shaders/*', dest: 'assets/shaders' },
          { src: 'assets/boot/*', dest: 'assets/boot' },
          // Include the font package's license alongside the bundled font.
          { src: 'assets/fonts/pixel-operator', dest: 'assets/fonts' },
          { src: 'assets/images/vme-512.png', dest: '.' },
          { src: 'thumbnail-index/*', dest: 'thumbnail-index' },
          ...(includePrivateAssets ? [{ src: '../private-assets/*.zip', dest: 'assets' }] : []),
        ],
      }),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        manifest: {
          name: 'VM/E',
          short_name: 'VM/E',
          start_url: pwaStartUrl,
          ...(pwaScope ? { scope: pwaScope } : {}),
          display: 'fullscreen',
          theme_color: '#000000',
          background_color: '#000000',
          icons: [
            {
              src: 'vme-512.png',
              sizes: '512x512',
              type: 'image/png',
            },
          ],
        },
        srcDir: '.',
        filename: 'sw.js',
        strategies: 'injectManifest',
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,png}'],
        },
      }),
      obfuscator({
        // Vite must see literal lazy-import paths before bundling these loaders.
        exclude: ['node_modules/**', '**/cli/SplashCommand.js', '**/startup/SplashScreen.js'],
      }),
    ],

    server: {
      host: true,
      port: 8080,
      strictPort: true,
      open: true,

      https: useHttps
        ? {
          key: fs.readFileSync(CERT_KEY),
          cert: fs.readFileSync(CERT_CERT),
        }
        : false,

      hmr: {
        protocol: useHttps ? 'wss' : 'ws',
        host: LAN_HOST,
        port: 8080,
      },

      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      },
    },

    build: {
      outDir: '../dist',
      rollupOptions: {
        input: './src/index.html',
        output: {
          format: 'es',
        },
      },
    },
  };
});
