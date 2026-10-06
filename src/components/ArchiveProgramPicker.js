import { EnvironmentManager } from '../EnvironmentManager.js';

// Reuse CLI result rows, selection highlighting, and the existing touch controls.
// Browser launches temporarily reveal the CLI while keeping their views intact.
export async function showArchiveProgramPicker(paths, title, cli, keyboardManager) {
    const displays = ['settings', 'save-browser', 'collection-browser', 'cors_interface']
        .map(id => document.getElementById(id)).filter(Boolean)
        .map(element => ({ element, display: element.style.display }));
    const settings = document.getElementById('settings');
    const interfaceElement = document.getElementById('cors_interface');
    const wasChoosingArchive = settings.classList.contains('archive-program-choice');
    settings.classList.add('archive-program-choice');
    settings.style.display = 'flex';
    interfaceElement.style.display = 'block';
    for (const id of ['save-browser', 'collection-browser']) {
        const element = document.getElementById(id);
        if (element) element.style.display = 'none';
    }
    try {
        const picking = cli.chooseFromList(paths.map(item => {
            const { path, label } = typeof item === 'string' ? { path: item, label: item } : item;
            return { id: path, label, data: path };
        }), {
            title: '',
            queryLabel: ''
        });
        if (EnvironmentManager.hasTouch()) keyboardManager?.showTouchKeyboard();
        const selected = await picking;
        return selected?.data ?? null;
    } finally {
        keyboardManager?.hideTouchKeyboard();
        cli.set_loading(true);
        cli.off();
        settings.style.pointerEvents = 'none';
        document.querySelectorAll('#menu-button-strip button, #menu-button-header-strip button')
            .forEach(button => { button.style.pointerEvents = 'none'; });
        displays.forEach(({ element, display }) => { element.style.display = display; });
        settings.classList.toggle('archive-program-choice', wasChoosingArchive);
    }
}
