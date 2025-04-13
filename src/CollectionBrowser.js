import { s, addButtonEventListeners } from "./dom.js";
import { VME } from './VME.js';
import Flicking from "@egjs/flicking";
import { Arrow } from "@egjs/flicking-plugins";
import "@egjs/flicking/dist/flicking.css";
import { SelectedPlatforms } from './platforms/PlatformManager.js';
import { StorageManager } from "./storage/StorageManager.js";
import { BOOT_TO, BOOT_TO_COLLECTION_BROWSER, COLLECTION_BROWSER_COLLECTION_INDEX, COLLECTION_BROWSER_ITEM_INDEX } from './Constants.js';

export class CollectionBrowser {
    #vme;
    #platform_manager;
    #db;
    #cli;

    #flicking;
    #items;

    #selected;
    #launched;
    #kb_event_bound;
    #isDragging;
    #uiReady = false;
    #urlsToRevoke = new Set();
    #lastBackgroundUpdate = 0;
    #lastParallaxUpdate = 0;

    constructor(vme, platform_manager, storage_manager, cli) {
        this.#vme = vme;
        this.#platform_manager = platform_manager;
        this.#db = storage_manager;
        this.#cli = cli;
        this.#isDragging = false;

        this.#kb_event_bound = this.#handleKeyboard.bind(this);

        const backButton = s('#collectionBrowserUiBack');
        backButton.classList.remove('disabled');
        addButtonEventListeners(backButton,
            (pressed) => {
                if (pressed) {
                    StorageManager.clearValue(BOOT_TO);
                    StorageManager.clearValue(COLLECTION_BROWSER_COLLECTION_INDEX);
                    StorageManager.clearValue(COLLECTION_BROWSER_ITEM_INDEX);
                    this.close();
                    this.#vme.toggleScreen(VME.CURRENT_SCREEN.MENU);
                }
            });
            
        this.#addLaunchAnimationStyles();
    }
    
