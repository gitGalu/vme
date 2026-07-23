// WebXR immersive-vr session for the Quest "virtual cinema" mode.
//
// While an immersive session runs, Quest Browser stops servicing
// window.requestAnimationFrame - and BOTH the emulator main loop (RetroArch via
// emscripten/Nostalgist) and GamepadManager's poll loop hang off it. So for the
// session's lifetime window.requestAnimationFrame/cancelAnimationFrame are
// patched to queue callbacks, and the XR frame loop flushes that queue at the
// start of every XR frame (the XR timestamp shares the performance.now()
// timebase, so emscripten's frame timing keeps working). On session end the
// originals are restored and still-pending callbacks are re-scheduled on the
// native rAF, so the page loops resume seamlessly in 2D.
//
// Rendering: XrScreenRenderer draws the emulator's #canvas onto a quad ("virtual
// cinema", KROK 3). The texture is re-uploaded only after a flush that actually
// ran page callbacks - same JS task as RetroArch's draw, so the source canvas'
// drawing buffer is still valid (no preserveDrawingBuffer needed); XR frames in
// between reuse the previous texture (XR runs at 72/90Hz, the emulator at ~60).
// Input (KROK 4): the two Quest controllers are merged into one synthetic
// 'standard'-mapping Gamepad (XrInputAdapter) and swapped into
// navigator.getGamepads() for the session's lifetime - GamepadManager and
// RetroArch's own pad polling both keep working unchanged. Holding a
// thumbstick click (~0.7s) exits to 2D (in pad-launched games the menu
// long-press fires first at 550ms - VME redirects it to exit while in VR).
import { XrScreenRenderer } from './XrScreenRenderer.js';
import { buildSyntheticGamepad, thumbstickClickHeld, rightStickClicked } from './XrInputAdapter.js';

export class XrSessionManager {
    // null = not probed yet; probe once at startup (detectSupport), then sync reads.
    static #supportedVr = null;
    static #supportedAr = null;

    #session = null;
    #viewerSpace = null;    // for head-locked screen anchoring
    #anchor = 'world';      // 'world' (fixed in space) | 'head' (follows the view)
    // 'vr' (immersive-vr, opaque) | 'ar' (immersive-ar, passthrough). Separate
    // SESSION types on purpose: a single always-AR session with a toggleable
    // opaque backdrop was tried and failed on device - passthrough didn't
    // engage and the AR session's passthrough pipeline cost performance even
    // when fully covered. VR stays immersive-vr = zero passthrough overhead.
    #mode = 'vr';
    #gl = null;
    #refSpace = null;
    #renderer = null;
    #rendererFailed = false;  // shader/link failure -> keep the session, render void
    #workSinceUpload = 0;     // page callbacks run since the last texture upload
    #customSource = null;     // alternate screen source (VR shell canvas); null = #canvas
    #sourceDirty = false;     // custom source changed -> re-upload on next frame

    // Downscaled sampling canvas for measureGameAspect() (one-shot content-box
    // detection after a game starts; the continuous auto-crop was removed -
    // dynamic-overscan platforms made it breathe).
    #sampleCanvas = null;
    #sampleCtx = null;

    // Short-lived text overlay composited ONTO live game frames (DOM toasts are
    // invisible in immersive mode) - e.g. the 'right stick = menu' hint.
    #overlayText = null;
    #overlayUntil = 0;
    #overlayCanvas = null;
    #overlayCtx = null;

    // XRQuadLayer path (Quest): the compositor samples the screen texture
    // DIRECTLY - one resampling less than the projection-layer quad, visibly
    // sharper flat content (DOS text). null = unsupported -> shader fallback.
    #binding = null;
    #quadLayer = null;
    #quadW = 0;
    #quadH = 0;

