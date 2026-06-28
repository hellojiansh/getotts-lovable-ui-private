/* ============================================
   GetOTTs — Customer Dashboard Logic v2
   ============================================ */

const DASH_INR_PER_USD = 85;
const DASHBOARD_LOAD_GAP_MS = 0;
const DASHBOARD_FAST_TIMEOUT_MS = 8000;
let activeSubscriptionsTimer = null;
let activeSubscriptionsPromise = null;
let dashboardOrdersCache = [];
let dashboardOrdersPage = 1;
let dashboardWalletTxCache = [];
let dashboardWalletTxPage = 1;
let dashboardSubscriptionsCache = { active: [], expiringSoon: [], expired: [] };
let dashboardSubscriptionsPage = { active: 1, expiringSoon: 1, expired: 1 };
const DASHBOARD_ORDERS_PER_PAGE = 10;
const DASHBOARD_LIST_PER_PAGE = 10;
const dashboardInFlight = {};
const dashboardLastLoadedAt = {};

function dashCacheKey(name) {
    const user = JSON.parse(localStorage.getItem('GetOTTs_customer') || '{}');
    return `getotts_dash_${name}_${user.id || user.email || user.phone || 'guest'}`;
}

function dashReadCache(name, maxAgeMs = 10 * 60 * 1000) {
    try {
        const cached = JSON.parse(localStorage.getItem(dashCacheKey(name)) || 'null');
        if (!cached || !cached.savedAt || Date.now() - cached.savedAt > maxAgeMs) return null;
        return cached.data;
    } catch (e) {
        return null;
    }
}

function dashWriteCache(name, data) {
    try {
        localStorage.setItem(dashCacheKey(name), JSON.stringify({ savedAt: Date.now(), data }));
    } catch (e) {}
}

function dashFetch(url, options = {}, timeoutMs = DASHBOARD_FAST_TIMEOUT_MS) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const headers = options.headers || {};
    return fetch(url, { ...options, headers, signal: controller.signal }).finally(() => clearTimeout(timeout));
}

function dashRequestOnce(key, loader, minGapMs = 10000) {
    const now = Date.now();
    if (dashboardInFlight[key]) return dashboardInFlight[key];
    if (dashboardLastLoadedAt[key] && now - dashboardLastLoadedAt[key] < minGapMs) {
        return Promise.resolve();
    }
    dashboardInFlight[key] = Promise.resolve()
        .then(loader)
        .finally(() => {
            dashboardLastLoadedAt[key] = Date.now();
            dashboardInFlight[key] = null;
        });
    return dashboardInFlight[key];
}

function dashCurrentCurrency() {
    if (typeof getCurrentCurrency === 'function') return getCurrentCurrency();
    return sessionStorage.getItem('getotts_currency') || localStorage.getItem('getotts_currency') || 'INR';
}

function dashMoney(valueInr, valueUsd) {
    const currency = dashCurrentCurrency();
    if (currency === 'USD') {
        const usd = valueUsd !== undefined && valueUsd !== null && valueUsd !== ''
            ? Number(valueUsd) || 0
            : 0;
        return `$${usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `₹${(Number(valueInr) || 0).toLocaleString('en-IN')}`;
}

function dashSingleMoney(value, currency) {
    const amount = Number(value) || 0;
    return String(currency).toUpperCase() === 'USD'
        ? `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : `₹${amount.toLocaleString('en-IN')}`;
}

function dashParseMetadata(raw) {
    if (!raw) return {};
    if (typeof raw === 'object') return raw;
    try {
        return JSON.parse(raw);
    } catch (e) {
        return {};
    }
}

function dashOrderCurrency(order = {}) {
    const meta = dashParseMetadata(order.metadata);
    const firstItem = Array.isArray(meta.items) && meta.items[0] && typeof meta.items[0] === 'object'
        ? meta.items[0]
        : {};
    const rawCurrency = order.currency || meta.wallet_currency || firstItem.currency || 'INR';
    return String(rawCurrency).toUpperCase() === 'USD' ? 'USD' : 'INR';
}

function dashOrderAmount(order = {}) {
    const meta = dashParseMetadata(order.metadata);
    if (meta.server_price !== undefined && meta.server_price !== null && meta.server_price !== '') {
        return meta.server_price;
    }
    return order.amount || 0;
}

function dashOrderMoney(order = {}) {
    return dashSingleMoney(dashOrderAmount(order), dashOrderCurrency(order));
}

function dashSleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

document.addEventListener('DOMContentLoaded', () => {
    if (window.lucide) lucide.createIcons();
    
    // Auth Check
    const token = localStorage.getItem('GetOTTs_customer_token');
    const user = JSON.parse(localStorage.getItem('GetOTTs_customer'));
    
    if(!token || !user) {
        window.location.href = 'login';
        return;
    }
    
    // Resolve display name
    let displayName = user.name || 'User';
    
    // Detect and filter WhatsApp LIDs (15+ digit internal IDs, not real phone numbers)
    let rawPhone = user.phone || '';
    const cleanDigits = rawPhone.replace(/\D/g, '');
    const isLID = cleanDigits.length > 13; // Real phone numbers are max 13 digits (with country code)
    if (isLID) rawPhone = ''; // Discard LID
    
    if (displayName.startsWith('WA-User-') || (isLID && displayName === cleanDigits)) {
        displayName = rawPhone ? rawPhone : (user.name && !user.name.startsWith('WA-User-') ? user.name : 'Customer');
    }
    
    // Format phone for display
    let displayPhone = rawPhone;
    if (displayPhone && displayPhone.length > 6) {
        const clean = displayPhone.replace(/\D/g, '');
        if (clean.length === 12) {
            displayPhone = `+${clean.slice(0,2)} ${clean.slice(2,7)} ${clean.slice(7)}`;
        } else if (clean.length === 11) {
            displayPhone = `+${clean.slice(0,1)} ${clean.slice(1,6)} ${clean.slice(6)}`;
        } else {
            // Leave as is or just add + if missing for long numbers
            displayPhone = (displayPhone.startsWith('+') || clean.length < 10) ? displayPhone : '+' + displayPhone;
        }
    }
    
    // Resolve email
    const displayEmail = (!user.email || user.email.startsWith('wa_')) ? '' : user.email;
    window.GETOTTS_USER_EMAIL = displayEmail;
    
    // Header
    document.getElementById('headerName').textContent = displayName;
    
    // Sidebar Profile
    document.getElementById('profileName').textContent = displayName;
    const phoneEl = document.getElementById('profilePhone');
    if (phoneEl) phoneEl.textContent = displayPhone || '';
    const emailEl = document.getElementById('profileEmail');
    if (emailEl) emailEl.textContent = displayEmail || 'No email added';

    const currentEmailDisplay = document.getElementById('currentEmailDisplay');
    if (currentEmailDisplay) currentEmailDisplay.textContent = displayEmail || 'No email added';
    
    // Welcome Message
    const welcomeEl = document.getElementById('welcomeMsg');
    if (welcomeEl) {
        const hour = new Date().getHours();
        let greeting = 'Good evening';
        if (hour < 12) greeting = 'Good morning';
        else if (hour < 17) greeting = 'Good afternoon';
        welcomeEl.textContent = `${greeting}, ${displayName.split(' ')[0]}! 👋`;
    }
    
    // Profile Tab
    const profilePhoneInput = document.getElementById('profilePhoneInput');
    if (profilePhoneInput) profilePhoneInput.textContent = displayPhone || 'Not available';
    
    const profileEmailInput = document.getElementById('profileEmailInput');
    if (profileEmailInput) profileEmailInput.value = displayEmail;
    
    const profileNameInput = document.getElementById('profileNameInput');
    if (profileNameInput) profileNameInput.value = displayName;
    
    // Referral link — use the actual referral_code from DB, or generate a stable one
    const refCode = user.referral_code || btoa(user.email || user.phone || 'USER').slice(0, 8).toUpperCase();
    const refLinkEl = document.getElementById('refLink');
    if (refLinkEl) refLinkEl.value = `${window.location.origin}/register?ref=${refCode}`;
    
    // Show skeleton loading states immediately
    showSkeletons();
    renderCachedDashboard(user);
    
    // Fire ALL data loaders in parallel — don't wait for one to finish before starting another
    applyStoredReferral(user);
    runDashboardLoadersFast(user.id).then(() => {
        if (window.lucide) lucide.createIcons();
    });

    const initialTab = window.location.pathname.replace(/\/+$/, '') === '/wallet'
        ? 'wallet'
        : (window.location.hash || '').replace('#', '');
    if (initialTab && document.getElementById('tab-' + initialTab)) {
        switchTab(initialTab);
    }
});

async function applyStoredReferral(user) {
    const referralCode = (localStorage.getItem('GetOTTs_referral_code') || '').trim().toUpperCase();
    if (!referralCode || !user || !user.id || user._referralApplyTried === referralCode) return;
    user._referralApplyTried = referralCode;
    localStorage.setItem('GetOTTs_customer', JSON.stringify(user));

    const API_BASE = (window.GETOTTS_CONFIG && window.GETOTTS_CONFIG.API_BASE) || 'https://api.getotts.com/api/v1';
    try {
        const res = await dashFetch(`${API_BASE}/customers/apply-referral`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ customer_id: user.id, referral_code: referralCode }),
        }, 8000);
        const data = await res.json().catch(() => ({}));
        if (data.success) {
            localStorage.removeItem('GetOTTs_referral_code');
            dashboardLastLoadedAt.referrals = 0;
            await loadReferralData(user.id);
        }
    } catch (e) {
        console.warn('[REFERRAL] Could not apply stored referral yet:', e);
    }
}