    #addLaunchAnimationStyles() {
        if (!document.getElementById('launchAnimationStyles')) {
            const styleEl = document.createElement('style');
            styleEl.id = 'launchAnimationStyles';
            styleEl.textContent = `
                @keyframes launchPulse {
                    0% { transform: scale(1); filter: brightness(1); }
                    50% { transform: scale(1.05); filter: brightness(1.3); }
                    100% { transform: scale(1); filter: brightness(1); }
                }
                .launch-feedback {
                    animation: launchPulse 0.3s ease-in-out;
                }
                
                @keyframes zoomOut {
                    0% { transform: scale(1); opacity: 1; }
                    100% { transform: scale(1.5); opacity: 0; }
                }
                .zoom-out {
                    animation: zoomOut 0.5s ease-in-out forwards;
                }
            `;
            document.head.appendChild(styleEl);
        }
    }
    
    #setUIReady(ready) {
        this.#uiReady = ready;
        const buttons = ['collectionBrowserUiLoad', 'collectionBrowserUiRestore'];
        buttons.forEach(id => {
            const button = document.getElementById(id);
            if (button) {
                if (!ready) {
                    button.classList.add('disabled');
                } else if (this.#selected) {
                    if (id === 'collectionBrowserUiRestore') {
                        const activePanel = this.#flicking?.currentPanel;
                        if (activePanel && activePanel.element.dataset.save !== "undefined") {
                            button.classList.remove('disabled');
                        } else {
                            button.classList.add('disabled');
                        }
                    } else {
                        button.classList.remove('disabled');
                    }
                }
            }
        });
    }
    
    #addLaunchVisualFeedback(element) {
        element.classList.add('launch-feedback');
        
        setTimeout(() => {
            setTimeout(() => {
                element.classList.add('zoom-out');
            }, 100);
        }, 100);
        
        setTimeout(() => {
            element.classList.remove('launch-feedback');
        }, 500);
    }

    #createPanelHTML(item) {
        if (item.platform_id == "md") item.platform_id = "smd"; //temp fix
        const platform = Object.values(SelectedPlatforms).find(platform => platform.platform_id === item.platform_id);
        const randomDegree = Math.random() * 20 - 10;
        
        if (item.image && item.image.startsWith('blob:')) {
            this.#urlsToRevoke.add(item.image);
        }
        
        return `
        <div class="flicking-panel" data-id="${item.id}" data-save="${item.save_data_id}">
            <img src="${item.image}" alt="${item.title}" loading="lazy" style="transform: rotate(${randomDegree}deg)">
            <div class="flicking-title flicking-title-name">
            <span class="flicking-primary-label">${item.title}</span>
            <br/>
            <span class="flicking-secondary-label">(${item.credits})</span>
            <br/>
            <span class="flicking-secondary-label">${platform.platform_name}</span>
            </div>
        </div>
        `;
    }

    #updateActivePanel() {
        const activePanel = this.#flicking?.currentPanel;

        if (activePanel != null) {
            document.getElementById('collectionBrowserEmpty').style.display = "none";
            
            const panels = document.querySelectorAll(".flicking-panel");
            panels.forEach(panel => panel.classList.remove("active"));
            activePanel.element.classList.add("active");
            
            document.getElementById('collectionBrowserUiLoad').classList.remove('disabled');
            if (activePanel.element.dataset.save !== "undefined") {
                document.getElementById('collectionBrowserUiRestore').classList.remove('disabled');
            } else {
                document.getElementById('collectionBrowserUiRestore').classList.add('disabled');
            }
            this.#selected = true;
            this.#updateBackground();
        } else {
            document.getElementById('collectionBrowserEmpty').style.display = "block";
            document.getElementById('collectionBrowserEmpty').innerHTML = "No collection found.";
            document.getElementById('collectionBrowserUiRestore').classList.add('disabled');
            document.getElementById('collectionBrowserUiLoad').classList.add('disabled');
            this.#selected = false;
        }
    }
    
    #updateBackground() {
        const now = performance.now();
        if (now - this.#lastBackgroundUpdate < 16) { // ~60fps
            return;
        }
        this.#lastBackgroundUpdate = now;

        const currentPanel = this.#flicking?.currentPanel;
        const el = document.getElementById('collection-flicking-background');

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
        if (!this.#flicking?.camera) return;

        const background = document.getElementById('collection-flicking-background');
        if (!background) return;

        const now = performance.now();
        if (now - this.#lastParallaxUpdate < 16) return;
        this.#lastParallaxUpdate = now;

        const flickingWidth = this.#flicking.element.clientWidth;
        const scrollRatio = this.#flicking.camera.position / flickingWidth;

        requestAnimationFrame(() => {
            background.style.transform = `translate3d(${scrollRatio * 50}px,0,0) scale(12)`;
        });
    }

    async open(collectionIndex = 1, collectionItemIndex = 1) {
        let div = document.querySelector('#collection-browser');
        div.classList.add('show');
        div.style.opacity = 0;
        
        setTimeout(() => {
            div.style.opacity = 1;
            
            const bg = document.getElementById('collection-flicking-background');
            if (bg) {
                bg.classList.remove('show');
                setTimeout(() => {
                    bg.classList.add('show');
                }, 10);
            }
        }, 10);

        this.#destroy();

        this.#flicking = new Flicking("#collection-flicking", {
            circular: false,
            moveType: "snap",
            preventClickOnDrag: true,
            autoResize: true,
            align: "center"
        });

        const self = this;
        this.#setUIReady(false);

        const throttledParallax = this.#throttle(this.#updateParallax.bind(this), 16);
        const debouncedBackground = this.#debounce(this.#updateBackground.bind(this), 16);

        this.#flicking.on("changed", e => {
            debouncedBackground();
            
            self.#updateActivePanel();
            
            this.#flicking.resize();
            if (this.#flicking.currentPanel) {
                setTimeout(() => {
                    if (this.#flicking && this.#flicking.currentPanel) {
                        this.#flicking.moveTo(this.#flicking.currentPanel.index, 0);
                    }
                }, 10);
            }
            
            this.#setUIReady(true);
        });

        this.#flicking.on("move", e => {
            throttledParallax();
            this.#setUIReady(false);
        });

        this.#flicking.on("moveEnd", e => { 
            self.#updateActivePanel();
            this.#flicking.resize();
            if (this.#flicking.currentPanel) {
                this.#flicking.moveTo(this.#flicking.currentPanel.index, 0);
            }
            this.#setUIReady(true);
            this.#isDragging = false;
        });

        let isAnimating = false;
        const handlePanelClick = (index, element) => {
            if (isAnimating || this.#isDragging || !this.#uiReady) return;

            const activePanel = this.#flicking.currentPanel;
            const isAlreadyActive = activePanel && activePanel.index === index;

            if (isAlreadyActive) {
                if (element.dataset.save !== "undefined") {
                    this.#restoreSelected();
                } else {
                    this.#loadSelected();
                }
            } else {
                isAnimating = true;
                this.#flicking.moveTo(index).then(() => {
                    isAnimating = false;
                }).catch(() => {
                    isAnimating = false;
                });
            }
        };

        this.#items = [];

        const saveMeta = await this.#db.getAllSaveMeta();
        this.#db.getCollectionItems()
            .then(items => {
                if (items.length == 0) {
                    self.#updateActivePanel();
                } else {
                    const container = document.querySelector('#collection-browser');
                    container.classList.add('transitioning');
                    const flickingElement = document.querySelector('#collection-flicking');
                    if (flickingElement) {
                        flickingElement.classList.add('view-exit');
                    }
                    
                    setTimeout(() => {
                        if (flickingElement) {
                            flickingElement.classList.remove('view-exit');
                            flickingElement.classList.add('view-enter');
                        }
                        
                        items.forEach(item => {
                            const saveAvailable = saveMeta.
                                filter(save => save.platform_id == item.platform_id && save.rom_data_id == item.rom_data_id)
                                .sort((a, b) => b.timestamp - a.timestamp)[0];

                            if (saveAvailable != undefined) {
                                item.save_data_id = saveAvailable.save_data_id;
                            }

                            const newPanel = self.#createPanelHTML(item);
                            self.#flicking.append(newPanel);
                            this.#items.push(item);
                        });

                        const panels = document.querySelectorAll(".flicking-panel");
                        panels.forEach((panel, index) => {
                            panel.addEventListener("click", () => handlePanelClick(index, panel));
                            panel.addEventListener("touchstart", () => {
                                this.#isDragging = false;
                            });
                            panel.addEventListener("touchmove", () => {
                                this.#isDragging = true;
                            });
                            panel.addEventListener("touchend", () => {
                                if (!this.#isDragging) {
                                    handlePanelClick(index, panel);
                                }
                                setTimeout(() => {
                                    this.#isDragging = false;
                                }, 50);
                            });
                        });

                        this.#flicking.on("moveStart", e => {
                            const panels = document.querySelectorAll(".flicking-panel");
                            panels.forEach(panel => panel.classList.remove("active"));
                            document.getElementById('collectionBrowserUiLoad').classList.add('disabled');
                            document.getElementById('collectionBrowserUiRestore').classList.add('disabled');
                            this.#selected = false;
                            this.#isDragging = true;
                        });

                        panels.forEach(panel => {
                            panel.style.opacity = '0';
                        });

                        const targetIndex = self.#flicking.panels.findIndex(panel => 
                            panel.element.dataset.id === String(collectionItemIndex));

                        if (targetIndex >= 0) {
                            self.#flicking.moveTo(targetIndex, 0);
                            
                            self.#flicking.resize();
                            
                            setTimeout(() => {
                                if (self.#flicking && self.#flicking.panels.length > targetIndex) {
                                    self.#flicking.moveTo(targetIndex, 0);
                                    
                                    requestAnimationFrame(() => {
                                        panels.forEach(panel => {
                                            panel.style.transition = 'opacity 0.3s ease-in';
                                            panel.style.opacity = '1';
                                        });
                                    });
                                }
                            }, 50);
                        } else {
                            panels.forEach(panel => {
                                panel.style.transition = 'opacity 0.3s ease-in';
                                panel.style.opacity = '1';
                            });
                        }

                        setTimeout(() => {
                            container.classList.remove('transitioning');
                            if (flickingElement) {
                                flickingElement.classList.remove('view-enter');
                            }
                            
                            self.#updateActivePanel();
                            this.#setUIReady(true);
                        }, 300);

                        this.#launched = false;
                    }, 100);
                }
            });

        document.addEventListener("keydown", this.#kb_event_bound);

        addButtonEventListeners(s('#collectionBrowserUiLoad'),
            (pressed) => {
                if (pressed && this.#selected && this.#uiReady) {
                    this.#loadSelected();
                }
            });

        addButtonEventListeners(s('#collectionBrowserUiRestore'),
            (pressed) => {
                if (pressed && this.#selected && this.#uiReady) {
                    this.#restoreSelected();
                }
            });

        StorageManager.storeValue(BOOT_TO, BOOT_TO_COLLECTION_BROWSER);

        this.#vme.toggleScreen(VME.CURRENT_SCREEN.COLLECTION_BROWSER);
    }

    close() {
        document.removeEventListener("keydown", this.#kb_event_bound);
        this.#destroy();
        this.#cli.reset();
    }

    async #restoreSelected() {
        if (this.#selected && !this.#launched && this.#uiReady) {
            const activePanel = this.#flicking.currentPanel;
            if (activePanel != null) {
                if (document.getElementById('collectionBrowserUiRestore').classList.contains('disabled')) {
                    return;
                }
                this.#launched = true;

                this.#addLaunchVisualFeedback(activePanel.element);

                const id = activePanel.element.getAttribute('data-id');
                const intId = parseInt(id, 10);

                StorageManager.storeValue(COLLECTION_BROWSER_COLLECTION_INDEX, 1);
                StorageManager.storeValue(COLLECTION_BROWSER_ITEM_INDEX, intId);

                const filteredItems = this.#items.filter(item => item.id == intId);

                if (filteredItems.length > 0) {
                    const saveId = activePanel.element.dataset.save;
                    const saveIntId = parseInt(saveId, 10);
                    const state = await this.#db.getSaveData(saveIntId);
                    const item = filteredItems[0];
                    const rom = await this.#db.getRomData(item.rom_data_id);
                    await new Promise(resolve => setTimeout(resolve, 100));
                    this.#platform_manager.loadRomFromCollection(item.platform_id, rom.rom_data, item.rom_name, item.title, state.save_data);
                    this.close();
                } else {
                    throw new Error("Cannot load selected program.");
                }
            }
        }
    }

    async #loadSelected() {
        if (this.#selected && !this.#launched && this.#uiReady) {
            this.#launched = true;
            const activePanel = this.#flicking.currentPanel;
            if (activePanel != null) {
                this.#addLaunchVisualFeedback(activePanel.element);
                
                const id = activePanel.element.getAttribute('data-id');
                const intId = parseInt(id, 10);

                StorageManager.storeValue(COLLECTION_BROWSER_COLLECTION_INDEX, 1);
                StorageManager.storeValue(COLLECTION_BROWSER_ITEM_INDEX, intId);

                const filteredItems = this.#items.filter(item => item.id == intId);
                
                if (filteredItems.length > 0) {
                    const item = filteredItems[0];
                    const rom = await this.#db.getRomData(item.rom_data_id);
                    await new Promise(resolve => setTimeout(resolve, 100));
                    this.#platform_manager.loadRomFromCollection(item.platform_id, rom.rom_data, item.rom_name, item.title);
                    this.close();
                } else {
                    throw new Error("Cannot load selected program.");
                }
            }
        }
    }

    #destroy() {
        this.#urlsToRevoke.forEach(url => {
            try {
                if (url && url.startsWith('blob:')) {
                    URL.revokeObjectURL(url);
                }
            } catch (e) {
                console.error('Error revoking URL:', e);
            }
        });
        this.#urlsToRevoke.clear();
        
        if (this.#flicking) {
            try {
                this.#flicking.off("changed");
                this.#flicking.off("move");
                this.#flicking.off("moveEnd");
                this.#flicking.off("moveStart");
                
                if (this.#flicking.panelCount > 0) {
                    const totalPanels = this.#flicking.panelCount;
                    for (let i = totalPanels - 1; i >= 0; i--) {
                        this.#flicking.remove(i);
                    }
                }
                
                this.#flicking.destroy();
            } catch (e) {
                console.error('Error during flicking cleanup:', e);
            }
            
            this.#flicking = null;
        }
        
        this.#selected = false;
        this.#launched = false;
        this.#uiReady = false;
        this.#isDragging = false;
        
        const background = document.getElementById('collection-flicking-background');
        if (background) {
            background.style.backgroundImage = 'none';
            background.style.transform = 'none';
        }
    }

    async #handleKeyboard(event) {
        if (!this.#flicking || this.#flicking.animating || !this.#uiReady) {
            return;
        }

        if (event.key === "ArrowRight") {
            this.#flicking.next().catch(() => { });
        } else if (event.key === "ArrowLeft") {
            this.#flicking.prev().catch(() => { });
        } else if (event.key === "Enter") {
            this.#loadSelected();
        } else if (event.key === "Escape") {
            this.close();
            this.#vme.toggleScreen(VME.CURRENT_SCREEN.MENU);
        }
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