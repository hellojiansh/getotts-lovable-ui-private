/* ============================================
   GetOTTs — Email OTP Verification
   Shows after WhatsApp/Telegram login.
   Sends OTP from no-reply@getotts.com via backend.
   ============================================ */

const EMAIL_VERIFY = {
    email: null,
    _otpTimer: null,
    _resendTimer: null,
    _resendCountdown: 30,

    /**
     * Show the email verification modal
     */
    show() {
        const overlay = document.getElementById('emailModalOverlay');
        if (overlay) overlay.classList.add('active');

        // Focus email input
        setTimeout(() => {
            const input = document.getElementById('verifyEmailInput');
            if (input) input.focus();
        }, 300);

        // Setup Enter key handler
        const input = document.getElementById('verifyEmailInput');
        if (input) {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') EMAIL_VERIFY.sendOtp();
            });
        }
    },

    /**
     * Hide the modal
     */
    hide() {
        const overlay = document.getElementById('emailModalOverlay');
        if (overlay) overlay.classList.remove('active');
        clearInterval(EMAIL_VERIFY._otpTimer);
        clearInterval(EMAIL_VERIFY._resendTimer);
    },

    /**
     * Send OTP to the entered email
     */
    async sendOtp() {
        const API = (window.GETOTTS_CONFIG && window.GETOTTS_CONFIG.API_BASE) || '';
        const input = document.getElementById('verifyEmailInput');
        const errorEl = document.getElementById('emailError');
        const btn = document.getElementById('sendOtpBtn');
        const email = (input?.value || '').trim().toLowerCase();

        // Validate
        if (!email || !email.includes('@') || !email.split('@')[1]?.includes('.')) {
            if (input) input.classList.add('error');
            if (errorEl) errorEl.textContent = 'Please enter a valid email address';
            return;
        }

        if (input) input.classList.remove('error');
        if (errorEl) errorEl.textContent = '';

        EMAIL_VERIFY.email = email;

        // Disable button
        if (btn) {
            btn.innerHTML = '<span class="wa-spinner"></span> Sending...';
            btn.disabled = true;
        }

        try {
            const token = localStorage.getItem('GetOTTs_customer_token') || '';
            const res = await fetch(`${API}/email-otp/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, token }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Failed to send OTP');

            // Switch to OTP input step
            EMAIL_VERIFY.showOtpStep();

        } catch (err) {
            if (errorEl) errorEl.textContent = err.message || 'Failed to send OTP. Try again.';
            if (btn) {
                btn.innerHTML = 'Send Verification Code';
                btn.disabled = false;
            }
        }
    },

    /**
     * Show the OTP input step
     */
    showOtpStep() {
        document.getElementById('emailStep1').style.display = 'none';
        document.getElementById('emailStep2').style.display = 'block';

        document.getElementById('sentToEmail').textContent = EMAIL_VERIFY.email;

        // Setup OTP inputs
        EMAIL_VERIFY.setupOtpInputs();

        // Start countdown timer
        EMAIL_VERIFY.startOtpCountdown(600); // 10 minutes

        // Start resend countdown
        EMAIL_VERIFY.startResendCountdown();

        // Focus first OTP input
        const inputs = document.querySelectorAll('#otpInputs input');
        if (inputs[0]) inputs[0].focus();
    },

    /**
     * Setup OTP input auto-advance + paste handling
     */
    setupOtpInputs() {
        const inputs = document.querySelectorAll('#otpInputs input');

        inputs.forEach((input, i) => {
            // Auto-advance on input
            input.addEventListener('input', (e) => {
                const val = e.target.value;
                if (val && i < inputs.length - 1) {
                    inputs[i + 1].focus();
                }
                // Auto-submit when all filled
                if (i === inputs.length - 1 && val) {
                    const otp = Array.from(inputs).map(inp => inp.value).join('');
                    if (otp.length === 6) {
                        EMAIL_VERIFY.verifyOtp();
                    }
                }
            });

            // Backspace navigation
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace' && !e.target.value && i > 0) {
                    inputs[i - 1].focus();
                }
            });

            // Handle paste
            input.addEventListener('paste', (e) => {
                e.preventDefault();
                const pasted = (e.clipboardData.getData('text') || '').replace(/\D/g, '');
                pasted.split('').forEach((char, j) => {
                    if (inputs[i + j]) {
                        inputs[i + j].value = char;
                    }
                });
                // Focus last filled or next empty
                const nextIdx = Math.min(i + pasted.length, inputs.length - 1);
                inputs[nextIdx].focus();
                // Auto-submit
                if (pasted.length === 6) {
                    setTimeout(() => EMAIL_VERIFY.verifyOtp(), 100);
                }
            });
        });
    },

    /**
     * Verify the entered OTP
     */
    async verifyOtp() {
        const API = (window.GETOTTS_CONFIG && window.GETOTTS_CONFIG.API_BASE) || '';
        const inputs = document.querySelectorAll('#otpInputs input');
        const otp = Array.from(inputs).map(inp => inp.value).join('');
        const errorEl = document.getElementById('otpError');
        const btn = document.getElementById('verifyOtpBtn');

        if (otp.length !== 6) {
            if (errorEl) errorEl.textContent = 'Please enter the complete 6-digit code';
            return;
        }

        if (errorEl) errorEl.textContent = '';
        if (btn) {
            btn.innerHTML = '<span class="wa-spinner"></span> Verifying...';
            btn.disabled = true;
        }

        try {
            const token = localStorage.getItem('GetOTTs_customer_token') || '';
            const res = await fetch(`${API}/email-otp/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: EMAIL_VERIFY.email,
                    otp: otp,
                    token: token,
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Verification failed');

            // ✅ Success — update local customer data
            try {
                const customerRaw = localStorage.getItem('GetOTTs_customer');
                if (customerRaw) {
                    const customer = JSON.parse(customerRaw);
                    customer.email = EMAIL_VERIFY.email;
                    customer.email_verified = true;
                    localStorage.setItem('GetOTTs_customer', JSON.stringify(customer));
                }
            } catch {}

            clearInterval(EMAIL_VERIFY._otpTimer);
            clearInterval(EMAIL_VERIFY._resendTimer);

            // Show success step
            document.getElementById('emailStep2').style.display = 'none';
            document.getElementById('emailStep3').style.display = 'block';

        } catch (err) {
            if (errorEl) errorEl.textContent = err.message || 'Invalid OTP. Try again.';
            if (btn) {
                btn.innerHTML = 'Verify Email';
                btn.disabled = false;
            }
            // Clear inputs on error
            inputs.forEach(inp => inp.value = '');
            if (inputs[0]) inputs[0].focus();
        }
    },

    /**
     * OTP countdown timer
     */
    startOtpCountdown(totalSeconds) {
        let remaining = totalSeconds;
        const timerEl = document.getElementById('otpTimer');

        EMAIL_VERIFY._otpTimer = setInterval(() => {
            remaining--;
            if (remaining <= 0) {
                clearInterval(EMAIL_VERIFY._otpTimer);
                if (timerEl) timerEl.innerHTML = '<strong style="color:#ef4444;">Code expired</strong>';
                return;
            }
            const mins = Math.floor(remaining / 60);
            const secs = remaining % 60;
            if (timerEl) {
                timerEl.innerHTML = `Code expires in <strong>${mins}:${String(secs).padStart(2, '0')}</strong>`;
            }
        }, 1000);
    },

    /**
     * Resend button countdown
     */
    startResendCountdown() {
        let countdown = 30;
        const resendBtn = document.getElementById('resendBtn');
        if (resendBtn) resendBtn.disabled = true;

        EMAIL_VERIFY._resendTimer = setInterval(() => {
            countdown--;
            if (countdown <= 0) {
                clearInterval(EMAIL_VERIFY._resendTimer);
                if (resendBtn) {
                    resendBtn.textContent = 'Resend code';
                    resendBtn.disabled = false;
                }
                return;
            }
            if (resendBtn) {
                resendBtn.textContent = `Resend code (${countdown}s)`;
            }
        }, 1000);
    },

    /**
     * Resend OTP
     */
    async resend() {
        // Reset to step 1's send logic but stay on step 2
        const API = (window.GETOTTS_CONFIG && window.GETOTTS_CONFIG.API_BASE) || '';
        const resendBtn = document.getElementById('resendBtn');
        const errorEl = document.getElementById('otpError');

        if (resendBtn) resendBtn.disabled = true;
        if (errorEl) errorEl.textContent = '';

        try {
            const token = localStorage.getItem('GetOTTs_customer_token') || '';
            const res = await fetch(`${API}/email-otp/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: EMAIL_VERIFY.email, token }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.detail || 'Failed to resend');
            }

            if (typeof Toast !== 'undefined') {
                Toast.success('Email Sent', 'New verification code sent! Check your inbox.');
            } else if (typeof showAuthToast === 'function') {
                showAuthToast('New code sent! Check your email.', 'success');
            }

            // Restart countdown
            clearInterval(EMAIL_VERIFY._otpTimer);
            EMAIL_VERIFY.startOtpCountdown(600);
            EMAIL_VERIFY.startResendCountdown();

            // Clear old inputs
            document.querySelectorAll('#otpInputs input').forEach(inp => inp.value = '');
            document.querySelector('#otpInputs input')?.focus();

        } catch (err) {
            if (errorEl) errorEl.textContent = err.message || 'Failed to resend. Try again.';
            EMAIL_VERIFY.startResendCountdown();
        }
    },

    /**
     * Skip email verification
     */
    skip() {
        EMAIL_VERIFY.hide();
        window.location.href = 'dashboard';
    },

    /**
     * Done — go to dashboard
     */
    done() {
        EMAIL_VERIFY.hide();
        window.location.href = 'dashboard';
    },
};
