export const UI_FONT_FAMILY = 'Plus Jakarta Sans';
export const UI_FONT_STACK = '"Plus Jakarta Sans", Avenir, "Avenir Next", "Helvetica Neue", "Segoe UI", Helvetica, Arial, sans-serif';

let ready;

/** Canvas text needs an explicit repaint after the bundled UI font becomes available. */
export function ensureUiFont() {
    ready ??= Promise.all([400, 500, 600, 700].map(weight =>
        document.fonts.load(`${weight} 16px "${UI_FONT_FAMILY}"`, 'VM/E Zażółć 0123456789')))
        .then(faces => faces.every(matches => matches.length > 0), () => false);
    return ready;
}
