class GameFocusManager {
    static #instance = null;
    #isGameFocusOn;
    #wantsGameFocus;
    #nostalgist;
    #listeners = new Set();
    #handleKeydownBound;
    #handleVisibilityChangeBound;
    #handleWindowBlurBound;
    #handleWindowFocusBound;
    #handlePointerLockChangeBound;
  
    constructor(nostalgist, initialState = false) {
      if (GameFocusManager.#instance) {
        throw new Error('Assertion error.');
      }
      this.#nostalgist = nostalgist;
      this.#isGameFocusOn = initialState;
      this.#wantsGameFocus = initialState;
      this.#handleKeydownBound = this.#handleKeydown.bind(this);
      this.#handleVisibilityChangeBound = this.#handleVisibilityChange.bind(this);
      this.#handleWindowBlurBound = this.#handleWindowBlur.bind(this);
      this.#handleWindowFocusBound = this.#handleWindowFocus.bind(this);
      this.#handlePointerLockChangeBound = this.#handlePointerLockChange.bind(this);
      window.addEventListener('keydown', this.#handleKeydownBound, true);
      document.addEventListener('visibilitychange', this.#handleVisibilityChangeBound);
      window.addEventListener('blur', this.#handleWindowBlurBound);
      window.addEventListener('focus', this.#handleWindowFocusBound);
      document.addEventListener('pointerlockchange', this.#handlePointerLockChangeBound);
      GameFocusManager.#instance = this;
    }
  
    static initialize(nostalgist, initialState = false) {
      if (!GameFocusManager.#instance) {
        GameFocusManager.#instance = new GameFocusManager(nostalgist, initialState);
      }
      return GameFocusManager.#instance;
    }
  
    static getInstance() {
      if (!GameFocusManager.#instance) {
        throw new Error('Assertion error.');
      }
      return GameFocusManager.#instance;
    }
  
    onChange(callback) {
      this.#listeners.add(callback);
      return () => {
        this.#listeners.delete(callback);
      };
    }
  
    isEnabled() {
      return this.#isGameFocusOn;
    }
  
    #emit(source) {
      this.#listeners.forEach((listener) => {
        listener(this.#isGameFocusOn, source);
      });
    }
  
    #setState(nextState, { sendCommand = true, source = 'ui' } = {}) {
      if (this.#isGameFocusOn === nextState) {
        return;
      }
      this.#isGameFocusOn = nextState;
      if (sendCommand) {
        this.#sendCommand();
      }
      this.#emit(source);
    }
  
    enable() {
      this.#wantsGameFocus = true;
      this.#setState(true);
    }
  
    disable() {
      this.#wantsGameFocus = false;
      this.#setState(false);
    }
  
    syncState(nextState, source = 'external') {
      this.#setState(nextState, { sendCommand: false, source });
    }
  
    #sendCommand() {
      this.#nostalgist.sendCommand('GAME_FOCUS_TOGGLE');
    }
  
    #handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        if (this.#isGameFocusOn) {
          this.#setState(false, { sendCommand: false, source: 'visibility' });
        }
      } else if (this.#wantsGameFocus && !this.#isGameFocusOn) {
        this.#setState(true, { sendCommand: true, source: 'visibility' });
      }
    }
  
    #handleWindowBlur() {
      if (this.#isGameFocusOn) {
        this.#setState(false, { sendCommand: false, source: 'window-blur' });
      }
    }
  
    #handleWindowFocus() {
      if (this.#wantsGameFocus && !this.#isGameFocusOn) {
        this.#setState(true, { sendCommand: true, source: 'window-focus' });
      }
    }

    #handleKeydown(event) {
      if (!event.isTrusted || event.repeat) {
        return;
      }

      const activeElement = document.activeElement;
      if (activeElement && activeElement.closest && activeElement.closest('#desktopUi')) {
        return;
      }

      const key = event.code || event.key;
      if (key === 'Escape' && this.#isGameFocusOn) {
        this.#wantsGameFocus = false;
        this.#setState(false, { sendCommand: false, source: 'keyboard' });
      }
    }

    #handlePointerLockChange() {
      if (!document.pointerLockElement && this.#isGameFocusOn) {
        this.#wantsGameFocus = false;
        this.#setState(false, { sendCommand: false, source: 'pointer-lock' });
      }
    }
  }
  
  export default GameFocusManager;
