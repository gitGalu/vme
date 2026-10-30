export class CustomDropdown {
    constructor(containerId, options = [], initialValue = null, { searchable = false, pinnedValue = null } = {}) {
        this.containerId = containerId;
        this.searchable = searchable;
        this.pinnedValue = pinnedValue;
        this.searchQuery = '';
        this.options = options; // {value, text}
        this.selectedValue = initialValue || (options.length > 0 ? options[0].value : null);
        this.isOpen = false;
        this.focusedIndex = 0;
        this.changeCallback = null;
        this.openChangeCallback = null;
        this.outsideClickTimer = null;

        this.toggle = this.toggle.bind(this);
        this.close = this.close.bind(this);
        this.selectOption = this.selectOption.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleOutsideClick = this.handleOutsideClick.bind(this);

        this.render();
    }

    onChange(callback) {
        this.changeCallback = callback;
    }

    onOpenChange(callback) {
        this.openChangeCallback = callback;
    }

    getValue() {
        return this.selectedValue;
    }

    setValue(value) {
        const option = this.options.find(opt => opt.value === value);
        if (option) {
            this.selectedValue = value;
            this.updateDisplay();
        }
    }

    setOptions(options) {
        this.options = options;
        if (options.length > 0 && !options.find(opt => opt.value === this.selectedValue)) {
            this.selectedValue = options[0].value;
        }
        this.render();
    }

    addOption(value, text) {
        const exists = this.options.some(opt => opt.value === value);
        if (!exists) {
            this.options.push({ value, text });
            this.render();
        }
    }

    render() {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        container.innerHTML = '';

        const dropdown = document.createElement('div');
        dropdown.className = 'custom-dropdown';

        const selected = document.createElement('div');
        selected.className = 'custom-dropdown-selected';
        const selectedOption = this.options.find(opt => opt.value === this.selectedValue);
        selected.textContent = selectedOption ? selectedOption.text : '';
        selected.addEventListener('click', this.toggle);

        const optionsList = document.createElement('div');
        optionsList.className = 'custom-dropdown-options';
        this.queryElement = null;
        if (this.searchable) {
            this.queryElement = document.createElement('div');
            this.queryElement.className = 'custom-dropdown-query';
            this.queryElement.setAttribute('aria-live', 'polite');
            optionsList.appendChild(this.queryElement);
        }

        this.options.forEach((option, index) => {
            const optionEl = document.createElement('div');
            optionEl.className = 'custom-dropdown-option';
            if (option.value === this.selectedValue) {
                optionEl.classList.add('selected');
            }
            optionEl.textContent = option.text;
            optionEl.setAttribute('data-value', option.value);
            optionEl.setAttribute('data-index', index);
            optionEl.addEventListener('click', (e) => {
                e.stopPropagation();
                this.selectOption(option.value);
            });
            optionsList.appendChild(optionEl);
        });

        dropdown.appendChild(selected);
        dropdown.appendChild(optionsList);
        container.appendChild(dropdown);

        this.dropdown = dropdown;
        this.selectedElement = selected;
        this.optionsListElement = optionsList;

        this.setWidthForLongestOption();

        dropdown.addEventListener('keydown', this.handleKeyDown);
        dropdown.setAttribute('tabindex', '0');
        if (this.searchable) this.setSearchQuery(this.searchQuery);
    }

    setWidthForLongestOption() {
        if (!this.selectedElement || this.options.length === 0) return;

        const measuringEl = document.createElement('div');
        measuringEl.style.visibility = 'hidden';
        measuringEl.style.position = 'absolute';
        measuringEl.style.width = 'auto';
        measuringEl.style.whiteSpace = 'nowrap';
        measuringEl.style.font = window.getComputedStyle(this.selectedElement).font;
        document.body.appendChild(measuringEl);

        let maxTextWidth = 0;
        this.options.forEach(option => {
            measuringEl.textContent = option.text;
            const width = measuringEl.offsetWidth;
            if (width > maxTextWidth) {
                maxTextWidth = width;
            }
        });

        document.body.removeChild(measuringEl);

        const totalWidth = maxTextWidth + 16 + 32 + 4; // 4px extra buffer

        if (totalWidth > 0) {
            this.selectedElement.style.minWidth = `${totalWidth}px`;
            this.dropdown.style.minWidth = `${totalWidth}px`;
        }
    }

    updateDisplay() {
        if (this.selectedElement) {
            const selectedOption = this.options.find(opt => opt.value === this.selectedValue);
            this.selectedElement.textContent = selectedOption ? selectedOption.text : '';
        }

        if (this.optionsListElement) {
            const optionElements = this.optionsListElement.querySelectorAll('.custom-dropdown-option');
            optionElements.forEach(el => {
                if (el.getAttribute('data-value') === this.selectedValue) {
                    el.classList.add('selected');
                } else {
                    el.classList.remove('selected');
                }
            });
        }
    }

    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    open() {
        if (this.isOpen) return;

        this.isOpen = true;
        this.dropdown.classList.add('open');

        const selectedIndex = this.options.findIndex(opt => opt.value === this.selectedValue);
        this.focusedIndex = selectedIndex >= 0 ? selectedIndex : 0;
        if (this.searchable) this.setSearchQuery('');
        else this.updateFocusedOption();
        this.openChangeCallback?.(true);

        this.outsideClickTimer = setTimeout(() => {
            this.outsideClickTimer = null;
            if (this.isOpen) document.addEventListener('click', this.handleOutsideClick);
        }, 0);
    }

    close() {
        clearTimeout(this.outsideClickTimer);
        this.outsideClickTimer = null;
        if (!this.isOpen) return;

        this.isOpen = false;
        this.dropdown.classList.remove('open');
        if (this.searchable) this.setSearchQuery('');
        document.removeEventListener('click', this.handleOutsideClick);
        this.openChangeCallback?.(false);
    }

    selectOption(value) {
        const oldValue = this.selectedValue;
        this.selectedValue = value;
        this.updateDisplay();
        this.close();
        if (this.dropdown) {
            this.dropdown.blur();
        }

        if (this.changeCallback && oldValue !== value) {
            this.changeCallback({ target: { value } });
        }
    }

    handleKeyDown(e) {
        if (this.isOpen && this.handleSearchKey(e)) return;
        if (!this.isOpen) {
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                this.open();
            }
            return;
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                this.moveFocus(1);
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.moveFocus(-1);
                break;
            case 'Enter':
            case ' ':
                e.preventDefault();
                if (this.focusedIndex >= 0 && this.focusedIndex < this.options.length) {
                    this.selectOption(this.options[this.focusedIndex].value);
                }
                break;
            case 'Escape':
                e.preventDefault();
                this.close();
                break;
        }
    }

    getVisibleIndices() {
        const terms = normalize(this.searchQuery).trim().split(/\s+/).filter(Boolean);
        return this.options.flatMap((option, index) => {
            const text = normalize(`${option.text} ${option.value}`);
            return option.value === this.pinnedValue || terms.every(term => text.includes(term)) ? [index] : [];
        });
    }

    getVisibleOptions() {
        return this.getVisibleIndices().map(index => this.options[index]);
    }

    setSearchQuery(query) {
        if (!this.searchable) return;
        this.searchQuery = query;
        const visible = this.getVisibleIndices();
        const selected = this.options.findIndex(option => option.value === this.selectedValue);
        this.focusedIndex = query.trim()
            ? (visible.find(index => this.options[index].value !== this.pinnedValue) ?? visible[0] ?? -1)
            : (visible.includes(selected) ? selected : visible[0] ?? -1);
        const indices = new Set(visible);
        this.optionsListElement?.querySelectorAll('.custom-dropdown-option').forEach((el, index) => {
            el.hidden = !indices.has(index);
        });
        if (this.queryElement) {
            this.queryElement.textContent = query;
            this.queryElement.hidden = !query;
        }
        this.updateFocusedOption();
    }

    handleSearchKey(event) {
        if (!this.searchable || event.ctrlKey || event.metaKey || event.altKey || event.isComposing || event.keyCode === 229) return false;
        if (event.key === 'Backspace') {
            event.preventDefault();
            this.setSearchQuery(Array.from(this.searchQuery).slice(0, -1).join(''));
            return true;
        }
        if (Array.from(event.key).length === 1 && (event.key !== ' ' || this.searchQuery)) {
            event.preventDefault();
            this.setSearchQuery(this.searchQuery + event.key);
            return true;
        }
        return false;
    }

    moveFocus(delta) {
        const visible = this.getVisibleIndices();
        const position = visible.indexOf(this.focusedIndex);
        this.focusedIndex = visible[Math.max(0, Math.min(position + delta, visible.length - 1))] ?? -1;
        this.updateFocusedOption();
    }

    updateFocusedOption() {
        const optionElements = this.optionsListElement.querySelectorAll('.custom-dropdown-option');
        optionElements.forEach((el, index) => {
            if (index === this.focusedIndex && !el.hidden) {
                el.classList.add('focused');
                if (this.isOpen) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            } else {
                el.classList.remove('focused');
            }
        });
    }

    handleOutsideClick(e) {
        if (!this.dropdown.contains(e.target)) {
            this.close();
        }
    }

    getElement() {
        return this.dropdown;
    }

    gamepadOpen() {
        if (!this.isOpen) {
            this.open();
            return true;
        }
        return false;
    }

    gamepadClose() {
        if (this.isOpen) {
            this.close();
            return true;
        }
        return false;
    }

    gamepadNavigate(direction) {
        if (!this.isOpen) return false;

        if (direction === 'up') {
            this.moveFocus(-1);
            return true;
        } else if (direction === 'down') {
            this.moveFocus(1);
            return true;
        }
        return false;
    }

    gamepadSelect() {
        if (this.isOpen && this.focusedIndex >= 0 && this.focusedIndex < this.options.length) {
            this.selectOption(this.options[this.focusedIndex].value);
            return true;
        }
        return false;
    }

    isDropdownOpen() {
        return this.isOpen;
    }

    destroy() {
        this.close();
        document.removeEventListener('click', this.handleOutsideClick);
        if (this.dropdown) {
            this.dropdown.removeEventListener('keydown', this.handleKeyDown);
        }
    }
}

function normalize(value) {
    return String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l');
}
