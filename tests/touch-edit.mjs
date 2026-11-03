import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import { createServer } from 'vite';
import { parseArea, validateControllers, readRoute, writeRoute, viewport } from '../tools/touch-edit/scripts/review-model.js';
import { matchesKeyboardBinding, elementKeyboardBindings } from '../tools/touch-edit/scripts/keyboard-test.js';

const clone = value => JSON.parse(JSON.stringify(value));
const source = readFileSync(new URL('../tools/touch-edit/scripts/editor/import-export.js', import.meta.url), 'utf8');

function editor() {
    const state = { presets: [], controllerMetadata: {}, fastuiArea: {}, specialLabel: 'SPECIAL' };
    const inputs = Object.fromEntries(['output', 'specialLabel', 'fastuiLandscape', 'fastuiPortrait'].map(key => [key, { value: '' }]));
    const nodes = { ...inputs, exportSingle: { checked: false } };
    const context = vm.createContext({ window: {}, document: { getElementById: id => nodes[id] }, console: { log() {} } });
    vm.runInContext(source, context);
    const noop = () => {};
    const api = context.window.TouchEditorImportExport.createImportExportModule({
        state, inputs, cloneValue: clone,
        getCurrentPreset: () => state.presets.find(preset => preset.id === state.currentPresetId),
        showToast: noop, updateGlobalSettings: noop, updatePresetSelect: noop,
        updatePresetForm: noop, renderElementList: noop, renderGrids: noop,
        buildDefaultBinding: () => null,
    });
    return { api, state, inputs, nodes };
}

test('current VM/E platform configurations survive editor import and export', async () => {
    const server = await createServer({
        configFile: false,
        server: { middlewareMode: true, ws: false, watch: null },
        optimizeDeps: { noDiscovery: true, include: [] },
        appType: 'custom'
    });
    try {
        const catalog = await server.ssrLoadModule('/tools/touch-edit/scripts/editor/platform-sources.js');
        for (const name of ['Amiga', 'DOS', 'ST']) assert.ok(catalog.platformSources.some(platform => platform.name === name));
        for (const platform of catalog.platformSources) {
            const original = await catalog.loadPlatformControllers(platform.path);
            const { api, state } = editor();
            assert.equal(api.importConfigurationData(original, { replace: true, sourcePlatform: platform.name }), true);
            const output = clone(api.generateOutput());
            assert.equal(state.sourcePlatform, platform.name);
            assert.equal(output.presets.length, original.presets.length, platform.name);
            for (const key of Object.keys(original).filter(key => key !== 'presets')) {
                assert.deepEqual(output[key], original[key], `${platform.name}.${key}`);
            }
            original.presets.forEach((preset, index) => {
                const result = output.presets[index];
                for (const key of Object.keys(preset).filter(key => !['layouts', 'elements'].includes(key))) {
                    assert.deepEqual(result[key], preset[key], `${platform.name}.${preset.id}.${key}`);
                }
                assert.equal(result.elements.length, preset.elements.length);
                preset.elements.forEach((element, elementIndex) => {
                    for (const key of Object.keys(element)) {
                        assert.deepEqual(result.elements[elementIndex][key], element[key], `${platform.name}.${preset.id}.elements[${elementIndex}].${key}`);
                    }
                    assert.equal('editorUid' in result.elements[elementIndex], false);
                    assert.equal('areas' in result.elements[elementIndex], false);
                });
            });
            const before = clone(original);
            state.presets[0].name = 'Edited';
            assert.deepEqual(original, before, 'editor must not mutate platform sources');
        }
    } finally {
        await server.close();
    }
});

