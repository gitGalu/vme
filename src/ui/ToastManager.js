export class ToastManager {
    static container = document.getElementById('toast-container') || ToastManager.createContainer();
    static queue = [];
    static activeToasts = 0;
    static maxVisible = 3;

    static createContainer() {
        const container = document.createElement('div');
        container.id = 'toast-container';
        container.setAttribute('aria-live', 'polite');
        container.setAttribute('aria-relevant', 'additions');
        document.body.appendChild(container);
        return container;
    }

    static showToast(message) {
        this.enqueueToast(message, false, null, null, 1000);
    }

    static showManualToast(message) {
        this.enqueueToast(message, true);
    }

    static enqueueCustomToast(message, buttonLabel, callback, autoCloseTime = 5000) {
        this.enqueueToast(message, false, buttonLabel, callback, autoCloseTime);
    }

    static enqueueToast(message, isManualClose, buttonLabel = null, callback = null, autoCloseTime = 1000) {
        this.queue.push({ message, isManualClose, buttonLabel, callback, autoCloseTime });
        this.displayNextToast();
    }

    static displayNextToast() {
        if (this.queue.length === 0 || this.activeToasts >= this.maxVisible) {
            return;
        }

        const { message, isManualClose, buttonLabel, callback, autoCloseTime } = this.queue.shift();

        const toast = document.createElement('div');
        toast.classList.add('toast-message');
        const content = document.createElement('span');
        content.className = 'toast-message__content';
        content.textContent = message;
        toast.appendChild(content);

        if (buttonLabel && callback) {
            const button = this.createButton(buttonLabel, 'custom-button');
            button.addEventListener('click', () => {
                callback();
                this.hideToast(toast);
            });
            toast.appendChild(button);
        } else if (isManualClose) {
            const button = this.createButton('CLOSE', 'close-label');
            button.addEventListener('click', () => this.hideToast(toast));
            toast.appendChild(button);
        }

        this.container.appendChild(toast);
        this.activeToasts++;

        requestAnimationFrame(() => {
            if (!toast.classList.contains('hide')) toast.classList.add('show');
        });

        if (!isManualClose) {
            setTimeout(() => this.hideToast(toast), autoCloseTime);
        }
    }

    static createButton(label, className) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = className;
        button.textContent = label;
        return button;
    }

    static hideToast(toast) {
        if (!toast.isConnected || toast.classList.contains('hide')) return;
        toast.classList.remove('show');
        toast.classList.add('hide');

        let finished = false;
        let fallback;
        const finish = () => {
            if (finished) return;
            finished = true;
            clearTimeout(fallback);
            toast.removeEventListener('transitionend', onEnd);
            toast.remove();
            this.activeToasts--;
            this.displayNextToast();
        };
        const onEnd = event => {
            if (event.target === toast && event.propertyName === 'opacity') finish();
        };
        if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
            finish();
        } else {
            toast.addEventListener('transitionend', onEnd);
            // Also finish if a transition is interrupted or no frame was painted.
            fallback = setTimeout(finish, 250);
        }
    }
}
