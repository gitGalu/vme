import '../../../src/styles/vme.css';
import '../styles/runtime-preview.css';
import { CustomControllerManager } from '../../../src/touch/custom/CustomControllerManager.js';
import { platformSources, loadPlatformControllers, loadPlatformDefinition } from './editor/platform-sources.js';
import { validateControllers, readRoute } from './review-model.js';
import { createFastUiPreview } from './fast-ui-preview.js';
import { createKeyboardHighlighter, listenForKeyboardTest } from './keyboard-test.js';

const events = [];
const held = new Set();
const errors = [];
const touches = new Map();
const canvas = document.querySelector('canvas');
let manager, platform, config, preset, fastUi, keyboardTest, platformDefinition;
let sequence = 0;

function announce() {
  if (parent !== window) parent.postMessage({ type: 'touch-edit:input', state: { events: events.slice(-25), held: [...held] } }, location.origin);
}
function record(type, detail, key = null, down = null) {
  if (key && down !== null) down ? held.add(key) : held.delete(key);
  events.push({ sequence: ++sequence, type, ...detail });
  if (events.length > 200) events.shift();
  announce();
}
for (const type of ['keydown', 'keyup']) canvas.addEventListener(type, event => {
  event.preventDefault();
  record(type, { key: event.key, code: event.code, keyCode: event.keyCode,
    shiftKey: event.shiftKey, ctrlKey: event.ctrlKey, altKey: event.altKey, metaKey: event.metaKey },
  `keyboard:${event.code}`, type === 'keydown');
});
for (const type of ['mousedown', 'mouseup', 'mousemove']) canvas.addEventListener(type, event => {
  record(type, { button: event.button, buttons: event.buttons, movementX: event.movementX, movementY: event.movementY },
    type === 'mousemove' ? null : `mouse:${event.button}`, type === 'mousemove' ? null : type === 'mousedown');
});
const mockCore = {
  pressDown: button => record('joydown', { button }, `joy:${button}`, true),
  pressUp: button => record('joyup', { button }, `joy:${button}`, false)
};
window.addEventListener('error', event => errors.push(event.message));
window.addEventListener('unhandledrejection', event => errors.push(String(event.reason?.message || event.reason)));

function mount() {
  manager = new CustomControllerManager({ getNostalgist: () => mockCore }, config);
  manager.setActivePreset(preset.id);
  manager.show();
  keyboardTest?.refresh();
}

function sendTouch(target, phase, identifier, x, y) {
  const touch = new Touch({ identifier, target, clientX: x, clientY: y, pageX: x, pageY: y, screenX: x, screenY: y });
  if (phase === 'end' || phase === 'cancel') touches.delete(identifier);
  else touches.set(identifier, { touch, target });
  target.dispatchEvent(new TouchEvent(`touch${phase}`, {
    bubbles: true, cancelable: true, changedTouches: [touch],
    touches: [...touches.values()].map(entry => entry.touch),
    targetTouches: [...touches.values()].filter(entry => entry.target === target).map(entry => entry.touch)
  }));
}

// Desktop mouse input goes through the real touch handlers. Native device touch
// events pass through unchanged; the adapter lives only in this tool's frame.
document.addEventListener('pointerdown', event => {
  if (event.pointerType !== 'mouse' || event.button !== 0) return;
  const target = event.target.closest('#custom-touch-controller');
  if (!target) return;
  event.preventDefault();
  event.target.setPointerCapture?.(event.pointerId);
  sendTouch(event.target, 'start', event.pointerId, event.clientX, event.clientY);
}, true);
document.addEventListener('pointermove', event => {
  const entry = touches.get(event.pointerId);
  if (event.pointerType === 'mouse' && entry) sendTouch(entry.target, 'move', event.pointerId, event.clientX, event.clientY);
}, true);
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) document.addEventListener(type, event => {
  const entry = touches.get(event.pointerId);
  if (event.pointerType === 'mouse' && entry) sendTouch(entry.target, type === 'pointerup' ? 'end' : 'cancel', event.pointerId, event.clientX, event.clientY);
}, true);

