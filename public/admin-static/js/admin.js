// Global fetch override to inject CSRF token - updated
const cookieKeys = document.cookie.split(';').map(c => c.trim().split('=')[0]);
console.log(`[CSRF_DEBUG] Page load cookies present: ${cookieKeys.join(', ')} | Has admin_csrf_token: ${cookieKeys.includes('admin_csrf_token') ? 'yes' : 'no'}`);

const originalFetch = window.fetch;
window.fetch = async function() {
    let [resource, config] = arguments;
    if (!config) config = {};
    if (!config.credentials) config.credentials = 'include'; // Ensure cookies are sent (CSRF + Auth)
    
    if (config.method && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(config.method.toUpperCase())) {
        if (!config.headers) config.headers = {};
        const match = document.cookie.match(new RegExp('(^| )admin_csrf_token=([^;]+)'));
        let tokenAttached = false;
        let tokenSource = 'missing';
        
        if (match) {
            tokenSource = 'cookie';
            if (config.headers instanceof Headers) {
                if (!config.headers.has('X-CSRF-Token')) {
                    config.headers.set('X-CSRF-Token', match[2]);
                    tokenAttached = true;
                } else {
                    tokenAttached = true;
                    tokenSource = 'header_already_present';
                }
            } else {
                if (!config.headers['X-CSRF-Token']) {
                    config.headers['X-CSRF-Token'] = match[2];
                    tokenAttached = true;
                } else {
                    tokenAttached = true;
                    tokenSource = 'header_already_present';
                }
            }
        } else {
            console.warn('[Fetch-CSRF] Mutating request made but csrf_token cookie not found in document.cookie');
        }
        
        const safeTok = (t) => t && t.length > 8 ? `${t.substring(0, 4)}...${t.substring(t.length - 4)}` : (t ? 'yes' : 'no');
        
        console.log(`[CSRF_DEBUG] Req: ${config.method} ${resource} | credentials: ${config.credentials} | has_csrf_attached: ${tokenAttached ? 'yes' : 'no'} | source: ${tokenSource} | token: ${match ? safeTok(match[2]) : 'none'}`);
    }
    return originalFetch(resource, config);
};

if (typeof API_BASE === 'undefined') {
    window.API_BASE = (window.GETOTTS_CONFIG && window.GETOTTS_CONFIG.API_BASE) 
        ? window.GETOTTS_CONFIG.API_BASE 
        : (window.location.origin.includes('localhost') ? 'http://localhost:8000/api/v1' : 'https://api.getotts.com/api/v1');
}
// Removed trailing slash append to maintain consistency with checkout.js and dashboard.js
let adminToken = '';
let useBackend = false;

function adminParseMetadata(raw) {
    if (!raw) return {};
    if (typeof raw === 'object') return raw;
    try {
        return JSON.parse(raw);
    } catch (e) {
        return {};
    }
}

function adminMoney(value, currency = 'INR') {
    const amount = Number(value) || 0;
    return String(currency).toUpperCase() === 'USD'
        ? `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function adminEscapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, ch => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[ch]));
}

function adminGetUsageMeta(product = {}) {
    const faqs = Array.isArray(product.faqs) ? product.faqs : [];
    const meta = faqs.find(item => item && item.type === 'usage_guide') || {};
    return {
        usage_type: product.usage_type || meta.usage_type || 'auto',
        usage_steps: Array.isArray(product.usage_steps) && product.usage_steps.length ? product.usage_steps : (Array.isArray(meta.steps) ? meta.steps : []),
        usage_note: product.usage_note || meta.note || ''
    };
}

function adminMergeUsageFaqMeta(faqs, usageType, steps, note) {
    const cleanFaqs = Array.isArray(faqs) ? faqs.filter(item => !(item && item.type === 'usage_guide')) : [];
    const cleanSteps = (steps || []).map(s => String(s || '').trim()).filter(Boolean);
    if ((usageType && usageType !== 'auto') || cleanSteps.length || String(note || '').trim()) {
        cleanFaqs.unshift({
            type: 'usage_guide',
            usage_type: usageType || 'auto',
            steps: cleanSteps,
            note: String(note || '').trim()
        });
    }
    return cleanFaqs;
}

function adminOrderMoney(order = {}) {
    const meta = adminParseMetadata(order.metadata);
    const firstItem = Array.isArray(meta.items) && meta.items[0] && typeof meta.items[0] === 'object'
        ? meta.items[0]
        : {};
    const currency = String(order.currency || meta.wallet_currency || firstItem.currency || 'INR').toUpperCase() === 'USD' ? 'USD' : 'INR';
    const amount = meta.server_price !== undefined && meta.server_price !== null && meta.server_price !== ''
        ? meta.server_price
        : (order.amount || 0);
    return adminMoney(amount, currency);
}

// Demo platforms
function extractApiError(err, data) {
    if (data && data.detail) {
        if (typeof data.detail === 'string') return data.detail;
        if (Array.isArray(data.detail)) return data.detail.map(e => e.msg || JSON.stringify(e)).join(', ');
        return JSON.stringify(data.detail);
    }
    if (data && data.message) return data.message;
    if (err && err.message) {
        if (err.message.includes('Failed to fetch')) return 'Network error or timeout. Check connection.';
        return err.message;
    }
    return 'Unknown error occurred.';
}

const DEMO_PLATFORMS = [
    { id: '1', name: 'Netflix', slug: 'netflix' },
    { id: '2', name: 'Amazon Prime Video', slug: 'prime-video' },
    { id: '3', name: 'Disney+ Hotstar', slug: 'hotstar' },
    { id: '4', name: 'Spotify Premium', slug: 'spotify' },
    { id: '5', name: 'YouTube Premium', slug: 'youtube-premium' },
    { id: '6', name: 'Zee5 Premium', slug: 'zee5' },
    { id: '7', name: 'SonyLIV', slug: 'sonyliv' },
    { id: '9', name: 'Apple TV+', slug: 'apple-tv' },
    { id: '10', name: 'ChatGPT Plus', slug: 'chatgpt' },
    { id: '11', name: 'Midjourney', slug: 'midjourney' },
    { id: '12', name: 'Claude Pro', slug: 'claude' },
    { id: '13', name: 'Canva Pro', slug: 'canva' },
    { id: '14', name: 'Perplexity Pro', slug: 'perplexity' },
    { id: '15', name: 'LinkedIn Premium', slug: 'linkedin' },
    { id: '16', name: 'NordVPN', slug: 'nordvpn' },
    { id: '17', name: 'ExpressVPN', slug: 'expressvpn' },
    { id: '18', name: 'Apple Music', slug: 'apple-music' },
];

/* ================================================
   INIT
   ================================================ */
document.addEventListener('DOMContentLoaded', async () => {
    if (window.lucide) lucide.createIcons();

    // Check backend availability
    checkBackend();

    if (typeof syncCatalogFromCloud === 'function') {
        await syncCatalogFromCloud();
    }

    // Since we are served via backend API with HttpOnly cookie, we assume authentication is handled.
    showDashboard();

    // Customer search
    const searchInput = document.getElementById('customerSearch');
    if (searchInput) {
        searchInput.addEventListener('input', () => loadCustomers());
    }
});

async function checkBackend() {
    // Streamlined: Use a more generous timeout for slower networks
    try {
        const baseUrl = API_BASE.replace(/\/api\/v1\/?$/, '') || '/';
        const resp = await fetch(`${baseUrl}/`, { signal: AbortSignal.timeout(5000) });
        if (resp.ok) useBackend = true;
        console.log('[Admin] Backend status:', useBackend ? 'ONLINE' : 'OFFLINE');
    } catch { 
        useBackend = false; 
        console.log('[Admin] Backend: OFFLINE (falling back to local store)'); 
    }
}

function logout() {
    window.location.href = '/';
}

function showDashboard() {
    document.getElementById('adminDash').style.display = 'flex';
    loadStats();
    loadOrders(); // Load orders on startup
    loadPlatformDropdowns();
    loadAuditPreview();
    if (window.lucide) lucide.createIcons();
}

/* ================================================
   TAB SWITCHING
   ================================================ */
function switchTab(tabName) {
    console.log('[Admin] Switching to tab:', tabName);
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    const tab = document.getElementById(`tab-${tabName}`);
    if (tab) tab.classList.add('active');
    const navItem = document.querySelector(`.nav-item[data-tab="${tabName}"]`);
    if (navItem) navItem.classList.add('active');

    switch(tabName) {
        case 'overview': loadStats(); loadAuditPreview(); break;
        case 'orders': loadOrders(); break;
        case 'inventory': loadInventory(); break;
        case 'products': loadProducts(); break;
        case 'customers': loadCustomers(); break;
        case 'coupons': loadCoupons(); break;
        case 'whatsapp': checkWaMonitorStatus(); loadPendingCodes(); loadWaStats(); loadWaMessageLog(); break;
        case 'settings': loadSettings(); break;
        case 'vouchers': loadAdminVouchers(); loadAuditLogs(); break;
    }
    if (window.lucide) lucide.createIcons();
}

/* ================================================
   STATS
   ================================================ */
async function loadStats() {
    // 1. Fetch live from server (Optimized unified endpoint)
    try {
        const res = await fetch(`${API_BASE}/admin/stats`);
        const data = await res.json();
        
        if (data.success) {
            document.getElementById('statRevenue').textContent = `₹${(data.total_revenue || 0).toLocaleString()}`;
            document.getElementById('statOrders').textContent = data.total_orders || 0;
            document.getElementById('statStock').textContent = data.available_inventory || 0;
            document.getElementById('statTotalInv').textContent = data.total_inventory || 0;
            
            // New fields from optimized API
            if (document.getElementById('statCustomers')) 
                document.getElementById('statCustomers').textContent = data.total_customers || 0;
            if (document.getElementById('statPaid')) 
                document.getElementById('statPaid').textContent = data.paid_orders || 0;
            if (document.getElementById('statPending')) 
                document.getElementById('statPending').textContent = data.pending_orders || 0;
            if (document.getElementById('statDelivered')) 
                document.getElementById('statDelivered').textContent = data.delivered_orders || 0;
            if (document.getElementById('statTotalTxCount'))
                document.getElementById('statTotalTxCount').textContent = data.total_transactions || 0;
            if (document.getElementById('statTotalWallet'))
                document.getElementById('statTotalWallet').textContent = `₹${(data.total_wallet || 0).toLocaleString()}`;
        }
    } catch (e) {
        console.warn('Failed to fetch live stats', e);
        
        // 2. Fallback / local stats ONLY if API fails
        const stats = AdminStore.getStats();
        if (document.getElementById('statCustomers')) 
            document.getElementById('statCustomers').textContent = stats.total_customers;
        
        const orders = AdminStore.getOrders();
        document.getElementById('statPaid').textContent = orders.filter(o => o.payment_status === 'paid').length;
        document.getElementById('statPending').textContent = orders.filter(o => o.payment_status === 'pending').length;
        document.getElementById('statDelivered').textContent = orders.filter(o => o.delivery_status === 'delivered').length;
    }
}


/* ================================================
   ORDERS
   ================================================ */
async function loadOrders() {
    // Sync with backend API
    try {
        const res = await fetch(`${API_BASE}/admin/orders`);
        if (res.ok) {
            const data = await res.json();
            if (data.success && data.orders) {
                AdminStore._set(STORE_KEYS.orders, data.orders);
            }
        }
    } catch (e) { console.warn('Failed to fetch orders from API', e); }

    const body = document.getElementById('ordersBody');
    const filter = document.getElementById('orderFilter').value;
    const search = document.getElementById('orderSearch')?.value || '';
    const orders = AdminStore.getOrders(filter, search);

    if (!orders.length) {
        body.innerHTML = `<tr><td colspan="8" class="empty-state" style="padding: 60px 20px; text-align: center;">
            <div style="font-size: 3rem; margin-bottom: 16px; opacity: 0.3;">
                <i data-lucide="shopping-bag"></i>
            </div>
            <div style="font-weight: 600; font-size: 1.1rem; color: var(--gray-600); margin-bottom: 8px;">
                No orders found
            </div>
            <p style="color: var(--gray-400); font-size: 0.9rem; max-width: 300px; margin: 0 auto;">
                ${search || filter ? 'Try adjusting your filters or search terms.' : 'Orders will appear here once customers start purchasing.'}
            </p>
        </td></tr>`;
        if (window.lucide) lucide.createIcons();
        return;
    }

    body.innerHTML = orders.map(o => `
        <tr>
            <td><strong>${o.order_number || '—'}</strong></td>
            <td>${o.customer_email || '—'}</td>
            <td>${o.product_name || '—'}</td>
            <td>${adminOrderMoney(o)}</td>
            <td><span class="pill pill-${o.payment_status}">${o.payment_status}</span></td>
            <td><span class="pill pill-${o.delivery_status}">${o.delivery_status}</span></td>
            <td>${formatDate(o.created_at)}</td>
            <td class="action-cell">
                <button class="action-btn" onclick="viewOrder('${o.id}')" title="View Details">
                    <i data-lucide="eye"></i>
                </button>
                ${o.payment_status === 'pending' ? `
                    <button class="action-btn green" onclick="confirmPayment('${o.id}')" title="Confirm Payment">
                        <i data-lucide="check"></i>
                    </button>
                ` : ''}
                ${o.payment_status === 'paid' && o.delivery_status !== 'delivered' ? `
                    <button class="action-btn blue" onclick="showDeliverModal('${o.id}')" title="Deliver">
                        <i data-lucide="send"></i>
                    </button>
                ` : ''}
                ${o.delivery_status !== 'delivered' ? `
                    <button class="action-btn red" onclick="cancelOrder('${o.id}')" title="Cancel">
                        <i data-lucide="x"></i>
                    </button>
                ` : ''}
                <button class="action-btn" onclick="openWhatsApp('${o.customer_phone || ''}')" title="WhatsApp">
                    <i data-lucide="message-circle"></i>
                </button>
            </td>
        </tr>
    `).join('');
    if (window.lucide) lucide.createIcons();
}

function viewOrder(id) {
    const o = AdminStore.getOrderById(id);
    if (!o) return;

    document.getElementById('modalOrderTitle').textContent = `Order ${o.order_number}`;
    document.getElementById('modalOrderBody').innerHTML = `
        <div class="order-detail-grid">
            <div class="od-row"><span class="od-label">Customer</span><span>${o.customer_email || '—'}</span></div>
            <div class="od-row"><span class="od-label">Phone</span><span>${o.customer_phone || '—'}</span></div>
            <div class="od-row"><span class="od-label">Product</span><span>${o.product_name || '—'}</span></div>
            <div class="od-row"><span class="od-label">Amount</span><span><strong>${adminOrderMoney(o)}</strong></span></div>
            <div class="od-row"><span class="od-label">Payment</span><span class="pill pill-${o.payment_status}">${o.payment_status}</span></div>
            <div class="od-row"><span class="od-label">Delivery</span><span class="pill pill-${o.delivery_status}">${o.delivery_status}</span></div>
            <div class="od-row"><span class="od-label">Created</span><span>${formatDate(o.created_at)}</span></div>
            ${o.credentials_email ? `
                <div class="od-row"><span class="od-label">Cred Email</span><span><code>${o.credentials_email}</code></span></div>
                <div class="od-row"><span class="od-label">Cred Password</span><span><code>${o.credentials_password || '—'}</code></span></div>
            ` : ''}
            ${o.notes ? `<div class="od-row"><span class="od-label">Notes</span><span>${o.notes}</span></div>` : ''}
        </div>
    `;

    let footerBtns = '';
    if (o.payment_status === 'pending') {
        footerBtns += `<button class="btn btn-primary" onclick="confirmPayment('${id}'); closeModal('orderModal'); loadOrders();">✅ Confirm Payment</button>`;
    }
    if (o.payment_status === 'paid' && o.delivery_status !== 'delivered') {
        footerBtns += `<button class="btn btn-primary" onclick="closeModal('orderModal'); showDeliverModal('${id}');">📦 Deliver</button>`;
    }
    if (o.credentials_email) {
        footerBtns += `<button class="btn btn-outline" onclick="copyCredentials('${o.credentials_email}', '${o.credentials_password || ''}')">📋 Copy Creds</button>`;
    }
    document.getElementById('modalOrderFooter').innerHTML = footerBtns;
    document.getElementById('orderModal').style.display = 'flex';
    if (window.lucide) lucide.createIcons();
}

function confirmPayment(id) {
    // Find order_number from any source before doing anything
    let orderNumber = null;
    
    // Try from AdminStore first
    const storeOrder = AdminStore.getOrderById(id);
    if (storeOrder) orderNumber = storeOrder.order_number;
    
    // If not found by UUID, try matching all orders
    if (!orderNumber) {
        const allOrders = AdminStore.getOrders();
        const found = allOrders.find(o => o.id === id || o.order_number === id);
        if (found) {
            orderNumber = found.order_number;
            id = found.id; // ensure we use the right ID for local update
        }
    }

    // Update local admin store
    AdminStore.updateOrder(id, { payment_status: 'paid' });
    
    loadOrders();
    loadStats();
    showToast('Payment confirmed ✅');

    // ALWAYS update the backend DB — this is the critical sync step
    const API = (window.GETOTTS_CONFIG && window.GETOTTS_CONFIG.API_BASE) || '';
    if (API && orderNumber) {
        fetch(API + 'orders/' + orderNumber + '/update-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ payment_status: 'paid' })
        }).then(r => {
            console.log('[ADMIN] ✅ Backend payment status synced:', r.status, 'for', orderNumber);
            if (!r.ok) r.text().then(t => console.warn('[ADMIN] Backend response:', t));
        }).catch(e => console.warn('[ADMIN] ❌ Backend update failed:', e));
    } else {
        console.warn('[ADMIN] ⚠️ Could not find order_number for id:', id, '— backend NOT updated');
    }
}

function showDeliverModal(id) {
    const o = AdminStore.getOrderById(id);
    document.getElementById('deliverOrderId').value = id;
    document.getElementById('deliverOrderNumber').value = o ? o.order_number : '';
    document.getElementById('deliverEmail').value = '';
    document.getElementById('deliverPassword').value = '';
    document.getElementById('deliverPhone').value = '';
    document.getElementById('deliverOtp').value = '';
    document.getElementById('deliverProfile').value = '';
    document.getElementById('deliverLink').value = '';
    document.getElementById('deliverNotes').value = '';
    document.getElementById('deliverModal').style.display = 'flex';
}

async function confirmDeliver() {
    const id = document.getElementById('deliverOrderId').value;
    const orderNumber = document.getElementById('deliverOrderNumber').value;
    
    // Collect all credentials
    const creds = {};
    const email = document.getElementById('deliverEmail').value.trim();
    const password = document.getElementById('deliverPassword').value.trim();
    const phone = document.getElementById('deliverPhone').value.trim();
    const otp = document.getElementById('deliverOtp').value.trim();
    const profile = document.getElementById('deliverProfile').value.trim();
    const link = document.getElementById('deliverLink').value.trim();
    const notes = document.getElementById('deliverNotes').value.trim();
    
    if (email) creds.email = email;
    if (password) creds.password = password;
    if (phone) creds.phone = phone;
    if (otp) creds.otp = otp;
    if (profile) creds.profile = profile;
    if (link) creds.link = link;
    if (notes) creds.notes = notes;

    if (Object.keys(creds).length === 0) {
        showToast('❌ Please enter at least one credential');
        return;
    }

    const btn = document.querySelector('#deliverModal .modal-footer .btn-primary');
    const oldText = btn.innerHTML;
    btn.innerHTML = '⏳ Delivering...';
    btn.disabled = true;

    try {
        const resp = await fetch(`${API_BASE}/orders/manual-fulfill`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                order_number: orderNumber,
                credentials: creds,
                send_notification: true
            })
        });

        if (resp.ok) {
            // Update local admin store
            AdminStore.updateOrder(id, {
                delivery_status: 'delivered',
                payment_status: 'paid', // just in case
                credentials_email: creds.email,
                credentials_password: creds.password,
                notes: creds.notes,
                delivered_at: new Date().toISOString(),
            });

            closeModal('deliverModal');
            loadOrders();
            loadStats();
            showToast('Order manually fulfilled & delivered! 📦');
        } else {
            const data = await resp.json();
            showToast(`❌ Error: ${data.detail || 'Fulfillment failed'}`);
        }
    } catch (e) {
        console.error('Fulfillment error:', e);
        showToast('❌ Network error during fulfillment');
    } finally {
        btn.innerHTML = oldText;
        btn.disabled = false;
    }
}

function cancelOrder(id) {
    if (!confirm('Cancel this order?')) return;
    
    // Find order_number for backend sync
    const storeOrder = AdminStore.getOrderById(id);
    const orderNumber = storeOrder ? storeOrder.order_number : null;
    
    AdminStore.updateOrder(id, {
        payment_status: 'failed',
        delivery_status: 'cancelled',
    });
    loadOrders();
    loadStats();
    showToast('Order cancelled');

    // Sync to backend
    const API = (window.GETOTTS_CONFIG && window.GETOTTS_CONFIG.API_BASE) || '';
    if (API && orderNumber) {
        fetch(API + 'orders/' + orderNumber + '/update-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ payment_status: 'failed', delivery_status: 'cancelled' })
        }).then(r => console.log('[ADMIN] Cancel synced to backend:', r.status))
          .catch(e => console.warn('[ADMIN] Cancel sync failed:', e));
    }
}

function copyCredentials(email, password) {
    navigator.clipboard.writeText(`Email: ${email}\nPassword: ${password}`);
    showToast('Credentials copied! 📋');
}

function openWhatsApp(phone) {
    const settings = AdminStore.getSettings();
    const num = phone || settings.whatsapp;
    if (num) window.open(`https://wa.me/${num}`, '_blank');
}

