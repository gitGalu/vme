import { QJ_LABEL_COLOR, QJ_IDLE_COLOR, QJ_ACTIVE_COLOR } from '../Constants.js';

export class MultiSelectTouchButton {
    static #instances = [];

    constructor(parent, options, gridArea, id, elListener, initialIndex = 0, radius = '12px', showArrow = true, shouldExpandCallback = null, fixedLabel = null, showSelectedInPopup = false, highlightSelectedInPopup = true) {
        this.options = options;
        this.elListener = elListener;
        this.isExpanded = false;
        this.selectedIndex = initialIndex;
        this.showArrow = showArrow;
        this.shouldExpandCallback = shouldExpandCallback;
        this.fixedLabel = fixedLabel;
        this.showSelectedInPopup = showSelectedInPopup;
        this.highlightSelectedInPopup = highlightSelectedInPopup;
        this.#handleOutsideTouch = null;
        this.#handleMainTouchStart = null;
        this.#handleMainTouchEnd = null;

        this.container = document.createElement('div');
        this.container.style.position = 'relative';
        if (gridArea) {
            this.container.style.gridArea = gridArea;
        }
        if (id) {
            this.container.id = id;
        }

        const displayLabel = this.fixedLabel || options[initialIndex];
        const initialLabel = this.#createButtonContent(displayLabel, this.showArrow);
        this.mainButton = this.#createButtonElement(initialLabel, radius);
        this.container.appendChild(this.mainButton);

        this.optionsContainer = this.#createOptionsContainer(radius);
        this.container.appendChild(this.optionsContainer);

        this.optionElements = [];
        this.#createOptionElements(radius);

        parent.appendChild(this.container);

        this.#bindEvents();

        MultiSelectTouchButton.#instances.push(this);
    }

    #handleOutsideTouch;
    #handleMainTouchStart;
    #handleMainTouchEnd;

    #createOptionElements(radius) {
        this.optionsContainer.innerHTML = '';
        this.optionElements = [];

