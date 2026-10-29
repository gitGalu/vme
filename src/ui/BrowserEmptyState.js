// Empty / error state of the Save and Collection browsers: icon, title and an optional hint.

const ICON = '<svg class="browser-empty-icon" viewBox="0 0 48 48" aria-hidden="true">'
    + '<path d="M12 16V9a3 3 0 0 1 3-3h24a3 3 0 0 1 3 3v18a3 3 0 0 1-3 3h-3" />'
    + '<rect x="6" y="16" width="30" height="24" rx="3" />'
    + '</svg>';

export function showBrowserEmpty(el, title, hint = null) {
    if (!el) return;
    el.innerHTML = ICON;
    const titleEl = document.createElement('div');
    titleEl.className = 'browser-empty-title';
    titleEl.textContent = title;
    el.appendChild(titleEl);
    if (hint) {
        const hintEl = document.createElement('div');
        hintEl.className = 'browser-empty-hint';
        hintEl.textContent = hint;
        el.appendChild(hintEl);
    }
    el.style.display = 'block';
}
