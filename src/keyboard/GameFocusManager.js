class GameFocusManager {
    static #instance = null;
    #isGameFocusOn;
    #nostalgist;
  
    constructor(nostalgist, initialState = false) {
      if (GameFocusManager.#instance) {
        throw new Error('Assertion error.');
      }
      this.#nostalgist = nostalgist;
      this.#isGameFocusOn = initialState;
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
  
    #toggle() {
      this.#isGameFocusOn = !this.#isGameFocusOn;
      this.#sendCommand();
    }
  
    enable() {
      if (!this.#isGameFocusOn) {
        this.#toggle();
      } 
    }
  
    disable() {
      if (this.#isGameFocusOn) {
        this.#toggle();
      }
    }
  
    #sendCommand() {
      this.#nostalgist.sendCommand('GAME_FOCUS_TOGGLE');
    }
  }
  
  export default GameFocusManager;