test('multiple layouts, metadata, null bindings and moved grid areas survive reimport', () => {
    const { api, state } = editor();
    const layout = { landscape: { columns: 50, rows: 50 }, portrait: { columns: 50, rows: 50 } };
    const element = {
        id: 'touchpad', component: 'TouchpadComponent', binding: null, customField: 'keep',
        gridArea: { landscape: '2 / 3 / span 4 / span 5', portrait: '6 / 7 / span 8 / span 9' },
        options: { style: 'filled', futureOption: true }
    };
    const preset = {
        id: 'test', hideAdditionalButtons: true, customField: 'preset metadata',
        defaultLayoutId: 'second', currentLayoutId: 'first',
        layouts: [
            { id: 'first', name: 'First', layout, elements: [element], customField: 'layout metadata' },
            { id: 'second', name: 'Second', layout, elements: [element] }
        ]
    };
    api.importConfigurationData({ focus_defaults: { test: false }, customField: 'config metadata', presets: [preset] }, { replace: true });
    state.presets[0].layouts[0].elements[0].areas.landscape.col = 10;
    const output = clone(api.generateOutput());
    assert.equal(output.customField, 'config metadata');
    assert.deepEqual(output.focus_defaults, { test: false });
    assert.equal('gameFocus' in output.presets[0], false, 'preserve focus_defaults fallback');
    assert.equal(output.presets[0].customField, 'preset metadata');
    assert.equal(output.presets[0].layouts[0].customField, 'layout metadata');
    assert.equal(output.presets[0].layouts[0].elements[0].gridArea.landscape, '2 / 11 / span 4 / span 5');
    assert.deepEqual(output.presets[0].elements[0], element, 'runtime fallback uses default layout');
    const next = editor();
    next.api.importConfigurationData(output, { replace: true });
    assert.deepEqual(clone(next.api.generateOutput()), output);
});

test('platform replacement resets settings and invalid imports keep the workspace', () => {
    const { api, state, inputs } = editor();
    const preset = { id: 'test', layouts: [{ id: 'one', elements: [] }] };
    api.importConfigurationData({ special_button: { label: 'CUSTOM' }, focus_defaults: { test: false }, presets: [preset] }, { replace: true });
    api.importConfigurationData({ presets: [preset] }, { replace: true });
    assert.equal(state.specialLabel, 'SPECIAL');
    assert.equal(inputs.specialLabel.value, 'SPECIAL');
    assert.equal('focus_defaults' in state.controllerMetadata, false);
    const before = clone(state);
    assert.equal(api.importConfigurationData({ presets: [{}] }, { replace: true }), false);
    assert.deepEqual(clone(state), before);
    api.importConfigurationData({ presets: [preset, preset] });
    assert.equal(new Set(state.presets.map(preset => preset.id)).size, state.presets.length);
});

test('review diagnostics detect runtime failures without treating overlaps as errors', () => {
    const element = { component: 'TripleTouchButton', binding: { type: 'keyboard' },
        gridArea: { landscape: '49 / 49 / span 4 / span 4', portrait: '1 / 1 / span 4 / span 4' } };
    const preset = { id: 'broken', layout: { landscape: { rows: 40, columns: 40 }, portrait: { rows: 50, columns: 50 } },
        elements: [element, { ...element, component: 'Unknown' }] };
    const findings = validateControllers({ presets: [preset, preset] });
    for (const code of ['binding-type', 'outside-grid', 'component', 'duplicate-preset'])
        assert.ok(findings.some(finding => finding.code === code && finding.severity === 'error'), code);
    assert.ok(findings.some(finding => finding.code === 'runtime-grid' && finding.severity === 'warning'));
    assert.ok(findings.some(finding => finding.code === 'overlap' && finding.severity === 'info'));
    assert.equal(parseArea('0 / 1 / span 4 / span 4'), null);
    assert.equal(parseArea('1/1/span 4/span 4'), null, 'do not silently accept a format the runtime rejects');
    assert.deepEqual(parseArea('1 / 2 / span 3 / span 4'), { row: 1, col: 2, rows: 3, cols: 4 });
});

