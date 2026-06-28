/* ============================================
   GetOTTs — WhatsApp Web Login System
   No official API. Uses wa.me deep links +
   admin manual verification via admin panel.

   Flow:
   1. User clicks "Login with WhatsApp"
   2. Backend generates unique code
   3. wa.me opens → user sends code to admin's WhatsApp
   4. Admin sees code on WhatsApp Web → clicks Verify in admin panel
   5. Frontend polls /check/{code} → detects verified → auto-login
   ============================================ */

const WA_AUTH = {
    code: null,
    pollTimer: null,
    pollCount: 0,
    maxPolls: 200, // 10 minutes at 3s intervals
    _countdownTimer: null,

    /**
     * Start WhatsApp login flow
     */
    async start(phone) {
        let API = (window.GETOTTS_CONFIG && window.GETOTTS_CONFIG.API_BASE) || '';
        if (!API) {
            if (typeof Toast !== 'undefined') Toast.error('Service Unavailable', 'Auth service is currently down.');
            else showAuthToast('Service unavailable. Try again later.', 'error');
            return;
        }

        // Update UI — show loading state
        const waBtn = document.getElementById('waLoginBtn');
        if (waBtn) {
            waBtn.innerHTML = '<span class="wa-spinner"></span> Generating code...';
            waBtn.disabled = true;
        }



        try {
            const res = await fetch(`${API}/wa-auth/request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone: phone || '',   // User's real phone number from login form
                    name: '',
                }),
            });

            // Handle rate limiting
            if (res.status === 429) {
                throw new Error('Too many attempts. Please wait 60 seconds.');
            }

            const data = await res.json();
            if (!data.success) throw new Error(data.detail || 'Failed to generate code');

            WA_AUTH.code = data.code;

            // Create both deep link (skips browser) and web link (fallback)
            const waPhone = '919088212294'; // Admin phone
            const waMessage = encodeURIComponent(`GETOTTS-LOGIN-${data.code}`);
            
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            
            // On mobile, the app protocol skips the browser page completely
            const deepLink = `whatsapp://send?phone=${waPhone}&text=${waMessage}`;
            // On desktop, wa.me is safer because they might use WA Web
            const webLink = `https://wa.me/${waPhone}?text=${waMessage}`;

            data.wa_link = webLink; // Update for UI fallback
            data.deep_link = deepLink;

            // Show waiting UI AFTER links are generated
            WA_AUTH.showWaitingUI(data);

            // Try to open seamlessly
            if (isMobile) {
                // Skips the browser intermediate page, directly opens the app
                window.location.href = deepLink;
            } else {
                // Desktop safe fallback
                window.open(webLink, '_blank');
            }

            // Start polling
            WA_AUTH.startPolling();

        } catch (err) {
            console.error('[WA-AUTH]', err);
            const msg = (err?.message || JSON.stringify(err)) || 'Failed to start WhatsApp login.';
            if (typeof Toast !== 'undefined') Toast.error('Login Failed', msg);
            else showAuthToast(msg, 'error');
            WA_AUTH.resetButton();
        }
    },

    /**
     * Reset the WhatsApp login button to its default state.
     */
    resetButton() {
        const waBtn = document.getElementById('waLoginBtn');
        if (waBtn) {
            waBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="currentColor" style="width:20px;height:20px"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Login with WhatsApp
            `;
            waBtn.disabled = false;
        }
    },

    /**
     * Show the "waiting for verification" UI
     */
    showWaitingUI(data) {
        const card = document.querySelector('.auth-card') || document.getElementById('waAuthRequired') || document.getElementById('authRequired');
        if (!card) return;

        const content = `
            <div class="wa-waiting">
                <div class="wa-waiting-icon">
                    <svg viewBox="0 0 24 24" fill="#25D366" style="width:48px;height:48px"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                </div>
                <h2>Waiting for Verification</h2>
                <p class="wa-waiting-sub">Send this code on WhatsApp to verify your identity</p>
                
                <div class="wa-code-display">
                    <span class="wa-code-prefix">GETOTTS-LOGIN-</span>
                    <span class="wa-code-value">${data.code}</span>
                </div>

                <div class="wa-progress">
                    <div class="wa-progress-bar" id="waProgressBar"></div>
                </div>
                <p class="wa-timer" id="waTimer">Expires in <strong>10:00</strong></p>

                <div class="wa-steps">
                    <div class="wa-step done" id="waStep1">
                        <div class="wa-step-num">1</div>
                        <span>WhatsApp opened</span>
                    </div>
                    <div class="wa-step active" id="waStep2">
                        <div class="wa-step-num">2</div>
                        <span>Send the code</span>
                    </div>
                    <div class="wa-step" id="waStep3">
                        <div class="wa-step-num">3</div>
                        <span>Admin verifies</span>
                    </div>
                </div>

                <div class="wa-actions-row">
                    <a href="${data.deep_link || data.wa_link}" class="btn btn-wa-resend">
                        Resend on WhatsApp
                    </a>
                    <button class="btn btn-outline wa-cancel-btn" onclick="WA_AUTH.cancel()">Cancel</button>
                </div>
            </div>
        `;

        if (card.id === 'waAuthRequired') {
            card.innerHTML = content;
        } else {
            card.innerHTML = content;
        }

        // Start countdown timer
        WA_AUTH.startCountdown(data.expires_in || 600);
    },

    /**
     * Poll backend rapidly (800ms) to check verification status.
     * With auto-verify via WA monitor, verification happens almost instantly.
     */
    startPolling() {
        let API = (window.GETOTTS_CONFIG && window.GETOTTS_CONFIG.API_BASE) || '';
        WA_AUTH.pollCount = 0;
        let consecutiveErrors = 0;

        // Polling — 3s intervals (reduced from 800ms to cut egress)
        const POLL_INTERVAL = 3000;

        WA_AUTH.pollTimer = setInterval(async () => {
            WA_AUTH.pollCount++;

            // Max poll limit reached
            if (WA_AUTH.pollCount > WA_AUTH.maxPolls) {
                WA_AUTH.cancel();
                if (typeof Toast !== 'undefined') Toast.error('Session Expired', 'Login session timed out. Please try again.');
                else showAuthToast('Login session expired. Please try again.', 'error');
                return;
            }

            // Advance step indicator (after ~6 seconds)
            if (WA_AUTH.pollCount === 2) {
                const s2 = document.getElementById('waStep2');
                if (s2) { s2.classList.remove('active'); s2.classList.add('done'); }
                const s3 = document.getElementById('waStep3');
                if (s3) s3.classList.add('active');
            }

            try {
                const res = await fetch(`${API}/wa-auth/check/${WA_AUTH.code}`, {
                    signal: AbortSignal.timeout(3000),
                });
                
                if (res.status === 410) {
                    WA_AUTH.cancel();
                    if (typeof Toast !== 'undefined') Toast.error('Expired', 'Code expired. Please request a new one.');
                    else showAuthToast('Code expired. Please try again.', 'error');
                    return;
                }
                if (res.status === 404) {
                    WA_AUTH.cancel();
                    if (typeof Toast !== 'undefined') Toast.error('Not Found', 'Auth code was not found. Please try again.');
                    else showAuthToast('Code not found. Please try again.', 'error');
                    return;
                }
                if (!res.ok) {
                    consecutiveErrors++;
                    if (consecutiveErrors > 15) {
                        WA_AUTH.cancel();
                        if (typeof Toast !== 'undefined') Toast.error('Connection Lost', 'Lost contact with auth server.');
                        else showAuthToast('Connection lost. Please try again.', 'error');
                    }
                    return;
                }

                consecutiveErrors = 0;
                const data = await res.json();

                if (data.status === 'verified') {
                    // Guard against null customer data (server restart edge case)
                    if (!data.customer) {
                        data.customer = { name: 'Customer', phone: '', email: '' };
                    }
                    WA_AUTH.onVerified(data);
                }
            } catch (err) {
                consecutiveErrors++;
                if (consecutiveErrors > 20) {
                    WA_AUTH.cancel();
                    if (typeof Toast !== 'undefined') Toast.error('Network Error', 'Check your internet connection.');
                    else showAuthToast('Network error. Please check your connection.', 'error');
                }
            }
        }, POLL_INTERVAL);
    },

    /**
     * Called when admin verifies the code — complete login
     */
    onVerified(data) {
        clearInterval(WA_AUTH.pollTimer);
        clearInterval(WA_AUTH._countdownTimer);

        // Mark all steps as done
        ['waStep1', 'waStep2', 'waStep3'].forEach(id => {
            const el = document.getElementById(id);
            if (el) { el.classList.remove('active'); el.classList.add('done'); }
        });

        // Store session securely
        const customer = data.customer || {};
        const token = data.token || 'wa_' + Date.now();

        // Check if email needs verification (placeholder or missing)
        const rawEmail = (customer.email || '').trim();
        const hasRealEmail = rawEmail &&
            !rawEmail.toLowerCase().startsWith('wa_') &&
            !rawEmail.toLowerCase().startsWith('customer_') &&
            !/^wa\d+@getotts\.com$/i.test(rawEmail);
        const needsEmail = !hasRealEmail;

        localStorage.setItem('GetOTTs_customer_token', token);
        localStorage.setItem('GetOTTs_customer', JSON.stringify({
            name: customer.name || 'Customer',
            phone: customer.phone || '',
            email: hasRealEmail ? rawEmail : '',
            email_verified: !needsEmail,
            id: customer.id || '',
            login_method: 'whatsapp',
            logged_in_at: new Date().toISOString(),
        }));

        // Show success animation
        const card = document.querySelector('.auth-card');
        if (card) {
            card.innerHTML = `
                <div class="wa-success">
                    <div class="wa-success-check">✅</div>
                    <h2>Verified!</h2>
                    <p>Welcome to GetOTTs, <strong>${customer.name || 'Customer'}</strong>!</p>
                    <p class="wa-redirect-msg">${needsEmail ? 'One more step — verify your email...' : 'Redirecting to your dashboard...'}</p>
                </div>
            `;
        }

        // If email needs verification, show the modal
        if (needsEmail && typeof EMAIL_VERIFY !== 'undefined' && !window.location.pathname.includes('checkout') && !window.location.pathname.includes('order')) {
            setTimeout(() => {
                EMAIL_VERIFY.show();
            }, 800);
        } else {
            // Redirect or Refresh
            setTimeout(() => {
                const params = new URLSearchParams(window.location.search);
                const redirect = params.get('redirect');
                
                if (redirect) {
                    window.location.href = redirect;
                } else if (window.location.pathname.includes('checkout') || window.location.pathname.includes('order')) {
                    window.location.reload(); // Refresh to pick up new session and unlock credentials
                } else {
                    window.location.href = '/dashboard';
                }
            }, 1000);
        }
    },

    /**
     * Countdown timer display
     */
    startCountdown(totalSeconds) {
        let remaining = totalSeconds;
        const bar = document.getElementById('waProgressBar');
        const timer = document.getElementById('waTimer');

        const tick = () => {
            remaining--;
            if (remaining <= 0) {
                WA_AUTH.cancel();
                if (typeof Toast !== 'undefined') Toast.error('Timer Expired', 'Voucher request timed out.');
                else showAuthToast('Code expired. Please request a new one.', 'error');
                return;
            }
            const mins = Math.floor(remaining / 60);
            const secs = remaining % 60;
            if (timer) {
                timer.innerHTML = `Expires in <strong>${mins}:${String(secs).padStart(2, '0')}</strong>`;
            }
            if (bar) {
                bar.style.width = `${(remaining / totalSeconds) * 100}%`;
            }
        };

        WA_AUTH._countdownTimer = setInterval(tick, 1000);
    },

    /**
     * Cancel login and go back to the login form
     */
    cancel() {
        clearInterval(WA_AUTH.pollTimer);
        clearInterval(WA_AUTH._countdownTimer);
        WA_AUTH.code = null;
        WA_AUTH.pollCount = 0;
        window.location.reload();
    },

    /**
     * Check if user is already logged in via WhatsApp
     */
    isLoggedIn() {
        const token = localStorage.getItem('GetOTTs_customer_token');
        const customer = localStorage.getItem('GetOTTs_customer');
        if (!token || !customer) return false;

        try {
            const parsed = JSON.parse(customer);
            return parsed.login_method === 'whatsapp';
        } catch {
            return false;
        }
    },

    /**
     * Logout — clear WhatsApp session
     */
    async logout() {
        const token = localStorage.getItem('GetOTTs_customer_token');
        const API = (window.GETOTTS_CONFIG && window.GETOTTS_CONFIG.API_BASE) || '';

        // Notify backend if possible
        if (token && API) {
            try {
                await fetch(`${API}/wa-auth/logout`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token }),
                });
            } catch { /* Silent */ }
        }

        localStorage.removeItem('GetOTTs_customer_token');
        localStorage.removeItem('GetOTTs_customer');
        window.location.href = '/login';
    },
};
