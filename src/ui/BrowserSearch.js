import { browserT } from '../i18n/shellStrings.js';
import { EnvironmentManager } from '../EnvironmentManager.js';
import { GamepadKeyboard } from '../gamepad/GamepadKeyboard.js';

const normalize = value => String(value ?? '').toLowerCase().normalize('NFD')
    .replace(/\p{Diacritic}/gu, '').replace(/ł/g, 'l');

/** Browser-local title filter; keeps text editing separate from card navigation. */
export class BrowserSearch {
    #onChange;
    #onFocusChange;
    #onSubmit;
    #getTouchKeyboard;
    #releaseTouchKeyboard = null;
    #entries = [];
    #root;
    #getTitle;
    #available = true;
    #resumeOpen = false;
    #query = '';
    #appliedQuery = '';
    #timer;
    #events;
    #caretObserver;
    #keyboard;
    #padActive = false;
    #padButtons = [];
    #padAxes = [];
    #form;
    #input;
    #mirror;
    #mirrorValue;
    #toggle;
    #keyboardHost;
    #clear;
    #close;
    #count;

    constructor(onChange, onFocusChange, onSubmit, getTouchKeyboard = () => null,
        { rootId = 'collection-browser', prefix = 'collectionBrowser', getTitle = item => item.title } = {}) {
        this.#root = document.getElementById(rootId);
        const element = suffix => document.getElementById(`${prefix}Search${suffix}`);
        this.#form = element('');
        this.#input = element('Input');
        this.#toggle = element('Toggle');
        this.#keyboardHost = element('Keyboard');
        this.#clear = element('Clear');
        this.#close = element('Close');
        this.#count = element('Count');
        this.#mirror = this.#form.querySelector('.browser-search-mirror');
        this.#mirrorValue = this.#mirror.querySelector('.browser-search-mirror-value');
        this.#getTitle = getTitle;
        this.#onChange = onChange;
        this.#onFocusChange = onFocusChange;
        this.#onSubmit = onSubmit;
        this.#getTouchKeyboard = getTouchKeyboard;
    }

