import { UiManager } from '../../src/ui/UiManager.js';
import { CustomDropdown } from '../../src/components/CustomDropdown.js';
import A800 from '../../src/platforms/systems/A800.js';

export function createDesktopPreview(source, image) {
    const scene = document.createElement('div');
    scene.id = 'preview-desktop-scene';
    const artwork = document.createElement('img');
    artwork.src = image;
    artwork.alt = '';
    scene.append(artwork);
    const toolbar = source.getElementById('desktopUi');
    document.body.append(scene, toolbar);
    toolbar.classList.add('visible');

    const core = { press() {} };
    const ui = new UiManager({ getSelectedPlatform: () => A800, getNostalgist: () => core, saveState() {} }, {});
    ui.initControlsButton();
    ui.initSaveButton();

    const keyboard = document.getElementById('kbModeContainer');
    keyboard.replaceChildren();
    const modes = document.createElement('div');
    modes.id = 'kbModeDropdownContainer';
    keyboard.append(modes);
    const keymap = new CustomDropdown(modes.id, [
        { value: 'retropad', text: 'Keyboard as joystick' },
        { value: 'focusmode', text: 'Full keyboard (Esc to exit)' },
    ], 'retropad');
    const disks = document.getElementById('desktopDiskDropdownWrap');
    disks.style.display = 'flex';
    const disk = new CustomDropdown('desktopDiskDropdownContainer', [
        { value: '0', text: 'Disk 1 of 2' }, { value: '1', text: 'Disk 2 of 2' },
    ], '0');

    return {
        open() { scene.hidden = false; toolbar.style.display = 'flex'; },
        close() {
            scene.hidden = true;
            toolbar.style.display = 'none';
            keymap.close();
            disk.close();
            for (const id of ['controlsMenu', 'saveMenu']) document.getElementById(id).style.display = 'none';
        },
    };
}
