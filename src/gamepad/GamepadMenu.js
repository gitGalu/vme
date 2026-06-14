/**
 * Gamepad-only menu overlay.
 *
 * Separate layer over the classic CLI menu (#settings). The classic UI stays
 * untouched - this screen just overlays it when the user explicitly presses a
 * gamepad button. Easily reversible experiment (remove file + CSS + hooks).
 *
 * Model: VIEW STACK. Each view = { title, items, focusIndex }. Entering a subscreen
 * (e.g. platform list) = push a new view; B = pop. At the root, B exits to the CLI.
 * navigate/activate/back operate on the view at the top of the stack, so further
 * subscreens (Search etc.) reuse the same mechanism.
 *
 * Item: { id, label, hint?, onActivate? }. hint = small right-aligned text (e.g. the
 * current platform name next to "Platform").
 *
 * FILTERABLE view (Browse): { title, filterable:true, buildItems(filterText)->items }.
 * Has a filter field + on-screen keyboard (X toggles focus list<->grid, Y=backspace).
 */
import { GamepadKeyboard } from './GamepadKeyboard.js';
import { t } from '../i18n/shellStrings.js';

export class GamepadMenu {
    #root = null;
    #inner = null;
    #open = false;
    #onCloseToCli = null;

    #rootViewFactory = null;   // () => view  (built fresh on each open)
    #stack = [];               // [{ title, items, focusIndex }]
    #itemEls = [];             // only the current WINDOW's rows (virtualization)
    #listEl = null;
    #windowStart = 0;
    #staggerNext = false;      // cascading row entrance only when entering a view

    #keyboard = null;          // GamepadKeyboard (lazy, for filterable views)
    #kbdHostEl = null;         // grid container in the header
    #filterEl = null;          // filter text field
    #placeholderEl = null;     // hint shown in an empty filter field

    #onContextChange = null;   // (context) => void; reports context change for the legend bar
    #onFocusChange = null;     // (item, view) => void; reports highlighted-item change (thumbnail)
    #lastFocusKey = null;      // anti-duplicate: don't report the same item repeatedly

    // Virtualization: how many rows in the window at once and the approximate row height
    // (px) for scroll spacers. ROW_PX is an approximation - scroll may be slightly off,
    // but focus is always kept in view via scrollIntoView.
    static WINDOW = 60;
    static ROW_PX = 48;

    constructor() {
        this.#root = document.getElementById('gamepad-menu');
        this.#inner = document.getElementById('gamepad-menu-inner');
    }

    /**
     * @param {Function} onCloseToCli - called when the user exits gamepad mode (B/Esc
     *                                   at the root); should restore the classic UI.
     */
    setCloseHandler(onCloseToCli) {
        this.#onCloseToCli = onCloseToCli;
    }

    /**
     * Callback reporting a context change (for the legend bar).
     * context = { screen: 'menu'|'list'|'keyboard', filterable: boolean }
     */
    setContextHandler(onContextChange) {
        this.#onContextChange = onContextChange;
    }

    /**
     * Callback reporting a change of the highlighted list item (for the thumbnail).
     * Called with (item|null, view). null = none/hide.
     */
    setFocusChangeHandler(onFocusChange) {
        this.#onFocusChange = onFocusChange;
    }

