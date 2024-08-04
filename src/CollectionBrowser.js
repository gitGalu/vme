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

    constructor(vme, platform_manager, storage_manager, cli) {
        this.#vme = vme;
        this.#platform_manager = platform_manager;
        this.#db = storage_manager;
        this.#cli = cli;

        this.#kb_event_bound = this.#handleKeyboard.bind(this);

        addButtonEventListeners(s('#collectionBrowserUiBack'),
            (pressed) => {
                if (pressed) {
                    StorageManager.clearValue(BOOT_TO);
                    StorageManager.clearValue(COLLECTION_BROWSER_COLLECTION_INDEX);
                    StorageManager.clearValue(COLLECTION_BROWSER_ITEM_INDEX);
                    this.close();
                    this.#vme.toggleScreen(VME.CURRENT_SCREEN.MENU);
                }
            });
    }

    #createPanelHTML(item) {
        if (item.platform_id == "md") item.platform_id = "smd"; //temp fix

        const platform = Object.values(SelectedPlatforms).find(platform => platform.platform_id === item.platform_id);

        const randomDegree = Math.random() * 20 - 10;

        return `
        <div class="flicking-panel" data-id="${item.id}">
            <img src="${item.image}" alt=${item.title}" style="transform: rotate(${randomDegree}deg)">
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
        const activePanel = this.#flicking.currentPanel;
        if (activePanel != null) {
            document.getElementById('collectionBrowserEmpty').style.display = "none";
            document.getElementById('collectionBrowserUiLoad').classList.add('disabled');

            const panels = document.querySelectorAll(".flicking-panel");
            panels.forEach(panel => panel.classList.remove("active"));
            activePanel.element.classList.add("active");
            document.getElementById('collectionBrowserUiLoad').classList.remove('disabled');
            this.#selected = true;
        } else {
            document.getElementById('collectionBrowserEmpty').style.display = "block";
            document.getElementById('collectionBrowserEmpty').innerHTML = "No collection found.";
            document.getElementById('collectionBrowserUiLoad').classList.add('disabled');
        }
    }

    open(collectionIndex = 1, collectionItemIndex = 1) {
        let div = document.querySelector('#collection-browser');
        div.classList.add('show');
        div.style.opacity = 1;

        this.#destroy();

        this.#flicking = new Flicking("#collection-flicking", {
            circular: false,
            moveType: "snap",
            preventClickOnDrag: true,
            autoResize: true
        });

        let self = this;

        let isAnimating = false;
        const handlePanelClick = (index) => {
            if (isAnimating) return;

            isAnimating = true;
            this.#flicking.moveTo(index).then(() => {
                isAnimating = false;
            }).catch(() => {
                isAnimating = false;
            });
        };

        this.#items = [];

        this.#db.getCollectionItems()
            .then(items => {
                if (items.length == 0) {
                    self.#updateActivePanel();
                } else {
                    items.forEach(item => {
                        const newPanel = self.#createPanelHTML(item);
                        self.#flicking.append(newPanel);
                        this.#items.push(item);
                    });

                    const panels = document.querySelectorAll(".flicking-panel");
                    panels.forEach((panel, index) => {
                        panel.addEventListener("click", () => handlePanelClick(index));
                        panel.addEventListener("touchstart", () => handlePanelClick(index));
                    });

                    self.#flicking.on("changed", e => { self.#updateActivePanel(); });
                    self.#flicking.on("moveEnd", e => { self.#updateActivePanel(); });

                    self.#flicking.on("moveStart", e => {
                        const panels = document.querySelectorAll(".flicking-panel");
                        panels.forEach(panel => panel.classList.remove("active"));
                        document.getElementById('collectionBrowserUiLoad').classList.add('disabled');
                        this.#selected = false;
                    });

                    if (collectionIndex >= 1) {
                        self.#flicking.moveTo(collectionItemIndex - 1, 0);
                    }

                    self.#updateActivePanel();

                    this.#launched = false;
                }
            });

        document.addEventListener("keydown", this.#kb_event_bound);

        addButtonEventListeners(s('#collectionBrowserUiLoad'),
            (pressed) => {
                if (pressed) {
                    this.#loadSelected();
                }
            });

        StorageManager.storeValue(BOOT_TO, BOOT_TO_COLLECTION_BROWSER);

        this.#vme.toggleScreen(VME.CURRENT_SCREEN.COLLECTION_BROWSER);
    }

    close() {
        document.removeEventListener("keydown", this.#kb_event_bound);
        this.#cli.reset();
    }

    async #loadSelected() {
        if (this.#selected && !this.#launched) {
            this.#launched = true;
            const activePanel = this.#flicking.currentPanel;
            if (activePanel != null) {
                const id = activePanel.element.getAttribute('data-id');
                const intId = parseInt(id, 10);

                StorageManager.storeValue(COLLECTION_BROWSER_COLLECTION_INDEX, 1);
                StorageManager.storeValue(COLLECTION_BROWSER_ITEM_INDEX, intId);

                const filteredItems = this.#items.filter(item => item.id === intId);

                if (filteredItems.length > 0) {
                    const item = filteredItems[0];
                    const rom = await this.#db.getRomData(item.rom_data_id);
                    this.#platform_manager.loadRomFromCollection(item.platform_id, rom.rom_data, item.rom_name);
                    this.close();
                } else {
                    throw new Exception("Cannot load selected program.");
                }
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
    }

    async #handleKeyboard(event) {
        if (!this.#flicking || this.#flicking.animating) {
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
}