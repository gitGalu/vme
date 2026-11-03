import { spawn } from 'node:child_process';
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { viewport } from './scripts/review-model.js';

const repository = fileURLToPath(new URL('../../', import.meta.url));
const options = { devices: 'iphone,ipad,android', orientations: 'landscape,portrait', out: 'build/touch-edit' };
for (let index = 2; index < process.argv.length; index += 2) {
  const key = process.argv[index].replace(/^--/, '');
  if (!['platform', 'preset', 'devices', 'orientations', 'out'].includes(key) || !process.argv[index + 1])
    throw new Error('Usage: npm run touch-edit:check -- [--platform DOS] [--preset dos-qj-stunts] [--devices iphone,ipad,android] [--orientations landscape,portrait] [--out build/touch-edit]');
  options[key] = process.argv[index + 1];
}
const selectedDevices = options.devices.split(',');
const orientations = options.orientations.split(',');
for (const device of selectedDevices) for (const orientation of orientations) viewport(device, orientation);

async function findChrome() {
  const candidates = [process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    process.env.PROGRAMFILES && join(process.env.PROGRAMFILES, 'Google/Chrome/Application/chrome.exe')].filter(Boolean);
  for (const path of candidates) { try { await access(path); return path; } catch {} }
  throw new Error('Chrome/Chromium not found. Set CHROME_PATH to its executable.');
}

class Browser {
  pending = new Map();
  sequence = 0;
  buffer = '';
  stderr = '';
  constructor(executable, profile) {
    this.child = spawn(executable, ['--headless=new', '--remote-debugging-pipe', `--user-data-dir=${profile}`,
      '--no-first-run', '--no-default-browser-check', '--disable-background-networking', 'about:blank'],
    { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] });
    this.child.stderr.setEncoding('utf8').on('data', data => { this.stderr = (this.stderr + data).slice(-4000); });
    this.child.stdio[4].setEncoding('utf8').on('data', data => {
      this.buffer += data;
      let end;
      while ((end = this.buffer.indexOf('\0')) !== -1) {
        const message = JSON.parse(this.buffer.slice(0, end)); this.buffer = this.buffer.slice(end + 1);
        const pending = this.pending.get(message.id);
        if (!pending) continue;
        this.pending.delete(message.id); clearTimeout(pending.timeout);
        message.error ? pending.reject(new Error(message.error.message)) : pending.resolve(message.result);
      }
    });
    const fail = error => {
      this.dead = true;
      for (const pending of this.pending.values()) { clearTimeout(pending.timeout); pending.reject(error); }
      this.pending.clear();
    };
    this.child.once('error', fail);
    this.child.once('exit', code => fail(new Error(`Chrome exited (${code}). ${this.stderr}`)));
  }
  call(method, params = {}, sessionId) {
    if (this.dead) return Promise.reject(new Error(`Chrome is unavailable. ${this.stderr}`));
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { this.pending.delete(id); reject(new Error(`Timed out: ${method}`)); }, 20000);
      this.pending.set(id, { resolve, reject, timeout });
      this.child.stdio[3].write(JSON.stringify({ id, method, params, sessionId }) + '\0', error => {
        if (error) { clearTimeout(timeout); this.pending.delete(id); reject(error); }
      });
    });
  }
  async evaluate(expression, session) {
    const result = await this.call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, session);
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  }
  async close() {
    if (this.dead) return;
    await this.call('Browser.close').catch(() => {});
    if (!this.dead) await new Promise(resolve => { this.child.once('exit', resolve); setTimeout(() => { this.child.kill(); resolve(); }, 2000).unref(); });
  }
}

