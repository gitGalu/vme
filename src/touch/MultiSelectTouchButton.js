import { QJ_LABEL_COLOR, QJ_IDLE_COLOR, QJ_ACTIVE_COLOR } from '../Constants.js';

export class MultiSelectTouchButton {
    constructor(parent, options, gridArea, id, elListener, initialIndex = 0, radius = '12px') {
        this.options = options;
        this.elListener = elListener;
        this.isExpanded = false;
        this.selectedIndex = initialIndex;

        this.container = document.createElement('div');
        this.container.style.position = 'relative';
        if (gridArea) {
            this.container.style.gridArea = gridArea;
        }
        if (id) {
            this.container.id = id;
        }
        
        const initialLabel = this.#createButtonContent(options[initialIndex]);
        this.mainButton = this.#createButtonElement(initialLabel, radius);
        this.container.appendChild(this.mainButton);
        
        this.optionsContainer = this.#createOptionsContainer(radius);
        this.container.appendChild(this.optionsContainer);
        
        this.optionElements = [];
        this.#createOptionElements(radius);
        
        parent.appendChild(this.container);
        
        this.#bindEvents();
    }
    
    #createOptionElements(radius) {
        this.optionsContainer.innerHTML = '';
        this.optionElements = [];
        
        this.options.forEach((label, index) => {
            if (index !== this.selectedIndex) {
                const option = this.#createOptionElement(label, radius);
                option.style.transform = 'translateY(-20px)';
                option.style.transition = 'opacity 0.15s, transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)';

                option.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    option.style.backgroundColor = '#1a1a1a';
                    option.style.color = '#888888aa';
                });
                
                option.addEventListener('touchend', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    option.style.backgroundColor = '#000000';
                    option.style.color = '#88888888';
                    this.#selectOption(index);
                });
                
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
    
    #createOptionElement(label, radius) {
        const option = document.createElement('div');
        option.classList.add('fast-button');
        option.innerHTML = `<span style="font-size: 50%;">${label}</span>`;
        option.style.backgroundColor = '#000000';
        option.style.borderRadius = radius;
        option.style.display = 'flex';
        option.style.alignItems = 'center';
        option.style.color = '#88888888';
        option.style.border = 'solid 1px #88888888';
        option.style.fontWeight = 'bold';
        option.style.justifyContent = 'center';
        option.style.pointerEvents = 'auto';
        option.style.padding = '12px 16px';
        option.style.whiteSpace = 'nowrap';
        option.style.height = '100%';
        option.style.boxSizing = 'border-box';
        
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
        this.mainButton.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
        
        this.mainButton.addEventListener('touchend', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (this.isExpanded) {
                this.#collapse();
            } else {
                this.#expand();
            }
        });
        
        const handleOutsideTouch = (e) => {
            if (this.isExpanded && !this.container.contains(e.target)) {
                this.#collapse();
            }
        };
        
        document.addEventListener('touchstart', handleOutsideTouch);
    }
    
    #selectOption(index) {
        if (index >= 0 && index < this.options.length) {
            this.selectedIndex = index;
            this.elListener.trigger({
                selected: true,
                index: this.selectedIndex,
                label: this.options[this.selectedIndex]
            });
            this.mainButton.innerHTML = this.#createButtonContent(this.options[this.selectedIndex]);
            this.#collapse();
        }
    }
    
    #expand() {
        if (this.isExpanded) return;
        
        this.#createOptionElements(this.mainButton.style.borderRadius);
        this.isExpanded = true;
        this.optionsContainer.style.visibility = 'visible';
        this.mainButton.style.backgroundColor = QJ_ACTIVE_COLOR;
        
        this.mainButton.innerHTML = this.#createButtonContent(this.options[this.selectedIndex]).replace('►', '◄');
        
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
        
        this.mainButton.innerHTML = this.#createButtonContent(this.options[this.selectedIndex]);
        
        this.optionElements.forEach((option, index) => {
            option.style.opacity = '0';
            option.style.transform = 'translateY(-20px)';
        });
        
        setTimeout(() => {
            this.optionsContainer.style.visibility = 'hidden';
        }, 200);
    }
}