    // Screen geometry shared by both render paths (meters, 'local' space).
    // Adjustable at runtime (right stick while the in-game menu is open).
    #screenHeight = 1.5;
    #screenDistance = 2.0;
    /** Called after the session ended and rAF was restored (any exit path). */
    onEnd = null;
    /** Called with (visible: boolean) when the session loses/regains visibility
     *  (Quest system menu over the immersive view) - wire game pause/resume here. */
    onVisibility = null;
    /** Optional veto for the thumbstick-hold exit gesture - e.g. while the
     *  in-game menu is open IN VR (its long-press uses the same sticks). */
    suppressExitGesture = null;
    /** Fired on the press edge of the RIGHT stick click - VME toggles the
     *  in-game menu with it (the click never reaches the core as a button). */
    onMenuButton = null;
    #rightStickWas = false;
    #lastMenuEdge = 0;

    // rAF patch state: our own ids (Map preserves insertion order = rAF order).
    #rafQueue = new Map();
    #rafNextId = 1;
    #nativeRaf = null;
    #nativeCaf = null;
    #inFrame = false;
    #flushing = false;
    #watchdogId = null;
    #lastXrFlush = 0;   // perf.now() of the last flush done by the XR loop itself

    // setTimeout bridge: hidden-page timers are throttled (nested ones down to
    // 1/min) while immersive - the emulator's STARTUP uses timer chains and
    // looked frozen. Timers queue here and fire from the XR frame loop instead.
    #nativeSetTimeout = null;
    #nativeClearTimeout = null;
    #timerQueue = null;
    #timerIdSeq = 0;    // negative ids - can't clash with native positive ones

    // Controller bridge state.
    #nativeGetGamepads = null;
    #nativeGamepadEvent = null;
    #syntheticPad = null;
    #padSlot = 0;
    #padAnnounced = false;  // synthetic 'gamepadconnected' dispatched
    #exitHoldSince = 0;     // thumbstick click held since (exit gesture)

