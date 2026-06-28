/* ============================================
   GetOTTs — Order Tracking Logic v2
   Fixed: Loading state, field mapping, timeline, WhatsApp prefill
   ============================================ */

const API_BASE = (window.GETOTTS_CONFIG && window.GETOTTS_CONFIG.API_BASE) 
    ? window.GETOTTS_CONFIG.API_BASE 
    : (window.location.origin.includes('localhost') ? 'http://localhost:8000/api/v1' : 'https://api.getotts.com/api/v1');

const params = new URLSearchParams(window.location.search);
let orderId = params.get('id');
let secureToken = params.get('token');

function restartOrderMotion(el, className) {
    if (!el) return;
    el.classList.remove(className);
    void el.offsetWidth;
    el.classList.add(className);
}

function markOrderMotion(status) {
    const details = document.getElementById('orderDetails');
    if (!details) return;
    details.classList.remove('is-loaded', 'is-delivered', 'is-paid', 'is-pending', 'is-failed', 'is-action-required');
    void details.offsetWidth;
    details.classList.add('is-loaded', `is-${status}`);
}

function orderMoney(amount, currency) {
    var c = (currency || (typeof getCurrentCurrency === 'function' ? getCurrentCurrency() : 'INR')).toUpperCase();
    var symbol = c === 'USD' ? '$' : '₹';
    return symbol + Number(amount || 0).toLocaleString(c === 'USD' ? 'en-US' : 'en-IN', {
        minimumFractionDigits: c === 'USD' ? 2 : 0,
        maximumFractionDigits: 2
    });
}

document.addEventListener('DOMContentLoaded', () => {
    if (window.lucide) lucide.createIcons();

    if (orderId || secureToken) {
        // Auto-search if order ID or token in URL
        document.getElementById('orderSearch').style.display = 'none';
        lookupOrder(orderId || secureToken);
    }

    // Search button
    document.getElementById('searchBtn').addEventListener('click', () => {
        const input = document.getElementById('orderInput').value.trim().toUpperCase();
        if (input) {
            orderId = input;
            lookupOrder(orderId);
        }
    });

    // Enter key
    document.getElementById('orderInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.getElementById('searchBtn').click();
    });
});

async function lookupOrder(orderNumber) {
    document.getElementById('orderSearch').style.display = 'none';
    document.getElementById('orderNotFound').style.display = 'none';
    document.getElementById('orderDetails').style.display = 'none';

    try {
        let endpoint = `${API_BASE}/orders/track/${encodeURIComponent(orderNumber)}`;
        const looksLikeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderNumber || '');
        if (secureToken) {
            endpoint = `${API_BASE}/orders/secure/${encodeURIComponent(secureToken)}`;
        } else if (looksLikeUuid) {
            // Only true order UUIDs use the secure endpoint. PayGate session IDs
            // are tracked through /orders/track via payment_ref fallback.
            endpoint = `${API_BASE}/orders/secure/${encodeURIComponent(orderNumber)}`;
        }

        const headers = {};
        const customerToken = localStorage.getItem('GetOTTs_customer_token');
        if (customerToken) {
            headers['Authorization'] = `Bearer ${customerToken}`;
        }

        const resp = await fetch(endpoint, { headers });

        if (resp.ok) {
            const data = await resp.json();
            renderOrder(data);
        } else if (resp.status === 404) {
            const localOrder = checkLocalOrders(orderNumber);
            if (localOrder) {
                renderLocalOrder(localOrder);
            } else {
                showNotFound();
            }
        } else {
            const localOrder = checkLocalOrders(orderNumber);
            if (localOrder) {
                renderLocalOrder(localOrder);
            } else {
                showNotFound();
            }
        }
    } catch (e) {
        const localOrder = checkLocalOrders(orderNumber);
        if (localOrder) {
            renderLocalOrder(localOrder);
        } else {
            showNotFound();
        }
    }
}

function checkLocalOrders(orderNumber) {
    const orders = JSON.parse(localStorage.getItem('GetOTTs_orders') || '[]');
    return orders.find(o => o.orderNumber === orderNumber);
}

function cleanOrderProductName(value) {
    const raw = String(value || 'your subscription').replace(/\s+/g, ' ').trim();
    if (!raw) return 'your subscription';
    const cleaned = raw
        .replace(/\s*\(\s*\d+\s*(?:month|months|mo|year|years|yr|yrs)\s*(?:-|–|—)?\s*(?:shared|personal|private|family|profile|account|slot)?\s*\)\s*$/i, '')
        .replace(/\s*\(\s*(?:shared|personal|private|family)\s*\)\s*$/i, '')
        .trim();
    return cleaned || raw;
}