test('review links preserve the selection and validate device/orientation', () => {
    const selection = { platform: 'Amiga', preset: 'amiga-worms', device: 'ipad', orientation: 'portrait', grid: true, fastui: true, disks: 1, keyboard: false, fit: true };
    const url = writeRoute(selection, 'http://localhost:8082/');
    assert.deepEqual(readRoute(url.search), selection);
    assert.deepEqual(viewport('iphone', 'portrait'), { width: 390, height: 844 });
    assert.deepEqual(viewport('ipad', 'landscape'), { width: 1080, height: 810 });
    assert.throws(() => readRoute('?device=unknown'), /Unknown device/);
    assert.throws(() => readRoute('?orientation=upside-down'), /Unknown orientation/);
    assert.throws(() => readRoute('?disks=0'), /Invalid disk count/);
    assert.throws(() => readRoute('?disks=2.5'), /Invalid disk count/);
    assert.deepEqual(readRoute(writeRoute({ ...selection, fastui: false, disks: 2 }, 'http://localhost:8082/').search),
        { ...selection, fastui: false, disks: 2 });
    assert.equal(readRoute(writeRoute({ ...selection, fit: false }, 'http://localhost:8082/').search).fit, false);
});

test('diagnostics allow runtime keyboard defaults and partial directional overrides', () => {
    const gridArea = { landscape: '1 / 1 / span 4 / span 4', portrait: '1 / 1 / span 4 / span 4' };
    const config = { presets: [{ id: 'defaults',
        layout: { landscape: { rows: 50, columns: 50 }, portrait: { rows: 50, columns: 50 } }, elements: [
            { component: 'SingleTouchButton', binding: { type: 'keyboard', key: { key: 'Enter', code: 'Enter' } }, gridArea },
            { component: 'QuickshotComponent', options: { mode: 'keyboard', keys: { up: { key: 'w' } } }, gridArea }
        ] }] };
    assert.equal(validateControllers(config).filter(finding => finding.severity !== 'info').length, 0);
    config.presets[0].elements[0].binding.key.keyCode = 88;
    assert.ok(validateControllers(config).some(finding => finding.code === 'keycode-mismatch'));
});

test('keyboard test matches physical codes, modifiers and legacy fallbacks', () => {
    const left = { code: 'ShiftLeft', key: 'Shift', keyCode: 16 };
    assert.equal(matchesKeyboardBinding({ code: 'ShiftLeft' }, [left]), true);
    assert.equal(matchesKeyboardBinding({ code: 'ShiftRight', keyCode: 16 }, [left]), false);
    assert.equal(matchesKeyboardBinding({ code: 'ArrowDown', keyCode: 88 }, [{ code: 'KeyX', key: 'x', keyCode: 88 }]), false);
    assert.equal(matchesKeyboardBinding({ keyCode: 13 }, [{ code: 'Enter', key: 'Enter', keyCode: 13 }]), true);
    assert.equal(matchesKeyboardBinding({ key: 'space' }, [{ key: ' ', keyCode: 0 }]), true);
    assert.equal(matchesKeyboardBinding({ code: 'KeyS', ctrlKey: true }, [{ code: 'KeyS' }], { ctrlKey: false }), false);
    assert.equal(matchesKeyboardBinding({ code: 'KeyS', ctrlKey: true }, [{ code: 'KeyS' }], { ctrlKey: true }), true);
});

test('keyboard test maps separate button parts and directional overrides', () => {
    const dual = elementKeyboardBindings({ component: 'DualTouchButton', binding: {
        type: 'keyboard', primary: { code: 'ArrowLeft' }, secondary: { code: 'ArrowRight' }
    } });
    assert.deepEqual(dual.map(binding => [binding.slot, binding.part]), [['primary', 0], ['secondary', 1]]);
    assert.equal(elementKeyboardBindings({ component: 'SingleTouchButton', binding: { type: 'joy', press: 'b' } }).length, 0);
    const quickshot = elementKeyboardBindings({ component: 'QuickshotComponent', options: { mode: 'keyboard', keys: { up: { key: 'w' } } } });
    assert.equal(quickshot.find(binding => binding.slot === 'up').mapping.code, 'KeyW');
    assert.equal(quickshot.find(binding => binding.slot === 'left').mapping.code, 'ArrowLeft');
    assert.equal(elementKeyboardBindings({ component: 'CursorKeysComponent' }).length, 4);
});
