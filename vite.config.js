import { defineConfig } from 'vite';
import { readFileSync } from 'fs';
import obfuscator from 'rollup-plugin-obfuscator';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { VitePWA } from 'vite-plugin-pwa';

const packageJson = JSON.parse(readFileSync('package.json', 'utf-8'));
const version = packageJson.version;

export default defineConfig({
    base: '/vme/',
    root: 'src',
    minify: 'terser',
    terserOptions: {
        compress: {
            drop_console: true,
        },
        mangle: {
            reserved: ['Nostalgist']
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
            stringArrayThreshold: 0.75
        }
    },
    define: {
        __APP_VERSION__: JSON.stringify(version),
    },
    esbuild: {
        exclude: /node_modules/
    },
    plugins: [
        viteStaticCopy({
            targets: [
                {
                    src: 'libretro/**',
                    dest: 'libretro'
                },
                {
                    src: 'assets/shaders/*',
                    dest: 'assets/shaders'
                },
                {
                    src: 'assets/images/vme-512.png',
                    dest: '.'
                }
            ]
        }),
        VitePWA({
            registerType: 'autoUpdate',
            injectRegister: 'auto',
            manifest: {
                name: 'VM/E',
                short_name: 'VM/E',
                display: 'standalone',
                theme_color: '#000000',
                background_color: '#000000',
                icons: [
                    {
                        src: 'vme-512.png',
                        sizes: '512x512',
                        type: 'image/png',
                    },
                ],
            }
            ,
            srcDir: '.',
            filename: 'sw.js',
            strategies: 'injectManifest',
            injectManifest: {
                globPatterns: ['**/*.{js,css,html,png}'],
            },
        }),
        obfuscator({
            exclude: ['node_modules/**'],
        })
    ],
    server: {
        port: 8080,
        open: true,
        hmr: {
            protocol: 'ws',
            host: 'localhost',
        }
    },
    build: {
        outDir: '../dist',
        rollupOptions: {
            input: './src/index.html',
            output: {
                format: 'es',
            }
        }
    }
});