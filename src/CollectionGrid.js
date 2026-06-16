import { SelectedPlatforms } from './platforms/PlatformManager.js';

/**
 * Uniform grid view of collection thumbnails — an alternative to the Flicking coverflow,
 * built for the gamepad shell (TV + D-pad) and designed to also drive desktop later.
 *
 * The component owns ALL 2D layout, focus and virtualization. Input is supplied via thin
 * adapters that call its input-agnostic API (focusNext/focusPrev/focusRow/activate). For the
 * gamepad it ALSO exposes a small "flicking-like" facade (currentPanel/next/prev/animating/
 * on/off/verticalNav/isGrid) so GamepadManager.initBrowserNavigation can drive it with almost
 * no change.
 *
 * Virtualization: only the visible rows (+ buffer) are rendered as cells; top/bottom spacer
 * divs preserve total scroll height. Essential for large collections (C64 ~134k items).
 */
export class CollectionGrid {
    // Layout: exactly #cols columns filling the full width (no side padding). Cell width =
    // (contentW - gaps) / cols, height from the 4:3 screenshot aspect. Rows are NOT height-capped,
    // so the bottom visible row may be clipped (by design).
    #cols = 3;             // fixed column count
    #cellAspect = 4 / 3;   // width / height (4:3 screenshots)
    #cellHeight = 200;     // computed in #computeLayout()
    #cellWidth = 266;      // computed in #computeLayout()
    #rowGap = 8;
    #colGap = 8;
    #bufferRows = 1;       // extra rows rendered above/below the viewport

    #root;                 // #collection-grid
    #cellsEl;              // .collection-grid-cells (CSS grid)
    #spacerTop;
    #spacerBottom;

    #items = [];
    #onActivate = null;    // (index) => void, supplied by the owner (CollectionBrowser)

    #focusedIndex = 0;
    #scrollHandler = null;
    #resizeObserver = null;
    #changeListeners = new Set();
    #renderedRange = { start: -1, end: -1 };
    #stepLock = false;     // one nav step per animation frame (see #stepLocked)

    /** flicking-like facade flag (read by GamepadManager). */
    isGrid = true;
    /** flicking-like facade: never animating (focus moves are instant). */
    animating = false;

    /**
     * @param {object} opts
     * @param {Array}  opts.items      collection items (as from getCollectionItems, with .image / .save_data_id)
     * @param {(index:number)=>void} opts.onActivate launch the item at index (owner reuses its load logic)
     */
    constructor({ items, onActivate }) {
        this.#items = items || [];
        this.#onActivate = onActivate;

        this.#root = document.getElementById('collection-grid');
        this.#cellsEl = this.#root.querySelector('.collection-grid-cells');
        this.#spacerTop = this.#root.querySelector('.collection-grid-spacer-top');
        this.#spacerBottom = this.#root.querySelector('.collection-grid-spacer-bottom');
    }

