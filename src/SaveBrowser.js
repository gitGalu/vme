import { s, addButtonEventListeners, removeButtonEventListeners } from "./dom";
import { VME } from './VME.js';
import Flicking from "@egjs/flicking";
import "@egjs/flicking/dist/flicking.css";
import { SelectedPlatforms } from './platforms/PlatformManager.js';

export class SaveBrowser {
    #vme;
    #platform_manager;
    #db;
    #cli;
    #flicking;
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
    #lastGamePosition = null;

    #urlsToRevoke = new Set();
    #isDestroying = false;
    #lastBackgroundUpdate = 0;
    #lastParallaxUpdate = 0;

    constructor(vme, platform_manager, storage_manager, cli) {
        this.#vme = vme;
        this.#platform_manager = platform_manager;
        this.#db = storage_manager;
        this.#cli = cli;

        this.#kb_event_bound = this.#handleKeyboard.bind(this);
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

        const platformFilter = document.getElementById('platformFilterContainer');
        platformFilter.classList.add('none');

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

    #bindPanelEvents(panels) {
        if (!this.#flicking || this.#isDestroying) return;
    
        const throttledParallax = this.#throttle(this.#updateParallax.bind(this), 16);
        const debouncedBackground = this.#debounce(this.#updateBackground.bind(this), 16);
    
        this.#flicking.on("changed", e => {
            debouncedBackground();
            this.#updateActivePanel();
            this.#flicking.resize();
            if (this.#flicking.currentPanel) {
                requestAnimationFrame(() => {
                    if (this.#flicking && this.#flicking.currentPanel) {
                        this.#flicking.moveTo(this.#flicking.currentPanel.index, 0);
                    }
                });
            }
            this.#setUIReady(true);
        });
    