function titleCasePlanPart(value) {
    return String(value || '')
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, ch => ch.toUpperCase());
}

function orderVariantLabel(data) {
    const duration = data.duration_label || (data.duration_months ? `${data.duration_months} ${Number(data.duration_months) === 1 ? 'Month' : 'Months'}` : '');
    const access = data.access_type || data.plan_type || '';
    const quality = data.quality || '';
    const parts = [duration, quality, access]
        .map(titleCasePlanPart)
        .filter(Boolean);
    return [...new Set(parts)].join(' - ');
}

function inferOrderHowTo(data, creds) {
    const name = cleanOrderProductName(data.product_name);
    const source = `${data.product_name || ''} ${name} ${data.auth_type || ''} ${data.delivery_mode || ''} ${data.access_type || ''} ${data.duration_label || ''} ${Object.keys(creds || {}).join(' ')}`.toLowerCase();
    const hasLink = Boolean(creds && (creds.link || creds.activation_link || creds.invite_link));
    const hasLogin = Boolean(creds && (creds.email || creds.password));
    const hasOtp = Boolean(creds && creds.otp) || source.includes('otp');

    if (hasLink || source.includes('activation') || source.includes('invite') || source.includes('gemini')) {
        const steps = [
            'Copy the activation link from your credentials section.',
            'Open the link and sign in to the Google account where you want to use this subscription.',
            'Claim or activate the offer on the provider page. For Gemini-style offers, no payment method is required unless the provider changes the flow.',
            'Do not share the link after claiming it; most activation links work only once.',
            'If the link says expired or already used, contact support with this order number.'
        ];
        return { title: 'Activation / invite link', steps };
    }

    if (hasOtp || source.includes('number') || source.includes('phone')) {
        return {
            title: 'Number / OTP activation',
            steps: [
                'Use the mobile number or OTP details shown in your credentials section.',
                'Open the official app or website and continue the login or activation flow.',
                'Share OTPs only inside your GetOTTs order chat or official WhatsApp support.',
                'After activation, keep recovery details safe and avoid changing account security settings unless support says so.'
            ]
        };
    }

    if (hasLogin || source.includes('id pass') || source.includes('shared')) {
        return {
            title: 'Login details',
            steps: [
                `Open the official ${name} app or website.`,
                'Log in using the delivered email/ID and password.',
                'Use the delivered profile, slot, or PIN if one is shown.',
                'Do not change the password, recovery email, phone number, or plan settings.',
                'If login fails, send a screenshot and your order number to support.'
            ]
        };
    }

    return {
        title: 'Manual setup',
        steps: [
            'Keep this order page open and check the delivery status.',
            'If support needs your email, number, or OTP, share it only through order chat or official WhatsApp.',
            'Once delivered, follow the credentials shown above.',
            'Contact support with your order number if setup does not match the selected plan.'
        ]
    };
}

function renderOrderHowTo(data, creds) {
    const card = document.getElementById('orderHowToCard');
    const sub = document.getElementById('orderHowToSub');
    const list = document.getElementById('orderHowToSteps');
    const note = document.getElementById('orderHowToNote');
    if (!card || !sub || !list || !note) return;

    const guide = inferOrderHowTo(data, creds || {});
    const cleanName = cleanOrderProductName(data.product_name);
    sub.textContent = `${guide.title} for ${cleanName}`;
    list.innerHTML = '';
    guide.steps.forEach(step => {
        const li = document.createElement('li');
        li.textContent = step;
        list.appendChild(li);
    });
    note.textContent = 'Setup can vary by product, stock type, and platform rules. The credentials on this order page are the source of truth.';
    card.style.display = 'block';
}

