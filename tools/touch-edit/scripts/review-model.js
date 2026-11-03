export const devices = Object.freeze({
  iphone: { name: 'iPhone', width: 390, height: 844 },
  ipad: { name: 'iPad', width: 810, height: 1080 },
  android: { name: 'Android', width: 412, height: 915 }
});

export function viewport(device, orientation) {
  const size = devices[device];
  if (!Object.hasOwn(devices, device)) throw new Error(`Unknown device: ${device}`);
  if (!['landscape', 'portrait'].includes(orientation)) throw new Error(`Unknown orientation: ${orientation}`);
  return orientation === 'landscape'
    ? { width: size.height, height: size.width }
    : { width: size.width, height: size.height };
}

export function readRoute(search) {
  const query = new URLSearchParams(search);
  const device = query.get('device') || 'iphone';
  const orientation = query.get('orientation') || 'both';
  const disks = Number(query.get('disks') || 1);
  if (!Object.hasOwn(devices, device)) throw new Error(`Unknown device: ${device}`);
  if (!['landscape', 'portrait', 'both'].includes(orientation)) throw new Error(`Unknown orientation: ${orientation}`);
  if (!Number.isInteger(disks) || disks < 1 || disks > 4) throw new Error(`Invalid disk count: ${disks}`);
  return { platform: query.get('platform'), preset: query.get('preset'), device, orientation, grid: query.get('grid') === '1',
    fastui: query.get('fastui') !== '0', disks, keyboard: query.get('keyboard') === '1', fit: query.get('fit') !== '0' };
}

export function writeRoute(selection, target = location.href) {
  const url = new URL(target);
  url.search = '';
  for (const key of ['platform', 'preset', 'device', 'orientation']) {
    if (selection[key]) url.searchParams.set(key, selection[key]);
  }
  url.searchParams.set('mode', 'review');
  if (selection.grid) url.searchParams.set('grid', '1');
  if (selection.fastui === false) url.searchParams.set('fastui', '0');
  if (selection.disks && selection.disks !== 1) url.searchParams.set('disks', String(selection.disks));
  if (selection.keyboard) url.searchParams.set('keyboard', '1');
  if (selection.fit === false) url.searchParams.set('fit', '0');
  return url;
}

export function parseArea(value) {
  if (typeof value !== 'string') return null;
  // Match the actual manager's required delimiters, without silently repairing data.
  const parts = value.split(' / ').map(part => part.trim());
  if (parts.length !== 4 || !/^\d+$/.test(parts[0]) || !/^\d+$/.test(parts[1]) ||
      !/^span \d+$/.test(parts[2]) || !/^span \d+$/.test(parts[3])) return null;
  const [row, col, rows, cols] = [Number(parts[0]), Number(parts[1]), Number(parts[2].slice(5)), Number(parts[3].slice(5))];
  return [row, col, rows, cols].every(value => Number.isSafeInteger(value) && value > 0)
    ? { row, col, rows, cols } : null;
}

const counts = { SingleTouchButton: 1, DualTouchButton: 2, TripleTouchButton: 3, QuadrupleTouchButton: 4, SextupleTouchButton: 6 };
const surfaces = new Set(['TouchpadComponent', 'QuickshotComponent', 'CursorKeysComponent']);
const keyCodes = { ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39, Space: 32,
  Enter: 13, Escape: 27, Tab: 9, Backspace: 8, ShiftLeft: 16, ShiftRight: 16,
  ControlLeft: 17, ControlRight: 17, AltLeft: 18, AltRight: 18 };