    /** Probes immersive-vr AND immersive-ar support once; safe to call at startup. */
    static async detectSupport() {
        if (XrSessionManager.#supportedVr === null) {
            if (!navigator.xr) {
                XrSessionManager.#supportedVr = XrSessionManager.#supportedAr = false;
            } else {
                const probe = (m) => navigator.xr.isSessionSupported(m).catch(() => false);
                [XrSessionManager.#supportedVr, XrSessionManager.#supportedAr] =
                    await Promise.all([probe('immersive-vr'), probe('immersive-ar')]);
            }
        }
        return XrSessionManager.isAvailable();
    }

    /** Sync views of detectSupport()'s result (false until the probe resolves). */
    static isAvailable() {
        return XrSessionManager.#supportedVr === true || XrSessionManager.#supportedAr === true;
    }

    static isVrAvailable() {
        return XrSessionManager.#supportedVr === true;
    }

    static isArAvailable() {
        return XrSessionManager.#supportedAr === true;
    }

    isActive() {
        return this.#session !== null;
    }

    /**
     * Switches what the VR screen shows: a canvas (e.g. the shell painter's) or
     * null for the default - the emulator's #canvas. Survives being set before
     * enter(); reset to default on session end.
     */
    setScreenSource(canvas) {
        this.#customSource = canvas || null;
        this.#sourceDirty = true;
    }

    /** Marks the custom screen source as changed (repainted) - re-uploads next frame. */
    invalidateScreen() {
        this.#sourceDirty = true;
    }

    getScreenPlacement() {
        return { height: this.#screenHeight, distance: this.#screenDistance };
    }

    getScreenAnchor() {
        return this.#anchor;
    }

    /** Which render path runs: 'quad-layer' (compositor, rock-solid) or 'fallback'. */
    getRenderPath() {
        return this.#quadLayer ? 'quad-layer' : 'fallback';
    }

    /** Session type actually granted: 'vr' | 'ar' (for the return-after-reload flow). */
    getSessionMode() {
        return this.#mode;
    }

    /** Shows `text` over the live game image for `ms` (banner at the bottom). */
    showGameOverlay(text, ms = 4000) {
        this.#overlayText = text || null;
        this.#overlayUntil = performance.now() + ms;
    }

    /** Game frame + the temporary banner; passthrough when no overlay is active. */
    #withOverlay(src) {
        if (!this.#overlayText) return src;
        if (performance.now() > this.#overlayUntil) {
            this.#overlayText = null;
            return src;
        }
        if (!this.#overlayCanvas) {
            this.#overlayCanvas = document.createElement('canvas');
            this.#overlayCtx = this.#overlayCanvas.getContext('2d');
        }
        if (this.#overlayCanvas.width !== src.width || this.#overlayCanvas.height !== src.height) {
            this.#overlayCanvas.width = src.width;
            this.#overlayCanvas.height = src.height;
        }
        const ctx = this.#overlayCtx;
        ctx.drawImage(src, 0, 0);
        const fs = Math.max(14, Math.round(src.height * 0.042));
        ctx.font = `600 ${fs}px "Avenir Next", "Segoe UI", Helvetica, Arial, sans-serif`;
        const tw = ctx.measureText(this.#overlayText).width;
        const pad = fs * 0.9;
        const bw = tw + pad * 2, bh = fs * 2.1;
        const bx = (src.width - bw) / 2, by = src.height - bh - src.height * 0.07;
        ctx.fillStyle = 'rgba(5, 7, 13, 0.78)';
        if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(bx, by, bw, bh, bh / 2);
            ctx.fill();
        } else {
            ctx.fillRect(bx, by, bw, bh);
        }
        ctx.fillStyle = '#cfe6ff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.#overlayText, src.width / 2, by + bh / 2);
        return this.#overlayCanvas;
    }

    /**
     * One-shot measurement: display aspect (w/h) of the actual picture inside
     * the game canvas (black bands trimmed), or null when unmeasurable. VME
     * uses it to refit the canvas layout so RetroArch fills it without bars.
     * Call from the bridged frame loop (same-task drawing-buffer rule).
     */
    measureGameAspect() {
        const canvas = document.getElementById('canvas');
        if (!canvas || !canvas.width || !canvas.height) return null;
        const r = this.#detectContentRect(canvas);
        if (!r) return canvas.width / canvas.height;   // no bands = canvas aspect is right
        return r.w / r.h;
    }

    /** Finds the picture's bounding box by trimming uniformly-black edge bands. */
    #detectContentRect(src) {
        const SW = 80, SH = 60;
        if (!this.#sampleCanvas) {
            this.#sampleCanvas = document.createElement('canvas');
            this.#sampleCanvas.width = SW;
            this.#sampleCanvas.height = SH;
            this.#sampleCtx = this.#sampleCanvas.getContext('2d', { willReadFrequently: true });
        }
        let d;
        try {
            this.#sampleCtx.drawImage(src, 0, 0, SW, SH);
            d = this.#sampleCtx.getImageData(0, 0, SW, SH).data;
        } catch (e) {
            return null;   // tainted/unreadable - no crop
        }
        const dark = (i) => d[i] < 12 && d[i + 1] < 12 && d[i + 2] < 12;
        const rowBlack = (y) => {
            for (let x = 0; x < SW; x++) if (!dark((y * SW + x) * 4)) return false;
            return true;
        };
        const colBlack = (x, top, bottom) => {
            for (let y = top; y < bottom; y++) if (!dark((y * SW + x) * 4)) return false;
            return true;
        };
        // Cap each margin at 45% - an all-black frame (loading) means "no crop",
        // not "crop everything".
        const capY = Math.floor(SH * 0.45), capX = Math.floor(SW * 0.45);
        let top = 0, bottom = 0, left = 0, right = 0;
        while (top < capY && rowBlack(top)) top++;
        while (bottom < capY && rowBlack(SH - 1 - bottom)) bottom++;
        while (left < capX && colBlack(left, top, SH - bottom)) left++;
        while (right < capX && colBlack(SW - 1 - right, top, SH - bottom)) right++;
        if (top === 0 && bottom === 0 && left === 0 && right === 0) return null;
        const sx = src.width / SW, sy = src.height / SH;
        const x = Math.round(left * sx), y = Math.round(top * sy);
        const w = Math.round(src.width - (left + right) * sx);
        const h = Math.round(src.height - (top + bottom) * sy);
        return (w > 16 && h > 16) ? { x, y, w, h } : null;
    }

    /**
     * 'world' = screen fixed in space ('local' reference space), 'head' = screen
     * follows the view ('viewer' space). Applies live - the quad layer is
     * recreated against the new space; the fallback simply skips the view matrix.
     */
    setScreenAnchor(mode) {
        this.#anchor = mode === 'head' ? 'head' : 'world';
        if (this.#quadLayer && this.#quadW > 0) {
            this.#createQuadLayer(this.#quadW, this.#quadH);   // needsRedraw refills it
        }
    }

    /** Sets the screen's size/distance (meters, clamped) - applies live to the quad layer. */
    setScreenPlacement(height, distance) {
        this.#screenHeight = Math.min(3.0, Math.max(0.6, height));
        this.#screenDistance = Math.min(6.0, Math.max(0.8, distance));
        if (this.#quadLayer && this.#quadH > 0) {
            this.#quadLayer.transform = new XRRigidTransform({ x: 0, y: 0, z: -this.#screenDistance });
            this.#quadLayer.height = this.#screenHeight;
            this.#quadLayer.width = this.#screenHeight * (this.#quadW / this.#quadH);
        }
        // Fallback path reads the fields each frame - nothing else to update.
    }

    /**
     * Starts the immersive session. MUST be called from a user gesture
     * (requestSession is issued synchronously to stay within the activation).
     * @param {'vr'|'ar'} mode - 'ar' = passthrough (falls back to 'vr' when
     *        immersive-ar is unsupported).
     */
    async enter(mode = 'vr') {
        if (this.#session) return;
        this.#mode = (mode === 'ar' && XrSessionManager.isArAvailable()) ? 'ar' : 'vr';
        const sessionPromise = navigator.xr.requestSession(
            this.#mode === 'ar' ? 'immersive-ar' : 'immersive-vr',
            { requiredFeatures: ['local'], optionalFeatures: ['layers'] }
        );
        const session = await sessionPromise;
        this.#session = session;

        try {
            const gl = this.#createGl();
            this.#refSpace = await session.requestReferenceSpace('local');
            this.#viewerSpace = await session.requestReferenceSpace('viewer');
            if (!this.#initQuadLayer(session, gl)) {
                session.updateRenderState({ baseLayer: new XRWebGLLayer(session, gl) });
            }
            // Which path actually runs on-device decides anchoring behaviour -
            // keep this visible for remote debugging (chrome://inspect).
            console.info(`[xr] session=${this.#mode} path=${this.#quadLayer ? 'quad-layer' : 'projection-fallback'} anchor=${this.#anchor}`);
        } catch (e) {
            this.#session = null;
            session.end().catch(() => { });
            throw e;
        }

        session.addEventListener('end', () => this.#onSessionEnded());
        // Quest system overlay: XR frames (and so the emulator) stop - pause the
        // game explicitly, otherwise its audio starves into underrun noise.
        session.addEventListener('visibilitychange', () => {
            this.onVisibility?.(session.visibilityState === 'visible');
        });

        // 72Hz is the closest Quest rate to the cores' ~60fps output - fewer
        // duplicated frames and cheaper rendering than the 90Hz default. Best-effort.
        try {
            const rates = session.supportedFrameRates;
            if (rates?.length && session.updateTargetFrameRate) {
                let best = rates[0];
                for (const r of rates) {
                    if (Math.abs(r - 60) < Math.abs(best - 60)) best = r;
                }
                session.updateTargetFrameRate(best).catch(() => { });
            }
        } catch { /* frame rate control is optional */ }

        // On-device the DOM is invisible in immersive mode anyway; under a desktop
        // polyfill (IWE) the page UI would cover the extension's own controls.
        document.body.classList.add('xr-active');

        this.#patchRaf();
        this.#patchTimers();
        this.#patchGamepads();
        session.requestAnimationFrame((t, frame) => this.#onXrFrame(t, frame));
    }

    /** Ends the session; cleanup happens in the 'end' handler (covers system-initiated ends too). */
    exit() {
        this.#session?.end().catch(() => { });
    }

    #createGl() {
        // Own context on a detached canvas - RetroArch keeps exclusive ownership
        // of #canvas and its context. xrCompatible avoids a makeXRCompatible round-trip.
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl2', { xrCompatible: true })
            || canvas.getContext('webgl', { xrCompatible: true });
        if (!gl) throw new Error('WebGL unavailable for XR layer');
        this.#gl = gl;
        return gl;
    }

    #onXrFrame(time, frame) {
        const session = this.#session;
        if (!session || frame.session !== session) return;
        session.requestAnimationFrame((t, f) => this.#onXrFrame(t, f));

        // Re-entrancy guard: WebXR POLYFILLS (Immersive Web Emulator on desktop)
        // drive session.rAF from window.rAF - which we patched, so the polyfill's
        // tick runs inside #flushPageRaf and fires this handler synchronously.
        // Without the guard that recurses until the stack overflows. On-device
        // XR frames are compositor-driven and never nest.
        if (this.#inFrame) return;
        this.#inFrame = true;
        try {
            // Controller snapshot FIRST - the emulator tick inside the flush below
            // reads navigator.getGamepads() and must see this frame's state.
            this.#updateInput(session);
            if (!this.#session) return;  // exit gesture may end the session mid-frame

            // Under a polyfill this handler can run INSIDE a watchdog flush (#flushing
            // set) - then the XR loop did no real work and the watchdog must stay on.
            const ownFlush = !this.#flushing;
            this.#flushPageRaf(time);
            this.#flushTimers();
            if (ownFlush) this.#lastXrFlush = performance.now();
            if (!this.#session) return;  // a flushed callback may have ended it too

            if (this.#quadLayer) {
                // Quad-layer path: no per-eye GL rendering at all - the compositor
                // draws the quad itself (VR background = system black, AR = passthrough).
                // We only refresh the layer's texture when the source changed.
                this.#renderQuadFrame(frame);
            } else {
                const gl = this.#gl;
                const layer = session.renderState.baseLayer;
                gl.bindFramebuffer(gl.FRAMEBUFFER, layer.framebuffer);
                if (this.#mode === 'ar') {
                    // Transparent clear: the compositor alpha-blends the frame over
                    // the passthrough feed - only the screen quad stays visible.
                    gl.clearColor(0, 0, 0, 0);
                } else {
                    gl.clearColor(0.02, 0.03, 0.05, 1.0);
                }
                gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

                const pose = frame.getViewerPose?.(this.#refSpace);
                if (pose) this.#renderScreen(layer, pose);
            }
        } finally {
            this.#inFrame = false;
        }
    }

    // ===== XRQuadLayer path =====

    #initQuadLayer(session, gl) {
        if (typeof XRWebGLBinding === 'undefined' || typeof XRRigidTransform === 'undefined') {
            return false;
        }
        try {
            const binding = new XRWebGLBinding(session, gl);
            if (typeof binding.createQuadLayer !== 'function') return false;
            this.#binding = binding;
            // Placeholder size; recreated to match the source on the first frame.
            this.#createQuadLayer(1280, 720);
            return true;
        } catch (e) {
            console.warn('[xr] quad layer unavailable, using projection fallback:', e);
            this.#binding = null;
            this.#quadLayer = null;
            return false;
        }
    }

    #createQuadLayer(w, h) {
        const aspect = w / h;
        // NOTE if the on-device screen shows up at twice the expected size, the
        // browser treats width/height as HALF-extents - halve both values here.
        this.#quadLayer = this.#binding.createQuadLayer({
            space: (this.#anchor === 'head' && this.#viewerSpace) ? this.#viewerSpace : this.#refSpace,
            viewPixelWidth: w,
            viewPixelHeight: h,
            layout: 'mono',
            transform: new XRRigidTransform({ x: 0, y: 0, z: -this.#screenDistance }),
            width: this.#screenHeight * aspect,
            height: this.#screenHeight
        });
        this.#quadW = w;
        this.#quadH = h;
        // VR: quad over the compositor's black void; AR: quad over passthrough.
        this.#session.updateRenderState({ layers: [this.#quadLayer] });
    }

    #renderQuadFrame(frame) {
        const custom = this.#customSource;
        const src = custom || document.getElementById('canvas');
        if (!src || !src.width || !src.height) return;

        // Source resolution changed (shell<->game switch, mid-game mode change):
        // the layer's texture size is fixed at creation - recreate to match 1:1.
        if (src.width !== this.#quadW || src.height !== this.#quadH) {
            this.#createQuadLayer(src.width, src.height);
        }

        const dirty = custom ? this.#sourceDirty : this.#workSinceUpload > 0;
        if (!dirty && !this.#quadLayer.needsRedraw) return;

        const gl = this.#gl;
        const sub = this.#binding.getSubImage(this.#quadLayer, frame);
        gl.bindTexture(gl.TEXTURE_2D, sub.colorTexture);
        // Layer textures are GL-oriented (bottom-left origin), canvases are top-left.
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE,
            custom ? src : this.#withOverlay(src));
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        if (custom) this.#sourceDirty = false;
        else this.#workSinceUpload = 0;
    }

    #updateInput(session) {
        this.#syntheticPad = buildSyntheticGamepad(session, this.#padSlot);
        if (this.#syntheticPad && !this.#padAnnounced) {
            this.#padAnnounced = true;
            this.#dispatchPadEvent('gamepadconnected', this.#syntheticPad);
        }

        // Right stick click (press edge) = instant in-game-menu toggle. Debounced:
        // a bouncy click producing two edges would toggle the menu open AND closed.
        const rightNow = rightStickClicked(session);
        if (rightNow && !this.#rightStickWas
            && performance.now() - this.#lastMenuEdge > 250) {
            this.#lastMenuEdge = performance.now();
            this.onMenuButton?.();
        }
        this.#rightStickWas = rightNow;

        // Exit gesture: hold any thumbstick click ~0.7s. In games with the in-game
        // menu the 550ms long-press (same sticks) opens the menu IN VR first - the
        // veto below stops the continued hold from ALSO ending the session.
        if (this.suppressExitGesture?.()) {
            this.#exitHoldSince = 0;
        } else if (thumbstickClickHeld(session)) {
            if (!this.#exitHoldSince) {
                this.#exitHoldSince = performance.now();
            } else if (performance.now() - this.#exitHoldSince >= 700) {
                this.#exitHoldSince = 0;
                this.exit();
            }
        } else {
            this.#exitHoldSince = 0;
        }
    }

    #dispatchPadEvent(name, pad) {
        // GamepadEvent can't wrap a synthetic pad - an expando on a plain Event
        // is enough for every consumer (emscripten and VME read e.gamepad only).
        try {
            const e = new Event(name);
            e.gamepad = pad;
            window.dispatchEvent?.(e);
        } catch { /* events are best-effort - polling consumers work regardless */ }
    }

    #renderScreen(layer, pose) {
        // Lazy init: isolates a shader/link failure to "void mode" instead of
        // failing enter(), and keeps enter() testable without a full GL stub.
        if (!this.#renderer && !this.#rendererFailed) {
            try {
                this.#renderer = new XrScreenRenderer(this.#gl);
            } catch (e) {
                this.#rendererFailed = true;
                console.error('[xr] screen renderer unavailable:', e);
            }
        }
        if (!this.#renderer) return;

        const custom = this.#customSource;
        const src = custom || document.getElementById('canvas');
        if (custom) {
            // Shell mirror (Canvas2D): static between inputs - upload only when
            // the painter invalidated it. No same-task constraint (2D canvas
            // buffers persist, unlike the WebGL drawing buffer).
            if (this.#sourceDirty && src.width > 0) {
                this.#renderer.uploadFromCanvas(src);
                this.#sourceDirty = false;
            }
        } else if (this.#workSinceUpload > 0 && src && src.width > 0) {
            // Fresh emulator output exists only if the flush ran page callbacks in
            // THIS task - upload now (drawing buffer still valid), otherwise reuse.
            this.#renderer.uploadFromCanvas(this.#withOverlay(src));
            this.#workSinceUpload = 0;
        }
        const aspect = src && src.height > 0 ? src.width / src.height : 0;
        this.#renderer.render(layer, pose, aspect, this.#screenHeight, this.#screenDistance,
            this.#anchor === 'head');
    }

    // ===== window.rAF bridge =====

    #patchRaf() {
        this.#nativeRaf = window.requestAnimationFrame;
        this.#nativeCaf = window.cancelAnimationFrame;
        this.#rafQueue.clear();
        window.requestAnimationFrame = (cb) => {
            const id = this.#rafNextId++;
            this.#rafQueue.set(id, cb);
            return id;
        };
        window.cancelAnimationFrame = (id) => {
            this.#rafQueue.delete(id);
        };
        // Watchdog: a NATIVE rAF loop that also flushes the queue. On a real Quest
        // window rAF stalls in immersive mode, so this never (or rarely) ticks - the
        // XR loop does the flushing. Under a desktop WebXR polyfill (Immersive Web
        // Emulator) window rAF keeps running and the polyfill's own frame machinery
        // lives IN our queue - without this driver the page would deadlock.
        const watchdog = (t) => {
            // The session may end during this very tick (cancel can't stop a
            // callback already in flight) - stop instead of re-arming.
            if (!this.#nativeRaf) return;
            // Back off while the XR loop is doing the flushing itself - if window rAF
            // happens to keep ticking in immersive mode, flushing from both drivers
            // would double the emulator's tick rate.
            if (performance.now() - this.#lastXrFlush > 250) {
                this.#flushPageRaf(t);
                this.#flushTimers();
            }
            if (!this.#nativeRaf) return;
            this.#watchdogId = this.#nativeRaf.call(window, watchdog);
        };
        this.#watchdogId = this.#nativeRaf.call(window, watchdog);
    }

    #flushPageRaf(time) {
        // No re-entry: under a polyfill a flushed callback can synchronously fire
        // our own XR frame handler (see #onXrFrame), which would flush again.
        if (this.#flushing || this.#rafQueue.size === 0) return;
        this.#flushing = true;
        try {
            // Swap first: callbacks scheduling the next frame must land in the NEW queue.
            const batch = Array.from(this.#rafQueue.values());
            this.#rafQueue.clear();
            this.#workSinceUpload += batch.length;
            for (const cb of batch) {
                try {
                    cb(time);
                } catch (e) {
                    // One broken callback must not stall the emulator or the XR loop.
                    console.error('[xr] rAF callback failed:', e);
                }
            }
        } finally {
            this.#flushing = false;
        }
    }

    // ===== setTimeout bridge =====

    #patchTimers() {
        this.#nativeSetTimeout = window.setTimeout;
        this.#nativeClearTimeout = window.clearTimeout;
        this.#timerQueue = new Map();
        window.setTimeout = (fn, delay = 0, ...args) => {
            // String handlers (eval-style) are not worth bridging - pass through.
            if (typeof fn !== 'function') {
                return this.#nativeSetTimeout.call(window, fn, delay, ...args);
            }
            const id = --this.#timerIdSeq;
            this.#timerQueue.set(id, {
                fn, args,
                due: performance.now() + Math.max(0, Number(delay) || 0)
            });
            return id;
        };
        window.clearTimeout = (id) => {
            if (this.#timerQueue && this.#timerQueue.delete(id)) return;
            this.#nativeClearTimeout.call(window, id);
        };
    }

    #flushTimers() {
        if (!this.#timerQueue || this.#timerQueue.size === 0) return;
        const now = performance.now();
        for (const [id, timer] of Array.from(this.#timerQueue)) {
            if (timer.due <= now) {
                this.#timerQueue.delete(id);
                try {
                    timer.fn(...timer.args);
                } catch (e) {
                    console.error('[xr] timer callback failed:', e);
                }
            }
        }
    }

    #unpatchTimers() {
        if (!this.#nativeSetTimeout) return;
        window.setTimeout = this.#nativeSetTimeout;
        window.clearTimeout = this.#nativeClearTimeout;
        this.#nativeSetTimeout = null;
        this.#nativeClearTimeout = null;
        // Hand still-pending timers back to the page (their bridged ids become
        // uncancellable - acceptable, the queue is short-lived).
        if (this.#timerQueue) {
            const now = performance.now();
            for (const timer of this.#timerQueue.values()) {
                window.setTimeout(timer.fn, Math.max(0, timer.due - now), ...timer.args);
            }
            this.#timerQueue = null;
        }
    }

    // ===== navigator.getGamepads bridge =====

    #patchGamepads() {
        if (!navigator.getGamepads) return;
        this.#nativeGetGamepads = navigator.getGamepads;
        // The synthetic pad takes the first free slot (on Quest in immersive mode
        // the native list is all-null; a paired BT pad keeps its own slot).
        const native = this.#nativeGetGamepads.call(navigator);
        let slot = 0;
        while (slot < native.length && native[slot]) slot++;
        this.#padSlot = slot;
        navigator.getGamepads = () => {
            const pads = Array.from(this.#nativeGetGamepads.call(navigator));
            if (this.#syntheticPad) {
                // A native (Bluetooth) pad can appear MID-session on our slot -
                // move the synthetic pad to the next free index so both stay
                // visible (the BT pad keeps its lower index = player 1).
                if (pads[this.#padSlot]) {
                    let slot = 0;
                    while (slot < pads.length && pads[slot]) slot++;
                    this.#padSlot = slot;
                    this.#syntheticPad.index = slot;
                }
                while (pads.length <= this.#padSlot) pads.push(null);
                pads[this.#padSlot] = this.#syntheticPad;
            }
            return pads;
        };

        // Nostalgist's postRun re-announces every pad from navigator.getGamepads()
        // via `new GamepadEvent('gamepadconnected', {gamepad})` - WebIDL refuses to
        // convert the synthetic pad (a plain object) and the WHOLE game launch dies
        // (games start mid-session: 'Start in VR' launches the game after enter()).
        // While patched, fall back to a plain Event carrying the pad as an expando;
        // every consumer here (emscripten, VME) only reads e.gamepad.
        this.#nativeGamepadEvent = window.GamepadEvent;
        if (this.#nativeGamepadEvent) {
            const Native = this.#nativeGamepadEvent;
            const Patched = function GamepadEvent(type, init) {
                try {
                    return new Native(type, init);
                } catch {
                    const e = new Event(type, init);
                    e.gamepad = init?.gamepad ?? null;
                    return e;
                }
            };
            Patched.prototype = Native.prototype;
            window.GamepadEvent = Patched;
        }
    }

    #unpatchGamepads() {
        if (!this.#nativeGetGamepads) return;
        navigator.getGamepads = this.#nativeGetGamepads;
        this.#nativeGetGamepads = null;
        if (this.#nativeGamepadEvent) {
            window.GamepadEvent = this.#nativeGamepadEvent;
            this.#nativeGamepadEvent = null;
        }
        if (this.#padAnnounced) {
            this.#dispatchPadEvent('gamepaddisconnected', this.#syntheticPad
                ? { ...this.#syntheticPad, connected: false }
                : { index: this.#padSlot, connected: false });
        }
        this.#syntheticPad = null;
        this.#padAnnounced = false;
        this.#exitHoldSince = 0;
        this.#rightStickWas = false;
    }

    #unpatchRaf() {
        if (!this.#nativeRaf) return;
        if (this.#watchdogId !== null) {
            this.#nativeCaf.call(window, this.#watchdogId);
            this.#watchdogId = null;
        }
        window.requestAnimationFrame = this.#nativeRaf;
        window.cancelAnimationFrame = this.#nativeCaf;
        this.#nativeRaf = null;
        this.#nativeCaf = null;
        // Hand still-pending callbacks (e.g. the emulator's next tick) back to the page.
        for (const cb of this.#rafQueue.values()) {
            window.requestAnimationFrame(cb);
        }
        this.#rafQueue.clear();
    }

    #onSessionEnded() {
        document.body.classList.remove('xr-active');
        this.#session = null;
        this.#unpatchRaf();
        this.#unpatchTimers();
        this.#unpatchGamepads();
        // Context and renderer are bound to the ended session's layer; drop for GC.
        this.#gl = null;
        this.#refSpace = null;
        this.#viewerSpace = null;
        this.#renderer = null;
        this.#rendererFailed = false;
        this.#workSinceUpload = 0;
        this.#customSource = null;   // next enter() defaults to the game canvas
        this.#sourceDirty = false;
        this.#overlayText = null;
        this.#binding = null;
        this.#quadLayer = null;
        this.#quadW = 0;
        this.#quadH = 0;
        this.onEnd?.();
    }
}
