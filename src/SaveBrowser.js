import { s, addButtonEventListeners } from "./dom";
import { createGuiButton } from './GuiButton.js';
import { VME } from './VME.js';
import Flicking from "@egjs/flicking";
import { Arrow } from "@egjs/flicking-plugins";
import "@egjs/flicking/dist/flicking.css";
import { SelectedPlatforms } from './platforms/PlatformManager.js';

export class SaveBrowser {
    #vme;
    #platform_manager;
    #db;
    #cli;

    #flicking;

    #selected;
    #kb_event_bound;

    constructor(vme, platform_manager, storage_manager, cli) {
        this.#vme = vme;
        this.#platform_manager = platform_manager;
        this.#db = storage_manager;
        this.#cli = cli;

        this.#kb_event_bound = this.#handleKeyboard.bind(this);

        addButtonEventListeners(s('#saveBrowserUiBack'),
            (pressed) => {
                if (pressed) {
                    this.close();
                    this.#vme.toggleScreen(VME.CURRENT_SCREEN.MENU);
                }
            });

        createGuiButton('menu-item-save-browser', 'Restore', 'R', () => {
            this.open();
        });
    }

    #createPanelHTML(item) {
        const platform = Object.values(SelectedPlatforms).find(platform => platform.platform_id === item.platform_id);
        const url = URL.createObjectURL(item.screenshot);

        const randomDegree = Math.random() * 20 - 10;

        return `
        <div class="flicking-panel" data-id="${item.id}">
            <img src="${url}" alt=${item.program_name}" style="transform: rotate(${randomDegree}deg)">
            <div class="flicking-title flicking-title-name">${this.#cleanFilename(item.program_name)} (${platform.short_name})</div>
        </div>
        `;
    }

    #updateBackground() {
        var currentPanel = this.#flicking.currentPanel;
        if (currentPanel == null) return;
        var backgroundImage = currentPanel.element.querySelector('img').src;

        document.querySelector(".flicking-background").style.background = backgroundImage;
        document.querySelector(".flicking-background").style.background = "url(" + backgroundImage + ")";
        document.querySelector(".flicking-background").style.transform = "scale(12)";
    }

    #updateParallax() {
        var flickingWidth = this.#flicking.element.clientWidth;
        var scrollRatio = this.#flicking.camera.position / flickingWidth;
        var background = document.querySelector(".flicking-background");

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
        div.style.opacity = 1;

        this.#destroy();

        this.#flicking = new Flicking("#flicking", {
            circular: true,
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

        this.#db.getAllSaveMeta()
            .then(items => {
                if (items.length == 0) {
                    self.#updateActivePanel();
                    self.#updateBackground();
                } else {
                    items.forEach(item => {
                        const newPanel = self.#createPanelHTML(item);
                        self.#flicking.append(newPanel);
                    });

                    const panels = document.querySelectorAll(".flicking-panel");
                    panels.forEach((panel, index) => {
                        panel.addEventListener("click", () => handlePanelClick(index));
                        panel.addEventListener("touchstart", () => handlePanelClick(index));
                    });

                    self.#flicking.on("changed", e => { self.#updateBackground(); self.#updateActivePanel(); });
                    self.#flicking.on("move", e => { self.#updateParallax(); });
                    self.#flicking.on("moveEnd", e => { self.#updateActivePanel(); });

                    self.#flicking.on("moveStart", e => {
                        const panels = document.querySelectorAll(".flicking-panel");
                        panels.forEach(panel => panel.classList.remove("active"));
                        document.getElementById('saveBrowserUiLoad').classList.add('disabled');
                        document.getElementById('saveBrowserUiDelete').classList.add('disabled');
                        this.#selected = false;
                    });

                    self.#updateActivePanel();
                    self.#updateBackground();
                }
            });

        document.addEventListener("keydown", this.#kb_event_bound);

        addButtonEventListeners(s('#saveBrowserUiDelete'),
            (pressed) => {
                if (pressed && this.#selected) {
                    const activePanel = this.#flicking.currentPanel;
                    if (activePanel != null) {
                        const id = activePanel.element.getAttribute('data-id');
                        const intId = parseInt(id, 10);

                        self.#db.deleteSave(intId).then(() => {
                            self.#flicking.remove(activePanel.index);
                            const newPanelIndex = Math.min(intId, self.#flicking.panelCount - 1);
                            if (self.#flicking.panelCount > 0) {
                                self.#flicking.moveTo(newPanelIndex, 0);
                            }
                            self.#updateActivePanel();
                        });

                    }
                }
            });

        addButtonEventListeners(s('#saveBrowserUiLoad'),
            (pressed) => {
                if (pressed) {
                    this.#loadSelected();
                }
            });

        this.#vme.toggleScreen(VME.CURRENT_SCREEN.SAVE_BROWSER);
    }

    close() {
        document.removeEventListener("keydown", this.#kb_event_bound);
        this.#cli.reset();
        this.#platform_manager.updatePlatform();
    }

    #loadSelected() {
        this.close();
        if (this.#selected) {
            const activePanel = this.#flicking.currentPanel;
            if (activePanel != null) {
                const id = activePanel.element.getAttribute('data-id');
                const intId = parseInt(id, 10);

                this.#db.getSaveData(intId)
                    .then((data) => {
                        this.#platform_manager.loadState(data.platform_id, data.save_data, data.rom_data, data.program_name);
                    })
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

    #handleKeyboard(event) {
        if (!this.#flicking || this.#flicking.animating) {
            return;
        }

        if (event.key === "ArrowRight") {
            this.#flicking.next().catch(() => {});
        } else if (event.key === "ArrowLeft") {
            this.#flicking.prev().catch(() => {});
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