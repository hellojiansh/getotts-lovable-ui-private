/* ============================================
   GetOTTs - Checkout Page Logic v3
   SKU-based product loading, cart checkout,
   coupon validation, PayGate payment
   ============================================ */

const API_BASE = (window.GETOTTS_CONFIG && window.GETOTTS_CONFIG.API_BASE) || 'http://localhost:8000/api/v1';
const PAYGATE_BASE = (window.GETOTTS_CONFIG && window.GETOTTS_CONFIG.PAYGATE_FALLBACK) || 'http://localhost:3000';

let isInit = false;
const params = new URLSearchParams(window.location.search);
const skuParam = params.get('sku') || params.get('buy_now') || (JSON.parse(sessionStorage.getItem('checkoutState') || '{}')).sku;
const cartParam = params.get('cart');
const comboParam = params.get('combo');
const legacyProduct = params.get('product');
const legacyPlan = params.get('plan');

let checkoutItems = [];
let currentPrice = 0;
let originalPrice = 0;
let couponDiscount = 0;
let couponCode = '';
let orderNumber = '';
let paymentSessionId = '';
let walletBalance = 0;
let walletDeduction = 0;
let useWallet = false;
let checkoutInitiateTracked = false;
let checkoutPurchaseTracked = false;

function getWhatsAppDigits(value) {
    var digits = String(value || '').replace(/\D/g, '');
    return digits.slice(0, 12);
}

function getCheckoutLocalPhoneDigits(value) {
    var digits = getWhatsAppDigits(value);
    if (digits.length === 12 && digits.startsWith('91')) {
        return digits.slice(2);
    }
    return digits.slice(0, 10);
}

function getFullWhatsAppNumber(value) {
    var digits = getWhatsAppDigits(value);
    if (digits.length === 10) return '+91' + digits;
    if (digits.length === 12 && digits.startsWith('91')) return '+' + digits;
    return '';
}

function isValidCheckoutWhatsAppNumber(value) {
    var digits = getWhatsAppDigits(value);
    return digits.length === 10 || (digits.length === 12 && digits.startsWith('91'));
}

function setCheckoutPhoneValue(value) {
    var phoneInput = document.getElementById('ckPhone');
    if (phoneInput) phoneInput.value = getCheckoutLocalPhoneDigits(value);
}

function isPlaceholderCheckoutEmail(value) {
    var email = String(value || '').trim().toLowerCase();
    return !email ||
        email.startsWith('wa_') ||
        email.startsWith('customer_') ||
        /^wa\d+@getotts\.com$/i.test(email);
}

function getRealCheckoutEmail(value) {
    var email = String(value || '').trim();
    return isPlaceholderCheckoutEmail(email) ? '' : email;
}

function cleanStoredCheckoutCustomerEmail(customer) {
    if (!customer || !isPlaceholderCheckoutEmail(customer.email)) return customer;
    customer.email = '';
    customer.email_verified = false;
    try {
        localStorage.setItem('GetOTTs_customer', JSON.stringify(customer));
    } catch {}
    return customer;
}

function initCheckoutPhoneInput() {
    var phoneInput = document.getElementById('ckPhone');
    if (!phoneInput) return;
    phoneInput.addEventListener('input', function() {
        setCheckoutPhoneValue(this.value);
    });
    if (phoneInput.value) setCheckoutPhoneValue(phoneInput.value);
}

function initCheckoutEmailInput() {
    var emailInput = document.getElementById('ckEmail');
    if (!emailInput) return;
    var clean = function() {
        var realEmail = getRealCheckoutEmail(emailInput.value);
        if (emailInput.value !== realEmail) emailInput.value = realEmail;
    };
    emailInput.addEventListener('input', clean);
    emailInput.addEventListener('change', clean);
    emailInput.addEventListener('blur', clean);
    clean();
}

function checkoutCurrency() {
    return typeof getCurrentCurrency === 'function' ? getCurrentCurrency() : 'INR';
}

function checkoutMoney(amount) {
    return getCurrencySymbol() + (Number(amount) || 0).toLocaleString(checkoutCurrency() === 'USD' ? 'en-US' : 'en-IN', {
        minimumFractionDigits: checkoutCurrency() === 'USD' ? 2 : 0,
        maximumFractionDigits: 2
    });
}

function getCheckoutTrackingPayload() {
    var value = Math.max(0, currentPrice - couponDiscount - walletDeduction);
    var ids = checkoutItems.map(function(item) {
        return item.variant && item.variant.sku ? item.variant.sku : (item.product.slug || item.product.id || item.product.name);
    }).filter(Boolean);
    return {
        content_name: checkoutItems.length === 1 ? checkoutItems[0].product.name : 'Checkout Bundle',
        content_ids: ids,
        contents: checkoutItems.map(function(item) {
            return {
                id: item.variant && item.variant.sku ? item.variant.sku : (item.product.slug || item.product.id || item.product.name),
                quantity: item.qty || 1
            };
        }),
        content_type: 'product',
        currency: checkoutCurrency(),
        value: Number.isFinite(value) ? value : 0,
        num_items: checkoutItems.reduce(function(sum, item) { return sum + (parseInt(item.qty, 10) || 1); }, 0)
    };
}

function trackCheckoutStage(eventName, extra) {
    if (typeof window.getottsTrack !== 'function' || checkoutItems.length === 0) return;
    window.getottsTrack(eventName, Object.assign(getCheckoutTrackingPayload(), extra || {}));
}

function payGateAmountForCrypto(amount) {
    var numeric = Number(amount) || 0;
    return Math.ceil((numeric * 100) - 1e-9) / 100;
}

function decimalToTokenUnits(value, decimals) {
    var parts = String(value || '0').split('.');
    var whole = (parts[0] || '0').replace(/\D/g, '') || '0';
    var fraction = (parts[1] || '').replace(/\D/g, '').padEnd(decimals, '0').slice(0, decimals);
    return (BigInt(whole) * (10n ** BigInt(decimals)) + BigInt(fraction || '0')).toString();
}

function formatUsdtDisplay(value) {
    var numeric = Number(value) || 0;
    return numeric.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}

async function ensureCheckoutGeoReady() {
    if (typeof window.getottsGeoReady === 'function') {
        try {
            await window.getottsGeoReady();
            return;
        } catch (e) {
            console.warn('[Checkout] Shared geo detection failed, using current region');
        }
    }
    if (typeof detectGeoAndCurrency === 'function') {
        try {
            await detectGeoAndCurrency();
        } catch (e) {
            console.warn('[Checkout] Geo detection failed, using current region');
        }
    }
}

function checkoutPaymentMethod() {
    return (typeof getCurrentRegion === 'function' && getCurrentRegion() === 'GLOBAL') ? 'crypto' : 'upi';
}

function selectPayMethod() {
    applyGeoPaymentMethod();
}

function applyGeoPaymentMethod() {
    var method = checkoutPaymentMethod();
    if (getCheckoutFinalAmount() <= 0 && walletDeduction > 0) {
        syncZeroPayUI(true);
        return;
    }

    var cards = document.querySelectorAll('.pm-card');
    cards.forEach(function(card) {
        var input = card.querySelector('input[name="paymethod"]');
        var value = input ? input.value : '';
        var enabled = value === method;
        card.style.display = enabled ? '' : 'none';
        card.classList.toggle('active', enabled);
        if (input) input.checked = enabled;
    });

    var label = document.getElementById('paymentMethodLabel');
    if (label) label.textContent = method === 'crypto' ? 'Payment Method (Crypto Only)' : 'Payment Method (UPI Only)';

    var hint = document.getElementById('paymentRailHint');
    if (hint) hint.textContent = method === 'crypto'
        ? 'Global checkout opens a unique hosted crypto payment URL.'
        : 'India checkout opens a unique hosted UPI payment URL.';

    var railIcon = document.querySelector('#ckRailPreview .ck-rail-icon');
    var railTitle = document.getElementById('ckRailTitle');
    var railSubtitle = document.getElementById('ckRailSubtitle');
    if (railIcon) railIcon.innerHTML = method === 'crypto'
        ? '<i data-lucide="badge-dollar-sign"></i>'
        : '<i data-lucide="smartphone"></i>';
    if (railTitle) railTitle.textContent = method === 'crypto' ? 'Crypto for global orders' : 'UPI for India orders';
    if (railSubtitle) railSubtitle.textContent = method === 'crypto'
        ? 'Pay with BNB below $5 or USDT for $5+ on the hosted GetOTTs PayGate page.'
        : 'Pay with QR or UPI app on the hosted GetOTTs PayGate page.';
    if (window.lucide) window.lucide.createIcons();

    ['ckOrigPrice', 'ckTotal', 'mobileTotal', 'payBtnAmount', 'availableWallet'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el && (el.textContent || '').trim() === '...') el.textContent = checkoutMoney(0);
    });
    ['ckDiscount', 'ckCouponDiscount', 'ckWalletDiscount'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el && (el.textContent || '').trim() === '...') el.textContent = '-' + checkoutMoney(0);
    });
}

function getCheckoutFinalAmount() {
    var baseAmount = Math.max(0, currentPrice - couponDiscount);
    var deduction = useWallet ? Math.min(baseAmount, walletBalance) : 0;
    return Math.max(0, baseAmount - deduction);
}

function syncZeroPayUI(isWalletCovered) {
    var paymentGroup = document.getElementById('paymentMethodGroup');
    var rail = document.getElementById('ckRailPreview');
    var hint = document.getElementById('paymentRailHint');
    var disclaimer = document.getElementById('ckPaymentDisclaimer');

    if (paymentGroup) paymentGroup.style.display = isWalletCovered ? 'none' : '';
    if (rail) rail.style.display = isWalletCovered ? 'none' : '';
    if (hint) {
        hint.textContent = isWalletCovered
            ? 'Wallet balance covers this order. No UPI or crypto payment is needed.'
            : (checkoutPaymentMethod() === 'crypto'
                ? 'Global checkout opens a unique hosted crypto payment URL.'
                : 'India checkout opens a unique hosted UPI payment URL.');
    }
    if (disclaimer) {
        disclaimer.textContent = isWalletCovered
            ? 'Your wallet covers this order. We will confirm it immediately after you place it.'
            : 'After placing the order, payment opens on a unique secure URL.';
    }
}

function getCheckoutCustomerSession() {
    let token = localStorage.getItem('GetOTTs_customer_token') || '';
    let customer = {};

    try {
        customer = JSON.parse(localStorage.getItem('GetOTTs_customer') || '{}');
    } catch {}

    if (!token) {
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (!key || !key.includes('-auth-token')) continue;
                const raw = localStorage.getItem(key);
                if (!raw) continue;
                const parsed = JSON.parse(raw);
                token = parsed.access_token || parsed.currentSession?.access_token || '';
                const sessionUser = parsed.user || parsed.currentSession?.user;
                if (token && sessionUser && !customer.id) {
                    customer = {
                        id: sessionUser.id,
                        email: sessionUser.email || '',
                        name: sessionUser.user_metadata?.name || sessionUser.email?.split('@')[0] || 'Customer'
                    };
                }
                if (token) break;
            }
        } catch {}
    }

    return {
        isLoggedIn: !!(token || customer.id || customer.phone || customer.email),
        token,
        customer
    };
}