    get query() { return this.#query.trim(); }
    get isOpen() { return !this.#form.hidden; }
    get padActive() { return this.#padActive; }
    get #touchMode() { return EnvironmentManager.hasTouch(); }

    get items() {
        const terms = normalize(this.query).split(/\s+/).filter(Boolean);
        return this.#entries.filter(entry => terms.every(term => entry.title.includes(term)))
            .map(entry => entry.item);
    }

    setItems(items) {
        this.#entries = items.map(item => ({ item, title: normalize(this.#getTitle(item)) }));
        this.#appliedQuery = this.query;
        this.#update();
        return this.items;
    }

    bind() {
        this.unbind();
        this.#events = new AbortController();
        const options = { signal: this.#events.signal };
        this.#caretObserver = new ResizeObserver(() => this.#updateCaret());
        this.#caretObserver.observe(this.#input);
        this.#toggle.addEventListener('click', () => {
            if (this.#form.hidden) this.open();
            else this.hide(true);
        }, options);
        this.#close.addEventListener('click', () => this.hide(true), options);
        this.#clear.addEventListener('click', () => {
            this.#setQuery('');
            this.flush();
            this.open();
        }, options);
        this.#input.addEventListener('pointerdown', event => {
            if (!this.#touchMode || this.#padActive) return;
            event.preventDefault();
            this.open();
        }, options);
        this.#input.addEventListener('focus', () => {
            if (this.#touchMode && !this.#padActive) this.open();
            this.#updateEditing();
        }, options);
        this.#input.addEventListener('blur', () => this.#updateEditing(), options);
        this.#input.addEventListener('input', event => {
            if (!event.isComposing) this.#setQuery(this.#input.value);
        }, options);
        this.#input.addEventListener('compositionend', () => this.#setQuery(this.#input.value), options);
        this.#form.addEventListener('submit', event => {
            event.preventDefault();
            this.#submit();
        }, options);
        this.#syncInputMode();
        this.#input.placeholder = browserT('browser.search.placeholder');
        this.#input.setAttribute('aria-label', browserT('browser.search.placeholder'));
        this.#close.setAttribute('aria-label', browserT('browser.search.close'));
        this.#clear.setAttribute('aria-label', browserT('browser.search.clear'));
        this.#clear.title = browserT('browser.search.clear');
        this.#update();
    }

    unbind() {
        this.#stopTouchKeyboard();
        this.#events?.abort();
        this.#caretObserver?.disconnect();
        this.#caretObserver = null;
        clearTimeout(this.#timer);
    }

    /** Hide search within a game's saves while retaining its query and visible state. */
    setAvailable(available) {
        if (this.#available === available) return;
        this.#available = available;
        this.#toggle.hidden = !available;
        if (!available) {
            this.#resumeOpen = this.isOpen;
            this.hide(false);
            this.unbind();
        } else {
            this.bind();
            this.#form.hidden = !this.#resumeOpen;
            this.#root.classList.toggle('search-open', this.#resumeOpen);
            this.#toggle.setAttribute('aria-expanded', String(this.#resumeOpen));
            this.#resumeOpen = false;
            this.#updateEditing();
        }
    }

    reset() {
        this.unbind();
        this.#query = '';
        this.#available = true;
        this.#resumeOpen = false;
        this.#toggle.hidden = false;
        this.#appliedQuery = '';
        this.#input.value = '';
        this.#entries = [];
        this.hide(false);
        this.#keyboard = null;
        this.#keyboardHost.replaceChildren();
        this.#padButtons = [];
        this.#padAxes = [];
        this.#update();
    }

    open(pad = false) {
        if (!this.#available) return;
        if (pad) this.#stopTouchKeyboard();
        this.#form.hidden = false;
        this.#root.classList.add('search-open');
        this.#toggle.setAttribute('aria-expanded', 'true');
        this.#padActive = pad;
        this.#syncInputMode();
        this.#keyboardHost.hidden = !pad;
        if (pad) {
            this.#input.blur();
            this.#keyboard ??= new GamepadKeyboard(this.#keyboardHost, {
                onChar: char => this.#setQuery(this.#query + char),
                onBackspace: () => this.#setQuery(this.#query.slice(0, -1)),
                onSubmit: () => { this.flush(); this.finish(); },
            });
            this.#keyboard.resetFocus();
        } else if (this.#touchMode) {
            this.#input.blur();
            if (!this.#releaseTouchKeyboard) {
                this.#releaseTouchKeyboard = this.#getTouchKeyboard()?.useTextInput(value => this.#handleTouchInput(value), () => {
                    this.#releaseTouchKeyboard = null;
                    this.flush();
                    this.finish();
                }) ?? null;
            }
        } else {
            this.#input.focus({ preventScroll: true });
        }
        this.#updateEditing();
        this.#onFocusChange();
    }

    #updateEditing() {
        const editing = !this.#form.hidden
            && (this.#padActive || !!this.#releaseTouchKeyboard || document.activeElement === this.#input);
        this.#form.classList.toggle('editing', editing);
        this.#form.classList.toggle('custom-caret', editing && this.#input.readOnly);
        this.#updateCaret();
    }

    #updateCaret() {
        this.#mirrorValue.textContent = this.#query;
        // Readonly keyboards append at the end. Keep both the text tail and caret in view.
        this.#mirror.scrollLeft = this.#mirror.scrollWidth;
    }

    #syncInputMode() {
        this.#input.readOnly = this.#padActive || this.#touchMode;
        this.#input.inputMode = this.#touchMode ? 'none' : 'search';
    }

    #stopTouchKeyboard() {
        const release = this.#releaseTouchKeyboard;
        this.#releaseTouchKeyboard = null;
        release?.();
    }

    #handleTouchInput(value) {
        if (value === 'enter') this.#submit();
        else if (value === 'escape' || value === 'esc') this.hide(true);
        else if (value === 'clear') { this.#setQuery(''); this.flush(); }
        else if (value === 'backspace') this.#setQuery(this.#query.slice(0, -1));
        else if (value === 'space') this.#setQuery(this.#query + ' ');
        else if (value?.length === 1) this.#setQuery(this.#query + value);
    }

    #submit() {
        // Filtering is debounced while typing; confirmation must use the newest text.
        this.flush();
        this.finish();
        this.#onSubmit();
    }

    finish() {
        this.#stopTouchKeyboard();
        this.#padActive = false;
        this.#keyboardHost.hidden = true;
        this.#syncInputMode();
        this.#input.blur();
        this.#updateEditing();
        this.#onFocusChange();
    }

    hide(clear) {
        this.#stopTouchKeyboard();
        this.#form.hidden = true;
        this.#root.classList.remove('search-open');
        this.#toggle.setAttribute('aria-expanded', 'false');
        this.#padActive = false;
        this.#keyboardHost.hidden = true;
        this.#syncInputMode();
        this.#input.blur();
        if (clear) { this.#setQuery(''); this.flush(); }
        this.#updateEditing();
        this.#onFocusChange();
    }

    #setQuery(value) {
        this.#query = value;
        this.#input.value = value;
        this.#updateCaret();
        clearTimeout(this.#timer);
        this.#timer = setTimeout(() => this.flush(), 100);
    }

    flush() {
        clearTimeout(this.#timer);
        this.#update();
        if (this.#appliedQuery === this.query) return;
        this.#appliedQuery = this.query;
        this.#onChange(this.items);
    }

    #update() {
        this.#toggle.classList.toggle('active', !!this.query);
        this.#toggle.title = browserT('browser.search.placeholder') + (this.query ? `: ${this.query}` : '');
        this.#toggle.setAttribute('aria-label', this.#toggle.title);
        this.#clear.hidden = !this.query;
        this.#count.textContent = `${this.items.length} / ${this.#entries.length}`;
        this.#updateEditing();
    }

    handleKeyboard(event) {
        if (!this.#available) return false;
        if (event.isComposing || event.keyCode === 229) return true;
        if (event.key === 'Escape' && (!this.#form.hidden || this.query)) {
            event.preventDefault();
            this.hide(true);
            return true;
        }
        if (this.#toggle.contains(event.target) && ['Enter', ' '].includes(event.key)) return true;
        if (this.#form.contains(event.target) || this.#releaseTouchKeyboard) {
            if (event.target.closest?.('button') && this.#form.contains(event.target)) return true;
            if (event.key === 'Enter') {
                event.preventDefault();
                if (!event.repeat) this.#submit();
            } else if (event.key === 'ArrowDown') {
                event.preventDefault();
                this.flush();
                this.finish();
            } else if (this.#touchMode && !event.ctrlKey && !event.metaKey && !event.altKey) {
                if (event.key === 'Backspace') {
                    event.preventDefault();
                    this.#handleTouchInput('backspace');
                } else if (event.key.length === 1) {
                    event.preventDefault();
                    this.#setQuery(this.#query + event.key);
                }
            }
            return true; // Left/Right, Backspace and shortcuts belong to the input
        }
        if (this.#padActive && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Backspace'].includes(event.key)) {
            event.preventDefault();
            if (event.key === 'Enter') this.#keyboard.activate();
            else if (event.key === 'Backspace') this.#keyboard.backspace();
            else this.#keyboard.navigate(event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0,
                event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0);
            return true;
        }
        if (event.target.closest?.('input, textarea, [contenteditable="true"]')) return true;
        if (event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1) return false;
        if (event.key === ' ' && !this.query) return false;
        event.preventDefault();
        this.open();
        if (event.key !== '/') this.#setQuery(this.#query + event.key);
        return true;
    }

    /** Y opens search; D-pad/A type, Y deletes, X/Enter accept, B cancels. */
    handleGamepad(gamepad) {
        if (!this.#available) return false;
        const buttons = gamepad.buttons.map(button => !!button?.pressed);
        const pressed = index => buttons[index] && !this.#padButtons[index];
        const wasActive = this.#padActive;
        if (!wasActive && pressed(3)) this.open(true);
        else if (wasActive) {
            if (pressed(1)) this.hide(true);
            else if (pressed(2)) { this.flush(); this.finish(); }
            else if (pressed(3)) this.#keyboard.backspace();
            else if (pressed(0)) this.#keyboard.activate();
            else {
                const edge = (button, axis, direction) => pressed(button)
                    || (direction * (gamepad.axes[axis] || 0) > 0.5 && direction * (this.#padAxes[axis] || 0) <= 0.5);
                if (edge(12, 1, -1)) this.#keyboard.navigate(-1, 0);
                else if (edge(13, 1, 1)) this.#keyboard.navigate(1, 0);
                else if (edge(14, 0, -1)) this.#keyboard.navigate(0, -1);
                else if (edge(15, 0, 1)) this.#keyboard.navigate(0, 1);
            }
        }
        this.#padButtons = buttons;
        this.#padAxes = [...gamepad.axes];
        return wasActive || this.#padActive;
    }
}
