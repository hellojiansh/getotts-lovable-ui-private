/** Premium Toast Notification Manager */
const Toast = {
    init() {
        if (!document.getElementById('toast-container')) {
            const container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
    },

    show(title, message, type = 'info', duration) {
        this.init();
        const container = document.getElementById('toast-container');
        const requestedDuration = Number.isFinite(duration)
            ? duration
            : (type === 'error' ? 12000 : 7000);
        const displayDuration = type === 'error'
            ? Math.max(requestedDuration, 12000)
            : Math.max(requestedDuration, 7000);
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        const icons = {
            success: '<i data-lucide="check-circle"></i>',
            error: '<i data-lucide="alert-circle"></i>',
            info: '<i data-lucide="info"></i>'
        };

        toast.innerHTML = `
            <div class="toast-icon">${icons[type]}</div>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-msg">${message}</div>
            </div>
            <button class="toast-close" onclick="this.parentElement.remove()"><i data-lucide="x"></i></button>
        `;

        container.appendChild(toast);
        if (window.lucide) lucide.createIcons();

        let removeTimer = null;
        const startRemoveTimer = () => {
            window.clearTimeout(removeTimer);
            removeTimer = window.setTimeout(() => {
                toast.classList.add('removing');
                window.setTimeout(() => toast.remove(), 300);
            }, displayDuration);
        };

        toast.addEventListener('mouseenter', () => window.clearTimeout(removeTimer));
        toast.addEventListener('focusin', () => window.clearTimeout(removeTimer));
        toast.addEventListener('mouseleave', startRemoveTimer);
        toast.addEventListener('focusout', startRemoveTimer);

        startRemoveTimer();
    },

    success(title, msg, duration) {
        this.show(title, msg, 'success', duration);
    },

    error(title, msg, duration) {
        this.show(title, msg, 'error', duration);
    },

    info(title, msg, duration) {
        this.show(title, msg, 'info', duration);
    }
};

window.Toast = Toast;