document.addEventListener('DOMContentLoaded', function() {
    if (window.lucide) lucide.createIcons();
    initCheckout();
});

// Setup fallback if DOMContentLoaded already fired
if (document.readyState === 'interactive' || document.readyState === 'complete') {
    initCheckout();
}

async function initCheckout() {
    if (isInit) return;
    isInit = true;

    initCheckoutPhoneInput();
    initCheckoutEmailInput();
    applyGeoPaymentMethod();
    initCheckoutPolicyGate();

    var catalogRefreshPromise = null;
    if (typeof syncCatalogFromCloud === 'function') {
        catalogRefreshPromise = syncCatalogFromCloud({ force: true }).catch(function(e) {
            console.warn('[Checkout] Catalog refresh failed, using current catalog');
            return null;
        });
    }

    loadCheckout();
    applyGeoPaymentMethod();

    retryCheckoutAfterCatalogRefresh(catalogRefreshPromise, true);

    ensureCheckoutGeoReady().then(function() {
        applyGeoPaymentMethod();
        if (checkoutItems.length > 0) {
            renderCheckoutSummary();
        } else {
            retryCheckoutAfterCatalogRefresh(catalogRefreshPromise, true);
        }
    }).catch(function() {
        applyGeoPaymentMethod();
    });

    initCoupon();
    
    // Enforce Login (Email or WhatsApp)
    const session = getCheckoutCustomerSession();
    const user = cleanStoredCheckoutCustomerEmail(session.customer || {});
    const isLoggedIn = session.isLoggedIn;
    
    const authUI = document.getElementById('authRequired');
    const ckForm = document.getElementById('checkoutForm');
    
    if (!isLoggedIn) {
        if (authUI) authUI.style.display = 'block';
        if (ckForm) ckForm.style.display = 'none';
        // Stop here — user must verify first
        return;
    } else {
        if (authUI) authUI.style.display = 'none';
        if (ckForm) ckForm.style.display = 'block';
    }

    // Autofill user details if logged in
    try {
        var realEmail = getRealCheckoutEmail(user.email);
        if (document.getElementById('ckEmail')) {
            document.getElementById('ckEmail').value = realEmail;
        }
        if (user.phone && document.getElementById('ckPhone')) {
            if (getWhatsAppDigits(user.phone).length >= 10) {
                setCheckoutPhoneValue(user.phone);
            } else {
                user.phone = '';
                localStorage.setItem('GetOTTs_customer', JSON.stringify(user));
            }
        }
    } catch(e) {}

    // Fetch Wallet Balance
    try {
        const sessionToken = session.token || (JSON.parse(localStorage.getItem('sb-YOUR_SUPABASE_PROJECT_REF-auth-token') || '{}')).access_token || localStorage.getItem('GetOTTs_customer_token');
        if (sessionToken) {
            const wRes = await fetch(API_BASE + '/vouchers/wallet', {
                headers: { 'Authorization': 'Bearer ' + sessionToken }
            });
            if (wRes.ok) {
                const wData = await wRes.json();
                const activeCurrency = checkoutCurrency();
                walletBalance = parseFloat(activeCurrency === 'USD' ? (wData.wallet_balance_usd || 0) : (wData.wallet_balance || 0));
                if (walletBalance > 0) {
                    const wc = document.getElementById('walletContainer');
                    const aw = document.getElementById('availableWallet');
                    if (wc) wc.style.display = 'block';
                    if (aw) aw.textContent = checkoutMoney(walletBalance);

                    const uw = document.getElementById('useWalletBtn');
                    if (uw) {
                        uw.addEventListener('change', function() {
                            useWallet = this.checked;
                            updateTotal();
                        });
                    }
                }
            }
        }
    } catch(e) {}

    // Check for active payment session
    try {
        var activeSessStr = sessionStorage.getItem('activePaymentSession');
        if (activeSessStr) {
            var activeSess = JSON.parse(activeSessStr);
            // Check if it's expired
            var targetTime = activeSess.expiresAt ? new Date(activeSess.expiresAt).getTime() : activeSess.timestamp + (10 * 60 * 1000);
            if (Date.now() < targetTime) {
                // Restore session
                paymentSessionId = activeSess.paymentSessionId;
                orderNumber = activeSess.orderNumber;
                
                // Hide forms, show processing
                var stepInfo = document.getElementById('stepInfo');
                var stepPay = document.getElementById('stepPay');
                var processing = document.getElementById('ckProcessing');
                if (stepInfo) stepInfo.style.display = 'none';
                if (stepPay) stepPay.style.display = 'none';
                if (processing) processing.style.display = 'block';

                if (activeSess.hosted && activeSess.checkoutUrl) {
                    var hostedStatus = await getHostedPaymentStatus(activeSess);
                    if (isClosedHostedPaymentStatus(hostedStatus)) {
                        sessionStorage.removeItem('activePaymentSession');
                        showHostedPaymentClosed(hostedStatus, activeSess.orderNumber);
                        return;
                    }

                    if (activeSess.hostedRedirected) {
                        showHostedPaymentResume(activeSess);
                        return;
                    }

                    redirectToHostedPayment(
                        activeSess.checkoutUrl,
                        activeSess.crypto ? 'crypto payment' : 'UPI payment',
                        activeSess.orderNumber
                    );
                    return;
                }

                if (activeSess.crypto) {
                    showCryptoPanel({
                        deposit_address: activeSess.depositAddress,
                        expected_amount_bnb: activeSess.expectedAmountBnb,
                        expected_amount_usdt: activeSess.expectedAmountUsdt,
                        network: activeSess.network,
                        asset: activeSess.asset,
                        token_contract: activeSess.tokenContract,
                        expires_at: activeSess.expiresAt
                    }, activeSess.payableAmt, activeSess.pgUrl);
                } else {
                    showUpiPanel(activeSess.payableAmt, activeSess.deeplink, activeSess.upiId, activeSess.upiName, activeSess.pgUrl, activeSess.expiresAt || targetTime);
                }
                return; // Stop normal init
            } else {
                sessionStorage.removeItem('activePaymentSession');
            }
        }
    } catch(e) {}

    initPayment();
    // Timer is started only after QR/payment session is generated (see showUpiPanel)
}

function isClosedHostedPaymentStatus(status) {
    return ['cancelled', 'canceled', 'expired', 'failed', 'rejected'].indexOf(String(status || '').toLowerCase()) !== -1;
}

async function getHostedPaymentStatus(activeSess) {
    if (!activeSess || !activeSess.pgUrl || !activeSess.paymentSessionId) return null;
    try {
        var res = await fetch(activeSess.pgUrl.replace(/\/+$/, '') + '/api/session/' + encodeURIComponent(activeSess.paymentSessionId), { cache: 'no-store' });
        if (!res.ok) return null;
        var data = await res.json();
        return data.status || null;
    } catch (e) {
        console.warn('[Checkout] Could not verify hosted payment status before restore:', e);
        return null;
    }
}

function showHostedPaymentClosed(status, orderNum) {
    var stepInfo = document.getElementById('stepInfo');
    var stepPay = document.getElementById('stepPay');
    var processing = document.getElementById('ckProcessing');
    var payBtn = document.getElementById('payNowBtn');
    var closed = String(status || '').toLowerCase();
    var cancelled = closed.indexOf('cancel') !== -1;
    if (stepInfo) stepInfo.style.display = 'none';
    if (stepPay) stepPay.style.display = 'none';
    if (payBtn) payBtn.disabled = false;
    if (!processing) return;
    processing.style.display = 'block';
    processing.innerHTML =
        '<div class="ck-redirect-card">' +
            '<div style="width:64px;height:64px;margin:0 auto 16px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#fee2e2;color:#dc2626;font-size:32px;font-weight:900;">!</div>' +
            '<h3>' + (cancelled ? 'Payment Cancelled' : 'Payment Window Closed') + '</h3>' +
            '<p>Order ' + (orderNum || '') + ' is no longer payable from that old checkout link.</p>' +
            '<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:18px;">' +
                '<a href="/" class="btn btn-primary">Back to Store</a>' +
                '<button type="button" class="btn btn-outline" onclick="window.location.reload()">Create New Payment</button>' +
            '</div>' +
        '</div>';
}

function showHostedPaymentResume(activeSess) {
    var processing = document.getElementById('ckProcessing');
    var payBtn = document.getElementById('payNowBtn');
    if (payBtn) {
        payBtn.disabled = false;
        payBtn.innerHTML = '<i data-lucide="shield-check"></i> Continue Payment';
    }
    if (!processing) return;
    processing.innerHTML =
        '<div class="ck-redirect-card">' +
            '<h3>Payment Still Waiting</h3>' +
            '<p>Your hosted payment page is still active. Continue when you are ready, or go back to the store.</p>' +
            '<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:18px;">' +
                '<a href="' + activeSess.checkoutUrl + '" class="btn btn-primary" onclick="markHostedRedirectedAgain()">Continue Payment</a>' +
                '<a href="/" class="btn btn-outline">Back to Store</a>' +
            '</div>' +
        '</div>';
    if (window.lucide) window.lucide.createIcons();
}

function markHostedRedirectedAgain() {
    try {
        var raw = sessionStorage.getItem('activePaymentSession');
        if (!raw) return;
        var sess = JSON.parse(raw);
        sess.hostedRedirected = true;
        sess.hostedRedirectedAt = Date.now();
        sessionStorage.setItem('activePaymentSession', JSON.stringify(sess));
    } catch (e) {}
}

function retryCheckoutAfterCatalogRefresh(catalogRefreshPromise, refreshEvenWhenLoaded) {
    var retryAfterCatalog = function() {
        if (checkoutItems.length === 0 || refreshEvenWhenLoaded) retryLoadCheckout(refreshEvenWhenLoaded);
    };

    if (catalogRefreshPromise && typeof catalogRefreshPromise.then === 'function') {
        Promise.race([
            catalogRefreshPromise,
            new Promise(function(resolve) { setTimeout(resolve, 1200); })
        ]).then(retryAfterCatalog).catch(retryAfterCatalog);
        if (refreshEvenWhenLoaded) {
            catalogRefreshPromise.then(retryAfterCatalog).catch(function() {});
        }
    } else {
        setTimeout(retryAfterCatalog, 500);
    }
}

