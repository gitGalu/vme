// Paints the gamepad shell's state (GamepadMenu.getVrSnapshot()) onto an
// offscreen canvas shown on the VR screen quad. The DOM shell is invisible in
// immersive mode, but its whole state machine (views, focus, filtering) keeps
// running - this is only a display mirror, repainted on shell change events
// (the shell is static between inputs, so no per-frame painting).
//
// Look loosely mirrors the DOM shell / launch screen: dark navy, light focus.
import { t } from '../i18n/shellStrings.js';

// 4:3, like the emulated screens - a 16:9 (or wider) shell felt too panoramic
// as a quad in XR (user feedback from Quest 3).
const W = 1024, H = 768;
const FONT = '"Avenir Next", Avenir, "Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif';

// Thumbnail box (right side, list views only). Rows shrink when it's active.
const THUMB_W = 280, THUMB_H = 220, THUMB_X = W - THUMB_W - 40, THUMB_Y = 120;

// Async image cache for thumbnail URLs. crossOrigin='anonymous' keeps the
// canvas untainted (a CORS-refusing host simply fails to load = no thumb;
// tainting would kill the texImage2D upload of the whole shell).
class ThumbCache {
    #map = new Map();   // url -> { img, ok }
    #onLoad;

    constructor(onLoad) {
        this.#onLoad = onLoad;
    }

