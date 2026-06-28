/* ============================================
   GetOTTs — Telegram Login System
   Uses Telegram Bot deep links + manual/auto verification.
   ============================================ */

const TG_AUTH = {
    code: null,
    pollTimer: null,
    pollCount: 0,
    maxPolls: 200, 
    _countdownTimer: null,

    async start() {
        let API = (window.GETOTTS_CONFIG && window.GETOTTS_CONFIG.API_BASE) || '';
        if (!API) {
            showAuthToast('Service unavailable. Try again later.', 'error');
            return;
        }

        const tgBtn = document.getElementById('tgLoginBtn');
        if (tgBtn) {
            tgBtn.innerHTML = '<span class="tg-spinner"></span> Connecting...';
            tgBtn.disabled = true;
        }

        try {
            const res = await fetch(`${API}/tg-auth/request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            });

            if (res.status === 429) {
                throw new Error('Too many attempts. Please wait 60 seconds.');
            }

            const data = await res.json();
            if (!data.success) throw new Error(data.detail || 'Failed to generate code');

            TG_AUTH.code = data.code;
            TG_AUTH.showWaitingUI(data);

            // Open Telegram
            window.open(data.tg_link, '_blank');

            // Start polling
            TG_AUTH.startPolling();

        } catch (err) {
            console.error('[TG-AUTH]', err);
            showAuthToast(err?.message || 'Failed to start Telegram login.', 'error');
            TG_AUTH.resetButton();
        }
    },

    resetButton() {
        const tgBtn = document.getElementById('tgLoginBtn');
        if (tgBtn) {
            tgBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="currentColor" style="width:20px;height:20px"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.11.02-1.93 1.23-5.46 3.62-.51.35-.98.52-1.4.51-.46-.01-1.35-.26-2.01-.48-.81-.27-1.45-.41-1.39-.87.03-.24.37-.48 1.02-.73 3.99-1.73 6.66-2.87 8.01-3.41 3.81-1.53 4.6-.1.01.01z"/></svg>
                Login with Telegram
            `;
            tgBtn.disabled = false;
        }
    },

    showWaitingUI(data) {
        const card = document.querySelector('.auth-card');
        if (!card) return;

        card.innerHTML = `
            <div class="wa-waiting">
                <div class="wa-waiting-icon">
                    <svg viewBox="0 0 24 24" fill="#0088cc" style="width:48px;height:48px"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.11.02-1.93 1.23-5.46 3.62-.51.35-.98.52-1.4.51-.46-.01-1.35-.26-2.01-.48-.81-.27-1.45-.41-1.39-.87.03-.24.37-.48 1.02-.73 3.99-1.73 6.66-2.87 8.01-3.41 3.81-1.53 4.6-.1.01.01z"/></svg>
                </div>
                <h2>Telegram Verification</h2>
                <p class="wa-waiting-sub">Click "Start" in our bot to verify your identity</p>
                
                <div class="wa-code-display" style="border-color:#0088cc; color:#0088cc">
                    <span class="wa-code-value">LOGIN-${data.code}</span>
                </div>

                <div class="wa-progress">
                    <div class="wa-progress-bar" id="tgProgressBar" style="background:#0088cc"></div>
                </div>
                <p class="wa-timer" id="tgTimer">Expires in <strong>10:00</strong></p>

                <div class="wa-steps">
                    <div class="wa-step done">
                        <div class="wa-step-num" style="background:#0088cc">1</div>
                        <span>Bot opened</span>
                    </div>
                    <div class="wa-step active" id="tgStep2">
                        <div class="wa-step-num" style="background:#0088cc">2</div>
                        <span>Click Start</span>
                    </div>
                    <div class="wa-step" id="tgStep3">
                        <div class="wa-step-num" style="background:#0088cc">3</div>
                        <span>Auto-verifying</span>
                    </div>
                </div>

                <div class="wa-actions-row">
                    <a href="${data.tg_link}" target="_blank" class="btn btn-primary" style="background:#0088cc; border:none">
                        Open Bot Again
                    </a>
                    <button class="btn btn-outline wa-cancel-btn" onclick="TG_AUTH.cancel()">Cancel</button>
                </div>
            </div>
        `;

        TG_AUTH.startCountdown(data.expires_in || 600);
    },

    startPolling() {
        let API = (window.GETOTTS_CONFIG && window.GETOTTS_CONFIG.API_BASE) || '';
        TG_AUTH.pollCount = 0;
        
        TG_AUTH.pollTimer = setInterval(async () => {
            TG_AUTH.pollCount++;

            if (TG_AUTH.pollCount > TG_AUTH.maxPolls) {
                TG_AUTH.cancel();
                showAuthToast('Session expired.', 'error');
                return;
            }

            try {
                const res = await fetch(`${API}/tg-auth/check/${TG_AUTH.code}`);
                if (!res.ok) return;

                const data = await res.json();
                if (data.status === 'verified') {
                    TG_AUTH.onVerified(data);
                }
            } catch (err) {}
        }, 3000);
    },

    onVerified(data) {
        clearInterval(TG_AUTH.pollTimer);
        clearInterval(TG_AUTH._countdownTimer);

        localStorage.setItem('GetOTTs_customer_token', data.token);
        localStorage.setItem('GetOTTs_customer', JSON.stringify({
            ...data.customer,
            login_method: 'telegram',
            logged_in_at: new Date().toISOString(),
        }));

        const card = document.querySelector('.auth-card');
        if (card) {
            card.innerHTML = `
                <div class="wa-success">
                    <div class="wa-success-check" style="background:#0088cc">✅</div>
                    <h2>Verified!</h2>
                    <p>Welcome, <strong>${data.customer.name}</strong>!</p>
                    <p class="wa-redirect-msg">Redirecting to dashboard...</p>
                </div>
            `;
        }

        setTimeout(() => { window.location.href = '/dashboard'; }, 800);
    },

    startCountdown(totalSeconds) {
        let remaining = totalSeconds;
        TG_AUTH._countdownTimer = setInterval(() => {
            remaining--;
            if (remaining <= 0) TG_AUTH.cancel();
            const mins = Math.floor(remaining / 60);
            const secs = remaining % 60;
            const timer = document.getElementById('tgTimer');
            if (timer) timer.innerHTML = `Expires in <strong>${mins}:${String(secs).padStart(2, '0')}</strong>`;
            const bar = document.getElementById('tgProgressBar');
            if (bar) bar.style.width = `${(remaining / totalSeconds) * 100}%`;
        }, 1000);
    },

    cancel() {
        clearInterval(TG_AUTH.pollTimer);
        clearInterval(TG_AUTH._countdownTimer);
        window.location.reload();
    }
};