function renderOrder(data) {
    document.getElementById('orderDetails').style.display = 'block';
    hideEl('orderHowToCard');

    // === ORDER INFO FIELDS ===
    setText('oNumber', data.order_number || '—');
    setText('oDate', formatDate(data.created_at));

    // Amount must match the order currency, not the browser's default currency.
    const amount = data.amount;
    setText('oAmount', amount != null ? orderMoney(amount, data.currency) : '—');

    // Payment status pill
    const payStatus = data.payment_status || 'pending';
    const payPill = document.getElementById('oPayment');
    if (payPill) {
        payPill.textContent = formatStatusLabel(payStatus);
        payPill.className = `order-status-pill ${payStatus}`;
    }

    // Delivery status pill
    const delStatus = data.delivery_status || 'pending';
    const delPill = document.getElementById('oDelivery');
    if (delPill) {
        delPill.textContent = formatStatusLabel(delStatus);
        delPill.className = `order-status-pill ${delStatus}`;
    }
    const motionStatus = delStatus === 'delivered'
        ? 'delivered'
        : (delStatus === 'action_required'
            ? 'action-required'
            : (payStatus === 'paid' ? 'paid' : (payStatus === 'failed' ? 'failed' : 'pending')));
    markOrderMotion(motionStatus);

    // === BANNER ===
    const banner = document.getElementById('orderBanner');
    const bannerIcon = document.getElementById('bannerIcon');
    const bannerTitle = document.getElementById('bannerTitle');
    const bannerSub = document.getElementById('bannerSub');

    if (delStatus === 'delivered') {
        banner.className = 'order-banner delivered';
        bannerIcon.innerHTML = '<i data-lucide="check-circle"></i>';
        bannerTitle.textContent = 'Order Delivered!';
        bannerSub.textContent = 'Your credentials are ready below';
        restartOrderMotion(banner, 'order-success-pop');
        
        // Celebration effect on first load of delivered order
        if (!localStorage.getItem('celeb_' + (data.order_number || data.id))) {
            if (window.confetti) {
                confetti({
                    particleCount: 150,
                    spread: 70,
                    origin: { y: 0.6 },
                    colors: ['#4f46e5', '#10b981', '#f59e0b']
                });
            }
            localStorage.setItem('celeb_' + (data.order_number || data.id), '1');
        }
    } else if (delStatus === 'action_required') {
        banner.className = 'order-banner action-required';
        bannerIcon.innerHTML = '<i data-lucide="alert-triangle"></i>';
        bannerTitle.textContent = 'OTP Required';
        bannerSub.textContent = 'Please check WhatsApp/Telegram to provide the login code';
        restartOrderMotion(banner, 'order-attention-pop');
    } else if (payStatus === 'paid') {
        banner.className = 'order-banner paid';
        bannerIcon.innerHTML = '<i data-lucide="credit-card"></i>';
        bannerTitle.textContent = 'Payment Confirmed';
        restartOrderMotion(banner, 'order-payment-pop');
        if (data.delivery_mode === 'manual') {
            bannerSub.textContent = 'Admin is setting up your account (Manual Delivery)';
        } else {
            bannerSub.textContent = 'Credentials are being prepared…';
        }
    } else if (payStatus === 'failed') {
        banner.className = 'order-banner failed';
        bannerIcon.innerHTML = '<i data-lucide="x-circle"></i>';
        bannerTitle.textContent = 'Payment Failed';
        bannerSub.textContent = 'Please try again or contact support';
        restartOrderMotion(banner, 'order-attention-pop');
    } else {
        banner.className = 'order-banner pending';
        bannerIcon.innerHTML = '<i data-lucide="clock"></i>';
        bannerTitle.textContent = 'Awaiting Payment';
        bannerSub.textContent = 'Complete your payment to receive credentials';
        restartOrderMotion(banner, 'order-pending-pop');
    }

    if (window.lucide) lucide.createIcons();

    // === CREDENTIALS OR AUTH LOCK ===
    const creds = data.credentials_delivered || data.credentials;
    renderOrderHowTo(data, creds || {});
    if (creds && Object.keys(creds).length > 0) {
        hideEl('authCard');
        showEl('credCard');
        hideEl('pendingCard');
        restartOrderMotion(document.getElementById('credCard'), 'credentials-revealed');

        const fields = [
            { id: 'credEmail', key: 'email', rowId: 'credEmailRow' },
            { id: 'credPassword', key: 'password', rowId: 'credPasswordRow' },
            { id: 'credLink', key: 'link', rowId: 'credLinkRow' },
            { id: 'credProfile', key: 'profile', rowId: 'credProfileRow' },
            { id: 'credPin', key: 'pin', rowId: 'credPinRow' },
            { id: 'credOtp', key: 'otp', rowId: 'credOtpRow' }
        ];

        fields.forEach(f => {
            const el = document.getElementById(f.id);
            const row = document.getElementById(f.rowId);
            const val = creds[f.key];

            if (el && row) {
                if (val) {
                    el.textContent = val;
                    row.style.display = 'block';
                } else {
                    row.style.display = 'none';
                }
            }
        });

        if (data.expires_at || creds.expires_at) {
            showEl('credExpiryRow');
            setText('credExpiry', formatDate(data.expires_at || creds.expires_at));
        }
    } else if (data.auth_required_for_creds) {
        showEl('authCard');
        hideEl('credCard');
        hideEl('pendingCard');
        restartOrderMotion(document.getElementById('authCard'), 'pending-card-live');
        
        // If order is delivered but auth required, show celebration if first time
        if (delStatus === 'delivered' && !localStorage.getItem('celeb_' + (data.order_number || data.id))) {
            if (window.confetti) {
                confetti({
                    particleCount: 150,
                    spread: 70,
                    origin: { y: 0.6 },
                    colors: ['#4f46e5', '#10b981', '#f59e0b']
                });
            }
            localStorage.setItem('celeb_' + (data.order_number || data.id), '1');
        }
    } else {
        hideEl('authCard');
        hideEl('credCard');
        showEl('pendingCard');
        restartOrderMotion(document.getElementById('pendingCard'), 'pending-card-live');

        // Update pending message based on status
        const pendingTitle = document.getElementById('pendingTitle');
        const pendingMsg = document.getElementById('pendingMsg');
        if (payStatus === 'paid' && data.delivery_mode === 'manual') {
            if (pendingTitle) pendingTitle.textContent = 'Manual Delivery In Progress';
            if (pendingMsg) pendingMsg.textContent = 'Payment confirmed. Admin is setting up this order manually. Use the contact button below if you need to send details or ask for an update.';
        } else if (payStatus === 'paid' && delStatus !== 'delivered') {
            if (pendingTitle) pendingTitle.textContent = 'Preparing Your Credentials';
            if (pendingMsg) pendingMsg.textContent = 'Payment confirmed. If this product is automatic, credentials will appear here as soon as inventory is assigned.';
        } else if (payStatus === 'pending') {
            if (pendingTitle) pendingTitle.textContent = 'Waiting for Payment';
            if (pendingMsg) pendingMsg.textContent = 'Complete your payment to continue. Automatic products show credentials here after confirmation; manual products are handled by admin.';
        }
    }

    // === TIMELINE ===
    const orderNum = data.order_number || '';
    setText('tlCreatedTime', formatDate(data.created_at));

    if (window.lucide) lucide.createIcons();

    // Created step is always done (has "done" in HTML by default)

    // Payment step
    const tlPaid = document.getElementById('tlPaid');
    const tlPaidSub = document.getElementById('tlPaidSub');
    if (payStatus === 'paid' || delStatus === 'delivered') {
        tlPaid.className = 'tl-item done';
        if (tlPaidSub) tlPaidSub.textContent = data.paid_at ? formatDate(data.paid_at) : 'Payment received';
    } else if (payStatus === 'failed') {
        tlPaid.className = 'tl-item';
        if (tlPaidSub) tlPaidSub.textContent = 'Payment failed — please retry';
    } else {
        tlPaid.className = 'tl-item active';
        if (tlPaidSub) tlPaidSub.textContent = 'Waiting for UPI confirmation';
    }

    // Delivered step
    const tlDelivered = document.getElementById('tlDelivered');
    const tlDeliveredSub = document.getElementById('tlDeliveredSub');
    if (delStatus === 'delivered') {
        tlDelivered.className = 'tl-item done';
        if (tlDeliveredSub) tlDeliveredSub.textContent = data.delivered_at ? formatDate(data.delivered_at) : 'Sent via email';
    }

    // === WHATSAPP LINKS — prefill order ID ===
    const waMsg = encodeURIComponent(`Hi, I need help with my order ${orderNum}`);
    const helpWaBtn = document.getElementById('helpWaBtn');
    if (helpWaBtn) helpWaBtn.href = `https://wa.me/919088212294?text=${waMsg}`;
    const pendingWaBtn = document.getElementById('pendingWaBtn');
    if (pendingWaBtn) pendingWaBtn.href = `https://wa.me/919088212294?text=${waMsg}`;

    if (window.lucide) lucide.createIcons();

    syncHelpCardVisibility();
}

