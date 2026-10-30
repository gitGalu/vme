const assert = (value, message) => { if (!value) throw new Error(message); };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const overlay = () => document.getElementById('vme-splash');
const key = (value, code = value) => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: value, code, bubbles: true, cancelable: true }));
    document.dispatchEvent(new KeyboardEvent('keyup', { key: value, code, bubbles: true }));
};
const type = text => {
    document.getElementById('cors_query').textContent = '';
    for (const value of text) key(value, `Key${value.toUpperCase()}`);
};
async function until(predicate, message, timeout = 10000) {
    const deadline = performance.now() + timeout;
    while (!predicate()) {
        if (performance.now() > deadline) throw new Error(message);
        await wait(20);
    }
}

// Model a GPU that produces NaN for GLSL pow(negative, exponent), which is
// permitted by GLSL. Read the actual final framebuffer so a black 3D render
// cannot pass merely because the HTML caption and lifecycle still work.
export async function runSplashRenderingTests() {
    assert(!overlay(), 'Close the current splash before testing rendering');
    assert(!matchMedia('(prefers-reduced-motion: reduce)').matches, 'Run the rendering test without reduced motion');
    const prototype = WebGL2RenderingContext.prototype;
    const shaderSource = prototype.shaderSource;
    const drawArrays = prototype.drawArrays;
    let firstFrame = null;
    let sampled = false;
    let instrumentedShaders = 0;
    let sample;
    const capture = new Promise(resolve => { sample = resolve; });
    prototype.shaderSource = function (shader, source) {
        if (source.includes('vLogoLocal') && this.getShaderParameter(shader, this.SHADER_TYPE) === this.FRAGMENT_SHADER) {
            instrumentedShaders++;
            source = source.replace(/exp\(-pow\(/g, 'exp(-vmeStrictPow(');
            source = source.replace('void main() {',
                'float vmeStrictPow(float x,float y){return x<0.0?uintBitsToFloat(0x7fc00000u):pow(x,y);}\nvoid main() {');
        }
        return shaderSource.call(this, shader, source);
    };
    prototype.drawArrays = function (...args) {
        const result = drawArrays.apply(this, args);
        if (sampled || this.canvas.getRootNode().host?.id !== 'vme-splash' || this.getParameter(this.FRAMEBUFFER_BINDING) !== null) return result;
        firstFrame ??= performance.now();
        if (performance.now() - firstFrame < 4300) return result;
        const width = this.drawingBufferWidth, height = this.drawingBufferHeight;
        const pixels = new Uint8Array(width * height * 4);
        this.readPixels(0, 0, width, height, this.RGBA, this.UNSIGNED_BYTE, pixels);
        let coloredPixels = 0;
        for (let i = 0; i < pixels.length; i += 4) {
            const red = pixels[i], green = pixels[i + 1], blue = pixels[i + 2];
            if (Math.max(green, blue) > 24 && green + blue > red * 2.5) coloredPixels++;
        }
        sampled = true;
        sample({ coloredPixels, totalPixels: width * height, instrumentedShaders });
        return result;
    };
    try {
        type('splash');
        key('Enter');
        let timeout;
        const deadline = new Promise((resolve, reject) => { timeout = setTimeout(() => reject(new Error('No rendered frame was captured')), 12000); });
        let result;
        try { result = await Promise.race([capture, deadline]); }
        finally { clearTimeout(timeout); }
        assert(result.instrumentedShaders >= 2, 'Both face and bevel shaders were tested');
        assert(result.coloredPixels > result.totalPixels * .05,
            `Logo is missing: only ${result.coloredPixels}/${result.totalPixels} colored pixels`);
        return result;
    } finally {
        prototype.shaderSource = shaderSource;
        prototype.drawArrays = drawArrays;
        key('Escape');
        await until(() => !overlay(), 'Render test did not clean up');
    }
}

// Run in the actual VM/E page, in a fresh isolated browser context.
export async function runSplashTests() {
    assert(document.getElementById('cors_query'), 'Open the normal VM/E app before running this test.');
    assert(!overlay(), 'No splash on normal startup');
    assert(!document.getElementById('menu-item-splash'), 'No shell or menu button for SPLASH');
    key('Escape');
    await until(() => document.getElementById('cors_results').textContent.trim().length > 0, 'Default platform status did not appear');
    const defaultStatus = document.getElementById('cors_results').textContent;
    const savedVersion = localStorage.getItem('VME_INTERNAL.LAST_APP_VERSION');
    const savedPwaVersion = localStorage.getItem('VME_INTERNAL.LAST_PWA_SPLASH_VERSION');
    const background = [...document.body.children].map(element => [element, element.inert]);
    const previousFocus = document.activeElement;
    let rendererStarted = false;
    let sawDissolve = false;

    type('splash');
    await wait(100);
    assert(!overlay(), 'Typing without Enter must not start the splash');
    assert(document.getElementById('cors_results').textContent.includes('Press ENTER'), 'CLI describes the Enter action');
    const start = performance.now();
    key('Enter');
    await until(() => overlay()?.shadowRoot.querySelector('canvas'), 'Canvas did not appear');
    rendererStarted = true;
    assert(overlay().shadowRoot.querySelector('.caption').textContent === `Virtual Machine / Emulator · ${savedVersion}`, 'Manual splash shows the app name and version');
    const originalQuery = document.getElementById('cors_query').textContent;
    key('x', 'KeyX');
    key('Enter');
    assert(document.getElementById('cors_query').textContent === originalQuery, 'Splash blocks edits to the CLI underneath');
    assert(document.querySelectorAll('#vme-splash').length === 1, 'Repeated Enter does not stack overlays');
    await until(() => {
        const current = overlay();
        if (!current) return true;
        const opacity = Number(getComputedStyle(current).opacity);
        if (opacity > 0 && opacity < 1) sawDissolve = true;
        return false;
    }, 'Splash did not finish');
    assert(rendererStarted && sawDissolve, 'The rendered animation dissolves into the app');
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
        assert(performance.now() - start >= 5900, 'The normal intro lasts six seconds');
    }
    for (const [element, inert] of background) assert(element.inert === inert, 'Restores background interactivity');
    assert(document.activeElement === previousFocus, 'Restores keyboard focus');
    assert(localStorage.getItem('VME_INTERNAL.LAST_APP_VERSION') === savedVersion, 'Manual playback preserves the update marker');
    assert(localStorage.getItem('VME_INTERNAL.LAST_PWA_SPLASH_VERSION') === savedPwaVersion, 'Manual playback preserves the PWA update marker');

    assert(document.getElementById('cors_query').textContent === '', 'Natural completion returns to an empty CLI prompt');
    await until(() => document.getElementById('cors_results').textContent === defaultStatus, 'Natural completion did not restore the default platform status');
    for (const value of 'help') key(value);
    assert(document.getElementById('cors_results').textContent.includes('SPLASH'), 'CLI accepts a new command without clearing after playback');
    type('splash');
    key('Enter');
    await until(() => overlay()?.shadowRoot.querySelector('canvas'), 'Repeat playback did not start');
    key('Escape');
    await until(() => !overlay(), 'Escape did not dismiss the splash');
    for (const [element, inert] of background) assert(element.inert === inert, 'Escape restores input');
    assert(document.getElementById('cors_query').textContent === '', 'Escape returns to an empty CLI prompt');
    await until(() => document.getElementById('cors_results').textContent === defaultStatus, 'Escape did not restore the default platform status');
    for (const value of 'help') key(value);
    assert(document.getElementById('cors_results').textContent.includes('SPLASH'), 'CLI accepts a new command without clearing after Escape');

    // A device without WebGL must return to an interactive CLI, too.
    const getContext = HTMLCanvasElement.prototype.getContext;
    try {
        HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
            return /webgl/i.test(kind) ? null : getContext.call(this, kind, ...args);
        };
        type('splash');
        key('Enter');
        await until(() => document.getElementById('cors_results').textContent.includes('Could not display'), 'WebGL failure was not reported');
        assert(!overlay(), 'Failure removes the overlay');
        assert(document.getElementById('cors_query').textContent === '', 'WebGL failure also consumes the command');
        for (const [element, inert] of background) assert(element.inert === inert, 'Failure restores input');
    } finally {
        HTMLCanvasElement.prototype.getContext = getContext;
    }
    type('help');
    assert(document.getElementById('cors_results').textContent.includes('SPLASH'), 'CLI still accepts input after failure');
    return 'SPLASH: Enter-only activation, rendering, dissolve, repeat, Escape, input restoration and WebGL fallback passed.';
}