function retryLoadCheckout(refreshEvenWhenLoaded) {
    if (checkoutItems.length > 0 && !refreshEvenWhenLoaded) return; // Already loaded

    // Re-read checkout state fresh (params at parse time might have been stale)
    try {
        var freshState = JSON.parse(sessionStorage.getItem('checkoutState') || '{}');
        var freshCart = localStorage.getItem('getotts_cart');
        
        // Try sessionStorage first
        var sku = freshState.sku;
        var cart = freshState.cart;
        var combo = freshState.combo;
        var product = freshState.product;
        var plan = freshState.plan;

        // Also check URL params
        var urlParams = new URLSearchParams(window.location.search);
        sku = urlParams.get('sku') || urlParams.get('buy_now') || sku;
        cart = urlParams.get('cart') || cart;
        combo = urlParams.get('combo') || combo;

        // If still nothing, try to reconstruct from localStorage cart
        if (!sku && !cart && !combo && !product && freshCart) {
            try {
                var cartItems = JSON.parse(freshCart);
                if (cartItems.length > 0) {
                    cart = cartItems.map(function(i) { return i.sku + ':' + i.qty; }).join(',');
                }
            } catch(e) {}
        }

        if (sku) {
            if (refreshEvenWhenLoaded) checkoutItems = [];
            loadSingleSku(sku);
        } else if (cart) {
            if (refreshEvenWhenLoaded) checkoutItems = [];
            loadCartItems(cart);
        } else if (combo) {
            if (refreshEvenWhenLoaded) checkoutItems = [];
            loadCombo(combo);
        } else if (product) {
            if (refreshEvenWhenLoaded) checkoutItems = [];
            loadLegacyProduct(product, plan || 'shared');
        }

        if (checkoutItems.length > 0) {
            renderCheckoutSummary();
        }
    } catch(e) {
        console.warn('[Checkout] Retry failed:', e);
    }
}

function loadCheckout() {
    if (skuParam) {
        loadSingleSku(skuParam);
    } else if (cartParam) {
        loadCartItems(cartParam);
    } else if (comboParam) {
        loadCombo(comboParam);
    } else if (legacyProduct) {
        loadLegacyProduct(legacyProduct, legacyPlan || 'shared');
    } else {
        // Last resort: try to read cart from localStorage directly
        try {
            var savedCart = JSON.parse(localStorage.getItem('getotts_cart') || '[]');
            if (savedCart.length > 0) {
                var cartStr = savedCart.map(function(i) { return i.sku + ':' + i.qty; }).join(',');
                loadCartItems(cartStr);
            }
        } catch(e) {}
        if (checkoutItems.length === 0) {
            setError('No product selected');
            return;
        }
    }
    renderCheckoutSummary();
}

function initCountdownTimer() {
    // No-op: reservation timer is now started only after QR/payment session generation.
    // See showUpiPanel() -> startCountdown() for the real session timer.
}

/* ================================================
   EMAIL AUTH FUNCTIONS
   ================================================ */
async function sendAuthOTP() {
    const email = document.getElementById('authEmailInput').value.trim();
    if (!email || !email.includes('@')) {
        showToast('Please enter a valid email');
        return;
    }

    const btn = document.getElementById('sendOtpBtn');
    btn.disabled = true;
    btn.textContent = 'Sending...';

    try {
        const res = await fetch(API_BASE + '/email-otp/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const data = await res.json();
        if (data.success) {
            showToast('OTP sent to ' + email);
            document.getElementById('otpInputSection').style.display = 'block';
            btn.textContent = 'Resend OTP';
            setTimeout(() => { btn.disabled = false; }, 30000);
        } else {
            showToast('Error: ' + (data.detail || 'Failed to send OTP'));
            btn.disabled = false;
            btn.textContent = 'Send Login OTP';
        }
    } catch (e) {
        showToast('Network error');
        btn.disabled = false;
        btn.textContent = 'Send Login OTP';
    }
}

async function verifyAuthOTP() {
    const email = document.getElementById('authEmailInput').value.trim();
    const otp = document.getElementById('authOtpInput').value.trim();
    if (!otp || otp.length < 4) {
        showToast('Enter a valid OTP');
        return;
    }

    const btn = document.getElementById('verifyOtpBtn');
    btn.disabled = true;
    btn.textContent = 'Verifying...';

    try {
        const res = await fetch(API_BASE + '/email-otp/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, otp })
        });
        const data = await res.json();
        if (data.success && data.token) {
            // Success! Save customer and token
            localStorage.setItem('GetOTTs_customer_token', data.token);
            localStorage.setItem('GetOTTs_customer', JSON.stringify(data.customer));
            showToast('Success! Identity verified.');
            
            // Reload checkout
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } else {
            showToast('Error: ' + (data.detail || 'Verification failed'));
            btn.disabled = false;
            btn.textContent = 'Verify & Continue';
        }
    } catch (e) {
        showToast('Network error');
        btn.disabled = false;
        btn.textContent = 'Verify & Continue';
    }
}

function startWhatsAppAuth() {
    if (window.WA_AUTH) {
        WA_AUTH.start();
    } else {
        showToast('WhatsApp auth service is loading, please wait...');
    }
}




function normalizeCheckoutToken(value) {
    return String(value || '').trim();
}

function getCheckoutProductKey(product) {
    return [
        product && product.id,
        product && product.slug,
        product && product.name
    ].filter(Boolean).map(function(v) {
        return String(v).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    });
}

function getCheckoutSkuAliases(sku) {
    var raw = normalizeCheckoutToken(sku);
    var lower = raw.toLowerCase();
    var aliases = [raw];
    var known = {
        'yt-personal-1m': 'youtube-premium-personal-1m',
        'yt-shared-1m': 'youtube-premium-personal-1m',
        'youtube-premium': 'youtube-premium-personal-1m',
        'youtube': 'youtube-premium-personal-1m',
        'prime': 'prime-shared-1m',
        'amazon-prime': 'prime-shared-1m',
        'amazon-prime-video': 'prime-shared-1m'
    };
    if (known[lower]) aliases.push(known[lower]);
    if (lower.indexOf('youtube') !== -1 && lower.indexOf('premium') !== -1 && lower.indexOf('personal') === -1) {
        aliases.push('youtube-premium-personal-1m');
    }
    return aliases.filter(function(v, idx, arr) { return v && arr.indexOf(v) === idx; });
}