function renderCachedDashboard(user) {
    const cachedOrders = dashReadCache('orders');
    if (cachedOrders && Array.isArray(cachedOrders)) {
        renderDashboardOrders(cachedOrders);
    }

    const cachedWallet = dashReadCache('wallet');
    if (cachedWallet) {
        renderWalletBalance(cachedWallet.balance);
        renderWalletTransactions(cachedWallet.history);
    }

    const cachedReferrals = dashReadCache('referrals');
    if (cachedReferrals) {
        renderReferralData(cachedReferrals);
    }
}

async function runDashboardLoadersFast(customerId) {
    await Promise.allSettled([
        loadDashboardData(customerId),
        loadReferralData(customerId),
        loadWalletHistory()
    ]);
}

async function logoutCustomer() {
    const C = window.GETOTTS_CONFIG;
    if (C && C.SUPABASE_URL && C.SUPABASE_ANON_KEY && window.supabase) {
        try {
            const sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);
            await sb.auth.signOut();
        } catch(e) { /* ignore */ }
    }
    localStorage.removeItem('GetOTTs_customer_token');
    localStorage.removeItem('GetOTTs_customer');
    window.location.href = 'login';
}

function switchTab(tabId) {
    document.querySelectorAll('.dash-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    
    document.getElementById('tab-' + tabId).classList.add('active');
    const navBtn = document.querySelector(`[data-tab="${tabId}"]`);
    if (navBtn) navBtn.classList.add('active');

    if (tabId === 'subscriptions') {
        renderActiveSubscriptionsFromOrders();
        const user = JSON.parse(localStorage.getItem('GetOTTs_customer') || '{}');
        const email = window.GETOTTS_USER_EMAIL || user.email || '';
        if (email && !email.startsWith('wa_')) loadActiveSubscriptions(email);
    }
    if (tabId === 'wallet') {
        loadWalletHistory();
    }
    
    // Re-render icons for the newly visible tab
    setTimeout(() => { if (window.lucide) lucide.createIcons(); }, 50);
}

function showSkeletons() {
    const shimmer = 'background:linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%);background-size:200% 100%;animation:shimmer 1.5s infinite;border-radius:8px;';
    // Inject shimmer keyframes once
    if (!document.getElementById('shimmerStyle')) {
        const s = document.createElement('style');
        s.id = 'shimmerStyle';
        s.textContent = '@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}';
        document.head.appendChild(s);
    }
    const bar = (w, h) => `<div style="${shimmer}width:${w};height:${h || '16px'};margin-bottom:8px;"></div>`;
    // Wallet transaction list skeleton
    const txList = document.getElementById('walletTxList');
    if (txList) txList.innerHTML = [1,2,3].map(() => `
        <div style="display:flex;justify-content:space-between;padding:14px 0;border-bottom:1px solid #f1f5f9;">
            <div style="flex:1">${bar('60%','14px')}${bar('40%','10px')}</div>
            <div>${bar('70px','16px')}</div>
        </div>`).join('');
    // Recent orders skeleton
    const recent = document.getElementById('recentOrdersBody');
    if (recent) recent.innerHTML = [1,2,3].map(() => `
        <div style="padding:18px 0;border-bottom:1px solid #f1f5f9;display:flex;justify-content:space-between;">
            <div style="flex:1">${bar('50%','16px')}${bar('30%','12px')}</div>
            <div>${bar('60px','20px')}</div>
        </div>`).join('');
}

function buildDashOrderRow(o) {
    const paymentStatus = String(o.paymentStatus || 'PENDING').toUpperCase();
    const deliveryStatus = String(o.deliveryStatus || 'PENDING').toUpperCase();
    const paymentLabel = dashStatusLabel(paymentStatus);
    const deliveryLabel = dashStatusLabel(deliveryStatus);
    const isIssueEligible = !['CANCELLED', 'REFUNDED', 'FAILED'].includes(paymentStatus);
    return `
        <div class="dash-order-row">
            <div class="dash-order-main">
                <div class="dash-order-info">
                    <div class="dash-order-title-row">
                        <span class="dash-order-emoji">${o.productEmoji || '&#128230;'}</span>
                        <span class="dash-order-title">${o.product || 'Subscription Order'}</span>
                        <span class="dash-mode-pill">${String(o.deliveryMode || 'automatic').toUpperCase()}</span>
                    </div>
                    <div class="dash-order-meta">
                        <a href="order?id=${o.orderNumber}" class="dash-order-id">${o.orderNumber || ''}</a>
                        <span style="color:var(--gray-400);">•</span>
                        <span class="dash-order-date">${o.date ? new Date(o.date).toLocaleDateString('en-IN', {day:'numeric', month:'short'}) : 'Date N/A'}</span>
                    </div>
                </div>
                <div class="dash-order-side">
                    <div class="dash-order-amount">${dashOrderMoney(o)}</div>
                    <div class="dash-status-stack">
                        <span class="dash-status-pill dash-status-${paymentStatus.toLowerCase().replace(/_/g, '-')}">${paymentLabel}</span>
                        <span class="dash-status-pill dash-status-${deliveryStatus.toLowerCase().replace(/_/g, '-')}">${deliveryLabel}</span>
                    </div>
                </div>
            </div>
            <div class="dash-order-actions">
                <a href="order?id=${o.orderNumber}" class="dash-detail-link">
                    <i data-lucide="external-link" style="width:12px; height:12px;"></i> Details
                </a>
                <button onclick="dashChatAboutOrder('${o.orderNumber}')" class="dash-chat-btn">
                    <i data-lucide="message-circle" style="width:13px; height:13px;"></i> Support
                </button>
                ${isIssueEligible ? `
                <details class="dash-manage-menu">
                    <summary>Manage</summary>
                    <div>
                        <button onclick="dashOpenOrderIssue('${o.orderNumber}', 'Refund')" class="dash-check-btn">
                            <i data-lucide="undo-2" style="width:13px; height:13px;"></i> Refund
                        </button>
                        <button onclick="dashOpenOrderIssue('${o.orderNumber}', 'Dispute')" class="dash-check-btn">
                            <i data-lucide="shield-alert" style="width:13px; height:13px;"></i> Dispute
                        </button>
                    </div>
                </details>` : ''}
            </div>
        </div>`;
}

function dashStatusLabel(status) {
    const labels = {
        PAID: 'Paid',
        DELIVERED: 'Delivered',
        PENDING: 'Pending',
        ACTION_REQUIRED: 'Action needed',
        CANCELLED: 'Cancelled',
        CANCELED: 'Cancelled',
        REFUNDED: 'Refunded',
        FAILED: 'Failed',
        PROCESSING: 'Processing',
        MANUAL: 'Manual',
    };
    return labels[status] || String(status || '').toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function updateOverviewInsights(orders = dashboardOrdersCache) {
    const list = Array.isArray(orders) ? orders : [];
    const active = list.filter(dashIsActiveOrderSubscription);
    const now = Date.now();
    const weekMs = 7 * 86400000;
    const expiring = active.filter(o => {
        const expires = o.expiresAt || o.expires_at;
        if (!expires) return false;
        const t = new Date(expires).getTime();
        return !Number.isNaN(t) && t >= now && t <= now + weekMs;
    });
    const pending = list.filter(o => String(o.paymentStatus || '').toUpperCase() === 'PENDING').length;

    const summary = document.getElementById('wbInsightSummary');
    if (summary) {
        summary.textContent = expiring.length
            ? `${expiring.length} subscription${expiring.length === 1 ? '' : 's'} renewing this week`
            : `${active.length} active subscription${active.length === 1 ? '' : 's'} protected`;
    }

    const activeEl = document.getElementById('wbActiveCount');
    if (activeEl) activeEl.textContent = `${active.length} active`;
    const expiringEl = document.getElementById('wbExpiringCount');
    if (expiringEl) expiringEl.textContent = `${expiring.length} expiring`;
    const pendingEl = document.getElementById('wbPendingCount');
    if (pendingEl) pendingEl.textContent = `${pending} pending`;
}

function renderDashboardOrders(displayOrders) {
    dashboardOrdersCache = Array.isArray(displayOrders) ? displayOrders : [];
    const totalPages = Math.max(1, Math.ceil(dashboardOrdersCache.length / DASHBOARD_ORDERS_PER_PAGE));
    dashboardOrdersPage = Math.min(Math.max(1, dashboardOrdersPage), totalPages);

    const statOrders = document.getElementById('statOrders');
    if (statOrders) statOrders.textContent = dashboardOrdersCache.length;

    const activeCount = dashboardOrdersCache.filter(dashIsActiveOrderSubscription).length;
    const statActive = document.getElementById('statActive');
    if (statActive) statActive.textContent = activeCount;
    updateOverviewInsights(dashboardOrdersCache);

    const emptyState = `
        <div class="empty-state">
            <i data-lucide="package-open"></i>
            <p>No orders yet</p>
        </div>`;
    const recentBody = document.getElementById('recentOrdersBody');
    const ordersPanel = document.getElementById('ordersPanel');

    if (!dashboardOrdersCache.length) {
        if (recentBody) recentBody.innerHTML = emptyState;
        if (ordersPanel) ordersPanel.innerHTML = `<div class="panel-body">${emptyState}</div>`;
        if (window.lucide) lucide.createIcons();
        return;
    }

    if (recentBody) recentBody.innerHTML = dashboardOrdersCache.slice(0, 5).map(buildDashOrderRow).join('');
    if (ordersPanel) {
        const start = (dashboardOrdersPage - 1) * DASHBOARD_ORDERS_PER_PAGE;
        const pageOrders = dashboardOrdersCache.slice(start, start + DASHBOARD_ORDERS_PER_PAGE);
        const rangeStart = start + 1;
        const rangeEnd = Math.min(start + DASHBOARD_ORDERS_PER_PAGE, dashboardOrdersCache.length);
        const pagination = totalPages > 1 ? `
            <div class="dash-pagination">
                <div class="dash-pagination-info">Showing ${rangeStart}-${rangeEnd} of ${dashboardOrdersCache.length}</div>
                <div class="dash-pagination-controls">
                    <button class="btn btn-outline btn-sm" onclick="changeOrdersPage(${dashboardOrdersPage - 1})" ${dashboardOrdersPage <= 1 ? 'disabled' : ''}>Previous</button>
                    <span class="dash-page-pill">Page ${dashboardOrdersPage} / ${totalPages}</span>
                    <button class="btn btn-outline btn-sm" onclick="changeOrdersPage(${dashboardOrdersPage + 1})" ${dashboardOrdersPage >= totalPages ? 'disabled' : ''}>Next</button>
                </div>
            </div>` : '';
        ordersPanel.innerHTML = `<div class="panel-body">${pageOrders.map(buildDashOrderRow).join('')}${pagination}</div>`;
    }
    if (window.lucide) lucide.createIcons();
}

window.changeOrdersPage = function(page) {
    const totalPages = Math.max(1, Math.ceil(dashboardOrdersCache.length / DASHBOARD_ORDERS_PER_PAGE));
    dashboardOrdersPage = Math.min(Math.max(1, Number(page) || 1), totalPages);
    renderDashboardOrders(dashboardOrdersCache);
};

function dashPaginationHtml(totalItems, page, perPage, changeFnName) {
    const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
    if (totalPages <= 1) return '';
    const start = (page - 1) * perPage;
    const rangeStart = start + 1;
    const rangeEnd = Math.min(start + perPage, totalItems);
    return `
        <div class="dash-pagination">
            <div class="dash-pagination-info">Showing ${rangeStart}-${rangeEnd} of ${totalItems}</div>
            <div class="dash-pagination-controls">
                <button class="btn btn-outline btn-sm" onclick="${changeFnName}(${page - 1})" ${page <= 1 ? 'disabled' : ''}>Previous</button>
                <span class="dash-page-pill">Page ${page} / ${totalPages}</span>
                <button class="btn btn-outline btn-sm" onclick="${changeFnName}(${page + 1})" ${page >= totalPages ? 'disabled' : ''}>Next</button>
            </div>
        </div>`;
}

function renderWalletBalance(balanceData = {}) {
    const walletDisplay = dashMoney(balanceData.wallet_balance, balanceData.wallet_balance_usd);
    const wa = document.getElementById('walletAmount');
    const sw = document.getElementById('statWallet');
    const hw = document.getElementById('headerWallet');
    if (wa) wa.textContent = walletDisplay;
    if (sw) sw.textContent = walletDisplay;
    if (hw) hw.textContent = walletDisplay;
}

function renderWalletTransactions(history = []) {
    const listEl = document.getElementById('walletTxList');
    if (!listEl) return;
    dashboardWalletTxCache = Array.isArray(history) ? history : [];
    const totalPages = Math.max(1, Math.ceil(dashboardWalletTxCache.length / DASHBOARD_LIST_PER_PAGE));
    dashboardWalletTxPage = Math.min(Math.max(1, dashboardWalletTxPage), totalPages);

    if (!dashboardWalletTxCache.length) {
        listEl.innerHTML = `
            <div class="empty-state">
                <i data-lucide="receipt"></i>
                <p>No transactions yet</p>
            </div>`;
    } else {
        const start = (dashboardWalletTxPage - 1) * DASHBOARD_LIST_PER_PAGE;
        const pageItems = dashboardWalletTxCache.slice(start, start + DASHBOARD_LIST_PER_PAGE);
        listEl.innerHTML = pageItems.map(tx => `
            <div class="dash-tx-row">
                <div class="dash-tx-info">
                    <div class="dash-tx-title">${tx.description}</div>
                    <div class="dash-tx-date">${new Date(tx.created_at).toLocaleDateString('en-IN', {day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'})}</div>
                </div>
                <span class="dash-tx-amount ${tx.type === 'credit' ? 'dash-tx-credit' : 'dash-tx-debit'}">
                    ${tx.type === 'credit' ? '+' : '-'}${dashSingleMoney(tx.amount || 0, tx.currency || 'INR')}
                </span>
            </div>`).join('') + dashPaginationHtml(dashboardWalletTxCache.length, dashboardWalletTxPage, DASHBOARD_LIST_PER_PAGE, 'changeWalletTxPage');
    }
    if (window.lucide) lucide.createIcons();
}

window.changeWalletTxPage = function(page) {
    const totalPages = Math.max(1, Math.ceil(dashboardWalletTxCache.length / DASHBOARD_LIST_PER_PAGE));
    dashboardWalletTxPage = Math.min(Math.max(1, Number(page) || 1), totalPages);
    renderWalletTransactions(dashboardWalletTxCache);
};

function renderReferralData(data = {}) {
    const statRef = document.getElementById('statReferrals');
    if (statRef) statRef.textContent = data.referral_count || 0;

    const referralsPanel = document.querySelector('#tab-referral .panel:last-child .panel-body');
    if (referralsPanel && data.referrals && data.referrals.length > 0) {
        referralsPanel.innerHTML = data.referrals.map(r => `
            <div style="display:flex; align-items:center; justify-content:space-between; padding:12px 0; border-bottom:1px solid #f1f5f9;">
                <div>
                    <div style="font-weight:600; color:var(--gray-800);">${r.name || 'Customer'}</div>
                    <div style="font-size:.8rem; color:var(--gray-500);">Joined ${new Date(r.created_at).toLocaleDateString('en-IN', {day:'numeric', month:'short', year:'numeric'})}</div>
                </div>
                <span style="display:inline-block; background:#dcfce7; color:#15803d; padding:3px 10px; border-radius:100px; font-size:.72rem; font-weight:700;">
                    +${dashMoney(50)} Credit
                </span>
            </div>`).join('');
    }

    if (data.wallet_balance !== undefined) {
        renderWalletBalance({ wallet_balance: data.wallet_balance, wallet_balance_usd: data.wallet_balance_usd });
    }
}

function dashIsActiveOrderSubscription(order) {
    if (!order) return false;
    const payment = String(order.paymentStatus || order.payment_status || '').toUpperCase();
    const delivery = String(order.deliveryStatus || order.delivery_status || '').toUpperCase();
    if (payment !== 'PAID' || delivery !== 'DELIVERED') return false;
    const expires = order.expiresAt || order.expires_at;
    if (!expires) return true;
    const expiry = new Date(expires).getTime();
    return Number.isNaN(expiry) || expiry >= Date.now();
}

function dashIsExpiredOrderSubscription(order) {
    if (!order) return false;
    const payment = String(order.paymentStatus || order.payment_status || '').toUpperCase();
    const delivery = String(order.deliveryStatus || order.delivery_status || '').toUpperCase();
    if (payment !== 'PAID' || delivery !== 'DELIVERED') return false;
    const expires = order.expiresAt || order.expires_at;
    if (!expires) return false;
    const expiry = new Date(expires).getTime();
    return !Number.isNaN(expiry) && expiry < Date.now();
}

function dashOrderToSubscription(order) {
    const creds = order.creds || order.credentials || order.credentials_delivered || {};
    const expiresAt = order.expiresAt || order.expires_at || '';
    let validity = 'active';
    if (expiresAt) {
        const expiry = new Date(expiresAt).getTime();
        const daysLeft = Math.ceil((expiry - Date.now()) / 86400000);
        if (!Number.isNaN(daysLeft) && daysLeft < 0) validity = 'expired';
        else if (!Number.isNaN(daysLeft) && daysLeft <= 7) validity = 'expiring_soon';
    }
    return {
        order_number: order.orderNumber || order.order_number,
        product_name: order.product || order.product_name || 'Subscription',
        product_emoji: order.productEmoji || order.product_emoji || '📦',
        product_img: order.productImg || order.product_img || order.img_url || '',
        purchased_at: order.date || order.created_at,
        delivered_at: order.deliveredAt || order.delivered_at,
        expires_at: expiresAt,
        validity_status: validity,
        credentials: creds && typeof creds === 'object' ? creds : {}
    };
}

function dashNormalizeSubscriptionGroups(products = []) {
    const groups = { active: [], expiringSoon: [], expired: [] };
    (Array.isArray(products) ? products : []).forEach(p => {
        const expires = p.expires_at || p.expiresAt;
        const explicit = String(p.validity_status || '').toLowerCase();
        const expiry = expires ? new Date(expires).getTime() : NaN;
        const isExpired = explicit === 'expired' || (!Number.isNaN(expiry) && expiry < Date.now());
        const daysLeft = Number.isNaN(expiry) ? NaN : Math.ceil((expiry - Date.now()) / 86400000);
        const isExpiringSoon = !isExpired && (explicit === 'expiring_soon' || (!Number.isNaN(daysLeft) && daysLeft <= 7));
        const bucket = isExpired ? 'expired' : (isExpiringSoon ? 'expiringSoon' : 'active');
        groups[bucket].push({
            ...p,
            validity_status: isExpired ? 'expired' : (isExpiringSoon ? 'expiring_soon' : (p.validity_status || 'active'))
        });
    });
    return groups;
}

function dashExpiredSubscriptionsFromOrders() {
    return dashboardOrdersCache
        .filter(dashIsExpiredOrderSubscription)
        .map(dashOrderToSubscription);
}

function dashSubscriptionKey(p) {
    return String(p.order_number || p.orderNumber || `${p.product_name || p.product || ''}-${p.purchased_at || p.date || ''}`);
}

function dashUniqueSubscriptions(items) {
    const seen = new Set();
    return (Array.isArray(items) ? items : []).filter(item => {
        const key = dashSubscriptionKey(item);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function dashEscapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function dashJsArg(value) {
    return `'${String(value ?? '')
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/\r?\n/g, '\\n')
        .replace(/</g, '\\u003c')}'`;
}

function dashDateShort(value, fallback = '-') {
    if (!value) return fallback;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return fallback;
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function dashDaysUntil(value) {
    if (!value) return '';
    const expiry = new Date(value).getTime();
    if (Number.isNaN(expiry)) return '';
    const days = Math.ceil((expiry - Date.now()) / 86400000);
    if (days < 0) return `Expired ${Math.abs(days)}d ago`;
    if (days === 0) return 'Expires today';
    if (days === 1) return '1 day left';
    return `${days} days left`;
}

function dashPlanType(product) {
    const text = `${product?.plan_type || ''} ${product?.account_type || ''} ${product?.product_name || ''}`.toLowerCase();
    if (text.includes('shared')) return 'Shared';
    if (text.includes('personal')) return 'Personal';
    return '';
}

function dashSubscriptionCard(p, key) {
    const validityConfig = {
        active:        { label: 'Active',         color: '#10B981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.2)' },
        expiring_soon: { label: 'Expiring Soon',  color: '#F59E0B', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.2)' },
        expired:       { label: 'Expired',        color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.2)' },
        unknown:       { label: 'Active',         color: '#6B7280', bg: 'rgba(107,114,128,0.1)', border: 'rgba(107,114,128,0.2)' },
    };
    const vc = validityConfig[p.validity_status] || validityConfig.unknown;
    const creds = p.credentials && typeof p.credentials === 'object' ? p.credentials : {};
    const hasCreds = Object.keys(creds).length > 0;
    const purchasedDate = dashDateShort(p.purchased_at);
    const expiresDate = dashDateShort(p.expires_at, '');
    const daysLeft = dashDaysUntil(p.expires_at);
    const planType = dashPlanType(p);
    const logoSrc = dashProductLogoSrc(p);
    const productIcon = logoSrc
        ? `<img src="${dashEscapeHtml(logoSrc)}" alt="${dashEscapeHtml(p.product_name || 'Subscription')}" class="dash-sub-logo">`
        : `<span class="dash-sub-emoji">${dashEscapeHtml(p.product_emoji || '📦')}</span>`;
    const safeKey = String(key).replace(/[^a-z0-9_-]/gi, '-');
    const safeProductName = dashEscapeHtml(p.product_name || 'Subscription');
    const productMeta = [
        `Ordered ${purchasedDate}`,
        p.expires_at ? `${vc.label === 'Expired' ? 'Expired' : 'Expires'} ${expiresDate}` : '',
        daysLeft,
        planType
    ].filter(Boolean).map(item => `<span>${dashEscapeHtml(item)}</span>`).join('');
    const credRows = hasCreds ? Object.entries(creds).map(([k, v], idx) => {
        const fieldKey = `${safeKey}-${idx}`;
        return `
        <div class="dash-cred-row">
            <span>${dashEscapeHtml(k)}</span>
            <div>
                <code class="cred-value-${fieldKey}">${dashEscapeHtml(v)}</code>
                <button onclick="toggleRevealDash('${fieldKey}')" id="reveal-btn-dash-${fieldKey}" class="dash-view-mini" aria-label="Show or hide ${dashEscapeHtml(k)}" type="button">
                    <i data-lucide="eye"></i>
                </button>
                <button onclick="copyToClipboard(${dashJsArg(v)})" class="dash-copy-mini" aria-label="Copy ${dashEscapeHtml(k)}" type="button"><i data-lucide="copy"></i></button>
            </div>
        </div>`;
    }).join('') : '<div class="dash-cred-empty">Credentials are encrypted and will appear here once delivered.</div>';

    return `
        <div class="dash-sub-card dash-sub-card-${dashEscapeHtml(p.validity_status || 'active')}">
            <div class="dash-sub-head">
                <div class="dash-sub-product">
                    ${productIcon}
                    <div>
                        <h4>${safeProductName}</h4>
                        <div class="dash-sub-meta">${productMeta}</div>
                    </div>
                </div>
                <span class="dash-sub-status" style="background:${vc.bg}; color:${vc.color}; border-color:${vc.border};">${vc.label}</span>
            </div>
            <div class="dash-cred-box">
                <div class="dash-cred-title">
                    <span><i data-lucide="shield-check"></i> Secure credentials</span>
                    <small>Encrypted until reveal</small>
                </div>
                ${credRows}
            </div>
        </div>`;
}

function renderSubscriptionSection(title, icon, statusKey, items, emptyText) {
    const page = dashboardSubscriptionsPage[statusKey] || 1;
    const totalPages = Math.max(1, Math.ceil(items.length / DASHBOARD_LIST_PER_PAGE));
    dashboardSubscriptionsPage[statusKey] = Math.min(Math.max(1, page), totalPages);
    const safePage = dashboardSubscriptionsPage[statusKey];
    const start = (safePage - 1) * DASHBOARD_LIST_PER_PAGE;
    const pageItems = items.slice(start, start + DASHBOARD_LIST_PER_PAGE);
    const body = items.length
        ? pageItems.map((p, i) => dashSubscriptionCard(p, `${statusKey}-${start + i}`)).join('') + dashPaginationHtml(items.length, safePage, DASHBOARD_LIST_PER_PAGE, `changeSubscriptionPage.bind(null, '${statusKey}')`)
        : `<div class="empty-state dash-sub-empty"><i data-lucide="${icon}"></i><p>${emptyText}</p></div>`;
    return `
        <section class="dash-sub-section">
            <div class="dash-sub-section-head">
                <h3><i data-lucide="${icon}"></i> ${title}</h3>
                <span>${items.length}</span>
            </div>
            ${body}
        </section>`;
}

function dashRenderSubscriptionSections() {
    const active = dashboardSubscriptionsCache.active || [];
    const expiringSoon = dashboardSubscriptionsCache.expiringSoon || [];
    const expired = dashboardSubscriptionsCache.expired || [];
    return [
        renderSubscriptionSection('Active', 'shield-check', 'active', active, 'No active subscriptions right now.'),
        expiringSoon.length ? renderSubscriptionSection('Expiring Soon', 'calendar-clock', 'expiringSoon', expiringSoon, 'No subscriptions expiring soon.') : '',
        renderSubscriptionSection('Expired', 'history', 'expired', expired, 'No expired subscriptions yet.')
    ].join('');
}

function renderSubscriptionsSplit(products, activeBody, email = '') {
    if (!activeBody) return;
    activeBody.dataset.readyHint = '1';
    const incoming = dashNormalizeSubscriptionGroups(products);
    const expiredFromOrders = dashExpiredSubscriptionsFromOrders();
    dashboardSubscriptionsCache = {
        active: dashUniqueSubscriptions(incoming.active),
        expiringSoon: dashUniqueSubscriptions(incoming.expiringSoon),
        expired: dashUniqueSubscriptions([...(incoming.expired || []), ...expiredFromOrders])
    };

    if (!dashboardSubscriptionsCache.active.length && !dashboardSubscriptionsCache.expiringSoon.length && !dashboardSubscriptionsCache.expired.length) {
        activeBody.innerHTML = `
            <div class="empty-state">
                <i data-lucide="inbox"></i>
                <p>${email ? `No subscriptions found for <b>${email}</b>` : 'No subscriptions found'}</p>
            </div>`;
    } else {
        activeBody.innerHTML = dashRenderSubscriptionSections();
    }
    if (window.lucide) lucide.createIcons();
}

window.changeSubscriptionPage = function(statusKey, page) {
    const items = dashboardSubscriptionsCache[statusKey] || [];
    const totalPages = Math.max(1, Math.ceil(items.length / DASHBOARD_LIST_PER_PAGE));
    dashboardSubscriptionsPage[statusKey] = Math.min(Math.max(1, Number(page) || 1), totalPages);
    const activeBody = document.getElementById('activeSubsBody');
    if (activeBody) {
        activeBody.innerHTML = dashRenderSubscriptionSections();
        if (window.lucide) lucide.createIcons();
    }
};

function renderActiveSubscriptionsList(products, activeBody, email = '') {
    if (!activeBody) return;
    activeBody.dataset.readyHint = '1';
    renderSubscriptionsSplit(products, activeBody, email);
}

function renderActiveSubscriptionsFromOrders(activeBody = document.getElementById('activeSubsBody')) {
    const products = dashboardOrdersCache
        .filter(dashIsActiveOrderSubscription)
        .map(dashOrderToSubscription);
    renderSubscriptionsSplit(products, activeBody, window.GETOTTS_USER_EMAIL || '');
    return (dashboardSubscriptionsCache.active || []).length + (dashboardSubscriptionsCache.expiringSoon || []).length + (dashboardSubscriptionsCache.expired || []).length;
}

function copyReferral() {
    const input = document.getElementById('refLink');
    input.select();
    document.execCommand('copy');
    
    const btn = input.nextElementSibling;
    const oldText = btn.innerHTML;
    btn.innerHTML = 'Copied! ✓';
    btn.style.background = '#16a34a';
    setTimeout(() => { btn.innerHTML = oldText; btn.style.background = ''; }, 2000);
}

async function updateProfileDetails() {
    const nameInput = document.getElementById('profileNameInput').value.trim();
    const emailInput = document.getElementById('profileEmailInput').value.trim();
    const msgBox = document.getElementById('profileUpdateMsg');
    
    if (!nameInput) {
        msgBox.style.color = '#dc2626';
        msgBox.textContent = 'Please enter a name.';
        return;
    }

    if (!emailInput || !emailInput.includes('@')) {
        msgBox.style.color = '#dc2626';
        msgBox.textContent = 'Please enter a valid email address.';
        return;
    }
    
    msgBox.style.color = 'var(--gray-500)';
    msgBox.textContent = 'Updating...';
    
    const user = JSON.parse(localStorage.getItem('GetOTTs_customer')) || {};
    const token = localStorage.getItem('GetOTTs_customer_token');
    
    try {
        const API_BASE = (window.GETOTTS_CONFIG && window.GETOTTS_CONFIG.API_BASE) || 'https://api.getotts.com/api/v1';
        const res = await fetch(`${API_BASE}/customers/update-profile`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name: nameInput, email: emailInput })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            user.name = nameInput;
            user.email = emailInput;
            localStorage.setItem('GetOTTs_customer', JSON.stringify(user));
            
            // Update sidebar display
            const nameEl = document.getElementById('profileName');
            if (nameEl) nameEl.textContent = nameInput;
            const emailEl = document.getElementById('profileEmail');
            if (emailEl) emailEl.textContent = emailInput;
            
            msgBox.style.color = '#16a34a';
            msgBox.textContent = '✓ Profile updated successfully!';
        } else {
            msgBox.style.color = '#dc2626';
            msgBox.textContent = data.detail || 'Failed to update profile details.';
        }
    } catch (e) {
        msgBox.style.color = '#dc2626';
        msgBox.textContent = 'Network error. Please try again.';
    }
    setTimeout(() => { msgBox.textContent = ''; }, 3000);
}

async function loadDashboardData(customerId) {
    return dashRequestOnce('orders', () => loadDashboardDataNow(customerId));
}

async function loadDashboardDataNow(customerId) {
    const API_BASE = (window.GETOTTS_CONFIG && window.GETOTTS_CONFIG.API_BASE) || 'https://api.getotts.com/api/v1';
    
    try {
        const response = await dashFetch(`${API_BASE}/orders/customer/${customerId}`, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const dbOrders = await response.json();
        const localOrders = JSON.parse(localStorage.getItem('GetOTTs_orders') || '[]');
        
        const displayOrders = dbOrders.map(o => ({
            orderNumber: o.order_number,
            product: o.product_name || (o.metadata && o.metadata.product_name) || 'Subscription Order',
            productEmoji: o.product_emoji || '📦',
            date: o.created_at,
            amount: o.amount || 0,
            currency: o.currency || null,
            metadata: o.metadata || {},
            paymentStatus: (o.payment_status || 'pending').toUpperCase(),
            deliveryStatus: (o.delivery_status || 'pending').toUpperCase(),
            isPaid: (o.payment_status || '').toLowerCase() === 'paid',
            creds: o.credentials_delivered || o.credentials || {},
            expiresAt: o.expires_at || '',
            deliveredAt: o.delivered_at || '',
            productImg: o.product_img || o.img_url || '',
            deliveryMode: o.delivery_mode || 'automatic',
            authType: (o.metadata && o.metadata.auth_type) || 'email_password'
        }));

        // ... existing local orders merge logic ...

        displayOrders.sort((a, b) => new Date(b.date) - new Date(a.date));
        dashWriteCache('orders', displayOrders);
        renderDashboardOrders(displayOrders);
        const activeBodyNow = document.getElementById('activeSubsBody');
        if (activeBodyNow) renderActiveSubscriptionsFromOrders(activeBodyNow);

        // Update stats
        const statOrders = document.getElementById('statOrders');
        if (statOrders) statOrders.textContent = displayOrders.length;
        
        const activeCount = displayOrders.filter(dashIsActiveOrderSubscription).length;
        const statActive = document.getElementById('statActive');
        if (statActive) statActive.textContent = activeCount;

        // Keep credentials lazy; loading them during dashboard boot slows the order/history view.
        const user = JSON.parse(localStorage.getItem('GetOTTs_customer'));
        if (user && user.email && !user.email.startsWith('wa_')) {
            const activeBody = document.getElementById('activeSubsBody');
            if (activeBody && !activeBody.dataset.readyHint) {
                activeBody.dataset.readyHint = '1';
                activeBody.innerHTML = `
                    <div class="empty-state">
                        <i data-lucide="shield-check"></i>
                        <p>Open this tab to load active credentials.</p>
                    </div>`;
            }
        } else {
            const activeBody = document.getElementById('activeSubsBody');
            if (activeBody) {
                activeBody.innerHTML = `
                    <div style="text-align:center; padding:20px; color:var(--gray-500); font-size:0.9rem;">
                        Add an email to your profile to see active credentials here.
                    </div>`;
            }
        }

        if (displayOrders.length > 0) {
            // (Keep existing buildOrderRow and logic)
            const buildOrderRow = (o) => {
                const isDelivered = o.deliveryStatus === 'DELIVERED';
                const isManual = o.deliveryMode === 'manual';
                const needsOtp = o.deliveryStatus === 'ACTION_REQUIRED';
                
                let deliveryHtml = '';
                if (isDelivered) {
                    deliveryHtml = `
                        <div class="dash-delivery-box dash-delivery-ready">
                            <div class="dash-delivery-title">
                                <i data-lucide="shield-check" style="width:14px; height:14px;"></i> Credentials Ready
                            </div>
                            <div class="dash-credentials">
                                ${o.creds.email ? `<div>Email: <b>${o.creds.email}</b></div>` : ''}
                                ${o.creds.password ? `<div>Pass: <b>${o.creds.password}</b></div>` : ''}
                                ${o.creds.link ? `<div>Link: <b>${o.creds.link}</b></div>` : ''}
                                ${o.creds.otp ? `<div>Code: <b>${o.creds.otp}</b></div>` : ''}
                                ${(!o.creds.email && !o.creds.password && !o.creds.link) ? `<div style="color:var(--text-muted)">Manual Delivery Complete</div>` : ''}
                            </div>
                            <a href="order?id=${o.orderNumber}" style="display:inline-block; margin-top:8px; font-size:0.7rem; color:var(--primary); text-decoration:none;">View Full Details →</a>
                        </div>
                    `;
                } else if (needsOtp) {
                    deliveryHtml = `
                        <div class="dash-delivery-box dash-delivery-action">
                            <div class="dash-delivery-title">
                                <i data-lucide="key" style="width:14px; height:14px;"></i> Action Required: OTP Needed
                            </div>
                            <p>Please check WhatsApp/Telegram to provide the login code.</p>
                            <button onclick="dashChatAboutOrder('${o.orderNumber}')" class="dash-admin-chat-primary">
                                💬 Chat with Admin
                            </button>
                        </div>
                    `;
                } else if (isManual && o.isPaid) {
                    deliveryHtml = `
                        <div class="dash-delivery-box dash-delivery-manual">
                            <div class="dash-delivery-title">
                                <i data-lucide="user-check" style="width:14px; height:14px;"></i> Manual Delivery
                            </div>
                            <p>Admin is setting up your account. We'll notify you shortly.</p>
                            <button onclick="dashChatAboutOrder('${o.orderNumber}')" class="dash-admin-chat-primary">
                                💬 Chat with Admin
                            </button>
                        </div>
                    `;
                }

                return `
                    <div class="dash-order-row">
                        <div class="dash-order-main">
                            <div class="dash-order-info">
                                <div class="dash-order-title-row">
                                    <span class="dash-order-emoji">${o.productEmoji}</span>
                                    <span class="dash-order-title">${o.product}</span>
                                    <span class="dash-mode-pill">${o.deliveryMode.toUpperCase()}</span>
                                </div>
                                <div class="dash-order-meta">
                                    <a href="order?id=${o.orderNumber}" class="dash-order-id">${o.orderNumber}</a>
                                    <span style="color:var(--gray-400);">•</span>
                                    <span class="dash-order-date">${o.date ? new Date(o.date).toLocaleDateString('en-IN', {day:'numeric', month:'short'}) : 'Date N/A'}</span>
                                </div>
                            </div>
                            
                            <div class="dash-order-side">
                                <div class="dash-order-amount">${dashOrderMoney(o)}</div>
                                <div class="dash-status-stack">
                                    <span class="dash-status-pill dash-status-${o.paymentStatus.toLowerCase().replace(/_/g, '-')}">${o.paymentStatus}</span>
                                    <span class="dash-status-pill dash-status-${o.deliveryStatus.toLowerCase().replace(/_/g, '-')}">${o.deliveryStatus}</span>
                                </div>
                            </div>
                        </div>
                        
                        ${deliveryHtml}

                        <div class="dash-order-actions">
                            <a href="order?id=${o.orderNumber}" class="dash-detail-link">
                                <i data-lucide="external-link" style="width:12px; height:12px;"></i> View Details
                            </a>
                            <button onclick="dashChatAboutOrder('${o.orderNumber}')" class="dash-chat-btn">
                                <i data-lucide="message-circle" style="width:13px; height:13px;"></i> Chat
                            </button>
                            <button onclick="dashOpenOrderIssue('${o.orderNumber}', 'Refund')" class="dash-check-btn">
                                <i data-lucide="undo-2" style="width:13px; height:13px;"></i> Refund
                            </button>
                            <button onclick="dashOpenOrderIssue('${o.orderNumber}', 'Dispute')" class="dash-check-btn">
                                <i data-lucide="shield-alert" style="width:13px; height:13px;"></i> Dispute
                            </button>
                        </div>
                    </div>
                `;
            };
            
            // Recent Orders (max 5)
            const recentBody = document.getElementById('recentOrdersBody');
            if (recentBody) {
                const html = displayOrders.slice(0, 5).map(buildOrderRow).join('');
                if (html) {
                    recentBody.innerHTML = html;
                }
            }
            
            // Full orders panel
            const ordersPanel = document.getElementById('ordersPanel');
            if (ordersPanel) {
                const html = displayOrders.map(buildOrderRow).join('');
                if (html) {
                    ordersPanel.innerHTML = `<div class="panel-body">${html}</div>`;
                }
            }
        } else {
            const emptyState = `
                <div class="empty-state">
                    <i data-lucide="package-open"></i>
                    <p>No orders yet</p>
                </div>`;
            const recentBody = document.getElementById('recentOrdersBody');
            if (recentBody) recentBody.innerHTML = emptyState;
            
            const ordersPanel = document.getElementById('ordersPanel');
            if (ordersPanel) ordersPanel.innerHTML = `<div class="panel-body">${emptyState}</div>`;
        }

        // Final shared render keeps Order History paginated at 10 items per page.
        renderDashboardOrders(displayOrders);
        const activeBodyFinal = document.getElementById('activeSubsBody');
        if (activeBodyFinal) renderActiveSubscriptionsFromOrders(activeBodyFinal);
        
        if (window.lucide) lucide.createIcons();
    } catch (e) {
        console.error("Dashboard data load error:", e);
        // Clear skeletons even on error
        const emptyState = `
            <div class="empty-state">
                <i data-lucide="alert-circle"></i>
                <p>Failed to load orders. Please refresh.</p>
            </div>`;
        const recentBody = document.getElementById('recentOrdersBody');
        if (recentBody) recentBody.innerHTML = emptyState;
        
        const ordersPanel = document.getElementById('ordersPanel');
        if (ordersPanel) ordersPanel.innerHTML = `<div class="panel-body">${emptyState}</div>`;
        if (window.lucide) lucide.createIcons();
    }
}

async function loadReferralData(customerId) {
    return dashRequestOnce('referrals', () => loadReferralDataNow(customerId));
}

async function loadReferralDataNow(customerId) {
    const API_BASE = (window.GETOTTS_CONFIG && window.GETOTTS_CONFIG.API_BASE) || 'https://api.getotts.com/api/v1';
    
    try {
        const response = await dashFetch(`${API_BASE}/customers/${customerId}/referrals`, { cache: 'no-store' });
        if (!response.ok) return;
        
        const data = await response.json();
        dashWriteCache('referrals', data);
        renderReferralData(data);
        
        // Update referral count stat
        const statRef = document.getElementById('statReferrals');
        if (statRef) statRef.textContent = data.referral_count || 0;
        
        // Update referral list in the Refer & Earn tab
        const referralsPanel = document.querySelector('#tab-referral .panel:last-child .panel-body');
        if (referralsPanel && data.referrals && data.referrals.length > 0) {
            referralsPanel.innerHTML = data.referrals.map(r => `
                <div style="display:flex; align-items:center; justify-content:space-between; padding:12px 0; border-bottom:1px solid #f1f5f9;">
                    <div>
                        <div style="font-weight:600; color:var(--gray-800);">${r.name || 'Customer'}</div>
                        <div style="font-size:.8rem; color:var(--gray-500);">Joined ${new Date(r.created_at).toLocaleDateString('en-IN', {day:'numeric', month:'short', year:'numeric'})}</div>
                    </div>
                    <span style="display:inline-block; background:${r.reward_earned ? '#dcfce7' : '#fef3c7'}; color:${r.reward_earned ? '#15803d' : '#92400e'}; padding:3px 10px; border-radius:100px; font-size:.72rem; font-weight:700;">
                        ${r.reward_earned ? `+${dashSingleMoney(r.reward_amount, r.reward_currency)} Credit` : 'Pending purchase'}
                    </span>
                </div>
            `).join('');
        }
        
        // Update wallet balance if available
        if (data.wallet_balance !== undefined) {
            const walletEl = document.getElementById('walletBalance');
            if (walletEl) walletEl.textContent = dashMoney(data.wallet_balance, data.wallet_balance_usd);
        }
    } catch (e) {
        console.warn("Referral data load error:", e);
    }
}

// ============================================
// VOUCHERS AND WALLET LOGIC
// ============================================

function getAuthToken() {
    const directToken = localStorage.getItem('GetOTTs_customer_token');
    if (directToken) return directToken;

    try {
        // Fallback: Try multiple potential Supabase session keys
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.includes('-auth-token')) {
                const session = JSON.parse(localStorage.getItem(key));
                if (session && session.access_token) return session.access_token;
            }
        }
    } catch(e) {}
    return '';
}

window.forceSync = async () => {
    Toast.info("Syncing...", "Re-fetching all account data...");
    const user = JSON.parse(localStorage.getItem('GetOTTs_customer'));
    if (user && user.id) {
        await loadDashboardData(user.id);
        await loadWalletHistory();
        await loadReferralData(user.id);
        Toast.success("Synced!", "All data has been refreshed.");
    }
};

async function loadWalletHistory() {
    return dashRequestOnce('wallet', loadWalletHistoryNow, 12000);
}

async function loadWalletHistoryNow() {
    const API_BASE = (window.GETOTTS_CONFIG && window.GETOTTS_CONFIG.API_BASE) || 'https://api.getotts.com/api/v1';
    const token = getAuthToken();
    const listEl = document.getElementById('walletTxList');

    if (!token) {
        if (listEl) {
            listEl.innerHTML = `
                <div class="empty-state">
                    <i data-lucide="lock"></i>
                    <p>Please log in to see wallet history</p>
                </div>`;
            if (window.lucide) lucide.createIcons();
        }
        return;
    }

    try {
        // Fire BOTH requests at the same time — don't wait for one before starting the other
        const [historyRes, balRes] = await Promise.all([
            dashFetch(`${API_BASE}/vouchers/history?_t=${Date.now()}`, {
                headers: { 'Authorization': `Bearer ${token}` },
                cache: 'no-store'
            }),
            dashFetch(`${API_BASE}/vouchers/wallet?_t=${Date.now()}`, {
                headers: { 'Authorization': `Bearer ${token}` },
                cache: 'no-store'
            })
        ]);

        let balData = null;
        // Process balance immediately (fastest visual feedback)
        if (balRes.ok) {
            balData = await balRes.json();
            renderWalletBalance(balData);
        }

        // Process history
        if (historyRes.ok) {
            const history = await historyRes.json();
            const listEl = document.getElementById('walletTxList');
            if (!listEl) return;
            renderWalletTransactions(history);
            dashWriteCache('wallet', { balance: balData || dashReadCache('wallet')?.balance || {}, history });
        } else {
            const listEl = document.getElementById('walletTxList');
            if (listEl) {
                listEl.innerHTML = `
                    <div class="empty-state">
                        <i data-lucide="alert-circle"></i>
                        <p>Unable to load history (${historyRes.status})</p>
                    </div>`;
            }
        }
    } catch (e) {
        console.error("Failed to load wallet history:", e);
        if (listEl) {
            listEl.innerHTML = `
                <div class="empty-state">
                    <i data-lucide="alert-circle"></i>
                    <p>Failed to load transactions.</p>
                </div>`;
            if (window.lucide) lucide.createIcons();
        }
    }
}

async function redeemVoucher() {
    const btn = document.getElementById('redeemBtn');
    const input = document.getElementById('voucherInput');
    const walletHero = document.querySelector('.wallet-hero-premium') || document.querySelector('.wallet-hero');
    const walletAmountEl = document.getElementById('walletAmount');
    const code = input.value.trim().toUpperCase();

    if (!code) return Toast.error("Missing Code", "Please enter a voucher code.");

    const token = getAuthToken();
    if (!token) return Toast.error("Auth Error", "You must be logged in to redeem a voucher.");

    const API_BASE = (window.GETOTTS_CONFIG && window.GETOTTS_CONFIG.API_BASE) || 'https://api.getotts.com/api/v1';

    const originalText = btn.textContent;
    let redeemed = false;
    walletHero?.classList.remove('redeem-success', 'redeem-error');
    walletHero?.classList.add('is-redeeming');
    btn.classList.add('is-redeeming');
    btn.innerHTML = '<span class="loading-spinner"></span> Redeeming...';
    btn.disabled = true;

    try {
        const response = await fetch(`${API_BASE}/vouchers/redeem`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ code: code })
        });

        const data = await response.json();

        if (response.ok) {
            const amount = data.amount || 0;
            redeemed = true;
            Toast.success("Voucher Redeemed!", `Successfully added ${dashSingleMoney(amount, data.currency || 'INR')} to your ${(data.currency || 'INR').toUpperCase()} wallet.`);
            input.value = '';
            walletHero?.classList.remove('is-redeeming');
            walletHero?.classList.add('redeem-success');
            walletAmountEl?.classList.remove('wallet-amount-pop');
            void walletAmountEl?.offsetWidth;
            walletAmountEl?.classList.add('wallet-amount-pop');
            btn.classList.remove('is-redeeming');
            btn.classList.add('is-redeemed');
            btn.innerHTML = '<i data-lucide="check-circle-2"></i> Added';
            if (window.lucide) window.lucide.createIcons({ attrs: { 'stroke-width': 2.4 } });
            
            // Force re-fetch of everything
            await loadWalletHistory();
            
            // Add a little celebration effect
            if (window.confetti) {
                confetti({
                    particleCount: 100,
                    spread: 70,
                    origin: { y: 0.6 }
                });
            }
        } else {
            walletHero?.classList.remove('is-redeeming');
            walletHero?.classList.add('redeem-error');
            Toast.error("Redeem Failed", data.detail || "Invalid or expired voucher code.");
        }
    } catch (e) {
        console.error("Redeem error:", e);
        walletHero?.classList.remove('is-redeeming');
        walletHero?.classList.add('redeem-error');
        Toast.error("Network Error", "A connection error occurred. Please try again.");
    } finally {
        setTimeout(() => {
            btn.textContent = originalText;
            btn.disabled = false;
            btn.classList.remove('is-redeeming', 'is-redeemed');
            walletHero?.classList.remove('is-redeeming', 'redeem-error');
            if (redeemed) {
                setTimeout(() => walletHero?.classList.remove('redeem-success'), 1200);
            }
        }, redeemed ? 900 : 120);
    }
}