        this.#flicking.on("move", e => {
            throttledParallax();
            this.#setUIReady(false);
        });
    
        this.#flicking.on("moveEnd", e => {
            this.#updateActivePanel();
            this.#flicking.resize();
            if (this.#flicking.currentPanel) {
                requestAnimationFrame(() => {
                    if (this.#flicking && this.#flicking.currentPanel) {
                        this.#flicking.moveTo(this.#flicking.currentPanel.index, 0);
                    }
                });
            }
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
                            this.#showGameSaves(programName, platformId);
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

        this.#eventListeners.forEach(({ element, handler }) => {
            element.removeEventListener("click", handler);
        });

        this.#eventListeners = [];
    }

    #createPanelHTML(item) {
        if (item.platform_id == "md") item.platform_id = "smd"; //temp fix
        const platform = Object.values(SelectedPlatforms).find(platform => platform.platform_id === item.platform_id);
        this.#addFilterItem(platform.platform_id, platform.short_name);

        let screenshotBlob = new Blob([item.screenshot], { type: 'image/png' });
        const url = URL.createObjectURL(screenshotBlob);
        this.#urlsToRevoke.add(url);

        const randomDegree = Math.random() * 20 - 10;
        if (item.caption == undefined) {
            item.caption = this.#cleanFilename(item.program_name);
        }

        const timestamp = new Date(item.timestamp).toLocaleString();
        const timeDisplay = this.#isGameView ? `<div class="flicking-title flicking-title-time">${timestamp}</div>` : '';
        const quicksaveLabel = (this.#isGameView && item.is_quicksave === true) ? `<div class="flicking-title flicking-title-time" style="color: #ff6b9d;">QUICKSAVE</div>` : '';

        return `
            <div class="flicking-panel" data-id="${item.id}" data-program-name="${item.program_name}" data-platform-id="${platform.platform_id}">
                <img src="${url}" alt="${item.program_name}" loading="lazy" style="transform: rotate(${randomDegree}deg)">
                ${quicksaveLabel}
                <div class="flicking-title flicking-title-name">${item.caption} (${platform.short_name})</div>
                ${timeDisplay}
            </div>
        `;
    }

    #addFilterItem(platform_id, platform_name) {
        const platformFilter = document.getElementById('platformFilter');
        const platformFilterContainer = document.getElementById('platformFilterContainer');

        const options = Array.from(platformFilter.options);
        const optionExists = options.some(option => option.value === platform_id);

        if (!optionExists) {
            const newOption = document.createElement('option');
            newOption.value = platform_id;
            newOption.text = platform_name;
            platformFilter.add(newOption);

            if (platformFilter.options.length > 1) {
                platformFilterContainer.style.display = '';
            }
        }
    }

    #clearPanels() {
        if (!this.#flicking) return;
        const totalPanels = this.#flicking.panelCount;
        for (let i = totalPanels - 1; i >= 0; i--) {
            this.#flicking.remove(i);
        }
    }

    #appendPanels(items) {
        items.forEach(item => {
            const newPanel = this.#createPanelHTML(item);
            this.#flicking.append(newPanel);
        });

        const panels = document.querySelectorAll(".flicking-panel");
        this.#unbindPanelEvents();
        this.#bindPanelEvents(panels);

        this.#flicking.resize();
        if (this.#flicking.currentPanel) {
            this.#flicking.moveTo(this.#flicking.currentPanel.index, 0);
        } else {
            if (this.#flicking.panelCount > 0) {
                this.#flicking.moveTo(0, 0);
            }
        }

        this.#updateUI();
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

        const currentPanel = this.#flicking?.currentPanel;
        const el = document.getElementById('flicking-background');

        if (!el || !currentPanel) {
            if (el) el.style.backgroundImage = 'none';
            return;
        }

        const img = currentPanel.element.querySelector('img');
        if (!img?.src) return;

        const newBackground = `url(${img.src})`;
        if (el.style.backgroundImage !== newBackground) {
            el.style.backgroundImage = newBackground;
            el.style.transform = 'translate3d(0,0,0) scale(12)';
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
    
        background.style.transform = `translate3d(${scrollRatio * 50}px,0,0) scale(12)`;
    }

    #updateActivePanel() {
        const activePanel = this.#flicking.currentPanel;
        if (activePanel != null) {
            document.getElementById('saveBrowserEmpty').style.display = "none";

            const loadButton = document.getElementById('saveBrowserUiLoad');
            const deleteButton = document.getElementById('saveBrowserUiDelete');
            const openButton = document.getElementById('saveBrowserUiOpen');

            if (this.#isGameView) {
                loadButton.classList.remove('disabled');
                deleteButton.classList.remove('disabled');
                openButton.classList.add('disabled');
            } else {
                loadButton.classList.add('disabled');
                deleteButton.classList.add('disabled');
                openButton.classList.remove('disabled');
            }

            const panels = document.querySelectorAll(".flicking-panel");
            panels.forEach(panel => panel.classList.remove("active"));
            activePanel.element.classList.add("active");
            this.#selected = true;
        } else {
            document.getElementById('saveBrowserEmpty').style.display = "block";
            document.getElementById('saveBrowserEmpty').innerHTML = "No save states found.";
            document.getElementById('saveBrowserUiLoad').classList.add('disabled');
            document.getElementById('saveBrowserUiDelete').classList.add('disabled');
            document.getElementById('saveBrowserUiOpen').classList.add('disabled');
            this.#selected = false;
        }
    }

    open() {
        this.#currentPlatformFilter = "all";
        const filterElement = document.getElementById('platformFilter');
        if (filterElement) {
            filterElement.value = "all";
        }
    
        let div = document.querySelector('#save-browser');
        div.classList.add('show');
        this.#destroy();

        if (this.#backButton && this.#backHandler) {
            addButtonEventListeners(this.#backButton, this.#backHandler);
            this.#buttonElements.add(this.#backButton);
        }

        this.#flicking = new Flicking("#flicking", {
            circular: true,
            moveType: "snap",
            preventClickOnDrag: true,
            autoResize: true,
            align: "center",
            duration: 350
        });

        const flickingElement = this.#flicking?.element;
        if (flickingElement) {
            flickingElement.addEventListener('wheel', this.#wheel_event_bound, { passive: false });
            this.#eventListeners.push({ element: flickingElement, handler: this.#wheel_event_bound, type: 'wheel' });
        }
    
        const fb = document.getElementById('flicking-background');
        fb.classList.remove('show');
        setTimeout(() => {
            fb.classList.add('show');
        }, 10);
    
        this.#showGameList();
    
        const platformFilter = document.getElementById('platformFilter');
        platformFilter.removeEventListener('change', this.#filter_change_handler_bound);
        platformFilter.addEventListener('change', this.#filter_change_handler_bound);
        this.#eventListeners.push({ element: platformFilter, handler: this.#filter_change_handler_bound, type: 'change' });
    
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
                const activePanel = this.#flicking.currentPanel;
                if (activePanel) {
                    const programName = activePanel.element.getAttribute('data-program-name');
                    const platformId = activePanel.element.getAttribute('data-platform-id');
                    this.#showGameSaves(programName, platformId);
                }
            }
        };
        addButtonEventListeners(openButton, openHandler);
        this.#buttonElements.add(openButton);
    
        this.#vme.toggleScreen(VME.CURRENT_SCREEN.SAVE_BROWSER);
    }

    close() {
        this.#destroy();
        document.removeEventListener("keydown", this.#kb_event_bound);
        this.#cli.reset();
        this.#platform_manager.updatePlatform();
    }

    #filterChangeHandler(event) {
        const selectedPlatformId = event.target.value;
        this.#currentPlatformFilter = selectedPlatformId;
        this.#showGameList();
    }

    #deleteSelectedPanel() {
        const activePanel = this.#flicking.currentPanel;
        if (activePanel != null) {
            const id = activePanel.element.getAttribute('data-id');
            const programName = activePanel.element.getAttribute('data-program-name');
            const platformId = activePanel.element.getAttribute('data-platform-id');
            const intId = parseInt(id, 10);
            const max = this.#flicking.panelCount - 1;
            const currentIndex = activePanel.index;

            this.#db.deleteSave(intId).then(() => {
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
                            item.program_name === programName &&
                            item.platform_id === platformId
                        );

                        if (!gameStillHasSaves) {
                            this.#showGameList(this.#lastGamePosition);
                        }
                    });
                }
            });
        }
    }

    #loadSelected() {
        if (this.#selected && !this.#launched) {
            this.#launched = true;
            const activePanel = this.#flicking.currentPanel;
            if (activePanel != null) {
                const id = activePanel.element.getAttribute('data-id');
                document.getElementById('flicking-background').classList.remove('show');
                document.getElementById('saveBrowserUi').style.display = "none";
                const intId = parseInt(id, 10);
                this.close();
                this.#db.getSaveData(intId)
                    .then((data) => {
                        if (data.caption == undefined) {
                            data.caption = data.program_name;
                        }
                        this.#platform_manager.loadState(data.platform_id, data.save_data, data.rom_data, data.program_name, data.caption);
                    });
            }
        }
    }

    #destroy() {
        this.#isDestroying = true;

        this.#buttonElements.forEach(button => {
            if (button) {
                removeButtonEventListeners(button);
            }
        });
        this.#buttonElements.clear();

        this.#eventListeners.forEach(({ element, handler, type = 'change' }) => {
            if (element && handler) {
                element.removeEventListener(type, handler);
            }
        });
        this.#eventListeners = [];

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

        this.#selected = false;
        this.#launched = false;
        this.#uiReady = false;
        this.#lastGamePosition = null;
        if (this.#wheelReleaseTimer) {
            clearTimeout(this.#wheelReleaseTimer);
            this.#wheelReleaseTimer = null;
        }

        const background = document.getElementById('flicking-background');
        if (background) {
            background.style.backgroundImage = 'none';
            background.style.transform = 'none';
        }

        this.#isDestroying = false;
    }

    #handleKeyboard(event) {
        if (!this.#flicking || this.#flicking.animating) {
            return;
        }
    
        if (event.key === "ArrowRight") {
            this.#setUIReady(false);
            this.#flicking.next().then(() => {
            }).catch(() => { 
                this.#setUIReady(true);
            });
        } else if (event.key === "ArrowLeft") {
            this.#setUIReady(false);
            this.#flicking.prev().then(() => {
            }).catch(() => { 
                this.#setUIReady(true);
            });
        } else if (event.key === "Enter") {
            const activePanel = this.#flicking.currentPanel;
            if (activePanel && this.#selected && this.#uiReady) {
                if (!this.#isGameView) {
                    const programName = activePanel.element.getAttribute('data-program-name');
                    const platformId = activePanel.element.getAttribute('data-platform-id');
                    this.#showGameSaves(programName, platformId);
                } else {
                    this.#loadSelected();
                }
            }
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

    #cleanFilename(filename) {
        filename = filename.replace(/\.[^/.]+$/, "");
        filename = filename.replace(/[\[\(][^\[\]\(\)]+[\]\)]/g, "").trim();
        return filename;
    }

    #groupSavesByGame(items) {
        const gameMap = new Map();

        items.forEach(item => {
            const gameKey = `${item.program_name}_${item.platform_id}`;
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

    #showGameList(targetPosition = null) {
        if (this.#isDestroying) return;
    
        this.#isGameView = false;
        this.#setUIReady(false);
    
        const container = document.querySelector('#save-browser');
        if (!container) return;
    
        container.setAttribute('data-view', 'game-list');
    
        const platformFilterContainer = document.querySelector('#platformFilterContainer');
        if (platformFilterContainer) {
            platformFilterContainer.style.display = '';
            platformFilterContainer.classList.add('hidden');
        }
    
        container.classList.add('transitioning');
        const flickingElement = document.querySelector('#flicking');
        if (flickingElement) {
            flickingElement.classList.add('view-exit');
        }
    
        const emptyElement = document.getElementById('saveBrowserEmpty');
        if (emptyElement) {
            emptyElement.style.display = "none";
        }
    
        const loadData = async () => {
            try {
                await new Promise(resolve => setTimeout(resolve, 300));
    
                this.#clearPanels();
    
                const items = await this.#db.getAllSaveMeta();
                const gameMap = this.#groupSavesByGame(items);
                let latestSaves = Array.from(gameMap.values())
                    .map(game => game.latestSave);
    
                if (this.#currentPlatformFilter !== "all") {
                    latestSaves = latestSaves.filter(item =>
                        item.platform_id === this.#currentPlatformFilter
                    );
                }
    
                if (latestSaves.length > 0 && flickingElement && !this.#isDestroying) {
                    flickingElement.classList.remove('view-exit');
                    flickingElement.classList.add('view-enter');
    
                    await this.#appendPanels(latestSaves);
    
                    if (platformFilterContainer) {
                        platformFilterContainer.style.display = '';
                        const filterElement = document.getElementById('platformFilter');
                        if (filterElement) {
                            filterElement.value = this.#currentPlatformFilter;
                        }
                    }
    
                    if (targetPosition !== null && this.#flicking) {
                        const maxIndex = this.#flicking.panelCount - 1;
                        const safePosition = Math.min(Math.max(0, targetPosition), maxIndex);
                        await this.#flicking.moveTo(safePosition, 0);
                    }
    
                    setTimeout(() => {
                        if (platformFilterContainer && !this.#isDestroying) {
                            platformFilterContainer.classList.remove('hidden');
                        }
                    }, 50);
                } else if (emptyElement) {
                    emptyElement.innerHTML = "No save states found.";
                    emptyElement.style.display = "block";
                }
    
                setTimeout(() => {
                    if (!this.#isDestroying) {
                        container.classList.remove('transitioning');
                        if (flickingElement) {
                            flickingElement.classList.remove('view-enter');
                        }
                        
                        if (this.#flicking) {
                            this.#flicking.resize();
                            if (this.#flicking.currentPanel) {
                                this.#flicking.moveTo(this.#flicking.currentPanel.index, 0);
                            }
                        }
                        
                        this.#setUIReady(true);
                    }
                }, 300);
    
            } catch (error) {
                if (emptyElement) {
                    emptyElement.innerHTML = "Error loading saves. Please try again.";
                    emptyElement.style.display = "block";
                }
                this.#setUIReady(true);
            }
        };
    
        loadData();
    }

    #showGameSaves(gameId, platformId) {
        this.#lastGamePosition = this.#flicking.currentPanel
          ? this.#flicking.currentPanel.index
          : 0;
    
        this.#isGameView = true;
        this.#setUIReady(false);
    
        const container = document.querySelector('#save-browser');
        container.setAttribute('data-view', 'game-saves');
    
        const platformFilterContainer = document.querySelector('#platformFilterContainer');
        if (platformFilterContainer) {
            platformFilterContainer.classList.add('hidden');
        }
    
        container.classList.add('transitioning');
        const flickingElement = document.querySelector('#flicking');
        flickingElement.classList.add('view-exit');
    
        setTimeout(() => {
            this.#clearPanels();
    
            this.#db.getAllSaveMeta()
                .then(items => {
                    const gameSaves = items
                        .filter(item =>
                            item.program_name === gameId &&
                            item.platform_id === platformId
                        )
                        .sort((a, b) => b.timestamp - a.timestamp);
    
                    if (gameSaves.length > 0) {
                        flickingElement.classList.remove('view-exit');
                        flickingElement.classList.add('view-enter');
                        this.#appendPanels(gameSaves);
                    }
    
                    setTimeout(() => {
                        container.classList.remove('transitioning');
                        flickingElement.classList.remove('view-enter');
                        
                        if (this.#flicking) {
                            this.#flicking.resize();
                            if (this.#flicking.currentPanel) {
                                this.#flicking.moveTo(this.#flicking.currentPanel.index, 0);
                            }
                        }
                        
                        this.#setUIReady(true);
                    }, 300);
                });
        }, 300);
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