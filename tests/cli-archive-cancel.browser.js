import JSZip from 'jszip';
import { CLI } from '../src/cli/CLI.js';
import { FindCommand } from '../src/cli/FindCommand.js';
import { PlatformManager, SelectedPlatforms } from '../src/platforms/PlatformManager.js';

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const waitFor = async predicate => {
    for (let i = 0; i < 100; i++) {
        if (predicate()) return;
        await new Promise(resolve => setTimeout(resolve, 10));
    }
    throw new Error('Timed out waiting for ZIP cancellation.');
};

export async function runCliArchiveCancelTest() {
    const zip = new JSZip();
    for (const v of [1, 2]) for (const s of [1, 2]) zip.file(`Polar Pierre (v${v},s${s}).atr`, `${v}:${s}`);
    const blob = new Blob([await zip.generateAsync({ type: 'uint8array' })]);
    const cli = new CLI();
    const app = {
        isGamepadLaunch: () => false,
        getGamepadManager: () => ({ setGuiNavigationEnabled() {} }),
        // Match VME's cancellation route back to the normal CLI menu.
        cancelPendingLaunch: () => { cli.set_loading(false); cli.on(); }
    };
    const previousUpdate = PlatformManager.prototype.updatePlatform;
    let manager;
    try {
        PlatformManager.prototype.updatePlatform = () => {};
        manager = new PlatformManager(app, cli, {}, { fetch: async () => new Response(blob) }, { clicks_off() {}, hideTouchKeyboard() {}, showTouchKeyboard() {} });
    } finally { PlatformManager.prototype.updatePlatform = previousUpdate; }
    manager.setSelectedPlatform(SelectedPlatforms.A800);
    manager.loadCorsFile({ root: '/', bases: ['games/'], items: [['Polar Pierre.zip', 0, 'Polar Pierre.zip', 0, 'Polar Pierre']] });
    cli.register_command(new FindCommand(manager));
    cli.register_default('find');
    cli.inject('polar', false);
    cli.on();
    const key = key => document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    try {
        key('Enter');
        assert(cli.is_selection_mode_active() && cli.get_selection_index() === 0, 'First ENTER enters software selection');
        for (let attempt = 0; attempt < 2; attempt++) {
            key('Enter');
            await waitFor(() => document.querySelector('.rnd-hint'));
            assert(cli.is_selection_mode_active() && document.querySelectorAll('#cors_results .corsrow').length === 3, 'Second ENTER opens the ZIP version chooser in selection mode');
            key('Escape');
            await waitFor(() => !cli.is_loading() && !document.querySelector('.rnd-hint'));
            key('Enter');
            assert(cli.is_selection_mode_active() && cli.get_selection_index() === 0
                && document.querySelector('#cors_results .corsrow span.highlight')?.textContent === 'Polar Pierre',
            'After cancelling ZIP, one ENTER rebuilds software results and enters selection immediately');
        }
    } finally { cli.off(); cli.set_selection_mode(false); cli.reset(); }
    return 'CLI keyboard regression: ENTER, ENTER, ZIP chooser, ESC, ENTER selects software immediately';
}