        this.options.forEach((label, index) => {
            const shouldInclude = this.showSelectedInPopup || index !== this.selectedIndex;

            if (shouldInclude) {
                const isSelected = index === this.selectedIndex;
                const shouldHighlight = isSelected && this.highlightSelectedInPopup;
                const option = this.#createOptionElement(label, radius, shouldHighlight, this.showSelectedInPopup);
                option.style.transform = 'translateY(-20px)';
                option.style.transition = 'opacity 0.15s, transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)';

                const isClickable = this.showSelectedInPopup || !isSelected;

                if (isClickable) {
                    option.addEventListener('touchstart', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        option.style.backgroundColor = '#1a1a1a';
                        option.style.color = shouldHighlight ? '#ffffffaa' : '#888888aa';
                    });

                    option.addEventListener('touchend', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        option.style.backgroundColor = '#000000';
                        option.style.color = shouldHighlight ? '#ffffffff' : QJ_LABEL_COLOR;
                        this.#selectOption(index);
                    });
                }

                this.optionsContainer.appendChild(option);
                this.optionElements.push(option);
            }
        });
    }
    
    #createButtonContent(label, showArrow = true) {
        return `
            <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                <span style="font-size: 50%;">${label}</span>
                ${showArrow ? '<span style="font-size: 35%;">►</span>' : ''}
            </div>
        `;
    }
    
    #createButtonElement(label, radius) {
        const button = document.createElement('div');
        button.classList.add('fast-button');
        button.innerHTML = label;
        button.style.backgroundColor = QJ_IDLE_COLOR;
        button.style.borderRadius = radius;
        button.style.display = 'flex';
        button.style.alignItems = 'center';
        button.style.color = QJ_LABEL_COLOR;
        button.style.fontWeight = 'bold';
        button.style.justifyContent = 'center';
        button.style.pointerEvents = 'auto';
        button.style.width = '100%';
        button.style.height = '100%';
        button.style.whiteSpace = 'nowrap';
        return button;
    }
    
    #createOptionElement(label, radius, isSelected = false, allowClickSelected = false) {
        const option = document.createElement('div');
        option.classList.add('fast-button');
        option.innerHTML = `<span style="font-size: 50%;">${label}</span>`;
        option.style.backgroundColor = '#000000';
        option.style.borderRadius = radius;
        option.style.display = 'flex';
        option.style.alignItems = 'center';
        option.style.color = isSelected ? '#ffffffff' : QJ_LABEL_COLOR;
        option.style.border = 'solid 1px #88888888';
        option.style.fontWeight = 'bold';
        option.style.justifyContent = 'center';
        option.style.pointerEvents = (isSelected && !allowClickSelected) ? 'none' : 'auto';
        option.style.padding = '12px 16px';
        option.style.whiteSpace = 'nowrap';
        option.style.height = '100%';
        option.style.boxSizing = 'border-box';
        option.style.textTransform = 'uppercase';

        return option;
    }
    
    #createOptionsContainer(radius) {
        const container = document.createElement('div');
        container.style.position = 'absolute';
        container.style.top = '0';
        container.style.left = '100%';
        container.style.display = 'flex';
        container.style.flexDirection = 'row';
        container.style.gap = '2px';
        container.style.marginLeft = '2px';
        container.style.visibility = 'hidden';
        container.style.zIndex = '7778';
        container.style.height = '100%';
        return container;
    }

    #bindEvents() {
        this.#handleMainTouchStart = (e) => {
            e.preventDefault();
            e.stopPropagation();
        };

        this.#handleMainTouchEnd = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (this.isExpanded) {
                this.#collapse();
            } else {
                const shouldExpand = this.shouldExpandCallback ? this.shouldExpandCallback() : true;
                if (shouldExpand) {
                    this.#expand();
                } else {
                    if (this.elListener) {
                        this.elListener.trigger(true);
                    }
                }
            }
        };

        this.mainButton.addEventListener('touchstart', this.#handleMainTouchStart);
        this.mainButton.addEventListener('touchend', this.#handleMainTouchEnd);

        this.#handleOutsideTouch = (e) => {
            if (this.isExpanded && !this.container.contains(e.target)) {
                this.#collapse();
            }
        };

        document.addEventListener('touchstart', this.#handleOutsideTouch);
    }

    #selectOption(index) {
        if (index >= 0 && index < this.options.length) {
            this.selectedIndex = index;
            this.elListener.trigger({
                selected: true,
                index: this.selectedIndex,
                label: this.options[this.selectedIndex]
            });
            const displayLabel = this.fixedLabel || this.options[this.selectedIndex];
            this.mainButton.innerHTML = this.#createButtonContent(displayLabel, this.showArrow);
            this.#collapse();
        }
    }

    setSelectedIndex(index) {
        if (index >= 0 && index < this.options.length) {
            this.selectedIndex = index;
            const displayLabel = this.fixedLabel || this.options[this.selectedIndex];
            this.mainButton.innerHTML = this.#createButtonContent(displayLabel, this.showArrow);
        }
    }
    
    #expand() {
        if (this.isExpanded) return;

        MultiSelectTouchButton.#instances.forEach(instance => {
            if (instance !== this && instance.isExpanded) {
                instance.#collapse();
            }
        });

        this.#createOptionElements(this.mainButton.style.borderRadius);
        this.isExpanded = true;
        this.optionsContainer.style.visibility = 'visible';
        this.mainButton.style.backgroundColor = QJ_ACTIVE_COLOR;

        const displayLabel = this.fixedLabel || this.options[this.selectedIndex];
        this.mainButton.innerHTML = this.#createButtonContent(displayLabel, true).replace('►', '◄');

        this.optionElements.forEach((option, index) => {
            setTimeout(() => {
                option.style.opacity = '1';
                option.style.transform = 'translateY(0)';
            }, index * 60);
        });
    }

    #collapse() {
        if (!this.isExpanded) return;

        this.isExpanded = false;
        this.mainButton.style.backgroundColor = QJ_IDLE_COLOR;

        const displayLabel = this.fixedLabel || this.options[this.selectedIndex];
        this.mainButton.innerHTML = this.#createButtonContent(displayLabel, this.showArrow);

        this.optionElements.forEach((option, index) => {
            option.style.opacity = '0';
            option.style.transform = 'translateY(-20px)';
        });

        setTimeout(() => {
            this.optionsContainer.style.visibility = 'hidden';
        }, 200);
    }

    destroy() {
        this.#collapse();

        if (this.mainButton && this.#handleMainTouchStart) {
            this.mainButton.removeEventListener('touchstart', this.#handleMainTouchStart);
        }

        if (this.mainButton && this.#handleMainTouchEnd) {
            this.mainButton.removeEventListener('touchend', this.#handleMainTouchEnd);
        }

        if (this.#handleOutsideTouch) {
            document.removeEventListener('touchstart', this.#handleOutsideTouch);
        }

        const index = MultiSelectTouchButton.#instances.indexOf(this);
        if (index > -1) {
            MultiSelectTouchButton.#instances.splice(index, 1);
        }

        this.container.remove();
        this.optionElements = [];
        this.optionsContainer = null;
        this.mainButton = null;
        this.container = null;
    }
}