window.openAddFundsModal = () => {
    Toast.info("Admin Only", "Wallet credit is added by admin, voucher, or direct adjustment only.");
};

window.closeAddFundsModal = () => {};

window.confirmAddFunds = () => {
    Toast.info("Admin Only", "Wallet credit is added by admin, voucher, or direct adjustment only.");
};

// ============================================
// ACTIVE SUBSCRIPTIONS (REVEAL VIEW)
// ============================================

function dashProductLogoSrc(product) {
    if (window.getProductLogoSrc) return window.getProductLogoSrc(product);
    const image = product?.product_img || product?.img || product?.img_url || product?.logo_url || '';
    if (!image) return '';
    if (image.startsWith('http') || image.startsWith('/') || image.startsWith('data:image')) return image;
    return '/' + image.replace(/^\.?\//, '');
}

async function loadActiveSubscriptions(email) {
    const API_BASE = (window.GETOTTS_CONFIG && window.GETOTTS_CONFIG.API_BASE) || 'https://api.getotts.com/api/v1';
    const activeBody = document.getElementById('activeSubsBody');
    if (!activeBody) return;
    const token = getAuthToken();
    const safeEmail = (email || '').trim();

    if (!token) {
        if (renderActiveSubscriptionsFromOrders(activeBody)) return;
        activeBody.innerHTML = `
            <div class="empty-state">
                <i data-lucide="lock"></i>
                <p>Please log in again to see active subscriptions.</p>
            </div>`;
        if (window.lucide) lucide.createIcons();
        return;
    }

    if (!safeEmail || !safeEmail.includes('@')) {
        if (renderActiveSubscriptionsFromOrders(activeBody)) return;
        activeBody.innerHTML = `
            <div class="empty-state">
                <i data-lucide="mail"></i>
                <p>Add an email to your profile to see active credentials here.</p>
            </div>`;
        if (window.lucide) lucide.createIcons();
        return;
    }

    if (activeSubscriptionsPromise) return activeSubscriptionsPromise;

    clearTimeout(activeSubscriptionsTimer);
    activeSubscriptionsPromise = new Promise(resolve => {
        activeSubscriptionsTimer = setTimeout(async () => {
            try {
                await fetchActiveSubscriptions(safeEmail, token, API_BASE, activeBody);
            } finally {
                activeSubscriptionsPromise = null;
                resolve();
            }
        }, DASHBOARD_LOAD_GAP_MS);
    });

    return activeSubscriptionsPromise;
}

async function fetchActiveSubscriptions(email, token, API_BASE, activeBody) {
    try {
        const resp = await dashFetch(`${API_BASE}/orders/my-products?email=${encodeURIComponent(email)}&_t=${Date.now()}`, {
            headers: { 'Authorization': `Bearer ${token}` },
            cache: 'no-store'
        }, 3500);
        const data = await resp.json();
        if (!resp.ok) {
            throw new Error(data.detail || `API error: ${resp.status}`);
        }
        const products = data.products || [];
        
        if (!products.length) {
            renderActiveSubscriptionsList([], activeBody, email);
            return;
        }

        renderActiveSubscriptionsList(products, activeBody, email);
    } catch (e) {
        console.error("Failed to load active subs:", e);
        if (renderActiveSubscriptionsFromOrders(activeBody)) return;
        activeBody.innerHTML = `
            <div class="empty-state">
                <i data-lucide="alert-circle"></i>
                <p>Could not load active subscriptions. Please refresh in a moment.</p>
            </div>`;
        if (window.lucide) lucide.createIcons();
    }
}

window.toggleRevealDash = function(index) {
    const values = document.querySelectorAll(`.cred-value-${index}`);
    const btn = document.getElementById(`reveal-btn-dash-${index}`);
    const first = values[0];
    const computedFilter = first ? window.getComputedStyle(first).filter : '';
    const isBlurred = !first?.dataset.revealed && computedFilter !== 'none';

    values.forEach(el => {
        el.style.filter = isBlurred ? 'none' : 'blur(5px)';
        el.style.userSelect = isBlurred ? 'text' : 'none';
        el.dataset.revealed = isBlurred ? '1' : '';
    });
    if (btn) {
        const icon = isBlurred ? 'eye-off' : 'eye';
        btn.innerHTML = btn.classList.contains('dash-view-mini')
            ? `<i data-lucide="${icon}"></i>`
            : (isBlurred
                ? '<i data-lucide="eye-off" style="width:12px; height:12px; vertical-align:middle; margin-right:4px;"></i> Hide'
                : '<i data-lucide="eye" style="width:12px; height:12px; vertical-align:middle; margin-right:4px;"></i> Show');
        if (window.lucide) lucide.createIcons();
    }
};

window.copyToClipboard = function(text) {
    navigator.clipboard.writeText(text);
    if (typeof Toast !== 'undefined') {
        Toast.success("Copied!", "Access details copied to clipboard.");
    } else {
        alert('Copied to clipboard!');
    }
};

// === ORDER-LINKED CHAT ===
window.dashChatAboutOrder = function(orderNumber) {
    if (window.LiveChat && typeof window.LiveChat.openForOrder === 'function') {
        window.LiveChat.openForOrder(orderNumber);
    } else if (window.LiveChat) {
        window.LiveChat.toggle(true);
    } else {
        // Fallback: navigate to order page
        window.location.href = `/order?id=${orderNumber}`;
    }
};

window.dashOpenOrderIssue = function(orderNumber, type) {
    const issueType = type === 'Dispute' ? 'Dispute' : 'Refund';
    switchTab('support');
    setTimeout(() => {
        if (window.SUPPORT_UI && typeof SUPPORT_UI.openCreateModal === 'function') {
            SUPPORT_UI.openCreateModal();
        }
        const category = document.getElementById('ticketCategory');
        const subject = document.getElementById('ticketSubject');
        const message = document.getElementById('ticketMessage');
        if (category) category.value = issueType;
        if (subject) subject.value = `${issueType} check for order ${orderNumber}`;
        if (message) {
            message.value = `Please check this ${issueType.toLowerCase()} request for order ${orderNumber}.\n\nOrder ID: ${orderNumber}\nIssue type: ${issueType} check\nDetails: `;
            message.focus();
        }
    }, 80);
};

if (typeof redeemVoucher !== 'undefined') window.redeemVoucher = redeemVoucher;

// ============================================
// PROFILE & EMAIL CHANGE LOGIC
// ============================================

window.updateProfileName = async () => {
    const nameInput = document.getElementById('profileNameInput');
    const msgBox = document.getElementById('profileUpdateMsg');
    const saveBtn = document.getElementById('saveNameBtn');
    const API_BASE = (window.GETOTTS_CONFIG && window.GETOTTS_CONFIG.API_BASE) || 'https://api.getotts.com/api/v1';

    const name = nameInput.value.trim();
    if (!name) {
        msgBox.style.color = '#dc2626';
        msgBox.textContent = "Please enter your name.";
        return;
    }

    try {
        saveBtn.disabled = true;
        saveBtn.textContent = "Saving...";
        
        const response = await fetch(`${API_BASE}/customers/update-profile`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + getAuthToken()
            },
            body: JSON.stringify({ name })
        });

        const data = await response.json();
        if (data.success) {
            const user = JSON.parse(localStorage.getItem('GetOTTs_customer'));
            user.name = name;
            localStorage.setItem('GetOTTs_customer', JSON.stringify(user));
            document.getElementById('headerName').textContent = name;
            document.getElementById('profileName').textContent = name;
            msgBox.style.color = '#16a34a';
            msgBox.textContent = "✓ Name updated successfully!";
            if (typeof Toast !== 'undefined') Toast.success("Profile Updated", "Your name has been saved.");
        } else {
            throw new Error(data.detail || "Update failed");
        }
    } catch (e) {
        msgBox.style.color = '#dc2626';
        msgBox.textContent = e.message;
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = "Save Name";
        setTimeout(() => { if(msgBox) msgBox.textContent = ""; }, 3000);
    }
};

