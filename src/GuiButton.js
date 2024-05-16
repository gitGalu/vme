import { s } from "./dom";
import { EnvironmentManager } from "./EnvironmentManager";

export function createGuiButton(buttonId, buttonText, shortcutKey, callback, visualFeedback = true, customFeedbackClass) {
    const button = createButtonElement(buttonId, buttonText, shortcutKey);
    const feedbackClass = customFeedbackClass || "guiBtn-pressed";

    addButtonToContainer(button, 'menu-button-strip');
    setupButtonInteractions(button, callback, visualFeedback, feedbackClass);
}

function createButtonElement(id, text, shortcut) {
    const button = document.createElement('span');
    button.id = id;
    button.innerHTML = `&nbsp;${text}&nbsp;`;
    button.setAttribute('data-shortcut', shortcut);
    button.dataset.originalText = `&nbsp;${text}&nbsp;`;
    button.classList.add("clabel");
    return button;
}

function addButtonToContainer(button, containerId) {
    const container = document.getElementById(containerId);
    container.appendChild(button);
}

function setupButtonInteractions(button, callback, visualFeedback, feedbackClass) {
    button.dataset.isSelected = "false";

    function isEnabled() {
        return !button.classList.contains('disabled');
    }

    button.addEventListener("pointerdown", event => handlePointerDown(event, button, isEnabled, visualFeedback, feedbackClass));
    button.addEventListener("pointermove", event => handlePointerMove(event, button, isEnabled, visualFeedback, feedbackClass));
    button.addEventListener("pointercancel", event => handlePointerCancel(event, button, isEnabled, visualFeedback, feedbackClass));
    button.addEventListener("pointerup", event => handlePointerUp(event, button, isEnabled, callback, visualFeedback, feedbackClass));
}

function handlePointerDown(event, button, isEnabled, visualFeedback, feedbackClass) {
    event.preventDefault();
    if (isEnabled()) {
        button.dataset.isSelected = "true";
        if (visualFeedback) button.classList.add(feedbackClass);
    }
}

function handlePointerMove(event, button, isEnabled, visualFeedback, feedbackClass) {
    event.preventDefault();
    if (isEnabled()) {
        const element = document.elementFromPoint(event.clientX, event.clientY);
        updateSelectionOnMove(element, event.target, button, visualFeedback, feedbackClass);
    }
}

function handlePointerCancel(event, button, isEnabled, visualFeedback, feedbackClass) {
    event.preventDefault();
    if (isEnabled()) {
        button.dataset.isSelected = "false";
        if (visualFeedback) button.classList.remove(feedbackClass);
    }
}

function handlePointerUp(event, button, isEnabled, callback, visualFeedback, feedbackClass) {
    event.preventDefault();
    if (isEnabled() && button.dataset.isSelected === "true") {
        callback();
        if (visualFeedback) button.classList.remove(feedbackClass);
    }
    button.dataset.isSelected = "false";
}

function updateSelectionOnMove(element, target, button, visualFeedback, feedbackClass) {
    if (element !== target) {
        if (button.dataset.isSelected === "true") {
            button.dataset.isSelected = "false";
            if (visualFeedback) button.classList.remove(feedbackClass);
        }
    } else {
        if (button.dataset.isSelected === "false") {
            button.dataset.isSelected = "true";
            if (visualFeedback) button.classList.add(feedbackClass);
        }
    }
}