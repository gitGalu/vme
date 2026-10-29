import styles from './SplashScreen.css?inline';
import { t } from '../i18n/shellStrings.js';

let activeSplash = null;

const ease = (position, start, end) => {
    const t = Math.min(1, Math.max(0, (position - start) / (end - start)));
    return t * t * t * (t * (t * 6 - 15) + 10);
};

// Playback does not read or write release/update markers.
export function showSplash(options = {}) {
    if (!activeSplash) {
        activeSplash = displaySplash(options).finally(() => { activeSplash = null; });
    }
    return activeSplash;
}

async function displaySplash({ version = __APP_VERSION__, mode = 'update', onReady } = {}) {
    const previousFocus = document.activeElement;
    const overlay = document.createElement('section');
    overlay.id = 'vme-splash';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'VM/E splash screen');
    overlay.tabIndex = -1;
    // Keep application themes and emulator canvas styles outside the splash.
    const shadow = overlay.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = styles;
    const stage = document.createElement('div');
    stage.className = 'stage';
    const caption = document.createElement('p');
    caption.className = 'caption';
    const versionLabel = document.createElement('span');
    versionLabel.textContent = version;
    caption.append(mode === 'manual' ? 'Virtual Machine / Emulator · ' : `${t('splash.updated')} `, versionLabel);
    shadow.append(style, stage, caption);

    const background = [...document.body.children].filter(element => element instanceof HTMLElement);
    const previousInert = background.map(element => [element, element.inert]);
    const events = new AbortController();
    let animation;
    try {
        document.body.append(overlay);
        background.forEach(element => { element.inert = true; });
        overlay.focus({ preventScroll: true });
        window.addEventListener('keydown', event => {
            event.preventDefault();
            event.stopImmediatePropagation();
            if (event.key === 'Escape') events.abort();
        }, { capture: true, signal: events.signal });

        const { createSplashRenderer } = await import('./SplashRenderer.js');
        if (events.signal.aborted) return;
        animation = await createSplashRenderer({
            host: stage,
            signal: events.signal,
            onFrame(position) {
                overlay.style.setProperty('--splash-opacity', 1 - ease(position, 5000, 6000));
                caption.style.opacity = ease(position, 1800, 2800);
            },
        });
        if (events.signal.aborted) return;
        onReady?.();
        await animation.play();
    } finally {
        events.abort();
        animation?.dispose();
        overlay.remove();
        previousInert.forEach(([element, inert]) => { element.inert = inert; });
        if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
            previousFocus.focus({ preventScroll: true });
        }
    }
}
