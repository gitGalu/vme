import { ToastManager } from '../src/ui/ToastManager.js';

const assert = (value, message) => { if (!value) throw new Error(message); };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate, message) {
    for (let i = 0; i < 100; i++) {
        if (predicate()) return;
        await wait(10);
    }
    throw new Error(message);
}

// Run in a fresh app context after the startup splash, with normal or reduced motion.
export async function runToastTests() {
    assert(ToastManager.activeToasts === 0 && ToastManager.queue.length === 0,
        'Start without existing notifications');
    const container = ToastManager.container;
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    try {
        const message = 'Zażółć gęślą jaźń. ' + 'LongSaveFilename'.repeat(6);
        ToastManager.showManualToast(message);
        const toast = container.firstElementChild;
        await wait(200);
        assert(toast.querySelector('.toast-message__content').textContent === message,
            'Full message is preserved');
        const rect = toast.getBoundingClientRect();
        const strip = document.getElementById('pwa-status-bar');
        assert(rect.top >= (strip?.getBoundingClientRect().bottom || 0) + 12 - 0.1,
            'Toast clears the system strip with a visible gap');
        assert(rect.left >= 12 && rect.right <= innerWidth - 12 + 0.1,
            'Toast stays inside the viewport');
        assert(toast.scrollWidth <= toast.clientWidth,
            'Long messages wrap without horizontal overflow');
        assert(document.elementFromPoint(rect.left + rect.width / 2, rect.top + 1)
            ?.closest('.toast-message') === toast, 'Application controls do not cover the top edge');
        const close = toast.querySelector('button.close-label');
        assert(close && close.type === 'button', 'Close is a focusable button');
        close.focus();
        assert(document.activeElement === close, 'Close can receive keyboard focus');
        const closeRect = close.getBoundingClientRect();
        assert(closeRect.left >= rect.left && closeRect.right <= rect.right,
            'Close stays inside a narrow toast');
        close.click();
        await until(() => ToastManager.activeToasts === 0, 'Manual toast closes');

        let calls = 0;
        ToastManager.enqueueCustomToast('Retry saving?', 'RETRY', () => { calls++; }, 40);
        const actionToast = container.firstElementChild;
        actionToast.querySelector('button.custom-button').click();
        await until(() => ToastManager.activeToasts === 0, 'Action toast closes');
        await wait(60);
        assert(calls === 1 && ToastManager.activeToasts === 0,
            'Action runs once and its auto-close timer does not remove twice');

        for (const text of ['One', 'Two', 'Three', 'Queued']) ToastManager.showManualToast(text);
        assert(ToastManager.activeToasts === 3 && ToastManager.queue.length === 1,
            'Notifications respect the visible limit');
        const first = container.firstElementChild;
        first.querySelector('button').click();
        if (!reducedMotion) {
            first.querySelector('button').dispatchEvent(new TransitionEvent('transitionend', {
                bubbles: true, propertyName: 'opacity',
            }));
            assert(first.isConnected, 'Child transitions do not dismiss the toast');
        }
        await until(() => ToastManager.queue.length === 0, 'Closing advances the queue');
        assert(ToastManager.activeToasts === 3 && container.children.length === 3,
            'One close frees exactly one queue slot');
        assert(container.lastElementChild.textContent.includes('Queued'),
            'The queued notification is displayed');
        for (const item of [...container.children]) ToastManager.hideToast(item);
        await until(() => ToastManager.activeToasts === 0, 'All notifications close');

        ToastManager.enqueueToast('Saved.', false, null, null, 20);
        await until(() => ToastManager.activeToasts === 0, 'Auto-close completes');
        assert(container.children.length === 0, 'No invisible notifications remain');
        return { position: true, wrapping: true, buttons: true, queue: true, reducedMotion };
    } finally {
        ToastManager.queue.length = 0;
        for (const item of [...container.children]) ToastManager.hideToast(item);
        await until(() => ToastManager.activeToasts === 0, 'Toast cleanup completes');
    }
}
