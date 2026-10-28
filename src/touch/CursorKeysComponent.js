import { QuickshotComponent } from './QuickshotComponent.js';

// Keyboard flavour of the QuickShot stick: directions are sent as key events (arrows by default).
export class CursorKeysComponent extends QuickshotComponent {
    constructor(parent, gridArea, id, platformManager, options = {}) {
        super(parent, gridArea, id, platformManager, { label: 'CURSOR', ...options, mode: 'keyboard' });
        this.el.classList.add('cursor-keys-component');
    }
}
