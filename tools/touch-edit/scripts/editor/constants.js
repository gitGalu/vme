(function attachTouchEditorConstants(global) {
  const DEFAULT_PRESET = {
    id: 'new-preset',
    name: 'New Preset',
    description: '',
    gameFocus: true,
    layout: {
      landscape: { columns: 50, rows: 50 },
      portrait: { columns: 50, rows: 50 }
    },
    elements: []
  };

  const TOUCHPAD_DEFAULT_LABEL = 'TOUCHPAD';
  const QUICKSHOT_DEFAULT_LABEL = 'QUICKSHOT';
  const CURSOR_DEFAULT_LABEL = 'CURSOR';
  const DEFAULT_CURSOR_KEYMAP = Object.freeze({
    up: { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
    down: { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
    left: { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 },
    right: { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 }
  });

  const componentMeta = {
    SingleTouchButton: { count: 1, supportsKeyboard: true, supportsJoy: true },
    DualTouchButton: { count: 2, supportsKeyboard: true, supportsJoy: true },
    TripleTouchButton: { count: 3, supportsKeyboard: true, supportsJoy: true },
    QuadrupleTouchButton: { count: 4, supportsKeyboard: true, supportsJoy: true },
    SextupleTouchButton: { count: 6, supportsKeyboard: false, supportsJoy: true },
    TouchpadComponent: { count: 0, supportsKeyboard: false, supportsJoy: false },
    QuickshotComponent: { count: 0, supportsKeyboard: false, supportsJoy: false },
    CursorKeysComponent: { count: 0, supportsKeyboard: false, supportsJoy: false }
  };

  const joyPropNames = {
    SingleTouchButton: ['press'],
    DualTouchButton: ['primary', 'secondary'],
    TripleTouchButton: ['input1', 'input2', 'input3'],
    QuadrupleTouchButton: ['input1', 'input2', 'input3', 'input4'],
    SextupleTouchButton: ['input1', 'input2', 'input3', 'input4', 'input5', 'input6']
  };

  const keyboardPropNames = {
    SingleTouchButton: ['key'],
    DualTouchButton: ['primary', 'secondary'],
    TripleTouchButton: ['input1', 'input2', 'input3'],
    QuadrupleTouchButton: ['input1', 'input2', 'input3', 'input4']
  };

  const DEVICE_RATIOS = {
    android: {
      landscape: { width: 915, height: 412 },
      portrait: { width: 412, height: 915 }
    },
    iphone: {
      landscape: { width: 19.5, height: 9 },  // Modern iPhone landscape
      portrait: { width: 9, height: 19.5 }    // Modern iPhone portrait
    },
    ipad: {
      landscape: { width: 4, height: 3 },      // iPad landscape
      portrait: { width: 3, height: 4 }       // iPad portrait
    },
    square: {
      landscape: { width: 1, height: 1 },      // Square for testing
      portrait: { width: 1, height: 1 }
    }
  };

  global.TouchEditorConstants = {
    DEFAULT_PRESET,
    TOUCHPAD_DEFAULT_LABEL,
    QUICKSHOT_DEFAULT_LABEL,
    CURSOR_DEFAULT_LABEL,
    DEFAULT_CURSOR_KEYMAP,
    componentMeta,
    joyPropNames,
    keyboardPropNames,
    DEVICE_RATIOS
  };
})(window);