/* ================================================
   INVENTORY — Enhanced with order linkage
   ================================================ */

const INV_STATUS_BADGE = {
    available:  '<span class="inv-badge inv-available">🟢 Available</span>',
    reserved:   '<span class="inv-badge inv-reserved">🟡 Reserved</span>',
    delivered:  '<span class="inv-badge inv-delivered">🔵 Delivered</span>',
    sold:       '<span class="inv-badge inv-delivered">🔵 Delivered</span>', // legacy alias
    expired:    '<span class="inv-badge inv-expired">⚪ Expired</span>',
    flagged:    '<span class="inv-badge inv-flagged">🔴 Flagged</span>',
};

async function loadInventory() {
    const body = document.getElementById('invBody');
    const filter = document.getElementById('invFilter').value;

    // Load from cloud API
    let url = `${API_BASE}/admin/inventory?limit=200`;
    if (filter) url += `&status=${filter}`;

    try {
        const res = await fetch(url);
        const data = await res.json();
        const items = data.inventory || [];
        try {
            localStorage.setItem('getotts_admin_inventory', JSON.stringify(items));
        } catch (cacheErr) {
            console.warn('[INV] Could not refresh local inventory cache:', cacheErr);
        }

        if (!items.length) {
            try { localStorage.removeItem('getotts_admin_inventory'); } catch {}
            body.innerHTML = `<tr><td colspan="7" class="empty-state">No inventory${filter ? ` with status "${filter}"` : ''}. Add accounts using the Add Inventory tab.</td></tr>`;
            loadStockSummary();
            return;
        }

        body.innerHTML = items.map(i => {
            const statusBadge = INV_STATUS_BADGE[i.status] || `<span class="inv-badge">${i.status}</span>`;
            const orderLink = i.order_id
                ? `<a href="#" onclick="highlightOrder('${i.order_id}'); return false;" class="inv-order-link" title="${i.order_id}">${(i.order_id || '').substring(0, 8)}…</a>`
                : '<span style="color:#9ca3af">—</span>';

            // Action buttons based on status
            let actions = '';
            if (i.status === 'available') {
                actions = `
                    <button class="action-btn" onclick="copyCredentials('${i.email || ''}', '${i.password || ''}')" title="Copy Credentials">
                        <i data-lucide="copy"></i>
                    </button>
                    <button class="action-btn red" onclick="deleteInvItem('${i.id}')" title="Delete">
                        <i data-lucide="trash-2"></i>
                    </button>`;
            } else if (i.status === 'reserved') {
                actions = `
                    <button class="action-btn" onclick="copyCredentials('${i.email || ''}', '${i.password || ''}')" title="Copy Credentials">
                        <i data-lucide="copy"></i>
                    </button>
                    <button class="action-btn orange" onclick="unassignInvItem('${i.id}')" title="Unassign (release back to available)">
                        <i data-lucide="unlock"></i>
                    </button>`;
            } else if (i.status === 'delivered' || i.status === 'sold') {
                actions = `
                    <button class="action-btn" onclick="copyCredentials('${i.email || ''}', '${i.password || ''}')" title="Copy Credentials">
                        <i data-lucide="copy"></i>
                    </button>`;
            } else {
                actions = `
                    <button class="action-btn" onclick="resetInvStatus('${i.id}')" title="Reset to Available">
                        <i data-lucide="refresh-cw"></i>
                    </button>
                    <button class="action-btn red" onclick="deleteInvItem('${i.id}')" title="Delete">
                        <i data-lucide="trash-2"></i>
                    </button>`;
            }

            return `
            <tr class="inv-row inv-row-${i.status === 'sold' ? 'delivered' : i.status}">
                <td><code style="font-size:.82rem">${i.email || '—'}</code></td>
                <td>${i.platform_id || '—'}</td>
                <td>${i.plan_type || '—'}</td>
                <td>${statusBadge}</td>
                <td>${orderLink}</td>
                <td>${i.expiry_date || '—'}</td>
                <td class="action-cell">${actions}</td>
            </tr>`;
        }).join('');

        if (window.lucide) lucide.createIcons();
        loadStockSummary();
    } catch (e) {
        console.error('[INV] Load failed:', e);
        // Fallback to localStorage
        const items = AdminStore.getInventory(filter);
        body.innerHTML = items.length ? items.map(i => `
            <tr>
                <td><code style="font-size:.82rem">${i.email}</code></td>
                <td>${i.platform || i.platform_id || '—'}</td>
                <td>${i.plan_type || '—'}</td>
                <td>${INV_STATUS_BADGE[i.status] || i.status}</td>
                <td>—</td>
                <td>${i.expiry_date || '—'}</td>
                <td class="action-cell">
                    <button class="action-btn" onclick="copyCredentials('${i.email}', '${i.password || ''}')" title="Copy Credentials">
                        <i data-lucide="copy"></i>
                    </button>
                    <button class="action-btn red" onclick="deleteInvItem('${i.id}')" title="Delete">
                        <i data-lucide="trash-2"></i>
                    </button>
                </td>
            </tr>
        `).join('') : `<tr><td colspan="7" class="empty-state">No inventory. Add accounts first.</td></tr>`;
        if (window.lucide) lucide.createIcons();
    }
}

async function loadStockSummary() {
    const el = document.getElementById('stockSummary');
    if (!el) return;
    try {
        const res = await fetch(`${API_BASE}/admin/inventory/stock-summary`);
        const data = await res.json();
        const summary = data.summary || [];
        if (!summary.length) {
            el.innerHTML = '<p style="color:#9ca3af; font-size:.85rem;">No stock data yet.</p>';
            return;
        }
        el.innerHTML = summary.map(s => `
            <div class="stock-chip">
                <strong>${s.platform_id}</strong>
                <span class="stock-plan">${s.plan_type}</span>
                <span class="stock-count-available" title="Available">${s.available} avail</span>
                ${s.reserved ? `<span class="stock-count-reserved" title="Reserved">${s.reserved} rsv</span>` : ''}
                ${s.delivered ? `<span class="stock-count-delivered" title="Delivered">${s.delivered} dlv</span>` : ''}
            </div>
        `).join('');
    } catch (e) {
        console.warn('[INV] Stock summary load failed:', e);
    }
}

async function syncInventoryToCloud() {
    const items = AdminStore.getInventory();
    if (!items.length) {
        showToast('No inventory to sync');
        return;
    }
    
    try {
        const res = await fetch(`${API_BASE}/admin/inventory/migrate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ inventory: items })
        });
        const data = await res.json();
        showToast(`☁️ Synced ${data.added || 0}/${items.length} items to cloud`);
        console.log('[INV] Cloud sync:', data);
        loadInventory(); // Refresh from cloud
    } catch (e) {
        showToast('❌ Sync failed: ' + extractApiError(e, null));
        console.error('[INV] Sync failed:', e);
    }
}

function updateInvStatus(id, status) {
    AdminStore.updateInventoryItem(id, { status });
    loadStats();
    showToast(`Status updated to ${status}`);
}

async function deleteInvItem(id) {
    if (!confirm('Delete this inventory item?')) return;
    try {
        await fetch(`${API_BASE}/admin/inventory/${id}`, { method: 'DELETE' });
        showToast('Inventory item deleted');
        loadInventory();
        loadStats();
    } catch (e) {
        // Fallback to localStorage
        AdminStore.deleteInventoryItem(id);
        loadInventory();
        loadStats();
        showToast('Inventory item deleted (local)');
    }
}

async function unassignInvItem(id) {
    if (!confirm('Release this reserved account back to available?')) return;
    try {
        const res = await fetch(`${API_BASE}/admin/inventory/${id}/unassign`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            showToast('✅ Account released back to available');
            loadInventory();
            loadStats();
        } else {
            showToast('❌ ' + (extractApiError(null, data) || 'Failed to unassign'));
        }
    } catch (e) {
        showToast('❌ Unassign failed: ' + extractApiError(e, null));
    }
}

async function resetInvStatus(id) {
    try {
        await fetch(`${API_BASE}/admin/inventory/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'available', order_id: null, reserved_at: null, delivered_at: null })
        });
        showToast('✅ Reset to available');
        loadInventory();
        loadStats();
    } catch (e) {
        showToast('❌ Reset failed: ' + extractApiError(e, null));
    }
}

function highlightOrder(orderId) {
    // Switch to Orders tab and highlight this order
    switchTab('orders');
    setTimeout(() => {
        const rows = document.querySelectorAll('#ordersBody tr');
        rows.forEach(r => {
            if (r.innerHTML.includes(orderId.substring(0, 8))) {
                r.style.background = '#fef3c7';
                r.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(() => r.style.background = '', 3000);
            }
        });
    }, 500);
}



/* ================================================
   PRODUCTS
   ================================================ */

async function runCatalogMigration() {
    showToast('⏳ Syncing catalog to cloud...');
    try {
        const products = AdminStore.getProducts();
        if (!products.length) {
            showToast('❌ No products to sync — add products first or use "Seed Initial Catalog"');
            return;
        }
        const res = await fetch(`${API_BASE}/admin/catalog/migrate`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ products })
        });
        const data = await res.json();
        if (data.success) {
            showToast(`☁️ ${data.count || products.length} products synced to cloud!`);
            console.log('[CATALOG] Migrated to DB ✅', data);
        } else {
            showToast('❌ Catalog sync failed: ' + extractApiError(null, data));
        }
    } catch (e) {
        showToast('❌ Catalog sync error: ' + extractApiError(e, null));
        console.error('[CATALOG] Migration error:', e);
    }
}