function resolveCheckoutVariant(token) {
    var value = normalizeCheckoutToken(token);
    if (!value) return null;

    var aliases = getCheckoutSkuAliases(value);
    for (var i = 0; i < aliases.length; i++) {
        var exact = getVariant(aliases[i]);
        if (exact) return exact;
    }

    var normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    var products = getAllProducts();
    for (var p = 0; p < products.length; p++) {
        var product = products[p];
        var keys = getCheckoutProductKey(product);
        if (keys.indexOf(normalized) !== -1) {
            return { product: product, variant: getDefaultVariant(product) };
        }
        if (product.variants) {
            var fuzzy = product.variants.find(function(v) {
                return String(v.sku || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') === normalized;
            });
            if (fuzzy) return { product: product, variant: fuzzy };
        }
    }
    return null;
}

function loadSingleSku(sku) {
    if (sku === 'wallet-topup') {
        setError('Wallet credit is added by admin or voucher only');
        return;
    }

    var result = resolveCheckoutVariant(sku);
    if (!result) { setError('Product not found'); return; }
    checkoutItems = [{ product: result.product, variant: result.variant, qty: 1 }];
}

function loadCartItems(cartStr) {
    var entries = cartStr.split(',');
    checkoutItems = [];
    for (var i = 0; i < entries.length; i++) {
        var parts = entries[i].split(':');
        var sku = parts[0];
        var qty = parseInt(parts[1]) || 1;
        var result = resolveCheckoutVariant(sku);
        if (result) {
            checkoutItems.push({ product: result.product, variant: result.variant, qty: qty });
        }
    }
    if (checkoutItems.length === 0) setError('No valid items in cart');
}

function loadCombo(comboStr) {
    var ids = comboStr.split(',');
    checkoutItems = [];
    for (var i = 0; i < ids.length; i++) {
        var product = getAllProducts().find(function(p) { return p.id === ids[i]; });
        if (product) {
            var dv = getDefaultVariant(product);
            if (dv) checkoutItems.push({ product: product, variant: dv, qty: 1 });
        }
    }
    if (checkoutItems.length === 0) setError('No valid products in combo');
}

function loadLegacyProduct(productId, plan) {
    var normalized = normalizeCheckoutToken(productId).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    var product = getAllProducts().find(function(p) {
        return getCheckoutProductKey(p).indexOf(normalized) !== -1;
    });
    if (!product) { setError('Product not found'); return; }
    var matching = product.variants.filter(function(v) { return v.accessType === plan; });
    matching.sort(function(a, b) { return a.duration - b.duration; });
    var variant = matching[0] || getDefaultVariant(product);
    if (variant) {
        checkoutItems = [{ product: product, variant: variant, qty: 1 }];
    } else {
        setError('No variants available');
    }
}

function setError(msg) {
    var el = document.getElementById('ckProductName');
    if (el) {
        el.textContent = msg;
        el.style.color = 'var(--danger)';
    }
}

function renderCheckoutSummary() {
    if (checkoutItems.length === 0) return;

    var isCombo = comboParam && checkoutItems.length > 1;
    var isCart = cartParam && checkoutItems.length > 1;
    var isSingle = checkoutItems.length === 1;

    var subtotal = 0;
    var origTotal = 0;
    for (var i = 0; i < checkoutItems.length; i++) {
        var itemPrice = typeof getVariantPrice === 'function'
            ? getVariantPrice(checkoutItems[i].variant)
            : parseFloat(getFormattedPrice(checkoutItems[i].variant)) || 0;
        var itemOriginal = typeof getVariantOriginalPrice === 'function'
            ? getVariantOriginalPrice(checkoutItems[i].variant)
            : parseFloat(getFormattedOriginalPrice(checkoutItems[i].variant) || getFormattedPrice(checkoutItems[i].variant)) || 0;
        subtotal += itemPrice * checkoutItems[i].qty;
        origTotal += (itemOriginal || itemPrice) * checkoutItems[i].qty;
    }

    var comboDiscountAmt = 0;
    if (isCombo) {
        // Read combo discount tiers from admin settings
        var settings = {};
        try { settings = JSON.parse(localStorage.getItem('getotts_admin_settings') || '{}'); } catch(e) {}
        var d2  = Number(settings.combo_discount_2)  || 10;
        var d5  = Number(settings.combo_discount_5)  || 15;
        var d7  = Number(settings.combo_discount_7)  || 20;
        var d10 = Number(settings.combo_discount_10) || 25;
        var discPct = checkoutItems.length >= 10 ? d10 : checkoutItems.length >= 7 ? d7 : checkoutItems.length >= 5 ? d5 : d2;
        comboDiscountAmt = Math.round(subtotal * discPct / 100);
    }

    currentPrice = subtotal - comboDiscountAmt;
    originalPrice = origTotal;

    var iconEl = document.getElementById('ckProductIcon');
    var nameEl = document.getElementById('ckProductName');
    var typeEl = document.getElementById('ckProductType');

    if (isSingle) {
        var item = checkoutItems[0];
        if (iconEl) {
            var singleImg = window.getProductLogoSrc ? window.getProductLogoSrc(item.product) : (item.product.img || '');
            if (singleImg) {
                iconEl.innerHTML = '<img src="' + singleImg + '" alt="' + item.product.name + '" class="product-thumb-img" loading="eager" decoding="async" width="48" height="48">';
            } else {
                iconEl.textContent = item.product.emoji;
            }
        }
        if (nameEl) {
            nameEl.textContent = item.product.name;
            nameEl.style.color = '';
        }
        var typeText = item.variant.durationLabel;
        if (item.variant.quality) typeText += ' · ' + item.variant.quality;
        if (typeEl) typeEl.textContent = typeText;
    } else {
        var totalQty = checkoutItems.reduce(function(acc, val) { return acc + val.qty; }, 0);
        if (iconEl) iconEl.textContent = isCombo ? '🎁' : '🛒';
        if (nameEl) nameEl.textContent = isCombo ? 'Combo Bundle (' + checkoutItems.length + ' apps)' : 'Cart (' + totalQty + ' items)';
        if (typeEl) typeEl.textContent = checkoutItems.map(function(x) { return x.product.name + (x.qty > 1 ? ' x' + x.qty : ''); }).join(', ');
    }

    var comboSummary = document.getElementById('comboSummary');
    var comboList = document.getElementById('comboItemsList');
    if ((isCombo || isCart) && comboSummary && comboList) {
        comboSummary.style.display = 'block';
        comboList.innerHTML = checkoutItems.map(function(x) {
            var lp = (typeof getVariantPrice === 'function' ? getVariantPrice(x.variant) : (parseFloat(getFormattedPrice(x.variant)) || 0)) * x.qty;
            var comboImg = window.getProductLogoSrc ? window.getProductLogoSrc(x.product) : (x.product.img || '');
            var icon = comboImg ? '<img src="' + comboImg + '" class="combo-thumb-img" alt="' + x.product.name + '" loading="lazy" decoding="async" width="28" height="28">' : x.product.emoji;
            return '<div class="combo-item"><span>' + icon + ' ' + x.product.name + (x.qty > 1 ? ' ×' + x.qty : '') + '</span><span>' + checkoutMoney(lp) + '</span></div>';
        }).join('');
    }

    var origPriceEl = document.getElementById('ckOrigPrice');
    var discountEl = document.getElementById('ckDiscount');
    if (origPriceEl) origPriceEl.textContent = checkoutMoney(origTotal);
    if (discountEl) discountEl.textContent = '-' + checkoutMoney(origTotal - subtotal + comboDiscountAmt);

    updateTotal();
    if (!checkoutInitiateTracked) {
        checkoutInitiateTracked = true;
        trackCheckoutStage('InitiateCheckout');
    }
}

function updateTotal() {
    var baseAmount = Math.max(0, currentPrice - couponDiscount);
    walletDeduction = 0;

    if (useWallet) {
        walletDeduction = Math.min(baseAmount, walletBalance);
        var wLine = document.getElementById('walletDiscountLine');
        var wAmt = document.getElementById('ckWalletDiscount');
        if (wLine) wLine.style.display = walletDeduction > 0 ? 'flex' : 'none';
        if (wAmt) wAmt.textContent = '-' + checkoutMoney(walletDeduction);
    } else {
        var wLine = document.getElementById('walletDiscountLine');
        if (wLine) wLine.style.display = 'none';
    }

    var finalAmount = Math.max(0, baseAmount - walletDeduction);
    var isWalletCovered = finalAmount <= 0 && walletDeduction > 0;
    var payBtn = document.getElementById('payNowBtn');
    var totalEl = document.getElementById('ckTotal');
    var mobileTotal = document.getElementById('mobileTotal');

    if (totalEl) {
        totalEl.textContent = isWalletCovered ? 'Paid by Wallet' : checkoutMoney(finalAmount);
        totalEl.classList.toggle('ck-total-paid', isWalletCovered);
    }
    if (mobileTotal) mobileTotal.textContent = isWalletCovered ? 'Paid by Wallet' : checkoutMoney(finalAmount);
    syncZeroPayUI(isWalletCovered);
    
    if (payBtn) {
        if (isWalletCovered) {
            payBtn.innerHTML = '<i data-lucide="wallet"></i><span class="ck-pay-text"><span class="ck-pay-label">Confirm Wallet Order</span></span>';
        } else {
            payBtn.innerHTML = '<i data-lucide="shield-check"></i><span class="ck-pay-text"><span class="ck-pay-label">Place Order</span><span class="ck-pay-amount" id="payBtnAmount">' + checkoutMoney(finalAmount) + '</span></span>';
        }
        if (window.lucide) window.lucide.createIcons();
        syncCheckoutPolicyGate();
    }
}

function markWalletPaidSummary() {
    var totalEl = document.getElementById('ckTotal');
    var mobileTotal = document.getElementById('mobileTotal');

    if (totalEl) {
        totalEl.textContent = 'Paid by Wallet';
        totalEl.classList.add('ck-total-paid');
    }
    if (mobileTotal) mobileTotal.textContent = 'Paid by Wallet';
}

function syncCheckoutPolicyGate() {
    var policy = document.getElementById('ckPolicyAgree');
    var payBtn = document.getElementById('payNowBtn');
    var row = policy ? policy.closest('.ck-policy-row') : null;
    if (!payBtn) return;

    var isAllowed = !policy || policy.checked;
    payBtn.disabled = !isAllowed;
    payBtn.setAttribute('aria-disabled', isAllowed ? 'false' : 'true');
    payBtn.classList.toggle('is-policy-locked', !isAllowed);
    payBtn.title = isAllowed ? '' : 'Please agree to the Refund Policy to continue';
    if (row) row.classList.toggle('policy-required', !isAllowed);
}

function initCheckoutPolicyGate() {
    var policy = document.getElementById('ckPolicyAgree');
    var payBtn = document.getElementById('payNowBtn');
    if (!policy || !payBtn || payBtn.dataset.policyGateReady === '1') {
        syncCheckoutPolicyGate();
        return;
    }

    payBtn.dataset.policyGateReady = '1';
    policy.addEventListener('change', syncCheckoutPolicyGate);
    syncCheckoutPolicyGate();
}

function initCoupon() {
    var applyBtn = document.getElementById('applyCoupon');
    if (!applyBtn) return;

    applyBtn.addEventListener('click', async function() {
        var input = document.getElementById('ckCoupon');
        var result = document.getElementById('couponResult');
        if (!input || !result) return;

        var code = input.value.trim().toUpperCase();
        if (!code) return;

        // Show loading state
        applyBtn.disabled = true;
        applyBtn.textContent = '...';
        result.textContent = 'Validating...';
        result.className = 'ck-coupon-result';

        try {
            // Call GetOTTs backend API for coupon validation
            var response = await fetch(API_BASE + '/coupons/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: code, order_amount: currentPrice, currency: checkoutCurrency() })
            });

            var data = await response.json();

            if (data.valid) {
                couponDiscount = Number(data.discount_amount || 0);
                if (isNaN(couponDiscount)) couponDiscount = 0;

                if (couponDiscount <= 0) {
                    couponDiscount = 0;
                    couponCode = '';
                    result.textContent = '✗ This coupon is active but no discount is configured. Please try again.';
                    result.className = 'ck-coupon-result error';
                    var staleCouponLine = document.getElementById('couponLine');
                    if (staleCouponLine) staleCouponLine.style.display = 'none';
                    updateTotal();
                    applyBtn.disabled = false;
                    applyBtn.textContent = 'Apply';
                    return;
                }

                couponCode = data.code;
                result.textContent = '✓ Coupon applied! You save ' + checkoutMoney(couponDiscount);
                result.className = 'ck-coupon-result success';

                var couponLine = document.getElementById('couponLine');
                if (couponLine) {
                    couponLine.style.display = 'flex';
                    document.getElementById('ckCouponCode').textContent = couponCode;
                    document.getElementById('ckCouponDiscount').textContent = '-' + checkoutMoney(couponDiscount);
                }
                updateTotal();
            } else {
                result.textContent = '✗ ' + (data.error || 'Invalid coupon code');
                result.className = 'ck-coupon-result error';
            }
        } catch (err) {
            result.textContent = '✗ Network error, try again';
            result.className = 'ck-coupon-result error';
        }

        applyBtn.disabled = false;
        applyBtn.textContent = 'Apply';
    });
}

/* ================================================
   PAYMENT FLOW — PayGate UPI Integration
   ================================================ */

function getPayGateSettings() {
    var pgUrl = (window.GETOTTS_CONFIG && window.GETOTTS_CONFIG.PAYGATE_FALLBACK)
        ? window.GETOTTS_CONFIG.PAYGATE_FALLBACK
        : 'https://paygate.getotts.com';
    
    var pgKey = (window.GETOTTS_CONFIG && window.GETOTTS_CONFIG.PAYGATE_API_KEY)
        ? window.GETOTTS_CONFIG.PAYGATE_API_KEY
        : '';

    return { url: pgUrl, apiKey: pgKey };
}

