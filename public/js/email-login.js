const EMAIL_LOGIN = {
    email: '',
    resendInterval: null,

    init() {
        const inputs = document.querySelectorAll('#loginOtpInputs input');
        inputs.forEach((input, index) => {
            input.addEventListener('input', (e) => {
                if (e.target.value.length === 1 && index < 5) inputs[index + 1].focus();
                if (this.getOtp().length === 6) this.verifyOtp();
            });
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace' && !e.target.value && index > 0) inputs[index - 1].focus();
            });
            input.addEventListener('paste', (e) => {
                e.preventDefault();
                const paste = (e.clipboardData || window.clipboardData).getData('text').replace(/[^0-9]/g, '').slice(0, 6);
                paste.split('').forEach((char, i) => { if (inputs[i]) inputs[i].value = char; });
                if (paste.length === 6) { inputs[5].focus(); this.verifyOtp(); }
                else if (inputs[paste.length]) inputs[paste.length].focus();
            });
        });
    },

    getOtp() {
        return Array.from(document.querySelectorAll('#loginOtpInputs input')).map(i => i.value).join('');
    },

    async sendOtp() {
        const input = document.getElementById('loginEmailInput');
        const email = input.value.trim().toLowerCase();
        if (!email || !email.includes('@')) {
            showAuthToast("Please enter a valid email address", "error");
            input.style.borderColor = '#ef4444';
            return;
        }

        input.style.borderColor = 'var(--gray-200)';
        const btn = document.querySelector('button[onclick="EMAIL_LOGIN.sendOtp()"]');
        btn.innerHTML = '<span class="wa-spinner"></span> Sending...';
        btn.disabled = true;

        try {
            const API = (window.GETOTTS_CONFIG && window.GETOTTS_CONFIG.API_BASE) || '';
            const res = await fetch(`${API}/email-otp/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            const data = await res.json();
            
            if (data.success) {
                this.email = email;
                document.getElementById('loginMethodSelection').style.display = 'none';
                document.getElementById('emailOtpView').style.display = 'block';
                document.getElementById('sentToEmailDisplay').innerText = email;
                document.querySelector('#loginOtpInputs input').focus();
                this.startResendTimer();
            } else {
                showAuthToast(data.detail || "Failed to send code", "error");
            }
        } catch (e) {
            showAuthToast("Network error. Try again.", "error");
        } finally {
            btn.innerHTML = 'Continue with Email';
            btn.disabled = false;
        }
    },

    async verifyOtp() {
        const otp = this.getOtp();
        if (otp.length !== 6) return;

        const btn = document.querySelector('button[onclick="EMAIL_LOGIN.verifyOtp()"]');
        btn.innerHTML = '<span class="wa-spinner"></span> Verifying...';
        btn.disabled = true;

        try {
            const API = (window.GETOTTS_CONFIG && window.GETOTTS_CONFIG.API_BASE) || '';
            const res = await fetch(`${API}/email-otp/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: this.email, otp })
            });
            const data = await res.json();
            
            if (data.success) {
                localStorage.setItem('GetOTTs_customer_token', data.token);
                localStorage.setItem('GetOTTs_customer', JSON.stringify(data.customer));
                
                btn.innerHTML = 'Success!';
                btn.style.background = '#25D366';
                btn.style.color = 'white';
                
                showAuthToast("Logged in successfully!", "success");
                setTimeout(() => window.location.href = '/dashboard', 1000);
            } else {
                showAuthToast(data.detail || "Invalid code", "error");
                document.querySelectorAll('#loginOtpInputs input').forEach(i => i.value = '');
                document.querySelector('#loginOtpInputs input').focus();
                btn.innerHTML = 'Verify & Login';
                btn.disabled = false;
            }
        } catch (e) {
            showAuthToast("Network error. Try again.", "error");
            btn.innerHTML = 'Verify & Login';
            btn.disabled = false;
        }
    },

    startResendTimer() {
        let timeLeft = 30;
        const btn = document.getElementById('loginResendBtn');
        btn.disabled = true;
        
        clearInterval(this.resendInterval);
        this.resendInterval = setInterval(() => {
            timeLeft--;
            btn.innerText = `Resend code (${timeLeft}s)`;
            if (timeLeft <= 0) {
                clearInterval(this.resendInterval);
                btn.innerText = 'Resend code';
                btn.disabled = false;
            }
        }, 1000);
    },

    resend() {
        this.sendOtp();
    },

    back() {
        document.getElementById('emailOtpView').style.display = 'none';
        document.getElementById('loginMethodSelection').style.display = 'block';
        clearInterval(this.resendInterval);
    }
};

document.addEventListener('DOMContentLoaded', () => EMAIL_LOGIN.init());