window.requestEmailChange = async () => {
    const API_BASE = (window.GETOTTS_CONFIG && window.GETOTTS_CONFIG.API_BASE) || 'https://api.getotts.com/api/v1';
    const msgBox = document.getElementById('profileUpdateMsg');
    const changeBtn = document.getElementById('changeEmailBtn');

    try {
        changeBtn.disabled = true;
        changeBtn.innerHTML = '<i data-lucide="loader-2" class="spin" style="width:14px; height:14px;"></i> Sending...';
        if (window.lucide) lucide.createIcons();

        const response = await fetch(`${API_BASE}/email-change/request`, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + getAuthToken() }
        });

        const data = await response.json();
        if (data.success) {
            msgBox.style.color = '#4f46e5';
            msgBox.textContent = "Check your current email for a verification link to continue.";
            if (typeof Toast !== 'undefined') Toast.info("Link Sent", "Please check your current email inbox.");
        } else {
            throw new Error(data.detail || "Request failed");
        }
    } catch (e) {
        msgBox.style.color = '#dc2626';
        msgBox.textContent = e.message;
        changeBtn.disabled = false;
        changeBtn.textContent = "Change Email";
    }
};

window.sendNewEmailOtp = async () => {
    const API_BASE = (window.GETOTTS_CONFIG && window.GETOTTS_CONFIG.API_BASE) || 'https://api.getotts.com/api/v1';
    const newEmail = document.getElementById('newEmailInput').value.trim();
    const token = new URLSearchParams(window.location.search).get('email_change_token');
    const msgBox = document.getElementById('emailModalMsg');
    const btn = document.getElementById('newEmailOtpBtn');

    if (!newEmail || !newEmail.includes('@')) {
        msgBox.style.color = '#dc2626';
        msgBox.textContent = "Please enter a valid new email address.";
        return;
    }

    try {
        btn.disabled = true;
        btn.textContent = "Sending OTP...";
        const response = await fetch(`${API_BASE}/email-change/send-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, new_email: newEmail })
        });
        const data = await response.json();
        if (data.success) {
            document.getElementById('newEmailConfirmLabel').textContent = newEmail;
            switchEmailStep(2);
        } else {
            throw new Error(data.detail || "Failed to send OTP");
        }
    } catch (e) {
        msgBox.style.color = '#dc2626';
        msgBox.textContent = e.message;
        btn.disabled = false;
        btn.textContent = "Send Verification OTP";
    }
};

window.confirmEmailChange = async () => {
    const API_BASE = (window.GETOTTS_CONFIG && window.GETOTTS_CONFIG.API_BASE) || 'https://api.getotts.com/api/v1';
    const otp = document.getElementById('newEmailOtpInput').value.trim();
    const token = new URLSearchParams(window.location.search).get('email_change_token');
    const msgBox = document.getElementById('emailModalMsg');
    const btn = document.getElementById('confirmEmailBtn');

    try {
        btn.disabled = true;
        btn.textContent = "Verifying...";
        const response = await fetch(`${API_BASE}/email-change/confirm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, otp })
        });
        const data = await response.json();
        if (data.success) {
            msgBox.style.color = '#16a34a';
            msgBox.textContent = "✓ Email updated successfully! Redirecting...";
            const user = JSON.parse(localStorage.getItem('GetOTTs_customer'));
            user.email = document.getElementById('newEmailInput').value.trim();
            localStorage.setItem('GetOTTs_customer', JSON.stringify(user));
            setTimeout(() => { window.location.href = '/dashboard'; }, 2000);
        } else {
            throw new Error(data.detail || "Verification failed");
        }
    } catch (e) {
        msgBox.style.color = '#dc2626';
        msgBox.textContent = e.message;
        btn.disabled = false;
        btn.textContent = "Confirm & Update Email";
    }
};

window.switchEmailStep = (step) => {
    document.getElementById('emailChangeStep1').style.display = step === 1 ? 'block' : 'none';
    document.getElementById('emailChangeStep2').style.display = step === 2 ? 'block' : 'none';
};

window.closeEmailModal = () => {
    const modal = document.getElementById('emailChangeModal');
    if (modal) modal.style.display = 'none';
    const url = new URL(window.location);
    url.searchParams.delete('email_change_token');
    window.history.replaceState({}, '', url);
};

(async () => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('email_change_token');
    if (token) {
        const API_BASE = (window.GETOTTS_CONFIG && window.GETOTTS_CONFIG.API_BASE) || 'https://api.getotts.com/api/v1';
        try {
            const res = await fetch(`${API_BASE}/email-change/verify-token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token })
            });
            if (res.ok) {
                const modal = document.getElementById('emailChangeModal');
                if (modal) modal.style.display = 'flex';
                if (window.lucide) lucide.createIcons();
            }
        } catch (e) {}
    }
})();
