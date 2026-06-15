/**
 * Lightweight on-screen FPS counter for performance testing (esp. Low Performance HW mode on TVs).
 *
 * Measures the BROWSER's requestAnimationFrame rate - i.e. how fast the page/compositor can
 * present frames. If the GPU/compositor chokes (e.g. bilinear upscale of a canvas to 4K on a weak
 * webOS TV), this rAF rate drops below the display refresh, which is exactly the signal we want
 * when comparing smoothing on/off. It does NOT measure the emulator core's internal speed.
 *
 * Toggle via StorageManager flag 'FPS_METER' ('1' = on). The meter itself is cheap (a counter +
 * one DOM text update per second), so it doesn't meaningfully perturb the measurement.
 */
import { StorageManager } from '../storage/StorageManager.js';

export class FpsMeter {
    static #el = null;
    static #rafId = null;
    static #frames = 0;
    static #lastTs = 0;
    static #min = Infinity;

    /** User PREFERENCE (Settings toggle). Whether the meter is actually visible also depends on
     *  being in a gamepad-launched emulation - see showForEmulation(). */
    static isEnabled() {
        return StorageManager.getValue('FPS_METER') === '1';
    }

    /** Persist the preference. Does NOT show the meter here - it only appears during a
     *  gamepad-launched game (showForEmulation), so toggling it in Settings just stores intent. */
    static setEnabled(on) {
        StorageManager.storeValue('FPS_METER', on ? '1' : '0');
    }

    /** Called when a gamepad-launched emulation starts: show + start measuring IF the user enabled
     *  it. (CLI-launched games and shell/menu screens never show it.) */
    static showForEmulation() {
        if (this.isEnabled()) this.start();
    }

    static start() {
        if (this.#rafId != null) return;
        this.#ensureEl();
        this.#el.style.display = 'block';
        this.#frames = 0;
        this.#lastTs = performance.now();
        this.#min = Infinity;
        const tick = (ts) => {
            this.#frames++;
            const elapsed = ts - this.#lastTs;
            if (elapsed >= 1000) {
                const fps = Math.round((this.#frames * 1000) / elapsed);
                this.#min = Math.min(this.#min, fps);
                this.#el.textContent = `FPS ${fps} (min ${this.#min === Infinity ? '-' : this.#min})`;
                this.#frames = 0;
                this.#lastTs = ts;
            }
            this.#rafId = requestAnimationFrame(tick);
        };
        this.#rafId = requestAnimationFrame(tick);
    }

    static stop() {
        if (this.#rafId != null) {
            cancelAnimationFrame(this.#rafId);
            this.#rafId = null;
        }
        if (this.#el) this.#el.style.display = 'none';
    }

    /** Hide + stop measuring (e.g. leaving emulation back to the shell). */
    static hide() {
        this.stop();
    }

    static #ensureEl() {
        if (this.#el) return;
        const el = document.createElement('div');
        el.id = 'fps-meter';
        // Fixed top-left, above everything, non-interactive, easy to read on a TV from the couch.
        el.style.cssText = [
            'position:fixed', 'top:8px', 'left:8px', 'z-index:100000',
            'font:bold 20px monospace', 'color:#0f0',
            'background:rgba(0,0,0,0.55)', 'padding:4px 8px', 'border-radius:4px',
            'pointer-events:none', 'white-space:nowrap'
        ].join(';');
        document.body.appendChild(el);
        this.#el = el;
    }
}
