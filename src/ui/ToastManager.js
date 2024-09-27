export class ToastManager {
    static container = document.getElementById('toast-container') || ToastManager.createContainer();
    static queue = [];
    static activeToasts = 0;
    static maxVisible = 3;

    static createContainer() {
        const container = document.createElement('div');
        container.id = 'toast-container';
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

        if (buttonLabel && callback) {
            toast.innerHTML = `${message} <span class="custom-button"><strong>${buttonLabel}</strong></span>`;
            toast.querySelector('.custom-button').addEventListener('click', () => {
                callback();
                this.hideToast(toast, true);
            });
        } else if (isManualClose) {
            toast.innerHTML = `${message} <span class="close-label"><strong>CLOSE</strong></span>`;
            toast.querySelector('.close-label').addEventListener('click', () => this.hideToast(toast, true));
        } else {
            toast.textContent = message;
        }

        this.container.appendChild(toast);
        this.activeToasts++;

        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        if (!isManualClose) {
            setTimeout(() => this.hideToast(toast), autoCloseTime);
        }
    }

    static hideToast(toast, fromCloseButton = false) {
        toast.classList.remove('show');
        toast.classList.add('hide');

        toast.addEventListener('transitionend', () => {
            toast.remove();
            this.activeToasts--;
            if (!fromCloseButton) {
                this.displayNextToast();
            }
        });
    }
}