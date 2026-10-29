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

        this.optionsContainer = this.#createOptionsContainer();
        this.container.appendChild(this.optionsContainer);

        this.optionElements = [];
        this.#createOptionElements(radius);

        parent.appendChild(this.container);

        this.#bindEvents();

        this.#sizeObserver = new ResizeObserver(() => this.#syncMenuLayout());
        this.#sizeObserver.observe(this.mainButton);

        MultiSelectTouchButton.#instances.push(this);
    }

    #handleOutsideTouch;
    #handleMainTouchStart;
    #handleMainTouchEnd;
    #sizeObserver;

    #syncMenuLayout() {
        if (!this.mainButton || !this.optionsContainer) return;
        const height = this.mainButton.getBoundingClientRect().height;
        if (height <= 0) return;
        this.optionsContainer.style.setProperty('--fast-menu-row-height', `${height}px`);

        // Let the viewport limit determine wrapping, then fit the widest row.
        this.optionsContainer.style.removeProperty('width');
        const style = getComputedStyle(this.optionsContainer);
        const padding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
        const gap = parseFloat(style.columnGap) || 0;
        const available = this.optionsContainer.getBoundingClientRect().width - padding;
        let rowWidth = 0;
        let widestRow = 0;
        for (const option of this.optionElements) {
            const width = option.getBoundingClientRect().width;
            if (rowWidth > 0 && rowWidth + gap + width > available + 0.1) {
                widestRow = Math.max(widestRow, rowWidth);
                rowWidth = width;
            } else {
                rowWidth += (rowWidth > 0 ? gap : 0) + width;
            }
        }
        widestRow = Math.max(widestRow, rowWidth);
        this.optionsContainer.style.width = `${Math.ceil((widestRow + padding) * 64) / 64}px`;
    }

    #createOptionElements(radius) {
        this.optionsContainer.innerHTML = '';
        this.optionElements = [];

        this.options.forEach((label, index) => {
            const shouldInclude = this.showSelectedInPopup || index !== this.selectedIndex;

            if (shouldInclude) {
                const isSelected = index === this.selectedIndex;
                const shouldHighlight = isSelected && this.highlightSelectedInPopup;
                const option = this.#createOptionElement(label, radius, shouldHighlight, this.showSelectedInPopup);
                option.style.setProperty('--fast-menu-option-delay', `${this.optionElements.length * 35}ms`);

                const isClickable = this.showSelectedInPopup || !isSelected;

                if (isClickable) {
                    option.addEventListener('touchstart', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        option.classList.add('is-active');
                    });

                    option.addEventListener('touchend', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        option.classList.remove('is-active');
                        this.#selectOption(index);
                    });
                    option.addEventListener('touchcancel', () => option.classList.remove('is-active'));
                }

                this.optionsContainer.appendChild(option);
                this.optionElements.push(option);
            }
        });
        this.optionsContainer.style.setProperty('--fast-menu-frame-delay', `${150 + Math.max(0, this.optionElements.length - 1) * 35}ms`);
    }
    
    #createButtonContent(label, showArrow = true) {
        return `
            <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                <span>${label}</span>
                ${showArrow ? '<span class="fast-control__arrow">►</span>' : ''}
            </div>
        `;
    }
    
    #createButtonElement(label, radius) {
        const button = document.createElement('div');
        button.classList.add('fast-button', 'fast-control', 'fast-control--trigger');
        button.innerHTML = label;
        button.style.borderRadius = radius;
        button.style.display = 'flex';
        button.style.alignItems = 'center';
        button.style.justifyContent = 'center';
        button.style.pointerEvents = 'auto';
        button.style.width = '100%';
        button.style.height = '100%';
        button.style.whiteSpace = 'nowrap';
        return button;
    }
    
    #createOptionElement(label, radius, isSelected = false, allowClickSelected = false) {
        const option = document.createElement('div');
        option.classList.add('fast-button', 'fast-control', 'fast-control--option');
        option.classList.toggle('is-selected', isSelected);
        option.classList.toggle('is-disabled', isSelected && !allowClickSelected);
        option.textContent = label;
        option.style.borderRadius = radius;
        option.style.display = 'flex';
        option.style.alignItems = 'center';
        option.style.justifyContent = 'center';
        option.style.padding = '0 12px';
        option.style.whiteSpace = 'nowrap';
        option.style.boxSizing = 'border-box';
        option.style.textTransform = 'uppercase';

        return option;
    }
    
    #createOptionsContainer() {
        const container = document.createElement('div');
        container.classList.add('fast-menu');
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
        this.#syncMenuLayout();
        // Commit each new option's initial position before starting its transition.
        this.optionsContainer.getBoundingClientRect();
        this.isExpanded = true;
        this.optionsContainer.classList.add('is-open');
        this.mainButton.classList.add('is-open');

        const displayLabel = this.fixedLabel || this.options[this.selectedIndex];
        this.mainButton.innerHTML = this.#createButtonContent(displayLabel, true).replace('►', '◄');
    }

    #collapse() {
        if (!this.isExpanded) return;

        this.isExpanded = false;
        this.optionsContainer.classList.remove('is-open');
        this.mainButton.classList.remove('is-open');

        const displayLabel = this.fixedLabel || this.options[this.selectedIndex];
        this.mainButton.innerHTML = this.#createButtonContent(displayLabel, this.showArrow);
    }

    destroy() {
        this.#sizeObserver.disconnect();
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
