import { platformSources, loadPlatformControllers } from './editor/platform-sources.js';
import { writeRoute } from './review-model.js';

(function() {
  if (!window.TouchEditorConstants) {
    throw new Error('TouchEditorConstants is not loaded. Include scripts/editor/constants.js before scripts/custom-controller-editor.js.');
  }

  if (!window.TouchEditorGridZoom || typeof window.TouchEditorGridZoom.initializeGridZoom !== 'function') {
    throw new Error('TouchEditorGridZoom is not loaded. Include scripts/editor/grid-zoom.js before scripts/custom-controller-editor.js.');
  }

  if (!window.TouchEditorImportExport || typeof window.TouchEditorImportExport.createImportExportModule !== 'function') {
    throw new Error('TouchEditorImportExport is not loaded. Include scripts/editor/import-export.js before scripts/custom-controller-editor.js.');
  }

  const {
    DEFAULT_PRESET,
    TOUCHPAD_DEFAULT_LABEL,
    QUICKSHOT_DEFAULT_LABEL,
    CURSOR_DEFAULT_LABEL,
    DEFAULT_CURSOR_KEYMAP,
    componentMeta,
    joyPropNames,
    keyboardPropNames,
    DEVICE_RATIOS
  } = window.TouchEditorConstants;

  const { initializeGridZoom } = window.TouchEditorGridZoom;

  const state = {
    controllerMetadata: {},
    sourcePlatform: null,
    specialLabel: 'SPECIAL',
    fastuiArea: {
      landscape: '1 / 1 / span 50 / span 50',
      portrait: '1 / 1 / span 50 / span 50'
    },
    presets: [],
    currentPresetId: null,
    selectedElementId: null,
    activeOrientation: 'landscape',
    dragging: null,
    viewMode: 'both',
    deviceRatio: 'iphone',
    keyCapture: {
      active: false,
      targetRow: null,
      button: null,
      escapeTimeout: null
    }
  };

  const refs = {
    landscapeGrid: document.getElementById('gridLandscape'),
    portraitGrid: document.getElementById('gridPortrait'),
    gridBoard: document.getElementById('gridBoard'),
    landscapePanel: document.getElementById('landscapePanel'),
    portraitPanel: document.getElementById('portraitPanel'),
    presetSelect: document.getElementById('presetSelect'),
    elementList: document.getElementById('elementList'),
    toast: document.getElementById('toast'),
    tabButtons: document.querySelectorAll('.tab-button'),
    tabPanels: document.querySelectorAll('.tab-panel'),
    labelFields: document.getElementById('labelFields'),
    optionsFields: document.getElementById('optionsFields'),
    bindingFields: document.getElementById('bindingFields'),
    bindingCustomContainer: document.getElementById('bindingCustomContainer'),
    activeOrientationStatus: document.getElementById('activeOrientationStatus'),
    activeOrientationValue: document.getElementById('activeOrientationValue'),
    deviceRatio: document.getElementById('deviceRatio'),
    elementSection: document.querySelector('section[data-role="element-editor"]')
  };

  const inputs = {
    specialLabel: document.getElementById('specialLabel'),
    fastuiLandscape: document.getElementById('fastuiLandscape'),
    fastuiPortrait: document.getElementById('fastuiPortrait'),
    presetId: document.getElementById('presetId'),
    presetName: document.getElementById('presetName'),
    presetDescription: document.getElementById('presetDescription'),
    presetGameFocus: document.getElementById('presetGameFocus'),
    presetHideAdditionalButtons: document.getElementById('presetHideAdditionalButtons'),
    layoutSelect: document.getElementById('layoutSelect'),
    landscapeCols: document.getElementById('landscapeCols'),
    landscapeRows: document.getElementById('landscapeRows'),
    portraitCols: document.getElementById('portraitCols'),
    portraitRows: document.getElementById('portraitRows'),
    elementComponent: document.getElementById('elementComponent'),
    layoutTarget: document.getElementById('layoutTarget'),
    bindingType: document.getElementById('bindingType'),
    bindingCustom: document.getElementById('bindingCustom'),
    importData: document.getElementById('importData'),
    fileInput: document.getElementById('fileInput'),
    output: document.getElementById('output'),
    exportSingle: document.getElementById('exportSingle'),
    exportAll: document.getElementById('exportAll')
  };

  const buttons = {
    undo: document.getElementById('undoBtn'),
    redo: document.getElementById('redoBtn'),
    clearDraft: document.getElementById('clearDraftBtn'),
    newPreset: document.getElementById('newPresetBtn'),
    deletePreset: document.getElementById('deletePresetBtn'),
    newLayout: document.getElementById('newLayoutBtn'),
    duplicateLayout: document.getElementById('duplicateLayoutBtn'),
    renameLayout: document.getElementById('renameLayoutBtn'),
    deleteLayout: document.getElementById('deleteLayoutBtn'),
    savePreset: document.getElementById('savePresetBtn'),
    addElement: document.getElementById('addElementBtn'),
    updateElement: document.getElementById('updateElementBtn'),
    deleteElement: document.getElementById('deleteElementBtn'),
    alignLeft: document.getElementById('alignLeftBtn'),
    alignCenterX: document.getElementById('alignCenterXBtn'),
    alignRight: document.getElementById('alignRightBtn'),
    alignTop: document.getElementById('alignTopBtn'),
    alignMiddle: document.getElementById('alignMiddleBtn'),
    alignBottom: document.getElementById('alignBottomBtn'),
    distributeHorizontal: document.getElementById('distributeHorizontalBtn'),
    distributeVertical: document.getElementById('distributeVerticalBtn'),
    copyLandscapeToPortrait: document.getElementById('copyLandscapeToPortraitBtn'),
    copyPortraitToLandscape: document.getElementById('copyPortraitToLandscapeBtn'),
    import: document.getElementById('importBtn'),
    clearImport: document.getElementById('clearImportBtn'),
    loadFile: document.getElementById('loadFileBtn'),
    generate: document.getElementById('generateBtn'),
    copy: document.getElementById('copyBtn'),
    showBoth: document.getElementById('showBothBtn'),
    showLandscape: document.getElementById('showLandscapeBtn'),
    showPortrait: document.getElementById('showPortraitBtn'),
    toggleActiveOrientation: document.getElementById('toggleActiveOrientationBtn')
  };

  const AUTOSAVE_STORAGE_KEY = 'touch-controller-editor:draft:v1';
  let canAutosave = false;
  const HISTORY_LIMIT = 50;
  const DEFAULT_LAYOUT_NAME = 'Layout 1';
  const GRID_DEFAULT_SIZE = 50;
  const historyState = {
    undoStack: [],
    redoStack: [],
    isApplyingSnapshot: false,
    autosaveTimer: null
  };

  function generateElementRuntimeId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return `el-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function ensureElementRuntimeData(element, options = {}) {
    if (!element || typeof element !== 'object') {
      return null;
    }

    if (typeof element.id === 'string' && element.id.trim()) {
      element.editorLegacyId = element.editorLegacyId || element.id.trim();
    }
    delete element.id;

    const usedIds = options.usedIds instanceof Set ? options.usedIds : null;
    let runtimeId = typeof element.editorUid === 'string' && element.editorUid.trim()
      ? element.editorUid.trim()
      : '';

    if (!runtimeId || (usedIds && usedIds.has(runtimeId))) {
      do {
        runtimeId = generateElementRuntimeId();
      } while (usedIds && usedIds.has(runtimeId));
    }

    element.editorUid = runtimeId;
    if (usedIds) {
      usedIds.add(runtimeId);
    }

    return element;
  }

  function normalizeElementCollection(elements) {
    if (!Array.isArray(elements)) {
      return [];
    }

    const usedIds = new Set();
    return elements
      .filter(element => !!element && typeof element === 'object')
      .map(element => ensureElementRuntimeData(element, { usedIds }));
  }

  function getElementRuntimeId(element) {
    const normalized = ensureElementRuntimeData(element);
    return normalized ? normalized.editorUid : '';
  }

  function getDefaultElementLabels(component) {
    const meta = componentMeta[component] || componentMeta.SingleTouchButton;
    if (meta.count === 0) {
      return [];
    }
    return Array.from(
      { length: meta.count },
      (_, index) => (meta.count === 1 ? 'Button' : `BTN${index + 1}`)
    );
  }

  function getDefaultElementTitle(component) {
    if (component === 'TouchpadComponent') return TOUCHPAD_DEFAULT_LABEL;
    if (component === 'QuickshotComponent') return QUICKSHOT_DEFAULT_LABEL;
    if (component === 'CursorKeysComponent') return CURSOR_DEFAULT_LABEL;
    return getDefaultElementLabels(component)[0] || 'Element';
  }

  function getElementDisplayTitle(element) {
    if (!element) {
      return 'Element';
    }

    if (element.component === 'TouchpadComponent') {
      const hasExplicitLabel = element.options && Object.prototype.hasOwnProperty.call(element.options, 'label');
      const explicitLabel = hasExplicitLabel ? (element.options.label ?? '').trim() : '';
      return explicitLabel || TOUCHPAD_DEFAULT_LABEL;
    }

    if (element.component === 'QuickshotComponent') {
      const hasExplicitLabel = element.options && Object.prototype.hasOwnProperty.call(element.options, 'label');
      const explicitLabel = hasExplicitLabel ? (element.options.label ?? '').trim() : '';
      return explicitLabel || QUICKSHOT_DEFAULT_LABEL;
    }

    if (element.component === 'CursorKeysComponent') {
      return CURSOR_DEFAULT_LABEL;
    }

    if (Array.isArray(element.labels) && element.labels.length) {
      return element.labels.join('/');
    }

    if (typeof element.label === 'string' && element.label.trim()) {
      return element.label.trim();
    }

    return getDefaultElementTitle(element.component);
  }

  function findElementBySelectionId(elements, selectionId) {
    if (!selectionId || !Array.isArray(elements)) {
      return null;
    }

    return elements.find(element => {
      const runtimeId = getElementRuntimeId(element);
      return runtimeId === selectionId || element.editorLegacyId === selectionId;
    }) || null;
  }

  function parseGridSize(value, fallback = GRID_DEFAULT_SIZE) {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  function normalizeLayoutDimensions(layout) {
    return {
      landscape: {
        columns: parseGridSize(layout?.landscape?.columns),
        rows: parseGridSize(layout?.landscape?.rows)
      },
      portrait: {
        columns: parseGridSize(layout?.portrait?.columns),
        rows: parseGridSize(layout?.portrait?.rows)
      }
    };
  }

  function normalizeLayoutVariant(rawLayoutVariant, index = 0) {
    const normalized = rawLayoutVariant && typeof rawLayoutVariant === 'object'
      ? rawLayoutVariant
      : {};
    const fallbackId = `layout-${index + 1}`;
    const id = typeof normalized.id === 'string' && normalized.id.trim()
      ? normalized.id.trim()
      : fallbackId;
    const name = typeof normalized.name === 'string' && normalized.name.trim()
      ? normalized.name.trim()
      : `Layout ${index + 1}`;
    const dimensionsSource = normalized.layout && typeof normalized.layout === 'object'
      ? normalized.layout
      : normalized;

    return {
      ...normalized,
      id,
      name,
      layout: normalizeLayoutDimensions(dimensionsSource),
      elements: normalizeElementCollection(Array.isArray(normalized.elements) ? normalized.elements : [])
    };
  }

  function createLayoutVariant({ id, name, layout, elements } = {}) {
    return {
      id: typeof id === 'string' && id.trim() ? id.trim() : 'layout-1',
      name: typeof name === 'string' && name.trim() ? name.trim() : DEFAULT_LAYOUT_NAME,
      layout: normalizeLayoutDimensions(layout),
      elements: normalizeElementCollection(Array.isArray(elements) ? cloneValue(elements) : [])
    };
  }

  function applyPresetLayoutAlias(preset, targetLayoutId) {
    if (!preset || !Array.isArray(preset.layouts) || !preset.layouts.length) {
      return null;
    }

    const activeLayout = preset.layouts.find(layout => layout.id === targetLayoutId) || preset.layouts[0];
    preset.currentLayoutId = activeLayout.id;
    preset.layout = activeLayout.layout;
    preset.elements = activeLayout.elements;
    return activeLayout;
  }

  function ensurePresetLayoutModel(preset) {
    if (!preset || typeof preset !== 'object') {
      return null;
    }

    const normalizedLayouts = [];
    const seenIds = new Set();
    const sourceLayouts = Array.isArray(preset.layouts) ? preset.layouts : [];

    if (sourceLayouts.length) {
      sourceLayouts.forEach((rawLayout, index) => {
        const normalized = normalizeLayoutVariant(rawLayout, index);
        let uniqueId = normalized.id;
        let suffix = 2;
        while (seenIds.has(uniqueId)) {
          uniqueId = `${normalized.id}-${suffix}`;
          suffix += 1;
        }
        normalized.id = uniqueId;
        seenIds.add(uniqueId);
        normalizedLayouts.push(normalized);
      });
    } else {
      normalizedLayouts.push(createLayoutVariant({
        id: 'layout-1',
        name: DEFAULT_LAYOUT_NAME,
        layout: preset.layout,
        elements: preset.elements
      }));
    }

    preset.layouts = normalizedLayouts;

    const availableIds = new Set(preset.layouts.map(layout => layout.id));
    preset.defaultLayoutId = typeof preset.defaultLayoutId === 'string' && availableIds.has(preset.defaultLayoutId)
      ? preset.defaultLayoutId
      : preset.layouts[0].id;
    const targetLayoutId = typeof preset.currentLayoutId === 'string' && availableIds.has(preset.currentLayoutId)
      ? preset.currentLayoutId
      : preset.defaultLayoutId;

    applyPresetLayoutAlias(preset, targetLayoutId);
    return preset;
  }

  function ensureAllPresetsLayoutModel() {
    if (!Array.isArray(state.presets)) {
      state.presets = [];
      return;
    }
    state.presets = state.presets
      .filter(preset => preset && typeof preset === 'object')
      .map(preset => ensurePresetLayoutModel(preset));
  }

  function getCurrentLayoutEntry(preset = getCurrentPreset()) {
    const normalizedPreset = ensurePresetLayoutModel(preset);
    if (!normalizedPreset) {
      return null;
    }
    return applyPresetLayoutAlias(normalizedPreset, normalizedPreset.currentLayoutId);
  }

  function getUniqueLayoutId(preset, base = 'layout') {
    const used = new Set((preset.layouts || []).map(layout => layout.id));
    let index = 1;
    let candidate = `${base}-${index}`;
    while (used.has(candidate)) {
      index += 1;
      candidate = `${base}-${index}`;
    }
    return candidate;
  }

  function getUniqueLayoutName(preset, base = 'Layout') {
    const used = new Set((preset.layouts || []).map(layout => layout.name));
    let index = 1;
    let candidate = `${base} ${index}`;
    while (used.has(candidate)) {
      index += 1;
      candidate = `${base} ${index}`;
    }
    return candidate;
  }

  function updateElementButtonsState() {
    const preset = getCurrentPreset();
    if (!preset) {
      if (buttons.updateElement) buttons.updateElement.disabled = true;
      if (buttons.deleteElement) buttons.deleteElement.disabled = true;
      updateLayoutButtonsState();
      return;
    }

    const hasSelection = !!state.selectedElementId;
    if (buttons.updateElement) buttons.updateElement.disabled = !hasSelection;
    if (buttons.deleteElement) buttons.deleteElement.disabled = !hasSelection;
    updateLayoutButtonsState();
  }

  function updateLayoutButtonsState() {
    const preset = getCurrentPreset();
    const hasPreset = !!preset;
    const hasSelection = !!state.selectedElementId;
    const targetMode = inputs.layoutTarget && inputs.layoutTarget.value === 'all' ? 'all' : 'selected';
    const targetCount = hasPreset
      ? (targetMode === 'all' ? (preset.elements ? preset.elements.length : 0) : (hasSelection ? 1 : 0))
      : 0;

    const alignButtons = [
      buttons.alignLeft,
      buttons.alignCenterX,
      buttons.alignRight,
      buttons.alignTop,
      buttons.alignMiddle,
      buttons.alignBottom
    ];
    const distributeButtons = [
      buttons.distributeHorizontal,
      buttons.distributeVertical
    ];
    const copyButtons = [
      buttons.copyLandscapeToPortrait,
      buttons.copyPortraitToLandscape
    ];

    alignButtons.forEach(btn => {
      if (btn) btn.disabled = !hasPreset || targetCount < 1;
    });
    distributeButtons.forEach(btn => {
      if (btn) btn.disabled = !hasPreset || targetCount < 2;
    });
    copyButtons.forEach(btn => {
      if (btn) btn.disabled = !hasPreset || !hasSelection;
    });
  }

  function updateLayoutVariantButtonsState() {
    const preset = getCurrentPreset();
    const hasPreset = !!preset;
    const layoutCount = hasPreset && Array.isArray(preset.layouts) ? preset.layouts.length : 0;
    if (inputs.layoutSelect) {
      inputs.layoutSelect.disabled = !hasPreset;
    }
    if (buttons.newLayout) buttons.newLayout.disabled = !hasPreset;
    if (buttons.duplicateLayout) buttons.duplicateLayout.disabled = !hasPreset;
    if (buttons.renameLayout) buttons.renameLayout.disabled = !hasPreset;
    if (buttons.deleteLayout) buttons.deleteLayout.disabled = !hasPreset || layoutCount <= 1;
  }

  const presetDetailInputs = [
    inputs.presetId,
    inputs.presetName,
    inputs.presetDescription,
    inputs.presetGameFocus,
    inputs.presetHideAdditionalButtons,
    inputs.layoutSelect,
    inputs.landscapeCols,
    inputs.landscapeRows,
    inputs.portraitCols,
    inputs.portraitRows
  ];

  const elementEditorInputs = [
    inputs.elementComponent,
    inputs.bindingType,
    inputs.bindingCustom
  ];

  function toggleContainerInputs(container, enabled) {
    if (!container) return;
    container.querySelectorAll('input, select, textarea, button').forEach(el => {
      el.disabled = !enabled;
    });
  }

  function setGridEditable(enabled) {
    document.querySelectorAll('.grid-stage').forEach(stage => {
      stage.classList.toggle('disabled', !enabled);
    });
  }

  function setPresetDependentUiEnabled(enabled) {
    presetDetailInputs.forEach(input => {
      if (input) input.disabled = !enabled;
    });

    elementEditorInputs.forEach(input => {
      if (input) input.disabled = !enabled;
    });

    toggleContainerInputs(refs.labelFields, enabled);
    toggleContainerInputs(refs.optionsFields, enabled);
    toggleContainerInputs(refs.bindingFields, enabled);
    toggleContainerInputs(refs.bindingCustomContainer, enabled);

    [
      buttons.savePreset,
      buttons.deletePreset,
      buttons.newLayout,
      buttons.duplicateLayout,
      buttons.renameLayout,
      buttons.deleteLayout,
      buttons.addElement,
      buttons.updateElement,
      buttons.deleteElement
    ].forEach(btn => {
      if (btn) btn.disabled = !enabled;
    });

    if (refs.elementSection) {
      refs.elementSection.classList.toggle('disabled', !enabled);
    }

    setGridEditable(enabled);
    updateLayoutVariantButtonsState();
    updateElementButtonsState();
  }

  function showToast(message, duration = 1600) {
    refs.toast.textContent = message;
    refs.toast.classList.add('show');
    setTimeout(() => refs.toast.classList.remove('show'), duration);
  }

  function setActiveTab(tab) {
    refs.tabButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
    refs.tabPanels.forEach(panel => panel.classList.toggle('active', panel.dataset.tab === tab));
  }

  function setViewMode(mode) {
    state.viewMode = mode;
    if (mode === 'landscape' || mode === 'portrait') {
      state.activeOrientation = mode;
    }

    // Update button states
    buttons.showBoth.classList.toggle('active', mode === 'both');
    buttons.showLandscape.classList.toggle('active', mode === 'landscape');
    buttons.showPortrait.classList.toggle('active', mode === 'portrait');

    // Update grid layout and visibility
    refs.gridBoard.classList.toggle('dual-view', mode === 'both');
    refs.landscapePanel.classList.toggle('hidden', mode === 'portrait');
    refs.portraitPanel.classList.toggle('hidden', mode === 'landscape');
    updateActiveOrientationUi();
  }

  function setDeviceRatio(ratio) {
    state.deviceRatio = ratio;
    refs.deviceRatio.value = ratio;
    updateGridAspectRatios();
  }

  function updateGridAspectRatios() {
    const ratio = DEVICE_RATIOS[state.deviceRatio];
    const preset = getCurrentPreset();
    const landscapeCols = preset?.layout?.landscape?.columns ?? GRID_DEFAULT_SIZE;
    const landscapeRows = preset?.layout?.landscape?.rows ?? GRID_DEFAULT_SIZE;
    const portraitCols = preset?.layout?.portrait?.columns ?? GRID_DEFAULT_SIZE;
    const portraitRows = preset?.layout?.portrait?.rows ?? GRID_DEFAULT_SIZE;

    // Update landscape grid
    const landscapeStage = refs.landscapePanel.querySelector('.grid-stage');
    const landscapeRatio = ratio.landscape.width / ratio.landscape.height;
    landscapeStage.style.aspectRatio = `${ratio.landscape.width} / ${ratio.landscape.height}`;

    // Update portrait grid
    const portraitStage = refs.portraitPanel.querySelector('.grid-stage');
    const portraitRatio = ratio.portrait.width / ratio.portrait.height;
    portraitStage.style.aspectRatio = `${ratio.portrait.width} / ${ratio.portrait.height}`;

    // Update headers to show current ratio
    const landscapeHeader = refs.landscapePanel.querySelector('h3');
    const portraitHeader = refs.portraitPanel.querySelector('h3');

    landscapeHeader.textContent = `Landscape (${landscapeCols}×${landscapeRows}) - ${ratio.landscape.width}:${ratio.landscape.height}`;
    portraitHeader.textContent = `Portrait (${portraitCols}×${portraitRows}) - ${ratio.portrait.width}:${ratio.portrait.height}`;
  }

  function handleKeyDown(event) {
    if (state.keyCapture.active) {
      return;
    }

    // Only handle shortcuts when not typing in input fields
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
      return;
    }

    const isModifierPressed = event.metaKey || event.ctrlKey;
    if (isModifierPressed && !event.altKey) {
      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undoStateChange();
        return;
      }

      if (key === 'y' || (key === 'z' && event.shiftKey)) {
        event.preventDefault();
        redoStateChange();
        return;
      }
    }

    if (!isModifierPressed) {
      if (event.key === 'o' || event.key === 'O') {
        toggleActiveOrientationForEditing();
        scheduleAutosave();
        showToast(`Active edit orientation: ${formatOrientationLabel(getActiveOrientationForKeyboard())}`, 900);
        event.preventDefault();
        return;
      }

      const step = event.shiftKey ? 5 : 1;
      let moved = false;
      if (event.key === 'ArrowLeft') moved = nudgeSelectedElement(-step, 0);
      else if (event.key === 'ArrowRight') moved = nudgeSelectedElement(step, 0);
      else if (event.key === 'ArrowUp') moved = nudgeSelectedElement(0, -step);
      else if (event.key === 'ArrowDown') moved = nudgeSelectedElement(0, step);

      if (moved) {
        event.preventDefault();
        return;
      }
    }

    if (event.key === 'd' || event.key === 'D') {
      event.preventDefault();
      showDimensionDialog();
    }
  }

  function nudgeSelectedElement(deltaCol, deltaRow) {
    const preset = getCurrentPreset();
    if (!preset || !state.selectedElementId) {
      return false;
    }

    const element = getElementById(state.selectedElementId);
    if (!element) {
      return false;
    }

    const orientation = getActiveOrientationForKeyboard();
    const layout = preset.layout[orientation];
    const area = element.areas[orientation];
    if (!layout || !area) {
      return false;
    }

    const nextCol = clamp(area.col + deltaCol, 0, layout.columns - area.colSpan);
    const nextRow = clamp(area.row + deltaRow, 0, layout.rows - area.rowSpan);
    const moved = nextCol !== area.col || nextRow !== area.row;
    if (moved) {
      area.col = nextCol;
      area.row = nextRow;
    }

    if (!moved) {
      return false;
    }

    updateGridElementPosition(getElementRuntimeId(element));
    commitStateChange();
    return true;
  }

  function getActiveOrientationForKeyboard() {
    if (state.viewMode === 'landscape' || state.viewMode === 'portrait') {
      return state.viewMode;
    }

    return state.activeOrientation === 'portrait' ? 'portrait' : 'landscape';
  }

  function getLayoutTargetElements() {
    const preset = getCurrentPreset();
    if (!preset || !Array.isArray(preset.elements)) {
      return [];
    }

    if (inputs.layoutTarget && inputs.layoutTarget.value === 'all') {
      return preset.elements.slice();
    }

    if (!state.selectedElementId) {
      return [];
    }

    const selected = getElementById(state.selectedElementId);
    return selected ? [selected] : [];
  }

  function refreshLayoutElements(elements) {
    const updatedIds = new Set();
    elements.forEach(element => {
      const runtimeId = getElementRuntimeId(element);
      if (!element || !runtimeId || updatedIds.has(runtimeId)) {
        return;
      }
      updatedIds.add(runtimeId);
      updateGridElementPosition(runtimeId);
    });
    highlightSelectedElement();
    updateLayoutButtonsState();
  }

  function alignElements(mode) {
    const preset = getCurrentPreset();
    if (!preset) {
      showToast('Create or select a preset first', 1800);
      return;
    }

    const orientation = getActiveOrientationForKeyboard();
    const layout = preset.layout[orientation];
    if (!layout) {
      showToast('Missing layout for active orientation', 1800);
      return;
    }

    const elements = getLayoutTargetElements();
    if (!elements.length) {
      showToast('Select an element or switch target to all', 1800);
      return;
    }

    let changed = false;
    elements.forEach(element => {
      const area = element.areas && element.areas[orientation];
      if (!area) return;

      let nextCol = area.col;
      let nextRow = area.row;
      if (mode === 'left') nextCol = 0;
      else if (mode === 'centerX') nextCol = Math.round((layout.columns - area.colSpan) / 2);
      else if (mode === 'right') nextCol = layout.columns - area.colSpan;
      else if (mode === 'top') nextRow = 0;
      else if (mode === 'middle') nextRow = Math.round((layout.rows - area.rowSpan) / 2);
      else if (mode === 'bottom') nextRow = layout.rows - area.rowSpan;

      nextCol = clamp(nextCol, 0, layout.columns - area.colSpan);
      nextRow = clamp(nextRow, 0, layout.rows - area.rowSpan);
      if (nextCol !== area.col || nextRow !== area.row) {
        area.col = nextCol;
        area.row = nextRow;
        changed = true;
      }
    });

    if (!changed) {
      showToast('No alignment changes', 900);
      return;
    }

    refreshLayoutElements(elements);
    commitStateChange();
    showToast(`Aligned ${elements.length} element(s)`);
  }

  function distributeElements(axis) {
    const preset = getCurrentPreset();
    if (!preset) {
      showToast('Create or select a preset first', 1800);
      return;
    }

    const orientation = getActiveOrientationForKeyboard();
    const layout = preset.layout[orientation];
    if (!layout) {
      showToast('Missing layout for active orientation', 1800);
      return;
    }

    const elements = getLayoutTargetElements();
    if (elements.length < 2) {
      showToast('Need at least 2 target elements', 1800);
      return;
    }

    const entries = elements
      .map(element => ({ element, area: element.areas && element.areas[orientation] }))
      .filter(entry => !!entry.area);
    if (entries.length < 2) {
      showToast('Need at least 2 target elements', 1800);
      return;
    }

    const isHorizontal = axis === 'horizontal';
    entries.sort((a, b) => (isHorizontal ? a.area.col - b.area.col : a.area.row - b.area.row));

    const axisLimit = isHorizontal ? layout.columns : layout.rows;
    const totalSpan = entries.reduce((sum, entry) => sum + (isHorizontal ? entry.area.colSpan : entry.area.rowSpan), 0);
    const freeSpace = Math.max(0, axisLimit - totalSpan);
    const gap = entries.length > 1 ? (freeSpace / (entries.length - 1)) : 0;

    let cursor = 0;
    let changed = false;
    entries.forEach(entry => {
      const area = entry.area;
      const span = isHorizontal ? area.colSpan : area.rowSpan;
      const max = isHorizontal
        ? (layout.columns - area.colSpan)
        : (layout.rows - area.rowSpan);
      const next = clamp(Math.round(cursor), 0, max);
      if (isHorizontal) {
        if (next !== area.col) {
          area.col = next;
          changed = true;
        }
      } else if (next !== area.row) {
        area.row = next;
        changed = true;
      }
      cursor += span + gap;
    });

    if (!changed) {
      showToast('No distribution changes', 900);
      return;
    }

    refreshLayoutElements(elements);
    commitStateChange();
    showToast(`Distributed ${elements.length} element(s)`);
  }

  function copyElementPositionBetweenOrientations(fromOrientation, toOrientation) {
    const preset = getCurrentPreset();
    if (!preset) {
      showToast('Create or select a preset first', 1800);
      return;
    }

    if (!state.selectedElementId) {
      showToast('Select an element first', 1800);
      return;
    }

    const element = getElementById(state.selectedElementId);
    if (!element) {
      showToast('Selected element not found', 1800);
      return;
    }

    const fromArea = element.areas && element.areas[fromOrientation];
    const toArea = element.areas && element.areas[toOrientation];
    const toLayout = preset.layout[toOrientation];
    if (!fromArea || !toArea || !toLayout) {
      showToast('Missing orientation data on selected element', 1800);
      return;
    }

    const nextCol = clamp(fromArea.col, 0, toLayout.columns - toArea.colSpan);
    const nextRow = clamp(fromArea.row, 0, toLayout.rows - toArea.rowSpan);
    if (nextCol === toArea.col && nextRow === toArea.row) {
      showToast('No position changes', 900);
      return;
    }

    toArea.col = nextCol;
    toArea.row = nextRow;
    refreshLayoutElements([element]);
    commitStateChange();
    showToast(`Copied position: ${formatOrientationLabel(fromOrientation)} -> ${formatOrientationLabel(toOrientation)}`);
  }

  function formatOrientationLabel(orientation) {
    return orientation === 'portrait' ? 'Portrait' : 'Landscape';
  }

  function updateActiveOrientationUi() {
    const activeOrientation = getActiveOrientationForKeyboard();

    if (refs.activeOrientationStatus) {
      refs.activeOrientationStatus.dataset.orientation = activeOrientation;
    }

    if (refs.activeOrientationValue) {
      refs.activeOrientationValue.textContent = formatOrientationLabel(activeOrientation);
      refs.activeOrientationValue.dataset.orientation = activeOrientation;
    }

    refs.landscapePanel.classList.toggle('active-edit', activeOrientation === 'landscape');
    refs.portraitPanel.classList.toggle('active-edit', activeOrientation === 'portrait');
  }

  function setActiveOrientation(orientation) {
    state.activeOrientation = orientation === 'portrait' ? 'portrait' : 'landscape';
    updateActiveOrientationUi();
  }

  function toggleActiveOrientationForEditing() {
    if (state.viewMode === 'landscape') {
      setViewMode('portrait');
      return;
    }

    if (state.viewMode === 'portrait') {
      setViewMode('landscape');
      return;
    }

    const next = state.activeOrientation === 'portrait' ? 'landscape' : 'portrait';
    setActiveOrientation(next);
  }

  function showDimensionDialog() {
    if (!state.selectedElementId) {
      showToast('Select an element first');
      return;
    }

    const element = getElementById(state.selectedElementId);
    if (!element) {
      showToast('Selected element not found');
      return;
    }

    // Get current dimensions for both orientations
    const landscapeDim = element.areas.landscape;
    const portraitDim = element.areas.portrait;
    const currentLandscape = `${landscapeDim.colSpan}x${landscapeDim.rowSpan}`;
    const currentPortrait = `${portraitDim.colSpan}x${portraitDim.rowSpan}`;

    const input = prompt(
      `Resize "${getElementDisplayTitle(element)}":\n\nCurrent dimensions:\n- Landscape: ${currentLandscape}\n- Portrait: ${currentPortrait}\n\nEnter new dimensions (e.g., "5x3", "5,3" or "5x3,4x6" for different orientations):`,
      currentLandscape
    );

    if (input === null || input.trim() === '') {
      return; // User cancelled
    }

    parseDimensionInput(input.trim());
  }

  function parseDimensionInput(input) {
    const element = getElementById(state.selectedElementId);
    if (!element) return;

    try {
      let landscapeDim = null;
      let portraitDim = null;

      // Check if input contains comma (different dimensions for orientations)
      if (input.includes(',') && input.split(',').length === 2) {
        const [landscapeStr, portraitStr] = input.split(',').map(s => s.trim());
        landscapeDim = parseSingleDimension(landscapeStr);
        portraitDim = parseSingleDimension(portraitStr);
      } else {
        // Same dimensions for both orientations
        const dim = parseSingleDimension(input);
        landscapeDim = dim;
        portraitDim = dim;
      }

      if (landscapeDim && portraitDim) {
        applyDimensions(element, landscapeDim, portraitDim);
      } else {
        showToast('Invalid dimension format. Use "5x3", "5,3" or "5x3,4x6"');
      }
    } catch (error) {
      showToast('Error parsing dimensions: ' + error.message);
    }
  }

  function parseSingleDimension(dimStr) {
    // Support formats: "5x3", "5*3", "5,3", "5 3"
    const separators = /[x*×,\s]+/;
    const parts = dimStr.split(separators).filter(p => p.length > 0);

    if (parts.length !== 2) {
      throw new Error(`Invalid format: ${dimStr}`);
    }

    const colSpan = parseInt(parts[0], 10);
    const rowSpan = parseInt(parts[1], 10);

    if (isNaN(colSpan) || isNaN(rowSpan) || colSpan < 1 || rowSpan < 1) {
      throw new Error(`Invalid numbers: ${dimStr}`);
    }

    if (colSpan > 50 || rowSpan > 50) {
      throw new Error(`Dimensions too large (max 50): ${dimStr}`);
    }

    return { colSpan, rowSpan };
  }

  function applyDimensions(element, landscapeDim, portraitDim) {
    const preset = getCurrentPreset();
    if (!preset) return;

    // Update landscape dimensions
    const landscapeArea = element.areas.landscape;
    const maxLandscapeCol = preset.layout.landscape.columns - landscapeDim.colSpan;
    const maxLandscapeRow = preset.layout.landscape.rows - landscapeDim.rowSpan;

    landscapeArea.colSpan = landscapeDim.colSpan;
    landscapeArea.rowSpan = landscapeDim.rowSpan;
    landscapeArea.col = Math.min(landscapeArea.col, Math.max(0, maxLandscapeCol));
    landscapeArea.row = Math.min(landscapeArea.row, Math.max(0, maxLandscapeRow));

    // Update portrait dimensions
    const portraitArea = element.areas.portrait;
    const maxPortraitCol = preset.layout.portrait.columns - portraitDim.colSpan;
    const maxPortraitRow = preset.layout.portrait.rows - portraitDim.rowSpan;

    portraitArea.colSpan = portraitDim.colSpan;
    portraitArea.rowSpan = portraitDim.rowSpan;
    portraitArea.col = Math.min(portraitArea.col, Math.max(0, maxPortraitCol));
    portraitArea.row = Math.min(portraitArea.row, Math.max(0, maxPortraitRow));

    // Update UI
    populateElementForm(element);
    renderGrids();
    showToast(`Element resized to ${landscapeDim.colSpan}×${landscapeDim.rowSpan} (landscape), ${portraitDim.colSpan}×${portraitDim.rowSpan} (portrait)`);
    commitStateChange();
  }

  function startKeyCapture(prop, evt) {
    if (state.keyCapture.active) return;

    const row = refs.bindingFields.querySelector(`.binding-row[data-prop="${prop}"]`);
    if (!row) return;
    beginKeyCapture(row, evt?.currentTarget || evt?.target || null);
  }

  function startCursorKeyCapture(row, button) {
    if (state.keyCapture.active) return;
    beginKeyCapture(row, button);
  }

  function beginKeyCapture(row, button) {
    state.keyCapture = {
      active: true,
      targetRow: row,
      button: button,
      escapeTimeout: null
    };

    if (button) {
      if (!button.dataset.defaultText) {
        button.dataset.defaultText = button.textContent;
      }
      button.classList.add('capturing');
      button.textContent = 'Press any key...';
    }

    showToast('Press any key to capture', 3000);

    document.addEventListener('keydown', captureKeyEvent, { once: true });

    const escapeTimeout = setTimeout(() => {
      if (state.keyCapture.active) {
        stopKeyCapture();
        showToast('Key capture cancelled');
      }
    }, 10000);

    state.keyCapture.escapeTimeout = escapeTimeout;
  }

  function captureKeyEvent(event) {
    event.preventDefault();
    event.stopPropagation();

    if (!state.keyCapture.active) return;

    const { targetRow } = state.keyCapture;

    // Fill in the captured key data
    const keyInput = targetRow.querySelector('input[data-field="key"]');
    const codeInput = targetRow.querySelector('input[data-field="code"]');
    const keyCodeInput = targetRow.querySelector('input[data-field="keycode"]');

    if (keyInput) keyInput.value = event.key;
    if (codeInput) codeInput.value = event.code;
    if (keyCodeInput) keyCodeInput.value = event.keyCode.toString();

    stopKeyCapture();
    showToast(`Captured: ${event.key} (${event.code})`);
  }

  function stopKeyCapture() {
    if (!state.keyCapture.active) return;

    const { button, escapeTimeout } = state.keyCapture;

    if (button) {
      button.classList.remove('capturing');
      button.textContent = button.dataset.defaultText || 'Press Key';
    }

    if (escapeTimeout) {
      clearTimeout(escapeTimeout);
    }

    document.removeEventListener('keydown', captureKeyEvent);

    state.keyCapture = {
      active: false,
      targetRow: null,
      button: null,
      escapeTimeout: null
    };
  }

  function cloneValue(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function getPersistentStateSnapshot() {
    return {
      controllerMetadata: cloneValue(state.controllerMetadata),
      sourcePlatform: state.sourcePlatform,
      specialLabel: state.specialLabel,
      fastuiArea: cloneValue(state.fastuiArea),
      presets: cloneValue(state.presets),
      currentPresetId: state.currentPresetId,
      selectedElementId: state.selectedElementId,
      activeOrientation: state.activeOrientation,
      viewMode: state.viewMode,
      deviceRatio: state.deviceRatio
    };
  }

  function sanitizeLoadedState() {
    if (!DEVICE_RATIOS[state.deviceRatio]) {
      state.deviceRatio = 'iphone';
    }

    if (!['both', 'landscape', 'portrait'].includes(state.viewMode)) {
      state.viewMode = 'both';
    }

    if (!['landscape', 'portrait'].includes(state.activeOrientation)) {
      state.activeOrientation = 'landscape';
    }

    if (!Array.isArray(state.presets)) {
      state.presets = [];
    }
    ensureAllPresetsLayoutModel();

    if (!state.presets.some(preset => preset.id === state.currentPresetId)) {
      state.currentPresetId = state.presets.length ? state.presets[0].id : null;
    }

    if (state.selectedElementId) {
      const preset = state.presets.find(p => p.id === state.currentPresetId);
      const selected = preset ? findElementBySelectionId(preset.elements, state.selectedElementId) : null;
      state.selectedElementId = selected ? getElementRuntimeId(selected) : null;
    }
  }

  function refreshUiFromState() {
    updateReviewSourceLink();
    const platform = platformSources.find(platform => platform.name === state.sourcePlatform);
    document.getElementById('platformStatus').textContent = platform
      ? `Workspace: ${platform.sourceFile}. Load again to read the source; Undo restores the previous workspace.`
      : 'Load a platform to replace the workspace. Undo restores the previous workspace.';
    inputs.specialLabel.value = state.specialLabel;
    inputs.fastuiLandscape.value = state.fastuiArea.landscape;
    inputs.fastuiPortrait.value = state.fastuiArea.portrait;

    updatePresetSelect();
    updatePresetForm();
    renderElementList();
    renderGrids();

    if (state.selectedElementId) {
      const selectedElement = getElementById(state.selectedElementId);
      if (selectedElement) {
        populateElementForm(selectedElement);
      } else {
        state.selectedElementId = null;
        resetElementForm();
      }
    } else {
      resetElementForm();
    }

    setPresetDependentUiEnabled(!!getCurrentPreset());
    setViewMode(state.viewMode);
    setDeviceRatio(state.deviceRatio);
    highlightSelectedElement();
    updateElementButtonsState();
  }

  function createHistoryEntry(snapshot) {
    return {
      snapshot,
      serialized: JSON.stringify(snapshot)
    };
  }

  function saveDraftToStorage() {
    try {
      const payload = {
        version: 1,
        savedAt: Date.now(),
        snapshot: getPersistentStateSnapshot()
      };
      localStorage.setItem(AUTOSAVE_STORAGE_KEY, JSON.stringify(payload));
      updateClearDraftButtonState();
    } catch (error) {
      console.warn('Autosave failed:', error);
    }
  }

  function hasSavedDraft() {
    try {
      return !!localStorage.getItem(AUTOSAVE_STORAGE_KEY);
    } catch (error) {
      return false;
    }
  }

  function updateClearDraftButtonState() {
    if (!buttons.clearDraft) return;
    buttons.clearDraft.disabled = !hasSavedDraft();
    document.getElementById('restoreDraftBtn').disabled = !hasSavedDraft();
  }

  function clearSavedDraft() {
    if (!hasSavedDraft()) {
      showToast('No saved draft', 900);
      updateClearDraftButtonState();
      return;
    }

    if (!confirm('Clear saved draft from browser storage?')) {
      return;
    }

    if (historyState.autosaveTimer) {
      clearTimeout(historyState.autosaveTimer);
      historyState.autosaveTimer = null;
    }

    try {
      localStorage.removeItem(AUTOSAVE_STORAGE_KEY);
      showToast('Draft cleared', 1000);
    } catch (error) {
      console.warn('Could not clear draft:', error);
      showToast('Draft clear failed', 1200);
    }

    updateClearDraftButtonState();
  }

  function scheduleAutosave() {
    if (!canAutosave) return;
    if (historyState.autosaveTimer) {
      clearTimeout(historyState.autosaveTimer);
    }

    historyState.autosaveTimer = setTimeout(() => {
      saveDraftToStorage();
      historyState.autosaveTimer = null;
    }, 250);
  }

  function updateUndoRedoButtons() {
    if (buttons.undo) {
      buttons.undo.disabled = historyState.undoStack.length <= 1;
    }
    if (buttons.redo) {
      buttons.redo.disabled = historyState.redoStack.length === 0;
    }
  }

  function initializeHistory() {
    historyState.undoStack = [];
    historyState.redoStack = [];
    historyState.undoStack.push(createHistoryEntry(getPersistentStateSnapshot()));
    updateUndoRedoButtons();
    scheduleAutosave();
  }

  function commitStateChange() {
    if (historyState.isApplyingSnapshot) {
      return;
    }

    const entry = createHistoryEntry(getPersistentStateSnapshot());
    const lastEntry = historyState.undoStack[historyState.undoStack.length - 1];
    if (lastEntry && lastEntry.serialized === entry.serialized) {
      scheduleAutosave();
      updateUndoRedoButtons();
      return;
    }

    historyState.undoStack.push(entry);
    if (historyState.undoStack.length > HISTORY_LIMIT) {
      historyState.undoStack.shift();
    }

    historyState.redoStack = [];
    updateUndoRedoButtons();
    scheduleAutosave();
  }

  function applyPersistentStateSnapshot(snapshot, options = {}) {
    const { toastMessage = '' } = options;
    if (!snapshot || typeof snapshot !== 'object') {
      return false;
    }

    historyState.isApplyingSnapshot = true;
    try {
      state.controllerMetadata = snapshot.controllerMetadata ? cloneValue(snapshot.controllerMetadata) : {};
      state.sourcePlatform = snapshot.sourcePlatform || null;
      state.specialLabel = typeof snapshot.specialLabel === 'string' ? snapshot.specialLabel : 'SPECIAL';
      state.fastuiArea = {
        landscape: snapshot.fastuiArea?.landscape || '1 / 1 / span 50 / span 50',
        portrait: snapshot.fastuiArea?.portrait || '1 / 1 / span 50 / span 50'
      };
      state.presets = Array.isArray(snapshot.presets) ? cloneValue(snapshot.presets) : [];
      state.currentPresetId = typeof snapshot.currentPresetId === 'string' ? snapshot.currentPresetId : null;
      state.selectedElementId = typeof snapshot.selectedElementId === 'string' ? snapshot.selectedElementId : null;
      state.activeOrientation = snapshot.activeOrientation;
      state.viewMode = snapshot.viewMode;
      state.deviceRatio = snapshot.deviceRatio;
      sanitizeLoadedState();
      refreshUiFromState();
      if (toastMessage) {
        showToast(toastMessage, 1200);
      }
    } finally {
      historyState.isApplyingSnapshot = false;
    }

    scheduleAutosave();
    return true;
  }

  function restoreDraftFromStorage() {
    try {
      const raw = localStorage.getItem(AUTOSAVE_STORAGE_KEY);
      if (!raw) {
        updateClearDraftButtonState();
        return false;
      }

      const parsed = JSON.parse(raw);
      const snapshot = parsed && typeof parsed === 'object'
        ? (parsed.snapshot || parsed.state || parsed)
        : null;

      const restored = applyPersistentStateSnapshot(snapshot, { toastMessage: 'Draft restored' });
      updateClearDraftButtonState();
      return restored;
    } catch (error) {
      console.warn('Could not restore draft:', error);
      updateClearDraftButtonState();
      return false;
    }
  }

  function undoStateChange() {
    if (historyState.undoStack.length <= 1) {
      showToast('Nothing to undo', 900);
      return;
    }

    const current = historyState.undoStack.pop();
    historyState.redoStack.push(current);
    const previous = historyState.undoStack[historyState.undoStack.length - 1];
    applyPersistentStateSnapshot(previous.snapshot, { toastMessage: 'Undone' });
    updateUndoRedoButtons();
  }

  function redoStateChange() {
    if (!historyState.redoStack.length) {
      showToast('Nothing to redo', 900);
      return;
    }

    const next = historyState.redoStack.pop();
    historyState.undoStack.push(next);
    applyPersistentStateSnapshot(next.snapshot, { toastMessage: 'Redone' });
    updateUndoRedoButtons();
  }

  function ensurePresetSelected() {
    ensureAllPresetsLayoutModel();
    if (!state.currentPresetId && state.presets.length) {
      state.currentPresetId = state.presets[0].id;
    }
  }

  function updatePresetSelect() {
    document.getElementById('presetSelectLabel').textContent = `Controller preset (${state.presets.length})`;
    console.log('updatePresetSelect called, state.presets:', state.presets);

    refs.presetSelect.innerHTML = '';
    if (!state.presets.length) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'No presets available';
      option.disabled = true;
      option.selected = true;
      refs.presetSelect.appendChild(option);
      refs.presetSelect.disabled = true;
      return;
    }

    refs.presetSelect.disabled = false;

    state.presets.forEach(preset => {
      ensurePresetLayoutModel(preset);
      console.log('Adding preset option:', preset.id, preset.name);
      const option = document.createElement('option');
      option.value = preset.id;
      option.textContent = preset.name || preset.id;
      refs.presetSelect.appendChild(option);
    });

    ensurePresetSelected();

    if (state.currentPresetId) {
      console.log('Setting preset select value to:', state.currentPresetId);
      refs.presetSelect.value = state.currentPresetId;
    }
  }

  function getCurrentPreset() {
    const preset = ensurePresetLayoutModel(state.presets.find(p => p.id === state.currentPresetId) || null);
    console.log('getCurrentPreset called, currentPresetId:', state.currentPresetId);
    console.log('Available presets:', state.presets.map(p => p.id));
    console.log('Found preset:', preset);
    return preset;
  }

  function updateLayoutSelect() {
    if (!inputs.layoutSelect) {
      return;
    }

    inputs.layoutSelect.innerHTML = '';
    const preset = getCurrentPreset();
    if (!preset) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'No layouts available';
      option.disabled = true;
      option.selected = true;
      inputs.layoutSelect.appendChild(option);
      updateLayoutVariantButtonsState();
      return;
    }

    const activeLayout = getCurrentLayoutEntry(preset);
    (preset.layouts || []).forEach(layout => {
      const option = document.createElement('option');
      option.value = layout.id;
      option.textContent = layout.name || layout.id;
      inputs.layoutSelect.appendChild(option);
    });

    if (activeLayout) {
      inputs.layoutSelect.value = activeLayout.id;
    }
    updateLayoutVariantButtonsState();
  }

  function selectLayoutVariant(layoutId) {
    const preset = getCurrentPreset();
    if (!preset) {
      return;
    }

    const previousLayoutId = preset.currentLayoutId;
    const activeLayout = applyPresetLayoutAlias(preset, layoutId);
    if (!activeLayout) {
      return;
    }

    if (previousLayoutId !== activeLayout.id) {
      state.selectedElementId = null;
      resetElementForm();
    } else if (state.selectedElementId && !findElementBySelectionId(preset.elements, state.selectedElementId)) {
      state.selectedElementId = null;
      resetElementForm();
    }

    updatePresetForm();
    scheduleAutosave();
  }

  function createNewLayoutVariant() {
    const preset = getCurrentPreset();
    if (!preset) {
      showToast('Create or select a preset first');
      return;
    }

    const activeLayout = getCurrentLayoutEntry(preset);
    const layoutId = getUniqueLayoutId(preset, 'layout');
    const layoutName = getUniqueLayoutName(preset, 'Layout');
    const newLayout = createLayoutVariant({
      id: layoutId,
      name: layoutName,
      layout: activeLayout ? activeLayout.layout : null,
      elements: []
    });

    preset.layouts.push(newLayout);
    applyPresetLayoutAlias(preset, newLayout.id);
    state.selectedElementId = null;
    updatePresetForm();
    resetElementForm();
    showToast('Layout created');
    commitStateChange();
  }

  function duplicateCurrentLayoutVariant() {
    const preset = getCurrentPreset();
    if (!preset) {
      showToast('Create or select a preset first');
      return;
    }

    const activeLayout = getCurrentLayoutEntry(preset);
    if (!activeLayout) {
      showToast('No active layout to duplicate');
      return;
    }

    const duplicate = createLayoutVariant({
      id: getUniqueLayoutId(preset, 'layout'),
      name: getUniqueLayoutName(preset, `${activeLayout.name || 'Layout'} Copy`),
      layout: activeLayout.layout,
      elements: activeLayout.elements
    });

    preset.layouts.push(duplicate);
    applyPresetLayoutAlias(preset, duplicate.id);
    state.selectedElementId = null;
    updatePresetForm();
    resetElementForm();
    showToast('Layout duplicated');
    commitStateChange();
  }

  function renameCurrentLayoutVariant() {
    const preset = getCurrentPreset();
    if (!preset) {
      showToast('Create or select a preset first');
      return;
    }

    const activeLayout = getCurrentLayoutEntry(preset);
    if (!activeLayout) {
      showToast('No active layout to rename');
      return;
    }

    const nextName = prompt('Enter layout name:', activeLayout.name || '');
    if (nextName === null) {
      return;
    }
    const trimmed = nextName.trim();
    if (!trimmed) {
      showToast('Layout name cannot be empty');
      return;
    }
    if (trimmed === activeLayout.name) {
      return;
    }

    activeLayout.name = trimmed;
    updateLayoutSelect();
    showToast('Layout renamed');
    commitStateChange();
  }

  function deleteCurrentLayoutVariant() {
    const preset = getCurrentPreset();
    if (!preset) {
      showToast('Create or select a preset first');
      return;
    }

    if (!Array.isArray(preset.layouts) || preset.layouts.length <= 1) {
      showToast('Preset must keep at least one layout');
      return;
    }

    const activeLayout = getCurrentLayoutEntry(preset);
    if (!activeLayout) {
      showToast('No active layout to delete');
      return;
    }

    const confirmed = confirm(`Delete layout "${activeLayout.name}"?`);
    if (!confirmed) {
      return;
    }

    const index = preset.layouts.findIndex(layout => layout.id === activeLayout.id);
    if (index === -1) {
      return;
    }

    preset.layouts.splice(index, 1);
    if (preset.defaultLayoutId === activeLayout.id) {
      preset.defaultLayoutId = preset.layouts[0].id;
    }
    const fallback = preset.layouts[Math.min(index, preset.layouts.length - 1)];
    applyPresetLayoutAlias(preset, fallback.id);

    state.selectedElementId = null;
    updatePresetForm();
    resetElementForm();
    showToast('Layout deleted');
    commitStateChange();
  }

  function selectPreset(id) {
    state.currentPresetId = id;
    state.selectedElementId = null;
    updateReviewSourceLink();
    updatePresetForm();
    renderElementList();
    renderGrids();
    resetElementForm();
    scheduleAutosave();
  }

  function updatePresetForm() {
    const preset = getCurrentPreset();
    const hasPreset = !!preset;

    setPresetDependentUiEnabled(hasPreset);

    if (!preset) {
      updateLayoutSelect();
      inputs.presetId.value = '';
      inputs.presetName.value = '';
      inputs.presetDescription.value = '';
      inputs.presetGameFocus.checked = true;
      inputs.presetHideAdditionalButtons.checked = false;
      inputs.landscapeCols.value = GRID_DEFAULT_SIZE;
      inputs.landscapeRows.value = GRID_DEFAULT_SIZE;
      inputs.portraitCols.value = GRID_DEFAULT_SIZE;
      inputs.portraitRows.value = GRID_DEFAULT_SIZE;
      return;
    }

    const activeLayout = getCurrentLayoutEntry(preset);
    updateLayoutSelect();

    inputs.presetId.value = preset.id;
    inputs.presetName.value = preset.name;
    inputs.presetDescription.value = preset.description;
    const focusDefaults = state.controllerMetadata.focus_defaults ?? state.controllerMetadata.focusDefaults;
    inputs.presetGameFocus.checked = preset.gameFocus ?? focusDefaults?.[preset.id] ?? true;
    inputs.presetHideAdditionalButtons.checked = preset.hideAdditionalButtons === true;
    inputs.landscapeCols.value = activeLayout ? activeLayout.layout.landscape.columns : GRID_DEFAULT_SIZE;
    inputs.landscapeRows.value = activeLayout ? activeLayout.layout.landscape.rows : GRID_DEFAULT_SIZE;
    inputs.portraitCols.value = activeLayout ? activeLayout.layout.portrait.columns : GRID_DEFAULT_SIZE;
    inputs.portraitRows.value = activeLayout ? activeLayout.layout.portrait.rows : GRID_DEFAULT_SIZE;
    renderElementList();
    renderGrids();
  }

  function renderElementList() {
    const preset = getCurrentPreset();
    console.log('renderElementList called, current preset:', preset);
    console.log('preset.elements:', preset ? preset.elements : 'no preset');

    refs.elementList.innerHTML = '';
    updateElementButtonsState();
    if (!preset) {
      const empty = document.createElement('div');
      empty.textContent = 'Create or import a preset to add elements';
      empty.style.fontSize = '12px';
      empty.style.color = 'var(--text-secondary)';
      refs.elementList.appendChild(empty);
      return;
    }

    if (!preset.elements.length) {
      console.log('No elements, showing empty state');
      const empty = document.createElement('div');
      empty.textContent = 'No elements yet';
      empty.style.fontSize = '12px';
      empty.style.color = 'var(--text-secondary)';
      refs.elementList.appendChild(empty);
      return;
    }

    preset.elements.forEach(el => {
      const runtimeId = getElementRuntimeId(el);
      const item = document.createElement('div');
      item.className = 'element-item' + (state.selectedElementId === runtimeId ? ' active' : '');
      item.dataset.id = runtimeId;

      const info = document.createElement('div');
      info.className = 'element-info';
      info.style.flex = '1';
      info.style.cursor = 'pointer';
      info.style.display = 'flex';
      info.style.flexDirection = 'column';
      info.style.gap = '2px';
      const subtitleParts = [];

      if (el.component === 'TouchpadComponent') {
        const style = el.options?.style ?? 'filled';
        const hasExplicitLabel = el.options && Object.prototype.hasOwnProperty.call(el.options, 'label');
        const rawLabel = hasExplicitLabel ? el.options.label ?? '' : '';
        const trimmedLabel = typeof rawLabel === 'string' ? rawLabel.trim() : '';
        const displayLabel = (style === 'filled' || style === 'tab')
          ? (hasExplicitLabel ? trimmedLabel : TOUCHPAD_DEFAULT_LABEL)
          : (hasExplicitLabel ? trimmedLabel : '');

        if (displayLabel) {
          subtitleParts.push(displayLabel);
        }

        const styleName = style.replace(/^(\w)/, (match) => match.toUpperCase());
        subtitleParts.push(`style: ${styleName}`);
      } else if (el.component === 'QuickshotComponent') {
        const hasExplicitLabel = el.options && Object.prototype.hasOwnProperty.call(el.options, 'label');
        const customLabel = hasExplicitLabel ? (el.options.label ?? '').trim() : '';
        if (customLabel) {
          subtitleParts.push(customLabel);
        }
        const mode = el.options?.mode ?? 'nostalgist';
        subtitleParts.push(mode === 'keyboard' ? 'Quickshot (keyboard)' : 'Quickshot controller');
      } else if (el.component === 'CursorKeysComponent') {
        const mapping = { ...DEFAULT_CURSOR_KEYMAP, ...(el.options?.keys || {}) };
        const leftKey = mapping.left?.key || DEFAULT_CURSOR_KEYMAP.left.key;
        const rightKey = mapping.right?.key || DEFAULT_CURSOR_KEYMAP.right.key;
        subtitleParts.push(`Left: ${leftKey} • Right: ${rightKey}`);
        subtitleParts.push('Cursor controller');
      }

      subtitleParts.push(el.component);

      info.innerHTML = `
        <div style="font-weight: 600; font-size: 12px;">${getElementDisplayTitle(el)}</div>
        <div style="font-size: 11px; opacity: 0.7;">${subtitleParts.join(' • ')}</div>
      `;
      info.addEventListener('click', () => {
        state.selectedElementId = runtimeId;
        populateElementForm(el);
        renderElementList();
        highlightSelectedElement();
      });

      const copyBtn = document.createElement('button');
      copyBtn.textContent = 'Copy';
      copyBtn.className = 'secondary small';
      copyBtn.style.fontSize = '10px';
      copyBtn.style.padding = '2px 6px';
      copyBtn.style.marginLeft = '8px';
      copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        copyElement(runtimeId);
      });

      item.appendChild(info);
      item.appendChild(copyBtn);
      refs.elementList.appendChild(item);
    });
  }

  function getCurrentElements() {
    const preset = getCurrentPreset();
    return preset ? preset.elements : [];
  }

  function getElementById(id) {
    const preset = getCurrentPreset();
    return preset ? findElementBySelectionId(preset.elements, id) || undefined : undefined;
  }

  function updateComponentUI(existingElement = null) {
    const component = inputs.elementComponent.value;
    renderLabelInputs(component, existingElement);
    renderOptionsFields(component, existingElement);
    refreshBindingTypeOptions(component);

    let bindingType = inputs.bindingType.value;
    if (!isBindingTypeAllowed(component, bindingType)) {
      bindingType = getDefaultBindingType(component);
      inputs.bindingType.value = bindingType;
    }

    const disableBindingSelector = component === 'TouchpadComponent' || component === 'QuickshotComponent' || component === 'CursorKeysComponent';
    inputs.bindingType.disabled = disableBindingSelector;
    if (disableBindingSelector) {
      inputs.bindingType.value = 'none';
      bindingType = 'none';
    }

    renderBindingFields(component, bindingType);
    applyBindingToForm(component, bindingType, existingElement ? existingElement.binding : null);
  }

  function renderLabelInputs(component, element) {
    const meta = componentMeta[component] || componentMeta.SingleTouchButton;
    const defaultLabels = getDefaultElementLabels(component);
    const sourceValues = element
      ? (Array.isArray(element.labels) ? element.labels : [element.label || defaultLabels[0] || ''])
      : [];
    refs.labelFields.innerHTML = '';
    for (let index = 0; index < meta.count; index += 1) {
      const fallback = defaultLabels[index] || (meta.count === 1 ? 'Button' : `BTN${index + 1}`);
      const value = sourceValues[index] || fallback;
      const wrapper = document.createElement('div');
      wrapper.className = 'label-field';
      const label = document.createElement('label');
      label.textContent = meta.count === 1 ? 'Label' : `Label ${index + 1}`;
      const input = document.createElement('input');
      input.dataset.labelIndex = index;
      input.value = value || '';
      wrapper.appendChild(label);
      wrapper.appendChild(input);
      refs.labelFields.appendChild(wrapper);
    }
  }

  function renderOptionsFields(component, element) {
    refs.optionsFields.innerHTML = '';

    // Add orientation option for DualTouchButton and TripleTouchButton
    if (component === 'DualTouchButton' || component === 'TripleTouchButton') {
      const wrapper = document.createElement('div');
      wrapper.className = 'label-field';

      const label = document.createElement('label');
      label.textContent = 'Orientation';

      const select = document.createElement('select');
      select.dataset.optionType = 'isHorizontal';

      const horizontal = document.createElement('option');
      horizontal.value = 'true';
      horizontal.textContent = 'Horizontal';
      select.appendChild(horizontal);

      const vertical = document.createElement('option');
      vertical.value = 'false';
      vertical.textContent = 'Vertical';
      select.appendChild(vertical);

      // Set current value
      const currentValue = element?.options?.isHorizontal ?? true;
      select.value = currentValue.toString();

      wrapper.appendChild(label);
      wrapper.appendChild(select);
      refs.optionsFields.appendChild(wrapper);
      return;
    }

    if (component === 'TouchpadComponent') {
      const styleWrapper = document.createElement('div');
      styleWrapper.className = 'label-field';

      const styleLabel = document.createElement('label');
      styleLabel.textContent = 'Appearance';

      const styleSelect = document.createElement('select');
      styleSelect.dataset.optionType = 'touchpadStyle';

      const styles = [
        { value: 'filled', text: 'Filled Panel' },
        { value: 'outline', text: 'Outlined Panel' },
        { value: 'transparent', text: 'Transparent' },
        { value: 'tab', text: 'Bottom Tag' }
      ];

      styles.forEach(({ value, text }) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = text;
        styleSelect.appendChild(option);
      });

      const currentStyle = element?.options?.style ?? 'filled';
      styleSelect.value = currentStyle;

      styleWrapper.appendChild(styleLabel);
      styleWrapper.appendChild(styleSelect);
      refs.optionsFields.appendChild(styleWrapper);

      const labelWrapper = document.createElement('div');
      labelWrapper.className = 'label-field';

      const labelLabel = document.createElement('label');
      labelLabel.textContent = 'Label (optional)';

      const labelInput = document.createElement('input');
      labelInput.type = 'text';
      labelInput.placeholder = TOUCHPAD_DEFAULT_LABEL;
      labelInput.dataset.optionType = 'touchpadLabel';
      const hasExplicitLabel = element?.options && Object.prototype.hasOwnProperty.call(element.options, 'label');
      labelInput.value = hasExplicitLabel ? element.options.label : TOUCHPAD_DEFAULT_LABEL;
      labelInput.dataset.defaultValue = TOUCHPAD_DEFAULT_LABEL;
      labelInput.dataset.hasExplicit = hasExplicitLabel ? '1' : '0';

      labelWrapper.appendChild(labelLabel);
      labelWrapper.appendChild(labelInput);
      refs.optionsFields.appendChild(labelWrapper);
      return;
    }

    if (component === 'QuickshotComponent') {
      // Label field
      const labelWrapper = document.createElement('div');
      labelWrapper.className = 'label-field';

      const labelLabel = document.createElement('label');
      labelLabel.textContent = 'Label';

      const labelInput = document.createElement('input');
      labelInput.type = 'text';
      labelInput.dataset.optionType = 'quickshotLabel';
      labelInput.placeholder = QUICKSHOT_DEFAULT_LABEL;

      const hasExplicitLabel = element?.options?.label && element.options.label.trim() !== '';
      labelInput.value = hasExplicitLabel ? element.options.label : '';
      labelInput.dataset.defaultValue = QUICKSHOT_DEFAULT_LABEL;
      labelInput.dataset.hasExplicit = hasExplicitLabel ? '1' : '0';

      labelWrapper.appendChild(labelLabel);
      labelWrapper.appendChild(labelInput);
      refs.optionsFields.appendChild(labelWrapper);

      // Mode field
      const modeWrapper = document.createElement('div');
      modeWrapper.className = 'label-field';

      const modeLabel = document.createElement('label');
      modeLabel.textContent = 'Mode';

      const modeSelect = document.createElement('select');
      modeSelect.dataset.optionType = 'quickshotMode';

      const modes = [
        { value: 'nostalgist', text: 'Nostalgist (default)' },
        { value: 'keyboard', text: 'Keyboard mapping' }
      ];

      modes.forEach(({ value, text }) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = text;
        modeSelect.appendChild(option);
      });

      const currentMode = element?.options?.mode ?? 'nostalgist';
      modeSelect.value = currentMode;

      modeWrapper.appendChild(modeLabel);
      modeWrapper.appendChild(modeSelect);
      refs.optionsFields.appendChild(modeWrapper);

      const renderKeyboardOptions = () => {
        const directions = [
          { id: 'up', label: 'Up' },
          { id: 'down', label: 'Down' },
          { id: 'left', label: 'Left' },
          { id: 'right', label: 'Right' }
        ];

        const mapping = { ...DEFAULT_CURSOR_KEYMAP, ...(element?.options?.keys || {}) };

        const container = document.createElement('div');
        container.className = 'cursor-keys-options';

        directions.forEach(({ id, label }) => {
          const base = DEFAULT_CURSOR_KEYMAP[id];
          const current = mapping?.[id] ?? base;

          const row = document.createElement('div');
          row.className = 'cursor-key-row';
          row.dataset.direction = id;

          const title = document.createElement('span');
          title.textContent = label;
          row.appendChild(title);

          const keyInput = document.createElement('input');
          keyInput.type = 'text';
          keyInput.placeholder = base.key;
          keyInput.dataset.field = 'key';
          keyInput.value = current?.key ?? '';
          row.appendChild(keyInput);

          const codeInput = document.createElement('input');
          codeInput.type = 'text';
          codeInput.placeholder = base.code;
          codeInput.dataset.field = 'code';
          codeInput.value = current?.code ?? '';
          row.appendChild(codeInput);

          const keyCodeInput = document.createElement('input');
          keyCodeInput.type = 'number';
          keyCodeInput.placeholder = base.keyCode;
          keyCodeInput.dataset.field = 'keycode';
          keyCodeInput.value = current?.keyCode ?? '';
          row.appendChild(keyCodeInput);

          const captureBtn = document.createElement('button');
          captureBtn.type = 'button';
          captureBtn.className = 'key-capture-btn';
          captureBtn.textContent = 'Capture';
          captureBtn.addEventListener('click', (e) => startCursorKeyCapture(row, e.currentTarget));
          row.appendChild(captureBtn);

          container.appendChild(row);
        });

        const hint = document.createElement('div');
        hint.className = 'binding-info';
        hint.textContent = 'Capture or enter keys for each direction. Leave blank to use defaults.';
        container.appendChild(hint);

        refs.optionsFields.appendChild(container);
      };

      if (currentMode === 'keyboard') {
        renderKeyboardOptions();
      }

      modeSelect.addEventListener('change', () => {
        const updated = element ? cloneValue(element) : { options: {} };
        if (!updated.options) updated.options = {};
        updated.options.mode = modeSelect.value;
        renderOptionsFields(component, updated);
      });

      return;
    }

    if (component === 'CursorKeysComponent') {
      const directions = [
        { id: 'up', label: 'Up' },
        { id: 'down', label: 'Down' },
        { id: 'left', label: 'Left' },
        { id: 'right', label: 'Right' }
      ];

      const mapping = { ...DEFAULT_CURSOR_KEYMAP, ...(element?.options?.keys || {}) };

      const container = document.createElement('div');
      container.className = 'cursor-keys-options';

      directions.forEach(({ id, label }) => {
        const base = DEFAULT_CURSOR_KEYMAP[id];
        const current = mapping?.[id] ?? base;

        const row = document.createElement('div');
        row.className = 'cursor-key-row';
        row.dataset.direction = id;

        const title = document.createElement('span');
        title.textContent = label;
        row.appendChild(title);

        const keyInput = document.createElement('input');
        keyInput.type = 'text';
        keyInput.placeholder = base.key;
        keyInput.dataset.field = 'key';
        keyInput.value = current?.key ?? '';
        row.appendChild(keyInput);

        const codeInput = document.createElement('input');
        codeInput.type = 'text';
        codeInput.placeholder = base.code;
        codeInput.dataset.field = 'code';
        codeInput.value = current?.code ?? '';
        row.appendChild(codeInput);

        const keyCodeInput = document.createElement('input');
        keyCodeInput.type = 'number';
        keyCodeInput.placeholder = base.keyCode;
        keyCodeInput.dataset.field = 'keycode';
        keyCodeInput.value = current?.keyCode ?? '';
        row.appendChild(keyCodeInput);

        const captureBtn = document.createElement('button');
        captureBtn.type = 'button';
        captureBtn.className = 'key-capture-btn';
        captureBtn.textContent = 'Capture';
        captureBtn.addEventListener('click', (e) => startCursorKeyCapture(row, e.currentTarget));
        row.appendChild(captureBtn);

        container.appendChild(row);
      });

      const hint = document.createElement('div');
      hint.className = 'binding-info';
      hint.textContent = 'Leave fields blank to use default arrow keys. KeyCode is optional; if omitted it will be inferred for single letters.';
      container.appendChild(hint);

      refs.optionsFields.appendChild(container);
      return;
    }
  }

  function refreshBindingTypeOptions(component) {
    const meta = componentMeta[component] || componentMeta.SingleTouchButton;
    Array.from(inputs.bindingType.options).forEach(option => {
      if (option.value === 'keyboard') option.disabled = !meta.supportsKeyboard;
      if (option.value === 'joy') option.disabled = !meta.supportsJoy;
      if (option.value === 'none') option.disabled = component !== 'TouchpadComponent';
    });
  }

  function renderBindingFields(component, bindingType) {
    refs.bindingFields.innerHTML = '';

    // Components handled internally do not require bindings
    if (component === 'TouchpadComponent' || component === 'QuickshotComponent' || component === 'CursorKeysComponent' || bindingType === 'none') {
      refs.bindingCustomContainer.style.display = 'none';
      if (component === 'QuickshotComponent') {
        refs.bindingFields.innerHTML = '<div class="binding-info">QuickshotComponent provides its own virtual joystick and does not require key bindings.</div>';
      } else if (component === 'CursorKeysComponent') {
        refs.bindingFields.innerHTML = '<div class="binding-info">CursorKeysComponent simulates keyboard events internally for each direction and does not require bindings.</div>';
      } else {
        refs.bindingFields.innerHTML = '<div class="binding-info">TouchpadComponent directly simulates mouse movement and does not require bindings.</div>';
      }
      return;
    }

    if (bindingType === 'custom') {
      refs.bindingCustomContainer.style.display = 'block';
      refs.bindingFields.innerHTML = '<div class="binding-info">Provide the binding JSON manually below.</div>';
      return;
    }

    refs.bindingCustomContainer.style.display = 'none';

    if (bindingType === 'keyboard') {
      const props = keyboardPropNames[component];
      if (!props) {
        refs.bindingFields.innerHTML = '<div class="binding-info">Keyboard bindings are not supported for this component. Use custom JSON.</div>';
        inputs.bindingType.value = getDefaultBindingType(component);
        renderBindingFields(component, inputs.bindingType.value);
        return;
      }

      const meta = componentMeta[component] || componentMeta.SingleTouchButton;
      props.forEach((prop, index) => {
        const rowContainer = document.createElement('div');

        const header = document.createElement('div');
        header.className = 'binding-row-header';
        const title = document.createElement('h4');
        title.textContent = `${meta.count === 1 ? 'Button' : `Button ${index + 1}`}`;
        const captureBtn = document.createElement('button');
        captureBtn.type = 'button';
        captureBtn.className = 'key-capture-btn';
        captureBtn.textContent = 'Press Key';
        captureBtn.addEventListener('click', (e) => startKeyCapture(prop, e));
        header.appendChild(title);
        header.appendChild(captureBtn);
        rowContainer.appendChild(header);

        const row = document.createElement('div');
        row.className = 'binding-row keyboard';
        row.dataset.prop = prop;

        ['Key', 'Code', 'KeyCode'].forEach(field => {
          const fieldWrapper = document.createElement('div');
          fieldWrapper.className = 'binding-field';
          const span = document.createElement('span');
          span.textContent = field;
          const input = document.createElement('input');
          input.dataset.bindingType = 'keyboard';
          input.dataset.prop = prop;
          input.dataset.field = field.toLowerCase();
          fieldWrapper.appendChild(span);
          fieldWrapper.appendChild(input);
          row.appendChild(fieldWrapper);
        });

        // Add modifier checkboxes
        const modifiersWrapper = document.createElement('div');
        modifiersWrapper.className = 'binding-modifiers';

        ['shiftKey', 'ctrlKey', 'altKey', 'metaKey'].forEach(modifier => {
          const checkWrapper = document.createElement('label');
          checkWrapper.className = 'modifier-checkbox';
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.dataset.bindingType = 'keyboard';
          checkbox.dataset.prop = prop;
          checkbox.dataset.field = modifier.toLowerCase();
          const label = document.createElement('span');
          label.textContent = modifier.replace('Key', '');
          checkWrapper.appendChild(checkbox);
          checkWrapper.appendChild(label);
          modifiersWrapper.appendChild(checkWrapper);
        });

        rowContainer.appendChild(row);
        rowContainer.appendChild(modifiersWrapper);
        refs.bindingFields.appendChild(rowContainer);
      });
      return;
    }

    if (bindingType === 'joy') {
      const props = joyPropNames[component];
      if (!props) {
        refs.bindingFields.innerHTML = '<div class="binding-info">Joypad bindings are not supported for this component. Use custom JSON.</div>';
        inputs.bindingType.value = getDefaultBindingType(component);
        renderBindingFields(component, inputs.bindingType.value);
        return;
      }

      const meta = componentMeta[component] || componentMeta.SingleTouchButton;
      props.forEach((prop, index) => {
        const row = document.createElement('div');
        row.className = 'binding-row single';
        row.dataset.prop = prop;
        const fieldWrapper = document.createElement('div');
        fieldWrapper.className = 'binding-field';
        const span = document.createElement('span');
        span.textContent = `${meta.count === 1 ? 'Input' : `Button ${index + 1} Input`}`;
        const input = document.createElement('input');
        input.dataset.bindingType = 'joy';
        input.dataset.prop = prop;
        fieldWrapper.appendChild(span);
        fieldWrapper.appendChild(input);
        row.appendChild(fieldWrapper);
        refs.bindingFields.appendChild(row);
      });
    }
  }

  function applyBindingToForm(component, bindingType, binding) {
    if (bindingType === 'custom') {
      inputs.bindingCustom.value = binding ? JSON.stringify(binding, null, 2) : '';
      return;
    }

    if (bindingType === 'keyboard' && binding && binding.type === 'keyboard') {
      const props = keyboardPropNames[component] || [];
      props.forEach(prop => {
        const row = refs.bindingFields.querySelector(`.binding-row[data-prop="${prop}"]`);
        if (!row) return;
        const data = binding[prop] || {};
        row.querySelectorAll('input[type="text"], input[type="number"]').forEach(input => {
          const fieldValue = data[input.dataset.field];
          input.value = (fieldValue !== undefined && fieldValue !== null) ? fieldValue : '';
        });
        // Handle modifier checkboxes
        const container = row.parentElement;
        if (container) {
          container.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            const fieldValue = data[checkbox.dataset.field];
            checkbox.checked = fieldValue === true;
          });
        }
      });
      return;
    }

    if (bindingType === 'joy' && binding && binding.type === 'joy') {
      const props = joyPropNames[component] || [];
      props.forEach(prop => {
        const row = refs.bindingFields.querySelector(`.binding-row[data-prop="${prop}"]`);
        if (!row) return;
        const input = row.querySelector('input');
        if (input) {
          const fieldValue = binding[prop];
          input.value = (fieldValue !== undefined && fieldValue !== null) ? fieldValue : '';
        }
      });
      return;
    }

    if (binding) {
      inputs.bindingType.value = 'custom';
      renderBindingFields(component, 'custom');
      inputs.bindingCustom.value = JSON.stringify(binding, null, 2);
    }
  }

  function getLabelValues(component) {
    const meta = componentMeta[component] || componentMeta.SingleTouchButton;
    const values = [];
    refs.labelFields.querySelectorAll('input[data-label-index]').forEach((input, index) => {
      const value = input.value.trim();
      values[index] = value || (meta.count === 1 ? 'Button' : `BTN${index + 1}`);
    });
    while (values.length < meta.count) {
      values.push(meta.count === 1 ? 'Button' : `BTN${values.length + 1}`);
    }
    return values;
  }

  function getOptionsValues(component, existingElement) {
    // Retain runtime options that do not have controls in this editor yet.
    const options = component === existingElement?.component
      ? cloneValue(existingElement.options || {}) : {};
    const editableOptions = {
      TouchpadComponent: ['style', 'label'],
      QuickshotComponent: ['label', 'mode', 'keys'],
      CursorKeysComponent: ['keys'],
      DualTouchButton: ['isHorizontal'],
      TripleTouchButton: ['isHorizontal']
    };
    (editableOptions[component] || []).forEach(key => delete options[key]);

    refs.optionsFields.querySelectorAll('select[data-option-type]').forEach(select => {
      const optionType = select.dataset.optionType;
      const value = select.value;

      if (optionType === 'isHorizontal') {
        options.isHorizontal = value === 'true';
      }
      if (optionType === 'touchpadStyle') {
        options.style = value;
      }
    });

    if (component === 'TouchpadComponent') {
      const labelInput = refs.optionsFields.querySelector('input[data-option-type="touchpadLabel"]');
      if (labelInput) {
        const rawValue = labelInput.value ?? '';
        const trimmed = rawValue.trim();
        const hadLabel = existingElement?.options && Object.prototype.hasOwnProperty.call(existingElement.options, 'label');
        const defaultValue = labelInput.dataset.defaultValue ?? TOUCHPAD_DEFAULT_LABEL;
        const hadExplicitFlag = labelInput.dataset.hasExplicit === '1';
        const isDefaultValue = rawValue === defaultValue && !hadLabel && !hadExplicitFlag;

        if (trimmed.length > 0) {
          if (!isDefaultValue) {
            options.label = rawValue;
          }
        } else if (hadLabel || hadExplicitFlag || !isDefaultValue) {
          options.label = '';
        }
      }

      if (!Object.prototype.hasOwnProperty.call(options, 'style')) {
        options.style = existingElement?.options?.style ?? 'filled';
      }
    }

    if (component === 'QuickshotComponent') {
      // Handle label
      const labelInput = refs.optionsFields.querySelector('input[data-option-type="quickshotLabel"]');
      if (labelInput) {
        const rawValue = labelInput.value ?? '';
        const trimmed = rawValue.trim();
        const hadLabel = existingElement?.options && Object.prototype.hasOwnProperty.call(existingElement.options, 'label');
        const defaultValue = labelInput.dataset.defaultValue ?? QUICKSHOT_DEFAULT_LABEL;
        const hadExplicitFlag = labelInput.dataset.hasExplicit === '1';
        const isDefaultValue = rawValue === defaultValue && !hadLabel && !hadExplicitFlag;

        if (trimmed.length > 0) {
          if (!isDefaultValue) {
            options.label = rawValue;
          }
        } else if (hadLabel || hadExplicitFlag || !isDefaultValue) {
          options.label = '';
        }
      }

      const modeSelect = refs.optionsFields.querySelector('select[data-option-type="quickshotMode"]');
      const modeValue = modeSelect ? modeSelect.value : (existingElement?.options?.mode ?? 'nostalgist');

      if (modeValue === 'keyboard') {
        options.mode = 'keyboard';
        const rows = refs.optionsFields.querySelectorAll('.cursor-key-row');
        const keys = {};

        rows.forEach((row) => {
          const direction = row.dataset.direction;
          if (!direction) return;

          const keyInput = row.querySelector('input[data-field="key"]');
          const codeInput = row.querySelector('input[data-field="code"]');
          const keyCodeInput = row.querySelector('input[data-field="keycode"]');

          const keyValue = keyInput ? keyInput.value : '';
          const codeValue = codeInput ? codeInput.value : '';
          const keyCodeValue = keyCodeInput ? keyCodeInput.value : '';

          const entry = {};
          if (keyValue && keyValue.trim().length > 0) entry.key = keyValue;
          if (codeValue && codeValue.trim().length > 0) entry.code = codeValue;
          if (keyCodeValue && `${keyCodeValue}`.trim().length > 0) entry.keyCode = keyCodeValue;

          if (Object.keys(entry).length === 0) {
            return;
          }

          const defaultEntry = DEFAULT_CURSOR_KEYMAP[direction];
          const compareKey = entry.key ?? defaultEntry.key;
          const compareCode = entry.code ?? defaultEntry.code;
          const compareKeyCode = entry.keyCode ?? `${defaultEntry.keyCode}`;
          const matchesDefault = compareKey === defaultEntry.key && compareCode === defaultEntry.code && `${compareKeyCode}` === `${defaultEntry.keyCode}`;

          if (!matchesDefault) {
            keys[direction] = entry;
          }
        });

        if (Object.keys(keys).length > 0) {
          options.keys = keys;
        }
      } else {
        if (existingElement?.options?.mode && existingElement.options.mode !== 'nostalgist') {
          options.mode = 'nostalgist';
        }
      }
    }

    if (component === 'CursorKeysComponent') {
      const rows = refs.optionsFields.querySelectorAll('.cursor-key-row');
      const keys = {};

      rows.forEach((row) => {
        const direction = row.dataset.direction;
        if (!direction) return;

        const keyInput = row.querySelector('input[data-field="key"]');
        const codeInput = row.querySelector('input[data-field="code"]');
        const keyCodeInput = row.querySelector('input[data-field="keycode"]');

        const keyValue = keyInput ? keyInput.value : '';
        const codeValue = codeInput ? codeInput.value : '';
        const keyCodeValue = keyCodeInput ? keyCodeInput.value : '';

        const entry = {};
        if (keyValue && keyValue.trim().length > 0) entry.key = keyValue;
        if (codeValue && codeValue.trim().length > 0) entry.code = codeValue;
        if (keyCodeValue && `${keyCodeValue}`.trim().length > 0) entry.keyCode = keyCodeValue;

        if (Object.keys(entry).length === 0) {
          return;
        }

        const defaultEntry = DEFAULT_CURSOR_KEYMAP[direction];
        const compareKey = entry.key ?? defaultEntry.key;
        const compareCode = entry.code ?? defaultEntry.code;
        const compareKeyCode = entry.keyCode ?? `${defaultEntry.keyCode}`;
        const matchesDefault = compareKey === defaultEntry.key && compareCode === defaultEntry.code && `${compareKeyCode}` === `${defaultEntry.keyCode}`;

        if (!matchesDefault) {
          keys[direction] = entry;
        }
      });

      if (Object.keys(keys).length > 0) {
        options.keys = keys;
      }
    }

    return Object.keys(options).length > 0 ? options : null;
  }

  function collectElementFormData(existing) {
    const component = inputs.elementComponent.value;
    const meta = componentMeta[component] || componentMeta.SingleTouchButton;
    const labels = getLabelValues(component);
    let binding = null;

    const bindingType = inputs.bindingType.value;
    if (bindingType === 'custom') {
      const text = inputs.bindingCustom.value.trim();
      if (!text) {
        showToast('Provide custom binding JSON');
        return null;
      }
      try {
        binding = JSON.parse(text);
      } catch (err) {
        showToast('Custom binding JSON invalid');
        return null;
      }
    } else if (bindingType === 'keyboard') {
      binding = buildKeyboardBinding(component);
      if (!binding) return null;
    } else if (bindingType === 'joy') {
      binding = buildJoyBinding(component);
      if (!binding) return null;
    } else if (bindingType === 'none') {
      // TouchpadComponent doesn't need binding
      binding = null;
    }

    const element = existing ? cloneValue(existing) : createElementSkeleton(component);
    ensureElementRuntimeData(element);
    element.component = component;
    if (meta.count === 0) {
      delete element.label;
      delete element.labels;
    } else if (meta.count === 1) {
      element.label = labels[0];
      delete element.labels;
    } else {
      element.label = labels[0];
      element.labels = labels;
    }
    element.binding = binding;

    // Add options if any
    const options = getOptionsValues(component, existing);
    if (options) {
      element.options = options;
    } else {
      delete element.options;
    }

    return element;
  }

  function buildKeyboardBinding(component) {
    const props = keyboardPropNames[component];
    if (!props) {
      showToast('Keyboard binding not supported for this component');
      return null;
    }
    const binding = { type: 'keyboard' };
    for (const prop of props) {
      const row = refs.bindingFields.querySelector(`.binding-row[data-prop="${prop}"]`);
      if (!row) return null;
      const key = row.querySelector('input[data-field="key"]').value.trim();
      const code = row.querySelector('input[data-field="code"]').value.trim();
      const keyCode = row.querySelector('input[data-field="keycode"]').value.trim();
      if (!key || !code || !keyCode) {
        showToast('Fill keyboard binding fields');
        return null;
      }
      binding[prop] = { key, code, keyCode };

      // Add modifier keys if checked
      const container = row.parentElement;
      if (container) {
        const shiftCheckbox = container.querySelector('input[data-field="shiftkey"]');
        const ctrlCheckbox = container.querySelector('input[data-field="ctrlkey"]');
        const altCheckbox = container.querySelector('input[data-field="altkey"]');
        const metaCheckbox = container.querySelector('input[data-field="metakey"]');

        if (shiftCheckbox && shiftCheckbox.checked) binding[prop].shiftKey = true;
        if (ctrlCheckbox && ctrlCheckbox.checked) binding[prop].ctrlKey = true;
        if (altCheckbox && altCheckbox.checked) binding[prop].altKey = true;
        if (metaCheckbox && metaCheckbox.checked) binding[prop].metaKey = true;
      }
    }
    return binding;
  }

  function buildJoyBinding(component) {
    const props = joyPropNames[component];
    if (!props) {
      showToast('Joypad binding not supported for this component');
      return null;
    }
    const binding = { type: 'joy' };
    for (const prop of props) {
      const row = refs.bindingFields.querySelector(`.binding-row[data-prop="${prop}"]`);
      if (!row) return null;
      const value = row.querySelector('input').value.trim();
      if (!value) {
        showToast('Fill joy inputs');
        return null;
      }
      binding[prop] = value;
    }
    return binding;
  }

  function isBindingTypeAllowed(component, type) {
    const meta = componentMeta[component] || componentMeta.SingleTouchButton;
    if (type === 'keyboard') return meta.supportsKeyboard;
    if (type === 'joy') return meta.supportsJoy;
    if (type === 'none') return component === 'TouchpadComponent' || component === 'QuickshotComponent' || component === 'CursorKeysComponent';
    return true;
  }

  function getDefaultBindingType(component) {
    if (component === 'TouchpadComponent' || component === 'QuickshotComponent' || component === 'CursorKeysComponent') return 'none';
    const meta = componentMeta[component] || componentMeta.SingleTouchButton;
    if (meta.supportsKeyboard) return 'keyboard';
    if (meta.supportsJoy) return 'joy';
    return 'custom';
  }

  function createElementSkeleton(component = 'SingleTouchButton') {
    const meta = componentMeta[component] || componentMeta.SingleTouchButton;
    const labels = getDefaultElementLabels(component);
    const element = {
      component,
      label: labels[0],
      binding: buildDefaultBinding(component),
      areas: {
        landscape: { col: 0, row: 0, colSpan: Math.min(8, 50), rowSpan: 4 },
        portrait: { col: 0, row: 0, colSpan: Math.min(8, 50), rowSpan: 4 }
      }
    };
    if (meta.count > 1) element.labels = labels;
    if (component === 'TouchpadComponent') {
      element.binding = null;
      element.options = { style: 'filled' };
      delete element.label;
    } else if (component === 'QuickshotComponent') {
      element.binding = null;
      element.options = element.options || {};
      delete element.label;
    } else if (component === 'CursorKeysComponent') {
      element.binding = null;
      element.options = {};
      delete element.label;
    }
    return ensureElementRuntimeData(element);
  }

  function buildDefaultBinding(component) {
    if (component === 'SingleTouchButton') {
      return { type: 'keyboard', key: { key: ' ', code: 'Space', keyCode: '32' } };
    }
    if (component === 'DualTouchButton') {
      return {
        type: 'keyboard',
        primary: { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: '37' },
        secondary: { key: 'ArrowRight', code: 'ArrowRight', keyCode: '39' }
      };
    }
    if (component === 'TripleTouchButton') {
      return {
        type: 'keyboard',
        input1: { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: '37' },
        input2: { key: 'ArrowUp', code: 'ArrowUp', keyCode: '38' },
        input3: { key: 'ArrowRight', code: 'ArrowRight', keyCode: '39' }
      };
    }
    if (component === 'QuadrupleTouchButton') {
      return {
        type: 'keyboard',
        input1: { key: 'ArrowUp', code: 'ArrowUp', keyCode: '38' },
        input2: { key: 'ArrowDown', code: 'ArrowDown', keyCode: '40' },
        input3: { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: '37' },
        input4: { key: 'ArrowRight', code: 'ArrowRight', keyCode: '39' }
      };
    }
    const props = joyPropNames[component] || [];
    const fallback = ['b', 'a', 'y', 'x', 'l', 'r'];
    const binding = { type: 'joy' };
    props.forEach((prop, index) => { binding[prop] = fallback[index] || 'b'; });
    return binding;
  }

  function renderGrids() {
    const preset = getCurrentPreset();
    refs.landscapeGrid.innerHTML = '';
    refs.portraitGrid.innerHTML = '';
    if (!preset) {
      updateGridAspectRatios();
      return;
    }

    const { landscape, portrait } = preset.layout;
    const landscapeStage = refs.landscapeGrid.closest('.grid-stage');
    const portraitStage = refs.portraitGrid.closest('.grid-stage');
    landscapeStage.style.setProperty('--cols', landscape.columns);
    landscapeStage.style.setProperty('--rows', landscape.rows);
    portraitStage.style.setProperty('--cols', portrait.columns);
    portraitStage.style.setProperty('--rows', portrait.rows);

    getCurrentElements().forEach(element => {
      ['landscape', 'portrait'].forEach(orientation => {
        const grid = orientation === 'landscape' ? refs.landscapeGrid : refs.portraitGrid;
        grid.appendChild(buildGridElement(element, orientation));
      });
    });

    updateGridAspectRatios();
  }

  function buildGridElement(element, orientation) {
    const preset = getCurrentPreset();
    const layout = preset.layout[orientation];
    const runtimeId = getElementRuntimeId(element);
    const gridEl = document.createElement('div');
    gridEl.className = 'grid-element' + (state.selectedElementId === runtimeId ? ' selected' : '');
    gridEl.dataset.id = runtimeId;
    gridEl.dataset.orientation = orientation;
    // Show all labels for multi-button components, single label for others
    const meta = componentMeta[element.component] || componentMeta.SingleTouchButton;
    if (element.component === 'TouchpadComponent') {
      const style = element.options?.style ?? 'filled';
      gridEl.dataset.touchpadStyle = style;

      const hasExplicitLabel = element.options && Object.prototype.hasOwnProperty.call(element.options, 'label');
      const rawLabel = hasExplicitLabel ? element.options.label ?? '' : '';
      const trimmedLabel = typeof rawLabel === 'string' ? rawLabel.trim() : '';

      let displayLabel = '';
      if (style === 'filled' || style === 'tab') {
        displayLabel = hasExplicitLabel ? trimmedLabel : TOUCHPAD_DEFAULT_LABEL;
      } else {
        displayLabel = hasExplicitLabel ? trimmedLabel : '';
      }

      gridEl.textContent = displayLabel;
    } else if (element.component === 'QuickshotComponent') {
      const mode = element.options?.mode ?? 'nostalgist';
      const hasExplicitLabel = element.options && Object.prototype.hasOwnProperty.call(element.options, 'label');
      const customLabel = hasExplicitLabel ? (element.options.label ?? '').trim() : '';
      const displayLabel = customLabel || QUICKSHOT_DEFAULT_LABEL;
      gridEl.textContent = mode === 'keyboard' ? `${displayLabel} KB` : displayLabel;
      gridEl.classList.add('quickshot-grid-preview');
    } else if (element.component === 'CursorKeysComponent') {
      gridEl.textContent = CURSOR_DEFAULT_LABEL;
      gridEl.classList.add('cursor-grid-preview');
    } else if (meta.count > 1 && element.labels) {
      gridEl.textContent = element.labels.join('/');
    } else {
      gridEl.textContent = element.label || getDefaultElementTitle(element.component);
    }

    // Add visual orientation indicator for DualTouchButton and TripleTouchButton
    if ((element.component === 'DualTouchButton' || element.component === 'TripleTouchButton') && element.options) {
      const isHorizontal = element.options.isHorizontal !== false; // default true
      const indicator = document.createElement('div');
      indicator.className = 'orientation-indicator';
      indicator.dataset.orientation = isHorizontal ? 'horizontal' : 'vertical';
      indicator.textContent = isHorizontal ? '↔' : '↕';
      indicator.title = isHorizontal ? 'Horizontal layout' : 'Vertical layout';
      gridEl.appendChild(indicator);
    }

    positionGridElement(gridEl, element.areas[orientation], layout);

    gridEl.addEventListener('pointerdown', handleElementPointerDown);
    gridEl.addEventListener('dblclick', () => {
      setActiveOrientation(orientation);
      state.selectedElementId = runtimeId;
      populateElementForm(element);
      renderElementList();
      highlightSelectedElement();
    });

    ['top-left', 'top-right', 'bottom-left', 'bottom-right'].forEach(handle => {
      const handleEl = document.createElement('div');
      handleEl.className = 'resize-handle';
      handleEl.dataset.handle = handle;
      handleEl.addEventListener('pointerdown', handleResizePointerDown);
      gridEl.appendChild(handleEl);
    });

    return gridEl;
  }

  function positionGridElement(el, area, layout) {
    const widthPercent = (area.colSpan / layout.columns) * 100;
    const heightPercent = (area.rowSpan / layout.rows) * 100;
    const leftPercent = (area.col / layout.columns) * 100;
    const topPercent = (area.row / layout.rows) * 100;
    el.style.width = `${widthPercent}%`;
    el.style.height = `${heightPercent}%`;
    el.style.left = `${leftPercent}%`;
    el.style.top = `${topPercent}%`;
  }

  function handleElementPointerDown(event) {
    const id = event.currentTarget.dataset.id;
    const orientation = event.currentTarget.dataset.orientation;
    const preset = getCurrentPreset();
    if (!preset) return;
    const element = getElementById(id);
    if (!element) return;

    setActiveOrientation(orientation);
    state.dragging = {
      type: 'move',
      id,
      orientation,
      startPointer: { x: event.clientX, y: event.clientY },
      startArea: { ...element.areas[orientation] }
    };

    state.selectedElementId = id;
    populateElementForm(element);
    renderElementList();
    highlightSelectedElement();

    window.addEventListener('pointermove', pointerMoveHandler);
    window.addEventListener('pointerup', pointerUpHandler, { once: true });
    event.preventDefault();
  }

  function createDimensionIndicator(element) {
    const indicator = document.createElement('div');
    indicator.className = 'dimension-indicator';
    element.appendChild(indicator);
    return indicator;
  }

  function updateDimensionIndicator(element, area) {
    let indicator = element.querySelector('.dimension-indicator');
    if (!indicator) {
      indicator = createDimensionIndicator(element);
    }
    indicator.textContent = `${area.colSpan} × ${area.rowSpan}`;
  }

  function removeDimensionIndicator(element) {
    const indicator = element.querySelector('.dimension-indicator');
    if (indicator) {
      indicator.remove();
    }
  }

  function handleResizePointerDown(event) {
    event.stopPropagation();
    const parent = event.currentTarget.parentElement;
    const id = parent.dataset.id;
    const orientation = parent.dataset.orientation;
    const preset = getCurrentPreset();
    if (!preset) return;
    const element = getElementById(id);
    if (!element) return;

    setActiveOrientation(orientation);
    state.dragging = {
      type: 'resize',
      handle: event.currentTarget.dataset.handle,
      id,
      orientation,
      startPointer: { x: event.clientX, y: event.clientY },
      startArea: { ...element.areas[orientation] }
    };

    // Show dimension indicator
    updateDimensionIndicator(parent, element.areas[orientation]);

    window.addEventListener('pointermove', pointerMoveHandler);
    window.addEventListener('pointerup', pointerUpHandler, { once: true });
    event.preventDefault();
  }

  function pointerMoveHandler(event) {
    if (!state.dragging) return;
    const preset = getCurrentPreset();
    if (!preset) return;
    const element = getElementById(state.dragging.id);
    if (!element) return;

    const orientation = state.dragging.orientation;
    const layout = preset.layout[orientation];
    const gridRect = (orientation === 'landscape' ? refs.landscapeGrid : refs.portraitGrid).getBoundingClientRect();
    const deltaX = event.clientX - state.dragging.startPointer.x;
    const deltaY = event.clientY - state.dragging.startPointer.y;
    const cellWidth = gridRect.width / layout.columns;
    const cellHeight = gridRect.height / layout.rows;

    if (state.dragging.type === 'move') {
      const area = element.areas[orientation];
      let newCol = Math.round(state.dragging.startArea.col + deltaX / cellWidth);
      let newRow = Math.round(state.dragging.startArea.row + deltaY / cellHeight);
      newCol = clamp(newCol, 0, layout.columns - area.colSpan);
      newRow = clamp(newRow, 0, layout.rows - area.rowSpan);
      area.col = newCol;
      area.row = newRow;
    } else if (state.dragging.type === 'resize') {
      resizeArea(element.areas[orientation], state.dragging.startArea, layout, deltaX / cellWidth, deltaY / cellHeight, state.dragging.handle);
      // Update dimension indicator during resize
      const gridEl = document.querySelector(`[data-id="${getElementRuntimeId(element)}"][data-orientation="${orientation}"]`);
      if (gridEl) {
        updateDimensionIndicator(gridEl, element.areas[orientation]);
      }
    }

    updateGridElementPosition(getElementRuntimeId(element));
  }

  function pointerUpHandler() {
    const hadDragging = !!state.dragging;
    if (state.dragging && state.dragging.type === 'resize') {
      // Remove dimension indicator when resize ends
      const gridEl = document.querySelector(`[data-id="${state.dragging.id}"][data-orientation="${state.dragging.orientation}"]`);
      if (gridEl) {
        removeDimensionIndicator(gridEl);
      }
    }
    state.dragging = null;
    window.removeEventListener('pointermove', pointerMoveHandler);
    if (hadDragging) {
      commitStateChange();
    }
  }

  function resizeArea(target, startArea, layout, deltaCols, deltaRows, handle) {
    let col = startArea.col;
    let row = startArea.row;
    let colSpan = startArea.colSpan;
    let rowSpan = startArea.rowSpan;

    const colDelta = Math.round(deltaCols);
    const rowDelta = Math.round(deltaRows);

    switch (handle) {
      case 'top-left':
        col += colDelta;
        row += rowDelta;
        colSpan -= colDelta;
        rowSpan -= rowDelta;
        break;
      case 'top-right':
        row += rowDelta;
        colSpan += colDelta;
        rowSpan -= rowDelta;
        break;
      case 'bottom-left':
        col += colDelta;
        colSpan -= colDelta;
        rowSpan += rowDelta;
        break;
      case 'bottom-right':
        colSpan += colDelta;
        rowSpan += rowDelta;
        break;
    }

    colSpan = clamp(colSpan, 1, layout.columns);
    rowSpan = clamp(rowSpan, 1, layout.rows);
    col = clamp(col, 0, layout.columns - colSpan);
    row = clamp(row, 0, layout.rows - rowSpan);

    target.col = col;
    target.row = row;
    target.colSpan = colSpan;
    target.rowSpan = rowSpan;
  }

  function updateGridElementPosition(id) {
    const element = getElementById(id);
    if (!element) return;
    const preset = getCurrentPreset();
    const landscapeEl = refs.landscapeGrid.querySelector(`.grid-element[data-id="${id}"]`);
    const portraitEl = refs.portraitGrid.querySelector(`.grid-element[data-id="${id}"]`);
    if (landscapeEl) positionGridElement(landscapeEl, element.areas.landscape, preset.layout.landscape);
    if (portraitEl) positionGridElement(portraitEl, element.areas.portrait, preset.layout.portrait);
  }

  function highlightSelectedElement() {
    document.querySelectorAll('.grid-element').forEach(el => {
      el.classList.toggle('selected', el.dataset.id === state.selectedElementId);
    });
  }

  function addElement() {
    const preset = getCurrentPreset();
    if (!preset) {
      showToast('Create or select a preset first', 2000);
      return;
    }

    const element = collectElementFormData(null);
    if (!element) return;

    preset.elements.push(element);
    state.selectedElementId = getElementRuntimeId(element);
    renderElementList();
    renderGrids();
    populateElementForm(element);
    highlightSelectedElement();
    updateElementButtonsState();
    showToast('Element added');
    commitStateChange();
  }

  function updateElement() {
    const preset = getCurrentPreset();
    if (!preset) {
      showToast('Create or select a preset first', 2000);
      return;
    }

    const selectedId = state.selectedElementId;
    if (!selectedId) {
      showToast('Select an element to update', 2000);
      return;
    }

    const existing = getElementById(selectedId);
    if (!existing) {
      showToast('Selected element no longer exists');
      state.selectedElementId = null;
      updateElementButtonsState();
      renderElementList();
      return;
    }

    const updatedElement = collectElementFormData(existing);
    if (!updatedElement) return;

    const index = preset.elements.findIndex(el => getElementRuntimeId(el) === selectedId);
    preset.elements[index] = updatedElement;

    state.selectedElementId = getElementRuntimeId(updatedElement);
    renderElementList();
    renderGrids();
    populateElementForm(updatedElement);
    highlightSelectedElement();
    updateElementButtonsState();
    showToast('Element updated');
    commitStateChange();
  }

  function copyElement(sourceId) {
    const sourceElement = getElementById(sourceId);
    if (!sourceElement) {
      showToast('Element not found');
      return;
    }

    const copiedElement = cloneValue(sourceElement);
    copiedElement.editorUid = generateElementRuntimeId();
    delete copiedElement.editorLegacyId;

    const preset = getCurrentPreset();
    if (preset) {
      preset.elements.push(copiedElement);
      state.selectedElementId = getElementRuntimeId(copiedElement);
      populateElementForm(copiedElement);
      renderElementList();
      renderGrids();
      showToast('Element copied');
      commitStateChange();
    }
  }

  function removeElement(elementId) {
    const preset = getCurrentPreset();
    if (!preset || !preset.elements) return;

    const index = preset.elements.findIndex(el => getElementRuntimeId(el) === elementId);
    if (index !== -1) {
      preset.elements.splice(index, 1);
    }
  }

  function deleteElement() {
    if (!state.selectedElementId) {
      showToast('Select an element to delete');
      return;
    }
    removeElement(state.selectedElementId);
    state.selectedElementId = null;
    resetElementForm();
    renderElementList();
    renderGrids();
    showToast('Element removed');
    commitStateChange();
  }

  function savePresetDetails() {
    const preset = getCurrentPreset();
    if (!preset) {
      showToast('No preset selected');
      return;
    }

    const newId = inputs.presetId.value.trim();
    if (!newId) {
      showToast('Preset ID is required');
      return;
    }

    const conflict = state.presets.some(p => p.id === newId && p.id !== preset.id);
    if (conflict) {
      showToast('Preset ID already exists');
      return;
    }

    preset.id = newId;
    preset.name = inputs.presetName.value.trim();
    preset.description = inputs.presetDescription.value.trim();
    preset.gameFocus = inputs.presetGameFocus.checked;
    preset.hideAdditionalButtons = inputs.presetHideAdditionalButtons.checked;
    preset.layout.landscape.columns = parseGridSize(inputs.landscapeCols.value);
    preset.layout.landscape.rows = parseGridSize(inputs.landscapeRows.value);
    preset.layout.portrait.columns = parseGridSize(inputs.portraitCols.value);
    preset.layout.portrait.rows = parseGridSize(inputs.portraitRows.value);

    preset.elements.forEach(el => {
      ['landscape', 'portrait'].forEach(orientation => {
        const layout = preset.layout[orientation];
        const area = el.areas[orientation];
        if (!area) {
          return;
        }
        area.colSpan = clamp(area.colSpan, 1, layout.columns);
        area.rowSpan = clamp(area.rowSpan, 1, layout.rows);
        area.col = clamp(area.col, 0, layout.columns - area.colSpan);
        area.row = clamp(area.row, 0, layout.rows - area.rowSpan);
      });
    });

    state.currentPresetId = preset.id;
    updatePresetSelect();
    renderGrids();
    showToast('Preset saved');
    commitStateChange();
  }

  function createNewPreset() {
    const baseId = `preset-${state.presets.length + 1}`;
    const preset = ensurePresetLayoutModel(cloneValue(DEFAULT_PRESET));
    preset.id = baseId;
    preset.name = 'New Preset';
    state.presets.push(preset);
    state.currentPresetId = preset.id;
    updatePresetSelect();
    selectPreset(preset.id);
    showToast('Preset created');
    commitStateChange();
  }

  function deletePreset() {
    if (!state.currentPresetId) {
      showToast('No preset selected');
      return;
    }
    state.presets = state.presets.filter(p => p.id !== state.currentPresetId);
    state.currentPresetId = null;
    ensurePresetSelected();
    updatePresetSelect();
    updatePresetForm();
    renderElementList();
    renderGrids();
    resetElementForm();
    showToast('Preset deleted');
    commitStateChange();
  }

  function updateGlobalSettings() {
    state.specialLabel = inputs.specialLabel.value.trim() || 'SPECIAL';
    state.fastuiArea.landscape = inputs.fastuiLandscape.value.trim() || '36 / 1 / span 15 / span 50';
    state.fastuiArea.portrait = inputs.fastuiPortrait.value.trim() || '35 / 1 / span 15 / span 50';
  }

  const {
    generateOutput,
    downloadOutput,
    importConfigurationData,
    copyToClipboard,
    loadFromFile,
    importData,
    clearImportData
  } = window.TouchEditorImportExport.createImportExportModule({
    state,
    inputs,
    showToast,
    getCurrentPreset,
    updateGlobalSettings,
    updatePresetSelect,
    updatePresetForm,
    renderElementList,
    renderGrids,
    buildDefaultBinding,
    cloneValue,
    onImported: () => {
      refreshUiFromState();
      inputs.output.value = '';
      commitStateChange();
    }
  });

  function updateReviewSourceLink() {
    document.getElementById('reviewSourceLink').href = writeRoute({
      platform: state.sourcePlatform, preset: state.currentPresetId,
      device: state.deviceRatio === 'square' ? 'iphone' : state.deviceRatio,
      orientation: state.viewMode
    }, new URL('./', location.href)).href;
  }

  async function initializePlatformSources() {
    const select = document.getElementById('platformSelect');
    const button = document.getElementById('loadPlatformBtn');
    select.replaceChildren(...platformSources.map(platform => new Option(platform.name, platform.path)));
    const selected = platformSources.find(platform => platform.name === state.sourcePlatform);
    if (selected) select.value = selected.path;
    select.disabled = button.disabled = platformSources.length === 0;
    refreshUiFromState();
    async function loadSource(presetId = null) {
      const platform = platformSources.find(platform => platform.path === select.value);
      if (!platform) return;
      button.disabled = select.disabled = true;
      try {
        const controllers = await loadPlatformControllers(platform.path);
        if (importConfigurationData(controllers, { replace: true, sourcePlatform: platform.name })) {
          document.getElementById('exportAll').checked = true;
          if (presetId) {
            if (!state.presets.some(preset => preset.id === presetId)) throw new Error(`Unknown preset: ${presetId}`);
            selectPreset(presetId);
          }
          updateReviewSourceLink();
          showToast(`Loaded ${controllers.presets.length} presets from ${platform.name}`);
        }
      } catch (error) {
        showToast(`Platform load failed: ${error.message}`, 5000);
      } finally {
        button.disabled = select.disabled = false;
      }
    }
    button.addEventListener('click', () => loadSource());
    const query = new URLSearchParams(location.search);
    const requested = query.get('platform');
    const platform = platformSources.find(platform => platform.name === requested);
    if (requested && !platform) throw new Error(`Unknown platform: ${requested}`);
    if (platform) select.value = platform.path;
    await loadSource(query.get('preset'));
    if (DEVICE_RATIOS[query.get('device')]) setDeviceRatio(query.get('device'));
    if (['both', 'landscape', 'portrait'].includes(query.get('orientation'))) setViewMode(query.get('orientation'));
    updateReviewSourceLink();
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function detectBindingType(binding, component) {
    if (!binding) return getDefaultBindingType(component);
    if (component === 'TouchpadComponent' || component === 'QuickshotComponent' || component === 'CursorKeysComponent') return 'none';
    if (binding.type === 'keyboard') return componentMeta[component]?.supportsKeyboard ? 'keyboard' : 'custom';
    if (binding.type === 'joy') return componentMeta[component]?.supportsJoy ? 'joy' : 'custom';
    return 'custom';
  }

  function populateElementForm(element) {
    inputs.elementComponent.value = element.component || 'SingleTouchButton';
    const bindingType = detectBindingType(element.binding, element.component);
    inputs.bindingType.value = bindingType;
    updateComponentUI(element);
    updateElementButtonsState();
  }

  function resetElementForm() {
    inputs.elementComponent.value = 'SingleTouchButton';
    inputs.bindingType.value = 'keyboard';
    inputs.bindingCustom.value = '';
    updateComponentUI();
    setPresetDependentUiEnabled(!!getCurrentPreset());
    updateElementButtonsState();
  }

  function handleBindingTypeChange() {
    const existing = state.selectedElementId ? getElementById(state.selectedElementId) : null;
    renderBindingFields(inputs.elementComponent.value, inputs.bindingType.value);
    applyBindingToForm(inputs.elementComponent.value, inputs.bindingType.value, existing ? existing.binding : null);
  }

  function initialize() {
    const restored = false;
    document.getElementById('restoreDraftBtn').addEventListener('click', () => {
      canAutosave = true;
      if (restoreDraftFromStorage()) { commitStateChange(); updateReviewSourceLink(); }
    });
    if (!restored) {
      updatePresetSelect();
      updatePresetForm();
      renderElementList();
      renderGrids();
      resetElementForm();
      setViewMode('both');
      updateGridAspectRatios();
      updateElementButtonsState();
    }

    if (buttons.undo) {
      buttons.undo.addEventListener('click', undoStateChange);
    }
    if (buttons.redo) {
      buttons.redo.addEventListener('click', redoStateChange);
    }
    if (buttons.clearDraft) {
      buttons.clearDraft.addEventListener('click', clearSavedDraft);
    }
    buttons.newPreset.addEventListener('click', createNewPreset);
    buttons.deletePreset.addEventListener('click', deletePreset);
    buttons.savePreset.addEventListener('click', savePresetDetails);
    buttons.addElement.addEventListener('click', addElement);
    buttons.updateElement.addEventListener('click', updateElement);
    buttons.deleteElement.addEventListener('click', deleteElement);
    if (buttons.alignLeft) buttons.alignLeft.addEventListener('click', () => alignElements('left'));
    if (buttons.alignCenterX) buttons.alignCenterX.addEventListener('click', () => alignElements('centerX'));
    if (buttons.alignRight) buttons.alignRight.addEventListener('click', () => alignElements('right'));
    if (buttons.alignTop) buttons.alignTop.addEventListener('click', () => alignElements('top'));
    if (buttons.alignMiddle) buttons.alignMiddle.addEventListener('click', () => alignElements('middle'));
    if (buttons.alignBottom) buttons.alignBottom.addEventListener('click', () => alignElements('bottom'));
    if (buttons.distributeHorizontal) buttons.distributeHorizontal.addEventListener('click', () => distributeElements('horizontal'));
    if (buttons.distributeVertical) buttons.distributeVertical.addEventListener('click', () => distributeElements('vertical'));
    if (buttons.copyLandscapeToPortrait) {
      buttons.copyLandscapeToPortrait.addEventListener('click', () => copyElementPositionBetweenOrientations('landscape', 'portrait'));
    }
    if (buttons.copyPortraitToLandscape) {
      buttons.copyPortraitToLandscape.addEventListener('click', () => copyElementPositionBetweenOrientations('portrait', 'landscape'));
    }
    buttons.import.addEventListener('click', importData);
    buttons.clearImport.addEventListener('click', clearImportData);
    buttons.loadFile.addEventListener('click', loadFromFile);
    buttons.generate.addEventListener('click', generateOutput);
    buttons.copy.addEventListener('click', copyToClipboard);
    document.getElementById('downloadBtn').addEventListener('click', downloadOutput);

    buttons.showBoth.addEventListener('click', () => {
      setViewMode('both');
      scheduleAutosave();
    });
    buttons.showLandscape.addEventListener('click', () => {
      setViewMode('landscape');
      scheduleAutosave();
    });
    buttons.showPortrait.addEventListener('click', () => {
      setViewMode('portrait');
      scheduleAutosave();
    });
    if (buttons.toggleActiveOrientation) {
      buttons.toggleActiveOrientation.addEventListener('click', () => {
        toggleActiveOrientationForEditing();
        scheduleAutosave();
      });
    }

    refs.deviceRatio.addEventListener('change', (event) => {
      setDeviceRatio(event.target.value);
      scheduleAutosave();
    });

    // Add keyboard shortcuts
    document.addEventListener('keydown', handleKeyDown);

    inputs.specialLabel.addEventListener('input', () => {
      updateGlobalSettings();
      scheduleAutosave();
    });
    inputs.fastuiLandscape.addEventListener('input', () => {
      updateGlobalSettings();
      scheduleAutosave();
    });
    inputs.fastuiPortrait.addEventListener('input', () => {
      updateGlobalSettings();
      scheduleAutosave();
    });

    [inputs.specialLabel, inputs.fastuiLandscape, inputs.fastuiPortrait].forEach(input => {
      input.addEventListener('change', () => {
        updateGlobalSettings();
        commitStateChange();
      });
    });

    inputs.elementComponent.addEventListener('change', () => {
      const existing = state.selectedElementId ? getElementById(state.selectedElementId) : null;
      const bindingType = detectBindingType(existing ? existing.binding : null, inputs.elementComponent.value);
      inputs.bindingType.value = bindingType;
      updateComponentUI(existing);
    });

    inputs.bindingType.addEventListener('change', handleBindingTypeChange);
    if (inputs.layoutTarget) {
      inputs.layoutTarget.addEventListener('change', updateLayoutButtonsState);
    }

    refs.presetSelect.addEventListener('change', event => selectPreset(event.target.value));
    if (inputs.layoutSelect) {
      inputs.layoutSelect.addEventListener('change', event => selectLayoutVariant(event.target.value));
    }
    if (buttons.newLayout) {
      buttons.newLayout.addEventListener('click', createNewLayoutVariant);
    }
    if (buttons.duplicateLayout) {
      buttons.duplicateLayout.addEventListener('click', duplicateCurrentLayoutVariant);
    }
    if (buttons.renameLayout) {
      buttons.renameLayout.addEventListener('click', renameCurrentLayoutVariant);
    }
    if (buttons.deleteLayout) {
      buttons.deleteLayout.addEventListener('click', deleteCurrentLayoutVariant);
    }

    refs.tabButtons.forEach(btn => btn.addEventListener('click', () => setActiveTab(btn.dataset.tab)));
    setActiveTab('elements');
    if (!restored) {
      updateComponentUI();
      setPresetDependentUiEnabled(!!getCurrentPreset());
      updateElementButtonsState();
    }
    updateClearDraftButtonState();
    initializeHistory();
  }

  initialize();
  window.touchEditor = {
    inspect: getPersistentStateSnapshot,
    export: generateOutput,
    ready: initializePlatformSources().finally(() => { canAutosave = true; })
  };
  window.touchEditor.ready.catch(error => showToast(error.message, 5000));

  // Initialize zoom after a brief delay to ensure DOM is ready
  let gridZoomControls;
  setTimeout(() => {
    gridZoomControls = initializeGridZoom();
  }, 100);
})();
