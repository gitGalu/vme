import { createGuiButton } from '../src/GuiButton.js';

const assert = (condition, message) => { if (!condition) throw new Error(message); };

export async function runGuiButtonsTest() {
    const container = document.createElement('div');
    container.id = 'gui-button-test-container';
    document.body.append(container);
    let calls = 0;
    let reenter = false;
    let button;
    createGuiButton('gui-button-test', 'Test', 'T', () => {
        calls++;
        assert(!button.classList.contains('guiBtn-pressed'), 'Pressed feedback is cleared before invoking an action');
        if (reenter) { reenter = false; mouse('mouseup'); }
    }, true, undefined, container.id);
    button = container.firstElementChild;
    button.style.cssText = 'position:fixed;left:10px;top:10px;width:100px;height:40px;pointer-events:auto;visibility:visible;display:block';
    const mouse = (type, outside = false, mouseButton = 0) => {
        const rect = button.getBoundingClientRect();
        (type === 'mousedown' ? button : window).dispatchEvent(new MouseEvent(type, {
            button: mouseButton, bubbles: true, cancelable: true,
            clientX: outside ? rect.right + 100 : rect.left + rect.width / 2,
            clientY: rect.top + rect.height / 2
        }));
    };
    const touch = (type, outside = false) => {
        const rect = button.getBoundingClientRect();
        const point = new Touch({ identifier: 1, target: button,
            clientX: outside ? rect.right + 100 : rect.left + rect.width / 2,
            clientY: rect.top + rect.height / 2 });
        const event = new TouchEvent(type, { bubbles: true, cancelable: true,
            touches: type === 'touchend' || type === 'touchcancel' ? [] : [point], changedTouches: [point] });
        button.dispatchEvent(event);
        if (type === 'touchstart') assert(event.defaultPrevented, 'Touch start suppresses compatibility mouse events');
    };
    try {
        mouse('mousedown');
        assert(calls === 0, 'GUI action waits for release');
        mouse('mouseup');
        mouse('mousedown'); mouse('mouseup');
        assert(calls === 2, 'Two rapid mouse clicks both execute synchronously');
        mouse('mouseup'); button.click();
        assert(calls === 2, 'Extra release and click events do not duplicate activation');
        touch('touchstart'); touch('touchend');
        touch('touchstart'); touch('touchend');
        assert(calls === 4, 'Two rapid touch taps both execute synchronously');
        mouse('mouseup'); button.click();
        assert(calls === 4, 'Trailing compatibility events do not activate again');
        mouse('mousedown'); mouse('mousemove', true); mouse('mouseup', true);
        touch('touchstart'); touch('touchmove', true); touch('touchend', true);
        touch('touchstart'); touch('touchcancel'); touch('touchend');
        assert(calls === 4, 'Outside release and touch cancellation do not activate');
        button.classList.add('disabled');
        mouse('mousedown'); mouse('mouseup'); touch('touchstart'); touch('touchend');
        assert(calls === 4, 'Disabled buttons remain inactive');
        button.classList.remove('disabled');
        reenter = true; mouse('mousedown'); mouse('mouseup');
        assert(calls === 5, 'An action cannot reactivate its unfinished press');
        await new Promise(resolve => setTimeout(resolve, 350));
        assert(calls === 5, 'No delayed activations remain queued');
    } finally { container.remove(); }
    return 'GUI buttons: immediate rapid mouse/touch releases, no duplicates or delayed actions, disabled/cancelled/outside gestures and callback reentry';
}