function cancelTouches() {
  for (const [identifier, { touch, target }] of [...touches]) sendTouch(target, 'cancel', identifier, touch.clientX, touch.clientY);
}
window.addEventListener('blur', cancelTouches);
window.addEventListener('pagehide', () => { cancelTouches(); manager?.destroy(); fastUi?.destroy(); });
listenForKeyboardTest(window, {
  isEnabled: () => keyboardTest?.inspect().enabled,
  onKey(type, key) {
    if (parent !== window) parent.postMessage({ type: 'touch-edit:keyboard', phase: type, key }, location.origin);
    else keyboardTest.input(type, key);
  },
  onReset() {
    if (!keyboardTest?.inspect().enabled) return;
    keyboardTest.clear();
    if (parent !== window) parent.postMessage({ type: 'touch-edit:keyboard', phase: 'reset' }, location.origin);
  }
});

function inspect() {
  if (!preset || !manager) return { loading: true, events: [...events], held: [...held], elements: [], findings: [], errors: [...errors] };
  const grid = document.querySelector('.custom-touch-controller__grid');
  const elements = [...(grid?.children || [])].map((element, index) => {
    const rect = element.getBoundingClientRect();
    const definition = preset.elements[index];
    const intentionallyHidden = definition?.component === 'TouchpadComponent' && definition.options?.anywhere === true;
    return { index, id: element.id || null, label: element.innerText, classes: element.className,
      component: definition?.component, binding: structuredClone(definition?.binding ?? null), options: structuredClone(definition?.options ?? {}),
      gridArea: element.style.gridArea,
      visible: element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }),
      intentionallyHidden,
      bounds: Object.fromEntries(['x', 'y', 'width', 'height'].map(key => [key, Math.round(rect[key] * 100) / 100])),
      outsideViewport: rect.left < -1 || rect.top < -1 || rect.right > innerWidth + 1 || rect.bottom > innerHeight + 1 };
  });
  const findings = validateControllers({ ...config, presets: [preset] });
  const fastButtons = [...(fastUi?.host.children || [])].filter(element => element.id !== 'fastui-msg').map(element => {
    const control = element.querySelector('.fast-control--trigger') || element;
    const rect = control.getBoundingClientRect();
    return { id: element.id, label: control.innerText.trim(),
      visible: control.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }),
      gridArea: getComputedStyle(element).gridArea,
      bounds: Object.fromEntries(['x', 'y', 'width', 'height'].map(key => [key, Math.round(rect[key] * 100) / 100])) };
  });
  for (const button of fastButtons.filter(button => button.visible)) {
    const b = button.bounds;
    for (const element of elements.filter(element => element.visible && element.component?.endsWith('TouchButton'))) {
      const a = element.bounds;
      const width = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
      const height = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
      if (width > 1 && height > 1) findings.push({ severity: 'warning', code: 'fastui-overlap',
        message: `Fast button ${button.label} overlaps custom element ${element.index + 1}; FastUI is above the custom overlay.`,
        preset: preset.id, element: element.index, fastButton: button.id,
        orientation: innerWidth >= innerHeight ? 'landscape' : 'portrait' });
    }
  }
  if (elements.length !== preset.elements.length) findings.push({ severity: 'error', code: 'mount-count',
    message: `Runtime mounted ${elements.length} of ${preset.elements.length} elements.`, preset: preset.id });
  for (const element of elements.filter(element => element.outsideViewport)) findings.push({ severity: 'warning', code: 'rendered-outside',
    message: `Rendered element ${element.index + 1} extends beyond the viewport.`, preset: preset.id, element: element.index });
  for (const element of elements.filter(element => !element.visible && !element.intentionallyHidden)) findings.push({ severity: 'error', code: 'rendered-invisible',
    message: `Rendered element ${element.index + 1} is invisible.`, preset: preset.id, element: element.index });
  for (const element of elements.filter(element => element.intentionallyHidden)) findings.push({ severity: 'info', code: 'touchpad-anywhere',
    message: 'Touchpad is intentionally hidden; its input surface is the full controller grid.', preset: preset.id, element: element.index });
  return { platform: platform.name, preset: preset.id, sourceFile: platform.sourceFile, revision: platform.revision,
    viewport: { width: innerWidth, height: innerHeight }, orientation: innerWidth >= innerHeight ? 'landscape' : 'portrait',
    gameFocus: manager.isGameFocusEnabled(), hideAdditionalButtons: manager.shouldHideAdditionalButtons(),
    fastUi: { enabled: fastUi?.host.style.display !== 'none', disks: fastUi?.disks || 1 },
    keyboardTest: keyboardTest?.inspect() || { enabled: false, pressed: [], highlights: [] },
    fastButtons, elements, findings, events: [...events], held: [...held], errors: [...errors] };
}