/** Seed the database with the built-in SEED_CATALOG (first-time setup only) */
async function seedInitialCatalog() {
    if (!confirm('⚠️ Seed Initial Catalog?\n\nThis will populate the database with 14 starter products.\nUse this ONLY for first-time setup when the DB is empty.\n\nExisting products will be replaced!')) return;

    showToast('🌱 Seeding initial catalog...');
    try {
        const seed = typeof SEED_CATALOG !== 'undefined' ? SEED_CATALOG : [];
        if (!seed.length) {
            showToast('❌ No seed catalog found');
            return;
        }
        const res = await fetch(`${API_BASE}/admin/catalog/migrate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ products: seed })
        });
        const data = await res.json();
        if (data.success) {
            showToast(`🌱 Seeded ${seed.length} products! Reloading...`);
            // Clear any stale overrides
            localStorage.removeItem('getotts_admin_products');
            // Reload to fetch fresh data from API
            setTimeout(() => location.reload(), 1500);
        } else {
            showToast('❌ Seed failed: ' + extractApiError(null, data));
        }
    } catch (e) {
        showToast('❌ Seed error: ' + extractApiError(e, null));
    }
}
window.seedInitialCatalog = seedInitialCatalog;

function loadProducts() {
    const body = document.getElementById('productsBody');
    const products = AdminStore.getProducts();

    if (!products || products.length === 0) {
        body.innerHTML = `<tr><td colspan="7" class="empty-state" style="padding:40px; text-align:center;">
            <div style="font-size:2rem; margin-bottom:12px;">📦</div>
            <div style="font-weight:700; margin-bottom:8px;">No products in catalog</div>
            <div style="color:var(--gray-500); margin-bottom:16px;">Add products manually with "+ Create New Product" or seed the starter catalog.</div>
            <button class="action-btn blue" onclick="seedInitialCatalog()" style="padding:10px 24px; font-size:0.9rem; border-radius:10px; cursor:pointer;">
                🌱 Seed Initial Catalog (14 products)
            </button>
        </td></tr>`;
        return;
    }

    body.innerHTML = products.map(p => {
        const variants = p.variants || [];
        const shared = variants.find(v => v.accessType === 'shared');
        const personal = variants.find(v => v.accessType === 'personal');
        
        const sharedPriceInr = shared ? `₹${shared.price}` : '—';
        const personalPriceInr = personal ? `₹${personal.price}` : '—';
        const sharedPriceUsd = shared && shared.price_usd ? `$${Number(shared.price_usd).toFixed(2)}` : '';
        const personalPriceUsd = personal && personal.price_usd ? `$${Number(personal.price_usd).toFixed(2)}` : '';
        
        // Region badge
        const regionMap = { 'all': '🌍', 'india': '🇮🇳', 'global': '🌐' };
        const regionLabel = regionMap[p.region_lock] || '🌍';
        
        // Real Stock Calculation: Sum available inventory for this platform (by slug or name)
        const platformSlug = p.slug || p.id; // e.g. 'netflix'
        const liveStock = AdminStore.getStockByPlatform(platformSlug);
        const stockClass = liveStock > 0 ? 'green' : 'red';
        const stableKey = p.slug || p.id; // Use slug as stable key for operations
        
        return `
        <tr>
            <td>
                <div style="display:flex; align-items:center; gap:12px;">
                    <span style="font-size:1.5rem;">${p.emoji || '📦'}</span>
                    <div>
                        <div style="font-weight:700">${p.name || 'Unknown'} <span title="${p.region_lock || 'all'}">${regionLabel}</span></div>
                        <div style="font-size:0.7rem;color:var(--gray-500)">${platformSlug}</div>
                    </div>
                </div>
            </td>
            <td>
                <span class="pill pill-delivered" style="font-size:0.7rem;">${p.delivery_mode === 'manual' ? 'Manual' : 'Auto'}</span>
            </td>
            <td style="font-weight:600;color:var(--gray-700)">${sharedPriceInr}${sharedPriceUsd ? `<br><small style="color:var(--gray-400)">${sharedPriceUsd}</small>` : ''}</td>
            <td style="font-weight:600;color:var(--gray-700)">${personalPriceInr}${personalPriceUsd ? `<br><small style="color:var(--gray-400)">${personalPriceUsd}</small>` : ''}</td>
            <td>
                <span style="font-weight:700;color:var(--${stockClass}-600)">${liveStock}</span>
                <small style="color:var(--gray-400)"> avail</small>
            </td>
            <td>${p.isHot ? `Featured${getAdminFeaturedPosition(p) ? ' #' + getAdminFeaturedPosition(p) : ''}` : '—'}</td>
            <td class="action-cell">
                <button class="action-btn blue" onclick="openProductWizard('${stableKey}')" title="Configure Product">
                    <i data-lucide="edit-3"></i>
                </button>
                <button class="action-btn ${p.isActive !== false ? 'green' : 'red'}" onclick="toggleProductActive('${stableKey}')" title="Toggle Visibility">
                    <i data-lucide="${p.isActive !== false ? 'eye' : 'eye-off'}"></i>
                </button>
                <button class="action-btn red" onclick="confirmDeleteProduct('${stableKey}', '${(p.name || '').replace(/'/g, "\\'")}')" title="Delete Product">
                    <i data-lucide="trash-2"></i>
                </button>
            </td>
        </tr>
    `}).join('');
    
    if (window.lucide) lucide.createIcons();
}

window._wizardVariants = [];
window._wizardUsageSteps = [];

function getAdminFeaturedPosition(product) {
    const raw = product?.featured_position ?? product?.featuredPosition ?? product?.featured_order ?? product?.featuredOrder ?? product?.hot_order ?? product?.hotOrder;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

function readPositiveIntInput(id) {
    const raw = String(document.getElementById(id)?.value || '').trim();
    if (!raw) return 0;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function ensureProductWizardModal() {
    let modal = document.getElementById('productWizardModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'productWizardModal';
    modal.className = 'admin-modal';
    modal.style.display = 'none';
    modal.innerHTML = `
        <div class="admin-modal-content" style="width:min(1100px,96vw);">
            <div class="admin-modal-header">
                <h2 id="wizTitle">Create New Product</h2>
                <button class="close-btn" onclick="closeProductWizard()" title="Close"><i data-lucide="x"></i></button>
            </div>
            <div class="admin-modal-body">
                <input type="hidden" id="wizId">
                <div style="display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px; margin-bottom:18px;">
                    <div class="ck-field">
                        <label>Product Name</label>
                        <input type="text" id="wizName" oninput="wizAutoSlug()" placeholder="Netflix Premium">
                    </div>
                    <div class="ck-field">
                        <label>Slug / Product URL</label>
                        <input type="text" id="wizSlug" placeholder="netflix-premium">
                    </div>
                    <div class="ck-field">
                        <label>Category</label>
                        <select id="wizCategory">
                            <option value="streaming">Streaming</option>
                            <option value="music">Music</option>
                            <option value="ai-tools">AI Tools</option>
                            <option value="vpn">VPN</option>
                            <option value="gift-cards">Gift Cards</option>
                            <option value="bundles">Bundles</option>
                            <option value="other">Other</option>
                        </select>
                    </div>
                    <div class="ck-field">
                        <label>Availability Region</label>
                        <select id="wizRegionLock">
                            <option value="all">Global + India</option>
                            <option value="india">India Only</option>
                            <option value="global">Global Only</option>
                        </select>
                    </div>
                    <div class="ck-field">
                        <label>Availability Region</label>
                        <select id="wizDeliveryMode">
                            <option value="automatic">Automatic delivery</option>
                            <option value="manual">Manual fulfilment</option>
                        </select>
                    </div>
                    <div class="ck-field">
                        <label>Default Access Method</label>
                        <select id="wizAuthType">
                            <option value="email_password">Email / ID + Password</option>
                            <option value="phone_otp">Phone / OTP Login</option>
                            <option value="invite_link">Invite / Shared Link</option>
                            <option value="app_login">App Login / QR / Manual Setup</option>
                        </select>
                    </div>
                    <div class="ck-field">
                        <label>Image URL</label>
                        <input type="text" id="wizImg" placeholder="/assets/images/product.webp">
                    </div>
                    <div class="ck-field">
                        <label>Emoji / Fallback Icon</label>
                        <input type="text" id="wizEmoji" placeholder="✨">
                    </div>
                </div>
                <div style="display:flex; align-items:center; gap:18px; margin-bottom:18px; flex-wrap:wrap;">
                    <label style="display:flex; gap:8px; align-items:center; font-weight:700;"><input type="checkbox" id="wizActive"> Visible in store</label>
                    <label style="display:flex; gap:8px; align-items:center; font-weight:700;"><input type="checkbox" id="wizHot"> Hot / featured</label>
                    <label style="display:flex; gap:8px; align-items:center; font-weight:700;">Position <input type="number" id="wizFeaturedPosition" min="1" step="1" placeholder="1" style="width:86px;"></label>
                    <input type="file" id="wizImgFile" accept="image/*" style="font-size:.85rem;">
                    <button class="btn btn-outline" type="button" onclick="wizUploadImage()" style="padding:8px 12px;">Upload Image</button>
                    <span id="wizImgStatus" style="font-size:.8rem;color:var(--gray-500);"></span>
                    <img id="wizImgPreview" src="" alt="Preview" style="display:none;width:42px;height:42px;border-radius:10px;object-fit:cover;border:1px solid var(--gray-200);">
                </div>

                <div style="display:grid; grid-template-columns:1fr; gap:18px;">
                    <section style="border:1px solid var(--gray-200); border-radius:14px; padding:16px; background:var(--gray-50);">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                            <h3 style="margin:0; font-size:1rem;">Variants & Pricing</h3>
                            <button class="btn btn-outline" type="button" onclick="wizAddVariant()" style="padding:8px 12px;">+ Add Variant</button>
                        </div>
                        <div id="wizVariantsBody" style="display:grid; gap:12px;"></div>
                    </section>

                    <section style="border:1px solid var(--gray-200); border-radius:14px; padding:16px; background:white;">
                        <h3 style="margin:0 0 12px; font-size:1rem;">How to Use Instructions</h3>
                        <div style="display:grid; grid-template-columns:minmax(180px,.35fr) 1fr; gap:14px; align-items:start;">
                            <div class="ck-field">
                                <label>Setup Type</label>
                                <select id="wizUsageType">
                                    <option value="auto">Auto detect from plan</option>
                                    <option value="shared_account">Shared account</option>
                                    <option value="shared_link">Shared by link</option>
                                    <option value="shared_id_password">Shared ID + password</option>
                                    <option value="mail_activation">Mail activation</option>
                                    <option value="number_activation">Number activation</option>
                                    <option value="otp_login">Login with OTP</option>
                                    <option value="invite_link">Invite link</option>
                                    <option value="personal_account">Personal account</option>
                                    <option value="custom">Custom</option>
                                </select>
                            </div>
                            <div class="ck-field">
                                <label>Important Note</label>
                                <input type="text" id="wizUsageNote" placeholder="Example: Do not change password or account recovery details.">
                            </div>
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center; margin:12px 0 8px;">
                            <strong style="font-size:.9rem;">Custom steps</strong>
                            <button class="btn btn-outline" type="button" onclick="wizAddUsageStep()" style="padding:7px 10px;">+ Add Step</button>
                        </div>
                        <div id="wizUsageSteps" style="display:grid; gap:8px;"></div>
                        <p style="margin:10px 0 0; color:var(--gray-500); font-size:.78rem;">Leave steps empty to let the product page auto-generate instructions from access type and auth type.</p>
                    </section>

                    <section style="border:1px solid var(--gray-200); border-radius:14px; padding:16px; background:white;">
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
                            <div>
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                                    <h3 style="margin:0; font-size:1rem;">Shared Features</h3>
                                    <button class="btn btn-outline" type="button" onclick="wizAddFeature('shared')" style="padding:7px 10px;">+ Add</button>
                                </div>
                                <div id="wizFeatShared" style="display:grid; gap:8px;"></div>
                            </div>
                            <div>
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                                    <h3 style="margin:0; font-size:1rem;">Personal Features</h3>
                                    <button class="btn btn-outline" type="button" onclick="wizAddFeature('personal')" style="padding:7px 10px;">+ Add</button>
                                </div>
                                <div id="wizFeatPersonal" style="display:grid; gap:8px;"></div>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" onclick="closeProductWizard()">Cancel</button>
                <button class="btn btn-primary" onclick="saveProductWizard()"><i data-lucide="save"></i> Save Product</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    if (window.lucide) lucide.createIcons();
    return modal;
}

window.openProductWizard = function(id = null) {
    const modal = ensureProductWizardModal();
    const title = document.getElementById('wizTitle');
    
    if (id) {
        const prod = AdminStore.getProducts().find(p => p.id === id || p.slug === id);
        if (!prod) return;
        
        document.getElementById('wizId').value = prod.slug || id;
        document.getElementById('wizSlug').value = prod.slug || id;
        window._wizSlugManual = true; // Editing existing: don't auto-overwrite slug
        title.textContent = "Edit Product Configuration: " + prod.name;
        
        // Populate inputs
        document.getElementById('wizName').value = prod.name || '';
        document.getElementById('wizCategory').value = prod.category || 'streaming';
        document.getElementById('wizImg').value = prod.img || '';
        document.getElementById('wizEmoji').value = prod.emoji || '';
        document.getElementById('wizActive').checked = prod.isActive !== false;
        document.getElementById('wizHot').checked = prod.isHot === true;
        document.getElementById('wizFeaturedPosition').value = getAdminFeaturedPosition(prod) || '';
        document.getElementById('wizRegionLock').value = prod.region_lock || 'all';
        const usageMeta = adminGetUsageMeta(prod);
        document.getElementById('wizUsageType').value = usageMeta.usage_type || 'auto';
        document.getElementById('wizUsageNote').value = usageMeta.usage_note || '';
        window._wizardUsageSteps = Array.isArray(usageMeta.usage_steps) ? [...usageMeta.usage_steps] : [];
        
        document.getElementById('wizDeliveryMode').value = prod.delivery_mode || 'automatic';
        document.getElementById('wizAuthType').value = prod.auth_type || 'email_password';
        
        window._wizardVariants = (prod.variants ? JSON.parse(JSON.stringify(prod.variants)) : []).map(v => {
            v.price_usd = parseFloat(v.price_usd) || 0;
            v.original_price_usd = parseFloat(v.original_price_usd) || 0;
            return v;
        });
        
        // Load features
        if (prod.features && typeof prod.features === 'object' && !Array.isArray(prod.features)) {
            window._wizardFeatures = JSON.parse(JSON.stringify(prod.features));
        } else if (Array.isArray(prod.features)) {
            window._wizardFeatures = { shared: prod.features, personal: [] };
        } else {
            window._wizardFeatures = { shared: [], personal: [] };
        }
    } else {
        // Create new
        const newId = 'custom-' + Date.now().toString(36);
        document.getElementById('wizId').value = newId;
        document.getElementById('wizSlug').value = '';
        window._wizSlugManual = false; // Auto-generate slug from name
        title.textContent = "Create New Product";
        
        document.getElementById('wizName').value = '';
        document.getElementById('wizCategory').value = 'streaming';
        document.getElementById('wizImg').value = '';
        document.getElementById('wizEmoji').value = '✨';
        document.getElementById('wizActive').checked = true;
        document.getElementById('wizHot').checked = false;
        document.getElementById('wizFeaturedPosition').value = '';
        document.getElementById('wizRegionLock').value = 'all';
        document.getElementById('wizUsageType').value = 'auto';
        document.getElementById('wizUsageNote').value = '';
        window._wizardUsageSteps = [];
        document.getElementById('wizDeliveryMode').value = 'automatic';
        document.getElementById('wizAuthType').value = 'email_password';
        
        window._wizardVariants = [
            { sku: newId + '-1m', accessType: 'shared', durationLabel: '1 Month', price: 99, originalPrice: 199, price_usd: 2, original_price_usd: 4, stock: 10 }
        ];
        window._wizardFeatures = { shared: ['Instant Delivery'], personal: [] };
    }
    
    wizRenderVariants();
    wizRenderFeatures();
    wizRenderUsageSteps();
    modal.style.display = 'flex';
    
    // Setup image preview
    setTimeout(() => {
        const imgVal = document.getElementById('wizImg').value;
        const preview = document.getElementById('wizImgPreview');
        if (preview && imgVal) {
            preview.src = imgVal.startsWith('http') ? imgVal : '/' + imgVal;
            preview.style.display = 'block';
        }
        // File input preview listener
        const fileInput = document.getElementById('wizImgFile');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file && preview) {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        preview.src = ev.target.result;
                        preview.style.display = 'block';
                    };
                    reader.readAsDataURL(file);
                }
            });
        }
    }, 50);
};