    #emitFocusChange() {
        if (!this.#onFocusChange) return;
        const view = this.#currentView();
        // Thumbnails only for views that request them (e.g. Browse), AND only when
        // focus is on the LIST. With keyboard focus we don't load/show a thumbnail
        // (you're typing - it's not needed, saves bandwidth).
        if (!view || !view.showThumbnails || view.focusMode === 'keyboard') {
            if (this.#lastFocusKey !== null) {
                this.#lastFocusKey = null;
                this.#onFocusChange(null, view);
            }
            return;
        }
        const item = view.items[view.focusIndex] || null;
        const key = item ? item.id : null;
        if (key === this.#lastFocusKey) return;   // same item - don't repeat
        this.#lastFocusKey = key;
        this.#onFocusChange(item, view);
    }

    #emitContext() {
        if (!this.#onContextChange) return;
        const view = this.#currentView();
        if (!view) return;

        let screen;
        if (view.focusMode === 'keyboard') {
            screen = 'keyboard';
        } else if (this.#stack.length === 1) {
            screen = 'menu';      // root = main menu
        } else {
            screen = 'list';      // subscreen (Platform / Browse-list)
        }

        this.#onContextChange({
            screen,
            filterable: !!view.filterable,
            // Secondary X action (e.g. Recent: platform filter) - for the legend bar.
            secondaryLabel: (typeof view.onSecondary === 'function') ? (view.secondaryLabel || 'Filter') : null
        });
    }

    /**
     * Root-view factory. Called on every open() so the content
     * (e.g. the current platform in a hint) stays current.
     * @param {Function} factory - () => { title, items }
     */
    setRootView(factory) {
        this.#rootViewFactory = factory;
    }

    isOpen() {
        return this.#open;
    }

    /** Whether we're at the root (main menu, not a subscreen). */
    isAtRoot() {
        return this.#stack.length <= 1;
    }

    /**
     * Replaces the root view in place, keeping the current focus (no slide animation).
     * Used when the root content changes asynchronously (e.g. platform readiness).
     */
    replaceRoot(rootView) {
        if (this.#stack.length === 0) return;
        const prevFocus = this.#stack[this.#stack.length - 1].focusIndex || 0;
        this.#stack[this.#stack.length - 1] = this.#normalizeView(rootView);
        const v = this.#stack[this.#stack.length - 1];
        // Keep the position, but jump to an enabled one if it landed on a disabled item.
        v.focusIndex = this.#firstEnabledFrom(v.items, Math.min(prevFocus, v.items.length - 1));
        this.#render();
    }

    open() {
        if (this.#open) return;
        this.#open = true;

        this.#stack = [];
        if (this.#rootViewFactory) {
            this.#pushView(this.#rootViewFactory());
        }

        this.#root.classList.add('visible');
        document.body.classList.add('gamepad-shell-open');   // signal for the legend bar (portrait)
        this.#render('push');
    }

    close() {
        if (!this.#open) return;
        this.#open = false;

        this.#root.classList.remove('visible', 'gm-has-filter', 'gm-kbd-active');
        document.body.classList.remove('gamepad-shell-open');
        this.#stack = [];

        // Hide the thumbnail when the menu closes.
        if (this.#onFocusChange && this.#lastFocusKey !== null) {
            this.#lastFocusKey = null;
            this.#onFocusChange(null, null);
        }
    }

    /** Exit to the classic CLI (from the root). */
    requestCloseToCli() {
        this.close();
        if (this.#onCloseToCli) {
            this.#onCloseToCli();
        }
    }

    /** Push a subscreen and re-render. Public so VME can open subscreens. */
    pushView(view) {
        this.#pushView(view);
        this.#render('push');
    }

    /**
     * Confirmation screen (import success/error) handled by the gamepad.
     * A or B closes it and returns to the previous view.
     * @param {{ok:boolean, message:string}} result
     */
    notify({ ok = true, message = '' } = {}) {
        if (!this.#open) return;
        this.pushView({
            title: ok ? t('notice.done') : t('notice.error'),
            message,
            isNotice: ok ? 'ok' : 'error',
            items: [{ id: '_ok', label: t('notice.ok'), onActivate: () => this.back() }]
        });
    }

    /** Collapse the whole stack to a new root (e.g. after a change that alters root hints). */
    popToRoot(rootView) {
        this.#stack = [];
        this.#pushView(rootView);
        this.#render('pop');
    }

    /**
     * Replaces the CURRENT view (top of stack) with a new one, keeping the focus
     * position - to refresh a view after a state change (e.g. Options: toggle hint On/Off)
     * without a push/pop animation. Without a focus argument, keeps the current index.
     */
    replaceTop(view) {
        if (this.#stack.length === 0) return;
        const prevFocus = this.#currentView().focusIndex;
        this.#stack[this.#stack.length - 1] = this.#normalizeView({ ...view, focusIndex: prevFocus });
        this.#render();
    }

    #pushView(view) {
        this.#stack.push(this.#normalizeView(view));
    }

    /** Normalizes a raw view descriptor into full stack state. */
    #normalizeView(view) {
        const filterable = !!view.filterable;
        const items = (filterable && (view.minChars || 0) === 0) ? view.buildItems('') : (view.items || []);
        return {
            title: view.title || '',
            filterable,
            buildItems: view.buildItems || null,
            placeholder: view.placeholder || '',
            showThumbnails: !!view.showThumbnails,
            message: view.message || '',
            isNotice: view.isNotice || null,   // 'ok' | 'error' | null
            // ↵ on the keyboard: the view may take it over (e.g. entered code -> run).
            onSubmit: typeof view.onSubmit === 'function' ? view.onSubmit : null,
            // Minimum filter length threshold (Search): below it -> show emptyHint
            // instead of the list. Browse doesn't set it -> 0 (list shown immediately).
            minChars: view.minChars || 0,
            emptyHint: view.emptyHint || '',
            // Secondary X action (e.g. Recent: platform filter) + its legend label.
            onSecondary: typeof view.onSecondary === 'function' ? view.onSecondary : null,
            secondaryLabel: view.secondaryLabel || '',
            filterText: '',
            // A filterable view starts with focus on the KEYBOARD by default (so you can
            // type right away). A view can override this (initialFocusMode:'list') - e.g.
            // Platform starts on the LIST with focus on the current item.
            focusMode: view.initialFocusMode || (filterable ? 'keyboard' : 'list'),
            items,
            // Initial focus at the given position (e.g. current platform), skipping disabled.
            focusIndex: this.#firstEnabledFrom(items, view.focusIndex || 0)
        };
    }

    #currentView() {
        return this.#stack[this.#stack.length - 1] || null;
    }

    /**
     * navigate(delta) - list (up/down) when focusMode='list'.
     * The second argument (deltaCol) is used only in keyboard mode (2D).
     */
    navigate(delta, deltaCol = 0) {
        const view = this.#currentView();
        if (!view) return;

        if (view.focusMode === 'keyboard' && this.#keyboard) {
            this.#keyboard.navigate(delta, deltaCol);
            return;
        }

        if (view.items.length === 0) return;

        const step = delta >= 0 ? 1 : -1;
        const next = this.#nextEnabledIndex(view, view.focusIndex, step);
        if (next === -1) return;   // no enabled items - don't move focus
        view.focusIndex = next;

        if (view.focusIndex < this.#windowStart || view.focusIndex >= this.#windowStart + GamepadMenu.WINDOW) {
            this.#renderWindow();
        } else {
            this.#updateFocus();
        }
    }

    /** Nearest ENABLED (not-disabled) index in the step direction, wrapping. -1 if none. */
    #nextEnabledIndex(view, from, step) {
        const n = view.items.length;
        if (n === 0) return -1;
        for (let i = 1; i <= n; i++) {
            const idx = ((from + step * i) % n + n) % n;
            if (!view.items[idx].disabled) return idx;
        }
        return -1;   // all disabled
    }

    /** First ENABLED index from 'from' going up the list (or 'from' itself, if enabled). */
    #firstEnabledFrom(items, from) {
        if (!items.length) return 0;
        const start = Math.max(0, Math.min(from, items.length - 1));
        if (!items[start].disabled) return start;
        for (let i = start + 1; i < items.length; i++) {
            if (!items[i].disabled) return i;
        }
        for (let i = start - 1; i >= 0; i--) {
            if (!items[i].disabled) return i;
        }
        return start;   // all disabled - leave as is
    }

    activate() {
        const view = this.#currentView();
        if (!view) return;

        if (view.focusMode === 'keyboard' && this.#keyboard) {
            this.#keyboard.activate();
            return;
        }

        const item = view.items[view.focusIndex];
        if (item && !item.disabled && typeof item.onActivate === 'function') {
            item.onActivate();
        }
    }

    /**
     * B: in keyboard mode returns to the list; in a subscreen goes back one level.
     * At the ROOT (main menu) it does nothing - gamepad mode is a closed world,
     * we don't go back to the classic CLI with the pad (see UX decision).
     */
    back() {
        const view = this.#currentView();
        if (view && view.focusMode === 'keyboard') {
            this.#setFocusMode('list');
            return;
        }

        if (this.#stack.length > 1) {
            this.#stack.pop();
            this.#render('pop');
        }
        // root: no action
    }

    /** X: in a filterable view toggles focus list <-> keyboard; in other views
     *  triggers the view's optional secondary action (e.g. Recent: pick filter platform). */
    toggleFilter() {
        const view = this.#currentView();
        if (!view) return;
        if (view.filterable) {
            this.#setFocusMode(view.focusMode === 'keyboard' ? 'list' : 'keyboard');
        } else if (typeof view.onSecondary === 'function') {
            view.onSecondary();
        }
    }

    /** Y: filter backspace (works when the keyboard is active). */
    backspaceExternal() {
        const view = this.#currentView();
        if (view && view.focusMode === 'keyboard' && this.#keyboard) {
            this.#keyboard.backspace();
        }
    }

    #setFocusMode(mode) {
        const view = this.#currentView();
        if (!view || !view.filterable) return;
        view.focusMode = mode;
        this.#root.classList.toggle('gm-kbd-active', mode === 'keyboard');
        if (mode === 'keyboard' && this.#keyboard) {
            this.#keyboard.resetFocus();
        }
        this.#updateFocus();
        this.#emitContext();
    }

    #applyFilterChar(ch) {
        const view = this.#currentView();
        if (!view || !view.filterable) return;
        view.filterText += ch;
        this.#rebuildFilteredItems();
    }

    #applyBackspace() {
        const view = this.#currentView();
        if (!view || !view.filterable) return;
        view.filterText = view.filterText.slice(0, -1);
        this.#rebuildFilteredItems();
    }

    #rebuildFilteredItems() {
        const view = this.#currentView();
        if (!view || !view.buildItems) return;
        // Below the minChars threshold (Search) - don't build the list; render shows emptyHint.
        const belowMin = view.filterText.trim().length < view.minChars;
        view.items = belowMin ? [] : view.buildItems(view.filterText);
        view.focusIndex = 0;
        this.#windowStart = 0;
        if (this.#filterEl) {
            this.#filterEl.textContent = view.filterText;
        }
        this.#updatePlaceholder(view.filterText);
        this.#renderWindow();
    }

    /** Whether the view is below the minChars threshold (shows a hint instead of the list). */
    #belowMinChars(view) {
        return view.minChars > 0 && view.filterText.trim().length < view.minChars;
    }

    #updatePlaceholder(filterText) {
        if (this.#placeholderEl) {
            this.#placeholderEl.classList.toggle('visible', filterText.length === 0);
        }
    }

    #render(direction = null) {
        const view = this.#currentView();
        this.#inner.innerHTML = '';
        this.#itemEls = [];
        this.#listEl = null;
        this.#keyboard = null;
        this.#kbdHostEl = null;
        this.#filterEl = null;
        this.#placeholderEl = null;
        this.#windowStart = 0;
        this.#root.classList.remove('gm-kbd-active');
        if (!view) return;

        // A filterable view has a different layout (keyboard + list at once, the list
        // scrolls internally). A normal menu scrolls as a whole. A class on #root disables
        // vertical centering so inner fills the full height.
        this.#inner.classList.toggle('gm-filterable', !!view.filterable);
        this.#root.classList.toggle('gm-has-filter', !!view.filterable);

        // A single horizontal breadcrumb bar (left-aligned):
        //   VM/E › <section> [› <filter field / hint>]
        // The filter (when the view is filterable) is another segment in the same row.
        const topbar = this.#buildTopbar(view);
        this.#inner.appendChild(topbar);

        // Confirmation/error screen - prominent message above the list (OK button).
        if (view.message) {
            const msg = document.createElement('div');
            msg.className = 'gm-notice';
            if (view.isNotice) msg.classList.add(`gm-notice-${view.isNotice}`);
            msg.textContent = view.message;
            this.#inner.appendChild(msg);
        }

        const list = document.createElement('div');
        list.className = 'gm-list';
        this.#listEl = list;
        this.#inner.appendChild(list);

        if (view.filterable) {
            this.#buildFilterUi(view, topbar);
        }

        // Thumbnail as an absolute element on #root (outside inner - innerHTML='' doesn't
        // destroy it). A class controls visibility per view.
        this.#root.classList.toggle('gm-show-thumb', !!(view.filterable && view.showThumbnails));

        // Class 'gm-kbd-active' = the keyboard region has focus (controls highlighting
        // AND the thumbnail layer: above the keyboard on the list, below it on the keyboard).
        this.#root.classList.toggle('gm-kbd-active', view.focusMode === 'keyboard');

        // Stagger rows only when ENTERING a view (direction != null), not when
        // filtering/scrolling (those go through #renderWindow directly).
        this.#staggerNext = !!direction;
        this.#renderWindow();
        this.#staggerNext = false;
        this.#emitContext();

        // Directional view-transition animation: push = slide in from the right, pop = from the left.
        this.#playTransition(direction);
    }

    #playTransition(direction) {
        if (!direction) return;
        const cls = direction === 'pop' ? 'gm-view-pop' : 'gm-view-push';
        this.#inner.classList.remove('gm-view-push', 'gm-view-pop');
        void this.#inner.offsetWidth;   // reflow - restart animation
        this.#inner.classList.add(cls);
    }

    #buildTopbar(view) {
        const topbar = document.createElement('div');
        topbar.className = 'gm-topbar';

        // App name (breadcrumb root): 'VM/E Shell (beta)' in the main menu,
        // shortened ('VM/E') on subscreens (so the breadcrumb isn't too long).
        const isRoot = this.#stack.length <= 1;
        const app = document.createElement('span');
        app.className = 'gm-crumb gm-crumb-app';
        app.textContent = isRoot ? 'VM/E Shell (beta)' : 'VM/E';
        topbar.appendChild(app);

        // Section only on a subscreen (at the root the app name alone is enough).
        if (!isRoot && view.title) {
            topbar.appendChild(this.#makeSeparator());
            const section = document.createElement('span');
            section.className = 'gm-crumb gm-crumb-section';
            section.textContent = view.title;
            topbar.appendChild(section);
        }

        return topbar;
    }

    #makeSeparator() {
        const sep = document.createElement('span');
        sep.className = 'gm-crumb-sep';
        sep.textContent = '›';
        return sep;
    }

    /**
     * Writes the label into the row, highlighting the matched fragment (lighter span).
     * item.matchStart / item.matchLen are set by the view's buildItems (it knows the filter).
     * Browse -> match at the start, Search -> in the middle => the different highlight SHAPE
     * naturally distinguishes the two views. Uses text nodes (no innerHTML - safe).
     */
    #fillLabel(el, item) {
        const { label, matchStart, matchLen } = item;
        if (typeof matchStart !== 'number' || !matchLen || matchStart < 0) {
            el.textContent = label;
            return;
        }
        const before = label.slice(0, matchStart);
        const match = label.slice(matchStart, matchStart + matchLen);
        const after = label.slice(matchStart + matchLen);

        if (before) el.appendChild(document.createTextNode(before));
        const hl = document.createElement('span');
        hl.className = 'gm-hl';
        hl.textContent = match;
        el.appendChild(hl);
        if (after) el.appendChild(document.createTextNode(after));
    }

    #buildFilterUi(view, topbar) {
        // Filter field as another breadcrumb segment: '› <text|hint>'.
        topbar.appendChild(this.#makeSeparator());

        const filterRow = document.createElement('div');
        filterRow.className = 'gm-filter';

        const filterText = document.createElement('span');
        filterText.className = 'gm-filter-text';
        filterText.textContent = view.filterText;

        // Caret = a vertical bar (CSS), not a '_' char. Empty element styled in CSS.
        const caret = document.createElement('span');
        caret.className = 'gm-filter-caret';

        // Placeholder visible only when the filter is empty (e.g. "Type to filter...").
        const placeholder = document.createElement('span');
        placeholder.className = 'gm-filter-placeholder';
        placeholder.textContent = view.placeholder || 'Start typing to filter';

        filterRow.appendChild(filterText);
        filterRow.appendChild(caret);
        filterRow.appendChild(placeholder);
        topbar.appendChild(filterRow);
        this.#filterEl = filterText;
        this.#placeholderEl = placeholder;
        this.#updatePlaceholder(view.filterText);

        // Keyboard host - a grid cell (bottom-right). The thumbnail is absolute, outside the grid.
        const kbdHost = document.createElement('div');
        kbdHost.className = 'gm-kbd-host';
        this.#inner.appendChild(kbdHost);
        this.#kbdHostEl = kbdHost;

        this.#keyboard = new GamepadKeyboard(kbdHost, {
            onChar: (ch) => this.#applyFilterChar(ch),
            onBackspace: () => this.#applyBackspace(),
            onSubmit: () => {
                // The view may take over ↵ (e.g. entered code -> run); by default -> list.
                const view = this.#currentView();
                if (view && typeof view.onSubmit === 'function') {
                    view.onSubmit(view.filterText);
                } else {
                    this.#setFocusMode('list');
                }
            }
        });
    }

    /**
     * Virtualization: renders only a WINDOW of rows around the focus. Lists can have
     * >100k items (e.g. C64 ~134k) - rendering them all at once freezes the tab.
     * Top/bottom spacers preserve the approximate scroll position.
     */
    #renderWindow() {
        const view = this.#currentView();
        if (!view || !this.#listEl) return;

        // Below the threshold (Search with few chars): a centered prompt instead of the list.
        if (this.#belowMinChars(view)) {
            this.#listEl.innerHTML = '';
            this.#itemEls = [];
            const hint = document.createElement('div');
            hint.className = 'gm-empty-hint';
            hint.textContent = view.emptyHint || `Type at least ${view.minChars} letters to search.`;
            this.#listEl.appendChild(hint);
            return;
        }

        const total = view.items.length;

        // Empty list (e.g. Recent with no history) -> a centered prompt instead of blankness.
        if (total === 0 && view.emptyHint) {
            this.#listEl.innerHTML = '';
            this.#itemEls = [];
            const hint = document.createElement('div');
            hint.className = 'gm-empty-hint';
            hint.textContent = view.emptyHint;
            this.#listEl.appendChild(hint);
            return;
        }

        const WINDOW = GamepadMenu.WINDOW;

        // Center the window around the focus, staying within [0, total).
        let start = view.focusIndex - Math.floor(WINDOW / 2);
        start = Math.max(0, Math.min(start, Math.max(0, total - WINDOW)));
        this.#windowStart = start;
        const end = Math.min(total, start + WINDOW);

        this.#listEl.innerHTML = '';
        this.#itemEls = [];

        // Top spacer: approximate height of the un-rendered rows above the window.
        const topSpacer = document.createElement('div');
        topSpacer.className = 'gm-spacer';
        topSpacer.style.height = `${start * GamepadMenu.ROW_PX}px`;
        this.#listEl.appendChild(topSpacer);

        for (let i = start; i < end; i++) {
            const item = view.items[i];
            const row = document.createElement('div');
            row.className = 'gm-item';
            if (item.disabled) row.classList.add('gm-item-disabled');
            // Cascading entrance (only when entering a view). The delay grows with the
            // position in the window, capped - on a long list we don't wait forever.
            if (this.#staggerNext) {
                row.classList.add('gm-stagger');
                const delay = Math.min((i - start) * 22, 260);
                row.style.animationDelay = `${delay}ms`;
            }
            row.dataset.id = item.id;
            row.dataset.index = String(i);

            const label = document.createElement('span');
            label.className = 'gm-item-label';
            this.#fillLabel(label, item);
            row.appendChild(label);

            if (item.hint) {
                const hint = document.createElement('span');
                hint.className = 'gm-item-hint';
                hint.textContent = item.hint;
                row.appendChild(hint);
            }

            this.#listEl.appendChild(row);
            this.#itemEls.push(row);
        }

        // Bottom spacer.
        const bottomSpacer = document.createElement('div');
        bottomSpacer.className = 'gm-spacer';
        bottomSpacer.style.height = `${(total - end) * GamepadMenu.ROW_PX}px`;
        this.#listEl.appendChild(bottomSpacer);

        this.#updateFocus();
    }

    #updateFocus() {
        const view = this.#currentView();
        if (!view) return;

        // Map the global focusIndex to a row in the window.
        const localIndex = view.focusIndex - this.#windowStart;

        this.#itemEls.forEach((el, i) => {
            el.classList.toggle('focused', i === localIndex);
        });

        const focused = this.#itemEls[localIndex];
        if (focused) {
            focused.scrollIntoView({ block: 'nearest' });
        }

        this.#emitFocusChange();
    }
}
