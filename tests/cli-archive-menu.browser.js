import { CLI } from '../src/cli/CLI.js';
import { showArchiveProgramPicker } from '../src/components/ArchiveProgramPicker.js';

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const frame = () => new Promise(resolve => requestAnimationFrame(resolve));

export async function runCliArchiveMenuTest() {
    // Exercise the actual menu/selection transitions, including browser layout,
    // across loading -> ZIP choice rather than checking class names alone.
    await import('../src/styles/vme.css');
    const settings = document.getElementById('settings');
    const elements = ['menu-button-strip', 'menu-button-header-strip'].map(id => {
        const element = document.createElement('div'); element.id = id;
        element.append(document.createElement('button')); element.firstChild.textContent = 'Menu';
        settings.append(element); return element;
    });
    const spacer = document.createElement('div'); spacer.className = 'menu-strip-spacer'; settings.append(spacer);
    elements.push(spacer);
    const cli = new CLI();
    cli.set_keyboard_manager({ setSelectionPanelVisible: visible => {
        document.body.classList.toggle('selection-mode-active', visible);
        // KeyboardManager measures its panel width after changing selection mode.
        settings.getBoundingClientRect();
    } });
    try {
        for (const cancel of ['escape', 'clear']) {
            cli.set_selection_mode(true);
            cli.set_loading(true);
            await frame();
            const choosing = showArchiveProgramPicker(['game1.xex', 'game2.xex'], 'games.zip', cli, { showTouchKeyboard() {}, hideTouchKeyboard() {} });
            for (let i = 0; i < 18; i++) {
                await frame();
                assert(elements.every(element => getComputedStyle(element).display === 'none' && element.getBoundingClientRect().height === 0), 'Global menu stays hidden throughout loading-to-ZIP animation');
                assert(document.querySelector('#cors_results .corsrow span.highlight'), 'ZIP results remain visible and selected');
            }
            cli.process_input(cancel); await choosing;
            cli.set_selection_mode(false); cli.set_loading(false);
            assert(elements.every(element => getComputedStyle(element).display !== 'none'), 'Menu visibility is restored after cancelling ZIP choice');
        }
    } finally {
        cli.off(); cli.set_selection_mode(false); cli.reset(); elements.forEach(element => element.remove());
    }
    return 'Rendered CLI menu regression: no button-panel flash during loading-to-ZIP transition; ESC/Clear restore menu';
}
