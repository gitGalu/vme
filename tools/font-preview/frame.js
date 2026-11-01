import '../../src/styles/vme.css';
import './frame.css';
import markup from '../../src/index.html?raw';
import { CollectionBrowser } from '../../src/CollectionBrowser.js';
import { VME } from '../../src/VME.js';
import { StorageManager } from '../../src/storage/StorageManager.js';
import { COLLECTION_BROWSER_VIEW } from '../../src/Constants.js';
import { BASELINE_STACK, loadFont } from './fonts.js';
import { createDesktopPreview } from './desktop.js';
import { createShellPreview } from './shell.js';

// Resolve images from the application's markup through Vite while this tool
// has its own document root and server.
const appImages = import.meta.glob('../../src/assets/images/*', {
    eager: true, query: '?url', import: 'default',
});

// The real component runs in this isolated frame with in-memory settings and sample data.
// No StorageManager instance (or emulator) is created, and the app's saved settings stay intact.
const values = new Map([[COLLECTION_BROWSER_VIEW, 'grid']]);
StorageManager.getValue = (key, fallback) => values.has(key) ? values.get(key) : fallback;
StorageManager.storeValue = (key, value) => values.set(key, value);
StorageManager.clearValue = key => values.delete(key);

function picture(index) {
    const palettes = [['#0f2038', '#478598', '#a9d6c4'], ['#302046', '#ac6785', '#e0bb8c'],
        ['#152e2b', '#529c73', '#d0c37c'], ['#352722', '#bc8550', '#ded5a5']];
    const [sky, land, light] = palettes[index % palettes.length];
    const stars = Array.from({ length: 24 }, (_, n) =>
        `<rect x="${(n * 47 + index * 13) % 320}" y="${(n * 31) % 135}" width="2" height="2" fill="${light}"/>`).join('');
    const towers = Array.from({ length: 8 }, (_, n) => {
        const height = 20 + (n * 17 + index * 11) % 60;
        return `<rect x="${n * 48 - 8}" y="${198 - height}" width="28" height="${height}" fill="${land}"/>`;
    }).join('');
    const image = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240" shape-rendering="crispEdges">
      <rect width="320" height="240" fill="${sky}"/>${stars}
      <circle cx="${245 - index * 5}" cy="57" r="22" fill="${light}" opacity=".55"/>
      <path d="M0 181 55 131 105 171 158 115 220 162 275 125 320 166V240H0Z" fill="${land}" opacity=".38"/>
      ${towers}<path d="M0 199H320V240H0Z" fill="${land}"/>
      <path d="M0 207H320M0 223H320" stroke="${sky}" stroke-width="3"/>
      <path d="M151 168h10v12h9v6h-13v12h-7v-12h-9v-6h10Z" fill="${light}"/>
      <rect x="32" y="217" width="24" height="4" fill="${light}" opacity=".55"/>
    </svg>`;
    return 'data:image/svg+xml,' + encodeURIComponent(image);
}

const titles = [
    ['Bruce Lee', 'atari800', '1984 · Datasoft'],
    ['The Secret of Monkey Island', 'amiga', '1990 · Lucasfilm Games'],
    ['Super Mario Bros. 3', 'nes', '1988 · Nintendo'],
    ['Pinball Fantasies', 'amiga', '1992 · Digital Illusions'],
    ['Worms', 'amiga', '1995 · Team17'],
    ['Prince of Persia', 'dos', '1989 · Brøderbund'],
    ['The Legend of Zelda: A Link to the Past', 'snes', '1991 · Nintendo'],
    ['Another World', 'st', '1991 · Delphine Software'],
    ['Sonic the Hedgehog', 'smd', '1991 · Sega'],
    ['Speedball 2: Brutal Deluxe', 'amiga', '1990 · The Bitmap Brothers'],
    ['Zażółć gęślą jaźń', 'atari800', 'Próba polskich znaków · 0123456789'],
    ['Super Castlevania IV', 'snes', '1991 · Konami'],
];
const items = titles.map(([title, platform_id, credits], index) => ({
    id: index + 1, rom_data_id: index + 1, title, platform_id, credits, image: picture(index),
}));

window.previewReady = (async () => {
    const source = new DOMParser().parseFromString(markup, 'text/html');
    for (const img of source.querySelectorAll('img[src]')) {
        const path = '../../src/' + img.getAttribute('src').replace(/^\.\//, '');
        if (appImages[path]) img.src = appImages[path];
    }
    const root = source.getElementById('collection-browser');
    document.body.append(root);
    document.documentElement.style.setProperty('--preview-font', BASELINE_STACK);
    const desktop = createDesktopPreview(source, items[0].image);
    const shell = createShellPreview(source, items, values);
    const collectionViews = new Set(['grid', 'coverflow']);
    let activeView = 'grid';
    let browser;
    const app = {
        getGamepadManager: () => null,
        toggleScreen: mode => {
            if (!collectionViews.has(activeView)) return;
            root.style.display = 'flex';
            if (mode === VME.CURRENT_SCREEN.MENU) queueMicrotask(() => browser.open());
        },
    };
    browser = new CollectionBrowser(app, { updatePlatform() {} }, {
        getAllSaveMeta: async () => [{ id: 1, platform_id: 'atari800', rom_data_id: 1, timestamp: Date.now() }],
        getCollectionItems: async () => items.map(item => ({ ...item })),
    }, { reset() {} });

    // Keep sample launch controls useful for typography: they open the real choice overlay.
    const launchControls = '#collectionBrowserUiLoad, #collectionBrowserUiRestore';
    root.addEventListener('mousedown', event => {
        if (event.target.closest(launchControls)) { event.preventDefault(); event.stopImmediatePropagation(); }
    }, true);
    root.addEventListener('mouseup', event => {
        if (event.target.closest(launchControls)) event.stopImmediatePropagation();
    }, true);
    root.addEventListener('click', event => {
        if (event.target.closest('#collectionLaunchOverlay .gm-item')) {
            event.stopImmediatePropagation();
            document.getElementById('collectionLaunchOverlay').classList.remove('visible');
        } else if (event.target.closest(`${launchControls}, .collection-grid-cell.focused, .flicking-panel.active`)) {
            event.preventDefault();
            event.stopImmediatePropagation();
            browser.showLaunchChoiceOverlay();
        }
    }, true);
    document.addEventListener('keydown', event => {
        if (activeView === 'shell' || activeView === 'shell-vr') {
            shell.handleKey(event);
            return;
        }
        if (!collectionViews.has(activeView)) return;
        if (event.key === 'Enter') {
            event.preventDefault();
            event.stopImmediatePropagation();
            if (browser.isLaunchChoiceOpen()) document.getElementById('collectionLaunchOverlay').classList.remove('visible');
            else browser.showLaunchChoiceOverlay();
        }
    }, true);

    window.fontPreview = {
        loadFont,
        applyFont(stack) {
            document.documentElement.style.setProperty('--preview-font', stack);
            shell.applyFont(stack);
        },
        async setView(view) {
            if (!['grid', 'coverflow', 'desktop', 'shell', 'shell-vr'].includes(view)) view = 'grid';
            const selected = root.querySelector('.collection-grid-cell.focused, .flicking-panel.active')?.dataset.id || 1;
            const previous = activeView;
            activeView = view;
            document.body.dataset.previewView = view;
            if (collectionViews.has(view)) {
                desktop.close();
                shell.close();
                root.style.display = 'flex';
                values.set(COLLECTION_BROWSER_VIEW, view);
                await browser.open(1, Number(selected));
            } else {
                if (collectionViews.has(previous)) browser.close();
                root.style.display = 'none';
                if (view === 'desktop') { shell.close(); desktop.open(); }
                else { desktop.close(); shell.open(view); }
            }
        },
        showLabels(show) { root.classList.toggle('preview-all-labels', show); },
    };
    new MutationObserver(() => {
        if (collectionViews.has(activeView) && root.dataset.view !== activeView) {
            activeView = root.dataset.view;
            document.body.dataset.previewView = activeView;
        }
    }).observe(root, { attributes: true, attributeFilter: ['data-view'] });
    document.getElementById('desktopUiBack').addEventListener('click', () => window.fontPreview.setView('grid'));
    await window.fontPreview.setView('grid');
    return window.fontPreview;
})();