window.wizUploadImage = async function() {
    const fileInput = document.getElementById('wizImgFile');
    const status = document.getElementById('wizImgStatus');
    
    if (!fileInput || !fileInput.files[0]) {
        if (status) { status.textContent = '❌ Please select an image file first'; status.style.color = '#ef4444'; }
        return;
    }
    
    if (status) { status.textContent = '⏳ Uploading...'; status.style.color = 'var(--accent)'; }
    
    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    
    const csrfMatch = document.cookie.match(new RegExp('(^| )admin_csrf_token=([^;]+)'));
    const headers = new Headers();
    if (csrfMatch) headers.append('X-CSRF-Token', csrfMatch[2]);
    
    console.log(`[CSRF_DEBUG] wizUploadImage | URL: ${API_BASE}admin/upload-image | has_cookie: ${csrfMatch ? 'yes' : 'no'} | has_X-CSRF-Token_header: ${csrfMatch ? 'yes' : 'no'}`);
    
    try {
        const resp = await fetch(`${API_BASE}/admin/upload-image`, { 
            method: 'POST', 
            body: formData,
            credentials: 'include',
            headers: headers
        });
        const data = await resp.json();
        console.log(`[CSRF_DEBUG] wizUploadImage | Status: ${resp.status} | Body:`, data);
        
        if (resp.ok && data.success) {
            document.getElementById('wizImg').value = data.url;
            const preview = document.getElementById('wizImgPreview');
            if (preview) { preview.src = data.url; preview.style.display = 'block'; }
            if (status) { status.textContent = '✅ Image uploaded!'; status.style.color = '#059669'; }
            showToast('Image uploaded! 🖼️');
        } else {
            if (status) { status.textContent = `❌ ${data.detail || 'Upload failed'}`; status.style.color = '#ef4444'; }
        }
    } catch (err) {
        if (status) { status.textContent = `❌ Network error: ${err.message}`; status.style.color = '#ef4444'; }
    }
};

window.closeProductWizard = function() {
    document.getElementById('productWizardModal').style.display = 'none';
};

window.toggleProductActive = function(id) {
    const prod = AdminStore.getProducts().find(p => p.id === id || p.slug === id);
    if (!prod) return;
    const overrideKey = prod.slug || prod.id;
    const newState = prod.isActive === false;
    AdminStore.updateProduct(overrideKey, { isActive: newState });
    loadProducts();
    showToast(`🏷️ Product ${newState ? 'activated' : 'hidden'}`);
};

window.confirmDeleteProduct = async function(id, name) {
    if (!confirm(`⚠️ Delete "${name}"?\n\nThis will remove the product from the catalog, storefront, and database.\n\nThis action cannot be undone easily.`)) return;
    const prod = AdminStore.getProducts().find(p => p.id === id || p.slug === id);
    const deleteKey = prod ? (prod.id || prod.slug || id) : id;
    const overrideKey = prod ? (prod.slug || prod.id || id) : id;
    try {
        const resp = await fetch(`${API_BASE}/admin/products/${encodeURIComponent(deleteKey)}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || data.success === false) {
            throw new Error(data.detail || data.message || `Delete failed (${resp.status})`);
        }
        AdminStore.deleteProduct(overrideKey);
        loadProducts();
        loadStats();
        showToast(`Product "${name}" deleted from database.`);
    } catch (err) {
        console.error('[Products] Delete failed:', err);
        showToast(`Delete failed: ${err.message || err}`);
    }
};

window.wizRenderVariants = function() {
    const container = document.getElementById('wizVariantsBody');
    if (!window._wizardVariants || window._wizardVariants.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:24px; color:var(--gray-400); background:var(--gray-50); border-radius:12px; border:2px dashed var(--gray-200);">
                <div style="font-size:1.5rem; margin-bottom:8px;">📦</div>
                <div style="font-weight:600; margin-bottom:4px;">No variants configured</div>
                <div style="font-size:0.8rem;">Product cannot be sold without at least one variant.</div>
            </div>`;
        return;
    }
    
    container.innerHTML = window._wizardVariants.map((v, i) => `
        <div style="border:1px solid var(--gray-200); border-radius:12px; background:white; overflow:hidden;">
            <!-- Variant Header -->
            <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 16px; background:var(--gray-50); border-bottom:1px solid var(--gray-100);">
                <span style="font-size:0.8rem; font-weight:700; color:var(--gray-500); text-transform:uppercase; letter-spacing:0.5px;">Variant ${i + 1}</span>
                <button class="action-btn red" onclick="wizRemoveVariant(${i})" title="Remove Variant" style="width:26px; height:26px;">
                    <i data-lucide="trash-2" style="width:12px; height:12px;"></i>
                </button>
            </div>
            
            <!-- Core Settings Row -->
            <div style="padding:12px 16px; display:grid; grid-template-columns:1fr 1fr 1fr 1fr 80px; gap:10px; align-items:end; border-bottom:1px solid var(--gray-100);">
                <div>
                    <label style="display:block; font-size:0.7rem; font-weight:600; color:var(--gray-400); margin-bottom:4px; text-transform:uppercase;">Access Type</label>
                    <select onchange="window._wizardVariants[${i}].accessType = this.value" style="width:100%; padding:7px 8px; border:1px solid var(--gray-200); border-radius:8px; font-size:0.82rem; font-family:var(--font-body); background:white;">
                        <option value="shared" ${v.accessType === 'shared' ? 'selected' : ''}>Shared</option>
                        <option value="personal" ${v.accessType === 'personal' ? 'selected' : ''}>Personal</option>
                        <option value="family" ${v.accessType === 'family' ? 'selected' : ''}>Family</option>
                    </select>
                </div>
                <div>
                    <label style="display:block; font-size:0.7rem; font-weight:600; color:var(--gray-400); margin-bottom:4px; text-transform:uppercase;">Quality</label>
                    <input type="text" value="${v.quality || ''}" oninput="window._wizardVariants[${i}].quality = this.value" placeholder="e.g. 4K" style="width:100%; padding:7px 8px; border:1px solid var(--gray-200); border-radius:8px; font-size:0.82rem; font-family:var(--font-body);">
                </div>
                <div>
                    <label style="display:block; font-size:0.7rem; font-weight:600; color:var(--gray-400); margin-bottom:4px; text-transform:uppercase;">Duration</label>
                    <div style="display:flex; gap:6px;">
                        <input type="number" value="${v.duration || 1}" oninput="window._wizardVariants[${i}].duration = parseInt(this.value) || 1" style="width:50px; padding:7px 6px; border:1px solid var(--gray-200); border-radius:8px; font-size:0.82rem; font-family:var(--font-body); text-align:center;" min="1">
                        <input type="text" value="${v.durationLabel || ''}" oninput="window._wizardVariants[${i}].durationLabel = this.value" placeholder="1 Month" style="flex:1; padding:7px 8px; border:1px solid var(--gray-200); border-radius:8px; font-size:0.82rem; font-family:var(--font-body);">
                    </div>
                </div>
                <div>
                    <label style="display:block; font-size:0.7rem; font-weight:600; color:var(--gray-400); margin-bottom:4px; text-transform:uppercase;">SKU</label>
                    <input type="text" value="${v.sku || ''}" readonly style="width:100%; padding:7px 8px; border:1px solid var(--gray-100); border-radius:8px; font-size:0.72rem; font-family:monospace; color:var(--gray-400); background:var(--gray-50);" title="${v.sku || ''}">
                </div>
                <div>
                    <label style="display:block; font-size:0.7rem; font-weight:600; color:var(--gray-400); margin-bottom:4px; text-transform:uppercase;">Stock</label>
                    <input type="number" value="${v.stock || 0}" oninput="window._wizardVariants[${i}].stock = parseInt(this.value) || 0" style="width:100%; padding:7px 6px; border:1px solid var(--gray-200); border-radius:8px; font-size:0.82rem; font-family:var(--font-body); text-align:center;" min="0">
                </div>
            </div>
            
            <!-- Pricing Row: INR + USD side by side -->
            <div style="padding:12px 16px; display:grid; grid-template-columns:1fr 1fr; gap:16px;">
                <!-- INR Pricing -->
                <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; padding:10px 14px;">
                    <div style="font-size:0.72rem; font-weight:700; color:#15803d; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px;">🇮🇳 INR Pricing</div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                        <div>
                            <label style="display:block; font-size:0.7rem; font-weight:600; color:var(--gray-500); margin-bottom:3px;">Price (₹)</label>
                            <input type="number" value="${v.price || 0}" oninput="window._wizardVariants[${i}].price = parseInt(this.value) || 0" style="width:100%; padding:7px 8px; border:1px solid #86efac; border-radius:8px; font-size:0.85rem; font-weight:700; font-family:var(--font-body); background:white;" min="0">
                        </div>
                        <div>
                            <label style="display:block; font-size:0.7rem; font-weight:600; color:var(--gray-500); margin-bottom:3px;">MRP (₹)</label>
                            <input type="number" value="${v.originalPrice || 0}" oninput="window._wizardVariants[${i}].originalPrice = parseInt(this.value) || 0" style="width:100%; padding:7px 8px; border:1px solid #86efac; border-radius:8px; font-size:0.85rem; font-family:var(--font-body); background:white; color:var(--gray-500);" min="0">
                        </div>
                    </div>
                </div>
                <!-- USD Pricing -->
                <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:10px; padding:10px 14px;">
                    <div style="font-size:0.72rem; font-weight:700; color:#1d4ed8; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px;">🌐 USD Pricing</div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                        <div>
                            <label style="display:block; font-size:0.7rem; font-weight:600; color:var(--gray-500); margin-bottom:3px;">Price ($)</label>
                            <input type="number" value="${v.price_usd || 0}" step="0.01" oninput="window._wizardVariants[${i}].price_usd = parseFloat(this.value) || 0" style="width:100%; padding:7px 8px; border:1px solid #93c5fd; border-radius:8px; font-size:0.85rem; font-weight:700; font-family:var(--font-body); background:white;" min="0">
                        </div>
                        <div>
                            <label style="display:block; font-size:0.7rem; font-weight:600; color:var(--gray-500); margin-bottom:3px;">MRP ($)</label>
                            <input type="number" value="${v.original_price_usd || 0}" step="0.01" oninput="window._wizardVariants[${i}].original_price_usd = parseFloat(this.value) || 0" style="width:100%; padding:7px 8px; border:1px solid #93c5fd; border-radius:8px; font-size:0.85rem; font-family:var(--font-body); background:white; color:var(--gray-500);" min="0">
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
    
    if (window.lucide) lucide.createIcons();
};

window.wizAddVariant = function() {
    window._wizardVariants.push({
        sku: document.getElementById('wizId').value + '-' + Date.now().toString(36),
        accessType: 'shared',
        duration: 1,
        durationLabel: '1 Month',
        price: 99,
        originalPrice: 199,
        price_usd: 0,
        original_price_usd: 0,
        stock: 10
    });
    wizRenderVariants();
};

window.wizRemoveVariant = function(idx) {
    window._wizardVariants.splice(idx, 1);
    wizRenderVariants();
};

// ── Features Editor ──
window._wizardFeatures = { shared: [], personal: [] };

window.wizRenderFeatures = function() {
    ['shared', 'personal'].forEach(type => {
        const container = document.getElementById(type === 'shared' ? 'wizFeatShared' : 'wizFeatPersonal');
        if (!container) return;
        const feats = (window._wizardFeatures && window._wizardFeatures[type]) || [];
        container.innerHTML = feats.map((f, i) => `
            <div style="display:flex; gap:6px; align-items:center;">
                <input type="text" value="${f}" onchange="wizUpdateFeature('${type}', ${i}, this.value)" 
                       placeholder="e.g. Ad-free, 1 device only, No warranty" 
                       style="flex:1; padding:8px 12px; border:1px solid var(--gray-200); border-radius:var(--radius); font-size:.85rem; font-family:var(--font-body);">
                <button class="action-btn red" onclick="wizRemoveFeature('${type}', ${i})" style="flex-shrink:0;"><i data-lucide="x"></i></button>
            </div>
        `).join('');
        if (window.lucide) lucide.createIcons();
    });
};

window.wizAddFeature = function(type) {
    if (!window._wizardFeatures) window._wizardFeatures = { shared: [], personal: [] };
    if (!window._wizardFeatures[type]) window._wizardFeatures[type] = [];
    window._wizardFeatures[type].push('');
    wizRenderFeatures();
    // Auto-focus the new input
    const container = document.getElementById(type === 'shared' ? 'wizFeatShared' : 'wizFeatPersonal');
    const inputs = container.querySelectorAll('input');
    if (inputs.length) inputs[inputs.length - 1].focus();
};

window.wizRemoveFeature = function(type, idx) {
    window._wizardFeatures[type].splice(idx, 1);
    wizRenderFeatures();
};

window.wizUpdateFeature = function(type, idx, value) {
    window._wizardFeatures[type][idx] = value;
};

window.wizRenderUsageSteps = function() {
    const container = document.getElementById('wizUsageSteps');
    if (!container) return;
    const steps = window._wizardUsageSteps || [];
    if (!steps.length) {
        container.innerHTML = `
            <div style="padding:12px 14px; border:1px dashed var(--gray-200); border-radius:12px; color:var(--gray-500); font-size:.85rem; background:var(--gray-50);">
                No custom steps yet. The storefront will auto-generate setup instructions from the selected setup type.
            </div>`;
        return;
    }
    container.innerHTML = steps.map((step, i) => `
        <div style="display:grid; grid-template-columns:28px 1fr 34px; gap:8px; align-items:center;">
            <span style="width:28px;height:28px;border-radius:9px;background:var(--gray-800);color:white;display:grid;place-items:center;font-size:.75rem;font-weight:800;">${i + 1}</span>
            <input type="text" value="${adminEscapeHtml(step)}" oninput="wizUpdateUsageStep(${i}, this.value)" placeholder="Example: Open the invite link and accept with your own email."
                   style="width:100%; padding:8px 12px; border:1px solid var(--gray-200); border-radius:var(--radius); font-size:.85rem; font-family:var(--font-body);">
            <button class="action-btn red" onclick="wizRemoveUsageStep(${i})" type="button"><i data-lucide="x"></i></button>
        </div>
    `).join('');
    if (window.lucide) lucide.createIcons();
};

window.wizAddUsageStep = function() {
    if (!window._wizardUsageSteps) window._wizardUsageSteps = [];
    window._wizardUsageSteps.push('');
    wizRenderUsageSteps();
    const container = document.getElementById('wizUsageSteps');
    const inputs = container ? container.querySelectorAll('input') : [];
    if (inputs.length) inputs[inputs.length - 1].focus();
};

window.wizRemoveUsageStep = function(idx) {
    if (!window._wizardUsageSteps) window._wizardUsageSteps = [];
    window._wizardUsageSteps.splice(idx, 1);
    wizRenderUsageSteps();
};

window.wizUpdateUsageStep = function(idx, value) {
    if (!window._wizardUsageSteps) window._wizardUsageSteps = [];
    window._wizardUsageSteps[idx] = value;
};

// Auto-generate slug from product name
window.wizAutoSlug = function() {
    if (window._wizSlugManual) return; // Don't overwrite manually edited slugs
    const name = document.getElementById('wizName').value;
    const slug = name.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    document.getElementById('wizSlug').value = slug;
};

// Mark slug as manually edited when user types in it
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const slugInput = document.getElementById('wizSlug');
        if (slugInput) {
            slugInput.addEventListener('input', () => {
                window._wizSlugManual = true;
            });
        }
    }, 500);
});

window.saveProductWizard = async function() {
    const originalId = document.getElementById('wizId').value;
    const slugField = document.getElementById('wizSlug').value.trim();
    const name = document.getElementById('wizName').value.trim();
    
    if (!name) {
        showToast('❌ Product name is required');
        return;
    }
    
    // Validate USD pricing when region_lock = 'global'
    const regionLock = document.getElementById('wizRegionLock').value;
    if (regionLock === 'global' && window._wizardVariants && window._wizardVariants.length > 0) {
        const missingUsd = window._wizardVariants.filter(v => !v.price_usd || v.price_usd <= 0);
        if (missingUsd.length > 0) {
            showToast('❌ USD pricing is required for International Only products. Fill in Price ($) for all variants.');
            return;
        }
    }
    
    // Determine the actual product ID to use
    // If slug is provided, use it. Otherwise fall back to the original auto-generated ID.
    let id = slugField || originalId;
    // Sanitize slug
    id = id.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    if (!id) id = originalId;
    
    const overrides = AdminStore._getObj('getotts_admin_products', {});
    
    // If slug changed from originalId, migrate data and delete old entry
    if (id !== originalId) {
        if (overrides[originalId]) {
            overrides[id] = { ...overrides[originalId], id: id };
        }
        AdminStore.deleteProduct(originalId);
    }
    
    if (!overrides[id]) overrides[id] = { id: id };
    
    overrides[id].id = id;
    overrides[id].name = name;
    overrides[id].category = document.getElementById('wizCategory').value;
    overrides[id].img = document.getElementById('wizImg').value;
    overrides[id].emoji = document.getElementById('wizEmoji').value;
    overrides[id].isActive = document.getElementById('wizActive').checked;
    overrides[id].isHot = document.getElementById('wizHot').checked;
    overrides[id].featured_position = readPositiveIntInput('wizFeaturedPosition');
    overrides[id].featuredPosition = overrides[id].featured_position;
    overrides[id].region_lock = document.getElementById('wizRegionLock').value;
    overrides[id].usage_type = document.getElementById('wizUsageType').value || 'auto';
    overrides[id].usage_note = document.getElementById('wizUsageNote').value || '';
    overrides[id].usage_steps = (window._wizardUsageSteps || []).map(s => String(s || '').trim()).filter(Boolean);
    overrides[id].faqs = adminMergeUsageFaqMeta(overrides[id].faqs, overrides[id].usage_type, overrides[id].usage_steps, overrides[id].usage_note);
    
    overrides[id].delivery_mode = document.getElementById('wizDeliveryMode').value;
    overrides[id].auth_type = document.getElementById('wizAuthType').value;
    
    overrides[id].variants = window._wizardVariants;
    overrides[id].features = window._wizardFeatures || { shared: [], personal: [] };
    
    // Save via AdminStore
    AdminStore.updateProduct(id, overrides[id]);
    
    // Direct Supabase cloud DB sync to ensure USD fields are saved immediately
    try {
        const serviceKey = 'YOUR_SUPABASE_SERVICE_ROLE_KEY';
        const suUrl = (window.GETOTTS_CONFIG && window.GETOTTS_CONFIG.SUPABASE_URL) || 'YOUR_SUPABASE_URL';
        
        let dbProductId = id; 
        if (typeof PRODUCTS !== 'undefined') {
            const found = PRODUCTS.find(p => p.slug === id || p.id === id);
            if (found && found.id && found.id.includes('-')) dbProductId = found.id;
        }

        const dbVariants = (window._wizardVariants || []).map(v => ({
            product_id: dbProductId,
            sku: v.sku || `${id}-${v.accessType || 'shared'}-${v.duration || 1}m`,
            access_type: v.accessType || 'shared',
            quality: v.quality || '',
            duration_months: parseInt(v.duration) || 1,
            duration_label: v.durationLabel || '1 Month',
            price: parseFloat(v.price) || 0,
            original_price: v.originalPrice ? parseFloat(v.originalPrice) : null,
            price_usd: parseFloat(v.price_usd) || 0,
            original_price_usd: v.original_price_usd ? parseFloat(v.original_price_usd) : 0,
            stock: parseInt(v.stock) || 0
        }));

        // Delete old variants
        await fetch(`${suUrl}/rest/v1/product_variants?product_id=eq.${dbProductId}`, {
            method: 'DELETE',
            headers: {
                'apikey': serviceKey,
                'Authorization': `Bearer ${serviceKey}`
            }
        });

        // Insert new variants
        if (dbVariants.length > 0) {
            await fetch(`${suUrl}/rest/v1/product_variants`, {
                method: 'POST',
                headers: {
                    'apikey': serviceKey,
                    'Authorization': `Bearer ${serviceKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(dbVariants)
            });
        }

        // Update product region_lock & meta
        await fetch(`${suUrl}/rest/v1/products?id=eq.${dbProductId}`, {
            method: 'PATCH',
            headers: {
                'apikey': serviceKey,
                'Authorization': `Bearer ${serviceKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                region_lock: regionLock,
                faqs: overrides[id].faqs || [],
                is_featured: document.getElementById('wizHot').checked,
                featured_position: readPositiveIntInput('wizFeaturedPosition'),
                delivery_mode: document.getElementById('wizDeliveryMode').value,
                auth_type: document.getElementById('wizAuthType').value
            })
        });

        // Manually trigger public catalog regeneration to populate cached responses
        try {
            await fetch(`${window.GETOTTS_CONFIG?.API_BASE || 'https://api.getotts.com/api/v1'}/admin/regenerate-catalog`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${serviceKey}` }
            });
        } catch (e) {}
        
        console.log('[Supabase Sync] Saved to live database successfully.');
    } catch (e) {
        console.warn('[Supabase Sync] Direct save error:', e);
    }

    // Re-fetch live catalog to sync PRODUCTS in local scope
    if (typeof syncCatalogFromCloud === 'function') {
        await syncCatalogFromCloud();
    }

    closeProductWizard();
    loadProducts(); // Refresh Grid // Refresh Grid
    showToast(`✅ Product "${name}" saved & syncing to cloud...`);
};