function initPayment() {
    var payBtn = document.getElementById('payNowBtn');
    if (!payBtn) return;

    payBtn.addEventListener('click', async function() {
        var policy = document.getElementById('ckPolicyAgree');
        if (policy && !policy.checked) {
            showCheckoutError('Please agree to the Refund Policy before placing the order.');
            policy.focus();
            return;
        }

        var emailInput = document.getElementById('ckEmail');
        var email = getRealCheckoutEmail(emailInput ? emailInput.value : '');
        if (emailInput && emailInput.value !== email) emailInput.value = email;
        var rawPhone = document.getElementById('ckPhone').value.trim();
        var phone = getFullWhatsAppNumber(rawPhone);

        const emailOk = email && email.includes('@') && email.includes('.');
        const phoneOk = isValidCheckoutWhatsAppNumber(rawPhone);

        if (!emailOk && !phoneOk) {
            showCheckoutError('Please provide either a valid Email or WhatsApp number for delivery.');
            document.getElementById('ckEmail').style.borderColor = '#ef4444';
            document.getElementById('ckPhone').style.borderColor = '#ef4444';
            return;
        }
        
        // Reset borders
        document.getElementById('ckEmail').style.borderColor = '';
        document.getElementById('ckPhone').style.borderColor = '';

        if (email && !emailOk) {
            showCheckoutError('Please enter a valid email address');
            document.getElementById('ckEmail').style.borderColor = '#ef4444';
            return;
        }
        
        if (rawPhone && !phoneOk) {
            showCheckoutError('Please enter a valid 10-digit WhatsApp number.');
            document.getElementById('ckPhone').style.borderColor = '#ef4444';
            return;
        }

        var productName = checkoutItems.length === 1
            ? checkoutItems[0].product.name
            : 'Bundle (' + checkoutItems.length + ' items)';

        // Generate order ref or reuse existing
        var stateStr = sessionStorage.getItem('checkoutState');
        var cState = stateStr ? JSON.parse(stateStr) : {};
        if (cState.orderNumber) {
            orderNumber = cState.orderNumber;
        } else {
            var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            var suffix = '';
            for (var i = 0; i < 6; i++) suffix += chars[Math.floor(Math.random() * chars.length)];
            orderNumber = 'OTT-' + suffix;
        }

        // Hide form steps
        var stepInfo = document.getElementById('stepInfo');
        var stepPay = document.getElementById('stepPay');
        var processing = document.getElementById('ckProcessing');
        if (stepInfo) stepInfo.style.display = 'none';
        if (stepPay) stepPay.style.display = 'none';
        if (processing) {
            processing.style.display = 'block';
            processing.classList.add('ck-motion-live');
        }
        document.body.classList.add('checkout-processing-active');

        payBtn.disabled = true;
        payBtn.innerHTML = '<div class="ck-spinner" style="width:18px;height:18px;border-width:2px;margin:0"></div><span>Creating order...</span>';
        if (window.lucide) window.lucide.createIcons();

        // Show spinner
        if (processing) processing.innerHTML = '<div class="ck-redirect-card"><div class="ck-spinner"></div><div class="ck-motion-steps" aria-hidden="true"><span></span><span></span><span></span></div><h3>Creating your order</h3><p>We are locking the price and preparing your secure payment URL.</p></div>';

        // 1. Prepare items payload for the backend
        var itemsPayload = checkoutItems.map(function(item) {
            return {
                product_id: item.product.id || item.product.slug,
                sku: item.variant.sku,
                qty: item.qty || 1
            };
        });

        let sessionToken = '';
        try {
            const sbToken = localStorage.getItem('sb-YOUR_SUPABASE_PROJECT_REF-auth-token');
            if (sbToken) sessionToken = JSON.parse(sbToken).access_token;
        } catch(e) {}
        if (!sessionToken) sessionToken = localStorage.getItem('GetOTTs_customer_token');

        var pg = getPayGateSettings();
        var backendFinalAmount = 0;

        // 2. Register Order on Backend to calculate exact amount
        var localFinalAmount = Math.max(0, currentPrice - couponDiscount - (useWallet ? walletDeduction : 0));
        try {
            var regResp = await fetch(API_BASE + '/orders/register', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': sessionToken ? 'Bearer ' + sessionToken : ''
                },
                body: JSON.stringify({
                    order_number: orderNumber,
                    session_id: 'PG_' + orderNumber,
                    email: email,
                    phone: phone,
                    amount: currentPrice,
                    items: itemsPayload,
                    coupon: couponCode || null,
                    wallet_deduction: useWallet ? walletDeduction : 0,
                    wallet_currency: checkoutCurrency(),
                    product_id: itemsPayload.length > 0 ? itemsPayload[0].product_id : null,
                    sku: itemsPayload.length > 0 ? itemsPayload[0].sku : null,
                    product_name: checkoutItems.length === 1 ? (checkoutItems[0].product.name + " (" + checkoutItems[0].variant.durationLabel + (checkoutItems[0].variant.accessType ? " " + checkoutItems[0].variant.accessType : "") + ")") : 'Bundle (' + checkoutItems.length + ' items)'
                })
            });

            if (!regResp.ok) {
                var errText = await regResp.text();
                var errMsg = 'Failed to create order on server.';
                try {
                    var errJson = JSON.parse(errText);
                    errMsg = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
                } catch(e) {}
                showCheckoutError(errMsg);
                payBtn.disabled = false;
                updateTotal();
                return;
            }

            var regData = await regResp.json();
            if (regData.order_id) {
                window.secureOrderId = regData.order_id;
                sessionStorage.setItem('lastSecureOrderId', regData.order_id);
            }
            
            // Use the authoritative final amount from the secure backend
            if (regData.final_amount !== undefined) {
                backendFinalAmount = regData.final_amount;
            } else {
                backendFinalAmount = localFinalAmount;
            }

        } catch (e) {
            console.error("Order Registration Error:", e);
            showCheckoutError('Network error during order creation: ' + e.message);
            payBtn.disabled = false;
            updateTotal();
            return;
        }

        // 3. If final amount is 0 (fully paid by wallet), show success immediately!
        // The backend has already marked it as paid and deducted the wallet balance
        if (backendFinalAmount <= 0) {
            console.log("Order fully paid by wallet. Bypassing payment gateway.");
            showSuccess({ walletPaid: true });
            return;
        }

        // 4. Region-locked payment rail: non-India gets crypto, India gets UPI.
        if (checkoutPaymentMethod() === 'crypto') {
            await createCryptoPayment(pg, backendFinalAmount, email, orderNumber, productName, itemsPayload);
            return;
        }

        // 5. Create Payment Session on Paygate using backend calculated amount
        try {
            var resp = await fetch(pg.url + '/api/v1/create-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-API-Key': pg.apiKey },
                body: JSON.stringify({
                    amount: backendFinalAmount,
                    customer_email: email,
                    customer_name: (email.split('@')[0] || 'Customer'),
                    merchant_ref: orderNumber,
                    metadata: {
                        product: productName,
                        items: itemsPayload.map(function(x) { return x.sku; }).join(','),
                        coupon: couponCode || null,
                        wallet_deduction: useWallet ? walletDeduction : 0,
                        wallet_currency: checkoutCurrency()
                    }
                })
            });

            if (resp.ok) {
                var data = await resp.json();
                var payment = data.payment || {};
                paymentSessionId = payment.session_id;
                var deeplink = payment.upi_deeplink;
                var upiId = payment.upi_id;
                var upiName = payment.upi_name || 'GetOTTs';
                var payableAmt = payment.payable_amount || backendFinalAmount;
                var expiresAt = payment.expires_at || null;

                // Save active session
                sessionStorage.setItem('activePaymentSession', JSON.stringify({
                    paymentSessionId: paymentSessionId,
                    deeplink: deeplink,
                    upiId: upiId,
                    upiName: upiName,
                    payableAmt: payableAmt,
                    expiresAt: expiresAt,
                    pgUrl: pg.url,
                    checkoutUrl: payment.checkout_url || '',
                    hosted: true,
                    orderNumber: orderNumber,
                    timestamp: Date.now()
                }));

                if (payment.checkout_url) {
                    redirectToHostedPayment(payment.checkout_url, 'UPI payment', orderNumber);
                } else {
                    showUpiPanel(payableAmt, deeplink, upiId, upiName, pg.url, expiresAt);
                }

            } else {
                var errData = await resp.json().catch(function() { return {}; });
                var errMsg = errData.message || errData.error || errData.detail || 'Payment gateway failed to initialize.';
                showCheckoutError(errMsg);
                payBtn.disabled = false;
                updateTotal();
            }
        } catch(e) {
            console.error("PayGate Request Error:", e);
            showCheckoutError('Network error while connecting to payment gateway.');
            payBtn.disabled = false;
            updateTotal();
        }
    });
}

async function createCryptoPayment(pg, amount, email, orderNum, productName, itemsPayload) {
    try {
        var gatewayAmount = payGateAmountForCrypto(amount);
        var cryptoPaymentMethod = Number(gatewayAmount) < 5 ? 'crypto_bnb' : 'crypto_usdt_bep20';
        var resp = await fetch(pg.url + '/api/v1/create-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-API-Key': pg.apiKey },
            body: JSON.stringify({
                amount: gatewayAmount,
                payment_method: cryptoPaymentMethod,
                customer_email: email,
                customer_name: (email.split('@')[0] || 'Customer'),
                merchant_ref: orderNum,
                metadata: {
                    product: productName,
                    items: itemsPayload.map(function(x) { return x.sku; }).join(','),
                    coupon: couponCode || null,
                    wallet_deduction: useWallet ? walletDeduction : 0,
                    wallet_currency: checkoutCurrency(),
                    storefront_amount: amount,
                    storefront_currency: checkoutCurrency(),
                    paygate_amount: gatewayAmount,
                    crypto_payment_method: cryptoPaymentMethod
                }
            })
        });

        if (!resp.ok) {
            var errData = await resp.json().catch(function() { return {}; });
            var errMsg = errData.message || errData.error || errData.detail || 'Crypto payment failed to initialize.';
            console.warn('[CRYPTO] Gateway create-payment failed:', errData);
            showCheckoutError(errMsg);
            var payBtn = document.getElementById('payNowBtn');
            if (payBtn) {
                payBtn.disabled = false;
                updateTotal();
            }
            return;
        }

        var data = await resp.json();
        var payment = data.payment || {};
        paymentSessionId = payment.session_id;

        sessionStorage.setItem('activePaymentSession', JSON.stringify({
            paymentSessionId: paymentSessionId,
            crypto: true,
            network: payment.network,
            asset: payment.asset,
            depositAddress: payment.deposit_address,
            expectedAmountBnb: payment.expected_amount_bnb,
            expectedAmountUsdt: payment.expected_amount_usdt,
            tokenContract: payment.token_contract,
            payableAmt: amount,
            expiresAt: payment.expires_at,
            pgUrl: pg.url,
            checkoutUrl: payment.checkout_url || '',
            hosted: true,
            orderNumber: orderNum,
            timestamp: Date.now()
        }));

        if (payment.checkout_url) {
            redirectToHostedPayment(payment.checkout_url, 'crypto payment', orderNum);
            return;
        }

        setTimeout(function() {
            showCryptoPanel(payment, amount, pg.url);
        }, 1000);
    } catch (e) {
        console.error('Crypto PayGate Request Error:', e);
        showCheckoutError('Network error while connecting to crypto gateway.');
        var payBtn = document.getElementById('payNowBtn');
        if (payBtn) {
            payBtn.disabled = false;
            updateTotal();
        }
    }
}

function redirectToHostedPayment(url, label, orderNum) {
    var processing = document.getElementById('ckProcessing');
    var payBtn = document.getElementById('payNowBtn');
    var safeLabel = label || 'payment';
    var safeOrder = orderNum || orderNumber || '';

    if (payBtn) {
        payBtn.disabled = true;
        payBtn.innerHTML = '<div class="ck-spinner" style="width:18px;height:18px;border-width:2px;margin:0"></div><span>Redirecting...</span>';
    }

    if (processing) {
        processing.classList.add('ck-motion-live');
        document.body.classList.add('checkout-redirecting');
        processing.innerHTML =
            '<div class="ck-redirect-card">' +
                '<div class="ck-spinner"></div>' +
                '<div class="ck-motion-steps" aria-hidden="true"><span></span><span></span><span></span></div>' +
                '<h3>Redirecting to secure payment</h3>' +
                '<p>Your order ' + safeOrder + ' is ready. Opening your unique hosted ' + safeLabel + ' URL now.</p>' +
            '</div>';
    }

    markHostedRedirectedAgain();
    setTimeout(function() {
        window.location.assign(url);
    }, 650);
}

