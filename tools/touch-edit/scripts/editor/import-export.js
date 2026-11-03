(function attachTouchEditorImportExport(global) {
  function createImportExportModule(deps) {
    const {
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
      onImported
    } = deps;

    function generateOutput() {
      updateGlobalSettings();

      const exportSingleRadio = document.getElementById('exportSingle');
      const exportType = exportSingleRadio && exportSingleRadio.checked ? 'single' : 'all';

      let output;
      if (exportType === 'single') {
        const currentPreset = getCurrentPreset();
        if (!currentPreset) {
          showToast('No preset selected to export');
          return;
        }
        output = serializePreset(currentPreset);
      } else {
        output = {
          ...cloneValue(state.controllerMetadata || {}),
          schemaVersion: 2,
          special_button: { ...state.controllerMetadata?.special_button, label: state.specialLabel },
          fastui_area: { ...state.fastuiArea },
          presets: state.presets.map(serializePreset)
        };
      }

      const outputTextarea = document.getElementById('output');
      if (outputTextarea) {
        outputTextarea.value = JSON.stringify(output, null, 2);
      }
      showToast(`${exportType === 'single' ? 'Current preset' : 'All presets'} generated`);
      return output;
    }

    function downloadOutput() {
      const output = generateOutput();
      if (!output) return;
      const name = (output.id || state.sourcePlatform || 'custom-controllers').replace(/[^a-zA-Z0-9_-]/g, '-');
      const url = URL.createObjectURL(new Blob([JSON.stringify(output, null, 2) + '\n'], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${name}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function parseGridSize(value, fallback = 50) {
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

    function getComponentLabelCount(component) {
      const counts = {
        SingleTouchButton: 1,
        DualTouchButton: 2,
        TripleTouchButton: 3,
        QuadrupleTouchButton: 4,
        SextupleTouchButton: 6,
        TouchpadComponent: 0,
        QuickshotComponent: 0,
        CursorKeysComponent: 0
      };
      return counts[component] ?? 1;
    }

    function createEditorUid() {
      if (global.crypto && typeof global.crypto.randomUUID === 'function') {
        return global.crypto.randomUUID();
      }
      return `el-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    }

    function normalizeElementEditorData(element, options = {}) {
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
          runtimeId = createEditorUid();
        } while (usedIds && usedIds.has(runtimeId));
      }

      element.editorUid = runtimeId;
      if (usedIds) {
        usedIds.add(runtimeId);
      }

      return element;
    }

    function getDefaultElementLabels(component) {
      const labelCount = getComponentLabelCount(component);
      if (labelCount <= 0) {
        return [];
      }
      return Array.from(
        { length: labelCount },
        (_, index) => (labelCount === 1 ? 'Button' : `BTN${index + 1}`)
      );
    }

    function getPresetLayoutVariantsForSerialization(preset) {
      if (Array.isArray(preset.layouts) && preset.layouts.length) {
        const usedIds = new Set();
        return preset.layouts.map((layoutVariant, index) => {
          const source = layoutVariant && typeof layoutVariant === 'object' ? layoutVariant : {};
          const fallbackId = `layout-${index + 1}`;
          let layoutId = typeof source.id === 'string' && source.id.trim() ? source.id.trim() : fallbackId;
          let suffix = 2;
          while (usedIds.has(layoutId)) {
            layoutId = `${layoutId}-${suffix}`;
            suffix += 1;
          }
          usedIds.add(layoutId);
          return {
            ...source,
            id: layoutId,
            name: typeof source.name === 'string' && source.name.trim() ? source.name.trim() : `Layout ${index + 1}`,
            layout: normalizeLayoutDimensions(source.layout),
            elements: Array.isArray(source.elements) ? source.elements : []
          };
        });
      }

      return [{
        id: 'layout-1',
        name: 'Layout 1',
        layout: normalizeLayoutDimensions(preset.layout),
        elements: Array.isArray(preset.elements) ? preset.elements : []
      }];
    }

    function serializeElement(el) {
      const landscapeArea = el?.areas?.landscape || { col: 0, row: 0, colSpan: 8, rowSpan: 4 };
      const portraitArea = el?.areas?.portrait || { col: 0, row: 0, colSpan: 8, rowSpan: 4 };
      const entry = {
        ...cloneValue(el),
        component: el.component,
        binding: el.binding,
        gridArea: {
          landscape: toGridAreaString(landscapeArea),
          portrait: toGridAreaString(portraitArea)
        }
      };
      delete entry.areas;
      delete entry.editorUid;
      delete entry.editorLegacyId;
      if (el.editorLegacyId) entry.id = el.editorLegacyId;
      delete entry.label;
      delete entry.labels;
      if (el.labels && el.labels.length) entry.labels = el.labels;
      else if (el.label) entry.label = el.label;
      if (el.options && Object.keys(el.options).length) entry.options = el.options;
      return entry;
    }

    function serializeLayoutVariant(layoutVariant) {
      return {
        ...cloneValue(layoutVariant),
        id: layoutVariant.id,
        name: layoutVariant.name,
        layout: normalizeLayoutDimensions(layoutVariant.layout),
        elements: (layoutVariant.elements || []).map(serializeElement)
      };
    }

    function serializePreset(preset) {
      const layouts = getPresetLayoutVariantsForSerialization(preset);
      const layoutIds = new Set(layouts.map(layout => layout.id));
      const defaultLayoutId = typeof preset.defaultLayoutId === 'string' && layoutIds.has(preset.defaultLayoutId)
        ? preset.defaultLayoutId
        : layouts[0].id;
      const currentLayoutId = typeof preset.currentLayoutId === 'string' && layoutIds.has(preset.currentLayoutId)
        ? preset.currentLayoutId
        : defaultLayoutId;
      const fallbackLayout = layouts.find(layout => layout.id === defaultLayoutId) || layouts[0];
      const fallbackSerialized = serializeLayoutVariant(fallbackLayout);

      return {
        ...cloneValue(preset),
        id: preset.id,
        name: preset.name,
        description: preset.description,
        defaultLayoutId,
        currentLayoutId,
        layouts: layouts.map(serializeLayoutVariant),
        layout: fallbackSerialized.layout,
        elements: fallbackSerialized.elements
      };
    }

    function toGridAreaString(area) {
      const rowStart = area.row + 1;
      const colStart = area.col + 1;
      return `${rowStart} / ${colStart} / span ${area.rowSpan} / span ${area.colSpan}`;
    }

    function copyToClipboard() {
      const text = inputs.output.value.trim();
      if (!text) {
        showToast('Generate JSON first');
        return;
      }
      navigator.clipboard.writeText(text).then(() => showToast('JSON copied to clipboard'))
        .catch(() => showToast('Clipboard copy failed'));
    }

    function loadFromFile() {
      const fileInput = document.getElementById('fileInput');
      if (!fileInput) {
        showToast('File input not found');
        console.error('File input element not found');
        return;
      }

      const file = fileInput.files[0];
      if (!file) {
        showToast('Please select a file first');
        return;
      }

      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          const content = e.target.result;
          console.log('File loaded, parsing for custom_controllers...');

          // Extract custom_controllers section from the file
          const customControllers = extractCustomControllers(content);

          if (customControllers) {
            console.log('Found custom_controllers:', customControllers);

            // Put the extracted data into the textarea
            const importTextarea = document.getElementById('importData');
            if (importTextarea) {
              importTextarea.value = JSON.stringify(customControllers, null, 2);
            }

            // Auto-import the data
            importConfigurationData(customControllers);

            showToast(`Loaded ${customControllers.presets?.length || 0} presets from file`);
          } else {
            // Fallback: allow loading plain preset JSON/object files as well.
            try {
              const parsed = parseImportText(content);
              if (validateImportData(parsed.data, { silent: true })) {
                importConfigurationData(parsed.data);
                showToast(`Loaded ${parsed.data.presets?.length || 0} presets from file`);
                return;
              }
            } catch (fallbackError) {
              console.log('Fallback full-file parse failed:', fallbackError);
            }

            showToast('No importable controller data found in file');
          }
        } catch (error) {
          console.error('Error reading file:', error);
          showToast('Error reading file: ' + error.message);
        }
      };

      reader.onerror = function() {
        showToast('Error reading file');
      };

      reader.readAsText(file);
    }

    function extractCustomControllers(content) {
      try {
        // First try to parse as JSON
        const jsonData = JSON.parse(content);
        if (jsonData.custom_controllers) {
          return jsonData.custom_controllers;
        }
      } catch (e) {
        // Not JSON, try to extract from JavaScript file
      }

      const start = findCustomControllersObjectStart(content);
      if (start === -1) {
        console.log('No custom_controllers pattern found');
        return null;
      }

      // Find the matching closing brace
      let braceCount = 0;
      let inString = false;
      let stringChar = '';
      let escaped = false;
      let end = start;

      for (let i = start; i < content.length; i++) {
        const char = content[i];

        if (escaped) {
          escaped = false;
          continue;
        }

        if (char === '\\') {
          escaped = true;
          continue;
        }

        if (!inString) {
          if (char === '"' || char === "'") {
            inString = true;
            stringChar = char;
          } else if (char === '{') {
            braceCount++;
          } else if (char === '}') {
            braceCount--;
            if (braceCount === 0) {
              end = i;
              break;
            }
          }
        } else {
          if (char === stringChar) {
            inString = false;
          }
        }
      }

      if (braceCount !== 0) {
        console.error('Could not find matching closing brace for custom_controllers');
        return null;
      }

      let controllerStr = content.substring(start, end + 1);
      console.log('Extracted custom_controllers section length:', controllerStr.length);

      try {
        // More robust cleanup for JavaScript object literal to JSON conversion
        controllerStr = controllerStr
          // Quote unquoted keys
          .replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":')
          // Convert single quotes to double quotes (but be careful with nested quotes)
          .replace(/'/g, '"')
          // Remove trailing commas before } or ]
          .replace(/,(\s*[}\]])/g, '$1')
          // Handle undefined values
          .replace(/:\s*undefined/g, ': null');

        return JSON.parse(controllerStr);
      } catch (parseError) {
        console.error('Failed to parse extracted custom_controllers:', parseError);
        console.log('Problematic string preview:', controllerStr.substring(0, 200) + '...');

        // Try a simpler approach - use eval in a safe way
        try {
          const safeEval = new Function('return ' + controllerStr);
          return safeEval();
        } catch (evalError) {
          console.error('Eval approach also failed:', evalError);
          return null;
        }
      }
    }

    function findCustomControllersObjectStart(content) {
      // Accept both object property syntax and assignment syntax:
      // custom_controllers: { ... }, "custom_controllers": { ... }, custom_controllers = { ... }
      const keyPattern = /(?:["']custom_controllers["']|\bcustom_controllers\b)\s*[:=]/g;
      let match;
      while ((match = keyPattern.exec(content)) !== null) {
        const delimiterOffset = Math.max(match[0].lastIndexOf(':'), match[0].lastIndexOf('='));
        if (delimiterOffset === -1) continue;

        const afterDelimiter = match.index + delimiterOffset + 1;
        const objectStart = findObjectStartAfterDelimiter(content, afterDelimiter);
        if (objectStart !== -1) {
          return objectStart;
        }
      }

      return -1;
    }

    function findObjectStartAfterDelimiter(content, index) {
      let i = index;
      while (i < content.length) {
        const ch = content[i];
        const next = content[i + 1];

        if (/\s/.test(ch)) {
          i++;
          continue;
        }

        if (ch === '/' && next === '/') {
          i += 2;
          while (i < content.length && content[i] !== '\n') i++;
          continue;
        }

        if (ch === '/' && next === '*') {
          i += 2;
          while (i + 1 < content.length && !(content[i] === '*' && content[i + 1] === '/')) i++;
          i = Math.min(i + 2, content.length);
          continue;
        }

        return ch === '{' ? i : -1;
      }

      return -1;
    }

    function importData() {
      const text = inputs.importData.value.trim();
      if (!text) {
        showToast('Paste JSON data to import');
        return;
      }

      let parsed;
      try {
        parsed = parseImportText(text);
        if (parsed.converted) {
          showToast('Converted JavaScript object to JSON');
        }
      } catch (conversionErr) {
        showToast('Invalid JSON or JavaScript object format');
        return;
      }

      const data = parsed.data;

      if (!validateImportData(data)) {
        return;
      }

      try {
        importConfigurationData(data);
        showToast('Data imported successfully');
        inputs.importData.value = '';
      } catch (err) {
        showToast('Import failed: ' + err.message);
      }
    }

    function parseImportText(text) {
      let data;
      let converted = false;

      try {
        data = JSON.parse(text);
      } catch (err) {
        const jsObjectText = convertJSObjectToJSON(text);
        data = JSON.parse(jsObjectText);
        converted = true;
      }

      return { data: normalizeImportData(data), converted };
    }

    function normalizeImportData(data) {
      if (!data || typeof data !== 'object') {
        return data;
      }

      if (Array.isArray(data)) {
        return data.every(isPresetLikeObject) ? { presets: data } : data;
      }

      if (data.custom_controllers && typeof data.custom_controllers === 'object') {
        return data.custom_controllers;
      }

      if (Array.isArray(data.presets)) {
        return data;
      }

      if (isPresetLikeObject(data)) {
        return { presets: [data] };
      }

      return data;
    }

    function isPresetLikeObject(value) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return false;
      }

      const hasId = typeof value.id === 'string' && value.id.trim().length > 0;
      const hasLegacyLayout = !!(value.layout && value.layout.landscape && value.layout.portrait && Array.isArray(value.elements));
      const hasLayouts = Array.isArray(value.layouts) && value.layouts.length > 0;
      return hasId && (hasLegacyLayout || hasLayouts);
    }

    function validateImportData(data, options = {}) {
      const { silent = false } = options;

      if (!data || typeof data !== 'object') {
        if (!silent) showToast('Invalid data structure');
        return false;
      }

      if (!data.presets || !Array.isArray(data.presets)) {
        if (!silent) showToast('No presets found in data');
        return false;
      }

      // Validate each preset has required fields
      for (let i = 0; i < data.presets.length; i++) {
        const preset = data.presets[i];
        const hasId = typeof preset.id === 'string' && preset.id.trim().length > 0;
        const hasLegacyLayout = !!(preset.layout && preset.layout.landscape && preset.layout.portrait && Array.isArray(preset.elements));
        const hasLayouts = Array.isArray(preset.layouts) && preset.layouts.length > 0;
        if (!hasId || (!hasLegacyLayout && !hasLayouts)) {
          if (!silent) showToast(`Invalid preset structure at index ${i}`);
          return false;
        }
      }

      return true;
    }

    function importConfigurationData(data, { replace = false, sourcePlatform = null } = {}) {
      data = normalizeImportData(cloneValue(data));
      if (!validateImportData(data)) return false;
      // Deserialize before changing the workspace so a failed load keeps drafts.
      const importedPresets = data.presets.map(deserializePreset);
      const { presets, ...metadata } = data;
      if (replace) {
        state.presets = [];
        state.currentPresetId = null;
        state.selectedElementId = null;
        state.specialLabel = 'SPECIAL';
        state.fastuiArea = {
          landscape: '1 / 1 / span 50 / span 50',
          portrait: '1 / 1 / span 50 / span 50'
        };
      }
      state.sourcePlatform = sourcePlatform;
      state.controllerMetadata = replace ? metadata : { ...state.controllerMetadata, ...metadata };
      console.log('Importing data:', data);

      // Import global settings if present
      if (data.special_button && data.special_button.label) {
        state.specialLabel = data.special_button.label;
        inputs.specialLabel.value = state.specialLabel;
      }

      if (data.fastui_area) {
        if (data.fastui_area.landscape) {
          state.fastuiArea.landscape = data.fastui_area.landscape;
          inputs.fastuiLandscape.value = state.fastuiArea.landscape;
        }
        if (data.fastui_area.portrait) {
          state.fastuiArea.portrait = data.fastui_area.portrait;
          inputs.fastuiPortrait.value = state.fastuiArea.portrait;
        }
      }
      inputs.specialLabel.value = state.specialLabel;
      inputs.fastuiLandscape.value = state.fastuiArea.landscape;
      inputs.fastuiPortrait.value = state.fastuiArea.portrait;

      // Import presets
      console.log('Imported presets:', importedPresets);

      // Check for ID conflicts and resolve them
      const usedPresetIds = new Set(state.presets.map(preset => preset.id));
      importedPresets.forEach(importedPreset => {
        let baseId = importedPreset.id;
        let counter = 1;
        while (usedPresetIds.has(importedPreset.id)) {
          importedPreset.id = `${baseId}-imported-${counter}`;
          counter++;
        }
        usedPresetIds.add(importedPreset.id);
      });

      // Add imported presets to existing ones
      state.presets.push(...importedPresets);

      // Always select the first imported preset (user likely wants to see what they imported)
      if (importedPresets.length > 0) {
        state.currentPresetId = importedPresets[0].id;
        console.log('Switching to imported preset:', importedPresets[0].id);
      }

      console.log('Final state.presets:', state.presets);
      console.log('Current preset ID after import:', state.currentPresetId);

      updatePresetSelect();
      updatePresetForm();
      renderElementList();
      renderGrids();

      if (typeof onImported === 'function') {
        onImported();
      }
      return true;
    }

    function deserializePreset(serializedPreset) {
      console.log('Deserializing preset:', serializedPreset);

      const preset = {
        ...cloneValue(serializedPreset),
        id: serializedPreset.id,
        name: serializedPreset.name || serializedPreset.id,
        description: serializedPreset.description || '',
        defaultLayoutId: null,
        currentLayoutId: null,
        layouts: [],
        layout: normalizeLayoutDimensions(serializedPreset.layout),
        elements: []
      };

      if (Array.isArray(serializedPreset.layouts) && serializedPreset.layouts.length) {
        preset.layouts = serializedPreset.layouts.map((layoutVariant, index) => deserializeLayoutVariant(layoutVariant, index));
      } else {
        preset.layouts = [deserializeLayoutVariant({
          id: 'layout-1',
          name: 'Layout 1',
          layout: serializedPreset.layout,
          elements: serializedPreset.elements
        }, 0)];
      }

      const usedIds = new Set();
      preset.layouts.forEach((layoutVariant, index) => {
        const baseId = typeof layoutVariant.id === 'string' && layoutVariant.id.trim()
          ? layoutVariant.id.trim()
          : `layout-${index + 1}`;
        let nextId = baseId;
        let suffix = 2;
        while (usedIds.has(nextId)) {
          nextId = `${baseId}-${suffix}`;
          suffix += 1;
        }
        layoutVariant.id = nextId;
        usedIds.add(nextId);
      });

      const layoutIds = new Set(preset.layouts.map(layoutVariant => layoutVariant.id));
      preset.defaultLayoutId = typeof serializedPreset.defaultLayoutId === 'string' && layoutIds.has(serializedPreset.defaultLayoutId)
        ? serializedPreset.defaultLayoutId
        : preset.layouts[0].id;
      preset.currentLayoutId = typeof serializedPreset.currentLayoutId === 'string' && layoutIds.has(serializedPreset.currentLayoutId)
        ? serializedPreset.currentLayoutId
        : preset.defaultLayoutId;

      const activeLayout = preset.layouts.find(layoutVariant => layoutVariant.id === preset.currentLayoutId) || preset.layouts[0];
      preset.currentLayoutId = activeLayout.id;
      preset.layout = activeLayout.layout;
      preset.elements = activeLayout.elements;

      return preset;
    }

    function deserializeLayoutVariant(serializedLayoutVariant, index = 0) {
      const source = serializedLayoutVariant && typeof serializedLayoutVariant === 'object'
        ? serializedLayoutVariant
        : {};
      const sourceLayout = source.layout && typeof source.layout === 'object'
        ? source.layout
        : source;
      const usedIds = new Set();

      return {
        ...cloneValue(source),
        id: typeof source.id === 'string' && source.id.trim() ? source.id.trim() : `layout-${index + 1}`,
        name: typeof source.name === 'string' && source.name.trim() ? source.name.trim() : `Layout ${index + 1}`,
        layout: normalizeLayoutDimensions(sourceLayout),
        elements: Array.isArray(source.elements)
          ? source.elements.map(element => deserializeElement(element, usedIds))
          : []
      };
    }

    function deserializeElement(serializedElement, usedIds = null) {
      const component = serializedElement.component || 'SingleTouchButton';
      const element = normalizeElementEditorData({
        ...cloneValue(serializedElement),
        component,
        binding: Object.prototype.hasOwnProperty.call(serializedElement, 'binding')
          ? serializedElement.binding : buildDefaultBinding(component),
        areas: {
          landscape: { col: 0, row: 0, colSpan: 8, rowSpan: 4 },
          portrait: { col: 0, row: 0, colSpan: 8, rowSpan: 4 }
        }
      }, { usedIds });

      // Handle labels
      if (serializedElement.labels && Array.isArray(serializedElement.labels)) {
        element.labels = serializedElement.labels;
        element.label = serializedElement.labels[0];
      } else if (serializedElement.label) {
        element.label = serializedElement.label;
      }

      const labelCount = getComponentLabelCount(element.component);
      const defaultLabels = getDefaultElementLabels(element.component);
      if (labelCount > 1) {
        const sourceLabels = Array.isArray(element.labels) ? element.labels : [element.label || defaultLabels[0]];
        element.labels = Array.from({ length: labelCount }, (_, index) => sourceLabels[index] || defaultLabels[index]);
        element.label = element.labels[0];
      } else if (labelCount === 1) {
        element.label = element.label || defaultLabels[0];
        delete element.labels;
      }

      // Parse grid areas if present
      if (serializedElement.gridArea) {
        if (serializedElement.gridArea.landscape) {
          element.areas.landscape = parseGridAreaString(serializedElement.gridArea.landscape);
        }
        if (serializedElement.gridArea.portrait) {
          element.areas.portrait = parseGridAreaString(serializedElement.gridArea.portrait);
        }
      }

      if (serializedElement.options && typeof serializedElement.options === 'object') {
        element.options = cloneValue(serializedElement.options);
      }

      return normalizeElementEditorData(element, { usedIds });
    }

    function parseGridAreaString(gridAreaString) {
      // Parse "row / col / span rowSpan / span colSpan" format
      const parts = gridAreaString.split(' / ').map(s => s.trim());
      if (parts.length !== 4) {
        return { col: 0, row: 0, colSpan: 8, rowSpan: 4 };
      }

      const row = Math.max(0, parseInt(parts[0], 10) - 1);
      const col = Math.max(0, parseInt(parts[1], 10) - 1);
      const rowSpan = parts[2].startsWith('span ') ? parseInt(parts[2].substring(5), 10) : 2;
      const colSpan = parts[3].startsWith('span ') ? parseInt(parts[3].substring(5), 10) : 4;

      return { col, row, colSpan: Math.max(1, colSpan), rowSpan: Math.max(1, rowSpan) };
    }

    function clearImportData() {
      inputs.importData.value = '';
    }

    function convertJSObjectToJSON(jsObjectText) {
      let text = jsObjectText.trim();

      // Fix incomplete objects by adding missing closing brackets
      text = fixIncompleteObject(text);

      try {
        // Use a more robust approach with eval() in a safe context
        // This handles complex JavaScript object literals properly
        const safeEval = new Function('return (' + text + ')');
        const jsObject = safeEval();
        return JSON.stringify(jsObject);
      } catch (evalError) {
        console.warn('JavaScript evaluation failed:', evalError);
        // Fallback to regex-based conversion
        return text
          // Replace single quotes with double quotes (simple approach)
          .replace(/'/g, '"')
          // Fix unquoted property names
          .replace(/\b([a-zA-Z_$][a-zA-Z0-9_$-]*)\s*:/g, '"$1":')
          // Remove trailing commas
          .replace(/,(\s*[}\]])/g, '$1')
          // Fix common JavaScript literals
          .replace(/:\s*undefined\b/g, ': null')
          .replace(/:\s*true\b/g, ': true')
          .replace(/:\s*false\b/g, ': false');
      }
    }

    function fixIncompleteObject(text) {
      // Count opening and closing brackets
      let braceCount = 0;
      let bracketCount = 0;
      let inString = false;
      let escapeNext = false;

      for (let i = 0; i < text.length; i++) {
        const char = text[i];

        if (escapeNext) {
          escapeNext = false;
          continue;
        }

        if (char === '\\') {
          escapeNext = true;
          continue;
        }

        if (char === '"' || char === "'") {
          inString = !inString;
          continue;
        }

        if (!inString) {
          if (char === '{') braceCount++;
          else if (char === '}') braceCount--;
          else if (char === '[') bracketCount++;
          else if (char === ']') bracketCount--;
        }
      }

      // Add missing closing brackets
      let fixed = text;
      for (let i = 0; i < bracketCount; i++) {
        fixed += ']';
      }
      for (let i = 0; i < braceCount; i++) {
        fixed += '}';
      }

      return fixed;
    }

    return {
      generateOutput,
      downloadOutput,
      importConfigurationData,
      copyToClipboard,
      loadFromFile,
      importData,
      clearImportData
    };
  }

  global.TouchEditorImportExport = { createImportExportModule };
})(window);