function toggleFeatured(id) {
    const overrides = AdminStore._getObj('getotts_admin_products', {});
    const current = overrides[id]?.isHot ?? PRODUCTS.find(p => p.id === id)?.isHot ?? false;
    AdminStore.updateProduct(id, { isHot: !current });
    loadProducts();
    showToast(current ? 'Removed from featured' : 'Marked as featured ⭐');
}

function editProductStock(id) {
    const product = PRODUCTS.find(p => p.id === id);
    if (!product) return;
    
    // Build a rich edit modal
    const overrides = AdminStore._getObj('getotts_admin_products', {});
    const merged = { ...product, ...(overrides[id] || {}) };
    const usageMeta = adminGetUsageMeta(merged);
    const currentImg = merged.img || `assets/images/${id}.png`;
    
    // Create modal dynamically
    let modal = document.getElementById('productEditModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'productEditModal';
        modal.className = 'modal-overlay';
        document.body.appendChild(modal);
    }
    
    modal.innerHTML = `
        <div class="modal-card" style="max-width:560px">
            <div class="modal-header">
                <h2>Edit: ${product.name}</h2>
                <button class="modal-close" onclick="closeModal('productEditModal')">&times;</button>
            </div>
            <div class="modal-body">
                <div class="add-form">
                    <div class="ck-field">
                        <label>Product Image</label>
                        <div style="display:flex; gap:12px; align-items:center; margin-bottom:8px;">
                            <img id="editProductImgPreview" src="/${currentImg}" alt="Preview" 
                                 style="width:64px; height:64px; border-radius:12px; object-fit:cover; border:1px solid var(--gray-200);">
                            <div style="flex:1">
                                <input type="file" id="editProductImgFile" accept="image/*" 
                                       style="font-size:0.85rem; font-family:var(--font-body);">
                                <div id="editProductImgStatus" style="font-size:0.8rem; color:var(--gray-500); margin-top:4px;">Select an image to upload</div>
                            </div>
                        </div>
                        <button class="btn btn-outline" style="font-size:0.85rem; padding:6px 12px; margin-bottom:8px;" onclick="uploadProductImage('${id}')">
                            📤 Upload to Cloud
                        </button>
                        <div style="font-size:0.75rem; color:var(--gray-400); margin-bottom:4px;">Or paste a URL directly:</div>
                        <input type="text" id="editProductImg" value="${merged.img || ''}" placeholder="assets/images/${id}.png">
                    </div>
                    <div class="ck-field">
                        <label>Description</label>
                        <input type="text" id="editProductDesc" value="${(merged.description || '').replace(/"/g, '&quot;')}" placeholder="Product description">
                    </div>
                    <div class="ck-field">
                        <label>Total Stock</label>
                        <input type="number" id="editProductStock" value="${merged.stock || 0}" min="0">
                    </div>
                    <div class="ck-field">
                        <label>Featured</label>
                        <select id="editProductFeatured">
                            <option value="true" ${merged.isHot ? 'selected' : ''}>Yes ⭐</option>
                            <option value="false" ${!merged.isHot ? 'selected' : ''}>No</option>
                        </select>
                    </div>
                    <div class="ck-field">
                        <label>Active (Visible in Store)</label>
                        <select id="editProductActive">
                            <option value="true" ${merged.isActive !== false ? 'selected' : ''}>Yes, Visible 👀</option>
                            <option value="false" ${merged.isActive === false ? 'selected' : ''}>No, Hidden 🚫</option>
                        </select>
                    </div>
                    <div class="ck-field">
                        <label>Availability Region</label>
                        <select id="editRegionLock">
                            <option value="all" ${merged.region_lock === 'all' || !merged.region_lock ? 'selected' : ''}>Global + India</option>
                            <option value="india" ${merged.region_lock === 'india' ? 'selected' : ''}>India Only</option>
                            <option value="global" ${merged.region_lock === 'global' ? 'selected' : ''}>Global Only</option>
                        </select>
                    </div>
                    <div class="ck-field">
                        <label>Delivery Mode</label>
                        <select id="editDeliveryMode">
                            <option value="automatic" ${merged.delivery_mode === 'automatic' || !merged.delivery_mode ? 'selected' : ''}>Automatic (Assign instantly)</option>
                            <option value="manual" ${merged.delivery_mode === 'manual' ? 'selected' : ''}>Manual (Admin handles fulfillment)</option>
                        </select>
                    </div>
                    <div class="ck-field">
                        <label>Auth Type</label>
                        <select id="editAuthType">
                            <option value="email_password" ${merged.auth_type === 'email_password' || !merged.auth_type ? 'selected' : ''}>Email & Password</option>
                            <option value="phone_otp" ${merged.auth_type === 'phone_otp' ? 'selected' : ''}>Phone & OTP</option>
                            <option value="invite_link" ${merged.auth_type === 'invite_link' ? 'selected' : ''}>Invite Link</option>
                            <option value="app_login" ${merged.auth_type === 'app_login' ? 'selected' : ''}>App Login (Scan QR, etc.)</option>
                        </select>
                    </div>
                    <div class="ck-field">
                        <label>How to Use Setup Type</label>
                        <select id="editUsageType">
                            <option value="auto" ${usageMeta.usage_type === 'auto' || !usageMeta.usage_type ? 'selected' : ''}>Auto detect from plan</option>
                            <option value="shared_account" ${usageMeta.usage_type === 'shared_account' ? 'selected' : ''}>Shared account</option>
                            <option value="shared_link" ${usageMeta.usage_type === 'shared_link' ? 'selected' : ''}>Shared by link</option>
                            <option value="shared_id_password" ${usageMeta.usage_type === 'shared_id_password' ? 'selected' : ''}>Shared ID + password</option>
                            <option value="mail_activation" ${usageMeta.usage_type === 'mail_activation' ? 'selected' : ''}>Mail activation</option>
                            <option value="number_activation" ${usageMeta.usage_type === 'number_activation' ? 'selected' : ''}>Number activation</option>
                            <option value="otp_login" ${usageMeta.usage_type === 'otp_login' ? 'selected' : ''}>Login with OTP</option>
                            <option value="invite_link" ${usageMeta.usage_type === 'invite_link' ? 'selected' : ''}>Invite link</option>
                            <option value="personal_account" ${usageMeta.usage_type === 'personal_account' ? 'selected' : ''}>Personal account</option>
                            <option value="custom" ${usageMeta.usage_type === 'custom' ? 'selected' : ''}>Custom</option>
                        </select>
                    </div>
                    <div class="ck-field">
                        <label>How to Use Note</label>
                        <input type="text" id="editUsageNote" value="${adminEscapeHtml(usageMeta.usage_note || '')}" placeholder="Short note shown under setup steps">
                    </div>
                    <div class="ck-field">
                        <label>Account Type</label>
                        <select id="editAccountType">
                            <option value="shared" ${merged.account_type === 'shared' || !merged.account_type ? 'selected' : ''}>Shared Profile</option>
                            <option value="personal" ${merged.account_type === 'personal' ? 'selected' : ''}>Personal Account</option>
                        </select>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" onclick="closeModal('productEditModal')">Cancel</button>
                <button class="btn btn-primary" onclick="saveProductEdit('${id}')">
                    <i data-lucide="save"></i> Save Changes
                </button>
            </div>
        </div>
    `;
    
    modal.style.display = 'flex';
    
    // Preview image on file select
    setTimeout(() => {
        const fileInput = document.getElementById('editProductImgFile');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        document.getElementById('editProductImgPreview').src = ev.target.result;
                    };
                    reader.readAsDataURL(file);
                }
            });
        }
        if (window.lucide) lucide.createIcons();
    }, 50);
}

async function uploadProductImage(productId) {
    const fileInput = document.getElementById('editProductImgFile');
    const status = document.getElementById('editProductImgStatus');
    
    if (!fileInput || !fileInput.files[0]) {
        status.textContent = '❌ Please select an image file first';
        status.style.color = '#ef4444';
        return;
    }
    
    const file = fileInput.files[0];
    status.textContent = '⏳ Uploading...';
    status.style.color = 'var(--accent)';
    
    const formData = new FormData();
    formData.append('file', file);
    
    const csrfMatch = document.cookie.match(new RegExp('(^| )admin_csrf_token=([^;]+)'));
    const headers = new Headers();
    if (csrfMatch) headers.append('X-CSRF-Token', csrfMatch[2]);
    
    console.log(`[CSRF_DEBUG] uploadProductImage | URL: ${API_BASE}admin/upload-image | has_cookie: ${csrfMatch ? 'yes' : 'no'} | has_X-CSRF-Token_header: ${csrfMatch ? 'yes' : 'no'}`);
    
    try {
        const resp = await fetch(`${API_BASE}/admin/upload-image`, {
            method: 'POST',
            body: formData,
            credentials: 'include',
            headers: headers
        });
        
        const data = await resp.json();
        console.log(`[CSRF_DEBUG] uploadProductImage | Status: ${resp.status} | Body:`, data);
        
        if (resp.ok && data.success) {
            // Save the URL to product overrides and update inputs
            AdminStore.updateProduct(productId, { img: data.url });
            document.getElementById('editProductImgPreview').src = data.url;
            const urlInput = document.getElementById('editProductImg');
            if (urlInput) urlInput.value = data.url;
            status.textContent = '✅ Image uploaded successfully!';
            status.style.color = '#059669';
            showToast('Image uploaded! 🖼️');
        } else {
            status.textContent = `❌ Upload failed: ${data.detail || 'Unknown error'}`;
            status.style.color = '#ef4444';
            console.error('Upload response:', data);
        }
    } catch (err) {
        status.textContent = `❌ Network error: ${err.message}`;
        status.style.color = '#ef4444';
        console.error('Upload error:', err);
    }
}