function renderLocalOrder(order) {
    document.getElementById('orderDetails').style.display = 'block';
    hideEl('orderHowToCard');

    setText('oNumber', order.orderNumber || '—');
    setText('oDate', formatDate(order.date));
    setText('oAmount', order.amount != null ? orderMoney(order.amount, order.currency) : '—');

    const payPill = document.getElementById('oPayment');
    if (payPill) {
        payPill.textContent = 'Pending';
        payPill.className = 'order-status-pill pending';
    }

    const delPill = document.getElementById('oDelivery');
    if (delPill) {
        delPill.textContent = 'Pending';
        delPill.className = 'order-status-pill pending';
    }

    const banner = document.getElementById('orderBanner');
    banner.className = 'order-banner pending';
    document.getElementById('bannerIcon').innerHTML = '<i data-lucide="clock"></i>';
    document.getElementById('bannerTitle').textContent = 'Processing Order';
    document.getElementById('bannerSub').textContent = `${order.product || 'Your order'} — awaiting payment confirmation`;

    markOrderMotion('pending');
    restartOrderMotion(banner, 'order-pending-pop');
    hideEl('credCard');
    showEl('pendingCard');
    restartOrderMotion(document.getElementById('pendingCard'), 'pending-card-live');

    setText('tlCreatedTime', formatDate(order.date));
    document.getElementById('tlPaid').className = 'tl-item active';

    // WhatsApp prefill
    const waMsg = encodeURIComponent(`Hi, I need help with my order ${order.orderNumber}`);
    const helpWaBtn = document.getElementById('helpWaBtn');
    if (helpWaBtn) helpWaBtn.href = `https://wa.me/919088212294?text=${waMsg}`;
    const pendingWaBtn = document.getElementById('pendingWaBtn');
    if (pendingWaBtn) pendingWaBtn.href = `https://wa.me/919088212294?text=${waMsg}`;

    if (window.lucide) lucide.createIcons();
    syncHelpCardVisibility();
}