const exercise = `(async () => {
  const api = window.touchPreview;
  const failures = [];
  const cases = [];
  const settle = async () => { const deadline=Date.now()+200; while(api.inspect().held.length && Date.now()<deadline) await new Promise(resolve=>setTimeout(resolve,10)); };
  const count = api.inspect().elements.length;
  for (let index = 0; index < count; index++) {
    const metadata = api.inspect().elements[index];
    let observedDown = false;
    for (const [x,y] of [[0.2,0.5],[0.8,0.5],[0.5,0.2],[0.5,0.8]]) {
      api.clearEvents();
      api.gesture(index, 'start', x, y);
      api.gesture(index, 'move', 0.85, 0.85);
      api.gesture(index, 'end', 0.85, 0.85);
      await settle();
      let state = api.inspect();
      if (state.held.length) failures.push({element:index,phase:'end',held:state.held});
      const routedEvents = state.events;
      observedDown ||= routedEvents.some(event=>['keydown','joydown','mousedown'].includes(event.type));
      api.gesture(index, 'start', x, y);
      api.gesture(index, 'cancel', x, y);
      await settle();
      state = api.inspect();
      if (state.held.length) failures.push({element:index,phase:'cancel',held:state.held});
      cases.push({element:index,x,y,events:routedEvents});
    }
    if (metadata.classes.split(' ').includes('fast-button') && !observedDown) failures.push({element:index,phase:'no-input'});
    if (metadata.component === 'TouchpadComponent') {
      api.clearEvents();
      api.gesture(index, 'start', 0.5, 0.5);
      api.gesture(index, 'end', 0.5, 0.5);
      await settle();
      const state = api.inspect();
      if(state.held.length) failures.push({element:index,phase:'tap',held:state.held});
      cases.push({element:index,phase:'tap',events:state.events});
    }
  }
  api.releaseAll();
  await settle();
  if(api.inspect().held.length) failures.push({phase:'destroy',held:api.inspect().held});
  api.clearEvents();
  const fastButtons = [];
  for (const button of api.inspect().fastButtons.filter(button=>button.visible)) {
    api.clearEvents();
    api.gestureFastButton(button.id, 'start');
    api.gestureFastButton(button.id, 'end');
    const state = api.inspect();
    const actions = state.events.filter(event=>event.type==='fastui-preview' && event.id===button.id);
    if (actions.length !== 1 || state.held.length || state.events.some(event=>event.type!=='fastui-preview'))
      failures.push({phase:'fastui-action',button:button.id,events:state.events,held:state.held});
    fastButtons.push({id:button.id,events:state.events});
  }
  api.clearEvents();
  return {cases,fastButtons,failures};
})()`;

async function openPage(browser, sessionId, url, api) {
  await browser.call('Page.navigate', { url: 'about:blank' }, sessionId);
  const navigation = await browser.call('Page.navigate', { url }, sessionId);
  if (navigation.errorText) throw new Error(navigation.errorText);
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    try {
      if (await browser.evaluate(`location.href === ${JSON.stringify(url)} && !!window.${api}`, sessionId)) {
        await browser.evaluate(`window.${api}.ready.then(() => true)`, sessionId);
        return;
      }
    } catch (error) {
      if (!/context.*destroyed|Cannot find context|Inspected target navigated/i.test(error.message)) throw error;
    }
    await new Promise(resolve => setTimeout(resolve, 30));
  }
  throw new Error(`Page did not initialize: ${url}`);
}