function saveProductEdit(id) {
    const desc = document.getElementById('editProductDesc')?.value || '';
    const stock = parseInt(document.getElementById('editProductStock')?.value) || 0;
    const featured = document.getElementById('editProductFeatured')?.value === 'true';
    const isActive = document.getElementById('editProductActive')?.value === 'true';
    const region_lock = document.getElementById('editRegionLock')?.value || 'all';
    const delivery_mode = document.getElementById('editDeliveryMode')?.value || 'automatic';
    const auth_type = document.getElementById('editAuthType')?.value || 'email_password';
    const account_type = document.getElementById('editAccountType')?.value || 'shared';
    const usage_type = document.getElementById('editUsageType')?.value || 'auto';
    const usage_note = document.getElementById('editUsageNote')?.value || '';
    
    const img = document.getElementById('editProductImg')?.value || '';
    
    AdminStore.updateProduct(id, {
        description: desc,
        stock: stock,
        isHot: featured,
        isActive: isActive,
        region_lock: region_lock,
        delivery_mode: delivery_mode,
        auth_type: auth_type,
        account_type: account_type,
        usage_type: usage_type,
        usage_note: usage_note,
        faqs: adminMergeUsageFaqMeta((AdminStore.getProducts().find(p => p.id === id || p.slug === id) || {}).faqs, usage_type, [], usage_note),
        img: img
    });
    
    closeModal('productEditModal');
    loadProducts();
    showToast('Product updated ✅');
}

/* ================================================
   CUSTOMERS
   ================================================ */
async function loadCustomers() {
    const body = document.getElementById('customersBody');
    const search = document.getElementById('customerSearch')?.value?.toLowerCase() || '';
    
    // Try fetching from backend first
    let customers = [];
    try {
        const resp = await fetch(`${API_BASE}/admin/customers`);
        if (resp.ok) {
            const data = await resp.json();
            customers = data.customers || [];
        }
    } catch(e) { /* fallback to local */ }
    
    // Fallback to local store
    if (!customers.length) {
        customers = AdminStore.getCustomers(search);
    }

    // Apply search filter
    if (search) {
        customers = customers.filter(c => 
            (c.name || '').toLowerCase().includes(search) ||
            (c.email || '').toLowerCase().includes(search) ||
            (c.phone || '').toLowerCase().includes(search)
        );
    }

    if (!customers.length) {
        body.innerHTML = `<tr><td colspan="8" class="empty-state">No customers${search ? ' matching "' + search + '"' : ''} yet</td></tr>`;
        return;
    }

    function parseDevice(ua) {
        if (!ua) return '—';
        if (ua.includes('iPhone')) return '📱 iPhone';
        if (ua.includes('Android')) return '📱 Android';
        if (ua.includes('Windows')) return '💻 Windows';
        if (ua.includes('Mac')) return '💻 Mac';
        if (ua.includes('Linux')) return '💻 Linux';
        return '🌐 Browser';
    }

    body.innerHTML = customers.map(c => `
        <tr>
            <td><strong>${c.name || '—'}</strong></td>
            <td>
                <div style="font-size:.85rem">${c.email || '—'}</div>
                <div style="font-size:.75rem;color:var(--gray-400)">${c.phone || ''}</div>
            </td>
            <td style="font-size:.8rem">${parseDevice(c.device || c.user_agent || '')}</td>
            <td style="font-size:.8rem">${c.timezone || '—'}</td>
            <td>${c.order_count || c.total_orders || 0}</td>
            <td>₹${(c.total_spent || 0).toLocaleString()}</td>
            <td>₹${(c.wallet_balance || 0).toLocaleString()}</td>
            <td>${formatDate(c.created_at)}</td>
        </tr>
    `).join('');
}

/* ================================================
   COUPONS
   ================================================ */
async function loadCoupons() {
    const body = document.getElementById('couponsBody');
    if (!body) return;

    try {
        const res = await fetch(`${API_BASE}/admin/coupons`);
        const data = await res.json();
        
        const coupons = data.coupons || [];
        if (!coupons.length) {
            body.innerHTML = '<tr><td colspan="7" class="empty-state">No coupons yet. Create one!</td></tr>';
            return;
        }
        body.innerHTML = coupons.map(c => {
            const discountText = c.discount_amount
                ? `₹${c.discount_amount}`
                : `${c.discount_percent}%`;
            return `
            <tr>
                <td><code style="font-weight:700;color:var(--green-600)">${c.code}</code></td>
                <td>${discountText}</td>
                <td>₹${c.min_order || 0}</td>
                <td>${c.max_uses || '∞'}</td>
                <td>${c.used_count || 0}</td>
                <td>
                    <button class="action-btn ${c.is_active ? 'green' : 'red'}" onclick="toggleCoupon('${c.id}')" title="Toggle Active">
                        <i data-lucide="${c.is_active ? 'toggle-right' : 'toggle-left'}"></i>
                    </button>
                </td>
                <td class="action-cell">
                    <button class="action-btn" onclick="editCoupon('${c.id}')" title="Edit">
                        <i data-lucide="edit"></i>
                    </button>
                    <button class="action-btn red" onclick="deleteCoupon('${c.id}')" title="Delete">
                        <i data-lucide="trash-2"></i>
                    </button>
                </td>
            </tr>`;
        }).join('');
        if (window.lucide) lucide.createIcons();
    } catch (err) {
        console.error('Failed to load coupons:', err);
        body.innerHTML = '<tr><td colspan="7" class="empty-state">Failed to load coupons</td></tr>';
    }
}

// Cache coupons for edit modal
let _cachedCoupons = [];
function _getCachedCoupon(id) { return _cachedCoupons.find(c => c.id === id); }

async function showCouponModal(editId = null) {
    document.getElementById('couponEditId').value = editId || '';
    document.getElementById('couponModalTitle').textContent = editId ? 'Edit Coupon' : 'Create Coupon';

    if (editId) {
        try {
            const res = await fetch(`${API_BASE}/admin/coupons`);
            const data = await res.json();
            _cachedCoupons = data.coupons || [];
            const c = _getCachedCoupon(editId);
            if (c) {
                document.getElementById('couponCode').value = c.code;
                document.getElementById('couponPercent').value = c.discount_percent || '';
                document.getElementById('couponAmount').value = c.discount_amount || '';
                document.getElementById('couponMinOrder').value = c.min_order || 0;
                document.getElementById('couponMaxUses').value = c.max_uses || '';
                document.getElementById('couponType').value = c.discount_amount ? 'fixed' : 'percent';
            }
            toggleCouponFields();
            document.getElementById('couponModal').style.display = 'flex';
        } catch (e) { console.error(e); }
    } else {
        document.getElementById('couponCode').value = '';
        document.getElementById('couponPercent').value = '';
        document.getElementById('couponAmount').value = '';
        document.getElementById('couponMinOrder').value = '0';
        document.getElementById('couponMaxUses').value = '1000';
        document.getElementById('couponExpiry').value = '';
        document.getElementById('couponType').value = 'percent';
        toggleCouponFields();
        document.getElementById('couponModal').style.display = 'flex';
    }
}

function toggleCouponFields() {
    const type = document.getElementById('couponType').value;
    document.getElementById('couponPercentField').style.display = type === 'percent' ? 'block' : 'none';
    document.getElementById('couponAmountField').style.display = type === 'fixed' ? 'block' : 'none';
}

async function saveCoupon() {
    const editId = document.getElementById('couponEditId').value;
    const code = document.getElementById('couponCode').value.trim().toUpperCase();
    const type = document.getElementById('couponType').value;
    const percent = parseInt(document.getElementById('couponPercent').value) || 0;
    const amount = parseFloat(document.getElementById('couponAmount').value) || 0;
    const minOrder = parseFloat(document.getElementById('couponMinOrder').value) || 0;
    const maxUses = parseInt(document.getElementById('couponMaxUses').value) || 1000;

    if (!code) { showToast('❌ Enter a coupon code'); return; }

    const payload = {
        code,
        discount_percent: type === 'percent' ? percent : null,
        discount_amount: type === 'fixed' ? amount : null,
        min_order: minOrder,
        max_uses: maxUses
    };

    const url = editId
        ? `${API_BASE}admin/coupons/${editId}`
        : `${API_BASE}admin/coupons`;
    const method = editId ? 'PUT' : 'POST';

    try {
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const data = await res.json();
        
        if (data.success) {
            showToast(editId ? 'Coupon updated' : 'Coupon created! 🎟️');
            closeModal('couponModal');
            loadCoupons();
        } else {
            showToast('❌ ' + (extractApiError(null, data) || 'Failed to save'));
        }
    } catch (err) {
        showToast('❌ Network error');
        console.error(err);
    }
}

function editCoupon(id) { showCouponModal(id); }

async function toggleCoupon(id) {
    try {
        const res = await fetch(`${API_BASE}/admin/coupons`);
        const data = await res.json();
        const c = (data.coupons || []).find(x => x.id === id);
        if (!c) return;

        await fetch(`${API_BASE}/admin/coupons/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_active: !c.is_active }),
        });
        loadCoupons();
        showToast('Coupon toggled');
    } catch (e) { console.error(e); }
}

async function deleteCoupon(id) {
    if (!confirm('Delete this coupon?')) return;

    try {
        await fetch(`${API_BASE}/admin/coupons/${id}`, { method: 'DELETE' });
        loadCoupons();
        showToast('Coupon deleted');
    } catch (e) { console.error(e); }
}

/* ================================================
   ADD INVENTORY
   ================================================ */
function addInventory() {
    const platform = document.getElementById('addPlatform');
    const platformName = platform.options[platform.selectedIndex]?.text || '';
    const platformId = platform.value;
    const email = document.getElementById('addEmail').value.trim();
    const password = document.getElementById('addPassword').value.trim();
    const planType = document.getElementById('addPlan').value;
    const expiry = document.getElementById('addExpiry').value;
    const result = document.getElementById('addResult');

    if (!platformId || !email || !password) {
        result.textContent = '❌ Fill in platform, email, and password';
        result.className = 'add-result error';
        return;
    }

    AdminStore.addInventoryItem({
        platform: platformName,
        platform_id: platformId,
        email,
        password,
        plan_type: planType,
        expiry_date: expiry || null,
    });

    result.textContent = `✅ Added ${email} to inventory!`;
    result.className = 'add-result success';
    document.getElementById('addEmail').value = '';
    document.getElementById('addPassword').value = '';
    loadStats();
}

function bulkAddInventory() {
    const platform = document.getElementById('bulkPlatform');
    const platformName = platform.options[platform.selectedIndex]?.text || '';
    const platformId = platform.value;
    const raw = document.getElementById('bulkAccounts').value.trim();
    const result = document.getElementById('bulkResult');

    if (!platformId || !raw) {
        result.textContent = '❌ Select a platform and paste accounts';
        result.className = 'add-result error';
        return;
    }

    const accounts = raw.split('\n').filter(l => l.includes(':')).map(line => {
        const [email, ...rest] = line.trim().split(':');
        return {
            platform: platformName,
            platform_id: platformId,
            email: email.trim(),
            password: rest.join(':').trim(),
            plan_type: 'shared',
        };
    });

    if (!accounts.length) {
        result.textContent = '❌ No valid accounts found. Use format: email:password';
        result.className = 'add-result error';
        return;
    }

    AdminStore.addInventoryBulk(accounts);
    result.textContent = `✅ Successfully added ${accounts.length} accounts!`;
    result.className = 'add-result success';
    document.getElementById('bulkAccounts').value = '';
    loadStats();
}

/* ================================================
   SETTINGS
   ================================================ */
function loadSettings() {
    const s = AdminStore.getSettings();
    document.getElementById('setSiteName').value = s.site_name || '';
    document.getElementById('setSupportEmail').value = s.support_email || '';
    document.getElementById('setWhatsApp').value = s.whatsapp || '';
    if (document.getElementById('setAdminNotifyNumber')) document.getElementById('setAdminNotifyNumber').value = s.admin_notify_number || '';
    document.getElementById('setInstagram').value = s.instagram || '';
    document.getElementById('setTelegram').value = s.telegram || '';
    document.getElementById('setPaygateUrl').value = s.paygate_url || '';
    document.getElementById('setPaygateKey').value = s.paygate_api_key || '';
    document.getElementById('setUpi').value = s.default_upi || '';
    document.getElementById('setCurrency').value = s.currency || 'INR';
    document.getElementById('setSmtpHost').value = s.smtp_host || '';
    document.getElementById('setSmtpPort').value = s.smtp_port || '';
    document.getElementById('setSmtpUser').value = s.smtp_user || '';
    document.getElementById('setSmtpPass').value = s.smtp_password || '';
    document.getElementById('setSmtpFromName').value = s.smtp_from_name || '';
    document.getElementById('setAutoDeliver').value = s.auto_deliver ? 'true' : 'false';
    document.getElementById('setDeliveryMethod').value = s.delivery_method || 'email';
}

function saveSettings() {
    const settings = {
        site_name: document.getElementById('setSiteName').value,
        support_email: document.getElementById('setSupportEmail').value,
        whatsapp: document.getElementById('setWhatsApp').value,
        admin_notify_number: document.getElementById('setAdminNotifyNumber')?.value || '',
        instagram: document.getElementById('setInstagram').value,
        telegram: document.getElementById('setTelegram').value,
        paygate_url: document.getElementById('setPaygateUrl').value,
        paygate_api_key: document.getElementById('setPaygateKey').value,
        default_upi: document.getElementById('setUpi').value,
        currency: document.getElementById('setCurrency').value,
        smtp_host: document.getElementById('setSmtpHost').value,
        smtp_port: document.getElementById('setSmtpPort').value,
        smtp_user: document.getElementById('setSmtpUser').value,
        smtp_password: document.getElementById('setSmtpPass').value,
        smtp_from_name: document.getElementById('setSmtpFromName').value,
        auto_deliver: document.getElementById('setAutoDeliver').value === 'true',
        delivery_method: document.getElementById('setDeliveryMethod').value,
    };

    AdminStore.saveSettings(settings);
    
    // Sync settings to backend so they persist across ALL browsers
    try {
        fetch(`${API_BASE}/admin/settings/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ settings })
        }).then(r => r.json())
          .then(data => {
              if (data.success) console.log('[Settings] Synced to DB ✅');
              else console.warn('[Settings] Sync response:', data);
          })
          .catch(e => console.warn('[Settings] Backend sync failed:', e));
    } catch(e) {}
    
    const result = document.getElementById('settingsResult');
    result.textContent = '✅ Settings saved & synced to cloud!';
    result.className = 'add-result success';
    setTimeout(() => result.textContent = '', 3000);
}

/* ================================================
   PLATFORMS DROPDOWN
   ================================================ */
function loadPlatformDropdowns() {
    const opts = DEMO_PLATFORMS.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    const placeholder = '<option value="">Select platform</option>';

    ['addPlatform', 'bulkPlatform'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = placeholder + opts;
    });
}

/* ================================================
   AUDIT LOG PREVIEW
   ================================================ */
function loadAuditPreview() {
    const logs = AdminStore.getAuditLog(8);
    const container = document.getElementById('auditLogPreview');
    if (!logs.length) {
        container.innerHTML = '<p class="empty-hint">No activity yet</p>';
        return;
    }
    container.innerHTML = logs.map(l => `
        <div class="audit-item">
            <span class="audit-action">${formatAction(l.action)}</span>
            <span class="audit-time">${formatTimeAgo(l.created_at)}</span>
        </div>
    `).join('');
}

function formatAction(action) {
    const map = {
        'order_created': '🛒 New order created',
        'order_updated': '📝 Order updated',
        'inventory_added': '📦 Inventory added',
        'inventory_bulk_added': '📦 Bulk inventory added',
        'inventory_updated': '✏️ Inventory updated',
        'inventory_deleted': '🗑️ Inventory deleted',
        'product_updated': '🏷️ Product updated',
        'coupon_created': '🎟️ Coupon created',
        'coupon_updated': '✏️ Coupon updated',
        'coupon_deleted': '🗑️ Coupon deleted',
        'settings_updated': '⚙️ Settings saved',
    };
    return map[action] || action;
}

