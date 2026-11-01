export const BASELINE = 'Avenir';
export const FONT_GROUPS = [
    { label: 'Punkt odniesienia', families: [BASELINE] },
    { label: 'Interfejsy i tekst', families: [
        'Inter', 'Roboto', 'Roboto Flex', 'Noto Sans', 'Open Sans', 'Source Sans 3',
        'IBM Plex Sans', 'Public Sans', 'Work Sans', 'Fira Sans', 'Ubuntu Sans',
        'Instrument Sans', 'Geist', 'Libre Franklin', 'Archivo',
    ] },
    { label: 'Geometryczne', families: [
        'Manrope', 'DM Sans', 'Plus Jakarta Sans', 'Outfit', 'Montserrat', 'Poppins',
        'Raleway', 'Figtree', 'Mulish', 'Urbanist', 'Sora', 'Lexend', 'Hanken Grotesk', 'Space Grotesk',
    ] },
    { label: 'Miękkie i zaokrąglone', families: [
        'Nunito Sans', 'Nunito', 'Rubik', 'Quicksand', 'Comfortaa', 'Asap', 'Cabin', 'Maven Pro',
    ] },
    { label: 'Węższe', families: [
        'Roboto Condensed', 'Barlow', 'Barlow Condensed', 'Archivo Narrow',
        'IBM Plex Sans Condensed', 'Fira Sans Condensed',
    ] },
    { label: 'Szeryfowe', families: [
        'Roboto Slab', 'Noto Serif', 'Source Serif 4', 'Lora', 'Bitter', 'Literata',
    ] },
    { label: 'Monospace', families: [
        'IBM Plex Mono', 'JetBrains Mono', 'Roboto Mono', 'Source Code Pro', 'Fira Code', 'Inconsolata',
    ] },
];
export const FONTS = FONT_GROUPS.flatMap(group => group.families);
export const BASELINE_STACK = 'Avenir, "Avenir Next", "Helvetica Neue", "Segoe UI", Helvetica, Arial, sans-serif';
export const BASELINE_XR_STACK = '"Avenir Next", Avenir, "Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif';

const pending = new Map();

export function loadFont(family) {
    if (family === BASELINE) return Promise.resolve(BASELINE_STACK);
    if (!/^[\p{L}\p{N}][\p{L}\p{N} -]{0,79}$/u.test(family)) {
        return Promise.reject(new Error('Wpisz nazwę rodziny czcionek, np. Figtree.'));
    }
    if (!pending.has(family)) {
        const request = new Promise((resolve, reject) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.crossOrigin = 'anonymous';
            link.referrerPolicy = 'no-referrer';
            const url = new URL('https://fonts.googleapis.com/css2');
            url.searchParams.set('family', `${family}:wght@400;500;600;700`);
            url.searchParams.set('display', 'swap');
            link.href = url.href;
            const fail = () => {
                clearTimeout(timer);
                link.onload = link.onerror = null;
                link.remove();
                reject(new Error('Nie udało się pobrać kroju. Sprawdź połączenie i nazwę w Google Fonts (odmiany 400, 500, 600, 700).'));
            };
            const timer = setTimeout(fail, 20000);
            link.onerror = fail;
            link.onload = async () => {
                try {
                    const faces = await Promise.all([400, 500, 600, 700].map(weight =>
                        document.fonts.load(`${weight} 16px "${family}"`, 'VM/E Collections Zażółć gęślą jaźń 0123456789')));
                    if (faces.some(matches => matches.length === 0)) throw new Error('Font unavailable');
                    clearTimeout(timer);
                    link.onload = link.onerror = null;
                    resolve(`"${family}", ${BASELINE_STACK}`);
                } catch {
                    fail();
                }
            };
            document.head.append(link);
        });
        pending.set(family, request);
        request.catch(() => pending.delete(family));
    }
    return pending.get(family);
}