async function verifyKeyboardTest(browser, sessionId) {
  const evaluate = expression => browser.evaluate(expression, sessionId);
  const key = async (type, code, value, keyCode, extra = {}) => {
    await browser.call('Input.dispatchKeyEvent', { type, code, key: value, windowsVirtualKeyCode: keyCode, ...extra }, sessionId);
    await evaluate('new Promise(resolve=>requestAnimationFrame(resolve))');
  };
  const assert = async (expression, message) => { if (!await evaluate(expression)) throw new Error(message); };
  await evaluate(`touchEdit.select({platform:'DOS',preset:'dos-qj-space',orientation:'both',keyboard:true})`);
  await evaluate(`document.activeElement.blur(); document.body.tabIndex=-1; document.body.focus()`);
  await key('keyDown', 'ArrowLeft', 'ArrowLeft', 37);
  await key('keyDown', 'ArrowLeft', 'ArrowLeft', 37, { autoRepeat: true });
  await assert(`touchEdit.inspect().previews.every(p=>p.keyboardTest.pressed.length===1 && p.keyboardTest.highlights.some(h=>h.element===0 && h.slots.includes('primary')))`, 'Keyboard test did not highlight the left half in both frames.');
  await assert(`[...document.querySelectorAll('iframe')].every(f=>f.contentDocument.querySelector('.custom-touch-controller__grid').children[0].children[0].classList.contains('review-key-active') && !f.contentDocument.querySelector('.custom-touch-controller__grid').children[0].children[1].classList.contains('review-key-active'))`, 'Keyboard highlight affected the wrong button half.');
  await key('keyDown', 'ArrowRight', 'ArrowRight', 39);
  await key('keyUp', 'ArrowLeft', 'ArrowLeft', 37);
  await assert(`touchEdit.inspect().previews.every(p=>p.keyboardTest.highlights.some(h=>h.element===0 && h.slots.length===1 && h.slots[0]==='secondary'))`, 'Releasing one key cleared the other held key.');
  await key('keyUp', 'ArrowRight', 'ArrowRight', 39);
  await assert(`touchEdit.inspect().previews.every(p=>!p.keyboardTest.highlights.length && !p.held.length)`, 'Keyup did not clear keyboard highlights.');
  await evaluate(`document.querySelector('iframe').contentDocument.body.tabIndex=-1;document.querySelector('iframe').contentDocument.body.focus()`);
  await key('keyDown', 'ArrowUp', 'ArrowUp', 38);
  await assert(`touchEdit.inspect().previews.every(p=>p.keyboardTest.highlights.length>0)`, 'Keyboard input inside a preview was not mirrored to both frames.');
  await evaluate('document.body.focus()');
  await evaluate('new Promise(resolve=>requestAnimationFrame(resolve))');
  await assert(`touchEdit.inspect().previews.every(p=>!p.keyboardTest.highlights.length)`, 'Blur left keyboard highlights held.');
  await key('keyUp', 'ArrowUp', 'ArrowUp', 38);
  await evaluate(`const api=document.querySelector('iframe').contentWindow.touchPreview;api.gesture(0,'start',0.2,0.5);api.gesture(0,'end',0.2,0.5)`);
  await assert(`touchEdit.inspect().previews.every(p=>!p.keyboardTest.pressed.length)`, 'Synthetic touch keyboard events fed back into keyboard test.');
  await evaluate(`const input=document.createElement('input');input.id='keyboard-test-input';document.body.append(input);input.focus()`);
  await key('keyDown', 'KeyA', 'a', 65, { text: 'a' });
  await key('keyUp', 'KeyA', 'a', 65);
  await assert(`document.getElementById('keyboard-test-input').value==='a' && touchEdit.inspect().previews.every(p=>!p.keyboardTest.pressed.length)`, 'Keyboard test intercepted form input.');
  await evaluate(`document.getElementById('keyboard-test-input').remove();document.body.focus()`);
  await key('keyDown', 'ArrowLeft', 'ArrowLeft', 37);
  await evaluate(`touchEdit.select({platform:'Amiga',preset:'amiga-pinball-1',keyboard:true})`);
  await assert(`touchEdit.inspect().previews.every(p=>!p.keyboardTest.pressed.length)`, 'Preset change retained keyboard-test state.');
  await key('keyUp', 'ArrowLeft', 'ArrowLeft', 37);
  await key('keyDown', 'ShiftLeft', 'Shift', 16, { location: 1, modifiers: 8 });
  await assert(`touchEdit.inspect().previews.every(p=>p.keyboardTest.highlights.some(h=>p.elements[h.element]?.binding?.key?.code==='ShiftLeft') && !p.keyboardTest.highlights.some(h=>p.elements[h.element]?.binding?.key?.code==='ShiftRight'))`, 'Keyboard test confused left and right Shift.');
  await key('keyDown', 'ShiftRight', 'Shift', 16, { location: 2, modifiers: 8 });
  await key('keyUp', 'ShiftLeft', 'Shift', 16, { location: 1, modifiers: 8 });
  await assert(`touchEdit.inspect().previews.every(p=>!p.keyboardTest.highlights.some(h=>p.elements[h.element]?.binding?.key?.code==='ShiftLeft') && p.keyboardTest.highlights.some(h=>p.elements[h.element]?.binding?.key?.code==='ShiftRight'))`, 'Shift release cleared the wrong highlight.');
  await evaluate(`document.getElementById('keyboardTest').click()`);
  await assert(`touchEdit.inspect().previews.every(p=>!p.keyboardTest.enabled && !p.keyboardTest.highlights.length)`, 'Disabling keyboard test did not clear highlights.');
  await key('keyUp', 'ShiftRight', 'Shift', 16, { location: 2 });
  return true;
}