/* ================================================
   MODALS
   ================================================ */
function closeModal(id) {
    document.getElementById(id).style.display = 'none';
}

// Close modal on overlay click
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.style.display = 'none';
    }
});

/* ================================================
   HELPERS
   ================================================ */
function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

function formatTimeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

function showToast(msg) {
    // Simple toast
    let toast = document.getElementById('adminToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'adminToast';
        toast.className = 'admin-toast';
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
}

/* ================================================
   WHATSAPP MONITOR — Auto-Verify Integration
   ================================================ */

const WA_MONITOR = (window.GETOTTS_CONFIG && window.GETOTTS_CONFIG.WA_MONITOR_URL) || 'http://localhost:3100';

let _waStatusInterval = null;

/**
 * Main refresh function for WhatsApp tab
 */
function refreshWaHub() {
    checkWaMonitorStatus();
    loadPendingCodes();
    loadWaStats();
    loadWaLiveMessages();
    loadWaMessageLog();
}

/**
 * Check WhatsApp monitor service status and show QR if needed
 */
async function checkWaMonitorStatus() {
    const badge = document.getElementById('waConnectionBadge');
    const setupContent = document.getElementById('waSetupContent');
    const setupCard = document.getElementById('waSetupCard');

    try {
        // Check QR status
        const qrRes = await fetch(`${WA_MONITOR}/qr`, { credentials: 'omit', signal: AbortSignal.timeout(5000) });
        const qrData = await qrRes.json();

        if (qrData.status === 'connected') {
            // ✅ Connected!
            if (badge) {
                badge.className = 'pill pill-paid';
                badge.textContent = '🟢 Connected';
            }
            if (setupCard) setupCard.style.borderColor = '#25D366';

            const info = qrData.info || {};
            setupContent.innerHTML = `
                <div style="display:flex;align-items:center;gap:20px;padding:8px">
                    <div style="width:60px;height:60px;border-radius:16px;background:#25D366;display:flex;align-items:center;justify-content:center;flex-shrink:0">
                        <svg viewBox="0 0 24 24" fill="white" style="width:32px;height:32px"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    </div>
                    <div style="flex:1">
                        <div style="font-size:1.1rem;font-weight:700;color:var(--gray-800)">WhatsApp Connected ✅</div>
                        <div style="font-size:.85rem;color:var(--gray-500);margin-top:4px">
                            📱 ${info.phone || 'Phone'} · 👤 ${info.name || 'Admin'} · 🌐 ${info.platform || 'web'}
                        </div>
                        <div style="font-size:.78rem;color:#25D366;margin-top:6px;font-weight:600">
                            Auto-verify is active. Login codes will be verified automatically.
                        </div>
                    </div>
                    <button class="btn" onclick="disconnectWa()" style="background:#fee2e2;color:#ef4444;border:none;padding:8px 16px;border-radius:8px;font-size:.8rem;cursor:pointer">
                        Disconnect
                    </button>
                </div>
            `;

            // Stop QR polling, start status polling
            startWaStatusPolling();
            return;

        } else if (qrData.status === 'scan_required' && qrData.qr) {
            // 📱 QR Code — need to scan
            if (badge) {
                badge.className = 'pill pill-pending';
                badge.textContent = '📱 Scan QR';
            }
            if (setupCard) setupCard.style.borderColor = '#f59e0b';

            setupContent.innerHTML = `
                <div style="text-align:center;padding:16px">
                    <p style="font-size:.9rem;color:var(--gray-700);font-weight:600;margin-bottom:12px">
                        Scan this QR code with your WhatsApp
                    </p>
                    <img src="${qrData.qr}" alt="WhatsApp QR Code" style="width:260px;height:260px;border-radius:12px;border:3px solid var(--gray-100);margin:0 auto;display:block">
                    <p style="font-size:.78rem;color:var(--gray-400);margin-top:12px">
                        Open WhatsApp on your phone → Settings → Linked Devices → Link a Device
                    </p>
                </div>
            `;

            // Keep polling for QR updates
            if (!_waStatusInterval) {
                _waStatusInterval = setInterval(checkWaMonitorStatus, 3000);
            }
            return;

        } else {
            // ⏳ Waiting for QR
            if (badge) {
                badge.className = 'pill pill-pending';
                badge.textContent = '⏳ Initializing...';
            }
            setupContent.innerHTML = `
                <div style="text-align:center;padding:20px">
                    <div style="font-size:2rem;margin-bottom:12px">⏳</div>
                    <p style="color:var(--gray-500);font-size:.85rem">${qrData.message || 'Initializing WhatsApp Web... QR will appear shortly.'}</p>
                </div>
            `;

            if (!_waStatusInterval) {
                _waStatusInterval = setInterval(checkWaMonitorStatus, 3000);
            }
        }

    } catch (err) {
        // Monitor service not reachable
        if (badge) {
            badge.className = 'pill pill-failed';
            badge.textContent = '🔴 Offline';
        }
        if (setupCard) setupCard.style.borderColor = '#ef4444';

        setupContent.innerHTML = `
            <div style="text-align:center;padding:20px">
                <div style="font-size:2rem;margin-bottom:12px">🔌</div>
                <p style="color:#ef4444;font-weight:600;margin-bottom:8px">WhatsApp Monitor is offline</p>
                <p style="color:var(--gray-400);font-size:.82rem;margin-bottom:16px">
                    The WhatsApp monitor service needs to be running for auto-verification.<br>
                    Manual verification via wa.me links is still available below.
                </p>
                <p style="color:var(--gray-400);font-size:.78rem">
                    <!-- Service URL Hidden -->
                </p>
            </div>
        `;
    }
}

function startWaStatusPolling() {
    if (_waStatusInterval) clearInterval(_waStatusInterval);
    _waStatusInterval = setInterval(async () => {
        try {
            const res = await fetch(`${WA_MONITOR}/status`, { credentials: 'omit', signal: AbortSignal.timeout(3000) });
            const data = await res.json();
            const badge = document.getElementById('waConnectionBadge');
            if (data.connected) {
                if (badge) { badge.className = 'pill pill-paid'; badge.textContent = '🟢 Connected'; }
            } else {
                if (badge) { badge.className = 'pill pill-failed'; badge.textContent = '🔴 Disconnected'; }
                checkWaMonitorStatus(); // Try to get QR
            }
        } catch {
            const badge = document.getElementById('waConnectionBadge');
            if (badge) { badge.className = 'pill pill-failed'; badge.textContent = '🔴 Offline'; }
        }
    }, 10000);
}

/**
 * Toggle auto-verify on the monitor service
 */
async function toggleAutoVerify(enabled) {
    try {
        await fetch(`${WA_MONITOR}/auto-verify`, {
            method: 'POST',
            credentials: 'omit',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled }),
        });
        showToast(enabled ? '⚡ Auto-verify enabled!' : '⚡ Auto-verify disabled — manual mode');
    } catch {
        showToast('❌ Could not reach WhatsApp monitor');
    }
}

/**
 * Disconnect WhatsApp session
 */
async function disconnectWa() {
    if (!confirm('Disconnect WhatsApp? You will need to scan the QR code again.')) return;
    try {
        await fetch(`${WA_MONITOR}/logout`, { method: 'POST', credentials: 'omit' });
        showToast('WhatsApp disconnected');
        setTimeout(checkWaMonitorStatus, 2000);
    } catch {
        showToast('❌ Failed to disconnect');
    }
}

/**
 * Send order update directly via WhatsApp (not wa.me link)
 */
