export class ConfigOverrideDropdown {
    static #openDropdown = null;

    #container;
    #options;
    #selectedValue;
    #focusedIndex;
    #isOpen;
    #changeCallback;
    #root;
    #selectedElement;
    #optionsElement;
    #handleDocumentClickBound;
    #handleKeyDownBound;

    constructor(container, options = [], initialValue = null) {
        this.#container = container;
        this.#options = Array.isArray(options) ? options : [];
        this.#selectedValue = initialValue ?? (this.#options[0]?.value ?? null);
        this.#focusedIndex = 0;
        this.#isOpen = false;
        this.#changeCallback = null;
        this.#root = null;
        this.#selectedElement = null;
        this.#optionsElement = null;
        this.#handleDocumentClickBound = this.#handleDocumentClick.bind(this);
        this.#handleKeyDownBound = this.#handleKeyDown.bind(this);

        this.render();
    }

    onChange(callback) {
        this.#changeCallback = callback;
    }

    getValue() {
        return this.#selectedValue;
    }

    focus() {
        this.#root?.focus();
    }

    close() {
        if (!this.#isOpen || !this.#root) {
            return;
        }
        this.#isOpen = false;
        this.#root.classList.remove('config-override-dropdown--open');
        document.removeEventListener('click', this.#handleDocumentClickBound);
        if (ConfigOverrideDropdown.#openDropdown === this) {
            ConfigOverrideDropdown.#openDropdown = null;
        }
    }

    open() {
        if (this.#isOpen || !this.#root) {
            return;
        }
        if (ConfigOverrideDropdown.#openDropdown && ConfigOverrideDropdown.#openDropdown !== this) {
            ConfigOverrideDropdown.#openDropdown.close();
        }
        this.#isOpen = true;
        this.#root.classList.add('config-override-dropdown--open');
        ConfigOverrideDropdown.#openDropdown = this;
        const selectedIndex = this.#options.findIndex(option => option.value === this.#selectedValue);
        this.#focusedIndex = selectedIndex >= 0 ? selectedIndex : 0;
        this.#updateFocusedOption();

        setTimeout(() => {
            document.addEventListener('click', this.#handleDocumentClickBound);
        }, 0);
    }

    toggle() {
        if (this.#isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    render() {
        if (!this.#container) {
            return;
        }

        this.#container.innerHTML = '';

        const root = document.createElement('div');
        root.className = 'config-override-dropdown';
        root.tabIndex = 0;

        const selected = document.createElement('button');
        selected.type = 'button';
        selected.className = 'config-override-dropdown__selected';
        selected.addEventListener('click', (event) => {
            event.stopPropagation();
            this.toggle();
        });

        const optionsElement = document.createElement('div');
        optionsElement.className = 'config-override-dropdown__options';

        this.#options.forEach((option, index) => {
            const optionElement = document.createElement('button');
            optionElement.type = 'button';
            optionElement.className = 'config-override-dropdown__option';
            optionElement.textContent = option.label ?? option.text ?? `${option.value}`;
            optionElement.dataset.value = `${option.value}`;
            optionElement.dataset.index = `${index}`;
            optionElement.addEventListener('click', (event) => {
                event.stopPropagation();
                this.#selectOption(option.value);
            });
            optionsElement.appendChild(optionElement);
        });

        root.appendChild(selected);
        root.appendChild(optionsElement);
        root.addEventListener('keydown', this.#handleKeyDownBound);
        this.#container.appendChild(root);

        this.#root = root;
        this.#selectedElement = selected;
        this.#optionsElement = optionsElement;

        this.#updateSelectedDisplay();
        this.#updateSelectedOptionState();
    }

    #selectOption(value) {
        const previousValue = this.#selectedValue;
        this.#selectedValue = value;
        this.#updateSelectedDisplay();
        this.#updateSelectedOptionState();
        this.close();
        this.#root?.focus();

        if (this.#changeCallback && previousValue !== value) {
            this.#changeCallback({ target: { value } });
        }
    }

    #updateSelectedDisplay() {
        if (!this.#selectedElement) {
            return;
        }
        const selectedOption = this.#options.find(option => option.value === this.#selectedValue);
        this.#selectedElement.textContent = selectedOption?.label ?? selectedOption?.text ?? '';
    }

    #updateSelectedOptionState() {
        if (!this.#optionsElement) {
            return;
        }
        const optionElements = this.#optionsElement.querySelectorAll('.config-override-dropdown__option');
        optionElements.forEach((element) => {
            const isSelected = element.dataset.value === `${this.#selectedValue}`;
            element.classList.toggle('config-override-dropdown__option--selected', isSelected);
        });
    }

    #updateFocusedOption() {
        if (!this.#optionsElement) {
            return;
        }
        const optionElements = this.#optionsElement.querySelectorAll('.config-override-dropdown__option');
        optionElements.forEach((element, index) => {
            const isFocused = index === this.#focusedIndex;
            element.classList.toggle('config-override-dropdown__option--focused', isFocused);
            if (isFocused) {
                element.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        });
    }

    #handleDocumentClick(event) {
        if (!this.#root?.contains(event.target)) {
            this.close();
        }
    }

    #handleKeyDown(event) {
        if (!this.#isOpen) {
            if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                event.stopPropagation();
                this.open();
            }
            return;
        }

        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                event.stopPropagation();
                this.#focusedIndex = Math.min(this.#focusedIndex + 1, this.#options.length - 1);
                this.#updateFocusedOption();
                break;
            case 'ArrowUp':
                event.preventDefault();
                event.stopPropagation();
                this.#focusedIndex = Math.max(this.#focusedIndex - 1, 0);
                this.#updateFocusedOption();
                break;
            case 'Enter':
            case ' ':
                event.preventDefault();
                event.stopPropagation();
                if (this.#focusedIndex >= 0 && this.#focusedIndex < this.#options.length) {
                    this.#selectOption(this.#options[this.#focusedIndex].value);
                }
                break;
            case 'Escape':
                event.preventDefault();
                event.stopPropagation();
                this.close();
                break;
        }
    }
}
