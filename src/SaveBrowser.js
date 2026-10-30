import { archiveSelection, saveGameKey } from './utils/ArchivePrograms.js';
import { s, addButtonEventListeners, removeButtonEventListeners } from "./dom";
import { VME } from './VME.js';
import Flicking from "@egjs/flicking";
import "@egjs/flicking/dist/flicking.css";
import { SelectedPlatforms } from './platforms/PlatformManager.js';
import { CustomDropdown } from './components/CustomDropdown.js';
import { FileUtils } from './utils/FileUtils.js';
import { t, browserT } from './i18n/shellStrings.js';
import { ToastManager } from './ui/ToastManager.js';
import { setBackdropImage, clearBackdrop } from './ui/BrowserBackdrop.js';
import { CarouselKeyRepeat } from './ui/CarouselKeyRepeat.js';
import { showBrowserEmpty } from './ui/BrowserEmptyState.js';
import { BrowserSearch } from './ui/BrowserSearch.js';
import { CollectionGrid } from './CollectionGrid.js';
import { StorageManager } from './storage/StorageManager.js';

// Game list <-> game saves switch: the .view-exit fade (CSS, 0.15s) and the .view-enter
// animation (CSS, 0.3s) - keep in sync with vme.css.
const SAVE_BROWSER_VIEW = 'SAVE_BROWSER_VIEW';
const VIEW_EXIT_MS = 150;
const VIEW_ENTER_MS = 300;
const TOOLBAR_ENTER_MS = 300;

export class SaveBrowser {
    #vme;
    #platform_manager;
    #db;
    #cli;
    #flicking;
    #grid = null;
    #useGrid = false;
    #viewItems = [];
    #selected;
    #launched;
    #kb_event_bound;
    #wheel_event_bound;
    #filter_change_handler_bound;
    #wheelReleaseTimer = null;
    #wheelPixelThreshold = 35;
    #wheelLineThreshold = 1;
    #wheelScrollMultiplier = 0.45;
    #wheelSnapDelay = 160;
    #eventListeners = [];
    #buttonElements = new Set();
    #backButton;
    #backHandler;
    #currentPlatformFilter = "all";
    #isGameView = false;
    #uiReady = false;
    #viewReady = false;
    #filterEditing = false;
    #lastGamePosition = null;
    #platformDropdown = null;
    #search;
    #gameListItems = [];
    #gameListReady = false;
    #searchSelectionKey = null;
    #lastSearchQuery = '';
    #lastGameKey = null;
    #viewGeneration = 0;
    #toolbarEntryPending = false;
    #toolbarEntryTimer = null;
    #screenshotUrls = new Map();

    #overlayItems = [];
    #overlayOptions = [];
    #overlayFocus = 0;

    #urlsToRevoke = new Set();
    #isDestroying = false;
    #deleting = false;
    #keyRepeat;
    #lastBackgroundUpdate = 0;
    #lastParallaxUpdate = 0;
    #backdropZoomInPending = false;

