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
    #filter_change_handler_bound;
    #eventListeners = [];
    #currentPlatformFilter = "all";
    #isGameView = false;
    #uiReady = false;
    #lastGamePosition = null;

    constructor(vme, platform_manager, storage_manager, cli) {
        this.#vme = vme;
        this.#platform_manager = platform_manager;
        this.#db = storage_manager;
        this.#cli = cli;

        this.#kb_event_bound = this.#handleKeyboard.bind(this);

        this.#filter_change_handler_bound = this.#filterChangeHandler.bind(this);

        const backButton = s('#saveBrowserUiBack');
        backButton.classList.remove('disabled');
    
        const backHandler = (pressed) => {
            if (pressed) {
                if (this.#isGameView) {
                    this.#showGameList(this.#lastGamePosition);
                } else {
                    this.close();
                    this.#vme.toggleScreen(VME.CURRENT_SCREEN.MENU);
                }
            }
        };
        addButtonEventListeners(backButton, backHandler);
        this.#eventListeners.push({ element: backButton, handler: backHandler });

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
        this.#flicking.on("changed", e => {
            this.#updateBackground();
            this.#updateActivePanel();
            this.#setUIReady(true);
        });

        this.#flicking.on("move", e => {
            this.#updateParallax();
            this.#setUIReady(false);
        });

        this.#flicking.on("moveEnd", e => {
            this.#updateActivePanel();
            this.#setUIReady(true);
        });

        panels.forEach((panel, index) => {
            const clickHandler = () => {
                if (this.#flicking.currentPanel &&
                    this.#flicking.currentPanel.index === index) {
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
                    this.#flicking.moveTo(index);
                }
            };
            panel.addEventListener("click", clickHandler);
            this.#eventListeners.push({ element: panel, handler: clickHandler });
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
        const randomDegree = Math.random() * 20 - 10;

        if (item.caption == undefined) {
            item.caption = this.#cleanFilename(item.program_name);
        }

        const timestamp = new Date(item.timestamp).toLocaleString();
        const timeDisplay = this.#isGameView ? `<div class="flicking-title flicking-title-time">${timestamp}</div>` : '';

        return `
            <div class="flicking-panel" data-id="${item.id}" data-program-name="${item.program_name}" data-platform-id="${platform.platform_id}">
                <img src="${url}" alt="${item.program_name}" style="transform: rotate(${randomDegree}deg)">
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
        this.#updateUI();
    }

    #updateUI() {
        this.#updateActivePanel();
        this.#updateBackground();
    }

    #updateBackground() {
        var currentPanel = this.#flicking.currentPanel;
        var backgroundImage = '';
        if (currentPanel != null) {
            backgroundImage = currentPanel.element.querySelector('img').src;
        }

        let el = document.getElementById('flicking-background');
        el.style.background = backgroundImage;
        el.style.background = "url(" + backgroundImage + ")";
        el.style.transform = "scale(12)";
        el.style.imageRendering = 'pixelated';
    }

    #updateParallax() {
        var flickingWidth = this.#flicking.element.clientWidth;
        var scrollRatio = this.#flicking.camera.position / flickingWidth;
        var background = document.getElementById('flicking-background');

        background.style.transform = `translateX(${scrollRatio * 50}%) scale(12)`;
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
        let div = document.querySelector('#save-browser');
        div.classList.add('show');
        this.#destroy();

        this.#flicking = new Flicking("#flicking", {
            circular: true,
            moveType: "snap",
            preventClickOnDrag: true,
            autoResize: true
        });

        const fb = document.getElementById('flicking-background');
        fb.classList.remove('show');
        setTimeout(() => {
            fb.classList.add('show');
        }, 10);

        this.#showGameList();

        platformFilter.removeEventListener('change', this.#filter_change_handler_bound)
        platformFilter.addEventListener('change', this.#filter_change_handler_bound);
        this.#eventListeners.push({ element: platformFilter, handler: this.#filter_change_handler_bound });

        document.addEventListener("keydown", this.#kb_event_bound);

        const deleteButton = s('#saveBrowserUiDelete');
        const deleteHandler = (pressed) => {
            if (pressed && this.#selected && this.#uiReady) {
                this.#deleteSelectedPanel();
            }
        };
        addButtonEventListeners(deleteButton, deleteHandler);
        this.#eventListeners.push({ element: deleteButton, handler: deleteHandler });

        const loadButton = s('#saveBrowserUiLoad');
        const loadHandler = (pressed) => {
            if (pressed && this.#selected && this.#uiReady) {
                this.#loadSelected();
            }
        };
        addButtonEventListeners(loadButton, loadHandler);
        this.#eventListeners.push({ element: loadButton, handler: loadHandler });

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
        this.#eventListeners.push({ element: openButton, handler: openHandler });

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
        if (this.#flicking) {
            const totalPanels = this.#flicking.panelCount;
            for (let i = totalPanels - 1; i >= 0; i--) {
                this.#flicking.remove(i);
            }
            this.#flicking.destroy();
        }

        this.#eventListeners.forEach(({ element, handler }) => {
            element.removeEventListener('change', handler);
        });

        this.#eventListeners = [];
    }

    #handleKeyboard(event) {
        if (!this.#flicking || this.#flicking.animating) {
            return;
        }

        if (event.key === "ArrowRight") {
            this.#flicking.next().catch(() => { });
        } else if (event.key === "ArrowLeft") {
            this.#flicking.prev().catch(() => { });
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
        this.#isGameView = false;
        this.#setUIReady(false);
        
        const container = document.querySelector('#save-browser');
        container.setAttribute('data-view', 'game-list');
        
        const platformFilterContainer = document.querySelector('#platformFilterContainer');
        platformFilterContainer.style.display = '';
        platformFilterContainer.classList.add('hidden');
        
        container.classList.add('transitioning');
        const flickingElement = document.querySelector('#flicking');
        flickingElement.classList.add('view-exit');
        
        document.getElementById('saveBrowserEmpty').style.display = "none";

        setTimeout(() => {
            this.#clearPanels();
            
            this.#db.getAllSaveMeta()
                .then(items => {
                    const gameMap = this.#groupSavesByGame(items);
                    let latestSaves = Array.from(gameMap.values())
                        .map(game => game.latestSave);
                    
                    if (this.#currentPlatformFilter !== "all") {
                        latestSaves = latestSaves.filter(item => 
                            item.platform_id === this.#currentPlatformFilter
                        );
                    }
                    
                    if (latestSaves.length > 0) {
                        flickingElement.classList.remove('view-exit');
                        flickingElement.classList.add('view-enter');
                        this.#appendPanels(latestSaves);
                        
                        platformFilterContainer.style.display = '';
                        document.getElementById('platformFilter').value = this.#currentPlatformFilter;
                        
                        if (targetPosition !== null) {
                            const maxIndex = this.#flicking.panelCount - 1;
                            const safePosition = Math.min(Math.max(0, targetPosition), maxIndex);
                            this.#flicking.moveTo(safePosition, 0);
                        }
                        
                        setTimeout(() => {
                            platformFilterContainer.classList.remove('hidden');
                        }, 50);
                    } else {
                        document.getElementById('saveBrowserEmpty').innerHTML = "No save states found.";
                        document.getElementById('saveBrowserEmpty').style.display = "block";
                    }
                    
                    setTimeout(() => {
                        container.classList.remove('transitioning');
                        flickingElement.classList.remove('view-enter');
                        this.#setUIReady(true);
                    }, 300);
                });
        }, 300);
    }
    
    #showGameSaves(gameId, platformId) {
        this.#lastGamePosition = this.#flicking.currentPanel ? this.#flicking.currentPanel.index : 0;
        
        this.#isGameView = true;
        this.#setUIReady(false);
        
        const container = document.querySelector('#save-browser');
        container.setAttribute('data-view', 'game-saves');
        document.querySelector('#platformFilterContainer').classList.add('hidden');
        
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
                        this.#setUIReady(true);
                    }, 300);
                });
        }, 300);
    }
}