export function validateControllers(config) {
  const findings = [];
  const add = (severity, code, message, preset = null, element = null, orientation = null) =>
    findings.push({ severity, code, message, preset, element, orientation });
  if (!Array.isArray(config?.presets)) {
    add('error', 'presets', 'Configuration must contain a presets array.');
    return findings;
  }
  const ids = new Set();
  for (const preset of config.presets) {
    const id = preset?.id;
    const issue = (severity, code, message, index = null, orientation = null) => add(severity, code, message, id, index, orientation);
    if (typeof id !== 'string' || !id.trim()) issue('error', 'preset-id', 'Missing preset ID.');
    if (ids.has(id)) issue('error', 'duplicate-preset', `Duplicate preset ID: ${id}`);
    ids.add(id);
    if (!Array.isArray(preset?.elements)) {
      issue('error', 'elements', 'Runtime requires an elements array. Layout variants alone are not rendered.');
      continue;
    }
    const elementIds = new Set();
    preset.elements.forEach((element, index) => {
      if (!element || typeof element !== 'object') { issue('error', 'element', 'Invalid element.', index); return; }
      if (element.id) {
        if (elementIds.has(element.id)) issue('error', 'duplicate-element', `Duplicate element ID: ${element.id}`, index);
        elementIds.add(element.id);
      }
      const count = Object.hasOwn(counts, element.component) ? counts[element.component] : undefined;
      if (!count && !surfaces.has(element.component)) issue('error', 'component', `Unknown component: ${element.component}`, index);
      if (count > 1 && element.labels && (!Array.isArray(element.labels) || element.labels.length !== count))
        issue('warning', 'labels', `Expected ${count} button labels.`, index);
      const binding = element.binding;
      if (count > 1) {
        const supported = count === 2 ? ['joy', 'keyboard'] : ['joy'];
        if (!supported.includes(binding?.type)) issue('error', 'binding-type', `${element.component} runtime supports ${supported.join(' or ')} bindings.`, index);
      } else if (count === 1 && binding && !['joy', 'keyboard', 'mouse'].includes(binding.type)) {
        issue('warning', 'binding-fallback', 'Unknown binding falls back to joypad B in the runtime.', index);
      }
      if (count && binding?.type === 'joy') {
        const names = count === 1 ? ['press'] : count === 2 ? ['primary', 'secondary'] : Array.from({ length: count }, (_, i) => `input${i + 1}`);
        names.forEach(name => {
          if (!binding[name]) issue(count === 1 ? 'warning' : 'error', 'joy-binding', `Missing joypad binding: ${name}${count === 1 ? ' (runtime uses B)' : ''}.`, index);
        });
      }
      const mappings = binding?.type === 'keyboard'
        ? (count === 1 ? [binding.key] : count === 2 ? [binding.primary, binding.secondary] : []) : [];
      const partialMappings = (element.component === 'CursorKeysComponent' || element.options?.mode === 'keyboard')
        ? Object.values(element.options?.keys || {}) : [];
      mappings.forEach(key => {
        if (!key || typeof key.code !== 'string' || !key.code || typeof key.key !== 'string') {
          issue('error', 'keyboard-binding', 'Keyboard binding needs key and code.', index);
          return;
        }
        const hasKeyCode = key.keyCode != null && String(key.keyCode).trim() !== '';
        if (hasKeyCode && (!Number.isInteger(Number(key.keyCode)) || Number(key.keyCode) < 1))
          issue('warning', 'keyboard-fallback', 'Invalid keyCode; the runtime will infer it from key/code.', index);
        const expected = keyCodes[key.code] ?? (/^Key[A-Z]$/.test(key.code) ? key.code.charCodeAt(3) :
          /^Digit[0-9]$/.test(key.code) ? key.code.charCodeAt(5) : /^F([1-9]|1[0-2])$/.test(key.code) ? 111 + Number(key.code.slice(1)) : undefined);
        if (hasKeyCode && expected !== undefined && Number(key.keyCode) !== expected)
          issue('warning', 'keycode-mismatch', `${key.code} normally uses keyCode ${expected}; got ${key.keyCode}.`, index);
      });
      // Quickshot/CursorKeys merge partial overrides with their direction defaults.
      partialMappings.forEach(key => {
        if (key?.keyCode != null && !Number.isFinite(Number(key.keyCode)))
          issue('warning', 'keyboard-override', 'Invalid keyCode override; runtime falls back to its default.', index);
        const expected = keyCodes[key?.code];
        if (expected !== undefined && key?.keyCode != null && Number(key.keyCode) !== expected)
          issue('warning', 'keycode-mismatch', `${key.code} normally uses keyCode ${expected}; got ${key.keyCode}.`, index);
      });
    });
    for (const orientation of ['landscape', 'portrait']) {
      const layout = preset.layout?.[orientation] ?? preset.layout?.default;
      if (!layout) issue('error', 'layout', 'Missing runtime layout.', null, orientation);
      else if (layout.rows !== 50 || layout.columns !== 50) issue('warning', 'runtime-grid', 'VM/E runtime always renders a 50 × 50 grid.', null, orientation);
      const areas = [];
      preset.elements.forEach((element, index) => {
        const area = parseArea(element?.gridArea?.[orientation] ?? element?.gridArea?.default ?? element?.gridArea);
        if (!area) { issue('error', 'grid-area', 'Invalid gridArea; runtime may skip this element.', index, orientation); return; }
        if (area.row + area.rows - 1 > 50 || area.col + area.cols - 1 > 50)
          issue('error', 'outside-grid', 'Element extends beyond the runtime 50 × 50 grid.', index, orientation);
        for (const other of areas) {
          if (area.row < other.row + other.rows && other.row < area.row + area.rows &&
              area.col < other.col + other.cols && other.col < area.col + area.cols)
            issue('info', 'overlap', `Grid overlaps element ${other.index + 1}; this may be intentional.`, index, orientation);
        }
        areas.push({ ...area, index });
      });
    }
  }
  return findings;
}