    /** Show the grid, compute layout, render the initial window and focus an item. */
    open(initialIndex = 0) {
        this.#root.style.display = 'block';
        this.#focusedIndex = this.#clampIndex(initialIndex);

        this.#computeLayout();
        this.#render(true);
        this.scrollFocusedIntoView(true);
        this.#updateScrollFades();

        this.#scrollHandler = () => { this.#render(false); this.#updateScrollFades(); };
        this.#root.addEventListener('scroll', this.#scrollHandler, { passive: true });

        if (typeof ResizeObserver !== 'undefined') {
            this.#resizeObserver = new ResizeObserver(() => {
                const beforeCols = this.#cols;
                const beforeH = this.#cellHeight;
                this.#computeLayout();
                if (this.#cols !== beforeCols || this.#cellHeight !== beforeH) {
                    this.#renderedRange = { start: -1, end: -1 };
                    this.#render(true);
                    this.scrollFocusedIntoView(true);
                }
            });
            this.#resizeObserver.observe(this.#root);
        }
    }

    destroy() {
        if (this.#scrollHandler) {
            this.#root.removeEventListener('scroll', this.#scrollHandler);
            this.#scrollHandler = null;
        }
        if (this.#resizeObserver) {
            this.#resizeObserver.disconnect();
            this.#resizeObserver = null;
        }
        this.#cellsEl.innerHTML = '';
        this.#spacerTop.style.height = '0px';
        this.#spacerBottom.style.height = '0px';
        this.#root.style.display = 'none';
        this.#root.classList.remove('can-scroll-up', 'can-scroll-down');
        this.#changeListeners.clear();
        this.#renderedRange = { start: -1, end: -1 };
    }

    // --- input-agnostic navigation API ---------------------------------------

    focusNext() { this.#setFocus(this.#focusedIndex + 1); }
    focusPrev() { this.#setFocus(this.#focusedIndex - 1); }

    /** Move by whole rows (delta = ±1). Clamps within bounds. */
    focusRow(delta) { this.#setFocus(this.#focusedIndex + delta * this.#cols); }

    getFocusedItem() { return this.#items[this.#focusedIndex]; }
    getFocusedIndex() { return this.#focusedIndex; }

    activate() { this.#onActivate?.(this.#focusedIndex); }

    // --- flicking-like facade (consumed by GamepadManager) -------------------

    /** Mimics Flicking.currentPanel: { index, element } of the focused cell (element used for .active). */
    get currentPanel() {
        const element = this.#cellsEl.querySelector(`.collection-grid-cell[data-index="${this.#focusedIndex}"]`);
        return { index: this.#focusedIndex, element: element || this.#cellsEl };
    }

    next() { if (this.#stepLocked()) return Promise.resolve(); this.focusNext(); return Promise.resolve(); }
    prev() { if (this.#stepLocked()) return Promise.resolve(); this.focusPrev(); return Promise.resolve(); }

    /** D-pad up/down hook (delta = ∓1 mapped by the caller to focusRow). */
    verticalNav(delta) { if (this.#stepLocked()) return; this.focusRow(delta); }

    /**
     * One-step-per-frame lock for poll-driven navigation. Cheap safety net: if the gamepad poll
     * ever calls next()/prev()/verticalNav() more than once in a single frame (coverflow is immune
     * because Flicking's `animating` gate swallows repeats; the grid has no animation), focus still
     * moves by one. NOTE: a real pad does NOT trigger this — a double-step was only ever observed
     * with a SIMULATED pad (DevTools snippet patching navigator.getGamepads, colliding with
     * gamepad_filter). Kept as a guard, not a fix for a real bug.
     */
    #stepLocked() {
        if (this.#stepLock) return true;
        this.#stepLock = true;
        requestAnimationFrame(() => { this.#stepLock = false; });
        return false;
    }

    on(event, cb) { if (event === 'changed') this.#changeListeners.add(cb); }
    off(event, cb) { if (event === 'changed') this.#changeListeners.delete(cb); }

    // --- internals -----------------------------------------------------------

    #clampIndex(i) {
        if (this.#items.length === 0) return 0;
        return Math.max(0, Math.min(i, this.#items.length - 1));
    }

    #setFocus(index) {
        const next = this.#clampIndex(index);
        if (next === this.#focusedIndex) return;
        this.#focusedIndex = next;
        this.#render(false);
        this.scrollFocusedIntoView(false);
        this.#changeListeners.forEach(cb => { try { cb(); } catch (_) {} });
    }

    /** Cell height from viewport (3 rows fit), width from 4:3 aspect, columns from width. */
    #computeLayout() {
        const cs = getComputedStyle(this.#root);
        const padLeft = parseFloat(cs.paddingLeft) || 0;
        const padRight = parseFloat(cs.paddingRight) || 0;

        // Full content width split into #cols columns with (#cols - 1) gaps; no side padding.
        const contentW = (this.#root.clientWidth || 800) - padLeft - padRight;
        this.#cellWidth = Math.max(40,
            (contentW - (this.#cols - 1) * this.#colGap) / this.#cols);
        // Height from the 4:3 aspect. Rows are not capped to the viewport — the bottom row may be
        // clipped (by design); the user scrolls down with the focus.
        this.#cellHeight = this.#cellWidth / this.#cellAspect;

        this.#cellsEl.style.setProperty('--cols', this.#cols);
        this.#cellsEl.style.setProperty('--cell-h', `${this.#cellHeight}px`);
    }

    #rowHeight() { return this.#cellHeight + this.#rowGap; }

    /** Render only the rows in (or near) the viewport; spacers preserve total height. */
    #render(force) {
        const total = this.#items.length;
        const totalRows = Math.ceil(total / this.#cols);
        const rowH = this.#rowHeight();

        const scrollTop = this.#root.scrollTop;
        const viewH = this.#root.clientHeight || rowH;

        let firstRow = Math.floor(scrollTop / rowH) - this.#bufferRows;
        let lastRow = Math.ceil((scrollTop + viewH) / rowH) + this.#bufferRows;

        // Always include the focused row even if scrollTop hasn't caught up yet (smooth scroll is
        // async) — guarantees currentPanel.element exists for the launch path.
        const focusRow = Math.floor(this.#focusedIndex / this.#cols);
        firstRow = Math.min(firstRow, focusRow - this.#bufferRows);
        lastRow = Math.max(lastRow, focusRow + 1 + this.#bufferRows);

        firstRow = Math.max(0, firstRow);
        lastRow = Math.min(totalRows, lastRow);

        const start = firstRow * this.#cols;
        const end = Math.min(total, lastRow * this.#cols);

        if (!force && start === this.#renderedRange.start && end === this.#renderedRange.end) {
            // Range unchanged — only refresh which cell is focused.
            this.#updateFocusClass();
            return;
        }
        this.#renderedRange = { start, end };

        this.#spacerTop.style.height = `${firstRow * rowH}px`;
        this.#spacerBottom.style.height = `${Math.max(0, (totalRows - lastRow) * rowH)}px`;

        let html = '';
        for (let i = start; i < end; i++) {
            html += this.#cellHTML(this.#items[i], i);
        }
        this.#cellsEl.innerHTML = html;

        this.#cellsEl.querySelectorAll('.collection-grid-cell').forEach(cell => {
            cell.addEventListener('click', () => {
                const idx = parseInt(cell.dataset.index, 10);
                if (idx === this.#focusedIndex) {
                    this.activate();
                } else {
                    this.#setFocus(idx);
                }
            });
        });

        this.#updateFocusClass();
    }

    #updateFocusClass() {
        this.#cellsEl.querySelectorAll('.collection-grid-cell.focused')
            .forEach(c => c.classList.remove('focused', 'active'));
        const el = this.#cellsEl.querySelector(`.collection-grid-cell[data-index="${this.#focusedIndex}"]`);
        if (el) el.classList.add('focused', 'active');
    }

    #cellHTML(item, index) {
        if (item.platform_id == 'md') item.platform_id = 'smd'; // temp fix (matches CollectionBrowser)
        const platform = Object.values(SelectedPlatforms).find(p => p.platform_id === item.platform_id);
        const platformName = platform ? platform.platform_name : '';
        const hasSave = item.save_data_id !== undefined && item.save_data_id !== 'undefined';
        const img = item.image || '';
        // Text via textContent would be safer, but innerHTML here mirrors CollectionBrowser's
        // existing pattern; titles come from the local collection DB, not remote input.
        // Cell IS the thumbnail (4:3). The label is an overlay on the bottom of the cover, shown
        // only when the cell is focused (CSS) — so unfocused covers stay clean and large.
        return `
        <div class="collection-grid-cell" data-index="${index}" data-id="${item.id}" data-save="${hasSave ? item.save_data_id : 'undefined'}">
            <img class="collection-grid-img" src="${img}" alt="${item.title}" loading="lazy">
            ${hasSave ? '<span class="collection-grid-save-badge"></span>' : ''}
            <div class="collection-grid-label">
                <span class="collection-grid-title">${item.title}</span>
                <span class="collection-grid-platform">${platformName}</span>
            </div>
        </div>`;
    }

    /**
     * Keep the focused row vertically CENTERED on the full viewport. scrollTo clamps to
     * [0, maxScroll], so the very first rows naturally sit at the top and the last rows at the
     * bottom (they can't be centered) — exactly the desired edge behavior.
     */
    scrollFocusedIntoView(instant) {
        const rowH = this.#rowHeight();
        const row = Math.floor(this.#focusedIndex / this.#cols);

        // Cells live inside the padding box, so a cell at grid-offset cellCenter sits at viewport
        // position (padTop + cellCenter - scrollTop). Center it on the FULL viewport height:
        //   padTop + cellCenter - scrollTop = clientHeight / 2
        const padTop = parseFloat(getComputedStyle(this.#root).paddingTop) || 0;
        const viewportH = this.#root.clientHeight || rowH;

        const cellCenter = row * rowH + this.#cellHeight / 2;        // within the cells grid
        const target = cellCenter + padTop - viewportH / 2;         // scrollTop that centers it

        const maxScroll = Math.max(0, this.#root.scrollHeight - this.#root.clientHeight);
        const clamped = Math.max(0, Math.min(target, maxScroll));

        if (Math.abs(clamped - this.#root.scrollTop) < 1) { this.#updateScrollFades(); return; }
        this.#root.scrollTo({ top: clamped, behavior: instant ? 'auto' : 'smooth' });
        this.#updateScrollFades();
    }

    /**
     * Edge scroll-fade hints: a soft shadow at the top when content is scrolled past the top, and
     * at the bottom when there is more below. Both vanish at the very ends (skrajne wiersze).
     * Toggled via classes on the root; the fade overlays themselves are fixed (CSS).
     */
    #updateScrollFades() {
        const top = this.#root.scrollTop;
        const max = this.#root.scrollHeight - this.#root.clientHeight;
        const EPS = 2;
        this.#root.classList.toggle('can-scroll-up', top > EPS);
        this.#root.classList.toggle('can-scroll-down', top < max - EPS);
    }
}