function showNotFound() {
    document.getElementById('orderNotFound').style.display = 'block';
}

function resetSearch() {
    document.getElementById('orderNotFound').style.display = 'none';
    document.getElementById('orderSearch').style.display = 'block';
    document.getElementById('orderInput').value = '';
    document.getElementById('orderInput').focus();
}

function copyText(elementId) {
    const text = document.getElementById(elementId).textContent;
    navigator.clipboard.writeText(text).then(() => {
        const btn = document.getElementById(elementId).parentElement.querySelector('.copy-btn');
        btn.innerHTML = '<span style="font-size:.75rem;color:var(--green-600)">✓ Copied</span>';
        setTimeout(() => {
            btn.innerHTML = '<i data-lucide="copy"></i>';
            if (window.lucide) lucide.createIcons();
        }, 2000);
    });
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function formatStatusLabel(status) {
    if (!status) return 'Unknown';
    return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');
}

// Helper functions
function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}
function showEl(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'block';
}
function hideEl(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
}
function syncHelpCardVisibility() {
    const helpCard = document.querySelector('.help-card');
    const pendingCard = document.getElementById('pendingCard');
    if (!helpCard || !pendingCard) return;
    helpCard.style.display = pendingCard.style.display === 'block' ? 'none' : 'block';
}
function openLiveChat() {
    if (window.LiveChat && typeof window.LiveChat.toggle === 'function') {
        window.LiveChat.toggle(true);
    } else {
        window.open('https://wa.me/919088212294?text=' + encodeURIComponent('Hi, I need help with my order.'), '_blank');
    }
}

function chatAboutOrder() {
    // Get the current order number from the page
    const orderNum = document.getElementById('oNumber')?.textContent?.trim();
    
    if (!orderNum) {
        window.open('https://wa.me/919088212294?text=' + encodeURIComponent('Hi, I need help with my order.'), '_blank');
        return;
    }

    const token = localStorage.getItem('GetOTTs_customer_token');
    if (!token) {
        window.open('https://wa.me/919088212294?text=' + encodeURIComponent(`Hi, I need help with my order ${orderNum}`), '_blank');
        return;
    }

    if (window.LiveChat && typeof window.LiveChat.openForOrder === 'function') {
        window.LiveChat.openForOrder(orderNum);
    } else {
        window.open('https://wa.me/919088212294?text=' + encodeURIComponent(`Hi, I need help with my order ${orderNum}`), '_blank');
    }
}