function showCryptoPanel(payment, fiatAmount, pgUrl) {
    var processing = document.getElementById('ckProcessing');
    if (!processing) return;

    var address = payment.deposit_address;
    var asset = payment.asset || (payment.expected_amount_usdt ? 'USDT' : 'BNB');
    var isUsdt = asset === 'USDT' || !!payment.expected_amount_usdt;
    var cryptoAmount = isUsdt ? formatUsdtDisplay(payment.expected_amount_usdt) : payment.expected_amount_bnb;
    var network = isUsdt ? 'BNB Smart Chain / BEP20' : 'BNB Smart Chain';
    var title = isUsdt ? 'Pay with USDT Tether' : 'Pay with BNB';
    var subtitle = isUsdt ? 'Send USDT Tether on BNB Smart Chain (BEP20) only' : 'Send native BNB on BNB Smart Chain only';
    // Use address-only QR. Some wallets misread EVM payment URIs as Ethereum
    // even when chainId 56 is present, which can make users choose the wrong network.
    var qrData = address;
    var qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=' + encodeURIComponent(qrData);
    var contractRow = isUsdt && payment.token_contract
        ? '<div class="upi-detail-row" style="align-items:flex-start;"><span>Token Contract</span><strong style="font-family:monospace;font-size:.72rem;word-break:break-all;text-align:right;max-width:210px;">' + payment.token_contract + '</strong></div>'
        : '';
    var warning = isUsdt
        ? 'Send only USDT Tether using BNB Smart Chain / BEP20. Do not send BNB, ERC20 USDT, TRC20 USDT, Bitcoin, or funds from another network.'
        : 'Send only native BNB using BNB Smart Chain. Do not send BEP20 tokens, Ethereum, Bitcoin, or funds from another network.';
    var feeNote = isUsdt
        ? '<div style="margin-top:10px;color:var(--gray-500);font-size:.78rem;line-height:1.4;">Small wallet/network fee differences up to 0.20 USDT are accepted.</div>'
        : '';

    processing.innerHTML =
        '<div class="upi-panel">' +
            '<div class="upi-header" style="text-align:center; margin-bottom:24px;">' +
                '<h3 style="font-family:var(--font-heading); font-size:1.5rem; font-weight:800; color:var(--gray-900); margin-bottom:8px;">' + title + '</h3>' +
                '<p style="color:var(--gray-500); font-size:.9rem;">' + subtitle + '</p>' +
                '<p style="color:var(--gray-500); font-size:.78rem;margin-top:6px;">QR contains deposit address only. Select ' + network + ' in your wallet.</p>' +
            '</div>' +
            '<div style="display:flex;justify-content:center;margin-bottom:24px;">' +
                '<img src="' + qrUrl + '" alt="' + asset + ' payment QR" style="width:220px;height:220px;border-radius:12px;border:1px solid var(--gray-200);padding:10px;background:white;">' +
            '</div>' +
            '<div class="upi-details-card">' +
                '<div class="upi-detail-row"><span>Asset</span><strong>' + asset + '</strong></div>' +
                '<div class="upi-detail-row"><span>Network</span><strong>' + network + '</strong></div>' +
                '<div class="upi-detail-row"><span>Amount</span><strong>' + cryptoAmount + ' ' + asset + '</strong><button class="upi-copy-btn" onclick="copyCryptoValue(&quot;' + cryptoAmount + '&quot;)">Copy</button></div>' +
                feeNote +
                contractRow +
                '<div class="upi-detail-row" style="align-items:flex-start;"><span>Address</span><strong style="font-family:monospace;font-size:.78rem;word-break:break-all;text-align:right;max-width:210px;">' + address + '</strong></div>' +
                '<button class="upi-copy-btn" onclick="copyCryptoValue(&quot;' + address + '&quot;)" style="width:100%;margin-top:12px;">Copy Address</button>' +
            '</div>' +
            '<div class="upi-warning" style="margin-top:16px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;padding:12px;border-radius:8px;font-size:.86rem;line-height:1.5;">' +
                warning +
            '</div>' +
            '<div class="upi-status-row" id="upiStatusRow" style="margin-top:18px;">' +
                '<div class="upi-polling-dot"></div>' +
                '<span style="font-weight:700; color:var(--gray-700);">Waiting for blockchain confirmation...</span>' +
            '</div>' +
            '<div style="display:flex;justify-content:space-between;margin-top:16px;color:var(--gray-500);font-size:.82rem;">' +
                '<span>Order ' + orderNumber + '</span><span id="upiCountdown">10:00</span>' +
            '</div>' +
            '<div style="text-align:center; margin-top:16px;">' +
                '<button onclick="cancelCheckout()" style="background:none; border:1px solid var(--gray-300); color:var(--gray-600); padding:10px 28px; border-radius:10px; font-weight:700; font-size:0.875rem; cursor:pointer; transition:all 0.2s;">← Cancel & Go Back</button>' +
            '</div>' +
        '</div>';

    startPolling();
    startCountdown(pgUrl, payment.expires_at, orderNumber);
}

function copyCryptoValue(value) {
    navigator.clipboard.writeText(value).then(function() {
        if (typeof Toast !== 'undefined') Toast.success('Copied', 'Crypto payment value copied.');
    });
}

function showUpiPanel(amount, deeplink, upiId, upiName, pgUrl, expiresAt) {
    var processing = document.getElementById('ckProcessing');
    if (!processing) return;
    processing.classList.add('ck-motion-live');
    document.body.classList.add('checkout-payment-live');

    // Hide coupon section once payment is initiated
    var couponSec = document.getElementById('ckCouponSection');
    var couponLock = document.getElementById('ckCouponLocked');
    if (couponSec) couponSec.style.display = 'none';
    if (couponLock) couponLock.style.display = 'block';

    // Fix amount mismatch: ensure UI shows exactly what was generated by backend
    var displayAmt = typeof amount === 'number' ? amount : parseFloat(amount);
    
    // Add transaction note (tn) for better matching on merchant apps
    var cleanLink = deeplink;
    try { cleanLink = decodeURIComponent(deeplink); } catch(e) {}
    if (cleanLink.includes('?')) {
        if (!cleanLink.includes('tn=')) cleanLink += '&tn=' + encodeURIComponent(orderNumber);
    } else {
        cleanLink += '?tn=' + encodeURIComponent(orderNumber);
    }
    
    var qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=' + encodeURIComponent(cleanLink);

    processing.innerHTML =
        '<div class="upi-panel">' +
            '<div class="upi-header" style="text-align:center; margin-bottom:24px;">' +
                '<div class="upi-amount" style="font-size:clamp(1.8rem, 8vw, 2.75rem); font-weight:800; color:var(--gray-900); font-family:\'Plus Jakarta Sans\';">' + getCurrencySymbol() + displayAmt.toLocaleString('en-IN') + '</div>' +
                '<div style="color:var(--gray-500); font-size:0.875rem; margin-top:4px;">Order Ref: ' + orderNumber + '</div>' +
            '</div>' +
            '<div id="checkoutTimer">Session expires in <span id="upiCountdown">10:00</span></div>' +
            
            '<div class="upi-body">' +
                '<a href="' + cleanLink + '" class="upi-pay-btn" onclick="startPolling()">' +
                    '<i data-lucide="smartphone"></i> Tap to Pay Instantly' +
                '</a>' +
                '<p style="text-align:center; font-size:0.8125rem; font-weight:600; color:var(--success); margin-bottom:24px;">✔ Instant redirection to your UPI App</p>' +
                
                '<div style="text-align:center; background:white; padding:24px; border-radius:var(--radius-lg); border:1px solid var(--gray-200); box-shadow:var(--shadow-sm); margin-bottom:24px;">' +
                    '<img src="' + qrUrl + '" alt="Scan QR" style="width:200px; height:200px; display:block; margin:0 auto 12px;" onerror="this.style.display=\'none\'">' +
                    '<p style="font-size:0.8125rem; font-weight:600; color:var(--gray-700);">Or scan with GPay, PhonePe, Paytm</p>' +
                '</div>' +

                '<div style="background:var(--gray-50); padding:16px; border-radius:var(--radius-md); border:1px solid var(--gray-200); display:flex; align-items:center; justify-content:space-between; margin-bottom:24px;">' +
                    '<div>' +
                        '<div style="font-size:0.75rem; color:var(--gray-500); margin-bottom:2px;">Merchant UPI ID</div>' +
                        '<div style="font-weight:700; color:var(--gray-900); font-family:monospace; font-size:1rem;">' + upiId + '</div>' +
                    '</div>' +
                    '<button onclick="copyUpiId(\'' + upiId + '\')" style="background:var(--gray-900); color:white; border:none; padding:8px 16px; border-radius:8px; font-weight:700; cursor:pointer; font-size:0.8125rem;">Copy</button>' +
                '</div>' +

                '<div class="upi-status-row" id="upiStatusRow">' +
                    '<div class="upi-polling-dot"></div>' +
                    '<span style="font-weight:700; color:var(--gray-700);">Confirming payment...</span>' +
                '</div>' +
                '<div style="text-align:center; margin-top:20px; font-size:0.75rem; color:var(--gray-400);">' +
                    'Please stay on this page for instant access.' +
                '</div>' +
                '<div style="text-align:center; margin-top:16px;">' +
                    '<button onclick="cancelCheckout()" style="background:none; border:1px solid var(--gray-300); color:var(--gray-600); padding:10px 28px; border-radius:10px; font-weight:700; font-size:0.875rem; cursor:pointer; transition:all 0.2s;">← Cancel & Go Back</button>' +
                '</div>' +
            '</div>' +
        '</div>';

    if (window.lucide) lucide.createIcons();
    
    // Start polling and countdown
    startPolling();
    startCountdown(pgUrl, expiresAt, orderNumber);
}

var pollInterval = null;
var pollAttempts = 0;
function startPolling() {
    if (pollInterval) return; // already polling
    var pg = getPayGateSettings();
    pollAttempts = 0;

    function doPoll() {
        pollAttempts++;
        // Adaptive: 5s for first 2 min (24 polls), then 10s after
        var nextDelay = pollAttempts <= 24 ? 5000 : 10000;
        // Max ~8 min total (24×5s + 36×10s = 480s)
        if (pollAttempts > 60) { clearInterval(pollInterval); pollInterval = null; return; }

        (async function() {
            try {
                // 1. Check GetOTTs Backend (source of truth)
                var internalStatus = 'pending';
                try {
                    const API_BASE = (window.GETOTTS_CONFIG && window.GETOTTS_CONFIG.API_BASE) || '';
                    if (API_BASE) {
                        var orderResp = await fetch(API_BASE + '/orders/' + orderNumber);
                        if (orderResp.ok) {
                            var orderData = await orderResp.json();
                            internalStatus = (orderData.payment_status || 'pending').toLowerCase();
                            console.log('[POLL] Backend status:', internalStatus, 'for', orderNumber);
                        }
                    }
                } catch(e) { console.warn('[POLL] Internal poll failed', e); }

                var successStates = ['success', 'paid', 'completed', 'approved', 'manual_approved', 'confirmed', 'verified'];
                var rejectedStates = ['rejected', 'declined', 'manual_rejected', 'refunded', 'dispute', 'failed'];
                var expiredStates = ['expired', 'cancelled', 'canceled', 'timeout', 'error'];

                if (successStates.indexOf(internalStatus) !== -1) {
                    clearInterval(pollInterval); pollInterval = null;
                    showSuccess();
                    return;
                } else if (rejectedStates.indexOf(internalStatus) !== -1) {
                    clearInterval(pollInterval); pollInterval = null;
                    showRejected();
                    return;
                }

                // 2. Check PayGate directly
                var resp = await fetch(pg.url + '/api/v1/payment/' + paymentSessionId, {
                    headers: { 'X-API-Key': pg.apiKey }
                });
                if (resp.ok) {
                    var data = await resp.json();
                    var payment = data.payment || data.session || data.data || data;
                    var status = (payment.status || payment.payment_status || payment.state || '').toLowerCase().trim();
                    console.log('[POLL] PayGate status:', status, 'for session', paymentSessionId);

                    if (successStates.indexOf(status) !== -1) {
                        clearInterval(pollInterval); pollInterval = null;
                        showSuccess();
                    } else if (rejectedStates.indexOf(status) !== -1) {
                        clearInterval(pollInterval); pollInterval = null;
                        showRejected();
                    } else if (expiredStates.indexOf(status) !== -1) {
                        clearInterval(pollInterval); pollInterval = null;
                        showExpired();
                    }
                }
            } catch(e) { /* network hiccup — keep polling */ }
        })();

        // Schedule next poll with adaptive delay
        clearInterval(pollInterval);
        pollInterval = setTimeout(doPoll, nextDelay);
    }

    // Start first poll after 5s
    pollInterval = setTimeout(doPoll, 5000);
}