async function verifyFitViewport(browser, sessionId, output) {
  const evaluate = expression => browser.evaluate(expression, sessionId);
  const settle = () => evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
  const geometry = () => evaluate(`({width:innerWidth,height:innerHeight,
    scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,
    sidebar:!!document.getElementById('platformSelect').closest('aside'),
    frames:[...document.querySelectorAll('iframe')].map(frame=>({
      width:frame.contentWindow.innerWidth,height:frame.contentWindow.innerHeight,
      bounds:frame.getBoundingClientRect().toJSON()
    }))})`);
  const fits = result => result.sidebar && result.scrollWidth <= result.width + 1 && result.scrollHeight <= result.height + 1 &&
    result.frames.every(frame=>frame.bounds.width>0 && frame.bounds.height>0 && frame.bounds.x>=-1 && frame.bounds.y>=-1 &&
      frame.bounds.right<=result.width+1 && frame.bounds.bottom<=result.height+1);
  const cases = [];
  for (const [width,height] of [[1440,1000],[1366,768],[1024,600],[390,844]]) {
    await browser.call('Emulation.setDeviceMetricsOverride', {width,height,deviceScaleFactor:1,mobile:false},sessionId);
    for (const device of ['iphone','ipad']) {
      await evaluate(`touchEdit.select(${JSON.stringify({device,orientation:'both',fit:true})})`);
      await settle();
      const result = await geometry();
      if (!fits(result)) throw new Error(`Previews do not fit ${width}x${height} (${device}): ${JSON.stringify(result)}`);
      const sizes = ['landscape','portrait'].map(orientation=>viewport(device,orientation));
      if (!result.frames.every((frame,index)=>frame.width===sizes[index].width && frame.height===sizes[index].height))
        throw new Error('Fitting the previews changed their native viewport dimensions.');
      cases.push({device,...result});
    }
  }
  await browser.call('Emulation.setDeviceMetricsOverride', {width:1366,height:600,deviceScaleFactor:1,mobile:false},sessionId);
  await evaluate(`window.fitFrameReference=document.querySelector('iframe');document.getElementById('fitViewport').click()`);
  await settle();
  if (!await evaluate(`!touchEdit.inspect().selection.fit && location.search.includes('fit=0') && window.fitFrameReference===document.querySelector('iframe')`))
    throw new Error('Disabling fit did not retain the existing preview frames.');
  await evaluate(`window.scrollTo(0,120);document.getElementById('fitViewport').click()`);
  await settle();
  const fitted = await geometry();
  if (!fits(fitted)) throw new Error(`Re-enabling fit did not bring previews into the viewport: ${JSON.stringify(fitted)}`);
  const screenshot = await browser.call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false},sessionId);
  await writeFile(join(output,'fit-viewport.png'),Buffer.from(screenshot.data,'base64'));
  await browser.call('Emulation.setDeviceMetricsOverride', {width:1440,height:1000,deviceScaleFactor:1,mobile:false},sessionId);
  return {cases,screenshot:'fit-viewport.png',toggle:true,nativeViewportsPreserved:true};
}