// === AUTH HELPERS ===
function triggerOrderAuth() {
    const authCard = document.getElementById('authCard');
    if (!authCard) return;

    authCard.innerHTML = `
        <div class="wa-auth-mini" style="max-width: 360px; margin: 0 auto;">
            <h3 style="color: #f8fafc; margin-bottom: 12px;">Verify Identity</h3>
            <p style="font-size: 0.9rem; color: #cbd5e1; margin-bottom: 20px;">We'll send a secure code to your WhatsApp to verify you're the owner.</p>
            
            <div class="auth-input-group" style="margin-bottom: 15px; text-align: left;">
                <label style="display: block; font-size: 0.75rem; font-weight: 700; color: #93a4ba; margin-bottom: 6px; text-transform: uppercase;">WhatsApp Number</label>
                <input type="tel" id="waOrderPhone" inputmode="tel" autocomplete="tel" placeholder="e.g. 9190882..." style="width: 100%; padding: 14px 15px; border: 1.5px solid #93c5fd; border-radius: 12px; font-size: 1rem; margin-bottom: 12px; outline: none; color:#0f172a; background:#fff;">
                <button class="btn btn-primary" id="waLoginBtn" onclick="startOrderWaAuth()" style="width: 100%; height: 48px; border-radius: 10px; background: #25D366; border: none; font-weight: 700;">
                     Verify with WhatsApp
                </button>
            </div>
            
            <div style="display: flex; align-items: center; gap: 10px; margin: 20px 0; color: #94a3b8;">
                <div style="flex: 1; height: 1px; background: rgba(148,163,184,.28);"></div>
                <span style="font-size: 0.7rem; font-weight: 600; text-transform: uppercase;">OR</span>
                <div style="flex: 1; height: 1px; background: rgba(148,163,184,.28);"></div>
            </div>
            
            <button class="btn btn-outline" onclick="startOrderEmailAuth()" style="width: 100%; height: 44px; border-radius: 10px; font-weight: 600;">
                Verify with Email
            </button>
        </div>
    `;
    
    // Focus input
    setTimeout(() => {
        const input = document.getElementById('waOrderPhone');
        if (input) input.focus();
    }, 100);

    if (window.lucide) lucide.createIcons();
}

function patchOrderWaAuthReturn() {
    if (!window.WA_AUTH || window.WA_AUTH._orderReturnPatched) return false;
    window.WA_AUTH._orderReturnPatched = true;
    window.WA_AUTH.onVerified = function(data) {
        clearInterval(WA_AUTH.pollTimer);
        clearInterval(WA_AUTH._countdownTimer);
        const customer = data.customer || {};
        const token = data.token || 'wa_' + Date.now();
        localStorage.setItem('GetOTTs_customer_token', token);
        localStorage.setItem('GetOTTs_customer', JSON.stringify({
            name: customer.name || 'Customer',
            phone: customer.phone || '',
            email: customer.email || '',
            email_verified: Boolean(customer.email && !String(customer.email).startsWith('wa_')),
            id: customer.id || '',
            login_method: 'whatsapp',
            logged_in_at: new Date().toISOString()
        }));
        const card = document.querySelector('.auth-card');
        if (card) {
            card.innerHTML = '<div class="wa-success"><div class="wa-success-check">OK</div><h2>Verified</h2><p>Refreshing your order details...</p></div>';
        }
        setTimeout(() => window.location.reload(), 450);
    };
    return true;
}

function waitForOrderWaAuth(callback, attempts = 0) {
    if (patchOrderWaAuthReturn()) {
        callback();
        return;
    }
    if (attempts >= 20) {
        const btn = document.getElementById('waLoginBtn');
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Verify with WhatsApp';
        }
        if (window.Toast) Toast.info('Still loading', 'Please tap Verify again in a moment.');
        return;
    }
    setTimeout(() => waitForOrderWaAuth(callback, attempts + 1), 100);
}

function startOrderWaAuth() {
    const phoneInput = document.getElementById('waOrderPhone');
    const phone = phoneInput ? phoneInput.value.trim() : '';
    const btn = document.getElementById('waLoginBtn');
    
    if (!phone) {
        if (window.Toast) Toast.error('Number Required', 'Please enter your WhatsApp number to verify.');
        else alert('Please enter your WhatsApp number.');
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Starting verification...';
    }

    waitForOrderWaAuth(() => {
        WA_AUTH.start(phone);
    });
}

function startOrderEmailAuth() {
    // Redirect to login page with return back to this order
    const currentUrl = window.location.href;
    window.location.href = `/login?redirect=${encodeURIComponent(currentUrl)}`;
}
