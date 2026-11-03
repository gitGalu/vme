import { platformSources, loadPlatformControllers } from './editor/platform-sources.js';
import { devices, viewport, readRoute, writeRoute, validateControllers } from './review-model.js';
import { keyboardInput, keyIdentity, listenForKeyboardTest } from './keyboard-test.js';

const $ = id => document.getElementById(id);
let selection = { device: 'iphone', orientation: 'both', grid: false, fastui: true, disks: 1, keyboard: false, fit: true };
let config, source, frames = [], loading = Promise.resolve();
let loadedAt;
const observers = [];
const pressedKeys = new Map();

function applyFitMode() {
  document.documentElement.dataset.fit = String(selection.fit);
  $('fitViewport').checked = selection.fit;
  if (selection.fit) window.scrollTo(0, 0);
}

function updateKeyboardStatus() {
  const keys = [...pressedKeys.values()].map(key => key.code || key.key || key.keyCode);
  $('keyboardStatus').hidden = !selection.keyboard || keys.length === 0;
  $('keyboardStatus').textContent = keys.length ? `Keyboard test — held: ${keys.join(' + ')}` : '';
}

function resetKeyboardTest() {
  pressedKeys.clear();
  frames.forEach(frame => frame.contentWindow.touchPreview?.clearKeyboardTest());
  updateKeyboardStatus();
}

function handleTestKey(type, event) {
  if (!selection.keyboard) return;
  const key = keyboardInput(event);
  if (type === 'keydown') pressedKeys.set(keyIdentity(key), key); else pressedKeys.delete(keyIdentity(key));
  frames.forEach(frame => frame.contentWindow.touchPreview?.keyboardInput(type, key));
  updateKeyboardStatus();
}

listenForKeyboardTest(window, { isEnabled: () => selection.keyboard, onKey: handleTestKey, onReset: resetKeyboardTest });

function showError(error) { $('error').hidden = false; $('error').textContent = error.message; }

function inspect() {
  return { mode: 'review', selection: { ...selection }, source: source && { file: source.sourceFile, revision: source.revision, loadedAt },
    findings: config ? validateControllers(config).filter(finding => !finding.preset || finding.preset === selection.preset) : [],
    previews: frames.map(frame => frame.contentWindow.touchPreview.inspect()) };
}

function updateInputMonitor() {
  const previews = frames.flatMap(frame => {
    const api = frame.contentWindow.touchPreview;
    return api ? [api.inspect()] : [];
  });
  const held = previews.flatMap(preview => preview.held.map(key => `${preview.orientation}: ${key}`));
  $('heldInputs').textContent = held.length ? `Held: ${held.join(', ')}` : 'No inputs held';
  $('heldInputs').dataset.held = String(held.length > 0);
  $('inputEvents').replaceChildren(...previews.flatMap(preview => preview.events.slice(-12).map(event => {
    const row = document.createElement('li');
    row.textContent = `${preview.orientation}: ${event.type} ${event.code ?? event.button ?? event.label ?? ''}${event.keyCode ? ` [${event.keyCode}]` : ''}`;
    return row;
  })));
}

function updateDiagnostics() {
  const report = inspect();
  const findings = [...new Map([...report.findings, ...report.previews.flatMap(preview => preview.findings)]
    .map(finding => [JSON.stringify(finding), finding])).values()];
  for (const preview of report.previews) for (const message of preview.errors) findings.push({ severity: 'error', code: 'runtime', message });
  $('diagnosticSummary').textContent = `${findings.filter(f => f.severity === 'error').length} errors · ${findings.filter(f => f.severity === 'warning').length} warnings`;
  const node = finding => {
    const entry = document.createElement('div'); entry.className = 'finding'; entry.dataset.severity = finding.severity;
    entry.textContent = finding.message;
    const context = document.createElement('small');
    context.textContent = [finding.code, finding.element != null ? `element ${finding.element + 1}` : '', finding.orientation].filter(Boolean).join(' · ');
    entry.append(context); return entry;
  };
  const info = findings.filter(f => f.severity === 'info');
  const details = document.createElement('details');
  const summary = document.createElement('summary'); summary.textContent = `${info.length} notes (including intentional overlaps and hidden surfaces)`;
  details.append(summary, ...info.map(node));
  $('findings').replaceChildren(...findings.filter(f => f.severity !== 'info').map(node), ...(info.length ? [details] : []));
}

