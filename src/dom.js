export function s(sel) {
	return document.querySelector(sel);
}

const buttonListenerMap = new WeakMap();

export function insert(el, html) {
	if (typeof el === "string" || el instanceof String) {
		el = s(el);
	} 
	el.insertAdjacentHTML("beforeend", html);
}

export function show(sel, disp) {
	var el = s(sel);
	if (el == undefined) return;
	if (disp == undefined) disp = "block";
	el.style.display = disp;
}

export function hide(sel) {
	var el = s(sel);
	if (el == undefined) return;
	el.style.display = "none";
}

export function toggle(el) {
	if (window.getComputedStyle(el).display === "block") {
		el.style.display = "none";
		return;
	}
	el.style.display = "block";
}

export function addButtonEventListeners(button, handleAction) {
    let isPressed = false;

    const handleEvent = (pressed) => {
        handleAction(pressed);
    };

    const onMouseDown = () => {
        isPressed = true;
        handleEvent(true);
    };
    const onMouseUp = () => {
        if (isPressed) {
            handleEvent(false);
            isPressed = false;
        }
    };
    const onMouseLeave = () => {
        if (isPressed) {
            handleEvent(false);
            isPressed = false;
        }
    };

    button.addEventListener('mousedown', onMouseDown);
    button.addEventListener('mouseup', onMouseUp);
    button.addEventListener('mouseleave', onMouseLeave);

    const existing = buttonListenerMap.get(button) || [];
    existing.push({ onMouseDown, onMouseUp, onMouseLeave });
    buttonListenerMap.set(button, existing);
}

export function removeButtonEventListeners(button) {
    const listeners = buttonListenerMap.get(button);
    if (!listeners) return;

    listeners.forEach(({ onMouseDown, onMouseUp, onMouseLeave }) => {
        button.removeEventListener('mousedown', onMouseDown);
        button.removeEventListener('mouseup', onMouseUp);
        button.removeEventListener('mouseleave', onMouseLeave);
    });

    buttonListenerMap.delete(button);
}