function cancelCheckout() {
    if (pollInterval) clearInterval(pollInterval);
    
    const modalHtml = `
      <div id="cancelModal" style="position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(15,23,42,0.7); display:flex; justify-content:center; align-items:center; z-index:9999; backdrop-filter:blur(4px);">
        <div style="background:white; padding:32px 24px; border-radius:16px; width:90%; max-width:380px; text-align:center; box-shadow:0 20px 25px -5px rgba(0,0,0,0.1);">
            <div style="background:#fee2e2; width:64px; height:64px; border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 20px;">
                <i data-lucide="x-circle" style="width:32px; height:32px; color:#ef4444;"></i>
            </div>
            <h3 style="font-family:var(--font-heading); font-size:1.3rem; margin-bottom:12px; color:var(--gray-800); font-weight:800;">Cancel Payment?</h3>
            <p style="color:var(--gray-500); font-size:0.95rem; margin-bottom:28px; line-height:1.5;">Are you sure you want to cancel this checkout? The transaction will be aborted.</p>
            <div style="display:flex; gap:12px;">
                <button onclick="document.getElementById('cancelModal').remove(); startPolling();" class="btn btn-outline" style="flex:1;">Return</button>
                <button id="confirmCancelBtn" onclick="executeCancel()" class="btn btn-primary" style="flex:1; background:#ef4444; border-color:#ef4444;">Cancel Order</button>
            </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    if(window.lucide) lucide.createIcons();
}

async function executeCancel() {
    var btn = document.getElementById('confirmCancelBtn');
    if (btn) btn.textContent = 'Cancelling...';
    
    // Call PayGate and backend to cancel the payment session, release inventory, and refund wallet.
    var sessionStr = sessionStorage.getItem('activePaymentSession');
    if (sessionStr) {
        try {
            var sessionData = JSON.parse(sessionStr);
            var pg = getPayGateSettings();
            if (sessionData.paymentSessionId) {
                await fetch((sessionData.pgUrl || pg.url) + '/api/v1/cancel/' + sessionData.paymentSessionId, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-API-Key': pg.apiKey }
                });
            }
            if (sessionData.orderNumber) {
                await fetch(API_BASE + '/orders/cancel', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ order_number: sessionData.orderNumber })
                });
            }
        } catch (e) {
            console.error("Cancel API error:", e);
        }
    }
    
    sessionStorage.removeItem('activePaymentSession');
    window.location.reload();
}

function startCountdown(pgUrl, expiresAtStr, orderNum) {
    var cd = document.getElementById('upiCountdown');
    var targetTime = 0;
    
    if (expiresAtStr && isNaN(expiresAtStr)) {
        targetTime = new Date(expiresAtStr).getTime();
    } else if (expiresAtStr && !isNaN(expiresAtStr)) {
        targetTime = parseInt(expiresAtStr, 10);
    } else {
        var savedExpiry = sessionStorage.getItem('getotts_expiry_' + orderNum);
        if (savedExpiry) {
            targetTime = parseInt(savedExpiry, 10);
        } else {
            targetTime = Date.now() + (10 * 60 * 1000);
            sessionStorage.setItem('getotts_expiry_' + orderNum, targetTime.toString());
        }
    }

    var timer = setInterval(function() {
        var now = Date.now();
        var totalSecs = Math.floor((targetTime - now) / 1000);
        
        if (!cd || totalSecs <= 0) {
            clearInterval(timer);
            if (totalSecs <= 0) showExpired();
            return;
        }
        var m = Math.floor(totalSecs / 60);
        var s = totalSecs % 60;
        cd.textContent = m + ':' + (s < 10 ? '0' : '') + s;
        if (totalSecs <= 60) cd.style.color = '#ef4444';
    }, 1000);
}

function copyUpiId(id) {
    navigator.clipboard.writeText(id).then(function() {
        var btn = document.querySelector('.upi-copy-btn');
        if (btn) { btn.textContent = 'Copied!'; setTimeout(function() { btn.textContent = 'Copy'; }, 2000); }
    });
}

function showExpired() {
    sessionStorage.removeItem('activePaymentSession');
    if (pollInterval) clearInterval(pollInterval);
    var processing = document.getElementById('ckProcessing');
    if (!processing) return;
    processing.innerHTML =
        '<div style="text-align:center;padding:40px 0">' +
            '<div style="font-size:3rem;margin-bottom:16px">⏰</div>' +
            '<h3 style="font-family:var(--font-heading);font-weight:700;margin-bottom:8px">Session Expired</h3>' +
            '<p style="color:var(--gray-500);margin-bottom:24px">Your payment window has expired. Please try again.</p>' +
            '<a href="javascript:location.reload()" class="btn btn-primary" style="margin-right:8px">Try Again</a>' +
            '<a href="https://wa.me/919088212294?text=My%20payment%20expired%20for%20order%20' + orderNumber + '" class="btn btn-outline" target="_blank">📱 WhatsApp Support</a>' +
        '</div>';
}

function showRejected() {
    sessionStorage.removeItem('activePaymentSession');
    if (pollInterval) clearInterval(pollInterval);
    var processing = document.getElementById('ckProcessing');
    if (!processing) return;
    processing.innerHTML =
        '<div style="text-align:center;padding:40px 0">' +
            '<div style="font-size:3rem;margin-bottom:16px">❌</div>' +
            '<h3 style="font-family:var(--font-heading);font-weight:700;margin-bottom:8px;color:#ef4444">Payment Rejected</h3>' +
            '<p style="color:var(--gray-500);margin-bottom:8px">Your payment for order <strong>' + orderNumber + '</strong> was rejected or declined.</p>' +
            '<p style="color:var(--gray-400);font-size:.85rem;margin-bottom:24px">If you believe this is an error, please contact our support team immediately.</p>' +
            '<a href="javascript:location.reload()" class="btn btn-primary" style="margin-right:8px">Try Again</a>' +
            '<a href="https://wa.me/919088212294?text=My%20payment%20was%20rejected%20for%20order%20' + orderNumber + '%20-%20please%20help" class="btn btn-outline" target="_blank">📱 WhatsApp Support</a>' +
        '</div>';
}

function showManualFallback(amount, email, pgUrl) {
    // Hide coupon section
    var couponSec = document.getElementById('ckCouponSection');
    var couponLock = document.getElementById('ckCouponLocked');
    if (couponSec) couponSec.style.display = 'none';
    if (couponLock) couponLock.style.display = 'block';
    
    var processing = document.getElementById('ckProcessing');
    if (!processing) return;

    // Try to get UPI ID from public endpoint for manual payment
    fetch(pgUrl + '/api/upi-config').then(function(r) { return r.ok ? r.json() : null; }).then(function(cfg) {
        var upiId = (cfg && cfg.upiId) ? cfg.upiId : 'yourupi@bank';
        var upiName = (cfg && cfg.upiName) ? cfg.upiName : 'GetOTTs';
        var deeplink = 'upi://pay?pa=' + encodeURIComponent(upiId) + '&pn=' + encodeURIComponent(upiName) + '&am=' + amount.toFixed(2) + '&cu=INR&tn=' + encodeURIComponent('Order-' + orderNumber);
        var qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(deeplink);
        var waLink = 'https://wa.me/919088212294?text=' + encodeURIComponent('Hi, I made a payment of ' + getCurrencySymbol() + amount + ' for order ' + orderNumber + '. Here is my screenshot:');

        processing.innerHTML =
            '<div class="fallback-payment-page">' +
                '<div style="text-align:center; margin-bottom:24px;">' +
                    '<div style="font-size:2.5rem; margin-bottom:8px;">📱</div>' +
                    '<h3 style="font-family:var(--font-heading); font-weight:800; font-size:1.3rem; color:var(--gray-900); margin-bottom:4px;">Pay ' + getCurrencySymbol() + amount.toLocaleString('en-IN') + ' via UPI</h3>' +
                    '<p style="font-size:.85rem; color:var(--gray-500);">Order: <strong style="font-family:monospace; color:var(--gray-700);">' + orderNumber + '</strong></p>' +
                '</div>' +

                '<div style="text-align:center; background:white; padding:24px; border-radius:16px; border:1px solid var(--gray-200); box-shadow:var(--shadow-sm); margin-bottom:20px;">' +
                    '<img src="' + qrUrl + '" alt="Scan QR to Pay" style="width:200px; height:200px; display:block; margin:0 auto 12px; border-radius:8px;" onerror="this.style.display=\'none\'">' +
                    '<p style="font-size:.8rem; font-weight:600; color:var(--gray-600);">Scan with GPay, PhonePe, or Paytm</p>' +
                '</div>' +

                '<div style="background:var(--gray-50); padding:14px 18px; border-radius:10px; border:1px solid var(--gray-200); display:flex; align-items:center; justify-content:space-between; margin-bottom:16px;">' +
                    '<div>' +
                        '<div style="font-size:.72rem; color:var(--gray-500); text-transform:uppercase; letter-spacing:.5px; margin-bottom:2px;">Merchant UPI ID</div>' +
                        '<div style="font-weight:700; color:var(--gray-900); font-family:monospace; font-size:1rem;">' + upiId + '</div>' +
                    '</div>' +
                    '<button onclick="copyUpiId(\'' + upiId + '\')" style="background:var(--gray-900); color:white; border:none; padding:8px 16px; border-radius:8px; font-weight:700; cursor:pointer; font-size:.8rem;">Copy</button>' +
                '</div>' +

                '<p style="font-size:.75rem; color:#f59e0b; margin-bottom:16px; text-align:center;">⚠️ If your UPI app flags the link, scan the QR code from another phone or use GPay/PhonePe.</p>' +

                '<a href="' + deeplink + '" class="btn btn-primary" style="display:block; text-align:center; margin-bottom:12px;">Open UPI App</a>' +

                '<div style="background:var(--gray-50); border:1px solid var(--gray-200); border-radius:12px; padding:16px; text-align:center;">' +
                    '<p style="font-size:.82rem; color:var(--gray-600); margin-bottom:10px; font-weight:500;">After payment, send screenshot to confirm:</p>' +
                    '<a href="' + waLink + '" class="btn btn-outline" target="_blank" style="display:inline-flex; align-items:center; gap:6px;">' +
                        '📱 WhatsApp Payment Proof' +
                    '</a>' +
                '</div>' +
            '</div>';
    }).catch(function() {
        // Complete gateway offline — show polished fallback
        var waLink = 'https://wa.me/919088212294?text=' + encodeURIComponent('Hi, I want to complete my order ' + orderNumber + ' (' + getCurrencySymbol() + amount + '). The payment gateway was unavailable. Please help me pay.');

        processing.innerHTML =
            '<div class="fallback-payment-page">' +
                '<div style="text-align:center; padding:20px 0;">' +

                    '<div style="width:64px; height:64px; margin:0 auto 16px; background:linear-gradient(135deg, #fef3c7, #fde68a); border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:1.8rem;">⚠️</div>' +

                    '<h3 style="font-family:var(--font-heading); font-weight:800; font-size:1.25rem; color:var(--gray-900); margin-bottom:8px;">Payment Gateway Temporarily Unavailable</h3>' +

                    '<p style="color:var(--gray-500); font-size:.9rem; line-height:1.6; max-width:380px; margin:0 auto 24px;">Don\'t worry — your order can still be completed. Contact us via WhatsApp and we\'ll process it manually.</p>' +

                    '<div class="ck-light-detail-card" style="background:var(--gray-50); border:1px solid var(--gray-200); border-radius:12px; padding:20px; margin-bottom:24px; max-width:380px; margin-left:auto; margin-right:auto;">' +
                        '<div class="ck-light-detail-row" style="display:flex; justify-content:space-between; margin-bottom:10px;">' +
                            '<span class="ck-light-detail-label" style="font-size:.82rem; color:var(--gray-500);">Order ID</span>' +
                            '<strong class="ck-light-detail-value" style="font-family:monospace; color:var(--gray-800); font-size:.9rem;">' + orderNumber + '</strong>' +
                        '</div>' +
                        '<div class="ck-light-detail-row" style="display:flex; justify-content:space-between; margin-bottom:10px;">' +
                            '<span class="ck-light-detail-label" style="font-size:.82rem; color:var(--gray-500);">Amount</span>' +
                            '<strong class="ck-light-detail-value" style="color:var(--gray-800); font-size:.9rem;">' + getCurrencySymbol() + amount.toLocaleString('en-IN') + '</strong>' +
                        '</div>' +
                        '<div class="ck-light-detail-row" style="display:flex; justify-content:space-between;">' +
                            '<span class="ck-light-detail-label" style="font-size:.82rem; color:var(--gray-500);">Support</span>' +
                            '<strong class="ck-light-detail-value" style="color:var(--gray-800); font-size:.9rem;">+91 90882 12294</strong>' +
                        '</div>' +
                    '</div>' +

                    '<a href="' + waLink + '" class="btn btn-primary" target="_blank" style="display:inline-flex; align-items:center; gap:8px; padding:14px 32px; font-size:1rem;">' +
                        '📲 Complete Order via WhatsApp' +
                    '</a>' +

                    '<p style="color:var(--gray-400); font-size:.78rem; margin-top:16px;">Our team typically responds within 5 minutes</p>' +

                '</div>' +
            '</div>';
    });
}

function showCryptoPlaceholder(amount, orderNumber) {
    var processing = document.getElementById('ckProcessing');
    if (!processing) return;

    var sSection = document.getElementById('ckCouponSection');
    var lSection = document.getElementById('ckCouponLocked');
    if (sSection) sSection.style.display = 'none';
    if (lSection) lSection.style.display = 'block';

    var waLink = 'https://wa.me/919088212294?text=' + encodeURIComponent('Hi, I want to complete my order ' + orderNumber + ' (' + getCurrencySymbol() + amount + ') using Crypto. Please provide the wallet address.');

    processing.innerHTML =
        '<div class="fallback-payment-page">' +
            '<div style="text-align:center; padding:20px 0;">' +
                '<div style="font-size:3rem; margin-bottom:16px;">₿</div>' +
                '<h3 style="font-family:var(--font-heading); font-weight:800; font-size:1.3rem; color:var(--gray-900); margin-bottom:8px;">Crypto Payment Integration</h3>' +
                '<p style="color:var(--gray-500); font-size:.9rem; line-height:1.6; max-width:380px; margin:0 auto 24px;">' +
                    'We are currently finalizing our international crypto payment gateway.' +
                '</p>' +
                '<div class="ck-light-detail-card" style="background:var(--gray-50); border:1px solid var(--gray-200); border-radius:12px; padding:20px; margin-bottom:24px; max-width:380px; margin-left:auto; margin-right:auto;">' +
                    '<div class="ck-light-detail-row" style="display:flex; justify-content:space-between; margin-bottom:10px;">' +
                        '<span class="ck-light-detail-label" style="font-size:.82rem; color:var(--gray-500);">Order ID</span>' +
                        '<strong class="ck-light-detail-value" style="font-family:monospace; color:var(--gray-800); font-size:.9rem;">' + orderNumber + '</strong>' +
                    '</div>' +
                    '<div class="ck-light-detail-row" style="display:flex; justify-content:space-between; margin-bottom:10px;">' +
                        '<span class="ck-light-detail-label" style="font-size:.82rem; color:var(--gray-500);">Amount Due</span>' +
                        '<strong class="ck-light-detail-value" style="color:var(--gray-800); font-size:.9rem;">' + getCurrencySymbol() + amount.toLocaleString('en-US') + '</strong>' +
                    '</div>' +
                '</div>' +
                '<a href="' + waLink + '" class="btn btn-primary" target="_blank" style="display:inline-flex; align-items:center; gap:8px; padding:14px 32px; font-size:1rem;">' +
                    '📲 Pay via WhatsApp / Telegram' +
                '</a>' +
                '<p style="color:var(--gray-400); font-size:.78rem; margin-top:16px;">Contact us for manual BTC/USDT processing</p>' +
            '</div>' +
        '</div>';
}

function showSuccess(options) {
    options = options || {};
    var proc = document.getElementById('ckProcessing');
    var success = document.getElementById('ckSuccess');
    var trackBtn = document.getElementById('trackOrderBtn');
    var payBtn = document.getElementById('payNowBtn');
    var isWalletPaid = !!options.walletPaid || (walletDeduction > 0 && getCheckoutFinalAmount() <= 0);
    if (!checkoutPurchaseTracked) {
        checkoutPurchaseTracked = true;
        trackCheckoutStage('Purchase', {
            order_id: orderNumber || undefined,
            status: isWalletPaid ? 'wallet_paid' : 'paid'
        });
    }

    document.body.classList.remove('checkout-processing-active', 'checkout-payment-live', 'checkout-redirecting');
    document.body.classList.add('checkout-success-active');
    if (proc) {
        proc.style.display = 'none';
        proc.classList.remove('ck-motion-live');
    }
    if (success) {
        success.style.display = 'block';
        success.classList.remove('ck-success-live');
        void success.offsetWidth;
        success.classList.add('ck-success-live');
    }
    if (isWalletPaid) markWalletPaidSummary();
    if (payBtn) {
        payBtn.disabled = true;
        payBtn.setAttribute('aria-disabled', 'true');
        payBtn.classList.remove('is-policy-locked');
        payBtn.classList.add('is-order-complete');
        payBtn.innerHTML = '<i data-lucide="check-circle-2"></i><span class="ck-pay-text"><span class="ck-pay-label">' + (isWalletPaid ? 'Wallet Payment Successful' : 'Order Created') + '</span></span>';
        if (isWalletPaid) markWalletPaidSummary();
        if (window.lucide) window.lucide.createIcons();
    }
    
    // Use secure token if available, otherwise fallback to public tracking
    if (trackBtn) {
        var secureId = window.secureOrderId || sessionStorage.getItem('lastSecureOrderId');
        var secureUrl = secureId ? ('order?token=' + encodeURIComponent(secureId)) : ('order?id=' + encodeURIComponent(orderNumber));
        trackBtn.href = secureUrl;
    }

    var orders = JSON.parse(localStorage.getItem('GetOTTs_orders') || '[]');
    orders.push({
        orderNumber: orderNumber,
        secureOrderId: window.secureOrderId || sessionStorage.getItem('lastSecureOrderId') || null,
        items: checkoutItems.map(function(x) { return { name: x.product.name, sku: x.variant.sku, qty: x.qty }; }),
        amount: currentPrice - couponDiscount,
        currency: checkoutCurrency(),
        date: new Date().toISOString()
    });
    localStorage.setItem('GetOTTs_orders', JSON.stringify(orders));

    // Clear cart & checkout states so it doesn't persist
    localStorage.removeItem('getotts_cart');
    sessionStorage.removeItem('checkoutState');
    sessionStorage.removeItem('activePaymentSession');
}

function showCheckoutError(msg) {
    resetCheckoutFormAfterError();
    if (typeof Toast !== 'undefined') {
        Toast.error("Checkout Error", msg);
    } else {
        var toast = document.getElementById('ckToast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'ckToast';
            toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(100px);padding:12px 24px;border-radius:12px;background:#ef4444;color:white;font-size:.9rem;font-weight:500;z-index:9999;transition:transform .3s ease;box-shadow:0 8px 25px rgba(0,0,0,.3);';
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.style.transform = 'translateX(-50%) translateY(0)';
        setTimeout(function() { toast.style.transform = 'translateX(-50%) translateY(100px)'; }, 3500);
    }
}

function resetCheckoutFormAfterError() {
    var processing = document.getElementById('ckProcessing');
    var stepInfo = document.getElementById('stepInfo');
    var stepPay = document.getElementById('stepPay');
    if (processing && processing.style.display !== 'none') {
        processing.style.display = 'none';
        processing.classList.remove('ck-motion-live');
        processing.innerHTML = '';
        if (stepInfo) stepInfo.style.display = '';
        if (stepPay) stepPay.style.display = '';
    }
    document.body.classList.remove('checkout-processing-active', 'checkout-payment-live', 'checkout-redirecting', 'checkout-success-active');
    var payBtn = document.getElementById('payNowBtn');
    if (payBtn) payBtn.disabled = false;
}

/**
 * Trigger WhatsApp Login from Checkout
 */
function startWhatsAppAuth() {
    if (typeof WA_AUTH !== 'undefined') {
        WA_AUTH.start();
    } else {
        if (typeof Toast !== 'undefined') Toast.info("Loading...", "Auth service is initializing. Please wait.");
        else alert('Authentication service is still loading. Please wait a moment.');
    }
}