window.touchPreview = {
  inspect,
  clearEvents() { events.length = 0; announce(); },
  releaseAll() { keyboardTest?.clear(); cancelTouches(); manager.destroy(); const remaining = [...held]; mount(); announce(); return remaining; },
  setKeyboardTest(enabled) { keyboardTest?.setEnabled(enabled); },
  keyboardInput(type, key) { return keyboardTest?.input(type, key); },
  clearKeyboardTest() { keyboardTest?.clear(); },
  setGrid(enabled) { document.documentElement.dataset.grid = String(enabled); },
  gestureFastButton(id, phase = 'start', identifier = 20001) {
    const element = document.getElementById(id);
    if (!element || element.parentElement !== fastUi?.host) throw new Error(`Unknown fast button: ${id}`);
    if (!['start', 'end', 'cancel'].includes(phase)) throw new Error(`Unknown phase: ${phase}`);
    const target = element.querySelector('.fast-control--trigger') || element;
    const rect = target.getBoundingClientRect();
    sendTouch(target, phase, identifier, rect.left + rect.width / 2, rect.top + rect.height / 2);
    return inspect();
  },
  gesture(index, phase = 'start', x = 0.5, y = 0.5, identifier = 10001) {
    const entry = touches.get(identifier);
    const grid = document.querySelector('.custom-touch-controller__grid');
    const definition = preset.elements[index];
    const anywhere = definition?.component === 'TouchpadComponent' && definition.options?.anywhere === true;
    const element = entry?.target || (anywhere ? grid : grid?.children[index]);
    if (!element) throw new Error(`No rendered element ${index}`);
    if (!['start', 'move', 'end', 'cancel'].includes(phase)) throw new Error(`Unknown phase: ${phase}`);
    const rect = element.getBoundingClientRect();
    sendTouch(element, phase, identifier, rect.left + rect.width * x, rect.top + rect.height * y);
    return { events: [...events], held: [...held] };
  }
};
window.touchPreview.ready = (async () => {
  const query = new URLSearchParams(location.search);
  platform = platformSources.find(entry => entry.name === query.get('platform'));
  if (!platform) throw new Error(`Unknown platform: ${query.get('platform')}`);
  config = await loadPlatformControllers(platform.path);
  preset = config.presets.find(entry => entry.id === query.get('preset'));
  if (!preset) throw new Error(`Unknown preset: ${query.get('preset')}`);
  canvas.width = innerWidth;
  canvas.height = innerHeight;
  const settings = readRoute(location.search);
  platformDefinition = await loadPlatformDefinition(platform.path);
  fastUi = createFastUiPreview(platformDefinition, preset, mockCore, {
    disks: settings.disks, enabled: settings.fastui, onAction: detail => record('fastui-preview', detail)
  });
  mount();
  keyboardTest = createKeyboardHighlighter({
    getPreset: () => preset,
    getGrid: () => document.querySelector('.custom-touch-controller__grid'),
    getPlatform: () => platformDefinition,
    onChange: announce
  });
  keyboardTest.setEnabled(settings.keyboard);
  window.touchPreview.setGrid(query.get('grid') === '1');
  await document.fonts.ready;
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  return inspect();
})();
