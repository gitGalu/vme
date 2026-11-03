import { UiManager } from '../../../src/ui/UiManager.js';

// Use VM/E's own platform-dependent assembly and CSS. Actions stay local to the
// review frame: QUIT/SAVE/input-mode controls must not navigate or change modes.
export function createFastUiPreview(platform, preset, core, { disks = 1, enabled = true, onAction } = {}) {
  const diskNames = platform.multidisk && disks > 1
    ? Array.from({ length: disks }, (_, index) => `Preview disk ${index + 1}`) : [];
  const ui = new UiManager({
    getSelectedPlatform: () => platform,
    getNostalgist: () => core,
    getProgramName: () => '',
    getCurrentM3uDisks: () => diskNames,
    getCurrentM3uDiskIndex: () => 0
  }, {});
  ui.initFastUI();
  ui.initTouchControllerMenu();

  const host = document.getElementById('fastui');
  host.style.display = enabled ? 'grid' : 'none';
  const custom = host.querySelector('#fastcustom');
  if (custom) {
    custom.innerHTML = platform.custom_controllers?.special_button?.label ?? 'CUSTOM';
    custom.querySelectorAll('span').forEach(span => span.style.removeProperty('font-size'));
    custom.style.display = 'flex';
  }
  // This frame always shows an active CUSTOM preset; match UiManager's custom
  // mode rule without initializing the rest of the emulator/input-mode system.
  for (let index = 1; index <= Object.keys(platform.additional_buttons || {}).length; index++) {
    const button = host.querySelector(`#fast${index}`);
    if (button) button.style.display = preset.hideAdditionalButtons === true ? 'none' : 'flex';
  }

  const listeners = new AbortController();
  for (const type of ['pointerdown', 'pointerup', 'pointercancel', 'touchstart', 'touchmove', 'touchend', 'touchcancel', 'click', 'contextmenu', 'keydown', 'keyup']) {
    host.addEventListener(type, event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const root = event.target.closest('#fastui > [id]');
      const control = root?.querySelector('.fast-control--trigger') || root;
      if (!root) return;
      if (['pointerdown', 'touchstart'].includes(type)) control.classList.add('is-active');
      if (['pointerup', 'pointercancel', 'touchend', 'touchcancel'].includes(type)) control.classList.remove('is-active');
      if (type === 'touchend' || (type === 'pointerup' && event.pointerType === 'mouse') || (type === 'click' && event.detail === 0))
        onAction?.({ id: root.id, label: control.innerText.trim() });
    }, { capture: true, passive: false, signal: listeners.signal });
  }
  return {
    host,
    disks: diskNames.length || 1,
    destroy() { listeners.abort(); host.remove(); }
  };
}
