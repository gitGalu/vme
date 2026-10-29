// Blurred backdrop behind the Save/Collection coverflow. background-image can't be transitioned,
// so the backdrop element holds two stacked layers and a new image fades in on the hidden one.
// Zoom (background-size) and parallax (--backdrop-shift) are styled in vme.css; the element
// itself keeps its filter and the launch zoom-out class.

const LAYER_CLASS = 'browser-backdrop-layer';

function getLayers(el) {
    let layers = el.querySelectorAll(`:scope > .${LAYER_CLASS}`);
    if (layers.length !== 2) {
        el.replaceChildren();
        for (let i = 0; i < 2; i++) {
            const layer = document.createElement('div');
            layer.className = LAYER_CLASS;
            el.appendChild(layer);
        }
        layers = el.querySelectorAll(`:scope > .${LAYER_CLASS}`);
    }
    return layers;
}

/** Crossfade to url; no-op if it's already the visible image. */
export function setBackdropImage(el, url) {
    const [a, b] = getLayers(el);
    const front = a.classList.contains('visible') ? a : (b.classList.contains('visible') ? b : null);
    if (front && front.dataset.url === url) return;

    const back = front === a ? b : a;
    // Fast swipes: the reused layer may still be mid fade-out (opaque) - restart it from 0
    // so the new image fades in instead of popping.
    back.style.transition = 'none';
    back.style.opacity = '0';
    void back.offsetWidth;
    back.style.transition = '';
    back.style.opacity = '';
    back.style.backgroundImage = `url("${url}")`;
    back.dataset.url = url;
    back.classList.add('visible');
    front?.classList.remove('visible');
}

export function clearBackdrop(el) {
    el.querySelectorAll(`:scope > .${LAYER_CLASS}`).forEach(layer => {
        layer.classList.remove('visible');
        layer.style.backgroundImage = 'none';
        delete layer.dataset.url;
    });
}