    constructor(vme, platform_manager, storage_manager, cli) {
        this.#vme = vme;
        this.#platform_manager = platform_manager;
        this.#db = storage_manager;
        this.#cli = cli;
        this.#search = new BrowserSearch(items => this.#applySearch(items), () => {
            if (!this.#search.isOpen) this.#grid?.scrollFocusedIntoView(true);
            const gm = this.#vme.getGamepadManager();
            if (!gm?.hasGamepad?.()) return;
            if (this.#search.padActive) {
                gm.showLegendActions?.([
                    { glyph: 'A', label: t('legend.type') },
                    { glyph: 'B', label: t('legend.back') },
                    { glyph: 'Y', label: t('legend.delete') },
                    { glyph: 'X', label: t('legend.list') },
                ]);
            } else gm.updateBrowserLegend?.();
        }, () => this.#activateSelection(), () => this.#vme.getKeyboardManager?.(), {
            rootId: 'save-browser', prefix: 'saveBrowser', getTitle: item => this.#displayCaption(item),
        });

        this.#kb_event_bound = this.#handleKeyboard.bind(this);
        this.#keyRepeat = new CarouselKeyRepeat((direction, duration) => {
            if (!this.#flicking) return Promise.reject();
            this.#setUIReady(false);
            const move = direction > 0 ? this.#flicking.next(duration) : this.#flicking.prev(duration);
            return move.catch((err) => {
                this.#setUIReady(true);
                throw err;
            });
        });
        this.#wheel_event_bound = this.#handleWheel.bind(this);

        this.#filter_change_handler_bound = this.#filterChangeHandler.bind(this);

        this.#backButton = s('#saveBrowserUiBack');
        this.#backButton.classList.remove('disabled');

        this.#backHandler = (pressed) => {
            if (pressed) {
                if (this.#isGameView) {
                    this.#showGameList(this.#lastGamePosition);
                } else {
                    this.close();
                    this.#vme.toggleScreen(VME.CURRENT_SCREEN.MENU);
                }
            }
        };


        const platformFilter = document.getElementById('platformFilter');
        if (platformFilter) {
            platformFilter.remove();
        }

        const platformFilterContainer = document.getElementById('platformFilterContainer');
        platformFilterContainer.classList.add('none');
        const dropdownContainer = document.createElement('div');
        dropdownContainer.id = 'platformDropdownContainer';
        platformFilterContainer.appendChild(dropdownContainer);

        this.#platformDropdown = new CustomDropdown('platformDropdownContainer', [
            { value: 'all', text: 'All platforms' }
        ], 'all', { searchable: true, pinnedValue: 'all' });

        this.#platformDropdown.onOpenChange(open => {
            this.#filterEditing = open;
            document.getElementById('save-browser').classList.toggle('filter-editing', open);
            if (open) {
                this.#keyRepeat.stop();
                this.#search.flush();
                this.#search.finish();
            }
        });
        this.#platformDropdown.onChange((e) => {
            this.#filterChangeHandler(e);
        });

        this.#uiReady = false;
    }

    #setUIReady(ready) {
        this.#uiReady = ready;
        const buttons = ['saveBrowserUiOpen', 'saveBrowserUiDelete', 'saveBrowserUiLoad'];
        buttons.forEach(id => {
            const button = document.getElementById(id);
            if (button) {
                if (!ready) {
                    button.classList.add('disabled');
                } else if (this.#selected) {
                    button.classList.remove('disabled');
                }
            }
        });
    }

    #setViewReady(ready) {
        this.#viewReady = ready;
        document.getElementById('saveBrowserUiView')?.classList.toggle('disabled', !ready);
    }

    #bindPanelEvents(panels) {
        if (!this.#flicking || this.#isDestroying) return;
    
        const throttledParallax = this.#throttle(this.#updateParallax.bind(this), 16);
        const debouncedBackground = this.#debounce(this.#updateBackground.bind(this), 16);
    
        this.#flicking.on("changed", e => {
            debouncedBackground();
            this.#updateActivePanel();
            this.#setUIReady(true);
        });
    
        this.#flicking.on("move", e => {
            throttledParallax();
            this.#setUIReady(false);
        });
    
        this.#flicking.on("moveEnd", e => {
            this.#updateActivePanel();
            this.#setUIReady(true);
        });
    
        panels.forEach((panel, index) => {
            const clickHandler = () => {
                if (this.#isDestroying) return;

                const currentPanel = this.#flicking.currentPanel;

                if (currentPanel && currentPanel.element === panel) {
                    if (this.#flicking.animating) {
                        return;
                    }
                    if (this.#selected && this.#uiReady) {
                        if (!this.#isGameView) {
                            const programName = panel.getAttribute('data-program-name');
                            const platformId = panel.getAttribute('data-platform-id');
                            this.#showGameSaves(programName, platformId, panel.getAttribute('data-game-key'));
                        } else {
                            this.#loadSelected();
                        }
                    }
                } else {
                    this.#setUIReady(false);
                    this.#flicking.moveTo(index).catch(err => {
                        this.#setUIReady(true);
                    });
                }
            };
    
            panel.addEventListener("click", clickHandler, { passive: true });
            this.#eventListeners.push({ element: panel, handler: clickHandler, type: 'click' });
        });
    }

    #unbindPanelEvents() {
        this.#flicking.off("changed");
        this.#flicking.off("move");
        this.#flicking.off("moveEnd");

        this.#eventListeners = this.#eventListeners.filter(({ element, handler, type }) => {
            if (type !== 'click') return true; // retain the viewport's wheel listener
            element.removeEventListener('click', handler);
            return false;
        });
    }

    #displayCaption(item) {
        const caption = item.caption ?? FileUtils.cleanRomName(item.program_name);
        const entryPath = archiveSelection(item.launch_core_config)?.entryPath;
        if (typeof entryPath !== 'string' || !entryPath) return caption;

        const filename = entryPath.split('/').pop();
        // Auto-generated ZIP captions include the entry and its source archive.
        // Keep the selected version's filename, including tags such as (v1),
        // while preserving captions explicitly named by the user.
        const generated = item.caption == null || item.caption === item.program_name
            || (typeof caption === 'string' && [entryPath, filename].some(name =>
                caption === name || caption.startsWith(`${name} · `) || caption.startsWith(`${name} * `)));
        return generated ? filename : caption;
    }

    #createPanelHTML(item) {
        if (item.platform_id == "md") item.platform_id = "smd"; //temp fix
        const platform = Object.values(SelectedPlatforms).find(platform => platform.platform_id === item.platform_id)
            || { platform_id: item.platform_id || 'unknown', short_name: (item.platform_id || 'UNKNOWN').toUpperCase() };
        this.#addFilterItem(platform.platform_id, platform.short_name);

        const fallbackImage = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(
            "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 640 480'><rect width='640' height='480' fill='#141414'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='#9b9b9b' font-family='monospace' font-size='30'>No Preview</text></svg>"
        );
        let url = fallbackImage;
        if (item.screenshot instanceof Blob) {
            url = this.#screenshotUrls.get(item.id);
            if (!url) {
                url = URL.createObjectURL(item.screenshot);
                this.#screenshotUrls.set(item.id, url);
                this.#urlsToRevoke.add(url);
            }
        }

        const caption = this.#displayCaption(item);

        const timestamp = new Date(item.timestamp).toLocaleString();
        const timeDisplay = this.#isGameView ? `<div class="flicking-title save-card-timestamp">${escapeHTML(timestamp)}</div>` : '';
        const quicksaveLabel = (this.#isGameView && item.is_quicksave === true) ? `<div class="flicking-title save-card-quicksave">QUICKSAVE</div>` : '';

        return `
            <div class="flicking-panel" data-id="${item.id}" data-game-key="${encodeURIComponent(saveGameKey(item))}" data-program-name="${escapeHTML(item.program_name)}" data-platform-id="${platform.platform_id}">
                <img src="${url}" alt="${escapeHTML(item.program_name)}">
                <div class="save-card-caption">
                    ${timeDisplay}
                    <div class="flicking-title flicking-title-name">${escapeHTML(caption)} (${platform.short_name})</div>
                    ${quicksaveLabel}
                </div>
            </div>
        `;
    }

    #addFilterItem(platform_id, platform_name) {
        if (!this.#platformDropdown) return;

        const platformFilterContainer = document.getElementById('platformFilterContainer');

        this.#platformDropdown.addOption(platform_id, platform_name);

        const currentOptions = this.#platformDropdown.options || [];
        if (currentOptions.length > 1) {
            platformFilterContainer.style.display = '';
        }
    }

    #clearPanels() {
        this.#viewItems = [];
        if (this.#grid) { this.#grid.setItems([]); return; }
        if (!this.#flicking) return;
        this.#unbindPanelEvents();
        const count = this.#flicking.panelCount;
        if (count) this.#flicking.remove(0, count);
    }

    #appendPanels(items, initialIndex = 0) {
        this.#viewItems = items;
        if (this.#grid) {
            this.#grid.setItems(items, initialIndex);
            this.#updateUI();
            return;
        }
        if (items.length) this.#flicking.append(items.map(item => this.#createPanelHTML(item)));
        this.#unbindPanelEvents();
        this.#bindPanelEvents(this.#flicking.panels.map(panel => panel.element));
        this.#flicking.resize();
        if (this.#flicking.currentPanel) this.#flicking.moveTo(this.#flicking.currentPanel.index, 0).catch(() => {});
        this.#updateUI();
    }

    #renderGameList(items, preferredKey, preferredPosition = 0) {
        if (this.#flicking?.animating) this.#flicking.control.stopAnimation();
        this.#keyRepeat.stop();
        clearTimeout(this.#wheelReleaseTimer);
        this.#wheelReleaseTimer = null;
        const match = items.findIndex(item => encodeURIComponent(saveGameKey(item)) === preferredKey);
        const index = match >= 0 ? match : Math.min(Math.max(0, preferredPosition), Math.max(0, items.length - 1));
        if (!this.#grid) this.#clearPanels();
        this.#appendPanels(items, index);
        if (!this.#grid && items.length) this.#flicking.moveTo(index, 0).catch(() => {});
        this.#updateUI();
    }

    #applySearch(items) {
        if (this.#isGameView || !this.#gameListReady || !this.#activeView || this.#isDestroying) return;
        let key = this.#activeView?.currentPanel?.element.dataset.gameKey;
        if (!this.#lastSearchQuery && this.#search.query) this.#searchSelectionKey = key;
        if (!this.#search.query) key = this.#searchSelectionKey ?? key;
        this.#lastSearchQuery = this.#search.query;
        this.#renderGameList(items, key);
        this.#setUIReady(true);
    }

    #showEmpty() {
        const title = this.#search.query && !this.#isGameView ? 'browser.search.empty' : 'browser.saves.empty';
        const hint = this.#search.query && !this.#isGameView ? 'browser.search.emptyHint' : 'browser.saves.emptyHint';
        showBrowserEmpty(document.getElementById('saveBrowserEmpty'), browserT(title), browserT(hint));
    }

    #updateUI() {
        this.#updateActivePanel();
        this.#updateBackground();
    }

    #updateBackground() {
        const now = performance.now();
        if (now - this.#lastBackgroundUpdate < 16) { // ~60fps
            return;
        }
        this.#lastBackgroundUpdate = now;

        const currentPanel = this.#activeView?.currentPanel;
        const el = document.getElementById('flicking-background');

        if (!el || !currentPanel) {
            if (el) clearBackdrop(el);
            return;
        }

        const img = currentPanel.element.querySelector('img');
        if (!img?.src) return;

        // Crossfade; transform (scale + parallax) is left to #updateParallax so the outgoing
        // image doesn't jump while fading.
        setBackdropImage(el, img.src);
        if (this.#backdropZoomInPending) {
            this.#backdropZoomInPending = false;
            el.classList.remove('backdrop-zoom-start');
        }
    }

    #updateParallax() {
        if (!this.#flicking?.camera || this.#isDestroying) return;
    
        const background = document.getElementById('flicking-background');
        if (!background) return;
    
        const now = performance.now();
        if (now - this.#lastParallaxUpdate < 16) return;
        this.#lastParallaxUpdate = now;
    
        const flickingWidth = this.#flicking.element.clientWidth;
        const scrollRatio = this.#flicking.camera.position / flickingWidth;
    
        background.style.setProperty('--backdrop-shift', `${scrollRatio * 50}px`);
    }

    #updateActivePanel() {
        const activePanel = this.#activeView?.currentPanel;
        if (activePanel != null) {
            document.getElementById('saveBrowserEmpty').style.display = "none";

            const loadButton = document.getElementById('saveBrowserUiLoad');
            const deleteButton = document.getElementById('saveBrowserUiDelete');
            const openButton = document.getElementById('saveBrowserUiOpen');

            if (this.#isGameView) {
                loadButton.classList.toggle('disabled', !this.#uiReady);
                deleteButton.classList.toggle('disabled', !this.#uiReady);
                openButton.classList.add('disabled');
            } else {
                loadButton.classList.add('disabled');
                deleteButton.classList.add('disabled');
                openButton.classList.toggle('disabled', !this.#uiReady);
            }

            const panels = document.querySelectorAll("#save-browser .flicking-panel, #save-grid .collection-grid-cell");
            panels.forEach(panel => panel.classList.remove("active"));
            activePanel.element.classList.add("active");
            this.#selected = true;
        } else {
            this.#showEmpty();
            document.getElementById('saveBrowserUiLoad').classList.add('disabled');
            document.getElementById('saveBrowserUiDelete').classList.add('disabled');
            document.getElementById('saveBrowserUiOpen').classList.add('disabled');
            this.#selected = false;
        }
    }

    open() {
        this.#currentPlatformFilter = "all";
        if (this.#platformDropdown) {
            this.#platformDropdown.setValue("all");
        }
        // Breadcrumb label follows shell language ("Save states" / "Stany gry").
        const crumbLabel = document.getElementById('saveBrowserCrumbLabel');
        if (crumbLabel) crumbLabel.textContent = t('crumb.saves');
        this.#updateCrumbFilter();

        let div = document.querySelector('#save-browser');
        div.classList.add('show');
        this.#destroy();
        document.getElementById('saveBrowserUi').style.removeProperty('display');
        this.#toolbarEntryPending = true;
        div.classList.add('toolbar-enter-pending');
        this.#search.bind();
        const platformContainer = document.getElementById('platformFilterContainer');
        const finishSearch = () => this.#search.finish();
        platformContainer.addEventListener('pointerdown', finishSearch);
        this.#eventListeners.push({ element: platformContainer, handler: finishSearch, type: 'pointerdown' });
        const filterKeys = event => this.#handleFilterKeyboard(event);
        const filterFocus = event => {
            // Pointer clicks toggle the dropdown themselves; Tab focus opens it immediately.
            if (event.target.matches?.('.custom-dropdown:focus-visible')) this.#openKeyboardFilter();
        };
        const filterBlur = event => {
            if (!platformContainer.contains(event.relatedTarget)) this.#platformDropdown.close();
        };
        for (const [type, handler] of [['keydown', filterKeys], ['focusin', filterFocus], ['focusout', filterBlur]]) {
            platformContainer.addEventListener(type, handler, type === 'keydown');
            this.#eventListeners.push({ element: platformContainer, handler, type, capture: type === 'keydown' });
        }


        if (this.#backButton && this.#backHandler) {
            addButtonEventListeners(this.#backButton, this.#backHandler);
            this.#buttonElements.add(this.#backButton);
        }

        this.#useGrid = StorageManager.getValue(SAVE_BROWSER_VIEW, 'coverflow') === 'grid';
        this.#createView();
        const viewButton = document.getElementById('saveBrowserUiView');
        const toggleView = pressed => { if (pressed) this.#toggleView(); };
        addButtonEventListeners(viewButton, toggleView);
        this.#buttonElements.add(viewButton);

        const fb = document.getElementById('flicking-background');
        fb.classList.remove('show');
        // Entry "camera" zoom: start at 1x and zoom in to the full 12x (background-size
        // transition, see vme.css) once the first screenshot is on the backdrop.
        fb.classList.add('backdrop-zoom-start');
        this.#backdropZoomInPending = true;
        setTimeout(() => {
            fb.classList.add('show');
        }, 10);
    
        this.#showGameList();

        document.addEventListener("keydown", this.#kb_event_bound);
    
        const deleteButton = s('#saveBrowserUiDelete');
        const deleteHandler = (pressed) => {
            if (pressed && this.#selected && this.#uiReady) {
                this.#deleteSelectedPanel();
            }
        };
        addButtonEventListeners(deleteButton, deleteHandler);
        this.#buttonElements.add(deleteButton);
    
        const loadButton = s('#saveBrowserUiLoad');
        const loadHandler = (pressed) => {
            if (pressed && this.#selected && this.#uiReady) {
                this.#loadSelected();
            }
        };
        addButtonEventListeners(loadButton, loadHandler);
        this.#buttonElements.add(loadButton);
    
        const openButton = s('#saveBrowserUiOpen');
        const openHandler = (pressed) => {
            if (pressed && this.#selected && this.#uiReady) {
                const activePanel = this.#activeView?.currentPanel;
                if (activePanel) {
                    const programName = activePanel.element.getAttribute('data-program-name');
                    const platformId = activePanel.element.getAttribute('data-platform-id');
                    this.#showGameSaves(programName, platformId, activePanel.element.getAttribute('data-game-key'));
                }
            }
        };
        addButtonEventListeners(openButton, openHandler);
        this.#buttonElements.add(openButton);

        this.#initGamepadNavigation();

        this.#vme.toggleScreen(VME.CURRENT_SCREEN.SAVE_BROWSER);
    }

    #revealToolbar() {
        if (!this.#toolbarEntryPending) return;
        this.#toolbarEntryPending = false;
        const root = document.getElementById('save-browser');
        root.classList.remove('toolbar-enter-pending');
        root.classList.add('toolbar-enter');
        this.#toolbarEntryTimer = setTimeout(() => {
            root.classList.remove('toolbar-enter');
            this.#toolbarEntryTimer = null;
        }, TOOLBAR_ENTER_MS);
    }

    get #activeView() { return this.#grid ?? this.#flicking; }

    #createGridCell(item, index) {
        const template = document.createElement('template');
        template.innerHTML = this.#createPanelHTML(item).trim();
        const cell = template.content.firstElementChild;
        cell.className = 'collection-grid-cell';
        cell.dataset.index = index;
        cell.querySelector('img').className = 'collection-grid-img';
        cell.querySelector('.save-card-caption').className = 'collection-grid-label';
        cell.querySelectorAll('.flicking-title').forEach(line => line.classList.remove('flicking-title'));
        const title = cell.querySelector('.flicking-title-name');
        title.classList.add('collection-grid-title');
        title.textContent = this.#displayCaption(item);
        const platform = Object.values(SelectedPlatforms).find(value => value.platform_id === item.platform_id);
        const platformLabel = document.createElement('span');
        platformLabel.className = 'collection-grid-platform';
        platformLabel.textContent = platform?.short_name || String(item.platform_id || '').toUpperCase();
        title.after(platformLabel);
        return cell;
    }

    #createView() {
        const root = document.getElementById('save-browser');
        root.dataset.layout = this.#useGrid ? 'grid' : 'coverflow';
        const button = document.getElementById('saveBrowserUiView');
        const label = this.#useGrid ? 'Switch to list view' : 'Switch to grid view';
        button.title = label;
        button.setAttribute('aria-label', label);
        const viewport = document.getElementById('flicking');
        viewport.style.display = this.#useGrid ? 'none' : '';
        if (this.#useGrid) {
            this.#grid = new CollectionGrid({
                rootId: 'save-grid', items: [],
                renderCell: (item, index) => this.#createGridCell(item, index),
                onActivate: () => this.#activateSelection(),
            });
            this.#grid.open();
            this.#grid.on('changed', () => this.#updateUI());
        } else {
            this.#flicking = new Flicking("#flicking", {
                circular: true,
                moveType: "snap",
                preventClickOnDrag: true,
                autoResize: true,
                // Panel width = screenshot width, so re-measure panels once their images load.
                // Without it a panel growing to the LEFT of the current one shifts the whole
                // camera row (visible jumps when swiping left on mobile).
                resizeOnContentsReady: true,
                align: "center",
                duration: 350
            });

            const flickingElement = this.#flicking?.element;
            if (flickingElement) {
                flickingElement.addEventListener('wheel', this.#wheel_event_bound, { passive: false });
                this.#eventListeners.push({ element: flickingElement, handler: this.#wheel_event_bound, type: 'wheel' });
            }
        }
    }

    #toggleView() {
        if (!this.#viewReady || this.#isDestroying || this.#deleting) return;
        this.#platformDropdown.close();
        this.#search.flush();
        if (this.#flicking?.animating) this.#flicking.control.stopAnimation();
        const index = this.#activeView?.currentPanel?.index ?? 0;
        const items = this.#viewItems;
        this.#keyRepeat.stop();
        clearTimeout(this.#wheelReleaseTimer);
        this.#wheelReleaseTimer = null;
        this.#vme.getGamepadManager()?.clearBrowserNavigation();
        this.#grid?.destroy();
        this.#grid = null;
        if (this.#flicking) {
            this.#clearPanels();
            this.#flicking.destroy();
            this.#flicking = null;
        }
        // Wheel listeners belong to the old viewport; card clicks are removed by #clearPanels.
        this.#eventListeners = this.#eventListeners.filter(entry => {
            if (entry.type !== 'wheel') return true;
            entry.element.removeEventListener(entry.type, entry.handler);
            return false;
        });
        for (const id of ['flicking', 'save-grid']) document.getElementById(id).classList.remove('view-enter', 'view-exit');
        this.#useGrid = !this.#useGrid;
        StorageManager.storeValue(SAVE_BROWSER_VIEW, this.#useGrid ? 'grid' : 'coverflow');
        this.#createView();
        this.#appendPanels(items, index);
        if (!this.#grid && items.length) this.#flicking.moveTo(index, 0).catch(() => {});
        this.#updateUI();
        this.#setUIReady(true);
        this.#revealToolbar();
        this.#initGamepadNavigation();
    }

    #initGamepadNavigation() {
        const gamepadManager = this.#vme.getGamepadManager();
        if (gamepadManager) {
            const buttonIds = ['saveBrowserUiBack', 'saveBrowserUiView', 'platformDropdownContainer', 'saveBrowserUiDelete', 'saveBrowserUiLoad', 'saveBrowserUiOpen'];
            // Platform-filter overlay (shell style) - only in gamepad skin mode.
            const skin = document.body.classList.contains('gamepad-browser-skin');
            const overlay = {
                xOpens: skin, topBar: !skin,
                show: () => this.showPlatformOverlay(),
                isOpen: () => this.isPlatformOverlayOpen(),
                navigate: (d) => this.navigatePlatformOverlay(d),
                select: () => this.selectPlatformOverlay(),
                hide: () => this.#hidePlatformOverlay(),
                search: {
                    isAvailable: () => !this.#isGameView,
                    handleInput: gamepad => !this.#isGameView && !this.isPlatformOverlayOpen() && this.#search.handleGamepad(gamepad),
                },
            };

            gamepadManager.initBrowserNavigation(this.#activeView, buttonIds, () => {
                if (this.#isGameView) {
                    this.#showGameList(this.#lastGamePosition);
                } else {
                    this.close();
                    this.#vme.toggleScreen(VME.CURRENT_SCREEN.MENU);
                }
            }, this.#platformDropdown, overlay);
            // Match the current level after changing the layout.
            gamepadManager.setBrowserPanelAction(this.#isGameView ? 'Load' : 'Select');
        }
    }

    close(skipPlatformUpdate = false) {
        const gamepadManager = this.#vme.getGamepadManager();
        if (gamepadManager) {
            gamepadManager.clearBrowserNavigation();
        }

        this.#hidePlatformOverlay();

        this.#destroy();
        document.removeEventListener("keydown", this.#kb_event_bound);
        this.#cli.reset();

        if (!skipPlatformUpdate) {
            this.#platform_manager.updatePlatform();
        }

        if (gamepadManager) {
            gamepadManager.restoreFocusToButton('menu-item-savestates');
        }
    }

    /**
     * Platform-filter overlay in shell style (gamepad mode). Platforms available in
     * saves (from dropdown options) as .gm-item; D-pad/A/B nav driven by GamepadManager
     * (handleBrowserNavigation). Selecting filters saves and closes the overlay.
     */
    showPlatformOverlay() {
        if (!this.#platformDropdown) return;
        this.#search.finish();
        const options = this.#platformDropdown.options || [];
        if (options.length === 0) return;

        let overlay = document.getElementById('savePlatformOverlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'savePlatformOverlay';
            overlay.className = 'gm-browser-overlay';
            document.getElementById('save-browser').appendChild(overlay);
        }
        overlay.innerHTML = '';
        this.#platformDropdown.setSearchQuery('');

        // Overlay breadcrumb - identical to the static one (with active filter),
        // so opening it causes no jump or text change.
        const current = this.#currentPlatformFilter || 'all';
        const currentText = (current === 'all')
            ? t('crumb.allPlatforms')
            : ((options.find(o => o.value === current) || {}).text || t('crumb.allPlatforms'));
        const crumb = document.createElement('div');
        crumb.className = 'gm-browser-overlay-crumb';
        crumb.innerHTML = '<span class="gm-crumb gm-crumb-app">VM/E</span>'
            + '<span class="gm-crumb-sep">›</span>'
            + `<span class="gm-crumb gm-crumb-section">${t('crumb.saves')}</span>`
            + '<span class="gm-crumb-sep">›</span>'
            + `<span class="gm-crumb gm-crumb-section">${currentText}</span>`;
        overlay.appendChild(crumb);

        const query = document.createElement('div');
        query.className = 'custom-dropdown-query platform-overlay-query';
        query.setAttribute('aria-live', 'polite');
        overlay.appendChild(query);
        const list = document.createElement('div');
        list.className = 'gm-list gm-browser-overlay-list';
        overlay.appendChild(list);
        this.#renderPlatformOverlayOptions();

        this.#updateOverlayFocus();
        overlay.classList.add('visible');
    }

    #renderPlatformOverlayOptions() {
        const overlay = document.getElementById('savePlatformOverlay');
        const query = overlay.querySelector('.platform-overlay-query');
        query.textContent = this.#platformDropdown.searchQuery;
        query.hidden = !query.textContent;
        const list = overlay.querySelector('.gm-browser-overlay-list');
        list.replaceChildren();
        const options = this.#platformDropdown.getVisibleOptions();
        const current = this.#currentPlatformFilter;
        this.#overlayItems = [];
        options.forEach((opt, i) => {
            const row = document.createElement('div');
            row.className = 'gm-item';
            row.dataset.value = opt.value;
            const label = document.createElement('span');
            label.className = 'gm-item-label';
            label.textContent = opt.text;
            row.appendChild(label);
            if (opt.value === current) {
                const hint = document.createElement('span');
                hint.className = 'gm-item-hint';
                hint.textContent = '✓';
                row.appendChild(hint);
            }
            list.appendChild(row);
            this.#overlayItems.push(row);
        });
        this.#overlayOptions = options;
        const focused = this.#platformDropdown.options[this.#platformDropdown.focusedIndex]?.value;
        this.#overlayFocus = Math.max(0, options.findIndex(option => option.value === focused));
        this.#updateOverlayFocus();
    }

    #updateOverlayFocus() {
        this.#overlayItems?.forEach((el, i) => {
            el.classList.toggle('focused', i === this.#overlayFocus);
        });
        const el = this.#overlayItems?.[this.#overlayFocus];
        if (el) el.scrollIntoView({ block: 'nearest' });
    }

    isPlatformOverlayOpen() {
        const o = document.getElementById('savePlatformOverlay');
        return !!o && o.classList.contains('visible');
    }

    navigatePlatformOverlay(delta) {
        if (!this.#overlayOptions?.length) return;
        const n = this.#overlayOptions.length;
        this.#overlayFocus = (this.#overlayFocus + delta + n) % n;
        this.#updateOverlayFocus();
    }

    selectPlatformOverlay() {
        const opt = this.#overlayOptions?.[this.#overlayFocus];
        if (!opt) {
            this.#hidePlatformOverlay();
            return;
        }
        this.#currentPlatformFilter = opt.value;
        if (this.#platformDropdown) this.#platformDropdown.setValue(opt.value);
        this.#updateCrumbFilter();
        // Keep overlay as a curtain until the new carousel is ready - without this the old
        // view would flash for a moment (async rebuild). Hidden on onReady.
        this.#showGameList(null, () => this.#hidePlatformOverlay());
    }

    #hidePlatformOverlay() {
        const o = document.getElementById('savePlatformOverlay');
        if (o) o.classList.remove('visible');
        this.#platformDropdown?.setSearchQuery('');
    }

    /** Updates the 3rd breadcrumb segment from the active filter (e.g. 'A800' / 'All platforms'). */
    #updateCrumbFilter() {
        const opts = this.#platformDropdown?.options || [];
        const match = opts.find(o => o.value === this.#currentPlatformFilter);
        // 'all' / no match -> translated "All platforms"; a specific platform shows its
        // own name (short_name from dropdown, not translated).
        this.#setCrumbSegment(
            (!match || this.#currentPlatformFilter === 'all') ? t('crumb.allPlatforms') : match.text
        );
    }

    /** Sets the 3rd breadcrumb segment (platform filter or game title). Ellipsized in CSS. */
    #setCrumbSegment(text) {
        const el = document.getElementById('saveBrowserCrumbFilter');
        if (el) el.textContent = text;
    }

    #filterChangeHandler(event) {
        const selectedPlatformId = event.target.value;
        this.#currentPlatformFilter = selectedPlatformId;
        this.#updateCrumbFilter();
        this.#showGameList();
    }

    #deleteSelectedPanel() {
        // deleteSave is async: a second quick tap would otherwise remove another panel
        // (the one now at the same index) from the carousel without deleting its save.
        if (this.#deleting || this.#filterEditing) return;
        const flicking = this.#activeView;
        const activePanel = flicking?.currentPanel;
        if (activePanel != null) {
            this.#deleting = true;
            const id = activePanel.element.getAttribute('data-id');
            const gameKey = decodeURIComponent(activePanel.element.getAttribute('data-game-key'));
            const intId = parseInt(id, 10);
            const max = this.#viewItems.length - 1;
            const currentIndex = activePanel.index;

            this.#db.deleteSave(intId).then(() => {
                // Browser closed/reopened while deleting.
                if (this.#activeView !== flicking) return;
                this.#viewItems = this.#viewItems.filter(item => item.id !== intId);
                if (this.#grid) {
                    if (!this.#viewItems.length) this.#showGameList(this.#lastGamePosition);
                    else { this.#grid.setItems(this.#viewItems, Math.min(currentIndex, this.#viewItems.length - 1)); this.#updateUI(); }
                    return;
                }
                this.#flicking.remove(activePanel.index);

                if (this.#flicking.panelCount > 0) {
                    let newPanelIndex = currentIndex;
                    if (newPanelIndex >= max) {
                        newPanelIndex = max - 1;
                    }
                    this.#flicking.moveTo(newPanelIndex, 0);
                    this.#updateUI();
                } else if (this.#isGameView) {
                    this.#db.getAllSaveMeta().then(items => {
                        const gameStillHasSaves = items.some(item =>
                            saveGameKey(item) === gameKey
                        );

                        if (!gameStillHasSaves) {
                            this.#showGameList(this.#lastGamePosition);
                        }
                    });
                }
            }).finally(() => {
                this.#deleting = false;
            });
        }
    }

    #loadSelected() {
        if (this.#filterEditing) return;
        if (this.#selected && !this.#launched) {
            this.#launched = true;
            const activePanel = this.#activeView?.currentPanel;
            if (activePanel != null) {
                const id = activePanel.element.getAttribute('data-id');

                document.getElementById('saveBrowserUi').style.display = "none";
                const flickingElement = document.getElementById(this.#useGrid ? 'save-grid' : 'flicking');
                if (flickingElement) {
                    flickingElement.style.opacity = "0";
                }

                const intId = parseInt(id, 10);
                this.#db.getSaveData(intId)
                    .then((data) => {
                        if (data.caption == undefined) {
                            data.caption = data.program_name;
                        }
                        this.#platform_manager.loadState(
                            data.platform_id,
                            data.save_data,
                            data.rom_data,
                            data.program_name,
                            data.caption,
                            () => this.close(true),
                            data.m3u_disks,
                            data.m3u_disk_index,
                            data.m3u_disk_rom_ids,
                            data.m3u_disk_launch_names,
                            data.dos_sram,
                            data.dos_exec_hint,
                            data.st_state_path,
                            data.launch_bios,
                            data.launch_core_config
                        );
                    })
                    .catch((error) => {
                        // Bring the browser back instead of leaving a blank screen.
                        console.error('Failed to load save state:', error);
                        document.getElementById('saveBrowserUi').style.display = "";
                        if (flickingElement) {
                            flickingElement.style.opacity = "";
                        }
                        this.#launched = false;
                        ToastManager.enqueueToast(browserT('browser.saves.loadFailed'), false, null, null, 2000);
                    });
            } else {
                this.#launched = false;
            }
        }
    }

    #destroy() {
        this.#isDestroying = true;
        this.#setViewReady(false);
        this.#platformDropdown?.close();
        clearTimeout(this.#toolbarEntryTimer);
        this.#toolbarEntryTimer = null;
        this.#toolbarEntryPending = false;
        document.getElementById('save-browser').classList.remove('toolbar-enter-pending', 'toolbar-enter');
        this.#viewGeneration++;
        this.#gameListReady = false;
        this.#gameListItems = [];
        this.#search.reset();
        this.#searchSelectionKey = null;
        this.#lastSearchQuery = '';
        this.#lastGameKey = null;
        this.#keyRepeat.stop();

        this.#buttonElements.forEach(button => {
            if (button) {
                removeButtonEventListeners(button);
            }
        });
        this.#buttonElements.clear();

        this.#eventListeners.forEach(({ element, handler, type = 'change', capture = false }) => {
            if (element && handler) {
                element.removeEventListener(type, handler, capture);
            }
        });
        this.#eventListeners = [];

        if (this.#platformDropdown) {
            this.#platformDropdown.setOptions([{ value: 'all', text: 'All platforms' }]);
            this.#platformDropdown.setValue('all');
        }

        this.#grid?.destroy();
        this.#grid = null;
        this.#viewItems = [];
        document.getElementById('save-grid').classList.remove('view-exit', 'view-enter');
        document.getElementById('save-grid').style.removeProperty('opacity');
        document.getElementById('flicking').classList.remove('view-exit', 'view-enter');
        document.getElementById('flicking').style.removeProperty('opacity');
        if (this.#flicking) {
            this.#flicking.off("changed");
            this.#flicking.off("move");
            this.#flicking.off("moveEnd");
            this.#clearPanels();
            this.#flicking.destroy();
            this.#flicking = null;
        }

        this.#urlsToRevoke.forEach(url => {
            URL.revokeObjectURL(url);
        });
        this.#urlsToRevoke.clear();
        this.#screenshotUrls.clear();

        this.#selected = false;
        this.#launched = false;
        this.#deleting = false;
        this.#uiReady = false;
        this.#lastGamePosition = null;
        if (this.#wheelReleaseTimer) {
            clearTimeout(this.#wheelReleaseTimer);
            this.#wheelReleaseTimer = null;
        }

        const background = document.getElementById('flicking-background');
        if (background) {
            clearBackdrop(background);
            background.style.removeProperty('--backdrop-shift');
            background.classList.remove('backdrop-zoom-start');
        }

        this.#isDestroying = false;
    }

    #activateSelection() {
        const panel = this.#activeView?.currentPanel;
        if (this.#filterEditing || !panel || !this.#selected || !this.#uiReady || this.#activeView.animating || this.#isDestroying) return;
        if (this.#isGameView) this.#loadSelected();
        else this.#showGameSaves(panel.element.dataset.programName, panel.element.dataset.platformId, panel.element.dataset.gameKey);
    }

    #openKeyboardFilter() {
        if (this.#isGameView || !this.#gameListReady || !this.#viewReady || this.isPlatformOverlayOpen()) return false;
        if (document.body.classList.contains('gamepad-browser-skin')) {
            this.#focusCards();
            this.showPlatformOverlay();
            return true;
        }
        document.getElementById('platformFilterContainer').classList.remove('hidden');
        this.#revealToolbar();
        this.#search.flush();
        this.#search.finish();
        this.#keyRepeat.stop();
        clearTimeout(this.#wheelReleaseTimer);
        this.#wheelReleaseTimer = null;
        if (this.#flicking?.animating) {
            this.#flicking.control.stopAnimation();
            this.#setUIReady(true);
        }
        const dropdown = this.#platformDropdown.getElement();
        this.#platformDropdown.open();
        if (document.activeElement !== dropdown) dropdown.focus({ preventScroll: true });
        return true;
    }

    #focusCards() {
        document.getElementById('save-browser').focus({ preventScroll: true });
    }

    #handleFilterKeyboard(event) {
        event.stopPropagation();
        if (!this.#gameListReady || this.#isGameView) { event.preventDefault(); return; }
        if (event.key === 'Tab') {
            event.preventDefault();
            this.#platformDropdown.close();
            this.#focusCards();
            return;
        }
        this.#platformDropdown.handleKeyDown(event);
        if (['Enter', ' ', 'Escape'].includes(event.key) && !this.#platformDropdown.isDropdownOpen()) this.#focusCards();
    }

    #handleKeyboard(event) {
        if (event.repeat && ['Enter', 'Escape', 'Tab'].includes(event.key)) { event.preventDefault(); return; }
        if (this.isPlatformOverlayOpen()) {
            if (this.#platformDropdown.handleSearchKey(event)) { this.#renderPlatformOverlayOptions(); return; }
            event.preventDefault();
            if (event.key === 'ArrowUp' || event.key === 'ArrowDown') this.navigatePlatformOverlay(event.key === 'ArrowDown' ? 1 : -1);
            else if (event.key === 'Enter') { this.selectPlatformOverlay(); this.#focusCards(); }
            else if (event.key === 'Escape' || event.key === 'Tab') { this.#hidePlatformOverlay(); this.#focusCards(); }
            return;
        }
        if (this.#filterEditing) {
            this.#handleFilterKeyboard(event);
            return;
        }
        const interactive = event.target.closest?.('button, input, textarea, [contenteditable="true"], .custom-dropdown');
        if (event.key === 'Tab' && !event.shiftKey && !interactive && this.#openKeyboardFilter()) {
            event.preventDefault();
            return;
        }

        if (event.target === document.getElementById('saveBrowserUiView') && ['Enter', ' '].includes(event.key)) {
            event.preventDefault();
            if (!event.repeat) this.#toggleView();
            return;
        }
        if (!this.#isGameView && !this.isPlatformOverlayOpen() && this.#search.handleKeyboard(event)) return;
        if (!this.#activeView || this.#activeView.animating) return;
        if (this.#grid && ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
            event.preventDefault();
            if (event.key === 'ArrowRight') this.#grid.focusNext();
            else if (event.key === 'ArrowLeft') this.#grid.focusPrev();
            else this.#grid.focusRow(event.key === 'ArrowDown' ? 1 : -1);
            return;
        }

        if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
            this.#keyRepeat.press(event, event.key === "ArrowRight" ? 1 : -1);
        } else if (event.key === "Enter") {
            this.#activateSelection();
        } else if (event.key === "Escape" || event.key === "Backspace") {
            if (this.#isGameView) {
                this.#showGameList(this.#lastGamePosition);
            } else {
                this.close();
                this.#vme.toggleScreen(VME.CURRENT_SCREEN.MENU);
            }
        }
    }

    #handleWheel(event) {
        if (this.#filterEditing) { event.preventDefault(); return; }
        const flicking = this.#flicking;
        if (!flicking) {
            return;
        }

        const hasDelta = Math.abs(event.deltaY) > 0 || Math.abs(event.deltaX) > 0;
        if (!hasDelta) {
            return;
        }

        const primaryDelta = Math.abs(event.deltaY) >= Math.abs(event.deltaX)
            ? event.deltaY
            : event.deltaX;

        if (primaryDelta === 0) {
            return;
        }

        event.preventDefault();

        if (flicking.animating) {
            flicking.control.stopAnimation();
        }

        const threshold = event.deltaMode === WheelEvent.DOM_DELTA_LINE
            ? this.#wheelLineThreshold
            : this.#wheelPixelThreshold;

        const currentPanel = flicking.currentPanel;
        const referenceSize = currentPanel?.size || flicking.camera.size || 1;
        const rawMovement = (primaryDelta / threshold) * referenceSize * this.#wheelScrollMultiplier;
        const maxMovement = referenceSize * 2;
        const movement = Math.max(-maxMovement, Math.min(maxMovement, rawMovement));

        if (!Number.isFinite(movement) || movement === 0) {
            this.#scheduleWheelSnap();
            return;
        }

        const camera = flicking.camera;
        const nextPosition = camera.clampToReachablePosition(camera.position + movement);

        if (!Number.isFinite(nextPosition) || nextPosition === camera.position) {
            this.#scheduleWheelSnap();
            return;
        }

        this.#setUIReady(false);
        camera.lookAt(nextPosition);
        flicking.control.updateInput();
        this.#updateBackground();
        this.#updateParallax();

        this.#scheduleWheelSnap();
    }

    #scheduleWheelSnap() {
        if (this.#wheelReleaseTimer) {
            clearTimeout(this.#wheelReleaseTimer);
        }

        this.#wheelReleaseTimer = setTimeout(() => {
            this.#wheelReleaseTimer = null;
            this.#snapToNearestPanel();
        }, this.#wheelSnapDelay);
    }

    #snapToNearestPanel() {
        const flicking = this.#flicking;
        if (!flicking) {
            this.#setUIReady(true);
            return;
        }

        const camera = flicking.camera;
        const anchor = camera.findNearestAnchor(camera.position);
        if (!anchor) {
            this.#setUIReady(true);
            return;
        }

        const targetPanel = anchor.panel;
        const targetIndex = targetPanel.index;
        const activePanel = flicking.currentPanel;
        if (flicking.animating) {
            flicking.control.stopAnimation();
        }

        this.#setUIReady(false);

        flicking.control.updateInput();

        const baseDuration = flicking.options?.duration ?? 350;
        const indexDistance = activePanel ? Math.abs(activePanel.index - targetIndex) : 1;
        const durationFactor = Math.max(0.25, 0.55 / Math.max(indexDistance, 1));
        const duration = Math.max(80, Math.round(baseDuration * durationFactor));

        flicking.moveTo(targetIndex, duration)
            .catch(() => {
                this.#setUIReady(true);
            })
            .finally(() => {
                this.#setUIReady(true);
            });
    }

#groupSavesByGame(items) {
        const gameMap = new Map();

        items.forEach(item => {
            const gameKey = saveGameKey(item);
            if (!gameMap.has(gameKey)) {
                gameMap.set(gameKey, {
                    latestSave: item,
                    allSaves: [item]
                });
            } else {
                const game = gameMap.get(gameKey);
                game.allSaves.push(item);
                if (item.timestamp > game.latestSave.timestamp) {
                    game.latestSave = item;
                }
            }
        });

        return gameMap;
    }

    #isCurrentView(generation, flicking) {
        return generation === this.#viewGeneration && this.#activeView === flicking && !this.#isDestroying;
    }

    #showGameList(targetPosition = null, onReady = null) {
        if (this.#isDestroying) { onReady?.(); return; }
        const preferredKey = this.#isGameView ? this.#lastGameKey : null;
        this.#isGameView = false;
        this.#gameListReady = false;
        this.#setViewReady(false);
        const generation = ++this.#viewGeneration;
        const flicking = this.#activeView;
        this.#search.setAvailable(true);
        this.#setUIReady(false);
        this.#updateCrumbFilter();
        this.#vme.getGamepadManager()?.setBrowserPanelAction('Select');

        const container = document.getElementById('save-browser');
        container.dataset.view = 'game-list';
        const platformContainer = document.getElementById('platformFilterContainer');
        platformContainer.style.display = '';
        container.classList.add('transitioning');
        const viewport = document.getElementById(this.#useGrid ? 'save-grid' : 'flicking');
        viewport.classList.add('view-exit');
        const empty = document.getElementById('saveBrowserEmpty');
        empty.style.display = 'none';
        const load = async () => {
            try {
                const pending = this.#db.getAllSaveMeta();
                await new Promise(resolve => setTimeout(resolve, VIEW_EXIT_MS));
                const items = await pending;
                if (!this.#isCurrentView(generation, flicking)) return;
                this.#gameListItems = Array.from(this.#groupSavesByGame(items).values()).map(game => game.latestSave);
                // Populate platforms before applying the title filter, including zero-result searches.
                for (const item of this.#gameListItems) {
                    if (item.platform_id === 'md') item.platform_id = 'smd';
                    const platform = Object.values(SelectedPlatforms).find(value => value.platform_id === item.platform_id);
                    this.#addFilterItem(item.platform_id, platform?.short_name || String(item.platform_id).toUpperCase());
                }
                const platformItems = this.#currentPlatformFilter === 'all' ? this.#gameListItems
                    : this.#gameListItems.filter(item => item.platform_id === this.#currentPlatformFilter);
                this.#gameListReady = true;
                const matches = this.#search.setItems(platformItems);
                this.#platformDropdown?.setValue(this.#currentPlatformFilter);
                this.#renderGameList(matches, preferredKey, targetPosition ?? 0);
                platformContainer.classList.remove('hidden');
                this.#setViewReady(true);
                viewport.classList.remove('view-exit');
                if (matches.length) viewport.classList.add('view-enter');
                container.classList.remove('transitioning');
                onReady?.();
                setTimeout(() => {
                    if (!this.#isCurrentView(generation, flicking)) return;
                    this.#revealToolbar();
                }, 50);
                setTimeout(() => {
                    if (!this.#isCurrentView(generation, flicking)) return;
                    viewport.classList.remove('view-enter');
                    this.#setUIReady(true);
                }, VIEW_ENTER_MS);
            } catch (error) {
                if (!this.#isCurrentView(generation, flicking)) return;
                container.classList.remove('transitioning');
                viewport.classList.remove('view-exit', 'view-enter');
                platformContainer.classList.remove('hidden');
                this.#revealToolbar();
                showBrowserEmpty(empty, browserT('browser.saves.loadError'));
                this.#setUIReady(true);
                onReady?.();
            }
        };
        load();
    }

    #showGameSaves(gameId, platformId, encodedGameKey) {
        if (this.#filterEditing) return;
        const gameKey = decodeURIComponent(encodedGameKey);
        this.#lastGamePosition = this.#activeView.currentPanel
          ? this.#activeView.currentPanel.index
          : 0;
    
        this.#isGameView = true;
        this.#lastGameKey = encodedGameKey;
        this.#gameListReady = false;
        this.#setViewReady(false);
        const generation = ++this.#viewGeneration;
        const flicking = this.#activeView;
        this.#search.setAvailable(false);
        this.#setUIReady(false);

        // Breadcrumb: 3rd segment = game title (instead of platform filter) in saves view.
        const title = FileUtils.cleanRomName(gameId);
        this.#setCrumbSegment(title);

        // Legend: in a game's saves view A = Load.
        this.#vme.getGamepadManager()?.setBrowserPanelAction('Load');

        const container = document.querySelector('#save-browser');
        container.setAttribute('data-view', 'game-saves');
    
        const platformFilterContainer = document.querySelector('#platformFilterContainer');
        if (platformFilterContainer) {
            platformFilterContainer.classList.add('hidden');
        }
    
        container.classList.add('transitioning');
        const flickingElement = document.getElementById(this.#useGrid ? 'save-grid' : 'flicking');
        flickingElement.classList.add('view-exit');

        // Read the saves while the old view fades out, not after.
        const itemsPromise = this.#db.getAllSaveMeta();
    
        setTimeout(() => {
            if (!this.#isCurrentView(generation, flicking)) return;
            this.#clearPanels();
    
            itemsPromise
                .then(items => {
                    if (!this.#isCurrentView(generation, flicking)) return;
                    const gameSaves = items
                        .filter(item =>
                            saveGameKey(item) === gameKey
                        )
                        .sort((a, b) => b.timestamp - a.timestamp);
    
                    if (gameSaves.length > 0) {
                        flickingElement.classList.remove('view-exit');
                        flickingElement.classList.add('view-enter');
                        this.#appendPanels(gameSaves);
                        this.#setViewReady(true);
                        container.classList.remove('transitioning');
                    }
    
                    setTimeout(() => {
                        if (!this.#isCurrentView(generation, flicking)) return;
                        container.classList.remove('transitioning');
                        flickingElement.classList.remove('view-enter');
                        
                        if (this.#flicking) {
                            this.#flicking.resize();
                            if (this.#flicking.currentPanel) {
                                this.#flicking.moveTo(this.#flicking.currentPanel.index, 0);
                            }
                        }
                        
                        this.#setUIReady(true);
                    }, VIEW_ENTER_MS);
                }).catch(() => {
                    if (!this.#isCurrentView(generation, flicking)) return;
                    container.classList.remove('transitioning');
                    flickingElement.classList.remove('view-exit', 'view-enter');
                    showBrowserEmpty(document.getElementById('saveBrowserEmpty'), browserT('browser.saves.loadError'));
                    this.#setUIReady(true);
                });
        }, VIEW_EXIT_MS);
    }

    #throttle(func, limit) {
        let inThrottle;
        return function (...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    #debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func.apply(this, args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
}

function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
