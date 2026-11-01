import './preview.css';
import { BASELINE, BASELINE_STACK, FONTS, FONT_GROUPS } from './fonts.js';

const element = id => document.getElementById(id);
const frame = element('preview');
const select = element('font');
const status = element('status');
const comparison = element('compare');
const params = new URL(location.href).searchParams;
const devices = { desktop: [1280, 800], phone: [390, 844], 'phone-landscape': [844, 390],
    tablet: [820, 1180], 'tablet-landscape': [1180, 820] };
let candidate = params.get('font') || BASELINE;
let baseline = false;
let request = 0;
let preview;

for (const { label, families } of FONT_GROUPS) {
    const group = document.createElement('optgroup');
    group.label = label;
    for (const family of families) group.append(new Option(family, family));
    select.append(group);
}
document.querySelector('label[for="font"]').textContent = `Krój pisma · ${FONTS.length - 1} Google Fonts`;
function addCustom(family) {
    if (![...select.options].some(option => option.value === family)) select.add(new Option(family, family));
}
addCustom(candidate);
select.value = candidate;
element('view').value = ['grid', 'coverflow', 'desktop', 'shell', 'shell-vr'].includes(params.get('view')) ? params.get('view') : 'grid';
element('device').value = Object.hasOwn(devices, params.get('device')) ? params.get('device') : 'fit';
element('labels').checked = params.get('labels') !== 'focused';

function remember() {
    const url = new URL(location.href);
    url.searchParams.set('font', candidate);
    url.searchParams.set('view', element('view').value);
    url.searchParams.set('device', element('device').value);
    url.searchParams.set('labels', element('labels').checked ? 'all' : 'focused');
    history.replaceState(null, '', url);
}

function setDevice() {
    const device = element('device').value;
    const size = devices[device];
    element('stage').classList.toggle('fixed-size', !!size);
    frame.style.width = size ? `${size[0]}px` : '100%';
    frame.style.height = size ? `${size[1]}px` : '100%';
    element('viewport-label').textContent = element('device').selectedOptions[0].textContent;
    remember();
}

function updateViewControls() {
    const view = element('view').value;
    element('labels').disabled = view !== 'grid';
    element('view-help').textContent = {
        grid: 'Klikaj miniatury lub użyj strzałek.',
        coverflow: 'Przesuwaj karuzelę lub użyj strzałek.',
        desktop: 'Pasek pozostaje widoczny. Możesz otworzyć SAVE i listy mapowania klawiatury oraz dysków.',
        shell: 'Kliknij podgląd. Strzałki: nawigacja · Enter: wybór · Esc: wstecz · X: klawiatura/lista.',
        'shell-vr': 'Rzeczywista tekstura VR 1024 × 768. Kliknij podgląd i użyj strzałek, Enter, Esc oraz X.',
    }[view];
}

async function applyFont() {
    remember();
    const generation = ++request;
    comparison.disabled = !preview || candidate === BASELINE;
    comparison.setAttribute('aria-pressed', String(baseline));
    if (!preview) return;
    const family = baseline ? BASELINE : candidate;
    status.classList.remove('error');
    status.textContent = family === BASELINE ? 'Oryginalny zestaw fontów VM/E.' : `Pobieranie ${family}…`;
    const source = element('font-source');
    source.href = family === BASELINE ? 'https://fonts.google.com/'
        : `https://fonts.google.com/specimen/${encodeURIComponent(family).replace(/%20/g, '+')}`;
    try {
        const stack = family === BASELINE ? BASELINE_STACK : await preview.loadFont(family);
        if (generation !== request) return;
        preview.applyFont(stack);
        element('applied-font').textContent = baseline ? `${BASELINE} · porównanie` : family;
        status.textContent = family === BASELINE ? 'Oryginalny zestaw fontów VM/E.' : `${family} · załadowano odmiany 400, 500, 600 i 700.`;
    } catch (error) {
        if (generation !== request) return;
        status.classList.add('error');
        status.textContent = error.message;
    }
}

select.addEventListener('change', () => {
    candidate = select.value;
    baseline = false;
    void applyFont();
});
for (const [id, direction] of [['previous', -1], ['next', 1]]) {
    element(id).addEventListener('click', () => {
        select.selectedIndex = (select.selectedIndex + direction + select.options.length) % select.options.length;
        select.dispatchEvent(new Event('change'));
    });
}
comparison.addEventListener('click', () => { baseline = !baseline; void applyFont(); });
element('custom-font-form').addEventListener('submit', event => {
    event.preventDefault();
    const family = element('custom-font').value.trim().replace(/\s+/g, ' ');
    if (!family) return;
    addCustom(family);
    select.value = family;
    select.dispatchEvent(new Event('change'));
});
element('device').addEventListener('change', setDevice);
element('labels').addEventListener('change', () => {
    preview?.showLabels(element('labels').checked);
    remember();
});
element('view').addEventListener('change', async () => {
    updateViewControls();
    remember();
    if (preview) await preview.setView(element('view').value);
});

setDevice();
updateViewControls();
let initialized = false;
async function initialize() {
    if (initialized) return;
    initialized = true;
    try {
        preview = await frame.contentWindow.previewReady;
        if (!preview) throw new Error('Nie udało się uruchomić podglądu Collection Browsera.');
        await preview.setView(element('view').value);
        preview.showLabels(element('labels').checked);
        const previewBody = frame.contentDocument.body;
        new MutationObserver(() => {
            element('view').value = previewBody.dataset.previewView;
            updateViewControls();
            remember();
        }).observe(previewBody, { attributes: true, attributeFilter: ['data-preview-view'] });
        select.disabled = false;
        await applyFont();
    } catch (error) {
        status.classList.add('error');
        status.textContent = error.message;
    }
}
frame.addEventListener('load', initialize, { once: true });
if (frame.contentWindow.previewReady) void initialize();
