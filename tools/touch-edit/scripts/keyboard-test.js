const modifiers = ['shiftKey', 'ctrlKey', 'altKey', 'metaKey'];
const counts = { SingleTouchButton: 1, DualTouchButton: 2, TripleTouchButton: 3, QuadrupleTouchButton: 4, SextupleTouchButton: 6 };
const arrows = { up: ['ArrowUp', 38, '↑'], down: ['ArrowDown', 40, '↓'], left: ['ArrowLeft', 37, '←'], right: ['ArrowRight', 39, '→'] };

export function keyboardInput(event) {
  return { code: event.code || '', key: event.key || '', keyCode: Number(event.keyCode || event.which || 0),
    ...Object.fromEntries(modifiers.map(name => [name, !!event[name]])) };
}

export function keyIdentity(key) { return key.code || `${key.keyCode}:${key.key}`; }

function normalizedKey(key) {
  const aliases = { space: ' ', spacebar: ' ', enter: 'enter', return: 'enter', esc: 'escape' };
  const value = String(key ?? '').toLowerCase();
  return aliases[value] ?? value;
}

export function matchesKeyboardBinding(mapping, pressed, activeModifiers = {}) {
  if (!mapping || modifiers.some(name => mapping[name] === true && !activeModifiers[name])) return false;
  return pressed.some(key => {
    if (mapping.code && key.code) return mapping.code === key.code;
    if (mapping.keyCode != null && Number(mapping.keyCode) > 0 && key.keyCode > 0) return Number(mapping.keyCode) === key.keyCode;
    return mapping.key != null && normalizedKey(mapping.key) === normalizedKey(key.key);
  });
}

export function elementKeyboardBindings(element) {
  const count = Object.hasOwn(counts, element.component) ? counts[element.component] : 0;
  if (count && element.binding?.type === 'keyboard') {
    const names = count === 1 ? ['key'] : count === 2 ? ['primary', 'secondary'] : Array.from({ length: count }, (_, index) => `input${index + 1}`);
    return names.filter(slot => element.binding[slot]).map(slot => ({ slot, mapping: element.binding[slot], part: names.indexOf(slot) }));
  }
  if (element.component === 'CursorKeysComponent' || (element.component === 'QuickshotComponent' && element.options?.mode === 'keyboard')) {
    return Object.entries(arrows).map(([slot, [code, keyCode, symbol]]) => {
      const override = element.options?.keys?.[slot] || {};
      // Match QuickshotComponent's support for partial direction overrides.
      const letter = typeof override.key === 'string' && /^[a-z]$/i.test(override.key) ? override.key.toUpperCase() : null;
      return { slot, symbol, mapping: { key: override.key || code,
        code: override.code || (letter ? `Key${letter}` : code), keyCode: override.keyCode ?? (letter ? letter.charCodeAt(0) : keyCode) } };
    });
  }
  return [];
}

// Only physical events drive the visualizer. Synthetic keyboard events emitted
// by the touch controls must not feed back into the keyboard-test state.
export function listenForKeyboardTest(win, { isEnabled, onKey, onReset }) {
  const events = new win.AbortController();
  const options = { capture: true, signal: events.signal };
  for (const type of ['keydown', 'keyup']) win.addEventListener(type, event => {
    if (!isEnabled() || !event.isTrusted || event.isComposing) return;
    if (type === 'keydown' && event.target.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
    if (event.code !== 'Tab') { event.preventDefault(); event.stopImmediatePropagation(); }
    onKey(type, keyboardInput(event));
  }, options);
  win.addEventListener('blur', onReset, { signal: events.signal });
  win.addEventListener('pagehide', onReset, { signal: events.signal });
  win.document.addEventListener('visibilitychange', () => { if (win.document.hidden) onReset(); }, { signal: events.signal });
  return () => events.abort();
}

export function createKeyboardHighlighter({ getPreset, getGrid, getPlatform, onChange }) {
  let enabled = false;
  let activeModifiers = {};
  let highlights = [];
  const keys = new Map();

  function refresh() {
    document.querySelectorAll('.review-key-active').forEach(element => element.classList.remove('review-key-active'));
    document.querySelectorAll('.review-key-directions').forEach(element => element.remove());
    highlights = [];
    if (!enabled) return;
    const pressed = [...keys.values()];
    const grid = getGrid();
    getPreset().elements.forEach((element, index) => {
      const root = grid?.children[index];
      if (!root) return;
      const matches = elementKeyboardBindings(element).filter(binding => matchesKeyboardBinding(binding.mapping, pressed, activeModifiers));
      for (const binding of matches) {
        const target = binding.part == null || element.component === 'SingleTouchButton' ? root : root.children[binding.part];
        target?.classList.add('review-key-active');
      }
      if (matches.some(binding => binding.symbol)) {
        const badge = document.createElement('span'); badge.className = 'review-key-directions';
        badge.textContent = matches.map(binding => binding.symbol).join(' '); root.append(badge);
      }
      if (matches.length) highlights.push({ element: index, slots: matches.map(binding => binding.slot) });
    });
    const additional = getPlatform()?.additional_buttons || {};
    Object.keys(additional).reverse().forEach((key, index) => {
      const root = document.getElementById(`fast${index + 1}`);
      if (root?.checkVisibility() && matchesKeyboardBinding(additional[key].key, pressed, activeModifiers)) {
        root.classList.add('review-key-active'); highlights.push({ fastButton: root.id, slots: ['key'] });
      }
    });
  }
  function inspect() { return { enabled, pressed: [...keys.values()], highlights: structuredClone(highlights) }; }
  function clear() { keys.clear(); activeModifiers = {}; refresh(); onChange?.(inspect()); }
  return {
    inspect,
    setEnabled(value) { enabled = !!value; clear(); },
    clear,
    refresh,
    input(type, event) {
      if (!enabled) return inspect();
      if (!['keydown', 'keyup'].includes(type)) throw new Error(`Unknown keyboard phase: ${type}`);
      const key = keyboardInput(event);
      if (type === 'keydown') keys.set(keyIdentity(key), key); else keys.delete(keyIdentity(key));
      activeModifiers = Object.fromEntries(modifiers.map(name => [name, key[name]]));
      refresh(); onChange?.(inspect()); return inspect();
    }
  };
}