async function verifyReview(browser, sessionId, base, platform, preset, definition, output) {
  await browser.call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false }, sessionId);
  const url = new URL('/', base);
  for (const [key,value] of Object.entries({ platform, preset, device: 'iphone', orientation: 'portrait', mode: 'review' })) url.searchParams.set(key,value);
  await openPage(browser, sessionId, url.href, 'touchEdit');
  const draft = { version: 1, snapshot: { sourcePlatform: platform, currentPresetId: 'stale-agent-draft', presets: [{
    id: 'stale-agent-draft', name: 'Stale draft', layout: { landscape: {rows:50,columns:50}, portrait: {rows:50,columns:50} }, elements: []
  }] } };
  await browser.evaluate(`localStorage.setItem('touch-controller-editor:draft:v1', ${JSON.stringify(JSON.stringify(draft))})`, sessionId);
  await openPage(browser, sessionId, url.href, 'touchEdit');
  const review = await browser.evaluate('window.touchEdit.inspect()', sessionId);
  if (review.selection.preset !== preset || review.previews[0].preset !== preset || review.previews[0].viewport.width !== 390)
    throw new Error('Review deep link did not select the real source preset.');
  const toolbarChecks = await browser.evaluate(`(async()=>{
    await touchEdit.select({fastui:false});
    const hidden = touchEdit.inspect().previews.every(preview=>!preview.fastButtons.some(button=>button.visible));
    await touchEdit.select({fastui:true});
    document.getElementById('showDisk').click();
    await touchEdit.ready;
    const diskVisible = touchEdit.inspect().previews.every(preview=>preview.fastButtons.some(button=>button.id==='fastdisk' && button.visible));
    document.getElementById('showDisk').click();
    await touchEdit.ready;
    return {hidden,diskVisible};
  })()`, sessionId);
  if (!toolbarChecks.hidden || toolbarChecks.diskVisible !== !!definition.multidisk) throw new Error('FastUI toggle or multi-disk preview failed.');
  const fitViewport = await verifyFitViewport(browser,sessionId,output);
  const keyboardTest = await verifyKeyboardTest(browser, sessionId);
  await browser.evaluate(`touchEdit.select(${JSON.stringify({platform,preset,device:'iphone',orientation:'portrait',keyboard:false})})`, sessionId);
  const editorUrl = await browser.evaluate('document.getElementById("editLink").href', sessionId);
  await openPage(browser, sessionId, editorUrl, 'touchEditor');
  await browser.evaluate('new Promise(resolve => setTimeout(resolve,350))', sessionId);
  const editor = await browser.evaluate(`({current: touchEditor.inspect().currentPresetId, saved: JSON.parse(localStorage.getItem('touch-controller-editor:draft:v1')).snapshot.currentPresetId})`, sessionId);
  if (editor.current !== preset || editor.saved !== 'stale-agent-draft') throw new Error('Opening the editor restored or overwrote the draft implicitly.');
  const restored = await browser.evaluate(`document.getElementById('restoreDraftBtn').click(); window.touchEditor.inspect().currentPresetId`, sessionId);
  if (restored !== 'stale-agent-draft') throw new Error('Explicit draft restore failed.');
  return { sourceDeepLink: true, reviewIgnoresDraft: true, editorPreservesDraft: true, explicitDraftRestore: true, fastUiToggle: true, multiDiskPreview: true, keyboardTest, fitViewport };
}

