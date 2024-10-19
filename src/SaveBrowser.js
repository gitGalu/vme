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

    constructor(vme, platform_manager, storage_manager, cli) {
        this.#vme = vme;
        this.#platform_manager = platform_manager;
        this.#db = storage_manager;
        this.#cli = cli;

        this.#kb_event_bound = this.#handleKeyboard.bind(this);

        this.#filter_change_handler_bound = this.#filterChangeHandler.bind(this);

        const backButton = s('#saveBrowserUiBack');
        const backHandler = (pressed) => {
            if (pressed) {
                this.close();
                this.#vme.toggleScreen(VME.CURRENT_SCREEN.MENU);
            }
        };
        addButtonEventListeners(backButton, backHandler);
        this.#eventListeners.push({ element: backButton, handler: backHandler });
    }

    #bindPanelEvents(panels) {
        this.#flicking.on("changed", e => { this.#updateBackground(); this.#updateActivePanel(); });
        this.#flicking.on("move", e => { this.#updateParallax(); });
        this.#flicking.on("moveEnd", e => { this.#updateActivePanel(); });

        panels.forEach((panel, index) => {
            const clickHandler = () => this.#flicking.moveTo(index);
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

        return `
        <div class="flicking-panel" data-id="${item.id}" data-platform-id="${platform.platform_id}">
            <img src="${url}" alt="${item.program_name}" style="transform: rotate(${randomDegree}deg)">
            <div class="flicking-title flicking-title-name">${this.#cleanFilename(item.program_name)} (${platform.short_name})</div>
        </div>
        `;
    }

    #addFilterItem(platform_id, platform_name) {
        const platformFilter = document.getElementById('platformFilter');

        const options = Array.from(platformFilter.options);
        const optionExists = options.some(option => option.value === platform_id);

        if (!optionExists) {
            const newOption = document.createElement('option');
            newOption.value = platform_id;
            newOption.text = platform_name;
            platformFilter.add(newOption);
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

    #recreatePanels(selectedPlatformId) {
        this.#clearPanels();

        this.#db.getAllSaveMeta()
            .then(items => {
                const filteredItems = selectedPlatformId === "all"
                    ? items
                    : items.filter(item => item.platform_id === selectedPlatformId);

                if (filteredItems.length === 0) {
                    this.#updateUI();
                } else {
                    this.#appendPanels(filteredItems);
                }
            });
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
            document.getElementById('saveBrowserUiLoad').classList.add('disabled');
            document.getElementById('saveBrowserUiDelete').classList.add('disabled');

            const panels = document.querySelectorAll(".flicking-panel");
            panels.forEach(panel => panel.classList.remove("active"));
            activePanel.element.classList.add("active");
            document.getElementById('saveBrowserUiLoad').classList.remove('disabled');
            document.getElementById('saveBrowserUiDelete').classList.remove('disabled');
            this.#selected = true;
        } else {
            document.getElementById('saveBrowserEmpty').style.display = "block";
            document.getElementById('saveBrowserEmpty').innerHTML = "No save states found.";
            document.getElementById('saveBrowserUiLoad').classList.add('disabled');
            document.getElementById('saveBrowserUiDelete').classList.add('disabled');
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

        const platformFilter = document.getElementById('platformFilter');;

        this.#db.getAllSaveMeta()
            .then(items => {
                if (items.length === 0) {
                    this.#updateUI();
                    platformFilter.setAttribute('disabled', 'true');
                } else {
                    this.#appendPanels(items);
                    platformFilter.removeAttribute('disabled');
                }
            });

        platformFilter.removeEventListener('change', this.#filter_change_handler_bound)
        platformFilter.addEventListener('change', this.#filter_change_handler_bound);
        this.#eventListeners.push({ element: platformFilter, handler: this.#filter_change_handler_bound });

        document.addEventListener("keydown", this.#kb_event_bound);

        const deleteButton = s('#saveBrowserUiDelete');
        const deleteHandler = (pressed) => {
            if (pressed && this.#selected) {
                this.#deleteSelectedPanel();
            }
        };
        addButtonEventListeners(deleteButton, deleteHandler);
        this.#eventListeners.push({ element: deleteButton, handler: deleteHandler });

        const loadButton = s('#saveBrowserUiLoad');
        const loadHandler = (pressed) => {
            if (pressed) {
                this.#loadSelected();
            }
        };
        addButtonEventListeners(loadButton, loadHandler);
        this.#eventListeners.push({ element: loadButton, handler: loadHandler });

        document.getElementById('platformFilter').value = "all";

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
        this.#recreatePanels(selectedPlatformId);
    }

    #deleteSelectedPanel() {
        const activePanel = this.#flicking.currentPanel;
        if (activePanel != null) {
            const id = activePanel.element.getAttribute('data-id');
            const intId = parseInt(id, 10);
            const max = this.#flicking.panelCount - 1;

            this.#db.deleteSave(intId).then(() => {
                this.#flicking.remove(activePanel.index);

                let newPanelIndex = activePanel.index;
                if (newPanelIndex >= max) {
                    newPanelIndex = max - 1;
                }

                if (this.#flicking.panelCount > 0) {
                    this.#flicking.moveTo(newPanelIndex, 0);
                }

                this.#updateUI();
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
                        this.#platform_manager.loadState(data.platform_id, data.save_data, data.rom_data, data.program_name);
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
            this.#loadSelected();
        } else if (event.key === "Escape") {
            this.close();
            this.#vme.toggleScreen(VME.CURRENT_SCREEN.MENU);
        }
    }

    #cleanFilename(filename) {
        filename = filename.replace(/\.[^/.]+$/, "");
        filename = filename.replace(/[\[\(][^\[\]\(\)]+[\]\)]/g, "").trim();

        return filename;
    }
}