async function sendWaDirectMessage() {
    const phone = document.getElementById('waPhone')?.value.trim();
    const orderNumber = document.getElementById('waOrderNumber')?.value.trim();
    const messageType = document.getElementById('waMessageType')?.value || 'processing';
    const resultDiv = document.getElementById('waLinkResult');

    if (!phone || !orderNumber) {
        showToast('❌ Phone and order number required');
        return;
    }

    const body = { phone, order_number: orderNumber, type: messageType };
    if (messageType === 'credentials') {
        body.credentials = {
            email: document.getElementById('waCredEmail')?.value.trim() || '',
            password: document.getElementById('waCredPassword')?.value.trim() || '',
            profile: document.getElementById('waCredProfile')?.value.trim() || 'Any available',
        };
    }
    if (messageType === 'custom') {
        body.message = document.getElementById('waCustomMsg')?.value.trim() || '';
    }

    // Try sending directly via monitor first
    try {
        const res = await fetch(`${WA_MONITOR}/send-order-update`, {
            method: 'POST',
            credentials: 'omit',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const data = await res.json();
        if (data.success) {
            resultDiv.innerHTML = `
                <div style="background:rgba(37,211,102,.06);border:1px solid rgba(37,211,102,.2);border-radius:12px;padding:16px;margin-top:8px">
                    <p style="font-weight:600;color:#25D366;margin-bottom:4px">✅ Message sent directly via WhatsApp!</p>
                    <p style="font-size:.82rem;color:var(--gray-500)">Delivered to ${phone}</p>
                </div>
            `;
            showToast('✅ Sent directly via WhatsApp!');
            loadWaLiveMessages();
            return;
        }
    } catch {}

    // Fallback: use wa.me link via backend
    sendWaOrderUpdate();
}

/**
 * Load live messages from the WA monitor
 */
async function loadWaLiveMessages() {
    const container = document.getElementById('waMessageLog');
    if (!container) return;

    try {
        const res = await fetch(`${WA_MONITOR}/messages?limit=30`, { credentials: 'omit', signal: AbortSignal.timeout(3000) });
        const data = await res.json();

        if (!data.success || !data.messages.length) {
            // Fall back to backend message log
            loadWaMessageLog();
            return;
        }

        const typeEmoji = {
            incoming: '📩', outgoing: '📤', login_code: '🔑',
            order_update: '📦',
        };

        container.innerHTML = data.messages.map(m => {
            const emoji = typeEmoji[m.type] || '💬';
            const time = m.timestamp ? formatTimeAgo(m.timestamp) : '';
            const verified = m.auto_verified ? ' · <span style="color:#25D366;font-weight:600">✅ Auto-verified</span>' : '';
            return `
                <div class="wa-log-item" style="${m.type === 'login_code' ? 'background:rgba(37,211,102,.06);border-left:3px solid #25D366' : ''}">
                    <div class="wa-log-emoji">${emoji}</div>
                    <div class="wa-log-info">
                        <div class="wa-log-title">
                            <strong>${m.type?.replace(/_/g, ' ').toUpperCase()}</strong>
                            <span style="color:var(--gray-400)">${m.type === 'outgoing' ? '→' : '←'} ${m.from || m.name || ''}</span>
                        </div>
                        <div class="wa-log-meta">
                            ${m.body?.substring(0, 60) || '—'} · ${time}${verified}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

    } catch {
        // Fallback to backend log
        loadWaMessageLog();
    }
}

/* ================================================
   WHATSAPP HUB — Fallback Admin Functions
   ================================================ */

// Auto-refresh interval for pending codes
let _waPollInterval = null;


/**
 * Load and display pending WhatsApp login verification codes.
 */
async function loadPendingCodes() {
    const container = document.getElementById('waPendingList');
    if (!container) return;
    container.innerHTML = '<div class="empty-hint" style="opacity:.5">Loading...</div>';

    try {
        const res = await fetch(`${API_BASE}/admin/wa-auth/pending`);
        const data = await res.json();

        if (!data.success || !data.pending.length) {
            container.innerHTML = '<div class="empty-hint">No pending codes. Waiting for customers...</div>';
            updateWaStat('waPendingCount', 0);
            return;
        }

        updateWaStat('waPendingCount', data.count);

        container.innerHTML = data.pending.map(s => {
            const mins = Math.floor((s.remaining_seconds || 0) / 60);
            const secs = (s.remaining_seconds || 0) % 60;
            const timeStr = `${mins}:${String(secs).padStart(2, '0')}`;
            const phoneDisplay = s.phone || 'Not provided';
            const nameDisplay = s.name || 'Anonymous';

            return `
                <div class="wa-pending-item" id="wa-item-${s.code}">
                    <div class="wa-pending-info">
                        <div class="wa-pending-code">
                            <span class="wa-code-label">GETOTTS-LOGIN-</span>
                            <span class="wa-code-hash">${s.code}</span>
                        </div>
                        <div class="wa-pending-meta">
                            <span>📱 ${phoneDisplay}</span>
                            <span>👤 ${nameDisplay}</span>
                            <span class="wa-pending-timer">⏱ ${timeStr}</span>
                        </div>
                    </div>
                    <div class="wa-pending-actions">
                        <button class="btn btn-sm" style="background:#25D366;color:white;padding:8px 16px;border-radius:8px;font-weight:600;border:none;cursor:pointer" onclick="verifyWaCode('${s.code}', '${s.phone || ''}', '${s.name || ''}')">
                            ✅ Verify
                        </button>
                        <button class="btn btn-sm" style="background:#ef4444;color:white;padding:8px 16px;border-radius:8px;font-weight:600;border:none;cursor:pointer" onclick="rejectWaCode('${s.code}')">
                            ✖ Reject
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // Start auto-refresh if not already
        if (!_waPollInterval) {
            _waPollInterval = setInterval(loadPendingCodes, 5000);
        }
    } catch (err) {
        console.error('[WA-Admin]', err);
        container.innerHTML = '<div class="empty-hint" style="color:#ef4444">Failed to load. Is the backend running?</div>';
    }
}

/**
 * Verify a WhatsApp login code — logs the customer in.
 * Admin must enter the sender's real phone number from WhatsApp Web.
 */
async function verifyWaCode(code, phone, name) {
    const item = document.getElementById(`wa-item-${code}`);

    // If no valid phone, show inline input for admin to enter it
    const cleanPhone = (phone || '').replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length > 13 || cleanPhone.length < 10) {
        // Show inline phone input
        if (item) {
            const actionsDiv = item.querySelector('.wa-pending-actions');
            if (actionsDiv && !actionsDiv.querySelector('.wa-phone-inline')) {
                actionsDiv.innerHTML = `
                    <div class="wa-phone-inline" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                        <input type="tel" id="wa-phone-${code}" placeholder="91XXXXXXXXXX" maxlength="12"
                            style="padding:8px 12px;border:2px solid #25D366;border-radius:8px;font-size:.9rem;width:140px;font-weight:600;outline:none;"
                            oninput="this.value=this.value.replace(/\\D/g,'');">
                        <button class="btn btn-sm" style="background:#25D366;color:white;padding:8px 16px;border-radius:8px;font-weight:600;border:none;cursor:pointer"
                            onclick="submitWaPhone('${code}', '${name || ''}')">
                            ✅ Confirm
                        </button>
                        <button class="btn btn-sm" style="background:#ef4444;color:white;padding:6px 12px;border-radius:8px;font-weight:600;border:none;cursor:pointer;font-size:.8rem"
                            onclick="rejectWaCode('${code}')">✖</button>
                    </div>
                    <div style="font-size:.72rem;color:var(--gray-400);margin-top:4px;">Enter sender's phone from WhatsApp Web</div>
                `;
                const input = document.getElementById(`wa-phone-${code}`);
                if (input) input.focus();
            }
        }
        return;
    }

    // Proceed with verification
    if (item) {
        item.style.opacity = '0.5';
        const btn = item.querySelector('.btn');
        if (btn) btn.setAttribute('disabled', 'true');
    }

    try {
        const res = await fetch(`${API_BASE}/admin/wa-auth/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, phone: cleanPhone, name }),
        });
        const data = await res.json();

        if (data.success) {
            showToast(`✅ Code ${code} verified! Customer logged in.`);
            // Animate removal
            if (item) {
                item.style.background = 'rgba(37, 211, 102, 0.08)';
                item.innerHTML = `
                    <div style="display:flex;align-items:center;gap:8px;padding:8px">
                        <span style="font-size:1.4rem">✅</span>
                        <div>
                            <strong>${code}</strong> — Verified!
                            <div style="font-size:.8rem;color:var(--gray-400)">Customer: ${data.customer?.name || name || 'User'} (${cleanPhone})</div>
                        </div>
                    </div>
                `;
                setTimeout(() => {
                    item.style.transition = 'all .3s ease';
                    item.style.height = '0';
                    item.style.opacity = '0';
                    item.style.overflow = 'hidden';
                    item.style.padding = '0';
                    item.style.margin = '0';
                    setTimeout(() => item.remove(), 300);
                }, 2000);
            }
            loadWaStats();
        } else {
            showToast('❌ Verification failed: ' + (extractApiError(null, data) || 'Unknown error'));
            if (item) item.style.opacity = '1';
        }
    } catch (err) {
        console.error('[WA-Admin]', err);
        showToast('❌ Network error during verification');
        if (item) item.style.opacity = '1';
    }
}

/**
 * Submit the phone number admin entered in the inline input.
 */
function submitWaPhone(code, name) {
    const input = document.getElementById(`wa-phone-${code}`);
    const phone = input ? input.value.replace(/\D/g, '') : '';
    if (!phone || phone.length < 10 || phone.length > 12) {
        if (input) {
            input.style.borderColor = '#ef4444';
            input.placeholder = 'Enter valid number!';
        }
        return;
    }
    verifyWaCode(code, phone, name);
}

/**
 * Reject a suspicious login code.
 */
async function rejectWaCode(code) {
    if (!confirm(`Reject login code ${code}? The customer will need to request a new code.`)) return;

    try {
        const res = await fetch(`${API_BASE}/admin/wa-auth/reject`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code }),
        });
        const data = await res.json();

        if (data.success) {
            showToast(`🚫 Code ${code} rejected.`);
            const item = document.getElementById(`wa-item-${code}`);
            if (item) {
                item.style.transition = 'all .3s ease';
                item.style.height = '0';
                item.style.opacity = '0';
                item.style.overflow = 'hidden';
                setTimeout(() => item.remove(), 300);
            }
        }
    } catch (err) {
        showToast('❌ Failed to reject code');
    }
}

/**
 * Load WhatsApp auth stats.
 */
async function loadWaStats() {
    try {
        const res = await fetch(`${API_BASE}/wa-auth/stats`);
        const data = await res.json();
        if (data.success && data.stats) {
            updateWaStat('waPendingCount', data.stats.pending_codes);
            updateWaStat('waVerifiedCount', data.stats.verified_today);
            updateWaStat('waActiveCount', data.stats.active_sessions);
            updateWaStat('waMessagesCount', data.stats.messages_sent);
        }
    } catch (err) {
        console.warn('[WA-Admin] Stats load failed:', err);
    }
}

function updateWaStat(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

/**
 * Toggle credential / custom fields based on message type selection.
 */
function toggleWaCredFields() {
    const type = document.getElementById('waMessageType')?.value;
    const credFields = document.getElementById('waCredFields');
    const customField = document.getElementById('waCustomField');

    if (credFields) credFields.style.display = type === 'credentials' ? 'block' : 'none';
    if (customField) customField.style.display = type === 'custom' ? 'block' : 'none';
}

/**
 * Send an order update via WhatsApp Web (generates wa.me link).
 */
async function sendWaOrderUpdate() {
    const phone = document.getElementById('waPhone')?.value.trim();
    const orderNumber = document.getElementById('waOrderNumber')?.value.trim();
    const messageType = document.getElementById('waMessageType')?.value || 'status';
    const resultDiv = document.getElementById('waLinkResult');

    if (!phone) {
        showToast('❌ Phone number is required');
        return;
    }
    if (!orderNumber) {
        showToast('❌ Order number is required');
        return;
    }

    const body = {
        phone,
        order_number: orderNumber,
        type: messageType,
    };

    // Add credentials if sending credentials message
    if (messageType === 'credentials') {
        body.credentials = {
            email: document.getElementById('waCredEmail')?.value.trim() || '',
            password: document.getElementById('waCredPassword')?.value.trim() || '',
            profile: document.getElementById('waCredProfile')?.value.trim() || 'Any available',
        };
    }

    // Add custom message if custom type
    if (messageType === 'custom') {
        body.message = document.getElementById('waCustomMsg')?.value.trim() || '';
        if (!body.message) {
            showToast('❌ Please enter a custom message');
            return;
        }
    }

    try {
        const res = await fetch(`${API_BASE}/admin/wa-auth/send-order-update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const data = await res.json();

        if (data.success) {
            resultDiv.innerHTML = `
                <div style="background:rgba(37,211,102,.06);border:1px solid rgba(37,211,102,.2);border-radius:12px;padding:16px;margin-top:8px">
                    <p style="font-weight:600;color:#25D366;margin-bottom:8px">✅ Message ready!</p>
                    <p style="font-size:.82rem;color:var(--gray-500);margin-bottom:12px">Click the button below to send via WhatsApp Web:</p>
                    <a href="${data.wa_link}" target="_blank" 
                       style="display:inline-flex;align-items:center;gap:8px;background:#25D366;color:white;padding:10px 20px;border-radius:10px;text-decoration:none;font-weight:600;font-size:.9rem;transition:all .2s ease"
                       onmouseover="this.style.background='#1da851'" onmouseout="this.style.background='#25D366'">
                        <svg viewBox="0 0 24 24" fill="currentColor" style="width:18px;height:18px"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                        Send on WhatsApp Web
                    </a>
                    <details style="margin-top:12px">
                        <summary style="font-size:.8rem;color:var(--gray-400);cursor:pointer">Preview message</summary>
                        <pre style="background:var(--gray-50);border-radius:8px;padding:12px;margin-top:8px;font-size:.78rem;white-space:pre-wrap;color:var(--gray-600)">${data.message}</pre>
                    </details>
                </div>
            `;
            showToast('✅ WhatsApp link generated!');
            loadWaMessageLog();
        } else {
            resultDiv.innerHTML = `<p style="color:#ef4444">Error: ${data.detail || 'Failed'}</p>`;
        }
    } catch (err) {
        console.error('[WA-Admin]', err);
        resultDiv.innerHTML = '<p style="color:#ef4444">Network error. Is the backend running?</p>';
    }
}

/**
 * Load the WhatsApp message log.
 */
async function loadWaMessageLog() {
    const container = document.getElementById('waMessageLog');
    if (!container) return;

    try {
        const res = await fetch(`${API_BASE}/admin/wa-auth/message-log?limit=30`);
        const data = await res.json();

        if (!data.success || !data.messages.length) {
            container.innerHTML = '<div class="empty-hint">No messages sent yet</div>';
            return;
        }

        const typeEmoji = {
            processing: '⏳',
            on_the_way: '🚀',
            delivered: '✅',
            credentials: '🔐',
            invoice: '🧾',
            renewal_reminder: '🔔',
            custom: '✏️',
            status: '📋',
        };

        container.innerHTML = data.messages.map(m => {
            const emoji = typeEmoji[m.type] || '📨';
            const time = m.sent_at ? formatTimeAgo(m.sent_at) : '';
            return `
                <div class="wa-log-item">
                    <div class="wa-log-emoji">${emoji}</div>
                    <div class="wa-log-info">
                        <div class="wa-log-title">
                            <strong>${m.type?.replace(/_/g, ' ').toUpperCase()}</strong>
                            <span style="color:var(--gray-400)">→ ${m.phone}</span>
                        </div>
                        <div class="wa-log-meta">
                            Order: ${m.order_number || '—'} · ${time}
                        </div>
                    </div>
                    <a href="${m.wa_link}" target="_blank" class="wa-log-resend" title="Resend">
                        <i data-lucide="external-link" style="width:14px;height:14px"></i>
                    </a>
                </div>
            `;
        }).join('');

        if (window.lucide) lucide.createIcons();
    } catch (err) {
        container.innerHTML = '<div class="empty-hint">Failed to load message log</div>';
    }
}

// Stop WhatsApp polling when leaving tab
function stopWaPolling() {
    if (_waPollInterval) {
        clearInterval(_waPollInterval);
        _waPollInterval = null;
    }
}

/* ================================================
   WALLET & VOUCHERS MANAGEMENT
   ================================================ */

async function loadAdminVouchers() {
    const body = document.getElementById('vouchersTableBody');
    if (!body) return;
    
    try {
        const res = await fetch(`${API_BASE}/vouchers/admin/list`);
        const data = await res.json();
        
        if (!data.success || !data.vouchers || data.vouchers.length === 0) {
            body.innerHTML = '<tr><td colspan="5" class="empty-state">No vouchers found</td></tr>';
            document.getElementById('statActiveVouchers').textContent = '0';
            return;
        }

        const activeCount = data.vouchers.filter(v => v.status === 'active').length;
        document.getElementById('statActiveVouchers').textContent = activeCount;

        body.innerHTML = data.vouchers.map(v => `
            <tr>
                <td><code style="font-weight:700; color:var(--gray-900)">${v.code}</code></td>
                <td>₹${v.amount}</td>
                <td><span class="pill pill-${v.status}">${v.status}</span></td>
                <td>${formatDate(v.created_at)}</td>
                <td class="action-cell">
                    ${v.status === 'active' ? `
                        <button class="action-btn red" onclick="revokeVoucher('${v.id}')" title="Revoke Voucher">
                            <i data-lucide="x-circle"></i>
                        </button>
                    ` : '—'}
                </td>
            </tr>
        `).join('');
        
        if (window.lucide) lucide.createIcons();
        
        // Also update total wallet credits stat from customers
        loadWalletStats();
    } catch (err) {
        body.innerHTML = '<tr><td colspan="5" class="empty-state">Error loading vouchers</td></tr>';
    }
}

async function loadWalletStats() {
    // Already handled by loadStats if calling /admin/stats
    // But we can re-call loadStats to be sure it's fresh
    await loadStats();
}

async function showVoucherCreateModal() {
    const code = prompt("Enter custom voucher code (optional - leave blank for auto):");
    const amount = prompt("Enter voucher amount (₹):");
    if (!amount || isNaN(amount)) return;

    try {
        const res = await fetch(`${API_BASE}/vouchers/admin/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: code || null, amount: parseFloat(amount) })
        });
        const data = await res.json();
        if (data.success) {
            showToast('✅ Voucher created!');
            loadAdminVouchers();
        } else {
            showToast('❌ Failed: ' + (extractApiError(null, data) || 'Error'));
        }
    } catch (e) {
        showToast('❌ Network error');
    }
}

async function showBulkGenerateModal() {
    const count = prompt("How many vouchers to generate?");
    const amount = prompt("Amount per voucher (₹)?");
    const prefix = prompt("Code Prefix (default: VCH)?") || "VCH";
    
    if (!count || !amount || isNaN(count) || isNaN(amount)) return;

    showToast('⏳ Generating vouchers...');
    try {
        const res = await fetch(`${API_BASE}/vouchers/admin/bulk-generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ count: parseInt(count), amount: parseFloat(amount), prefix })
        });
        const data = await res.json();
        if (data.success) {
            showToast(`✅ Successfully generated ${data.count} vouchers!`);
            loadAdminVouchers();
        } else {
            showToast('❌ Generation failed');
        }
    } catch (e) {
        showToast('❌ Network error');
    }
}

async function revokeVoucher(id) {
    if (!confirm("Revoke this voucher? It will no longer be redeemable.")) return;
    try {
        const res = await fetch(`${API_BASE}/vouchers/admin/revoke/${id}`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            showToast('Voucher revoked 🚫');
            loadAdminVouchers();
        }
    } catch (e) {
        showToast('Error revoking voucher');
    }
}

async function loadAuditLogs() {
    const el = document.getElementById('walletAuditLogs');
    if (!el) return;
    
    try {
        const res = await fetch(`${API_BASE}/vouchers/admin/audit-logs`);
        const data = await res.json();
        
        if (!data.success || !data.logs || data.logs.length === 0) {
            el.innerHTML = '<p class="empty-hint">No audit logs found</p>';
            return;
        }

        el.innerHTML = data.logs.map(log => `
            <div class="audit-item" style="padding:12px; border-bottom:1px solid var(--gray-50)">
                <div style="flex:1">
                    <div style="font-weight:700; color:var(--gray-800)">${log.action.replace(/_/g, ' ').toUpperCase()}</div>
                    <div style="font-size:0.75rem; color:var(--gray-500)">
                        ${JSON.stringify(log.details)}
                    </div>
                </div>
                <div style="text-align:right">
                    <div style="font-size:0.75rem; color:var(--gray-400)">${formatDate(log.created_at)}</div>
                    ${log.customer_id ? `<div style="font-size:0.7rem; color:var(--accent)">Customer: ${log.customer_id.substring(0,8)}</div>` : ''}
                </div>
            </div>
        `).join('');
    } catch (err) {
        el.innerHTML = '<p class="empty-hint">Error loading logs</p>';
    }
}

async function adminAdjustWallet() {
    const customer = document.getElementById('adjCustomer').value.trim();
    const amount = document.getElementById('adjAmount').value;
    const type = document.getElementById('adjType').value;
    const reason = document.getElementById('adjReason').value.trim();

    if (!customer || !amount || !reason) {
        showToast('❌ Please fill all fields');
        return;
    }

    if (!confirm(`Are you sure you want to ${type} ₹${amount} for this customer?`)) return;

    try {
        // Resolve customer ID if email was provided
        let customerId = customer;
        if (customer.includes('@')) {
            const c_res = await fetch(`${API_BASE}/admin/customers`);
            const c_data = await c_res.json();
            const found = (c_data.customers || []).find(c => c.email.toLowerCase() === customer.toLowerCase());
            if (found) customerId = found.id;
            else {
                showToast('❌ Customer email not found');
                return;
            }
        }

        const res = await fetch(`${API_BASE}/vouchers/admin/adjust`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                customer_id: customerId, 
                amount: parseFloat(amount), 
                type, 
                reason 
            })
        });
        
        const data = await res.json();
        if (data.success) {
            showToast(`✅ Wallet adjusted! New balance: ₹${data.new_balance}`);
            document.getElementById('adjAmount').value = '';
            document.getElementById('adjReason').value = '';
            loadAuditLogs();
            loadWalletStats();
        } else {
            showToast('❌ Error: ' + (extractApiError(null, data) || 'Error'));
        }
    } catch (e) {
        showToast('❌ Adjustment failed');
    }
}

window.factoryResetAdmin = async function() {
    if (!confirm("⚠️ FACTORY RESET?\n\nThis will:\n1. Clear all local overrides in your browser\n2. Restore the original 14 products (Netflix, Prime, etc.)\n3. Sync the clean catalog to the cloud\n\nThis will solve duplicates and broken images. Continue?")) return;
    
    // 1. Clear local overrides
    localStorage.removeItem('getotts_admin_products');
    
    // 2. Prepare the clean fallback catalog
    const fallback = (typeof FALLBACK_PRODUCTS !== 'undefined') ? FALLBACK_PRODUCTS : [];
    if (fallback.length === 0) {
        showToast("❌ Error: Fallback catalog not found.");
        return;
    }
    
    showToast("🧹 Cleaning local data...");
    
    // 3. Force Sync to Cloud
    try {
        const API = (window.GETOTTS_CONFIG && window.GETOTTS_CONFIG.API_BASE) || 'https://api.getotts.com/api/v1';
        const resp = await fetch(`${API}/admin/catalog/migrate`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ products: fallback })
        });
        
        if (resp.ok) {
            showToast("✅ Factory Reset Complete! Reloading...");
            setTimeout(() => window.location.reload(), 2000);
        } else {
            throw new Error(await resp.text());
        }
    } catch (err) {
        console.error("[Reset Error]", err);
        showToast("❌ Reset failed during sync. Check console.");
    }
};