let server, browser, profile;
try {
  const executable = await findChrome();
  const output = resolve(repository, options.out);
  await mkdir(output, { recursive: true });
  server = await createServer({ configFile: fileURLToPath(new URL('vite.config.js', import.meta.url)),
    server: { host: '127.0.0.1', port: 0, strictPort: false, https: undefined, ws: false, open: false } });
  await server.listen();
  const base = `http://127.0.0.1:${server.httpServer.address().port}`;
  const catalog = await server.ssrLoadModule('/scripts/editor/platform-sources.js');
  const platforms = catalog.platformSources.filter(platform => !options.platform || platform.name === options.platform);
  if (!platforms.length) throw new Error(`Unknown platform: ${options.platform}`);
  profile = await mkdtemp(join(tmpdir(), 'vme-controller-check-'));
  browser = new Browser(executable, profile);
  await browser.call('Browser.getVersion');
  const { targetId } = await browser.call('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await browser.call('Target.attachToTarget', { targetId, flatten: true });
  await browser.call('Page.enable', {}, sessionId);
  const reports = [];
  let reviewChecks;
  for (const platform of platforms) {
    const controllers = await catalog.loadPlatformControllers(platform.path);
    const definition = await catalog.loadPlatformDefinition(platform.path);
    for (const preset of controllers.presets.filter(preset => !options.preset || preset.id === options.preset)) {
      if (!reviewChecks) reviewChecks = await verifyReview(browser, sessionId, base, platform.name, preset.id, definition, output);
      for (const device of selectedDevices) for (const orientation of orientations) {
        const size = viewport(device, orientation);
        await browser.call('Emulation.setDeviceMetricsOverride', { ...size, screenWidth: size.width, screenHeight: size.height, deviceScaleFactor: 1, mobile: true }, sessionId);
        await browser.call('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }, sessionId);
        const url = new URL('/frame.html', base);
        for (const [key, value] of Object.entries({ platform: platform.name, preset: preset.id, device, orientation })) url.searchParams.set(key, value);
        await openPage(browser, sessionId, url.href, 'touchPreview');
        const input = await browser.evaluate(exercise, sessionId);
        await browser.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))', sessionId);
        const report = await browser.evaluate('window.touchPreview.inspect()', sessionId);
        for (const [id, expected] of [['fastmenu', true], ['fastsave', !definition.savestates_disabled],
          ['fastffd', !definition.ffd_disabled], ['fastrewind', !definition.rewind_disabled]]) {
          if (report.fastButtons.some(button=>button.id===id && button.visible) !== expected)
            input.failures.push({phase:'fastui-platform',button:id,expected});
        }
        if (report.fastButtons.some(button=>/^fast\d+$/.test(button.id) && button.visible) && preset.hideAdditionalButtons === true)
          input.failures.push({phase:'fastui-additional-visibility'});
        const filename = `${platform.name}-${preset.id}-${device}-${orientation}`.replace(/[^a-zA-Z0-9_-]/g, '-');
        const screenshot = await browser.call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, sessionId);
        await writeFile(join(output, `${filename}.png`), Buffer.from(screenshot.data, 'base64'));
        reports.push({ ...report, device, input, screenshot: `${filename}.png`,
          reviewUrl: `/?platform=${encodeURIComponent(platform.name)}&preset=${encodeURIComponent(preset.id)}&device=${device}&orientation=${orientation}&mode=review` });
      }
      console.log(`${platform.name} / ${preset.id}: ${selectedDevices.length * orientations.length} views checked`);
    }
  }
  if (!reports.length) throw new Error(`No presets matched: ${options.preset}`);
  const errors = reports.reduce((total, report) => total + report.errors.length + report.findings.filter(f=>f.severity==='error').length + report.input.failures.length, 0);
  const warnings = reports.reduce((total, report) => total + report.findings.filter(f=>f.severity==='warning').length, 0);
  await writeFile(join(output, 'report.json'), JSON.stringify({ generatedAt: new Date().toISOString(), reviewChecks, views: reports.length, errors, warnings, reports }, null, 2) + '\n');
  console.log(`${reports.length} screenshots; ${errors} errors; ${warnings} warnings. Report: ${join(output, 'report.json')}`);
  process.exitCode = errors ? 1 : 0;
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
} finally {
  await browser?.close();
  await server?.close();
  if (profile) await rm(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
}