async function createFrame(orientation) {
  const size = viewport(selection.device, orientation);
  const card = document.createElement('section'); card.className = 'preview-card';
  const title = document.createElement('h2'); title.textContent = `${orientation} · ${size.width} × ${size.height}`;
  const slot = document.createElement('div'); slot.className = 'preview-slot';
  const host = document.createElement('div'); host.className = 'preview-viewport';
  const frame = document.createElement('iframe'); frame.title = `${selection.platform} ${selection.preset} ${orientation}`;
  frame.style.width = `${size.width}px`; frame.style.height = `${size.height}px`;
  const ready = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Preview timed out: ${orientation}`)), 15000);
    frame.addEventListener('load', async () => {
      try {
        if (!frame.contentWindow.touchPreview) throw new Error('Runtime preview did not initialize.');
        await frame.contentWindow.touchPreview.ready;
        clearTimeout(timeout); resolve();
      } catch (error) { clearTimeout(timeout); reject(error); }
    }, { once: true });
    frame.addEventListener('error', () => { clearTimeout(timeout); reject(new Error('Could not load runtime preview.')); }, { once: true });
  });
  const url = writeRoute({ ...selection, orientation }, new URL('../frame.html', import.meta.url));
  frame.src = url.href;
  host.append(frame); slot.append(host); card.append(title, slot); $('previews').append(card); frames.push(frame);
  const resize = () => {
    const scale = Math.max(0, Math.min(1, slot.clientWidth / size.width, selection.fit ? slot.clientHeight / size.height : Infinity));
    host.style.width = `${size.width * scale}px`;
    host.style.height = `${size.height * scale}px`;
    frame.style.transform = `scale(${scale})`;
  };
  const observer = new ResizeObserver(resize); observer.observe(slot); observers.push(observer); resize();
  await ready;
}

async function render(patch = {}) {
  $('error').hidden = true;
  const next = { ...selection, ...patch };
  readRoute(writeRoute(next).search); // Validate API calls as well as URL input.
  const platform = platformSources.find(source => source.name === (next.platform || platformSources[0]?.name));
  if (!platform) throw new Error(`Unknown platform: ${next.platform}`);
  const loaded = await loadPlatformControllers(platform.path);
  const preset = loaded.presets.find(preset => preset.id === (next.preset || loaded.presets[0]?.id));
  if (!preset) throw new Error(`Unknown preset: ${next.preset}`);
  resetKeyboardTest();
  for (const frame of frames) frame.contentWindow.touchPreview?.releaseAll();
  observers.splice(0).forEach(observer => observer.disconnect());
  frames = []; $('previews').replaceChildren();
  config = loaded; source = platform; loadedAt = new Date().toISOString();
  selection = { ...next, platform: platform.name, preset: preset.id };
  applyFitMode();
  $('platformSelect').value = platform.name;
  $('presetSelect').replaceChildren(...loaded.presets.map(preset => new Option(preset.name || preset.id, preset.id)));
  $('presetSelect').value = preset.id;
  $('deviceSelect').value = selection.device; $('orientationSelect').value = selection.orientation; $('gridOverlay').checked = selection.grid;
  $('showDisk').checked = selection.disks > 1; $('showFastUi').checked = selection.fastui;
  $('keyboardTest').checked = selection.keyboard;
  $('sourceStatus').textContent = `${platform.sourceFile} · revision ${platform.revision} · loaded ${loadedAt} · ${loaded.presets.length} presets`;
  $('presetDescription').textContent = preset.description || '';
  const url = writeRoute(selection);
  history.replaceState(null, '', url);
  const editUrl = new URL(url); editUrl.pathname = new URL('../editor.html', import.meta.url).pathname; editUrl.searchParams.set('mode', 'edit');
  $('editLink').href = editUrl.href;
  const orientations = selection.orientation === 'both' ? ['landscape', 'portrait'] : [selection.orientation];
  $('previews').dataset.count = orientations.length;
  await Promise.all(orientations.map(createFrame));
  updateKeyboardStatus();
  updateDiagnostics(); updateInputMonitor();
  return inspect();
}

function select(patch) {
  loading = loading.catch(() => {}).then(() => render(patch));
  return loading;
}
window.touchEdit = { inspect, select, listPlatforms: () => platformSources.map(source => ({ ...source })),
  get ready() { return loading; } };

$('platformSelect').replaceChildren(...platformSources.map(source => new Option(source.name, source.name)));
$('deviceSelect').replaceChildren(...Object.entries(devices).map(([key, device]) => new Option(device.name, key)));
$('platformSelect').addEventListener('change', () => select({ platform: $('platformSelect').value, preset: null }).catch(showError));
$('presetSelect').addEventListener('change', () => select({ preset: $('presetSelect').value }).catch(showError));
$('deviceSelect').addEventListener('change', () => select({ device: $('deviceSelect').value }).catch(showError));
$('orientationSelect').addEventListener('change', () => select({ orientation: $('orientationSelect').value }).catch(showError));
$('showDisk').addEventListener('change', () => select({ disks: $('showDisk').checked ? 2 : 1 }).catch(showError));
$('showFastUi').addEventListener('change', () => select({ fastui: $('showFastUi').checked }).catch(showError));
$('fitViewport').addEventListener('change', () => {
  selection.fit = $('fitViewport').checked;
  applyFitMode();
  history.replaceState(null, '', writeRoute(selection));
});
$('keyboardTest').addEventListener('change', () => {
  selection.keyboard = $('keyboardTest').checked;
  pressedKeys.clear();
  frames.forEach(frame => frame.contentWindow.touchPreview?.setKeyboardTest(selection.keyboard));
  history.replaceState(null, '', writeRoute(selection));
  updateKeyboardStatus();
  if (selection.keyboard) $('keyboardTest').blur();
});
$('gridOverlay').addEventListener('change', () => {
  selection.grid = $('gridOverlay').checked;
  frames.forEach(frame => frame.contentWindow.touchPreview?.setGrid(selection.grid));
  history.replaceState(null, '', writeRoute(selection));
});
$('reloadSource').addEventListener('click', () => location.reload());
$('copyLink').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(location.href); $('copyLink').textContent = 'Link copied'; }
  catch { showError(new Error('Clipboard unavailable; copy the URL from the address bar.')); }
});
$('clearEvents').addEventListener('click', () => { frames.forEach(frame => frame.contentWindow.touchPreview.clearEvents()); updateInputMonitor(); });
$('releaseInputs').addEventListener('click', () => { resetKeyboardTest(); frames.forEach(frame => frame.contentWindow.touchPreview.releaseAll()); updateInputMonitor(); updateDiagnostics(); });
$('downloadReport').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(inspect(), null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = `${selection.platform}-${selection.preset}-review.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
window.addEventListener('message', event => {
  if (event.origin === location.origin && event.data?.type === 'touch-edit:keyboard' && frames.some(frame => frame.contentWindow === event.source)) {
    if (event.data.phase === 'reset') resetKeyboardTest();
    else if (['keydown', 'keyup'].includes(event.data.phase)) handleTestKey(event.data.phase, event.data.key);
  }
  if (event.origin === location.origin && event.data?.type === 'touch-edit:input' && frames.some(frame => frame.contentWindow === event.source)) updateInputMonitor();
});
window.addEventListener('popstate', () => { try { select(readRoute(location.search)).catch(showError); } catch (error) { showError(error); } });

if (new URLSearchParams(location.search).get('mode') === 'edit') {
  const url = new URL('../editor.html', import.meta.url); url.search = location.search; location.replace(url);
} else {
  try { select(readRoute(location.search)).catch(showError); } catch (error) { showError(error); loading = Promise.reject(error); loading.catch(() => {}); }
}
