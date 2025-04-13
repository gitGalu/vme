export function createGuiButton(
    buttonId, 
    buttonText, 
    shortcutKey, 
    callback, 
    visualFeedback = true, 
    customFeedbackClass, 
    targetContainer = 'menu-button-strip'
) {
    const button = createButtonElement(buttonId, buttonText, shortcutKey);
    const feedbackClass = customFeedbackClass || "guiBtn-pressed";
    addButtonToContainer(button, targetContainer);
    setupButtonInteractions(button, callback, visualFeedback, feedbackClass);
    preventButtonFocus(button);
}

function createButtonElement(id, text, shortcut) {
    const button = document.createElement('button');
    button.id = id;
    button.innerHTML = `&nbsp;${text}&nbsp;`;
    button.setAttribute('data-shortcut', shortcut);
    button.dataset.originalText = `&nbsp;${text}&nbsp;`;
    button.classList.add("clabel");
    button.type = 'button';
    button.tabIndex = -1;
    button.setAttribute('tabindex', '-1');
    button.setAttribute('aria-hidden', 'true');
    button.style.pointerEvents = 'none';
    return button;
}

function preventButtonFocus(button) {
    setTimeout(() => {
        button.style.pointerEvents = 'auto';
    }, 0);
    
    button.addEventListener('mousedown', (e) => {
        e.preventDefault();
    }, true);
    
    button.addEventListener('focus', (e) => {
        button.blur();
    });

    return button;
}

function addButtonToContainer(button, containerId) {
    const container = document.getElementById(containerId);
    if (container) {
        container.appendChild(button);
    }
}

function debounce(func, wait) {
    let timeout;
    let lastTime = 0;
    return function executedFunction(...args) {
        const now = Date.now();
        const timeSinceLastCall = now - lastTime;
        
        clearTimeout(timeout);
        
        if (timeSinceLastCall >= wait) {
            func.apply(this, args);
            lastTime = now;
        } else {
            timeout = setTimeout(() => {
                func.apply(this, args);
                lastTime = Date.now();
            }, wait);
        }
    };
}

function isPointInElement(x, y, element) {
    const rect = element.getBoundingClientRect();
    return (
        x >= rect.left &&
        x <= rect.right &&
        y >= rect.top &&
        y <= rect.bottom
    );
}

function setupButtonInteractions(button, callback, visualFeedback, feedbackClass) {
    let isPressed = false;
    let touchStartedInside = false;
    const minTimeBetweenClicks = 300;
    
    const debouncedCallback = debounce(() => {
        if (!button.classList.contains('disabled')) {
            callback();
        }
    }, minTimeBetweenClicks);

    function addFeedback() {
        if (visualFeedback && !button.classList.contains('disabled')) {
            button.classList.add(feedbackClass);
        }
    }

    function removeFeedback() {
        if (visualFeedback) {
            button.classList.remove(feedbackClass);
        }
    }

    button.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        if (!isPressed && isPointInElement(touch.clientX, touch.clientY, button)) {
            isPressed = true;
            touchStartedInside = true;
            addFeedback();
        }
    }, { passive: false });

    button.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (isPressed && touchStartedInside) {
            const touch = e.touches[0];
            const isInside = isPointInElement(touch.clientX, touch.clientY, button);
            
            if (isInside && !button.classList.contains(feedbackClass)) {
                addFeedback();
            } else if (!isInside && button.classList.contains(feedbackClass)) {
                removeFeedback();
            }
        }
    }, { passive: false });

    button.addEventListener('touchend', (e) => {
        e.preventDefault();
        if (isPressed && touchStartedInside) {
            const touch = e.changedTouches[0];
            const isInside = isPointInElement(touch.clientX, touch.clientY, button);
            
            if (isInside) {
                debouncedCallback();
            }
            
            isPressed = false;
            touchStartedInside = false;
            removeFeedback();
        }
    }, { passive: false });

    button.addEventListener('touchcancel', () => {
        isPressed = false;
        touchStartedInside = false;
        removeFeedback();
    });

    button.addEventListener('mousedown', (e) => {
        e.preventDefault();
        if (e.button === 0 && !isPressed) {
            isPressed = true;
            touchStartedInside = true;
            addFeedback();
        }
    });

    window.addEventListener('mousemove', (e) => {
        if (isPressed && touchStartedInside) {
            const isInside = isPointInElement(e.clientX, e.clientY, button);
            
            if (isInside && !button.classList.contains(feedbackClass)) {
                addFeedback();
            } else if (!isInside && button.classList.contains(feedbackClass)) {
                removeFeedback();
            }
        }
    });

    window.addEventListener('mouseup', (e) => {
        if (isPressed && touchStartedInside) {
            const isInside = isPointInElement(e.clientX, e.clientY, button);
            
            if (isInside) {
                debouncedCallback();
            }
            
            isPressed = false;
            touchStartedInside = false;
            removeFeedback();
        }
    });
}