export function s(sel) {
	return document.querySelector(sel);
}

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

    button.addEventListener('mousedown', () => {
        isPressed = true;
        handleEvent(true);
    });
    button.addEventListener('mouseup', () => {
        if (isPressed) {
            handleEvent(false);
            isPressed = false;
        }
    });
    button.addEventListener('mouseleave', () => {
        if (isPressed) {
            handleEvent(false);
            isPressed = false;
        }
    });
}