    /** Image for the url if loaded, else null (load starts in the background). */
    get(url) {
        let entry = this.#map.get(url);
        if (!entry) {
            if (this.#map.size > 80) {
                // Drop the oldest half - Map preserves insertion order.
                const keys = Array.from(this.#map.keys()).slice(0, 40);
                keys.forEach(k => this.#map.delete(k));
            }
            const img = new Image();
            img.crossOrigin = 'anonymous';
            entry = { img, ok: false };
            img.onload = () => { entry.ok = true; this.#onLoad?.(); };
            img.src = url;
            this.#map.set(url, entry);
        }
        return entry.ok ? entry.img : null;
    }
}

export class XrShellPainter {
    canvas;
    #ctx;
    #thumbs;
    #thumbReserved = false;
    /** Fired when a thumbnail finished loading - repaint the current view. */
    onThumbLoad = null;

    constructor() {
        this.canvas = document.createElement('canvas');
        this.canvas.width = W;
        this.canvas.height = H;
        this.#ctx = this.canvas.getContext('2d');
        this.#thumbs = new ThumbCache(() => this.onThumbLoad?.());
    }

    /** Repaints the whole frame from a GamepadMenu snapshot (null = closed -> blank). */
    paint(snap) {
        const ctx = this.#ctx;

        ctx.fillStyle = '#05070d';
        ctx.fillRect(0, 0, W, H);
        const glow = ctx.createLinearGradient(0, 0, 0, H * 0.5);
        glow.addColorStop(0, 'rgba(56, 72, 110, 0.35)');
        glow.addColorStop(1, 'rgba(56, 72, 110, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, W, H * 0.5);

        if (!snap) return;

        // Thumbnail of the focused item: an explicit URL (VR saves/collections)
        // or the shared DOM <img> that the 2D shell machinery keeps feeding for
        // Browse (already crossOrigin='anonymous', loads fine while immersive).
        let thumbImg = null;
        this.#thumbReserved = false;
        if (!snap.keyboard && !snap.message) {
            if (snap.thumb) {
                this.#thumbReserved = true;
                thumbImg = this.#thumbs.get(snap.thumb);
            } else if (snap.showThumb) {
                this.#thumbReserved = true;
                const el = document.getElementById('gamepad-menu-thumbnail');
                if (el && el.src && el.complete && el.naturalWidth > 0) thumbImg = el;
            }
        }

        this.#paintTopbar(snap);
        if (snap.message) this.#paintNotice(snap);
        if (snap.keyboard) {
            this.#paintRows(snap, 96, 320, 5);
            this.#paintKeyboard(snap.keyboard);
        } else if (snap.emptyHint) {
            this.#paintEmptyHint(snap.emptyHint);
        } else {
            this.#paintRows(snap, 96, H - 88, 12);
        }
        if (this.#thumbReserved) this.#paintThumb(thumbImg);
        // Optional one-line footnote above the legend (e.g. the in-game menu's
        // 'right stick = screen placement' hint).
        if (snap.footnote) {
            const ctx2 = this.#ctx;
            ctx2.font = `400 18px ${FONT}`;
            ctx2.fillStyle = '#5b6b7d';
            ctx2.textAlign = 'center';
            ctx2.textBaseline = 'middle';
            ctx2.fillText(this.#ellipsize(snap.footnote, W - 120), W / 2, H - 72);
        }
        this.#paintLegend(snap);
    }

    #paintTopbar(snap) {
        const ctx = this.#ctx;
        let x = 64;
        const y = 56;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';

        const segment = (text, color, weight = '600') => {
            ctx.font = `${weight} 24px ${FONT}`;
            ctx.fillStyle = color;
            ctx.fillText(text, x, y);
            x += ctx.measureText(text).width;
        };
        const separator = () => segment('  ›  ', '#4d637f', '400');

        segment(snap.isRoot ? 'VM/E Shell (beta)' : 'VM/E', '#ffffff', '700');
        if (!snap.isRoot && snap.title) {
            separator();
            segment(snap.title, '#cfd6e4');
        }
        if (snap.filterable) {
            separator();
            if (snap.filterText) {
                segment(snap.filterText, '#cfe6ff');
            } else {
                segment(snap.placeholder || 'Start typing to filter', '#5b6b7d', '400');
            }
            // Caret after the filter text, only while the keyboard has focus.
            if (snap.focusMode === 'keyboard') {
                this.#ctx.fillStyle = '#cfe6ff';
                this.#ctx.fillRect(x + 4, y - 14, 3, 28);
            }
        }
    }

    #paintRows(snap, top, bottom, maxRows) {
        const ctx = this.#ctx;
        const rows = snap.rows.slice(0, maxRows);
        const rowH = Math.min(46, Math.floor((bottom - top) / Math.max(rows.length, 1)));
        // With the thumbnail box active the rows give up the right side.
        const rightEdge = this.#thumbReserved ? THUMB_X - 24 : W - 56;
        const xLabel = 80, xHintRight = rightEdge - 24;
        ctx.textBaseline = 'middle';

        rows.forEach((row, i) => {
            const y = top + i * rowH + rowH / 2;
            if (row.focused) {
                ctx.fillStyle = 'rgba(207, 230, 255, 0.14)';
                this.#roundRect(56, y - rowH / 2 + 3, rightEdge - 56, rowH - 6, 10);
                ctx.fill();
            }
            const color = row.disabled ? '#4a5058' : (row.focused ? '#ffffff' : '#9ba4b0');
            ctx.font = `${row.focused ? '700' : '500'} 26px ${FONT}`;
            ctx.fillStyle = color;
            ctx.textAlign = 'left';
            const hintSpace = row.hint ? 210 : 0;
            ctx.fillText(this.#ellipsize(row.label, rightEdge - xLabel - hintSpace - 16), xLabel, y);
            if (row.hint) {
                ctx.font = `400 22px ${FONT}`;
                ctx.fillStyle = row.focused ? '#cfe6ff' : '#5b6b7d';
                ctx.textAlign = 'right';
                ctx.fillText(this.#ellipsize(row.hint, 200), xHintRight, y);
            }
        });

        // Position indicator for long lists (Browse can have >100k entries).
        if (snap.total > rows.length) {
            ctx.font = `400 18px ${FONT}`;
            ctx.fillStyle = '#5b6b7d';
            ctx.textAlign = 'right';
            const focusPos = snap.start + snap.rows.findIndex(r => r.focused) + 1;
            ctx.fillText(`${focusPos} / ${snap.total}`, W - 80, bottom + 16);
        }
    }

    /** Focused item's thumbnail, aspect-fit in a framed box (null = empty frame). */
    #paintThumb(img) {
        const ctx = this.#ctx;
        ctx.strokeStyle = 'rgba(77, 99, 127, 0.5)';
        ctx.lineWidth = 1;
        this.#roundRect(THUMB_X, THUMB_Y, THUMB_W, THUMB_H, 10);
        ctx.stroke();
        if (!img) return;
        const scale = Math.min((THUMB_W - 12) / img.naturalWidth, (THUMB_H - 12) / img.naturalHeight);
        const w = img.naturalWidth * scale, h = img.naturalHeight * scale;
        try {
            ctx.drawImage(img, THUMB_X + (THUMB_W - w) / 2, THUMB_Y + (THUMB_H - h) / 2, w, h);
        } catch (e) { /* decode edge cases - leave the empty frame */ }
    }

    #paintKeyboard(keyboard) {
        const ctx = this.#ctx;
        const keyW = 64, keyH = 44, gap = 8;
        const wideW = (keyW * 6 + gap * 5 - gap * 2) / 3;
        const gridW = keyW * 6 + gap * 5;
        const left = (W - gridW) / 2;
        let y = 350;

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        keyboard.rows.forEach((row, r) => {
            const isWideRow = row.length === 3;
            const w = isWideRow ? wideW : keyW;
            let x = left;
            row.forEach((key, c) => {
                const focused = keyboard.focus.row === r && keyboard.focus.col === c;
                if (focused) {
                    ctx.fillStyle = 'rgba(207, 230, 255, 0.22)';
                    this.#roundRect(x, y, w, keyH, 8);
                    ctx.fill();
                }
                ctx.strokeStyle = focused ? '#cfe6ff' : 'rgba(77, 99, 127, 0.5)';
                ctx.lineWidth = focused ? 2 : 1;
                this.#roundRect(x, y, w, keyH, 8);
                ctx.stroke();
                ctx.font = `600 22px ${FONT}`;
                ctx.fillStyle = focused ? '#ffffff' : '#9ba4b0';
                ctx.fillText(key, x + w / 2, y + keyH / 2);
                x += w + gap;
            });
            y += keyH + gap;
        });
    }

    #paintNotice(snap) {
        const ctx = this.#ctx;
        ctx.font = `600 26px ${FONT}`;
        ctx.fillStyle = snap.isNotice === 'error' ? '#ff9b9b' : '#cfe6ff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.#ellipsize(snap.message, W - 160), W / 2, 130);
    }

    #paintEmptyHint(hint) {
        const ctx = this.#ctx;
        ctx.font = `400 26px ${FONT}`;
        ctx.fillStyle = '#5b6b7d';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.#ellipsize(hint, W - 160), W / 2, H / 2 - 40);
    }

    #paintLegend(snap) {
        const ctx = this.#ctx;
        // Quest-flavored: navigation lives on the LEFT stick - lead with it (the
        // A/B/X/Y letters already match the Touch controllers' physical labels).
        let actions;
        if (snap.keyboard) {
            actions = [['@stick', t('legend.nav')], ['A', t('legend.type')], ['Y', t('legend.delete')], ['X', t('legend.list')], ['B', t('legend.back')]];
        } else if (snap.isRoot) {
            actions = [['@stick', t('legend.nav')], ['A', t('legend.select')], ['B', t('legend.exit')]];
        } else {
            actions = [['@stick', t('legend.nav')], ['A', t('legend.select')], ['B', t('legend.back')]];
            if (snap.filterable) actions.splice(2, 0, ['X', t('legend.filter')]);
            else if (snap.secondaryLabel) actions.splice(2, 0, ['X', snap.secondaryLabel]);
        }

        ctx.textBaseline = 'middle';
        const y = H - 36;
        // Measure total width to center the legend.
        let total = 0;
        const parts = actions.map(([glyph, label]) => {
            ctx.font = `700 20px ${FONT}`;
            const gw = ctx.measureText(glyph).width;
            ctx.font = `400 20px ${FONT}`;
            const lw = ctx.measureText(label).width;
            const w = 30 + 8 + lw + 40;
            total += w;
            return { glyph, label, gw, w };
        });
        let x = (W - total) / 2;
        for (const p of parts) {
            if (p.glyph === '@stick') {
                // Monochrome vector thumbstick - matches the button circles' look.
                ctx.strokeStyle = '#cfd6e4';
                ctx.lineWidth = 2;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(x + 7, y + 10);
                ctx.lineTo(x + 23, y + 10);    // base
                ctx.moveTo(x + 15, y + 10);
                ctx.lineTo(x + 15, y - 3);     // shaft
                ctx.stroke();
                ctx.fillStyle = '#cfd6e4';
                ctx.beginPath();
                ctx.arc(x + 15, y - 7, 4.5, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.strokeStyle = '#4d637f';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.arc(x + 15, y, 15, 0, Math.PI * 2);
                ctx.stroke();
                ctx.font = `700 18px ${FONT}`;
                ctx.fillStyle = '#cfd6e4';
                ctx.textAlign = 'center';
                ctx.fillText(p.glyph, x + 15, y + 1);
            }
            ctx.font = `400 20px ${FONT}`;
            ctx.fillStyle = '#9ba4b0';
            ctx.textAlign = 'left';
            ctx.fillText(p.label, x + 38, y);
            x += p.w;
        }
    }

    #ellipsize(text, maxWidth) {
        const ctx = this.#ctx;
        if (ctx.measureText(text).width <= maxWidth) return text;
        let lo = 0, hi = text.length;
        while (lo < hi) {
            const mid = Math.ceil((lo + hi) / 2);
            if (ctx.measureText(text.slice(0, mid) + '…').width <= maxWidth) lo = mid;
            else hi = mid - 1;
        }
        return text.slice(0, lo) + '…';
    }

    #roundRect(x, y, w, h, r) {
        const ctx = this.#ctx;
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(x, y, w, h, r);
        } else {
            ctx.rect(x, y, w, h);
        }
    }
}
