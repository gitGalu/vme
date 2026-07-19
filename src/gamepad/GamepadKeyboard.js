/**
 * On-screen keyboard for the gamepad - a letter grid (smart-TV style).
 *
 * Reusable component: D-pad navigates the grid in 2D, A selects a key.
 * Fires callbacks (onChar / onBackspace / onClose) - it knows nothing about filter logic.
 * Renders into the given container. Backspace is also available externally
 * (the Y button is handled by VME/GamepadManager via backspace()).
 *
 * Special grid keys: '⌫' (backspace), '␣' (space), '↵' (submit -> list).
 */
export class GamepadKeyboard {
    // Even 6-column rectangle (readable, predictable "down" navigation):
    // A-Z + 0-9 fill 6 full rows, the last row = action keys.
    static ROWS = [
        ['A', 'B', 'C', 'D', 'E', 'F'],
        ['G', 'H', 'I', 'J', 'K', 'L'],
        ['M', 'N', 'O', 'P', 'Q', 'R'],
        ['S', 'T', 'U', 'V', 'W', 'X'],
        ['Y', 'Z', '0', '1', '2', '3'],
        ['4', '5', '6', '7', '8', '9'],
        ['␣', '⌫', '↵']
    ];

    #container = null;
    #gridEl = null;
    #highlightEl = null;
    #snapHighlight = false;
    #row = 0;
    #col = 0;
    #keyEls = [];        // keyEls[row][col]
    #onChar = null;
    #onBackspace = null;
    #onSubmit = null;
    #onFocusMove = null;

    /**
     * @param {HTMLElement} container - where to render the grid.
     * @param {{onChar:Function, onBackspace:Function, onSubmit:Function,
     *          onFocusMove?:Function}} handlers - onFocusMove fires on every key-focus
     *        change (the VR shell repaints its canvas copy of the keyboard from it).
     */
    constructor(container, { onChar, onBackspace, onSubmit, onFocusMove } = {}) {
        this.#container = container;
        this.#onChar = onChar;
        this.#onBackspace = onBackspace;
        this.#onSubmit = onSubmit;
        this.#onFocusMove = onFocusMove;
        this.#render();
    }

    /** Current key focus (for the VR shell painter). */
    getFocus() {
        return { row: this.#row, col: this.#col };
    }

    #render() {
        this.#container.innerHTML = '';
        this.#keyEls = [];

        const grid = document.createElement('div');
        grid.className = 'gm-kbd';
        this.#gridEl = grid;

        // Moving highlight - a single element that slides to the active key
        // (GPU transform, springy CSS curve). Smooth "flow" of focus.
        this.#highlightEl = document.createElement('div');
        this.#highlightEl.className = 'gm-kbd-highlight';
        grid.appendChild(this.#highlightEl);

        GamepadKeyboard.ROWS.forEach((row, r) => {
            const rowEl = document.createElement('div');
            rowEl.className = 'gm-kbd-row';
            const rowEls = [];

            row.forEach((key, c) => {
                const keyEl = document.createElement('div');
                keyEl.className = 'gm-kbd-key';
                keyEl.textContent = key;
                if (key === '␣') keyEl.classList.add('gm-kbd-wide');
                if (key === '⌫') keyEl.classList.add('gm-kbd-wide');
                if (key === '↵') keyEl.classList.add('gm-kbd-wide');
                rowEl.appendChild(keyEl);
                rowEls.push(keyEl);
            });

            grid.appendChild(rowEl);
            this.#keyEls.push(rowEls);
        });

        this.#container.appendChild(grid);
        // First placement without animation (highlight appears in place, doesn't slide in).
        this.#snapHighlight = true;
        this.#updateFocus();
    }

    /** Resets focus to the first key (e.g. when reopened). */
    resetFocus() {
        this.#row = 0;
        this.#col = 0;
        this.#snapHighlight = true;   // place highlight without sliding from the previous position
        this.#updateFocus();
    }

    navigate(deltaRow, deltaCol) {
        const rows = GamepadKeyboard.ROWS;

        if (deltaRow !== 0) {
            this.#row = (this.#row + deltaRow + rows.length) % rows.length;
            // Keep the column within the new row's range (rows have different lengths).
            const maxCol = rows[this.#row].length - 1;
            if (this.#col > maxCol) this.#col = maxCol;
        }

        if (deltaCol !== 0) {
            const len = rows[this.#row].length;
            this.#col = (this.#col + deltaCol + len) % len;
        }

        this.#updateFocus();
    }

    /** A on the current key. */
    activate() {
        const key = GamepadKeyboard.ROWS[this.#row][this.#col];
        this.#pulseKey();
        if (key === '⌫') {
            this.#onBackspace?.();
        } else if (key === '␣') {
            this.#onChar?.(' ');
        } else if (key === '↵') {
            this.#onSubmit?.();
        } else {
            this.#onChar?.(key);
        }
    }

    /** Backspace triggered externally (e.g. the Y button). */
    backspace() {
        this.#onBackspace?.();
    }

    #updateFocus() {
        this.#keyEls.forEach((rowEls, r) => {
            rowEls.forEach((el, c) => {
                el.classList.toggle('focused', r === this.#row && c === this.#col);
            });
        });
        this.#moveHighlight();
        this.#onFocusMove?.();
    }

    #moveHighlight() {
        const key = this.#keyEls[this.#row]?.[this.#col];
        if (!key || !this.#highlightEl || !this.#gridEl) return;

        // Key position relative to the grid (offset* are immune to scroll/transform).
        const x = key.offsetLeft;
        const y = key.offsetTop;
        const w = key.offsetWidth;
        const h = key.offsetHeight;

        if (this.#snapHighlight) {
            // No animation for this single move (e.g. first appearance).
            this.#highlightEl.classList.add('no-transition');
            this.#snapHighlight = false;
            requestAnimationFrame(() => this.#highlightEl?.classList.remove('no-transition'));
        }

        this.#highlightEl.style.width = `${w}px`;
        this.#highlightEl.style.height = `${h}px`;
        this.#highlightEl.style.transform = `translate(${x}px, ${y}px)`;
        this.#highlightEl.classList.add('visible');
    }

    /** Short "pulse" of the active key - feedback that a character was typed. */
    #pulseKey() {
        const key = this.#keyEls[this.#row]?.[this.#col];
        if (!key) return;
        key.classList.remove('gm-kbd-pulse');
        // reflow, to restart the animation when quickly typing the same key
        void key.offsetWidth;
        key.classList.add('gm-kbd-pulse');
    }
}
