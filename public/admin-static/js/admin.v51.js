// Global fetch override to inject CSRF token.

const originalFetch = window.fetch;
window.fetch = async function() {
    let [resource, config] = arguments;
    if (!config) config = {};
    if (!config.credentials) config.credentials = 'include'; // Ensure cookies are sent (CSRF + Auth)

    if (config.method && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(config.method.toUpperCase())) {
        if (!config.headers) config.headers = {};
        const csrfToken = getAdminCsrfToken();
        if (csrfToken) {
            if (config.headers instanceof Headers) {
                if (!config.headers.has('X-CSRF-Token')) {
                    config.headers.set('X-CSRF-Token', csrfToken);
                }
            } else {
                if (!config.headers['X-CSRF-Token']) {
                    config.headers['X-CSRF-Token'] = csrfToken;
                }
            }
        } else {
            console.warn('[Fetch-CSRF] Mutating request made but csrf_token cookie not found in document.cookie');
        }
    }
    return originalFetch(resource, config);
};

// adminFetch -- authenticated fetch wrapper for admin API calls.
// Uses the global fetch override above (which auto-injects CSRF tokens).
async function adminFetch(url, options = {}) {
    const timeoutMs = options.timeoutMs || 15000;
    const fetchOptions = { ...options };
    delete fetchOptions.timeoutMs;

    let timeoutId = null;
    if (!fetchOptions.signal && timeoutMs && typeof AbortController !== 'undefined') {
        const controller = new AbortController();
        fetchOptions.signal = controller.signal;
        timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    }

    if (!fetchOptions.credentials) fetchOptions.credentials = 'include';
    // Auto-set Content-Type for JSON bodies
    if (fetchOptions.body && typeof fetchOptions.body === 'string') {
        if (!fetchOptions.headers) fetchOptions.headers = {};
        if (!fetchOptions.headers['Content-Type']) {
            fetchOptions.headers['Content-Type'] = 'application/json';
        }
    }
    try {
        return await fetch(url, fetchOptions);
    } finally {
        if (timeoutId) clearTimeout(timeoutId);
    }
}

if (typeof API_BASE === 'undefined') {
    window.API_BASE = (window.GETOTTS_CONFIG && window.GETOTTS_CONFIG.API_BASE)
        ? window.GETOTTS_CONFIG.API_BASE
        : ((window.location.pathname.startsWith('/admin') || window.location.pathname.startsWith('/adminno881') || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
            ? `${window.location.origin}/api/v1`
            : 'https://api.getotts.com/api/v1');
}
// Removed trailing slash append to maintain consistency with checkout.js and dashboard.js
let adminToken = '';
let useBackend = false;

window.GETOTTS_ADMIN_BUILD = '20260616_admin_recovery1';

const ADMIN_UI_PREFS_KEY = 'getotts_admin_ui_prefs';
const ADMIN_UI_DEFAULTS = {
    theme: 'light',
    accent: 'green',
    density: 'comfortable',
    fontSize: 'normal',
    sidebar: 'full',
    corners: 'soft'
};

function getAdminUiPrefs() {
    try {
        const saved = JSON.parse(localStorage.getItem(ADMIN_UI_PREFS_KEY) || '{}');
        return { ...ADMIN_UI_DEFAULTS, ...(saved && typeof saved === 'object' ? saved : {}) };
    } catch (_) {
        return { ...ADMIN_UI_DEFAULTS };
    }
}

function applyAdminUiPrefs(prefs = getAdminUiPrefs()) {
    const root = document.documentElement;
    const body = document.body;
    if (!body) return;
    const clean = { ...ADMIN_UI_DEFAULTS, ...prefs };
    body.classList.remove(
        'admin-theme-light', 'admin-theme-dark', 'admin-theme-soft',
        'admin-density-comfortable', 'admin-density-compact',
        'admin-font-normal', 'admin-font-large',
        'admin-sidebar-full', 'admin-sidebar-compact',
        'admin-corners-soft', 'admin-corners-sharp'
    );
    body.classList.add(
        `admin-theme-${clean.theme}`,
        `admin-density-${clean.density}`,
        `admin-font-${clean.fontSize}`,
        `admin-sidebar-${clean.sidebar}`,
        `admin-corners-${clean.corners}`
    );
    const accents = {
        green: '#10b981',
        blue: '#2563eb',
        purple: '#7c3aed',
        gold: '#d97706'
    };
    const accent = accents[clean.accent] || accents.green;
    root.style.setProperty('--admin-accent', accent);
    root.style.setProperty('--accent', accent);
    root.style.setProperty('--primary', accent);
    root.style.setProperty('--primary-dark', accent);
    root.style.setProperty('--border-hover', accent);
}

function saveAdminUiPrefs(nextPrefs, options = {}) {
    const prefs = { ...getAdminUiPrefs(), ...nextPrefs };
    localStorage.setItem(ADMIN_UI_PREFS_KEY, JSON.stringify(prefs));
    applyAdminUiPrefs(prefs);
    syncAdminUiControls(prefs);
    syncThemeToggle(prefs);
    if (options.toast !== false) showToast('Admin look updated');
    return prefs;
}

function syncAdminUiControls(prefs = getAdminUiPrefs()) {
    const pairs = {
        adminUiTheme: prefs.theme,
        adminUiAccent: prefs.accent,
        adminUiDensity: prefs.density,
        adminUiFontSize: prefs.fontSize,
        adminUiSidebar: prefs.sidebar,
        adminUiCorners: prefs.corners
    };
    Object.entries(pairs).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.value = value;
    });
    const preview = document.getElementById('adminUiPreview');
    if (preview) {
        preview.innerHTML = `
            <div><strong>${prefs.theme}</strong><span>Theme</span></div>
            <div><strong>${prefs.accent}</strong><span>Accent</span></div>
            <div><strong>${prefs.density}</strong><span>Density</span></div>
        `;
    }
}

window.updateAdminUiPref = function(key, value) {
    saveAdminUiPrefs({ [key]: value });
};

window.resetAdminUiPrefs = function() {
    localStorage.removeItem(ADMIN_UI_PREFS_KEY);
    saveAdminUiPrefs({ ...ADMIN_UI_DEFAULTS });
};

function syncThemeToggle(prefs = getAdminUiPrefs()) {
    const label = document.getElementById('themeToggleLabel');
    const icon = document.getElementById('themeToggleIcon');
    if (label) label.textContent = prefs.theme === 'dark' ? 'Light' : 'Dark';
    if (icon) icon.setAttribute('data-lucide', prefs.theme === 'dark' ? 'sun' : 'moon');
    if (window.lucide) lucide.createIcons();
}

window.toggleAdminTheme = function() {
    const prefs = getAdminUiPrefs();
    const nextTheme = prefs.theme === 'dark' ? 'light' : 'dark';
    saveAdminUiPrefs({ theme: nextTheme }, { toast: false });
    showToast(nextTheme === 'dark' ? 'Dark mode on' : 'Light mode on');
};

window.toggleAdminSidebar = function(forceOpen) {
    const sidebar = document.querySelector('.admin-sidebar');
    const overlay = document.querySelector('.admin-mobile-overlay');
    if (!sidebar) return;
    const open = typeof forceOpen === 'boolean' ? forceOpen : !sidebar.classList.contains('open');
    sidebar.classList.toggle('open', open);
    if (overlay) overlay.classList.toggle('show', open);
    document.body.classList.toggle('admin-mobile-nav-open', open);
};

window.openAdminAppearance = function() {
    switchTab('settings');
    setTimeout(() => {
        document.getElementById('adminAppearanceCard')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        document.getElementById('adminUiTheme')?.focus();
    }, 80);
};

function getCookieValue(name) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = document.cookie.match(new RegExp('(?:^|; )' + escaped + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : '';
}

function getAdminCsrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
    return getCookieValue('admin_csrf_token') || getCookieValue('csrf_token') || meta;
}

const ADMIN_INR_PER_USD = Number(window.GETOTTS_CONFIG?.INR_PER_USD || 85);

function toMoneyNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function formatINR(value) {
    const amount = toMoneyNumber(value);
    return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function formatUSD(value) {
    const amount = toMoneyNumber(value);
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatINR(value) {
    const amount = toMoneyNumber(value);
    return `Rs ${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function usdFromINR(value) {
    return toMoneyNumber(value) / ADMIN_INR_PER_USD;
}

function dualMoney(valueInr, valueUsd = null) {
    const inr = toMoneyNumber(valueInr);
    const usd = valueUsd !== null && valueUsd !== undefined && valueUsd !== ''
        ? toMoneyNumber(valueUsd)
        : usdFromINR(inr);
    return `<span class="money-dual"><strong>${formatINR(inr)}</strong><small>${formatUSD(usd)}</small></span>`;
}

function dualMoneyText(valueInr, valueUsd = null) {
    const inr = toMoneyNumber(valueInr);
    const usd = valueUsd !== null && valueUsd !== undefined && valueUsd !== ''
        ? toMoneyNumber(valueUsd)
        : usdFromINR(inr);
    return `${formatINR(inr)} / ${formatUSD(usd)}`;
}

function revenueSplitMoney(valueInr, valueUsd) {
    return `
        <span class="revenue-split-money">
            <span><em>India</em><strong>${formatINR(valueInr)}</strong></span>
            <span><em>Global</em><strong>${formatUSD(valueUsd)}</strong></span>
        </span>
    `;
}

function singleCurrencyMoney(value, currency = 'INR') {
    return String(currency).toUpperCase() === 'USD' ? formatUSD(value) : formatINR(value);
}

function couponCurrency(coupon = {}) {
    const currency = String(coupon.currency || 'INR').toUpperCase();
    return currency === 'USD' || currency === 'BOTH' ? currency : 'INR';
}

function adminParseMetadata(raw) {
    if (!raw) return {};
    if (typeof raw === 'object') return raw;
    try {
        return JSON.parse(raw);
    } catch (e) {
        return {};
    }
}

function orderMoneyDetails(order = {}) {
    const meta = adminParseMetadata(order.metadata);
    const firstItem = Array.isArray(meta.items) && meta.items[0] && typeof meta.items[0] === 'object'
        ? meta.items[0]
        : {};
    const currency = String(order.currency || meta.wallet_currency || firstItem.currency || 'INR').toUpperCase() === 'USD' ? 'USD' : 'INR';
    const amount = meta.server_price !== undefined && meta.server_price !== null && meta.server_price !== ''
        ? meta.server_price
        : (order.amount || 0);
    return { amount, currency };
}

function orderSingleCurrencyMoney(order = {}) {
    const details = orderMoneyDetails(order);
    return singleCurrencyMoney(details.amount, details.currency);
}

const ADMIN_PAGE_SIZE = 50;
const adminTabCache = Object.create(null);
const adminListState = {
    orders: { offset: 0, total: 0, limit: ADMIN_PAGE_SIZE },
    inventory: { offset: 0, total: 0, limit: ADMIN_PAGE_SIZE },
    customers: { offset: 0, total: 0, limit: ADMIN_PAGE_SIZE },
    blogs: { offset: 0, total: 0, limit: ADMIN_PAGE_SIZE },
    coupons: { offset: 0, total: 0, limit: ADMIN_PAGE_SIZE },
};
const adminDebouncers = Object.create(null);
let adminStockSummaryCache = [];
let adminStockSummaryLoadedAt = 0;
let adminStockSummaryPromise = null;
const ADMIN_STOCK_SUMMARY_TTL = 60 * 1000;

function debounceAdmin(key, fn, delay = 300) {
    clearTimeout(adminDebouncers[key]);
    adminDebouncers[key] = setTimeout(fn, delay);
}

function shouldUseTabCache(key, options = {}) {
    return options.fromTab && !options.force && adminTabCache[key] && Date.now() - adminTabCache[key] < 120000;
}

function markTabCache(key) {
    adminTabCache[key] = Date.now();
}

function clearTabCache(key) {
    delete adminTabCache[key];
}

function getPageParams(stateKey, options = {}) {
    const state = adminListState[stateKey];
    if (options.resetPage) state.offset = 0;
    return { limit: state.limit, offset: state.offset };
}

function setPageMeta(stateKey, data = {}) {
    const state = adminListState[stateKey];
    state.total = Number(data.total ?? state.total ?? 0);
    state.limit = Number(data.limit ?? state.limit ?? ADMIN_PAGE_SIZE);
    state.offset = Number(data.offset ?? state.offset ?? 0);
}

function renderAdminPagination(targetId, stateKey, loaderName) {
    const target = document.getElementById(targetId);
    if (!target) return;
    const state = adminListState[stateKey];
    const total = Number(state.total || 0);
    const limit = Number(state.limit || ADMIN_PAGE_SIZE);
    const offset = Number(state.offset || 0);
    const start = total ? offset + 1 : 0;
    const end = Math.min(offset + limit, total);
    const canPrev = offset > 0;
    const canNext = offset + limit < total;
    target.innerHTML = `
        <div class="pagination-info">Showing ${start}-${end} of ${total}</div>
        <div class="pagination-actions">
            <button class="btn btn-outline" onclick="changeAdminPage('${stateKey}', '${loaderName}', -1)" ${canPrev ? '' : 'disabled'}>Previous</button>
            <span class="page-pill">${Math.floor(offset / limit) + 1} / ${Math.max(1, Math.ceil(total / limit))}</span>
            <button class="btn btn-outline" onclick="changeAdminPage('${stateKey}', '${loaderName}', 1)" ${canNext ? '' : 'disabled'}>Next</button>
        </div>
    `;
}

window.changeAdminPage = function(stateKey, loaderName, direction) {
    const state = adminListState[stateKey];
    if (!state || typeof window[loaderName] !== 'function') return;
    const nextOffset = Math.max(0, state.offset + (Number(direction) || 0) * state.limit);
    state.offset = nextOffset;
    window[loaderName]({ force: true });
};

function setTableLoading(body, colSpan, label = 'Loading...') {
    if (body) body.innerHTML = `<tr><td colspan="${colSpan}" class="empty-state admin-loading-row">${label}</td></tr>`;
}

function setTableError(body, colSpan, label = 'Failed to load data') {
    if (body) body.innerHTML = `<tr><td colspan="${colSpan}" class="empty-state admin-error-row">${label}</td></tr>`;
}

async function refreshAdminCatalogFromCloud() {
    const res = await adminFetch(`${API_BASE}/public/catalog?admin_ts=${Date.now()}`, {
        cache: 'no-store',
        timeoutMs: 15000
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success || !Array.isArray(data.catalog)) {
        data.status = res.status;
        throw new Error(extractApiError(null, data) || 'Could not refresh catalog');
    }
    if (typeof PRODUCTS !== 'undefined') {
        PRODUCTS = data.catalog;
    }
    try {
        sessionStorage.removeItem('getotts_catalog_cache_v2');
        localStorage.removeItem('getotts_catalog_cache_v2');
        sessionStorage.setItem('getotts_catalog_cache_v9', JSON.stringify({ savedAt: Date.now(), products: data.catalog }));
        localStorage.setItem('getotts_catalog_cache_v9', JSON.stringify({ savedAt: Date.now(), products: data.catalog }));
        localStorage.setItem('getotts_product_version', Date.now().toString());
    } catch (_) {}
    window.dispatchEvent(new CustomEvent('catalogUpdated', { detail: { products: data.catalog } }));
    return data.catalog;
}

function markAdminBuildStamp() {
    const stamp = window.GETOTTS_ADMIN_BUILD || 'dev';
    let el = document.getElementById('adminBuildStamp');
    if (!el) {
        el = document.createElement('div');
        el.id = 'adminBuildStamp';
        el.style.cssText = 'position:fixed;right:12px;bottom:10px;z-index:99999;padding:5px 8px;border-radius:8px;background:rgba(15,23,42,.82);color:#cbd5e1;font:11px system-ui;pointer-events:none;';
        document.body.appendChild(el);
    }
    el.textContent = `Admin build ${stamp}`;
}

document.addEventListener('DOMContentLoaded', markAdminBuildStamp);

function clearAdminStaleCaches() {
    try {
        sessionStorage.removeItem('getotts_catalog_cache_v2');
        sessionStorage.removeItem('getotts_catalog_cache_v9');
        localStorage.removeItem('getotts_catalog_cache_v2');
        localStorage.removeItem('getotts_catalog_cache_v9');
        localStorage.removeItem('getotts_admin_coupons');
        localStorage.removeItem('getotts_coupons');
    } catch (_) {}
}

function showAdminReloadBanner(expected, actual) {
    if (document.getElementById('adminReloadBanner')) return;
    const banner = document.createElement('div');
    banner.id = 'adminReloadBanner';
    banner.style.cssText = 'position:fixed;left:12px;right:12px;top:12px;z-index:100001;background:#fff7ed;color:#9a3412;border:1px solid #fdba74;border-radius:12px;padding:12px 14px;box-shadow:0 16px 40px rgba(15,23,42,.14);display:flex;gap:12px;align-items:center;justify-content:space-between;font:14px system-ui;';
    banner.innerHTML = `
        <strong>Admin update available. Loaded ${actual || 'old'} but server expects ${expected}.</strong>
        <button type="button" style="border:0;background:#ea580c;color:white;border-radius:9px;padding:9px 12px;font-weight:800;cursor:pointer">Reload latest admin</button>
    `;
    banner.querySelector('button').onclick = () => {
        clearAdminStaleCaches();
        const url = new URL(window.location.href);
        url.searchParams.set('admin_build', expected);
        window.location.href = url.toString();
    };
    document.body.appendChild(banner);
}

async function verifyAdminBuild() {
    const expectedFromPage = window.EXPECTED_ADMIN_BUILD || '';
    const actual = window.GETOTTS_ADMIN_BUILD || '';
    if (expectedFromPage && expectedFromPage !== actual) {
        clearAdminStaleCaches();
        showAdminReloadBanner(expectedFromPage, actual);
        return;
    }
    try {
        const res = await adminFetch(`${API_BASE}/admin/build?t=${Date.now()}`, { cache: 'no-store', timeoutMs: 8000 });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.build && data.build !== actual) {
            clearAdminStaleCaches();
            showAdminReloadBanner(data.build, actual);
        }
    } catch (e) {
        console.warn('[AdminBuild] Could not verify build:', e);
    }
}

document.addEventListener('DOMContentLoaded', verifyAdminBuild);

function forceOpenAdminModal(id) {
    const el = document.getElementById(id);
    if (!el) {
        showToast(`[X] Modal missing: ${id}. Please hard refresh admin.`);
        return false;
    }
    el.classList.add('is-open');
    el.removeAttribute('aria-hidden');
    el.style.setProperty('display', 'flex', 'important');
    el.style.setProperty('opacity', '1', 'important');
    el.style.setProperty('visibility', 'visible', 'important');
    el.style.setProperty('pointer-events', 'auto', 'important');
    el.style.setProperty('position', 'fixed', 'important');
    el.style.setProperty('inset', '0', 'important');
    el.style.setProperty('z-index', '100000', 'important');
    el.style.setProperty('align-items', 'center', 'important');
    el.style.setProperty('justify-content', 'center', 'important');
    return true;
}

function ensureCouponModalExists() {
    let modal = document.getElementById('couponModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'couponModal';
    modal.style.display = 'none';
    modal.innerHTML = `
        <div class="modal-card" style="max-width:480px">
            <div class="modal-header">
                <h2 id="couponModalTitle">Create Coupon</h2>
                <button class="modal-close" type="button" data-coupon-close>&times;</button>
            </div>
            <div class="modal-body">
                <div class="add-form">
                    <input type="hidden" id="couponEditId">
                    <div class="ck-field">
                        <label>Code</label>
                        <input type="text" id="couponCode" placeholder="SAVE20" style="text-transform:uppercase">
                    </div>
                    <div class="ck-field">
                        <label>Discount Type</label>
                        <select id="couponType">
                            <option value="percent">Percentage (%)</option>
                            <option value="fixed">Fixed Amount</option>
                        </select>
                    </div>
                    <div class="ck-field">
                        <label>Currency</label>
                        <select id="couponCurrency">
                            <option value="INR">Rs (INR)</option>
                            <option value="USD">$ (USD)</option>
                            <option value="BOTH">Both ($ + Rs)</option>
                        </select>
                    </div>
                    <div class="ck-field" id="couponPercentField">
                        <label>Discount Percent</label>
                        <input type="number" id="couponPercent" placeholder="20" min="1" max="100">
                    </div>
                    <div class="ck-field" id="couponAmountField" style="display:none">
                        <label>Discount Amount</label>
                        <input type="number" id="couponAmount" placeholder="50" min="1">
                    </div>
                    <div class="ck-field">
                        <label>Min Order Amount</label>
                        <input type="number" id="couponMinOrder" placeholder="0" min="0">
                    </div>
                    <div class="ck-field">
                        <label>Max Uses</label>
                        <input type="number" id="couponMaxUses" placeholder="1000" min="1">
                    </div>
                    <div class="ck-field">
                        <label>Expires At (optional)</label>
                        <input type="date" id="couponExpiry">
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" type="button" data-coupon-close>Cancel</button>
                <button class="btn btn-primary" type="button" data-coupon-save>
                    <i data-lucide="save"></i> Save Coupon
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', (event) => {
        if (event.target === modal || event.target.closest('[data-coupon-close]')) {
            closeModal('couponModal');
        }
        if (event.target.closest('[data-coupon-save]')) {
            window.saveCoupon();
        }
    });
    modal.querySelector('#couponType')?.addEventListener('change', () => window.toggleCouponFields());
    return modal;
}

function bindCouponActionFallbacks() {
    if (window.__couponActionFallbacksBound) return;
    window.__couponActionFallbacksBound = true;
    document.addEventListener('click', (event) => {
        const button = event.target.closest && event.target.closest('button,a');
        if (!button) return;
        const couponTab = document.getElementById('tab-coupons');
        if (!couponTab || !couponTab.contains(button)) return;

        const text = (button.textContent || '').trim().toLowerCase();
        const onclick = button.getAttribute('onclick') || '';
        const title = (button.getAttribute('title') || '').toLowerCase();

        if (text.includes('create coupon') || onclick.includes('showCouponModal')) {
            event.preventDefault();
            event.stopPropagation();
            window.showCouponModal();
            return;
        }

        if (title === 'edit' || onclick.includes('editCoupon')) {
            const match = onclick.match(/editCoupon\(['"]([^'"]+)['"]\)/);
            if (match && match[1]) {
                event.preventDefault();
                event.stopPropagation();
                window.showCouponModal(match[1]);
            }
        }
    }, true);

    document.addEventListener('pointerdown', (event) => {
        const button = event.target.closest && event.target.closest('button,a');
        if (!button) return;
        const couponTab = document.getElementById('tab-coupons');
        if (!couponTab || !couponTab.contains(button)) return;
        const text = (button.textContent || '').trim().toLowerCase();
        const onclick = button.getAttribute('onclick') || '';
        const title = (button.getAttribute('title') || '').toLowerCase();
        if (text.includes('create coupon') || onclick.includes('showCouponModal')) {
            button.dataset.couponBound = '1';
        }
        if (title === 'edit' || onclick.includes('editCoupon')) {
            button.dataset.couponBound = '1';
        }
    }, true);

    const bindVisibleButtons = () => {
        const couponTab = document.getElementById('tab-coupons');
        if (!couponTab) return;
        couponTab.querySelectorAll('button,a').forEach((button) => {
            const text = (button.textContent || '').trim().toLowerCase();
            const onclick = button.getAttribute('onclick') || '';
            const title = (button.getAttribute('title') || '').toLowerCase();
            if (text.includes('create coupon') || onclick.includes('showCouponModal')) {
                button.onclick = (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    window.showCouponModal();
                    return false;
                };
            } else if (title === 'edit' || onclick.includes('editCoupon')) {
                const match = onclick.match(/editCoupon\(['"]([^'"]+)['"]\)/);
                if (match && match[1]) {
                    button.onclick = (event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        window.showCouponModal(match[1]);
                        return false;
                    };
                }
            }
        });
    };
    bindVisibleButtons();
    setInterval(bindVisibleButtons, 1500);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindCouponActionFallbacks);
} else {
    bindCouponActionFallbacks();
}

// Demo platforms
function extractApiError(err, data) {
    if (data && (data.status === 401 || data.status === 403)) return 'Admin session expired. Please log in again, then retry.';
    if (data && data.detail) {
        if (typeof data.detail === 'string') return data.detail;
        if (Array.isArray(data.detail)) return data.detail.map(e => e.msg || JSON.stringify(e)).join(', ');
        return JSON.stringify(data.detail);
    }
    if (data && data.error) return data.error;
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
    { id: '8', name: 'JioCinema Premium', slug: 'jiocinema' },
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

 window.AdminUtils = {
     showConfirm: function(title, message, onConfirm, isDanger = false) {
         const modal = document.getElementById('adminConfirmModal');
         const overlay = document.getElementById('adminConfirmOverlay');
         const btn = document.getElementById('adminConfirmBtn');

         if (!modal || !overlay) {
             if (confirm(message)) onConfirm();
             return;
         }

         document.getElementById('adminConfirmTitle').textContent = title;
         document.getElementById('adminConfirmMessage').textContent = message;

         if (isDanger) {
             btn.style.background = '#ef4444';
             btn.style.borderColor = '#ef4444';
         } else {
             btn.style.background = 'var(--primary-color)';
             btn.style.borderColor = 'var(--primary-color)';
         }

         btn.onclick = () => {
             this.closeConfirm();
             onConfirm();
         };

         if (overlay) overlay.style.display = 'flex';
         if (modal) modal.style.display = 'block';
     },
     closeConfirm: function() {
         const modal = document.getElementById('adminConfirmModal');
         const overlay = document.getElementById('adminConfirmOverlay');
         if (modal) modal.style.display = 'none';
         if (overlay) overlay.style.display = 'none';
     }
 };

/* ================================================
   INIT
   ================================================ */
document.addEventListener('DOMContentLoaded', () => {
    const uiPrefs = getAdminUiPrefs();
    applyAdminUiPrefs(uiPrefs);
    syncAdminUiControls(uiPrefs);
    syncThemeToggle(uiPrefs);
    if (window.lucide) lucide.createIcons();

    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.style.display = 'none';
    });

    // Check backend availability
    checkBackend();

    // Since we are served via backend API with HttpOnly cookie, we assume authentication is handled.
    showDashboard();
    const params = new URLSearchParams(window.location.search);
    const initialTab = params.get('tab');
    if (initialTab) {
        setTimeout(() => switchTab(initialTab), 50);
    }
    const couponMessage = params.get('coupon_message');
    if (couponMessage) {
        setTimeout(() => showToast(couponMessage), 250);
        try {
            const clean = new URL(window.location.href);
            clean.searchParams.delete('coupon_message');
            window.history.replaceState({}, '', clean.toString());
        } catch (_) {}
    }

    // Customer search
    const searchInput = document.getElementById('customerSearch');
    if (searchInput) {
        searchInput.addEventListener('input', () => debounceAdmin('customers-search', () => resetCustomerPagination(), 300));
    }
    const orderSearch = document.getElementById('orderSearch');
    if (orderSearch) {
        orderSearch.addEventListener('input', () => debounceAdmin('orders-search', () => loadOrders({ force: true, resetPage: true }), 300));
    }
    const invSearch = document.getElementById('invSearch');
    if (invSearch) {
        invSearch.addEventListener('input', () => debounceAdmin('inventory-search', () => loadInventory({ force: true, resetPage: true }), 300));
    }
    const blogSearch = document.getElementById('blogSearch');
    if (blogSearch) {
        blogSearch.addEventListener('input', () => debounceAdmin('blogs-search', () => loadBlogs({ force: true, resetPage: true }), 300));
    }
    const productSearch = document.getElementById('productSearch');
    if (productSearch) {
        productSearch.addEventListener('input', () => debounceAdmin('products-search', () => loadProducts({ force: true }), 250));
    }
    const couponSearch = document.getElementById('couponSearch');
    if (couponSearch) {
        couponSearch.addEventListener('input', () => debounceAdmin('coupons-search', () => loadCoupons({ force: true, resetPage: true }), 300));
    }
});

async function checkBackend() {
    // Streamlined: Use a more generous timeout for slower networks
    try {
        const baseUrl = API_BASE.replace(/\/api\/v1\/?$/, '') || '/';
        const resp = await fetch(`${baseUrl}/`, { signal: AbortSignal.timeout(5000) });
        if (resp.ok) useBackend = true;
    } catch {
        useBackend = false;
    }
}

function logout() {
    window.location.href = '/';
}

function showDashboard() {
    document.getElementById('adminDash').style.display = 'flex';
    loadStats();
    loadPlatformDropdowns();
    loadAuditPreview();
    checkWaMonitorStatus();
    enhanceInventoryComposer();
    if (window.lucide) lucide.createIcons();
    if (window.innerWidth <= 768) toggleAdminSidebar(false);
}

/* ================================================
   TAB SWITCHING
   ================================================ */
function switchTab(tabName) {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    const tab = document.getElementById(`tab-${tabName}`);
    if (tab) tab.classList.add('active');
    const navItem = document.querySelector(`.nav-item[data-tab="${tabName}"]`);
    if (navItem) navItem.classList.add('active');

    switch(tabName) {
        case 'overview': loadStats(); loadAuditPreview(); break;
        case 'orders': loadOrders({ fromTab: true }); break;
        case 'inventory': loadInventory({ fromTab: true }); break;
        case 'products':
            loadProducts({ fromTab: true });
            loadTopDealsManager({ fromTab: true });
            break;
        case 'customers': loadCustomers({ fromTab: true }); break;
        case 'blog': loadBlogs({ fromTab: true }); break;
        case 'inbox': if(window.ADMIN_SUPPORT) ADMIN_SUPPORT.loadInbox(); break;
        case 'tickets': if(window.ADMIN_SUPPORT) ADMIN_SUPPORT.loadTickets(); break;
        case 'coupons': loadCoupons({ fromTab: true }); break;
        case 'whatsapp': checkWaMonitorStatus(); loadPendingCodes(); loadWaStats(); loadWaMessageLog(); loadWaMarketingCustomers(); break;
        case 'add-inventory': enhanceInventoryComposer(); break;
        case 'settings': loadSettings(); break;
        case 'vouchers': loadAdminVouchers(); break;
    }
    if (window.lucide) lucide.createIcons();
    if (window.innerWidth <= 768) toggleAdminSidebar(false);
}

/* ================================================
   STATS
   ================================================ */
async function loadStats() {
    // 1. Fetch live from server (Optimized unified endpoint)
    try {
        const res = await adminFetch(`${API_BASE}/admin/stats`, { timeoutMs: 5000 });
        const data = await res.json().catch(() => ({}));

        if (data.success) {
            document.getElementById('statRevenue').innerHTML = revenueSplitMoney(
                data.total_revenue_inr ?? data.total_revenue ?? 0,
                data.total_revenue_usd ?? 0
            );
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
                document.getElementById('statTotalWallet').innerHTML = dualMoney(data.total_wallet || 0, data.total_wallet_usd || 0);
        }
    } catch (e) {
        console.warn('Failed to fetch live stats', e);

        // 2. Fallback / local stats ONLY if API fails
        const stats = AdminStore.getStats();
        if (document.getElementById('statRevenue'))
            document.getElementById('statRevenue').innerHTML = revenueSplitMoney(stats.total_revenue_inr || 0, stats.total_revenue_usd || 0);
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
async function loadOrders(options = {}) {
    const body = document.getElementById('ordersBody');
    if (!body) return;
    if (shouldUseTabCache('orders', options) && body.children.length && !body.textContent.includes('Loading')) return;
    setTableLoading(body, 8, 'Loading orders...');

    // Sync with backend API
    let apiFetched = false;
    try {
        const filter = document.getElementById('orderFilter')?.value || '';
        const search = document.getElementById('orderSearch')?.value || '';
        const page = getPageParams('orders', options);
        const params = new URLSearchParams({
            limit: String(page.limit),
            offset: String(page.offset),
            status: filter,
            search
        });
        const res = await adminFetch(`${API_BASE}/admin/orders?${params.toString()}`);
        if (res.status === 401) {
            console.warn('[ORDERS] Admin session expired -- redirecting to login');
            showToast('[WARN] Session expired. Redirecting to login...');
            setTimeout(() => { window.location.href = '/adminno881/login'; }, 1500);
            return;
        }
        if (res.ok) {
            const data = await res.json();
            if (data.success && Array.isArray(data.orders)) {
                setPageMeta('orders', data);
                // Enrich product_name from metadata if missing
                const enriched = data.orders.map(o => {
                    if (!o.product_name && o.metadata) {
                        const meta = typeof o.metadata === 'string' ? (() => { try { return JSON.parse(o.metadata); } catch { return {}; } })() : (o.metadata || {});
                        o.product_name = meta.product_name || meta.platform_name || null;
                    }
                    return o;
                });
                AdminStore._set(STORE_KEYS.orders, enriched);
                apiFetched = true;
                markTabCache('orders');
            }
        }
    } catch (e) {
        console.warn('Failed to fetch orders from API', e);
    }

    const filter = document.getElementById('orderFilter').value;
    const search = document.getElementById('orderSearch')?.value || '';
    let orders = AdminStore.getOrders(filter, search);

    // Filter out unpaid (pending) orders by default unless explicitly filtered for 'pending'
    if (filter !== 'pending') {
        orders = orders.filter(o => o.payment_status !== 'pending');
    }

    if (!orders.length) {
        body.innerHTML = `<tr><td colspan="8" class="empty-state" style="padding: 60px 20px; text-align: center;">
            <div style="font-size: 3rem; margin-bottom: 16px; opacity: 0.3;">
                <i data-lucide="shopping-bag"></i>
            </div>
            <div style="font-weight: 600; font-size: 1.1rem; color: var(--gray-600); margin-bottom: 8px;">
                No orders found
            </div>
            <p style="color: var(--gray-400); font-size: 0.9rem; max-width: 300px; margin: 0 auto;">
                ${search || filter ? 'Try adjusting your filters or search terms.' : (apiFetched ? 'Orders will appear here once customers start purchasing.' : '[WARN] Could not reach the server. Showing cached data.')}
            </p>
        </td></tr>`;
        if (window.lucide) lucide.createIcons();
        renderAdminPagination('ordersPagination', 'orders', 'loadOrders');
        return;
    }

    body.innerHTML = orders.map(o => {
        // Extract product_name from metadata if missing at render time too
        let productName = o.product_name;
        if (!productName && o.metadata) {
            const meta = typeof o.metadata === 'string' ? (() => { try { return JSON.parse(o.metadata); } catch { return {}; } })() : (o.metadata || {});
            productName = meta.product_name || meta.platform_name || null;
        }

        const isPaid = o.payment_status === 'paid';
        const isDelivered = o.delivery_status === 'delivered';
        const isPending = o.payment_status === 'pending';
        const isCancelled = o.delivery_status === 'cancelled' || o.payment_status === 'cancelled';
        const isRefunded = o.payment_status === 'refunded';
        const canCancelOrRefund = !isCancelled && !isRefunded;

        return `
        <tr>
            <td><strong>${o.order_number || '--'}</strong></td>
            <td>${o.customer_email || '--'}</td>
            <td>${productName || '--'}</td>
            <td>${orderSingleCurrencyMoney(o)}</td>
            <td><span class="pill pill-${o.payment_status || 'pending'}">${o.payment_status || 'pending'}</span></td>
            <td><span class="pill pill-${o.delivery_status || 'pending'}">${o.delivery_status || 'pending'}</span></td>
            <td>${formatDate(o.created_at)}</td>
            <td class="action-cell">
                <div class="action-btn-group">
                    <button class="action-btn" onclick="viewOrder('${o.id}')" title="View Details">
                        <i data-lucide="eye"></i>
                    </button>

                    ${isPending ? `
                        <button class="action-btn green" onclick="confirmPayment('${o.id}')" title="Confirm Payment">
                            <i data-lucide="check"></i>
                        </button>
                    ` : ''}

                    ${isPaid && !isDelivered ? `
                        <button class="action-btn blue" onclick="showDeliverModal('${o.id}')" title="Deliver">
                            <i data-lucide="send"></i>
                        </button>
                    ` : ''}

                    <div class="text-actions">
                        ${isPaid ? `
                            <button class="text-btn wa" onclick="deliverOrderWA('${o.id}')" title="Send via WhatsApp">WA</button>
                            <button class="text-btn email" onclick="deliverOrderEmail('${o.id}')" title="Send via Email">Email</button>
                        ` : ''}
                        ${!isDelivered ? `
                            <button class="text-btn done" onclick="markOrderDone('${o.id}')" title="Mark as Done">Done</button>
                        ` : ''}
                    </div>

                    ${canCancelOrRefund && !isDelivered ? `
                        <button class="action-btn red" onclick="cancelOrder('${o.id}')" title="Cancel">
                            <i data-lucide="x"></i>
                        </button>
                    ` : ''}

                    ${canCancelOrRefund ? `
                        <button class="text-btn refund" onclick="refundOrder('${o.id}')" title="Mark as Refunded">Refund</button>
                    ` : ''}

                    <button class="action-btn" onclick="openWhatsApp('${o.customer_phone || ''}')" title="WhatsApp Chat">
                        <i data-lucide="message-circle"></i>
                    </button>
                </div>
            </td>
        </tr>`;
    }).join('');
    if (window.lucide) lucide.createIcons();
    renderAdminPagination('ordersPagination', 'orders', 'loadOrders');
}

async function deliverOrderWA(id) {
    try {
        const res = await adminFetch(`${API_BASE}/admin/orders/${id}/deliver-whatsapp`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            showToast('[OK] WhatsApp delivery triggered!');
            loadOrders();
        } else {
            showToast('[X] ' + (data.detail || 'WA Delivery failed'));
        }
    } catch (err) {
        showToast('[X] Network error');
    }
}

async function deliverOrderEmail(id) {
    try {
        const res = await adminFetch(`${API_BASE}/admin/orders/${id}/deliver-email`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            showToast('[OK] Email delivery triggered!');
            loadOrders();
        } else {
            showToast('[X] ' + (data.detail || 'Email Delivery failed'));
        }
    } catch (err) {
        showToast('[X] Network error');
    }
}

async function markOrderDone(id) {
    try {
        const res = await adminFetch(`${API_BASE}/admin/orders/${id}/mark-done`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            showToast('[OK] Order marked as delivered!');
            loadOrders();
            loadStats();
        } else {
            showToast('[X] ' + (data.detail || 'Failed to mark done'));
        }
    } catch (err) {
        showToast('[X] Network error');
    }
}

function viewOrder(id) {
    const o = AdminStore.getOrderById(id);
    if (!o) return;

    document.getElementById('modalOrderTitle').textContent = `Order ${o.order_number}`;
    document.getElementById('modalOrderBody').innerHTML = `
        <div class="order-detail-grid">
            <div class="od-row"><span class="od-label">Customer</span><span>${o.customer_email || '--'}</span></div>
            <div class="od-row"><span class="od-label">Phone</span><span>${o.customer_phone || '--'}</span></div>
            <div class="od-row"><span class="od-label">Product</span><span>${o.product_name || '--'}</span></div>
            <div class="od-row"><span class="od-label">Amount</span><span>${orderSingleCurrencyMoney(o)}</span></div>
            <div class="od-row"><span class="od-label">Payment</span><span class="pill pill-${o.payment_status}">${o.payment_status}</span></div>
            <div class="od-row"><span class="od-label">Delivery</span><span class="pill pill-${o.delivery_status}">${o.delivery_status}</span></div>
            <div class="od-row"><span class="od-label">Created</span><span>${formatDate(o.created_at)}</span></div>
            ${o.credentials_email ? `
                <div class="od-row"><span class="od-label">Cred Email</span><span><code>${o.credentials_email}</code></span></div>
                <div class="od-row"><span class="od-label">Cred Password</span><span><code>${o.credentials_password || '--'}</code></span></div>
            ` : ''}
            ${o.notes ? `<div class="od-row"><span class="od-label">Notes</span><span>${o.notes}</span></div>` : ''}
        </div>
    `;

    let footerBtns = '';
    if (o.payment_status === 'pending') {
        footerBtns += `<button class="btn btn-primary" onclick="confirmPayment('${id}'); closeModal('orderModal'); loadOrders();">[OK] Confirm Payment</button>`;
    }
    if (o.payment_status === 'paid' && o.delivery_status !== 'delivered') {
        footerBtns += `<button class="btn btn-primary" onclick="closeModal('orderModal'); showDeliverModal('${id}');"> Deliver</button>`;
    }
    if (o.payment_status !== 'refunded' && o.delivery_status !== 'cancelled') {
        footerBtns += `<button class="btn btn-outline" onclick="cancelOrder('${id}'); closeModal('orderModal');">Cancel Order</button>`;
        footerBtns += `<button class="btn btn-outline danger" onclick="refundOrder('${id}'); closeModal('orderModal');">Mark Refunded</button>`;
    }
    if (o.credentials_email) {
        footerBtns += `<button class="btn btn-outline" onclick="copyCredentials('${o.credentials_email}', '${o.credentials_password || ''}')"> Copy Creds</button>`;
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
    showToast('Payment confirmed [OK]');

    // ALWAYS update the backend DB -- this is the critical sync step
    const API = (window.GETOTTS_CONFIG && window.GETOTTS_CONFIG.API_BASE) || API_BASE;
    if (API && orderNumber) {
        adminFetch(API + '/orders/' + orderNumber + '/update-status', {
            method: 'POST',
            body: JSON.stringify({ payment_status: 'paid' })
        }).then(r => {
            if (!r.ok) r.text().then(t => console.warn('[ADMIN] Backend response:', t));
        }).catch(e => console.warn('[ADMIN] [X] Backend update failed:', e));
    } else {
        console.warn('[ADMIN] [WARN] Could not find order_number for id:', id, '-- backend NOT updated');
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
        showToast('[X] Please enter at least one credential');
        return;
    }

    const btn = document.querySelector('#deliverModal .modal-footer .btn-primary');
    const oldText = btn.innerHTML;
    btn.innerHTML = ' Delivering...';
    btn.disabled = true;

    try {
        const resp = await adminFetch(`${API_BASE}/orders/manual-fulfill`, {
            method: 'POST',
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
            showToast('Order manually fulfilled & delivered! ');
        } else {
            const data = await resp.json();
            showToast(`[X] Error: ${data.detail || 'Fulfillment failed'}`);
        }
    } catch (e) {
        console.error('Fulfillment error:', e);
        showToast('[X] Network error during fulfillment');
    } finally {
        btn.innerHTML = oldText;
        btn.disabled = false;
    }
}

function cancelOrder(id) {
    AdminUtils.showConfirm("Cancel Order", "Are you sure you want to cancel this order?", () => {
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

        syncOrderStatus(orderNumber, { payment_status: 'failed', delivery_status: 'cancelled' }, 'Cancel');
    }, true);
}

function refundOrder(id) {
    AdminUtils.showConfirm("Mark Refunded", "Mark this order as refunded? This keeps the order record but removes it from paid/active status.", () => {
        const storeOrder = AdminStore.getOrderById(id);
        const orderNumber = storeOrder ? storeOrder.order_number : null;

        AdminStore.updateOrder(id, {
            payment_status: 'refunded',
            delivery_status: 'cancelled',
            refunded_at: new Date().toISOString(),
        });
        loadOrders();
        loadStats();
        showToast('Order marked as refunded');

        syncOrderStatus(orderNumber, { payment_status: 'refunded', delivery_status: 'cancelled' }, 'Refund');
    }, true);
}

function syncOrderStatus(orderNumber, updates, label) {
    const API = (window.GETOTTS_CONFIG && window.GETOTTS_CONFIG.API_BASE) || API_BASE;
    if (!API || !orderNumber) {
        console.warn(`[ADMIN] ${label} sync skipped: missing order number`);
        return;
    }
    adminFetch(API + '/orders/' + orderNumber + '/update-status', {
        method: 'POST',
        body: JSON.stringify(updates)
    }).then(async r => {
        if (!r.ok) console.warn('[ADMIN] Backend response:', await r.text());
    }).catch(e => console.warn(`[ADMIN] ${label} sync failed:`, e));
}

function copyCredentials(email, password, link = '', profile = '') {
    const parts = [];
    if (link) parts.push(`Activation Link: ${link}`);
    if (email) parts.push(`Email: ${email}`);
    if (password) parts.push(`Password: ${password}`);
    if (profile) parts.push(`Profile: ${profile}`);
    navigator.clipboard.writeText(parts.join('\n') || 'No delivery data');
    showToast(link ? 'Activation link copied!' : 'Credentials copied!');
}

function openWhatsApp(phone) {
    const settings = AdminStore.getSettings();
    const num = phone || settings.whatsapp;
    if (num) window.open(`https://wa.me/${num}`, '_blank');
}

/* ================================================
   INVENTORY -- Enhanced with order linkage
   ================================================ */

const INV_STATUS_BADGE = {
    available:  '<span class="inv-badge inv-available"> Available</span>',
    reserved:   '<span class="inv-badge inv-reserved"> Reserved</span>',
    delivered:  '<span class="inv-badge inv-delivered"> Delivered</span>',
    sold:       '<span class="inv-badge inv-delivered"> Delivered</span>', // legacy alias
    expired:    '<span class="inv-badge inv-expired"> Expired</span>',
    flagged:    '<span class="inv-badge inv-flagged"> Flagged</span>',
};

function escapeAttr(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
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

function resolveAdminProductImageUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^(https?:|data:|blob:)/i.test(raw)) return raw;
    if (raw.startsWith('/static/assets/images/')) return raw;
    if (raw.startsWith('static/assets/images/')) return '/' + raw;
    if (raw.startsWith('/assets/images/')) return '/static' + raw;
    if (raw.startsWith('assets/images/')) return '/static/' + raw;
    return raw.startsWith('/') ? raw : '/' + raw;
}

function getInventoryProfile(item) {
    const authProfile = item?.auth_data?.profile;
    if (authProfile) return authProfile;
    const notes = item?.notes || '';
    const match = notes.match(/Profile:\s*(.+)$/im);
    return match ? match[1].trim() : '';
}

function getInventoryLink(item) {
    const authLink = item?.auth_data?.link || item?.auth_data?.activation_link;
    if (authLink) return String(authLink).trim();
    const notes = item?.notes || '';
    const match = notes.match(/(?:Link|Activation Link|Invite Link):\s*(.+)$/im);
    if (match) return match[1].trim();
    const password = String(item?.password || '').trim();
    return /^https?:\/\//i.test(password) ? password : '';
}

function isInventoryPlaceholderValue(value) {
    const clean = String(value || '').trim().toLowerCase();
    return !clean || clean === 'n/a' || clean === 'activation-link' || clean.endsWith('@getotts.local') || clean.startsWith('link_') || clean.startsWith('item_');
}

function escapeJsString(value) {
    return String(value ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r?\n/g, '\\n');
}

function stripInventoryMetaNotes(notes = '') {
    return String(notes || '')
        .split(/\r?\n/)
        .filter(line => !/^\s*(Profile|Link|Activation Link|Invite Link|Delivery Type):/i.test(line))
        .join('\n')
        .trim();
}

async function loadInventory(options = {}) {
    const body = document.getElementById('invBody');
    if (!body) return;
    if (shouldUseTabCache('inventory', options) && body.children.length && !body.textContent.includes('Loading')) return;
    setTableLoading(body, 7, 'Loading inventory...');
    const filter = document.getElementById('invFilter').value;
    const search = document.getElementById('invSearch')?.value || '';

    // Load from cloud API
    const page = getPageParams('inventory', options);
    const params = new URLSearchParams({
        limit: String(page.limit),
        offset: String(page.offset),
        status: filter,
        search
    });
    let url = `${API_BASE}/admin/inventory?${params.toString()}`;

    try {
        const res = await adminFetch(url);
        const data = await res.json();
        const items = data.inventory || [];
        setPageMeta('inventory', data);

        // SYNC TO AdminStore (Critical for Stock Counts)
        AdminStore._set(STORE_KEYS.inventory, items);
        markTabCache('inventory');

        if (!items.length) {
            body.innerHTML = `<tr><td colspan="7" class="empty-state">No inventory${filter ? ` with status "${filter}"` : ''}. Add accounts using the Add Inventory tab.</td></tr>`;
            loadStockSummary();
            renderAdminPagination('inventoryPagination', 'inventory', 'loadInventory');
            return;
        }

        body.innerHTML = items.map(i => {
            const statusBadge = INV_STATUS_BADGE[i.status] || `<span class="inv-badge">${i.status}</span>`;
            const orderLink = i.order_id
                ? `<a href="#" onclick="highlightOrder('${i.order_id}'); return false;" class="inv-order-link" title="${i.order_id}">${(i.order_id || '').substring(0, 8)}</a>`
                : '<span style="color:#9ca3af">--</span>';

            // Resolve platform name from ID or slug
            let platformName = i.platform_id || '--';
            const allProds = AdminStore.getProducts();
            const prod = allProds.find(p => p.id === i.platform_id || p.slug === i.platform_id || p.id === i.platform_slug || p.slug === i.platform_slug);
            if (prod) platformName = prod.name;
            const invLink = getInventoryLink(i);
            const invProfile = getInventoryProfile(i);
            const displayEmail = isInventoryPlaceholderValue(i.email) ? '' : (i.email || '');
            const displayPassword = isInventoryPlaceholderValue(i.password) ? '' : (i.password || '');
            const copyCall = `copyCredentials('${escapeJsString(displayEmail)}', '${escapeJsString(displayPassword)}', '${escapeJsString(invLink)}', '${escapeJsString(invProfile)}')`;
            const primaryValue = invLink
                ? `<code style="font-size:.82rem">Activation Link</code><small style="display:block;color:#64748b;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeAttr(invLink)}</small>`
                : `<code style="font-size:.82rem">${escapeAttr(displayEmail || i.email || '--')}</code>`;

            const editButton = `
                <button class="action-btn" onclick="editInventoryItem('${i.id}')" title="Edit">
                    <i data-lucide="edit-3"></i>
                </button>`;

            // Action buttons based on status
            let actions = editButton;
            if (i.status === 'available') {
                actions += `
                    <button class="action-btn" onclick="${escapeAttr(copyCall)}" title="${invLink ? 'Copy Activation Link' : 'Copy Credentials'}">
                        <i data-lucide="copy"></i>
                    </button>
                    <button class="action-btn red" onclick="deleteInvItem('${i.id}')" title="Delete">
                        <i data-lucide="trash-2"></i>
                    </button>`;
            } else if (i.status === 'reserved') {
                actions += `
                    <button class="action-btn" onclick="${escapeAttr(copyCall)}" title="${invLink ? 'Copy Activation Link' : 'Copy Credentials'}">
                        <i data-lucide="copy"></i>
                    </button>
                    <button class="action-btn orange" onclick="unassignInvItem('${i.id}')" title="Unassign (release back to available)">
                        <i data-lucide="unlock"></i>
                    </button>`;
            } else if (i.status === 'delivered' || i.status === 'sold') {
                actions += `
                    <button class="action-btn" onclick="${escapeAttr(copyCall)}" title="${invLink ? 'Copy Activation Link' : 'Copy Credentials'}">
                        <i data-lucide="copy"></i>
                    </button>`;
            } else {
                actions += `
                    <button class="action-btn" onclick="resetInvStatus('${i.id}')" title="Reset to Available">
                        <i data-lucide="refresh-cw"></i>
                    </button>
                    <button class="action-btn red" onclick="deleteInvItem('${i.id}')" title="Delete">
                        <i data-lucide="trash-2"></i>
                    </button>`;
            }

            return `
            <tr class="inv-row inv-row-${i.status === 'sold' ? 'delivered' : i.status}">
                <td>${primaryValue}</td>
                <td>${platformName}</td>
                <td>${i.plan_type || '--'}</td>
                <td>${statusBadge}</td>
                <td>${orderLink}</td>
                <td>
                    <div>${i.expiry_date || '--'}</div>
                    ${invProfile ? `<small style="color:#64748b">Profile: ${escapeAttr(invProfile)}</small>` : ''}
                    ${invLink ? `<small style="display:block;color:#16a34a">Link delivery</small>` : ''}
                </td>
                <td class="action-cell">${actions}</td>
            </tr>`;
        }).join('');

        if (window.lucide) lucide.createIcons();
        loadStockSummary();
        renderAdminPagination('inventoryPagination', 'inventory', 'loadInventory');
    } catch (e) {
        console.error('[INV] Load failed:', e);
        // Fallback to localStorage
        const items = AdminStore.getInventory(filter);
        body.innerHTML = items.length ? items.map(i => `
            <tr>
                <td><code style="font-size:.82rem">${i.email}</code></td>
                <td>${i.platform || i.platform_id || '--'}</td>
                <td>${i.plan_type || '--'}</td>
                <td>${INV_STATUS_BADGE[i.status] || i.status}</td>
                <td>--</td>
                <td>${i.expiry_date || '--'}</td>
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
        renderAdminPagination('inventoryPagination', 'inventory', 'loadInventory');
    }
}

window.editInventoryItem = function(id) {
    const item = (AdminStore.getInventory() || []).find(inv => String(inv.id) === String(id));
    if (!item) {
        showToast('[X] Inventory item not found');
        return;
    }

    let modal = document.getElementById('inventoryEditModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'inventoryEditModal';
        modal.className = 'modal-overlay inventory-edit-modal';
        document.body.appendChild(modal);
    }

    const products = AdminStore.getProducts() || [];
    const platformOptions = products.map(p => {
        const value = p.platform_id || p.id || p.slug;
        const selected = String(value) === String(item.platform_id) || String(p.id) === String(item.platform_id) || String(p.slug) === String(item.platform_id);
        return `<option value="${escapeAttr(value)}" ${selected ? 'selected' : ''}>${escapeAttr(p.name || p.slug || value)}</option>`;
    }).join('');

    const profile = getInventoryProfile(item);
    const activationLink = getInventoryLink(item);
    const plainNotes = stripInventoryMetaNotes(item.notes || '');

    modal.innerHTML = `
        <div class="modal-card" style="max-width:560px">
            <div class="modal-header">
                <h2>Edit Inventory</h2>
                <button class="modal-close" onclick="closeModal('inventoryEditModal')">&times;</button>
            </div>
            <div class="modal-body">
                <div class="add-form inventory-edit-form">
                    <div class="ck-field">
                        <label>Platform</label>
                        <select id="editInvPlatform">${platformOptions}</select>
                    </div>
                    <div class="grid-2" style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
                        <div class="ck-field">
                            <label>Plan</label>
                            <select id="editInvPlan">
                                <option value="shared" ${item.plan_type === 'shared' ? 'selected' : ''}>Shared</option>
                                <option value="personal" ${item.plan_type === 'personal' ? 'selected' : ''}>Personal</option>
                                <option value="family" ${item.plan_type === 'family' ? 'selected' : ''}>Family</option>
                            </select>
                        </div>
                        <div class="ck-field">
                            <label>Status</label>
                            <select id="editInvStatus">
                                <option value="available" ${item.status === 'available' ? 'selected' : ''}>Available</option>
                                <option value="reserved" ${item.status === 'reserved' ? 'selected' : ''}>Reserved</option>
                                <option value="delivered" ${(item.status === 'delivered' || item.status === 'sold') ? 'selected' : ''}>Delivered</option>
                                <option value="expired" ${item.status === 'expired' ? 'selected' : ''}>Expired</option>
                                <option value="flagged" ${item.status === 'flagged' ? 'selected' : ''}>Flagged</option>
                            </select>
                        </div>
                    </div>
                    <div class="ck-field">
                        <label>Email / Username</label>
                        <input type="text" id="editInvEmail" value="${escapeAttr(item.email || '')}">
                    </div>
                    <div class="ck-field">
                        <label>Password</label>
                        <input type="text" id="editInvPassword" value="${escapeAttr(item.password || '')}">
                    </div>
                    <div class="ck-field">
                        <label>Activation / Invite Link</label>
                        <input type="url" id="editInvLink" value="${escapeAttr(activationLink)}" placeholder="https://...">
                    </div>
                    <div class="grid-2" style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
                        <div class="ck-field">
                            <label>Expiry Date</label>
                            <input type="date" id="editInvExpiry" value="${escapeAttr(item.expiry_date || '')}">
                        </div>
                        <div class="ck-field">
                            <label>Profile / Slot</label>
                            <input type="text" id="editInvProfile" value="${escapeAttr(profile)}" placeholder="Profile 2, Kids, PIN 1234">
                        </div>
                    </div>
                    <div class="ck-field">
                        <label>Notes</label>
                        <textarea id="editInvNotes" rows="3" placeholder="Internal notes">${escapeAttr(plainNotes)}</textarea>
                    </div>
                    <div id="editInvResult" class="add-result"></div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" onclick="closeModal('inventoryEditModal')">Cancel</button>
                <button class="btn btn-primary" onclick="saveInventoryEdit('${item.id}')">
                    <i data-lucide="save"></i> Save Changes
                </button>
            </div>
        </div>
    `;
    modal.style.display = 'flex';
    if (window.lucide) lucide.createIcons();
};

window.saveInventoryEdit = async function(id) {
    const profile = document.getElementById('editInvProfile')?.value.trim() || '';
    const activationLink = document.getElementById('editInvLink')?.value.trim() || '';
    const notes = document.getElementById('editInvNotes')?.value.trim() || '';
    const result = document.getElementById('editInvResult');
    const payload = {
        platform_id: document.getElementById('editInvPlatform')?.value || null,
        plan_type: document.getElementById('editInvPlan')?.value || 'shared',
        status: document.getElementById('editInvStatus')?.value || 'available',
        email: document.getElementById('editInvEmail')?.value.trim() || (activationLink ? `link_${Date.now()}@getotts.local` : null),
        password: document.getElementById('editInvPassword')?.value.trim() || (activationLink ? 'activation-link' : null),
        expiry_date: document.getElementById('editInvExpiry')?.value || null,
        notes: [
            profile ? `Profile: ${profile}` : '',
            activationLink ? `Link: ${activationLink}` : '',
            activationLink ? 'Delivery Type: activation_link' : '',
            notes
        ].filter(Boolean).join('\n')
    };

    if (result) {
        result.textContent = 'Saving inventory item...';
        result.className = 'add-result info';
    }

    try {
        const res = await adminFetch(`${API_BASE}/admin/inventory/${id}`, {
            method: 'PUT',
            body: JSON.stringify(payload)
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.success === false) {
            throw new Error(extractApiError(null, data));
        }
        if (result) {
            result.textContent = '[OK] Inventory updated';
            result.className = 'add-result success';
        }
        closeModal('inventoryEditModal');
        await loadInventory();
        await loadStats();
    } catch (err) {
        console.error('[Inventory] Edit failed:', err);
        if (result) {
            result.textContent = '[X] ' + extractApiError(err, null);
            result.className = 'add-result error';
        }
    }
};

async function loadStockSummary(options = {}) {
    if (!options.force && adminStockSummaryCache.length && Date.now() - adminStockSummaryLoadedAt < ADMIN_STOCK_SUMMARY_TTL) {
        return adminStockSummaryCache;
    }
    if (adminStockSummaryPromise) return adminStockSummaryPromise;
    const el = document.getElementById('stockSummary');
    adminStockSummaryPromise = (async () => {
    try {
        const res = await fetch(`${API_BASE}/admin/inventory/stock-summary`);
        const data = await res.json();
        const summary = data.summary || [];
        adminStockSummaryCache = summary;
        adminStockSummaryLoadedAt = Date.now();
        if (!el) return summary;
        if (!summary.length) {
            el.innerHTML = '<p style="color:#9ca3af; font-size:.85rem;">No stock data yet.</p>';
            return summary;
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
        return summary;
    } catch (e) {
        console.warn('[INV] Stock summary load failed:', e);
        return adminStockSummaryCache;
    } finally {
        adminStockSummaryPromise = null;
    }
    })();
    return adminStockSummaryPromise;
}

function getProductAvailableStock(product) {
    const keys = [product?.id, product?.slug, product?.platform_id].filter(Boolean).map(String);
    if (adminStockSummaryCache.length) {
        return adminStockSummaryCache
            .filter(s => keys.includes(String(s.platform_id)) && String(s.plan_type || 'shared') === 'shared')
            .reduce((sum, s) => sum + Number(s.available || 0), 0);
    }
    return AdminStore.getStockByPlatform(product?.slug || product?.id);
}

async function syncInventoryToCloud() {
    const items = AdminStore.getInventory();
    if (!items.length) {
        showToast('No inventory to sync');
        return;
    }

    try {
        const res = await adminFetch(`${API_BASE}/admin/inventory/migrate`, {
            method: 'POST',
            body: JSON.stringify({ inventory: items })
        });
        const data = await res.json();
        showToast(` Synced ${data.added || 0}/${items.length} items to cloud`);
        clearTabCache('inventory');
        loadInventory({ force: true, resetPage: true }); // Refresh from cloud
    } catch (e) {
        showToast('[X] Sync failed: ' + extractApiError(e, null));
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
        await adminFetch(`${API_BASE}/admin/inventory/${id}`, { method: 'DELETE' });
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
        const res = await adminFetch(`${API_BASE}/admin/inventory/${id}/unassign`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            showToast('[OK] Account released back to available');
            loadInventory();
            loadStats();
        } else {
            showToast('[X] ' + (extractApiError(null, data) || 'Failed to unassign'));
        }
    } catch (e) {
        showToast('[X] Unassign failed: ' + extractApiError(e, null));
    }
}

async function resetInvStatus(id) {
    try {
        await fetch(`${API_BASE}/admin/inventory/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'available', order_id: null, reserved_at: null, delivered_at: null })
        });
        showToast('[OK] Reset to available');
        loadInventory();
        loadStats();
    } catch (e) {
        showToast('[X] Reset failed: ' + extractApiError(e, null));
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
    const phrase = prompt('Full catalog rebuild can overwrite products from this browser snapshot. Type REBUILD to continue.');
    if (phrase !== 'REBUILD') {
        showToast('Full catalog rebuild cancelled');
        return;
    }
    showToast(' Syncing catalog to cloud...');
    try {
        const products = AdminStore.getProducts();
        if (!products.length) {
            showToast('[X] No products to sync -- add products first or use "Seed Initial Catalog"');
            return;
        }
        const res = await adminFetch(`${API_BASE}/admin/catalog/migrate`, {
            method: 'POST',
            body: JSON.stringify({ products, confirm_full_replace: true })
        });
        const data = await res.json();
        if (data.success) {
            showToast(` ${data.count || products.length} products synced to cloud!`);
            clearTabCache('products');
        } else {
            showToast('[X] Catalog sync failed: ' + extractApiError(null, data));
        }
    } catch (e) {
        showToast('[X] Catalog sync error: ' + extractApiError(e, null));
        console.error('[CATALOG] Migration error:', e);
    }
}

/** Seed the database with the built-in SEED_CATALOG (first-time setup only) */
async function seedInitialCatalog() {
    if (!confirm('[WARN] Seed Initial Catalog?\n\nThis will populate the database with 14 starter products.\nUse this ONLY for first-time setup when the DB is empty.\n\nExisting products will be replaced!')) return;

    showToast(' Seeding initial catalog...');
    try {
        const seed = typeof SEED_CATALOG !== 'undefined' ? SEED_CATALOG : [];
        if (!seed.length) {
            showToast('[X] No seed catalog found');
            return;
        }
        const res = await adminFetch(`${API_BASE}/admin/catalog/migrate`, {
            method: 'POST',
            body: JSON.stringify({ products: seed, confirm_full_replace: true })
        });
        const data = await res.json();
        if (data.success) {
            showToast(` Seeded ${seed.length} products! Reloading...`);
            // Clear any stale overrides
            localStorage.removeItem('getotts_admin_products');
            // Reload to fetch fresh data from API
            setTimeout(() => location.reload(), 1500);
        } else {
            showToast('[X] Seed failed: ' + extractApiError(null, data));
        }
    } catch (e) {
        showToast('[X] Seed error: ' + extractApiError(e, null));
    }
}
window.seedInitialCatalog = seedInitialCatalog;

const TOP_DEALS_DEFAULT_CONFIG = {
    version: 1,
    auto_fill: true,
    window_days: 30,
    weights: { sales: 100, views: 8, discount: 2, boost: 30 },
    slots: { india: [], global: [] }
};

let adminTopDealsState = {
    market: 'india',
    config: null,
    preview: null,
    loadedAt: 0
};

function adminNormalizeMarket(value) {
    const market = String(value || '').toLowerCase();
    return ['global', 'usd', 'international', 'world'].includes(market) ? 'global' : 'india';
}

function adminTopDealProductKey(product = {}) {
    return String(product.slug || product.id || product.name || '').trim();
}

function adminTopDealProductKeys(product = {}) {
    return [product.slug, product.id, product.name]
        .map(value => String(value || '').trim().toLowerCase())
        .filter(Boolean);
}

function adminIsAmazonAllBenefits(product = {}) {
    const blob = adminTopDealProductKeys(product).join(' ');
    return blob.includes('amazon-prime-streaming') ||
        (blob.includes('amazon') && blob.includes('prime') && (blob.includes('all benefits') || blob.includes('shopping')));
}

function adminEffectiveRegionLock(product = {}) {
    let region = String(product.region_lock || 'all').toLowerCase();
    if (region === 'international') region = 'global';
    if (adminIsAmazonAllBenefits(product)) return 'india';
    return ['all', 'india', 'global'].includes(region) ? region : 'all';
}

function adminProductEligibleForTopDeals(product, market = adminTopDealsState.market) {
    const region = adminEffectiveRegionLock(product);
    return market === 'global' ? ['all', 'global'].includes(region) : ['all', 'india'].includes(region);
}

function adminNormalizeTopDealsConfig(raw = {}) {
    const config = {
        ...TOP_DEALS_DEFAULT_CONFIG,
        ...(raw && typeof raw === 'object' ? raw : {}),
        weights: {
            ...TOP_DEALS_DEFAULT_CONFIG.weights,
            ...((raw && raw.weights) || {})
        },
        slots: { india: [], global: [] }
    };
    ['india', 'global'].forEach(market => {
        const slots = raw?.slots?.[market] || [];
        config.slots[market] = slots
            .map((slot, index) => ({
                position: Math.max(1, Math.min(Number.parseInt(slot.position || index + 1, 10) || index + 1, 6)),
                product_key: String(slot.product_key || slot.productKey || '').trim(),
                enabled: slot.enabled !== false,
                badge: String(slot.badge || '').trim().slice(0, 32),
                boost: Math.max(0, Math.min(Number.parseInt(slot.boost || 0, 10) || 0, 100))
            }))
            .filter(slot => slot.product_key)
            .sort((a, b) => a.position - b.position)
            .slice(0, 6);
    });
    config.auto_fill = config.auto_fill !== false;
    config.window_days = Math.max(1, Math.min(Number.parseInt(config.window_days || 30, 10) || 30, 180));
    config.version = 1;
    return config;
}

function adminGetTopDealsEligibleProducts(market = adminTopDealsState.market) {
    return (AdminStore.getProducts() || [])
        .filter(product => product?.isActive !== false && product?.variants?.length && adminProductEligibleForTopDeals(product, market))
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
}

function adminTopDealsProductByKey(key) {
    const needle = String(key || '').trim().toLowerCase();
    if (!needle) return null;
    return (AdminStore.getProducts() || []).find(product => adminTopDealProductKeys(product).includes(needle)) || null;
}

function setTopDealsManagerMessage(text, type = 'info') {
    const el = document.getElementById('topDealsManagerMessage');
    if (!el) return;
    el.textContent = text;
    el.dataset.type = type;
}

function getTopDealsMarketSlots(market = adminTopDealsState.market) {
    const config = adminNormalizeTopDealsConfig(adminTopDealsState.config || TOP_DEALS_DEFAULT_CONFIG);
    const current = config.slots[market] || [];
    return Array.from({ length: 6 }, (_, index) => {
        const position = index + 1;
        return current.find(slot => Number(slot.position) === position) || {
            position,
            product_key: '',
            enabled: true,
            badge: '',
            boost: 0
        };
    });
}

function renderTopDealsProductOptions(market, selectedKey = '') {
    const selected = String(selectedKey || '').trim();
    const selectedLower = selected.toLowerCase();
    const eligible = adminGetTopDealsEligibleProducts(market);
    const selectedProduct = selected ? adminTopDealsProductByKey(selected) : null;
    const hasSelected = selectedProduct && eligible.some(product => adminTopDealProductKey(product).toLowerCase() === selectedLower);
    const options = ['<option value="">Auto-fill this slot</option>'];
    if (selectedProduct && !hasSelected) {
        options.push(`<option value="${escapeAttr(adminTopDealProductKey(selectedProduct))}" selected>${escapeHtml(selectedProduct.name || selected)} (not eligible here)</option>`);
    }
    eligible.forEach(product => {
        const key = adminTopDealProductKey(product);
        const region = adminEffectiveRegionLock(product);
        const selectedAttr = key.toLowerCase() === selectedLower ? ' selected' : '';
        options.push(`<option value="${escapeAttr(key)}"${selectedAttr}>${escapeHtml(product.name || key)} - ${region}</option>`);
    });
    return options.join('');
}

function collectTopDealsConfigFromForm() {
    const market = adminTopDealsState.market;
    const config = adminNormalizeTopDealsConfig(adminTopDealsState.config || TOP_DEALS_DEFAULT_CONFIG);
    config.auto_fill = document.getElementById('topDealsAutoFill')?.checked !== false;
    config.window_days = Math.max(1, Math.min(Number.parseInt(document.getElementById('topDealsWindowDays')?.value || '30', 10) || 30, 180));
    config.slots[market] = Array.from({ length: 6 }, (_, index) => {
        const position = index + 1;
        const productKey = String(document.getElementById(`topDealProduct_${position}`)?.value || '').trim();
        if (!productKey) return null;
        return {
            position,
            product_key: productKey,
            enabled: document.getElementById(`topDealEnabled_${position}`)?.checked !== false,
            badge: String(document.getElementById(`topDealBadge_${position}`)?.value || '').trim().slice(0, 32),
            boost: Math.max(0, Math.min(Number.parseInt(document.getElementById(`topDealBoost_${position}`)?.value || '0', 10) || 0, 100))
        };
    }).filter(Boolean);
    return config;
}

function renderTopDealsManager() {
    const slotList = document.getElementById('topDealsSlotList');
    if (!slotList) return;
    const market = adminTopDealsState.market;
    const config = adminNormalizeTopDealsConfig(adminTopDealsState.config || TOP_DEALS_DEFAULT_CONFIG);
    adminTopDealsState.config = config;

    document.getElementById('topDealsMarketIndia')?.classList.toggle('active', market === 'india');
    document.getElementById('topDealsMarketGlobal')?.classList.toggle('active', market === 'global');
    const autoFill = document.getElementById('topDealsAutoFill');
    if (autoFill) autoFill.checked = config.auto_fill !== false;
    const daysInput = document.getElementById('topDealsWindowDays');
    if (daysInput) daysInput.value = config.window_days || 30;

    const eligible = adminGetTopDealsEligibleProducts(market);
    const eligibilityText = document.getElementById('topDealsEligibilityText');
    if (eligibilityText) {
        eligibilityText.textContent = `${eligible.length} eligible ${market === 'global' ? 'Global' : 'India'} products`;
    }

    slotList.innerHTML = getTopDealsMarketSlots(market).map(slot => `
        <div class="top-deals-slot-row">
            <div class="top-deals-slot-num">#${slot.position}</div>
            <select id="topDealProduct_${slot.position}" aria-label="Product for slot ${slot.position}">
                ${renderTopDealsProductOptions(market, slot.product_key)}
            </select>
            <input id="topDealBadge_${slot.position}" type="text" value="${escapeAttr(slot.badge || '')}" maxlength="32" placeholder="Badge">
            <input id="topDealBoost_${slot.position}" type="number" min="0" max="100" step="5" value="${Number(slot.boost || 0)}" title="Promo boost">
            <label class="top-deals-slot-enabled">
                <input id="topDealEnabled_${slot.position}" type="checkbox" ${slot.enabled !== false ? 'checked' : ''}>
                Show
            </label>
            <button type="button" class="action-btn red" onclick="clearTopDealSlot(${slot.position})" title="Clear slot">
                <i data-lucide="x"></i>
            </button>
        </div>
    `).join('');

    renderTopDealsPreview(adminTopDealsState.preview?.market === market ? adminTopDealsState.preview.products : []);
    if (window.lucide) lucide.createIcons();
}

function renderTopDealsPreview(products = []) {
    const grid = document.getElementById('topDealsPreviewGrid');
    if (!grid) return;
    if (!products.length) {
        grid.innerHTML = '<div class="empty-state">Click Preview to see the resolved storefront order.</div>';
        return;
    }
    grid.innerHTML = products.slice(0, 6).map((product, index) => {
        const imageUrl = resolveAdminProductImageUrl(product.img);
        const meta = product.top_deal || {};
        const source = meta.source || (index < 6 ? 'manual' : 'auto');
        const imageMarkup = imageUrl
            ? `<img src="${escapeAttr(imageUrl)}" alt="${escapeAttr(product.name || 'Product')}">`
            : `<span class="top-deals-preview-fallback"><i data-lucide="image"></i></span>`;
        return `
            <div class="top-deals-preview-item">
                <span class="top-deals-slot-num">#${index + 1}</span>
                ${imageMarkup}
                <div class="top-deals-preview-main">
                    <strong>${escapeHtml(product.name || 'Unnamed product')}</strong>
                    <small>${escapeHtml(product.category || 'catalog')} - ${Number(meta.discount || 0)}% off - ${Number(meta.sales || 0)} sales - ${Number(meta.views || 0)} opens</small>
                </div>
                <span class="top-deals-source-pill ${source === 'auto' ? 'auto' : ''}">${escapeHtml(source)}</span>
            </div>
        `;
    }).join('');
    if (window.lucide) lucide.createIcons();
}

async function loadTopDealsManager(options = {}) {
    if (!document.getElementById('topDealsSlotList')) return;
    if (!options.force && adminTopDealsState.config && Date.now() - adminTopDealsState.loadedAt < 60000) {
        renderTopDealsManager();
        return;
    }
    try {
        const res = await adminFetch(`${API_BASE}/admin/top-deals/config?t=${Date.now()}`, { cache: 'no-store', timeoutMs: 12000 });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) throw new Error(extractApiError(null, data));
        adminTopDealsState.config = adminNormalizeTopDealsConfig(data.config || TOP_DEALS_DEFAULT_CONFIG);
        adminTopDealsState.loadedAt = Date.now();
        renderTopDealsManager();
        previewTopDealsManager({ quiet: true });
    } catch (e) {
        adminTopDealsState.config = adminNormalizeTopDealsConfig(TOP_DEALS_DEFAULT_CONFIG);
        renderTopDealsManager();
        setTopDealsManagerMessage(`Could not load saved Top Deals config: ${extractApiError(e, null)}`, 'error');
    }
}

window.switchTopDealsMarket = function(market) {
    adminTopDealsState.config = collectTopDealsConfigFromForm();
    adminTopDealsState.market = adminNormalizeMarket(market);
    adminTopDealsState.preview = null;
    renderTopDealsManager();
    previewTopDealsManager({ quiet: true });
};

window.clearTopDealSlot = function(position) {
    const select = document.getElementById(`topDealProduct_${position}`);
    const badge = document.getElementById(`topDealBadge_${position}`);
    const boost = document.getElementById(`topDealBoost_${position}`);
    const enabled = document.getElementById(`topDealEnabled_${position}`);
    if (select) select.value = '';
    if (badge) badge.value = '';
    if (boost) boost.value = '0';
    if (enabled) enabled.checked = true;
};

window.previewTopDealsManager = async function(options = {}) {
    if (!document.getElementById('topDealsSlotList')) return;
    const market = adminTopDealsState.market;
    const draftConfig = collectTopDealsConfigFromForm();
    adminTopDealsState.config = draftConfig;
    if (!options.quiet) setTopDealsManagerMessage('Building preview from manual slots + auto ranking...', 'info');
    try {
        const res = await adminFetch(`${API_BASE}/admin/top-deals/preview?market=${encodeURIComponent(market)}&limit=6&t=${Date.now()}`, {
            method: 'POST',
            body: JSON.stringify({ config: draftConfig }),
            cache: 'no-store',
            timeoutMs: 15000
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) throw new Error(extractApiError(null, data));
        adminTopDealsState.preview = { market, products: data.products || [] };
        renderTopDealsManager();
        if (!options.quiet) setTopDealsManagerMessage(`${market === 'global' ? 'Global' : 'India'} preview ready: ${(data.products || []).length} products.`, 'success');
    } catch (e) {
        renderTopDealsPreview([]);
        if (!options.quiet) setTopDealsManagerMessage(`Preview failed: ${extractApiError(e, null)}`, 'error');
    }
};

window.saveTopDealsManager = async function() {
    const config = collectTopDealsConfigFromForm();
    adminTopDealsState.config = config;
    setTopDealsManagerMessage('Saving Top Deals Manager...', 'info');
    try {
        const res = await adminFetch(`${API_BASE}/admin/top-deals/config`, {
            method: 'POST',
            body: JSON.stringify({ config }),
            timeoutMs: 15000
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) throw new Error(extractApiError(null, data));
        adminTopDealsState.config = adminNormalizeTopDealsConfig(data.config || config);
        adminTopDealsState.loadedAt = Date.now();
        renderTopDealsManager();
        await previewTopDealsManager({ quiet: true });
        showToast('[OK] Top Deals Manager saved');
        setTopDealsManagerMessage('Saved. Homepage will now resolve separate India and Global Top Deals.', 'success');
    } catch (e) {
        showToast('[X] Top Deals save failed: ' + extractApiError(e, null));
        setTopDealsManagerMessage(`Save failed: ${extractApiError(e, null)}`, 'error');
    }
};

async function loadProducts(options = {}) {
    const body = document.getElementById('productsBody');
    if (!body) return;
    if (shouldUseTabCache('products', options) && body.children.length && !body.textContent.includes('Loading')) return;
    const shouldRefreshStock = !options.skipStockRefresh && (
        !adminStockSummaryCache.length ||
        options.force ||
        Date.now() - adminStockSummaryLoadedAt > ADMIN_STOCK_SUMMARY_TTL
    );
    if (shouldRefreshStock) {
        loadStockSummary({ force: !!options.force }).then(() => {
            const productsTab = document.getElementById('tab-products');
            if (productsTab?.classList.contains('active')) {
                clearTabCache('products');
                loadProducts({ force: true, skipStockRefresh: true });
            }
        }).catch(() => {});
    }
    setTableLoading(body, 7, 'Loading products...');
    const search = (document.getElementById('productSearch')?.value || '').trim().toLowerCase();
    const products = AdminStore.getProducts().filter(p => {
        if (!search) return true;
        return [p.name, p.slug, p.id, p.category, p.region_lock]
            .filter(Boolean)
            .some(value => String(value).toLowerCase().includes(search));
    });

    if (!products || products.length === 0) {
        body.innerHTML = `<tr><td colspan="7" class="empty-state" style="padding:40px; text-align:center;">
            <div style="font-size:2rem; margin-bottom:12px;"></div>
            <div style="font-weight:700; margin-bottom:8px;">${search ? 'No products match your search' : 'No products in catalog'}</div>
            <div style="color:var(--gray-500); margin-bottom:16px;">${search ? 'Try a different product, slug, or category.' : 'Add products manually with "+ Create New Product" or seed the starter catalog.'}</div>
            ${search ? '' : `<button class="action-btn blue" onclick="seedInitialCatalog()" style="padding:10px 24px; font-size:0.9rem; border-radius:10px; cursor:pointer;">
                 Seed Initial Catalog (14 products)
            </button>`}
        </td></tr>`;
        return;
    }

    body.innerHTML = products.map(p => {
        const variants = p.variants || [];
        const shared = variants.find(v => v.accessType === 'shared');
        const personal = variants.find(v => v.accessType === 'personal');

        const sharedPrice = shared ? dualMoney(shared.price, shared.price_usd) : '--';
        const personalPrice = personal ? dualMoney(personal.price, personal.price_usd) : '--';

        // Region badge
        const regionMap = { all: 'Global + India', india: 'India Only', global: 'Global Only' };
        const regionLabel = regionMap[p.region_lock || 'all'] || 'Global + India';

        // Real Stock Calculation: Sum available inventory for this platform (by slug or name)
        const platformSlug = p.slug || p.id; // e.g. 'netflix'
        const liveStock = getProductAvailableStock(p);
        const stockClass = liveStock > 0 ? 'green' : 'red';
        const stableKey = p.slug || p.id; // Use slug as stable key for operations
        const imageUrl = resolveAdminProductImageUrl(p.img);
        const imageMarkup = imageUrl
            ? `<img src="${escapeAttr(imageUrl)}" alt="${escapeAttr(p.name || 'Product')}" style="width:40px;height:40px;border-radius:10px;object-fit:cover;border:1px solid var(--gray-200);background:#f3f4f6;flex-shrink:0;" onerror="this.style.display='none';this.nextElementSibling.style.display='inline-flex';"><span style="display:none;width:40px;height:40px;border-radius:10px;align-items:center;justify-content:center;background:#f3f4f6;color:var(--gray-500);font-size:1rem;flex-shrink:0;"><i data-lucide='image-off'></i></span>`
            : `<span style="width:40px;height:40px;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;background:#f3f4f6;color:var(--gray-500);font-size:1rem;flex-shrink:0;"><i data-lucide='image-off'></i></span>`;
        const featuredPosition = getAdminFeaturedPosition(p);
        const featuredMarkup = p.isHot
            ? `<span class="pill pill-processing" style="font-size:0.7rem;">Featured${featuredPosition ? ` #${featuredPosition}` : ''}</span>`
            : '--';

        return `
        <tr>
            <td>
                <div style="display:flex; align-items:center; gap:12px;">
                    ${imageMarkup}
                    <div>
                        <div style="font-weight:700; display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                            <span>${p.name || 'Unknown'}</span>
                            <span title="${p.region_lock || 'all'}" style="font-size:.68rem; color:var(--gray-600); background:var(--gray-100); border:1px solid var(--gray-200); border-radius:999px; padding:2px 7px;">${regionLabel}</span>
                        </div>
                        <div style="font-size:0.7rem;color:var(--gray-500)">${platformSlug}</div>
                    </div>
                </div>
            </td>
            <td>
                <span class="pill pill-delivered" style="font-size:0.7rem;">${p.delivery_mode === 'manual' ? 'Manual' : 'Auto'}</span>
            </td>
            <td style="font-weight:600;color:var(--gray-700)">${sharedPrice}</td>
            <td style="font-weight:600;color:var(--gray-700)">${personalPrice}</td>
            <td>
                <span style="font-weight:700;color:var(--${stockClass}-600)">${liveStock}</span>
                <small style="color:var(--gray-400)"> avail</small>
            </td>
            <td>${featuredMarkup}</td>
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
    markTabCache('products');
}

window._wizardVariants = [];

function getAdminFeaturedPosition(product) {
    const raw = product?.featured_position ??
        product?.featuredPosition ??
        product?.featured_order ??
        product?.featuredOrder ??
        product?.hot_order ??
        product?.hotOrder;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

function readPositiveIntInput(id) {
    const raw = String(document.getElementById(id)?.value || '').trim();
    if (!raw) return 0;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

window.openProductWizard = function(id = null) {
    const modal = document.getElementById('productWizardModal');
    const title = document.getElementById('wizTitle');

    if (!modal) {
        console.error('[AdminWizard] Error: productWizardModal not found in DOM!');
        showToast('[X] UI Error: Wizard modal missing');
        return;
    }

    // Explicitly show modal immediately to confirm the button works
    modal.style.display = 'flex';
    modal.style.zIndex = '9999'; // Ensure it's on top

    if (id) {
        const products = AdminStore.getProducts();

        // Robust lookup: try id, then slug
        const prod = products.find(p => String(p.id) === String(id) || String(p.slug) === String(id));

        if (!prod) {
            console.warn('[AdminWizard] Product not found for key:', id);
            showToast('[X] Product not found: ' + id);
            // Don't close, let them see the empty wizard or stay in the current state
            return;
        }

        const wizIdEl = document.getElementById('wizId');
        const wizSlugEl = document.getElementById('wizSlug');
        if (wizIdEl) wizIdEl.value = prod.id || id;
        if (wizSlugEl) wizSlugEl.value = prod.slug || id;
        window._wizSlugManual = true;
        if (title) title.textContent = "Edit Product: " + (prod.name || 'Unnamed');

        // Populate inputs
        if (document.getElementById('wizName')) document.getElementById('wizName').value = prod.name || '';
        if (document.getElementById('wizCategory')) document.getElementById('wizCategory').value = prod.category || 'streaming';
        if (document.getElementById('wizImg')) document.getElementById('wizImg').value = prod.img || '';
        if (document.getElementById('wizEmoji')) document.getElementById('wizEmoji').value = prod.emoji || '';
        if (document.getElementById('wizActive')) document.getElementById('wizActive').checked = prod.isActive !== false;
        if (document.getElementById('wizHot')) document.getElementById('wizHot').checked = prod.isHot === true;
        if (document.getElementById('wizFeaturedPosition')) document.getElementById('wizFeaturedPosition').value = getAdminFeaturedPosition(prod) || '';
        if (document.getElementById('wizRegionLock')) document.getElementById('wizRegionLock').value = prod.region_lock || 'all';
        const usageMeta = adminGetUsageMeta(prod);
        if (document.getElementById('wizUsageType')) document.getElementById('wizUsageType').value = usageMeta.usage_type || 'auto';
        if (document.getElementById('wizUsageNote')) document.getElementById('wizUsageNote').value = usageMeta.usage_note || '';
        window._wizardUsageSteps = Array.isArray(usageMeta.usage_steps) ? [...usageMeta.usage_steps] : [];

        if (document.getElementById('wizDeliveryMode')) document.getElementById('wizDeliveryMode').value = prod.delivery_mode || 'automatic';
        if (document.getElementById('wizAuthType')) document.getElementById('wizAuthType').value = prod.auth_type || 'email_password';
        if (document.getElementById('wizDescription')) document.getElementById('wizDescription').value = prod.description || '';
        if (document.getElementById('wizKeywords')) document.getElementById('wizKeywords').value = (prod.seo_keywords || []).join(', ');
        if (document.getElementById('wizSupportAiNotes')) {
            const settings = AdminStore.getSettings();
            const notesMap = settings.product_support_ai_notes || {};
            document.getElementById('wizSupportAiNotes').value = prod.support_ai_notes || notesMap[prod.id] || notesMap[prod.slug] || notesMap[prod.name] || '';
        }

        window._wizardVariants = (prod.variants ? JSON.parse(JSON.stringify(prod.variants)) : []).map(v => {
            v.price_usd = parseFloat(v.price_usd) || 0;
            v.original_price_usd = parseFloat(v.original_price_usd) || 0;
            return v;
        });

        window._wizardFaqs = (prod.faqs && Array.isArray(prod.faqs)) ? JSON.parse(JSON.stringify(prod.faqs)) : [];
        window._wizardReviews = (prod.reviews && Array.isArray(prod.reviews)) ? JSON.parse(JSON.stringify(prod.reviews)) : [];
    } else {
        // Create new
        const newId = 'custom-' + Date.now().toString(36);
        if (document.getElementById('wizId')) document.getElementById('wizId').value = newId;
        if (document.getElementById('wizSlug')) document.getElementById('wizSlug').value = '';
        window._wizSlugManual = false;
        title.textContent = "Create New Product";

        const setVal = (id, val) => { const el = document.getElementById(id); if(el) el.value = val; };
        const setChecked = (id, val) => { const el = document.getElementById(id); if(el) el.checked = val; };

        setVal('wizName', '');
        setVal('wizCategory', 'streaming');
        setVal('wizImg', '');
        setVal('wizEmoji', '[MAGIC]');
        setChecked('wizActive', true);
        setChecked('wizHot', false);
        setVal('wizFeaturedPosition', '');
        setVal('wizRegionLock', 'all');
        setVal('wizUsageType', 'auto');
        setVal('wizUsageNote', '');
        window._wizardUsageSteps = [];
        setVal('wizDeliveryMode', 'automatic');
        setVal('wizAuthType', 'email_password');
        setVal('wizDescription', '');
        setVal('wizKeywords', '');
        setVal('wizSupportAiNotes', '');

        window._wizardVariants = [
            { sku: newId + '-1m', accessType: 'shared', durationLabel: '1 Month', price: 99, originalPrice: 199, price_usd: 2, original_price_usd: 4, stock: 10 }
        ];
        window._wizardFeatures = { shared: ['Instant Delivery'], personal: [] };
        window._wizardFaqs = [
            { q: "Is this safe?", a: "Yes, 100% legal and safe accounts." },
            { q: "How long does delivery take?", a: "Instant delivery to your email/whatsapp." }
        ];
        window._wizardReviews = [
            { user: "Aravind K.", rating: 5, comment: "Amazing service! Got my account in seconds." }
        ];
    }

    wizRenderVariants();
    wizRenderFeatures();
    if (typeof wizRenderUsageSteps === 'function') wizRenderUsageSteps();
    wizRenderFaqs();
    wizRenderReviews();
    modal.style.display = 'flex';

    // Setup image preview
    setTimeout(() => {
        const imgVal = document.getElementById('wizImg').value;
        const preview = document.getElementById('wizImgPreview');
        if (preview && imgVal) {
            preview.src = resolveAdminProductImageUrl(imgVal);
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
        if (status) { status.textContent = '[X] Please select an image file first'; status.style.color = '#ef4444'; }
        return;
    }

    if (status) { status.textContent = ' Uploading...'; status.style.color = 'var(--accent)'; }

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);

    const csrfMatch = document.cookie.match(new RegExp('(^| )admin_csrf_token=([^;]+)'));
    const headers = new Headers();
    if (csrfMatch) headers.append('X-CSRF-Token', csrfMatch[2]);

    try {
        const resp = await fetch(`${API_BASE}/admin/upload-image`, {
            method: 'POST',
            body: formData,
            credentials: 'include',
            headers: headers
        });
        const data = await resp.json();

        if (resp.ok && data.success) {
            document.getElementById('wizImg').value = data.url;
            const preview = document.getElementById('wizImgPreview');
            if (preview) { preview.src = data.url; preview.style.display = 'block'; }
            if (status) { status.textContent = '[OK] Image uploaded!'; status.style.color = '#059669'; }
            showToast('Image uploaded! ');
        } else {
            if (status) { status.textContent = `[X] ${data.detail || 'Upload failed'}`; status.style.color = '#ef4444'; }
        }
    } catch (err) {
        if (status) { status.textContent = `[X] Network error: ${err.message}`; status.style.color = '#ef4444'; }
    }
};

window.closeProductWizard = function() {
    document.getElementById('productWizardModal').style.display = 'none';
};

window.toggleProductActive = function(id) {
    const prod = AdminStore.getProducts().find(p => String(p.id) === String(id) || String(p.slug) === String(id));
    if (!prod) return;
    const overrideKey = prod.slug || prod.id;
    const newState = prod.isActive === false;
    AdminStore.updateProduct(overrideKey, { isActive: newState });
    loadProducts();
    loadTopDealsManager({ force: true });
    showToast(` Product ${newState ? 'activated' : 'hidden'}`);
};

window.confirmDeleteProduct = async function(id, name) {
    if (!confirm(`[WARN] Delete "${name}"?\n\nThis will remove the product from the catalog, storefront, and database.\n\nThis action cannot be undone easily.`)) return;
    const prod = AdminStore.getProducts().find(p => String(p.id) === String(id) || String(p.slug) === String(id));
    const deleteKey = prod ? (prod.id || prod.slug || id) : id;
    const overrideKey = prod ? (prod.slug || prod.id || id) : id;
    showToast(`Deleting "${name}" from database...`);
    try {
        const resp = await adminFetch(`${API_BASE}/admin/products/${encodeURIComponent(deleteKey)}`, {
            method: 'DELETE',
            timeoutMs: 30000
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || data.success === false) {
            throw new Error(extractApiError(null, data) || `Delete failed (${resp.status})`);
        }

        AdminStore.deleteProduct(overrideKey);
        try {
            await refreshAdminCatalogFromCloud();
        } catch (refreshErr) {
            console.warn('[Products] Catalog refresh after delete failed:', refreshErr);
        }
        loadProducts({ force: true });
        loadTopDealsManager({ force: true });
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
                <div style="font-size:1.5rem; margin-bottom:8px;"></div>
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
                    <div style="font-size:0.72rem; font-weight:700; color:#15803d; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px;"> INR Pricing</div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                        <div>
                            <label style="display:block; font-size:0.7rem; font-weight:600; color:var(--gray-500); margin-bottom:3px;">Price (Rs)</label>
                            <input type="number" value="${v.price || 0}" oninput="window._wizardVariants[${i}].price = parseInt(this.value) || 0" style="width:100%; padding:7px 8px; border:1px solid #86efac; border-radius:8px; font-size:0.85rem; font-weight:700; font-family:var(--font-body); background:white;" min="0">
                        </div>
                        <div>
                            <label style="display:block; font-size:0.7rem; font-weight:600; color:var(--gray-500); margin-bottom:3px;">MRP (Rs)</label>
                            <input type="number" value="${v.originalPrice || 0}" oninput="window._wizardVariants[${i}].originalPrice = parseInt(this.value) || 0" style="width:100%; padding:7px 8px; border:1px solid #86efac; border-radius:8px; font-size:0.85rem; font-family:var(--font-body); background:white; color:var(--gray-500);" min="0">
                        </div>
                    </div>
                </div>
                <!-- USD Pricing -->
                <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:10px; padding:10px 14px;">
                    <div style="font-size:0.72rem; font-weight:700; color:#1d4ed8; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px;"> USD Pricing</div>
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

//  Features Editor
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

window._wizardUsageSteps = [];

window.wizRenderUsageSteps = function() {
    const container = document.getElementById('wizUsageSteps');
    if (!container) return;
    const steps = window._wizardUsageSteps || [];
    if (!steps.length) {
        container.innerHTML = '<div style="padding:12px 14px;border:1px dashed var(--gray-200);border-radius:12px;color:var(--gray-500);font-size:.85rem;background:var(--gray-50);">No custom steps yet. Storefront will auto-generate setup instructions from setup type and plan.</div>';
        return;
    }
    container.innerHTML = steps.map((step, i) => `
        <div style="display:grid;grid-template-columns:28px 1fr 34px;gap:8px;align-items:center;">
            <span style="width:28px;height:28px;border-radius:9px;background:var(--gray-800);color:white;display:grid;place-items:center;font-size:.75rem;font-weight:800;">${i + 1}</span>
            <input type="text" value="${escapeAttr(step)}" oninput="wizUpdateUsageStep(${i}, this.value)" placeholder="Example: Open the invite link and accept with your own email."
                   style="width:100%;padding:8px 12px;border:1px solid var(--gray-200);border-radius:var(--radius);font-size:.85rem;font-family:var(--font-body);">
            <button class="action-btn red" onclick="wizRemoveUsageStep(${i})" type="button"><i data-lucide="x"></i></button>
        </div>
    `).join('');
    if (window.lucide) lucide.createIcons();
};

window.wizAddUsageStep = function() {
    if (!window._wizardUsageSteps) window._wizardUsageSteps = [];
    window._wizardUsageSteps.push('');
    wizRenderUsageSteps();
    const inputs = document.querySelectorAll('#wizUsageSteps input');
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

// FAQ Logic
window.wizRenderFaqs = function() {
    const container = document.getElementById('wizFaqContainer');
    if (!container) return;
    const faqs = window._wizardFaqs || [];
    container.innerHTML = faqs.map((f, i) => `
        <div style="background:var(--gray-50); border:1px solid var(--gray-200); border-radius:12px; padding:12px; position:relative;">
            <button class="action-btn red" onclick="wizRemoveFaq(${i})" style="position:absolute; top:8px; right:8px; width:24px; height:24px;">&times;</button>
            <div style="margin-bottom:8px;">
                <label style="font-size:0.7rem; font-weight:700; color:var(--gray-400); text-transform:uppercase;">Question</label>
                <input type="text" value="${f.q || ''}" oninput="window._wizardFaqs[${i}].q = this.value" placeholder="Question..." style="width:100%; padding:8px; border:1px solid var(--gray-200); border-radius:8px; font-size:0.85rem;">
            </div>
            <div>
                <label style="font-size:0.7rem; font-weight:700; color:var(--gray-400); text-transform:uppercase;">Answer</label>
                <textarea oninput="window._wizardFaqs[${i}].a = this.value" placeholder="Answer..." style="width:100%; height:60px; padding:8px; border:1px solid var(--gray-200); border-radius:8px; font-size:0.85rem; font-family:var(--font-body); resize:vertical;">${f.a || ''}</textarea>
            </div>
        </div>
    `).join('');
    if (window.lucide) lucide.createIcons();
};
window.wizAddFaq = function() {
    if (!window._wizardFaqs) window._wizardFaqs = [];
    window._wizardFaqs.push({ q: '', a: '' });
    wizRenderFaqs();
};
window.wizRemoveFaq = function(idx) {
    window._wizardFaqs.splice(idx, 1);
    wizRenderFaqs();
};

// Reviews Logic
window.wizRenderReviews = function() {
    const container = document.getElementById('wizReviewsContainer');
    if (!container) return;
    const reviews = window._wizardReviews || [];
    container.innerHTML = reviews.map((r, i) => `
        <div style="background:var(--gray-50); border:1px solid var(--gray-200); border-radius:12px; padding:12px; position:relative;">
            <button class="action-btn red" onclick="wizRemoveReview(${i})" style="position:absolute; top:8px; right:8px; width:24px; height:24px;">&times;</button>
            <div style="display:grid; grid-template-columns: 1fr 100px; gap:10px; margin-bottom:8px;">
                <div>
                    <label style="font-size:0.7rem; font-weight:700; color:var(--gray-400); text-transform:uppercase;">User Name</label>
                    <input type="text" value="${r.user || ''}" oninput="window._wizardReviews[${i}].user = this.value" placeholder="Name..." style="width:100%; padding:8px; border:1px solid var(--gray-200); border-radius:8px; font-size:0.85rem;">
                </div>
                <div>
                    <label style="font-size:0.7rem; font-weight:700; color:var(--gray-400); text-transform:uppercase;">Rating</label>
                    <input type="number" value="${r.rating || 5}" min="1" max="5" oninput="window._wizardReviews[${i}].rating = parseInt(this.value) || 5" style="width:100%; padding:8px; border:1px solid var(--gray-200); border-radius:8px; font-size:0.85rem; text-align:center;">
                </div>
            </div>
            <div>
                <label style="font-size:0.7rem; font-weight:700; color:var(--gray-400); text-transform:uppercase;">Comment</label>
                <textarea oninput="window._wizardReviews[${i}].comment = this.value" placeholder="Comment..." style="width:100%; height:60px; padding:8px; border:1px solid var(--gray-200); border-radius:8px; font-size:0.85rem; font-family:var(--font-body); resize:vertical;">${r.comment || ''}</textarea>
            </div>
        </div>
    `).join('');
    if (window.lucide) lucide.createIcons();
};
window.wizAddReview = function() {
    if (!window._wizardReviews) window._wizardReviews = [];
    window._wizardReviews.push({ user: '', rating: 5, comment: '' });
    wizRenderReviews();
};
window.wizRemoveReview = function(idx) {
    window._wizardReviews.splice(idx, 1);
    wizRenderReviews();
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
    const field = (id) => document.getElementById(id);
    const value = (id, fallback = '') => {
        const el = field(id);
        return el ? String(el.value ?? fallback) : fallback;
    };
    const checked = (id, fallback = false) => {
        const el = field(id);
        return el ? !!el.checked : fallback;
    };
    const originalId = value('wizId').trim();
    const slugField = value('wizSlug').trim();
    const name = value('wizName').trim();
    const saveBtn = document.querySelector('#productWizardModal .modal-footer .btn-primary, [onclick="saveProductWizard()"]');
    const oldLabel = saveBtn ? saveBtn.innerHTML : '';

    if (!name) {
        showToast('[X] Product name is required');
        return;
    }

    // Validate USD pricing when region_lock = 'global'
    const regionLock = value('wizRegionLock', 'all');
    if (regionLock === 'global' && window._wizardVariants && window._wizardVariants.length > 0) {
        const missingUsd = window._wizardVariants.filter(v => !v.price_usd || v.price_usd <= 0);
        if (missingUsd.length > 0) {
            showToast('[X] USD pricing is required for International Only products. Fill in Price ($) for all variants.');
            return;
        }
    }

    // Determine the actual product ID to use
    // If slug is provided, use it. Otherwise fall back to the original auto-generated ID.
    let id = slugField || originalId;
    // Sanitize slug
    id = id.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    if (!id) id = originalId;

    const productPayload = {
        id,
        slug: id,
        name,
        category: value('wizCategory', 'streaming'),
        img: value('wizImg'),
        emoji: value('wizEmoji', ''),
        isActive: checked('wizActive', true),
        isHot: checked('wizHot', false),
        featured_position: readPositiveIntInput('wizFeaturedPosition'),
        featuredPosition: readPositiveIntInput('wizFeaturedPosition'),
        region_lock: value('wizRegionLock', 'all'),
        usage_type: value('wizUsageType', 'auto'),
        usage_steps: (window._wizardUsageSteps || []).map(s => String(s || '').trim()).filter(Boolean),
        usage_note: value('wizUsageNote', ''),
        delivery_mode: value('wizDeliveryMode', 'automatic'),
        auth_type: value('wizAuthType', 'email_password'),
        variants: Array.isArray(window._wizardVariants) ? window._wizardVariants : [],
        features: window._wizardFeatures || { shared: [], personal: [] },
        faqs: adminMergeUsageFaqMeta(window._wizardFaqs || [], value('wizUsageType', 'auto'), window._wizardUsageSteps || [], value('wizUsageNote', '')),
        reviews: window._wizardReviews || [],
        description: value('wizDescription'),
        seo_keywords: value('wizKeywords').split(',').map(k => k.trim()).filter(k => k),
        support_ai_notes: value('wizSupportAiNotes').trim()
    };

    const currentSettings = AdminStore.getSettings();
    const notesMap = { ...(currentSettings.product_support_ai_notes || {}) };
    if (productPayload.support_ai_notes) {
        notesMap[id] = productPayload.support_ai_notes;
        if (productPayload.slug) notesMap[productPayload.slug] = productPayload.support_ai_notes;
        if (productPayload.name) notesMap[productPayload.name] = productPayload.support_ai_notes;
    } else {
        delete notesMap[id];
        if (productPayload.slug) delete notesMap[productPayload.slug];
        if (productPayload.name) delete notesMap[productPayload.name];
    }
    const featuredPositions = { ...(currentSettings.product_featured_positions || {}) };
    const featuredKeys = [id, productPayload.slug, productPayload.name, originalId].filter(Boolean);
    featuredKeys.forEach(key => {
        if (productPayload.isHot && productPayload.featured_position > 0) featuredPositions[key] = productPayload.featured_position;
        else delete featuredPositions[key];
    });
    const nextSettings = {
        ...currentSettings,
        product_support_ai_notes: notesMap,
        product_featured_positions: featuredPositions
    };

    try {
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = 'Saving...';
        }
        showToast('Saving product...');
        const res = await adminFetch(`${API_BASE}/admin/catalog/product`, {
            method: 'POST',
            body: JSON.stringify({
                product: productPayload,
                original_id: originalId,
                support_ai_notes: productPayload.support_ai_notes
            }),
            timeoutMs: 30000
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
            data.status = res.status;
            throw new Error(extractApiError(null, data) || `Save failed (${res.status})`);
        }

        const settingsSavePromise = adminFetch(`${API_BASE}/admin/settings/save`, {
            method: 'POST',
            body: JSON.stringify({ settings: nextSettings }),
            timeoutMs: 10000
        }).then(r => r.json().catch(() => ({})))
          .then(data => {
              if (data.success && data.settings) AdminStore.saveSettings(data.settings);
              else AdminStore.saveSettings(nextSettings);
          })
          .catch(e => {
              AdminStore.saveSettings(nextSettings);
              console.warn('[ProductWizard] Support AI notes sync failed:', e);
          });

        const freshCatalog = await refreshAdminCatalogFromCloud();
        await settingsSavePromise;
        const saved = freshCatalog.find(p => String(p.slug) === String(id) || String(p.id) === String(data.proof?.product_id));
        if (productPayload.isActive !== false && (!saved || saved.name !== name)) {
            throw new Error('Product saved, but the refreshed catalog did not confirm the change. Please retry after hard refresh.');
        }

        const overrides = AdminStore._getObj('getotts_admin_products', {});
        delete overrides[originalId];
        delete overrides[id];
        AdminStore._set('getotts_admin_products', overrides);
    } catch (e) {
        console.error('[ProductWizard] Backend save failed:', e);
        showToast('[X] Product save failed: ' + extractApiError(e, null));
        return;
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = oldLabel || '<i data-lucide="save"></i> Save Product Configurations';
            if (window.lucide) lucide.createIcons();
        }
    }

    closeProductWizard();
    clearTabCache('products');
    loadProducts({ force: true });
    loadTopDealsManager({ force: true });
    showToast(`[OK] Product "${name}" saved and verified.`);
};

function toggleFeatured(id) {
    const overrides = AdminStore._getObj('getotts_admin_products', {});
    const current = overrides[id]?.isHot ?? PRODUCTS.find(p => p.id === id)?.isHot ?? false;
    AdminStore.updateProduct(id, { isHot: !current });
    loadProducts();
    loadTopDealsManager({ force: true });
    showToast(current ? 'Removed from featured' : 'Marked as featured [STAR]');
}

function editProductStock(id) {
    const product = PRODUCTS.find(p => p.id === id);
    if (!product) return;

    // Build a rich edit modal
    const overrides = AdminStore._getObj('getotts_admin_products', {});
    const merged = { ...product, ...(overrides[id] || {}) };
    const currentImg = merged.img || `assets/images/${id}.png`;
    const usageMeta = adminGetUsageMeta(merged);

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
                            <img id="editProductImgPreview" src="${escapeAttr(resolveAdminProductImageUrl(currentImg))}" alt="Preview"
                                 style="width:64px; height:64px; border-radius:12px; object-fit:cover; border:1px solid var(--gray-200);">
                            <div style="flex:1">
                                <input type="file" id="editProductImgFile" accept="image/*"
                                       style="font-size:0.85rem; font-family:var(--font-body);">
                                <div id="editProductImgStatus" style="font-size:0.8rem; color:var(--gray-500); margin-top:4px;">Select an image to upload</div>
                            </div>
                        </div>
                        <button class="btn btn-outline" style="font-size:0.85rem; padding:6px 12px; margin-bottom:8px;" onclick="uploadProductImage('${id}')">
                             Upload to Cloud
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
                            <option value="true" ${merged.isHot ? 'selected' : ''}>Yes [STAR]</option>
                            <option value="false" ${!merged.isHot ? 'selected' : ''}>No</option>
                        </select>
                    </div>
                    <div class="ck-field">
                        <label>Active (Visible in Store)</label>
                        <select id="editProductActive">
                            <option value="true" ${merged.isActive !== false ? 'selected' : ''}>Yes, Visible </option>
                            <option value="false" ${merged.isActive === false ? 'selected' : ''}>No, Hidden </option>
                        </select>
                    </div>
                    <div class="ck-field">
                        <label>Region Availability</label>
                        <select id="editRegionLock">
                            <option value="all" ${(merged.region_lock || 'all') === 'all' ? 'selected' : ''}>Global + India</option>
                            <option value="india" ${merged.region_lock === 'india' ? 'selected' : ''}>India Only</option>
                            <option value="global" ${merged.region_lock === 'global' ? 'selected' : ''}>Global Only</option>
                        </select>
                    </div>
                    <div class="ck-field">
                        <label>How to Use Setup Type</label>
                        <select id="editUsageType">
                            <option value="auto" ${(usageMeta.usage_type || 'auto') === 'auto' ? 'selected' : ''}>Auto detect from product</option>
                            <option value="shared_account" ${usageMeta.usage_type === 'shared_account' ? 'selected' : ''}>Shared account/profile</option>
                            <option value="shared_link" ${usageMeta.usage_type === 'shared_link' ? 'selected' : ''}>Shared by link</option>
                            <option value="shared_id_password" ${usageMeta.usage_type === 'shared_id_password' ? 'selected' : ''}>Shared ID + password</option>
                            <option value="mail_activation" ${usageMeta.usage_type === 'mail_activation' ? 'selected' : ''}>Activation on mail</option>
                            <option value="number_activation" ${usageMeta.usage_type === 'number_activation' ? 'selected' : ''}>Activation on number</option>
                            <option value="otp_login" ${usageMeta.usage_type === 'otp_login' ? 'selected' : ''}>Login with OTP</option>
                            <option value="invite_link" ${usageMeta.usage_type === 'invite_link' ? 'selected' : ''}>Invite link</option>
                            <option value="personal_account" ${usageMeta.usage_type === 'personal_account' ? 'selected' : ''}>Personal account</option>
                            <option value="custom" ${usageMeta.usage_type === 'custom' ? 'selected' : ''}>Custom steps from full wizard</option>
                        </select>
                    </div>
                    <div class="ck-field">
                        <label>How to Use Note</label>
                        <input type="text" id="editUsageNote" value="${escapeAttr(usageMeta.usage_note || '')}" placeholder="Example: Do not change password or recovery details.">
                    </div>
                    <div class="ck-field">
                        <label>Default Delivery Mode (Product-level fallback)</label>
                        <select id="editDeliveryMode">
                            <option value="automatic" ${merged.delivery_mode === 'automatic' || !merged.delivery_mode ? 'selected' : ''}>Automatic (Assign instantly)</option>
                            <option value="manual" ${merged.delivery_mode === 'manual' ? 'selected' : ''}>Manual (Admin handles fulfillment)</option>
                        </select>
                    </div>
                    <div class="ck-field">
                        <label>Default Auth Type (Product-level fallback)</label>
                        <select id="editAuthType">
                            <option value="email_password" ${merged.auth_type === 'email_password' || !merged.auth_type ? 'selected' : ''}>Email & Password</option>
                            <option value="phone_otp" ${merged.auth_type === 'phone_otp' ? 'selected' : ''}>Phone & OTP</option>
                            <option value="invite_link" ${merged.auth_type === 'invite_link' ? 'selected' : ''}>Invite Link</option>
                            <option value="app_login" ${merged.auth_type === 'app_login' ? 'selected' : ''}>App Login (Scan QR, etc.)</option>
                        </select>
                    </div>
                    <div class="ck-field">
                        <label>Account Type</label>
                        <select id="editAccountType">
                            <option value="shared" ${merged.account_type === 'shared' || !merged.account_type ? 'selected' : ''}>Shared Profile</option>
                            <option value="personal" ${merged.account_type === 'personal' ? 'selected' : ''}>Personal Account</option>
                        </select>
                    </div>
                    ${(merged.variants && merged.variants.length > 0) ? `
                    <div class="ck-field" style="margin-top:16px;">
                        <label style="font-size:0.95rem; font-weight:700; color:var(--primary);"> Per-Variant Settings (Pricing, Delivery & Auth)</label>
                        <p style="font-size:0.75rem; color:var(--gray-500); margin:4px 0 12px;">Edit pricing and override delivery settings per variant. "Inherit" uses the product-level default.</p>
                        ${merged.variants.map((v, i) => {
                            const vDm = v.delivery_mode || '';
                            const vAt = v.auth_type || '';
                            const label = (v.durationLabel || v.duration_label || '?') + ' ' + (v.accessType || v.access_type || '');
                            return `
                            <div style="background:var(--gray-50); border:1px solid var(--gray-200); border-radius:10px; padding:12px; margin-bottom:10px;">
                                <div style="font-weight:700; font-size:0.85rem; margin-bottom:8px; color:var(--gray-800);">
                                    ${label} <span style="color:var(--gray-400); font-size:0.7rem; font-weight:400;">(${v.sku || ''})</span>
                                </div>
                                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px;">
                                    <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:8px;">
                                        <div style="font-size:0.68rem; font-weight:700; color:#15803d; text-transform:uppercase; margin-bottom:6px;"> INR</div>
                                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
                                            <div>
                                                <label style="font-size:0.65rem; color:var(--gray-500);">Price</label>
                                                <input type="number" id="editVarPrice_${i}" value="${v.price || 0}" style="width:100%;padding:5px;border:1px solid #86efac;border-radius:6px;font-size:0.82rem;font-weight:700;" min="0">
                                            </div>
                                            <div>
                                                <label style="font-size:0.65rem; color:var(--gray-500);">MRP</label>
                                                <input type="number" id="editVarMrp_${i}" value="${v.originalPrice || v.original_price || 0}" style="width:100%;padding:5px;border:1px solid #86efac;border-radius:6px;font-size:0.82rem;" min="0">
                                            </div>
                                        </div>
                                    </div>
                                    <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; padding:8px;">
                                        <div style="font-size:0.68rem; font-weight:700; color:#1d4ed8; text-transform:uppercase; margin-bottom:6px;"> USD</div>
                                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
                                            <div>
                                                <label style="font-size:0.65rem; color:var(--gray-500);">Price</label>
                                                <input type="number" id="editVarPriceUsd_${i}" value="${v.price_usd || 0}" step="0.01" style="width:100%;padding:5px;border:1px solid #93c5fd;border-radius:6px;font-size:0.82rem;font-weight:700;" min="0">
                                            </div>
                                            <div>
                                                <label style="font-size:0.65rem; color:var(--gray-500);">MRP</label>
                                                <input type="number" id="editVarMrpUsd_${i}" value="${v.original_price_usd || 0}" step="0.01" style="width:100%;padding:5px;border:1px solid #93c5fd;border-radius:6px;font-size:0.82rem;" min="0">
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(118px, 1fr)); gap:6px;">
                                    <div>
                                        <label style="font-size:0.65rem; color:var(--gray-500);">Access</label>
                                        <select id="editVarAccess_${i}" style="width:100%;padding:5px;border:1px solid var(--gray-200);border-radius:6px;font-size:0.75rem;">
                                            <option value="shared" ${(v.accessType || v.access_type || 'shared') === 'shared' ? 'selected' : ''}>Shared</option>
                                            <option value="personal" ${(v.accessType || v.access_type) === 'personal' ? 'selected' : ''}>Personal</option>
                                            <option value="family" ${(v.accessType || v.access_type) === 'family' ? 'selected' : ''}>Family</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style="font-size:0.65rem; color:var(--gray-500);">Months</label>
                                        <input type="number" id="editVarDuration_${i}" value="${v.duration_months || v.duration || 1}" style="width:100%;padding:5px;border:1px solid var(--gray-200);border-radius:6px;font-size:0.82rem;" min="1">
                                    </div>
                                    <div>
                                        <label style="font-size:0.65rem; color:var(--gray-500);">Duration Label</label>
                                        <input type="text" id="editVarDurationLabel_${i}" value="${escapeAttr(v.duration_label || v.durationLabel || '1 Month')}" style="width:100%;padding:5px;border:1px solid var(--gray-200);border-radius:6px;font-size:0.82rem;" placeholder="18 Months">
                                    </div>
                                    <div>
                                        <label style="font-size:0.65rem; color:var(--gray-500);">Stock</label>
                                        <input type="number" id="editVarStock_${i}" value="${v.stock || 0}" style="width:100%;padding:5px;border:1px solid var(--gray-200);border-radius:6px;font-size:0.82rem;" min="0">
                                    </div>
                                    <div>
                                        <label style="font-size:0.65rem; color:var(--gray-500);">Delivery</label>
                                        <select id="varDm_${i}" style="width:100%;padding:5px;border:1px solid var(--gray-200);border-radius:6px;font-size:0.75rem;">
                                            <option value="inherit" ${!vDm ? 'selected' : ''}> Inherit</option>
                                            <option value="automatic" ${vDm === 'automatic' ? 'selected' : ''}>Auto</option>
                                            <option value="manual" ${vDm === 'manual' ? 'selected' : ''}>Manual</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style="font-size:0.65rem; color:var(--gray-500);">Auth</label>
                                        <select id="varAt_${i}" style="width:100%;padding:5px;border:1px solid var(--gray-200);border-radius:6px;font-size:0.75rem;">
                                            <option value="inherit" ${!vAt ? 'selected' : ''}> Inherit</option>
                                            <option value="email_password" ${vAt === 'email_password' ? 'selected' : ''}>Email/Pass</option>
                                            <option value="phone_otp" ${vAt === 'phone_otp' ? 'selected' : ''}>Phone OTP</option>
                                            <option value="invite_link" ${vAt === 'invite_link' ? 'selected' : ''}>Invite Link</option>
                                            <option value="app_login" ${vAt === 'app_login' ? 'selected' : ''}>App Login</option>
                                        </select>
                                    </div>
                                </div>
                            </div>`;
                        }).join('')}
                    </div>
                    ` : ''}
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
        status.textContent = '[X] Please select an image file first';
        status.style.color = '#ef4444';
        return;
    }

    const file = fileInput.files[0];
    status.textContent = ' Uploading...';
    status.style.color = 'var(--accent)';

    const formData = new FormData();
    formData.append('file', file);

    const csrfMatch = document.cookie.match(new RegExp('(^| )admin_csrf_token=([^;]+)'));
    const headers = new Headers();
    if (csrfMatch) headers.append('X-CSRF-Token', csrfMatch[2]);

    try {
        const resp = await fetch(`${API_BASE}/admin/upload-image`, {
            method: 'POST',
            body: formData,
            credentials: 'include',
            headers: headers
        });

        const data = await resp.json();

        if (resp.ok && data.success) {
            // Save the URL to product overrides and update inputs
            AdminStore.updateProduct(productId, { img: data.url });
            document.getElementById('editProductImgPreview').src = data.url;
            const urlInput = document.getElementById('editProductImg');
            if (urlInput) urlInput.value = data.url;
            status.textContent = '[OK] Image uploaded successfully!';
            status.style.color = '#059669';
            showToast('Image uploaded! ');
        } else {
            status.textContent = `[X] Upload failed: ${data.detail || 'Unknown error'}`;
            status.style.color = '#ef4444';
            console.error('Upload response:', data);
        }
    } catch (err) {
        status.textContent = `[X] Network error: ${err.message}`;
        status.style.color = '#ef4444';
        console.error('Upload error:', err);
    }
}

async function saveProductEdit(id) {
    const desc = document.getElementById('editProductDesc')?.value || '';
    const stock = parseInt(document.getElementById('editProductStock')?.value) || 0;
    const featured = document.getElementById('editProductFeatured')?.value === 'true';
    const isActive = document.getElementById('editProductActive')?.value === 'true';
    const region_lock = document.getElementById('editRegionLock')?.value || 'all';
    const usage_type = document.getElementById('editUsageType')?.value || 'auto';
    const usage_note = document.getElementById('editUsageNote')?.value || '';
    const delivery_mode = document.getElementById('editDeliveryMode')?.value || 'automatic';
    const auth_type = document.getElementById('editAuthType')?.value || 'email_password';
    const account_type = document.getElementById('editAccountType')?.value || 'shared';

    const img = document.getElementById('editProductImg')?.value || '';

    // Collect per-variant settings (pricing + delivery)
    const product = PRODUCTS.find(p => String(p.id) === String(id) || String(p.slug) === String(id));
    const currentOverrides = AdminStore._getObj('getotts_admin_products', {});
    const currentMerged = product ? { ...product, ...(currentOverrides[id] || {}) } : {};
    const currentUsageMeta = adminGetUsageMeta(currentMerged);
    const usage_steps = Array.isArray(currentUsageMeta.usage_steps) ? currentUsageMeta.usage_steps : [];
    const currentFaqs = Array.isArray(currentMerged.faqs) ? currentMerged.faqs : [];
    let variantOverrides = [];
    const sourceVariants = (currentMerged && Array.isArray(currentMerged.variants)) ? currentMerged.variants : [];
    if (sourceVariants.length) {
        variantOverrides = sourceVariants.map((v, i) => {
            const accessEl = document.getElementById('editVarAccess_' + i);
            const dmEl = document.getElementById('varDm_' + i);
            const atEl = document.getElementById('varAt_' + i);
            const access = accessEl ? accessEl.value : (v.accessType || v.access_type || 'shared');
            const dm = dmEl ? dmEl.value : 'inherit';
            const at = atEl ? atEl.value : 'inherit';

            const priceEl = document.getElementById('editVarPrice_' + i);
            const mrpEl = document.getElementById('editVarMrp_' + i);
            const priceUsdEl = document.getElementById('editVarPriceUsd_' + i);
            const mrpUsdEl = document.getElementById('editVarMrpUsd_' + i);
            const stockEl = document.getElementById('editVarStock_' + i);
            const durationEl = document.getElementById('editVarDuration_' + i);
            const durationLabelEl = document.getElementById('editVarDurationLabel_' + i);
            const duration = Math.max(1, parseInt(durationEl ? durationEl.value : (v.duration_months || v.duration || 1), 10) || 1);
            const durationLabel = (durationLabelEl ? durationLabelEl.value.trim() : (v.duration_label || v.durationLabel || '')) || (duration === 1 ? '1 Month' : `${duration} Months`);

            return {
                sku: v.sku,
                accessType: access,
                access_type: access,
                quality: v.quality || '',
                duration: duration,
                duration_months: duration,
                durationLabel: durationLabel,
                duration_label: durationLabel,
                delivery_mode: dm === 'inherit' ? null : dm,
                auth_type: at === 'inherit' ? null : at,
                price: priceEl ? parseInt(priceEl.value) || 0 : v.price,
                originalPrice: mrpEl ? parseInt(mrpEl.value) || 0 : (v.originalPrice || v.original_price || 0),
                original_price: mrpEl ? parseInt(mrpEl.value) || 0 : (v.originalPrice || v.original_price || 0),
                price_usd: priceUsdEl ? parseFloat(priceUsdEl.value) || 0 : (v.price_usd || 0),
                original_price_usd: mrpUsdEl ? parseFloat(mrpUsdEl.value) || 0 : (v.original_price_usd || 0),
                stock: stockEl ? parseInt(stockEl.value) || 0 : (v.stock || 0),
            };
        });
    }

    const savedFeatures = currentMerged.features || { shared: [], personal: [] };
    const savedFaqs = adminMergeUsageFaqMeta(currentFaqs, usage_type, usage_steps, usage_note);
    const productPayload = {
        id: currentMerged.id || id,
        slug: currentMerged.slug || id,
        name: currentMerged.name || id,
        category: currentMerged.category || 'streaming',
        emoji: currentMerged.emoji || '',
        img,
        description: desc,
        stock: stock,
        isHot: featured,
        isActive: isActive,
        region_lock: region_lock,
        usage_type: usage_type,
        usage_steps: usage_steps,
        usage_note: usage_note,
        faqs: savedFaqs,
        delivery_mode: delivery_mode,
        auth_type: auth_type,
        account_type: account_type,
        features: savedFeatures,
        variants: variantOverrides,
        reviews: currentMerged.reviews || [],
        seo_keywords: currentMerged.seo_keywords || []
    };

    const btn = document.querySelector('#productEditModal .modal-footer .btn-primary');
    const oldLabel = btn ? btn.innerHTML : '';
    try {
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = 'Saving...';
        }
        showToast('Saving product to cloud...');
        const res = await adminFetch(`${API_BASE}/admin/catalog/product`, {
            method: 'POST',
            body: JSON.stringify({
                product: productPayload,
                original_id: currentMerged.id || id,
                support_ai_notes: currentMerged.support_ai_notes || ''
            }),
            timeoutMs: 30000
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
            data.status = res.status;
            throw new Error(extractApiError(null, data) || `Save failed (${res.status})`);
        }
        await refreshAdminCatalogFromCloud();
        AdminStore.updateProduct(id, {
            ...productPayload,
            _variantOverrides: variantOverrides
        });
    } catch (e) {
        console.error('[ProductQuickEdit] Backend save failed:', e);
        showToast('[X] Product save failed: ' + extractApiError(e, null));
        return;
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = oldLabel || '<i data-lucide="save"></i> Save Changes';
            if (window.lucide) lucide.createIcons();
        }
    }

    closeModal('productEditModal');
    loadProducts();
    showToast('Product updated in cloud [OK]');
}

/* ================================================
   CUSTOMERS
   ================================================ */
let adminCustomersCache = [];
let adminCustomersPage = 1;
let adminCustomersPerPage = 10;
const CUSTOMER_STATUS_OVERRIDES_KEY = 'getotts_admin_customer_status_overrides';

async function loadCustomers(options = {}) {
    const body = document.getElementById('customersBody');
    if (!body) return;
    if (shouldUseTabCache('customers', options) && body.children.length && !body.textContent.includes('Loading')) return;
    setTableLoading(body, 10, 'Loading customers...');
    const search = document.getElementById('customerSearch')?.value?.toLowerCase() || '';
    const orderFilter = document.getElementById('customerOrderFilter')?.value || 'all';
    const walletFilter = document.getElementById('customerWalletFilter')?.value || 'all';
    const joinedFilter = document.getElementById('customerJoinedFilter')?.value || 'all';
    const deviceFilter = document.getElementById('customerDeviceFilter')?.value || 'all';
    adminCustomersPerPage = Number(document.getElementById('customerRowsPerPage')?.value || 10);
    adminListState.customers.limit = adminCustomersPerPage;
    if (options.resetPage) adminListState.customers.offset = 0;

    // Try fetching from backend first
    let customers = [];
    let apiFetched = false;
    let apiTotal = 0;
    try {
        const page = getPageParams('customers', options);
        const params = new URLSearchParams({
            limit: String(page.limit),
            offset: String(page.offset),
            search
        });
        const resp = await adminFetch(`${API_BASE}/admin/customers?${params.toString()}`);
        if (resp.ok) {
            const data = await resp.json();
            customers = data.customers || [];
            apiFetched = true;
            apiTotal = Number(data.total ?? customers.length);
            setPageMeta('customers', data);
            markTabCache('customers');
        }
    } catch(e) { /* fallback to local */ }

    // Fallback to local store only when the API could not be reached.
    if (!apiFetched) {
        customers = AdminStore.getCustomers(search);
    }

    const statusOverrides = getCustomerStatusOverrides();
    customers = customers.map(c => {
        const status = statusOverrides[c.id];
        return status ? { ...c, status, is_blocked: status === 'blocked' } : c;
    });

    // Apply search filter
    if (search) {
        customers = customers.filter(c =>
            customerName(c).toLowerCase().includes(search) ||
            customerEmail(c).toLowerCase().includes(search) ||
            customerPhone(c).toLowerCase().includes(search) ||
            (c.id || '').toLowerCase().includes(search)
        );
    }

    customers = filterAdminCustomers(customers, { orderFilter, walletFilter, joinedFilter, deviceFilter });
    adminCustomersCache = customers;
    renderCustomerSummary(customers);

    if (!customers.length) {
        body.innerHTML = `<tr><td colspan="10" class="empty-state">No customers${search ? ' matching "' + search + '"' : ''} yet</td></tr>`;
        renderCustomerPagination(apiFetched ? apiTotal : 0, 1, 1, apiFetched);
        return;
    }

    function parseDevice(ua) {
        if (!ua) return 'No device';
        if (ua.includes('iPhone')) return 'iPhone';
        if (ua.includes('Android')) return 'Android';
        if (ua.includes('Windows')) return 'Windows';
        if (ua.includes('Mac')) return 'Mac';
        if (ua.includes('Linux')) return 'Linux';
        return 'Browser';
    }

    const totalForPagination = apiFetched ? apiTotal : customers.length;
    const totalPages = Math.max(1, Math.ceil(totalForPagination / adminCustomersPerPage));
    adminCustomersPage = Math.floor((adminListState.customers.offset || 0) / adminCustomersPerPage) + 1;
    adminCustomersPage = Math.min(Math.max(1, adminCustomersPage), totalPages);
    const start = apiFetched ? 0 : (adminCustomersPage - 1) * adminCustomersPerPage;
    const pageCustomers = apiFetched ? customers : customers.slice(start, start + adminCustomersPerPage);

    body.innerHTML = pageCustomers.map(c => {
        const orderCount = Number(c.order_count || c.total_orders || 0);
        const isBlocked = c.status === 'blocked' || c.is_blocked;
        const name = customerName(c);
        const email = customerEmail(c);
        const phone = customerPhone(c);
        return `
        <tr class="customer-row" onclick="viewCustomer('${c.id}')">
            <td><span class="customer-status ${isBlocked ? 'blocked' : 'active'}">${isBlocked ? 'Blocked' : 'Active'}</span></td>
            <td>
                <button class="customer-primary" onclick="event.stopPropagation(); viewCustomer('${c.id}')">
                    <strong>${escapeHtml(name || 'No name')}</strong>
                    <span>${escapeHtml(c.id || 'No customer ID')}</span>
                </button>
            </td>
            <td>
                <button class="customer-contact" onclick="event.stopPropagation(); viewCustomer('${c.id}')">
                    <span>${escapeHtml(email || 'No email')}</span>
                    <small>${escapeHtml(phone || 'No phone')}</small>
                </button>
            </td>
            <td><span class="soft-label">${parseDevice(c.device || c.user_agent || '')}</span></td>
            <td><span class="soft-label">${escapeHtml(c.timezone || c.country || c.city || 'No location')}</span></td>
            <td><button class="customer-count-link" onclick="event.stopPropagation(); openCustomerOrders('${c.id}')">${orderCount}</button></td>
            <td>${dualMoney(c.total_spent || 0, c.total_spent_usd || 0)}</td>
            <td>${dualMoney(c.wallet_balance || 0, c.wallet_balance_usd || 0)}</td>
            <td>${formatDate(c.created_at)}</td>
            <td class="action-cell">
                <div class="action-btn-group">
                    <button class="action-btn blue" onclick="event.stopPropagation(); viewCustomer('${c.id}')" title="View"><i data-lucide="eye"></i></button>
                    <button class="action-btn" onclick="event.stopPropagation(); editCustomer('${c.id}')" title="Edit"><i data-lucide="edit-3"></i></button>
                    <button class="action-btn green" onclick="event.stopPropagation(); openCustomerWhatsApp('${c.id}')" title="WhatsApp"><i data-lucide="message-circle"></i></button>
                    <button class="action-btn green" onclick="event.stopPropagation(); addWalletForCustomer('${c.id}')" title="Add Wallet"><i data-lucide="wallet"></i></button>
                    <button class="action-btn blue" onclick="event.stopPropagation(); openCustomerOrders('${c.id}')" title="Orders"><i data-lucide="package"></i></button>
                    <button class="action-btn red" onclick="event.stopPropagation(); toggleCustomerBlock('${c.id}')" title="${isBlocked ? 'Unblock' : 'Block'}"><i data-lucide="${isBlocked ? 'unlock' : 'ban'}"></i></button>
                </div>
            </td>
        </tr>
    `}).join('');
    renderCustomerPagination(totalForPagination, adminCustomersPage, totalPages, apiFetched);
    if (window.lucide) lucide.createIcons();
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function isPlaceholderCustomerEmail(email) {
    const value = String(email || '').trim().toLowerCase();
    return /^wa_[^@\s]+@getotts\.com$/.test(value) ||
        /^customer_[^@\s]+@getotts\.com$/.test(value) ||
        /^tg_[^@\s]+@getotts\.com$/.test(value);
}

function isTestCustomerRecord(c) {
    const email = String(c?.email || '').trim().toLowerCase();
    const name = String(c?.name || '').trim().toLowerCase();
    const phone = String(c?.phone || '').trim().toLowerCase().replace(/[\s()-]/g, '');
    const id = String(c?.id || '').trim().toLowerCase();
    const local = email.split('@')[0] || '';
    const testEmail =
        email.endsWith('@example.com') ||
        email.endsWith('@example.org') ||
        email.endsWith('@example.net') ||
        local.startsWith('test') ||
        local.includes('test');
    const testPhone =
        phone === '0000000000' ||
        phone === '9999999999' ||
        phone === '+9999999999' ||
        phone === '+1234567890' ||
        phone === '1234567890';
    return testEmail || name === 'test' || name.startsWith('test ') || testPhone || id.startsWith('test');
}

function customerPhoneFromPlaceholder(email) {
    const value = String(email || '').trim();
    if (!isPlaceholderCustomerEmail(value)) return '';
    const local = value.split('@')[0].replace(/^(wa_|tg_)/, '');
    return local && local !== 'number' && !local.startsWith('customer_') ? local : '';
}

function customerEmail(c) {
    return isPlaceholderCustomerEmail(c?.email) ? '' : String(c?.email || '').trim();
}

function customerPhone(c) {
    return String(c?.phone || '').trim() || customerPhoneFromPlaceholder(c?.email);
}

function customerName(c) {
    return String(c?.name || '').trim();
}

function customerSearchToken(c) {
    return customerEmail(c) || customerPhone(c) || c?.id || '';
}

function getCustomerStatusOverrides() {
    try {
        return JSON.parse(localStorage.getItem(CUSTOMER_STATUS_OVERRIDES_KEY) || '{}');
    } catch {
        return {};
    }
}

function setCustomerStatusOverride(id, status) {
    const overrides = getCustomerStatusOverrides();
    if (status) overrides[id] = status;
    else delete overrides[id];
    localStorage.setItem(CUSTOMER_STATUS_OVERRIDES_KEY, JSON.stringify(overrides));
}

function filterAdminCustomers(customers, filters) {
    const now = Date.now();
    return customers.filter(c => {
        const orders = Number(c.order_count || c.total_orders || 0);
        const walletInr = Number(c.wallet_balance || 0);
        const walletUsd = Number(c.wallet_balance_usd || 0);
        const hasDevice = Boolean(c.device || c.user_agent);
        const joined = c.created_at ? new Date(c.created_at).getTime() : 0;

        if (filters.orderFilter === 'with' && orders <= 0) return false;
        if (filters.orderFilter === 'without' && orders > 0) return false;
        if (filters.walletFilter === 'positive' && walletInr <= 0 && walletUsd <= 0) return false;
        if (filters.walletFilter === 'empty' && (walletInr > 0 || walletUsd > 0)) return false;
        if (filters.deviceFilter === 'available' && !hasDevice) return false;
        if (filters.deviceFilter === 'missing' && hasDevice) return false;
        if (filters.joinedFilter !== 'all') {
            const days = Number(filters.joinedFilter);
            if (!joined || now - joined > days * 86400000) return false;
        }
        return true;
    });
}

function renderCustomerSummary(customers) {
    const box = document.getElementById('customerSummaryCards');
    if (!box) return;
    const today = new Date().toDateString();
    const newToday = customers.filter(c => c.created_at && new Date(c.created_at).toDateString() === today).length;
    const withOrders = customers.filter(c => Number(c.order_count || c.total_orders || 0) > 0).length;
    const walletInr = customers.reduce((sum, c) => sum + Number(c.wallet_balance || 0), 0);
    const walletUsd = customers.reduce((sum, c) => sum + Number(c.wallet_balance_usd || 0), 0);
    box.innerHTML = [
        ['Total Customers', customers.length],
        ['New Today', newToday],
        ['Customers With Orders', withOrders],
        ['Total Wallet Balance', dualMoney(walletInr, walletUsd)]
    ].map(([label, value]) => `
        <div class="customer-summary-card">
            <span>${label}</span>
            <div class="customer-summary-value">${value}</div>
        </div>
    `).join('');
}

function renderCustomerPagination(total, page, totalPages, apiPaged = false) {
    const el = document.getElementById('customerPagination');
    if (!el) return;
    const start = total ? (page - 1) * adminCustomersPerPage + 1 : 0;
    const end = Math.min(page * adminCustomersPerPage, total);
    el.innerHTML = `
        <div class="pagination-info">Showing ${start}-${end} of ${total} customers</div>
        <div class="pagination-actions">
            <button class="btn btn-outline" onclick="changeCustomersPage(${page - 1})" ${page <= 1 ? 'disabled' : ''}>Previous</button>
            <span class="page-pill">Page ${page} / ${totalPages}</span>
            <button class="btn btn-outline" onclick="changeCustomersPage(${page + 1})" ${page >= totalPages ? 'disabled' : ''}>Next</button>
        </div>
    `;
}

window.changeCustomersPage = function(page) {
    const totalPages = Math.max(1, Math.ceil((adminListState.customers.total || adminCustomersCache.length) / adminCustomersPerPage));
    adminCustomersPage = Math.min(Math.max(1, Number(page) || 1), totalPages);
    adminListState.customers.offset = (adminCustomersPage - 1) * adminCustomersPerPage;
    loadCustomers({ force: true });
};

window.resetCustomerPagination = function() {
    adminCustomersPage = 1;
    adminListState.customers.offset = 0;
    loadCustomers({ force: true, resetPage: true });
};

function getAdminCustomer(id) {
    return adminCustomersCache.find(c => String(c.id) === String(id)) || null;
}

window.viewCustomer = function(id) {
    const c = getAdminCustomer(id);
    if (!c) return showToast('Customer not found');
    const name = customerName(c);
    const email = customerEmail(c);
    const phone = customerPhone(c);
    const products = (c.purchased_products || []).slice(0, 6).map(p => `<li>${escapeHtml(p.product_name || 'Subscription')} <span>${p.expires_at ? formatDate(p.expires_at) : 'No expiry'}</span></li>`).join('');
    document.getElementById('genericModalTitle').textContent = name || email || phone || 'Customer';
    document.getElementById('genericModalBody').innerHTML = `
        <div class="customer-profile-modal">
            <div><span>Name</span><strong>${escapeHtml(name || 'No name')}</strong></div>
            <div><span>Email</span><strong>${escapeHtml(email || 'No email')}</strong></div>
            <div><span>Phone</span><strong>${escapeHtml(phone || 'No phone')}</strong></div>
            <div><span>Wallet</span><strong>${dualMoney(c.wallet_balance || 0, c.wallet_balance_usd || 0)}</strong></div>
            <div><span>Orders</span><strong>${c.order_count || 0}</strong></div>
            <div><span>Joined At</span><strong>${formatDate(c.created_at)}</strong></div>
            <div class="full"><span>Subscriptions</span><ul>${products || '<li>No active purchase history loaded</li>'}</ul></div>
        </div>
    `;
    document.getElementById('genericModalFooter').innerHTML = `
        <button class="btn btn-outline" onclick="editCustomer('${id}')">Edit</button>
        <button class="btn btn-outline" onclick="openCustomerWhatsApp('${id}')">WhatsApp</button>
        <button class="btn btn-outline" onclick="addWalletForCustomer('${id}')">Add Wallet</button>
        <button class="btn btn-outline" onclick="openCustomerOrders('${id}')">Orders</button>
        <button class="btn btn-primary" onclick="closeModal('genericModal')">Done</button>
    `;
    openModal('genericModal');
};

window.editCustomer = function(id) {
    const c = getAdminCustomer(id);
    if (!c) return showToast('Customer not found');
    document.getElementById('genericModalTitle').textContent = 'Edit Customer';
    document.getElementById('genericModalBody').innerHTML = `
        <div class="customer-edit-form">
            <label>Name<input id="customerEditName" type="text" value="${escapeHtml(customerName(c))}" placeholder="No name"></label>
            <label>Email<input id="customerEditEmail" type="email" value="${escapeHtml(customerEmail(c))}" placeholder="No email"></label>
            <label>Phone<input id="customerEditPhone" type="text" value="${escapeHtml(customerPhone(c))}" placeholder="No phone"></label>
            <p class="customer-form-hint">WhatsApp placeholder emails are hidden here and will not be saved back.</p>
        </div>
    `;
    document.getElementById('genericModalFooter').innerHTML = `
        <button class="btn btn-outline" onclick="viewCustomer('${id}')">Cancel</button>
        <button class="btn btn-primary" onclick="saveCustomerEdit('${id}')">Save Changes</button>
    `;
    openModal('genericModal');
};

window.saveCustomerEdit = async function(id) {
    const c = getAdminCustomer(id);
    if (!c) return showToast('Customer not found');
    const name = document.getElementById('customerEditName')?.value.trim() || '';
    const email = document.getElementById('customerEditEmail')?.value.trim() || '';
    const phone = document.getElementById('customerEditPhone')?.value.trim() || '';
    const updates = { name, phone };
    if (email) updates.email = email;

    try {
        const res = await adminFetch(`${API_BASE}/admin/customers/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(updates)
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.success === false) {
            showToast('[X] ' + (extractApiError(null, data) || 'Could not update customer'));
            return;
        }
        Object.assign(c, data.customer || updates);
        showToast('Customer updated');
        closeModal('genericModal');
        loadCustomers();
    } catch (e) {
        showToast('[X] Customer update failed');
    }
};

window.toggleCustomerBlock = async function(id) {
    const c = getAdminCustomer(id);
    if (!c) return showToast('Customer not found');
    const isBlocked = c.status === 'blocked' || c.is_blocked;
    const nextStatus = isBlocked ? 'active' : 'blocked';
    if (!confirm(`${isBlocked ? 'Unblock' : 'Block'} this customer?`)) return;
    try {
        const res = await adminFetch(`${API_BASE}/admin/customers/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ status: nextStatus, is_blocked: nextStatus === 'blocked' })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.success === false) {
            showToast('[X] ' + (extractApiError(null, data) || 'Could not update customer status'));
            return;
        }
        setCustomerStatusOverride(id, nextStatus);
        Object.assign(c, data.customer || { status: nextStatus, is_blocked: nextStatus === 'blocked' });
        showToast(nextStatus === 'blocked' ? 'Customer blocked' : 'Customer unblocked');
        loadCustomers();
    } catch (e) {
        showToast('[X] Customer status update failed');
    }
};

window.addWalletForCustomer = function(id) {
    const c = getAdminCustomer(id);
    switchTab('vouchers');
    setTimeout(() => {
        const input = document.getElementById('adjCustomer');
        if (input) input.value = c?.id || id;
        const amount = document.getElementById('adjAmount');
        if (amount) amount.focus();
        const reason = document.getElementById('adjReason');
        if (reason && !reason.value) reason.value = `Admin adjustment for ${customerName(c) || customerEmail(c) || customerPhone(c) || id}`;
    }, 100);
};

window.openCustomerOrders = function(id) {
    const c = getAdminCustomer(id);
    switchTab('orders');
    setTimeout(() => {
        const search = document.getElementById('orderSearch');
        if (search) {
            search.value = customerSearchToken(c);
            loadOrders();
        }
    }, 100);
};

window.openCustomerWhatsApp = async function(id) {
    const c = getAdminCustomer(id);
    closeModal('genericModal');
    switchTab('whatsapp');
    await loadWaMarketingCustomers();
    setTimeout(() => {
        const select = document.getElementById('waDirectCustomer');
        const phone = document.getElementById('waDirectPhone');
        const message = document.getElementById('waDirectMessage');
        const template = document.getElementById('waDirectTemplate');
        if (select) select.value = id;
        if (phone) phone.value = cleanWaPhone(customerPhone(c));
        if (template && !template.value) template.value = 'custom';
        if (message && !message.value.trim()) {
            const name = customerName(c) || 'there';
            message.value = `Just checking in, ${name}. Reply here if you need help with your order, login, delivery, renewal, or payment.`;
        }
        message?.focus();
    }, 150);
};

let adminBlogsCache = [];

async function loadBlogs(options = {}) {
    const body = document.getElementById('blogBody');
    if (!body) return;
    if (shouldUseTabCache('blogs', options) && body.children.length && !body.textContent.includes('Loading')) return;
    setTableLoading(body, 6, 'Loading blog posts...');

    try {
        const search = document.getElementById('blogSearch')?.value || '';
        const page = getPageParams('blogs', options);
        const params = new URLSearchParams({
            limit: String(page.limit),
            offset: String(page.offset),
            search
        });
        const res = await adminFetch(`${API_BASE}/blogs/admin/list?${params.toString()}`);
        const data = await res.json().catch(() => ({}));
        const blogs = data.blogs || [];
        adminBlogsCache = blogs;
        setPageMeta('blogs', data);
        markTabCache('blogs');

        if (!blogs.length) {
            body.innerHTML = '<tr><td colspan="6" class="empty-state">No blog posts yet</td></tr>';
            renderAdminPagination('blogPagination', 'blogs', 'loadBlogs');
            return;
        }

        body.innerHTML = blogs.map(b => `
            <tr>
                <td><strong>${b.title}</strong></td>
                <td><span class="admin-chip admin-chip-muted">${b.category || 'Uncategorized'}</span></td>
                <td><span class="admin-chip ${b.is_published ? 'admin-chip-success' : 'admin-chip-warning'}">${b.is_published ? 'Published' : 'Draft'}</span></td>
                <td>${b.views || 0}</td>
                <td>${formatDate(b.created_at)}</td>
                <td class="action-cell">
                    <button class="action-btn blue" onclick="editBlog('${b.id}')"><i data-lucide="edit-3"></i></button>
                    <button class="action-btn red" onclick="deleteBlog('${b.id}')"><i data-lucide="trash-2"></i></button>
                </td>
            </tr>
        `).join('');
        if (window.lucide) lucide.createIcons();
        renderAdminPagination('blogPagination', 'blogs', 'loadBlogs');
    } catch (e) {
        setTableError(body, 6, 'Error loading blogs');
    }
}

window.showBlogModal = async function(id = null) {
    const editIdEl = document.getElementById('blogEditId');
    const titleEl = document.getElementById('blogModalTitle');

    if (editIdEl) editIdEl.value = id || '';
    if (titleEl) titleEl.textContent = id ? 'Edit Blog Post' : 'Create Blog Post';

    const setValue = (fieldId, value) => {
        const el = document.getElementById(fieldId);
        if (el) el.value = value || '';
    };

    if (id) {
        try {
            let blog = adminBlogsCache.find(b => String(b.id) === String(id));
            if (!blog) {
                const page = getPageParams('blogs');
                const params = new URLSearchParams({
                    limit: String(page.limit),
                    offset: String(page.offset),
                    search: document.getElementById('blogSearch')?.value || ''
                });
                const res = await adminFetch(`${API_BASE}/blogs/admin/list?${params.toString()}`);
                const data = await res.json().catch(() => ({}));
                blog = (data.blogs || []).find(b => String(b.id) === String(id));
            }
            if (blog) {
                setValue('blogTitle', blog.title);
                setValue('blogSlug', blog.slug);
                setValue('blogCategory', blog.category || 'Streaming');
                setValue('blogPublished', String(blog.is_published !== false));
                setValue('blogImage', blog.image_url);
                setValue('blogContent', blog.content);
            }
        } catch (err) {
            console.error('[Blogs] Edit load failed:', err);
            showToast('[X] Failed to load blog post');
        }
    } else {
        setValue('blogTitle', '');
        setValue('blogSlug', '');
        setValue('blogCategory', 'Streaming');
        setValue('blogPublished', 'true');
        setValue('blogImage', '');
        setValue('blogContent', '');
    }

    openModal('blogModal');
    if (window.lucide) lucide.createIcons();
};

window.editBlog = function(id) {
    showBlogModal(id);
};

window.saveBlog = async function() {
    const id = document.getElementById('blogEditId')?.value || '';
    const title = document.getElementById('blogTitle')?.value.trim() || '';
    const content = document.getElementById('blogContent')?.value.trim() || '';
    const slug = (document.getElementById('blogSlug')?.value.trim() || title.toLowerCase())
        .replace(/\s+/g, '-')
        .replace(/[^\w-]+/g, '')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

    if (!title || !content) {
        showToast('[X] Title and content are required');
        return;
    }

    const payload = {
        title,
        slug,
        content,
        excerpt: content.replace(/<[^>]+>/g, '').slice(0, 180),
        image_url: document.getElementById('blogImage')?.value.trim() || null,
        is_published: document.getElementById('blogPublished')?.value === 'true',
        meta_title: title,
        meta_description: content.replace(/<[^>]+>/g, '').slice(0, 155)
    };

    try {
        const res = await adminFetch(id ? `${API_BASE}/blogs/admin/${id}` : `${API_BASE}/blogs/admin/create`, {
            method: id ? 'PUT' : 'POST',
            body: JSON.stringify(payload)
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.success === false) {
            throw new Error(extractApiError(null, data));
        }
        showToast(id ? 'Post updated' : 'Post created');
        closeModal('blogModal');
        clearTabCache('blogs');
        loadBlogs({ force: true });
    } catch (err) {
        console.error('[Blogs] Save failed:', err);
        showToast('[X] ' + extractApiError(err, null));
    }
};

window.deleteBlog = async function(id) {
    if (!confirm('Delete this post?')) return;
    try {
        const res = await adminFetch(`${API_BASE}/blogs/admin/${id}`, { method: 'DELETE' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.success === false) {
            throw new Error(extractApiError(null, data));
        }
        showToast('Post deleted');
        clearTabCache('blogs');
        loadBlogs({ force: true });
    } catch (err) {
        console.error('[Blogs] Delete failed:', err);
        showToast('[X] ' + extractApiError(err, null));
    }
};

async function restartWaMonitor() {
    if (!confirm('Restart the WhatsApp Monitor service? This will disconnect current session.')) return;
    try {
        const res = await waMonitorFetch('/restart', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            showToast('[OK] Monitor service restarting...');
            setTimeout(() => refreshWaHub(), 3000);
        } else {
            showToast('[X] Failed to restart: ' + data.error);
        }
    } catch (e) {
        showToast('[X] Network error restarting service');
    }
}
window.restartWaMonitor = restartWaMonitor;

/* ================================================
   COUPONS
   ================================================ */
async function loadCoupons(options = {}) {
    const body = document.getElementById('couponsBody');
    if (!body) return;
    if (shouldUseTabCache('coupons', options) && body.children.length && !body.textContent.includes('Loading')) return;
    setTableLoading(body, 7, 'Loading coupons...');

    try {
        const page = getPageParams('coupons', options);
        const search = document.getElementById('couponSearch')?.value || '';
        const params = new URLSearchParams({
            limit: String(page.limit),
            offset: String(page.offset),
            search
        });
        const res = await adminFetch(`${API_BASE}/admin/coupons?${params.toString()}`);
        const data = await res.json();

        const coupons = data.coupons || [];
        _cachedCoupons = coupons;
        setPageMeta('coupons', data);
        markTabCache('coupons');
        if (!coupons.length) {
            body.innerHTML = `<tr><td colspan="7" class="empty-state">${search ? 'No coupons match your search' : 'No coupons yet. Create one!'}</td></tr>`;
            renderAdminPagination('couponsPagination', 'coupons', 'loadCoupons');
            return;
        }
        body.innerHTML = coupons.map(c => {
            const fixedAmount = c.discount_amount ?? (String(c.discount_type || '').toLowerCase() === 'fixed' ? c.discount_value : null);
            const percentAmount = c.discount_percent ?? (String(c.discount_type || '').toLowerCase() !== 'fixed' ? c.discount_value : null);
            const minOrder = c.min_order ?? c.min_order_amount ?? 0;
            const currency = couponCurrency(c);
            const discountText = fixedAmount
                ? (currency === 'BOTH' ? `${singleCurrencyMoney(fixedAmount, 'INR')} base` : singleCurrencyMoney(fixedAmount, currency))
                : `${percentAmount || 0}%`;
            return `
            <tr>
                <td><code style="font-weight:700;color:var(--green-600)">${c.code}</code></td>
                <td><span class="money-dual"><strong>${discountText}</strong><small>${currency}</small></span></td>
                <td>${currency === 'BOTH' ? `${singleCurrencyMoney(minOrder, 'INR')} base` : singleCurrencyMoney(minOrder, currency)}</td>
                <td>${c.max_uses || ''}</td>
                <td>${c.used_count || 0}</td>
                <td>
                    <button class="action-btn ${c.is_active ? 'green' : 'red'}" onclick="toggleCoupon('${c.id}')" title="Toggle Active">
                        <i data-lucide="${c.is_active ? 'toggle-right' : 'toggle-left'}"></i>
                    </button>
                </td>
                <td class="action-cell">
                    <a class="action-btn" href="/adminno881/coupons/${encodeURIComponent(c.id)}/edit" onclick="if(window.editCoupon){event.preventDefault(); window.editCoupon('${c.id}'); return false;}" title="Edit">
                        <i data-lucide="edit"></i>
                    </a>
                    <button class="action-btn red" onclick="deleteCoupon('${c.id}')" title="Delete">
                        <i data-lucide="trash-2"></i>
                    </button>
                </td>
            </tr>`;
        }).join('');
        if (window.lucide) lucide.createIcons();
        renderAdminPagination('couponsPagination', 'coupons', 'loadCoupons');
    } catch (err) {
        console.error('Failed to load coupons:', err);
        body.innerHTML = '<tr><td colspan="7" class="empty-state">Failed to load coupons</td></tr>';
        renderAdminPagination('couponsPagination', 'coupons', 'loadCoupons');
    }
}

// Cache coupons for edit modal
let _cachedCoupons = [];
function _getCachedCoupon(id) { return _cachedCoupons.find(c => c.id === id); }

window.showCouponModal = async function(editId = null) {
    ensureCouponModalExists();
    const editIdEl = document.getElementById('couponEditId');
    const titleEl = document.getElementById('couponModalTitle');

    if (editIdEl) editIdEl.value = editId || '';
    if (titleEl) titleEl.textContent = editId ? 'Edit Coupon' : 'Create Coupon';

    if (editId) {
        try {
            if (!_getCachedCoupon(editId)) {
                const res = await adminFetch(`${API_BASE}/admin/coupons?limit=500&offset=0`);
                const data = await res.json();
                _cachedCoupons = data.coupons || [];
            }
            const c = _getCachedCoupon(editId);
            if (c) {
                const fixedAmount = c.discount_amount ?? (String(c.discount_type || '').toLowerCase() === 'fixed' ? c.discount_value : '');
                const percentAmount = c.discount_percent ?? (String(c.discount_type || '').toLowerCase() !== 'fixed' ? c.discount_value : '');
                document.getElementById('couponCode').value = c.code;
                document.getElementById('couponPercent').value = percentAmount || '';
                document.getElementById('couponAmount').value = fixedAmount || '';
                document.getElementById('couponMinOrder').value = c.min_order ?? c.min_order_amount ?? 0;
                document.getElementById('couponMaxUses').value = c.max_uses || '';
                const currencyEl = document.getElementById('couponCurrency');
                if (currencyEl) currencyEl.value = couponCurrency(c);
                document.getElementById('couponType').value = fixedAmount ? 'fixed' : 'percent';
            }
            toggleCouponFields();
            forceOpenAdminModal('couponModal');
        } catch (e) {
            console.error(e);
            showToast('[X] Could not open coupon editor: ' + extractApiError(e, null));
        }
    } else {
        document.getElementById('couponCode').value = '';
        document.getElementById('couponPercent').value = '';
        document.getElementById('couponAmount').value = '';
        document.getElementById('couponMinOrder').value = '0';
        document.getElementById('couponMaxUses').value = '1000';
        document.getElementById('couponExpiry').value = '';
        const currencyEl = document.getElementById('couponCurrency');
        if (currencyEl) currencyEl.value = 'INR';
        document.getElementById('couponType').value = 'percent';
        toggleCouponFields();
        forceOpenAdminModal('couponModal');
    }
}

window.toggleCouponFields = function() {
    const type = document.getElementById('couponType').value;
    const pField = document.getElementById('couponPercentField');
    const aField = document.getElementById('couponAmountField');
    if (pField) pField.style.display = type === 'percent' ? 'block' : 'none';
    if (aField) aField.style.display = type === 'fixed' ? 'block' : 'none';
};

window.saveCoupon = async function() {
    const editId = document.getElementById('couponEditId').value;
    const code = document.getElementById('couponCode').value.trim().toUpperCase();
    const type = document.getElementById('couponType').value;
    const percent = parseInt(document.getElementById('couponPercent').value) || 0;
    const amount = parseFloat(document.getElementById('couponAmount').value) || 0;
    const minOrder = parseFloat(document.getElementById('couponMinOrder').value) || 0;
    const maxUses = parseInt(document.getElementById('couponMaxUses').value) || 1000;
    const currencyValue = document.getElementById('couponCurrency')?.value;
    const currency = ['INR', 'USD', 'BOTH'].includes(currencyValue) ? currencyValue : 'INR';

    if (!code) { showToast('[X] Enter a coupon code'); return; }

    const payload = {
        code,
        discount_type: type,
        discount_value: type === 'percent' ? percent : amount,
        discount_percent: type === 'percent' ? percent : null,
        discount_amount: type === 'fixed' ? amount : null,
        min_order_amount: minOrder,
        min_order: minOrder,
        max_uses: maxUses,
        currency,
        expires_at: document.getElementById('couponExpiry')?.value || null
    };

    if (type === 'percent' && (percent <= 0 || percent > 100)) {
        showToast('[X] Enter a percentage between 1 and 100');
        return;
    }
    if (type === 'fixed' && amount <= 0) {
        showToast('[X] Enter a fixed discount amount');
        return;
    }

    const url = editId
        ? `${API_BASE}/admin/coupons/${editId}`
        : `${API_BASE}/admin/coupons`;
    const method = editId ? 'PUT' : 'POST';
    const saveBtn = document.querySelector('#couponModal .modal-footer .btn-primary');
    const oldLabel = saveBtn ? saveBtn.innerHTML : '';

    try {
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = 'Saving...';
        }
        const res = await adminFetch(url, {
            method,
            body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));

        if (res.ok && data.success) {
            closeModal('couponModal');
            clearTabCache('coupons');
            const verifyRes = await adminFetch(`${API_BASE}/admin/coupons?limit=500&offset=0&search=${encodeURIComponent(code)}`, {
                cache: 'no-store',
                timeoutMs: 10000
            });
            const verifyData = await verifyRes.json().catch(() => ({}));
            if (!verifyRes.ok || !verifyData.success || !(verifyData.coupons || []).some(c => c.code === code)) {
                verifyData.status = verifyRes.status;
                throw new Error(extractApiError(null, verifyData) || 'Coupon saved but reload did not confirm it');
            }
            await loadCoupons({ force: true });
            showToast(editId ? 'Coupon updated and verified' : 'Coupon created and verified');
        } else {
            data.status = res.status;
            showToast('[X] ' + (extractApiError(null, data) || 'Failed to save'));
        }
    } catch (err) {
        showToast('[X] Coupon save failed: ' + extractApiError(err, null));
        console.error(err);
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = oldLabel || '<i data-lucide="save"></i> Save Coupon';
            if (window.lucide) lucide.createIcons();
        }
    }
};

window.editCoupon = function(id) { showCouponModal(id); }

window.toggleCoupon = async function(id) {
    try {
        let c = _getCachedCoupon(id);
        if (!c) {
            const res = await adminFetch(`${API_BASE}/admin/coupons?limit=500&offset=0`);
            const data = await res.json();
            _cachedCoupons = data.coupons || [];
            c = _getCachedCoupon(id);
        }
        if (!c) return;

        await adminFetch(`${API_BASE}/admin/coupons/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ is_active: !c.is_active }),
        });
        clearTabCache('coupons');
        loadCoupons({ force: true });
        showToast('Coupon toggled');
    } catch (e) { console.error(e); }
}

window.deleteCoupon = async function(id) {
    if (!confirm('Delete this coupon?')) return;
    try {
        const res = await adminFetch(`${API_BASE}/admin/coupons/${id}`, { method: 'DELETE' });
        if (res.ok) {
            showToast('Coupon deleted');
            clearTabCache('coupons');
            loadCoupons({ force: true });
        } else {
            showToast('[X] Failed to delete coupon');
        }
    } catch (e) { console.error(e); showToast('[X] Error deleting coupon'); }
}

/* ================================================
   ADD INVENTORY
   ================================================ */
let inventoryAddMode = 'single';

function syncBulkInventoryControls() {
    const addPlatform = document.getElementById('addPlatform');
    const bulkPlatform = document.getElementById('bulkPlatform');
    const addPlan = document.getElementById('addPlan');
    const bulkPlan = document.getElementById('bulkPlan');
    const addExpiry = document.getElementById('addExpiry');
    const bulkExpiry = document.getElementById('bulkExpiry');

    if (addPlatform && bulkPlatform) bulkPlatform.value = addPlatform.value;
    if (addPlan && bulkPlan) bulkPlan.value = addPlan.value;
    if (addExpiry && bulkExpiry) bulkExpiry.value = addExpiry.value;
}

function ensureInventoryProfileField(container) {
    if (!container || document.getElementById('addProfile')) return;

    const profileField = document.createElement('div');
    profileField.className = 'ck-field';
    profileField.innerHTML = `
        <label for="addProfile">Profile / Slot <span style="font-weight:500;color:#94a3b8">(optional)</span></label>
        <input type="text" id="addProfile" placeholder="e.g. Profile 2, Kids, PIN 1234">
    `;
    container.appendChild(profileField);
}

function ensureInventoryDeliveryTypeField(container) {
    if (!container || document.getElementById('inventoryDeliveryType')) return;
    const typeField = document.createElement('div');
    typeField.className = 'ck-field inventory-delivery-type-field';
    typeField.innerHTML = `
        <label for="inventoryDeliveryType">Delivery Data Type</label>
        <select id="inventoryDeliveryType">
            <option value="credentials">Email / ID + password</option>
            <option value="link">Activation / invite link</option>
        </select>
    `;
    container.appendChild(typeField);
}

function ensureInventoryLinkField(singleForm) {
    if (!singleForm || document.getElementById('addLink')) return;
    const linkField = document.createElement('div');
    linkField.className = 'ck-field inventory-link-field';
    linkField.innerHTML = `
        <label for="addLink">Activation / Invite Link</label>
        <input type="url" id="addLink" placeholder="https://...">
    `;
    const addBtn = document.getElementById('addInvBtn');
    if (addBtn) singleForm.insertBefore(linkField, addBtn);
    else singleForm.appendChild(linkField);
}

function getSelectedInventoryProduct() {
    const platformId = document.getElementById('addPlatform')?.value || '';
    if (!platformId || typeof AdminStore === 'undefined') return null;
    return (AdminStore.getProducts() || []).find(p =>
        String(p.id) === String(platformId) ||
        String(p.slug) === String(platformId) ||
        String(p.platform_id) === String(platformId)
    ) || null;
}

function productWantsLinkInventory(product) {
    if (!product) return false;
    const usage = adminGetUsageMeta(product);
    const haystack = [
        product.id, product.slug, product.name, product.auth_type,
        usage.usage_type, usage.usage_note, product.description
    ].filter(Boolean).join(' ').toLowerCase();
    return (
        haystack.includes('gemini') ||
        haystack.includes('invite_link') ||
        haystack.includes('shared_link') ||
        haystack.includes('activation') ||
        haystack.includes('claim') ||
        haystack.includes(' link')
    );
}

function getInventoryDeliveryType() {
    return document.getElementById('inventoryDeliveryType')?.value === 'link' ? 'link' : 'credentials';
}

function syncInventoryInputMode() {
    const type = getInventoryDeliveryType();
    const linkMode = type === 'link';
    const emailField = document.getElementById('addEmail')?.closest('.ck-field');
    const passwordField = document.getElementById('addPassword')?.closest('.ck-field');
    const linkField = document.getElementById('addLink')?.closest('.ck-field');
    const bulkHelp = document.getElementById('bulkFormatHelp');
    const bulkTextarea = document.getElementById('bulkAccounts');
    const bulkLabel = document.getElementById('bulkAccountsLabel');
    const addBtn = document.getElementById('addInvBtn');

    if (emailField) emailField.style.display = linkMode ? 'none' : '';
    if (passwordField) passwordField.style.display = linkMode ? 'none' : '';
    if (linkField) linkField.style.display = linkMode ? '' : 'none';
    if (bulkHelp) {
        bulkHelp.innerHTML = linkMode
            ? `<strong>Format:</strong> One activation/invite link per line. <br><span style="font-size:0.75rem">Optional: add <code>| Profile 1</code> after a link if needed.</span>`
            : `<strong>Format:</strong> One account per line: <code>email:password</code>. <br><span style="font-size:0.75rem">Optional: add <code>| Profile 1</code> after credentials.</span>`;
    }
    if (bulkLabel) bulkLabel.textContent = linkMode ? 'Paste Activation Links' : 'Paste Credentials List';
    if (bulkTextarea) {
        bulkTextarea.placeholder = linkMode
            ? 'https://gemini.google.com/offer/claim-example\nhttps://gemini.google.com/offer/claim-example-2 | Personal'
            : 'user1@example.com:pass123\nuser2@example.com:pass456 | Profile 2';
    }
    if (addBtn) {
        addBtn.innerHTML = linkMode
            ? '<i data-lucide="link"></i> Confirm & Add Link'
            : '<i data-lucide="plus"></i> Confirm & Add Account';
    }
    if (window.lucide) lucide.createIcons();
}

function autoSelectInventoryDeliveryType() {
    const typeSelect = document.getElementById('inventoryDeliveryType');
    if (!typeSelect) return;
    typeSelect.value = productWantsLinkInventory(getSelectedInventoryProduct()) ? 'link' : 'credentials';
    syncInventoryInputMode();
}

function enhanceInventoryComposer() {
    const grid = document.querySelector('#tab-add-inventory .inventory-management-grid');
    if (!grid || grid.dataset.enhanced === 'true') return;

    const cards = grid.querySelectorAll(':scope > .admin-card');
    const singleCard = cards[0];
    const bulkCard = cards[1];
    if (!singleCard || !bulkCard) return;

    grid.dataset.enhanced = 'true';
    grid.classList.add('inventory-composer-grid');
    singleCard.classList.add('inventory-mode-card', 'inventory-single-card');
    bulkCard.classList.add('inventory-mode-card', 'inventory-bulk-card');

    const switcher = document.createElement('div');
    switcher.className = 'inventory-mode-switch';
    switcher.innerHTML = `
        <div>
            <h3>Add Inventory</h3>
            <p>Choose single entry or bulk paste. Platform, plan, and expiry stay shared.</p>
        </div>
        <div class="segmented-control">
            <button type="button" id="invModeSingleBtn" class="active" onclick="setInventoryAddMode('single')">
                <i data-lucide="user-plus"></i> Single
            </button>
            <button type="button" id="invModeBulkBtn" onclick="setInventoryAddMode('bulk')">
                <i data-lucide="layers"></i> Bulk
            </button>
        </div>
    `;
    grid.prepend(switcher);

    const singleForm = singleCard.querySelector('.add-form');
    const platformField = document.getElementById('addPlatform')?.closest('.ck-field');
    const planExpiryRow = document.getElementById('addPlan')?.closest('.grid-2');
    const sharedControls = document.createElement('div');
    sharedControls.className = 'inventory-shared-controls';
    if (platformField) sharedControls.appendChild(platformField);
    if (planExpiryRow) sharedControls.appendChild(planExpiryRow);
    ensureInventoryDeliveryTypeField(sharedControls);
    ensureInventoryProfileField(sharedControls);
    switcher.insertAdjacentElement('afterend', sharedControls);
    ensureInventoryLinkField(singleForm);

    const bulkPlatformField = document.getElementById('bulkPlatform')?.closest('.ck-field');
    if (bulkPlatformField) bulkPlatformField.style.display = 'none';

    ['addPlatform', 'addPlan', 'addExpiry'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', syncBulkInventoryControls);
    });
    document.getElementById('addPlatform')?.addEventListener('change', autoSelectInventoryDeliveryType);
    document.getElementById('inventoryDeliveryType')?.addEventListener('change', syncInventoryInputMode);
    const bulkLabel = document.querySelector('label[for="bulkAccounts"]');
    if (bulkLabel) bulkLabel.id = 'bulkAccountsLabel';
    const bulkHelp = bulkCard.querySelector('p');
    if (bulkHelp) bulkHelp.id = 'bulkFormatHelp';

    setInventoryAddMode(inventoryAddMode);
    autoSelectInventoryDeliveryType();
    if (window.lucide) lucide.createIcons();
}

function setInventoryAddMode(mode) {
    inventoryAddMode = mode === 'bulk' ? 'bulk' : 'single';
    syncBulkInventoryControls();

    const singleCard = document.querySelector('#tab-add-inventory .inventory-single-card');
    const bulkCard = document.querySelector('#tab-add-inventory .inventory-bulk-card');
    const singleBtn = document.getElementById('invModeSingleBtn');
    const bulkBtn = document.getElementById('invModeBulkBtn');

    if (singleCard) singleCard.style.display = inventoryAddMode === 'single' ? 'block' : 'none';
    if (bulkCard) bulkCard.style.display = inventoryAddMode === 'bulk' ? 'block' : 'none';
    if (singleBtn) singleBtn.classList.toggle('active', inventoryAddMode === 'single');
    if (bulkBtn) bulkBtn.classList.toggle('active', inventoryAddMode === 'bulk');

    const addBtn = document.getElementById('addInvBtn');
    if (addBtn && singleCard && singleCard.contains(addBtn)) {
        addBtn.innerHTML = inventoryAddMode === 'single'
            ? '<i data-lucide="plus"></i> Confirm & Add Account'
            : addBtn.innerHTML;
    }

    syncInventoryInputMode();
    if (window.lucide) lucide.createIcons();
    renderAdminPagination('ordersPagination', 'orders', 'loadOrders');
}

async function addInventory() {
    syncBulkInventoryControls();
    const platform = document.getElementById('addPlatform');
    const platformName = platform.options[platform.selectedIndex]?.text || '';
    const platformId = platform.value;
    const email = document.getElementById('addEmail').value.trim();
    const password = document.getElementById('addPassword').value.trim();
    const activationLink = document.getElementById('addLink')?.value.trim() || '';
    const deliveryType = getInventoryDeliveryType();
    const planType = document.getElementById('addPlan').value;
    const expiry = document.getElementById('addExpiry').value;
    const profile = document.getElementById('addProfile')?.value.trim() || '';
    const result = document.getElementById('addResult');

    if (!platformId || (deliveryType === 'link' ? !activationLink : (!email || !password))) {
        result.textContent = deliveryType === 'link'
            ? '[X] Select platform and paste an activation link'
            : '[X] Fill in platform, email, and password';
        result.className = 'add-result error';
        return;
    }

    result.textContent = deliveryType === 'link' ? ' Adding activation link to cloud...' : ' Adding account to cloud...';
    result.className = 'add-result info';
    const authData = {};
    if (profile) authData.profile = profile;
    if (deliveryType === 'link') {
        authData.link = activationLink;
        authData.delivery_type = 'activation_link';
    }
    const payloadEmail = deliveryType === 'link' ? `link_${Date.now()}@getotts.local` : email;
    const payloadPassword = deliveryType === 'link' ? 'activation-link' : password;

    try {
        const res = await adminFetch(`${API_BASE}/admin/inventory`, {
            method: 'POST',
            body: JSON.stringify({
                platform_id: platformId,
                email: payloadEmail,
                password: payloadPassword,
                plan_type: planType,
                expiry_date: expiry || null,
                auth_data: authData
            })
        });
        const data = await res.json();
        if (data.success || res.ok) {
            AdminStore.addInventoryItem({
                platform: platformName,
                platform_id: platformId,
                email: payloadEmail,
                password: payloadPassword,
                plan_type: planType,
                expiry_date: expiry || null,
                auth_data: authData,
                notes: [
                    profile ? `Profile: ${profile}` : '',
                    activationLink ? `Link: ${activationLink}` : '',
                    activationLink ? 'Delivery Type: activation_link' : ''
                ].filter(Boolean).join('\n'),
                __skipBackendSync: true
            });

            result.textContent = deliveryType === 'link'
                ? '[OK] Added activation link to cloud inventory!'
                : `[OK] Added ${email} to cloud inventory!`;
            result.className = 'add-result success';
            document.getElementById('addEmail').value = '';
            document.getElementById('addPassword').value = '';
            if (document.getElementById('addLink')) document.getElementById('addLink').value = '';
            loadStats();
            if (typeof loadInventory === 'function') loadInventory();
        } else {
            result.textContent = '[X] Cloud Sync Failed: ' + (extractApiError(null, data) || 'Error');
            result.className = 'add-result error';
        }
    } catch (e) {
        console.error('[Inventory] Single add failed:', e);
        result.textContent = '[X] ' + extractApiError(e, null);
        result.className = 'add-result error';
    }
}

async function bulkAddInventory() {
    syncBulkInventoryControls();
    const platform = document.getElementById('addPlatform') || document.getElementById('bulkPlatform');
    const platformName = platform.options[platform.selectedIndex]?.text || '';
    const platformId = platform.value;
    const raw = document.getElementById('bulkAccounts').value.trim();
    const result = document.getElementById('bulkResult');
    const deliveryType = getInventoryDeliveryType();

    const planType = (document.getElementById('bulkPlan') || document.getElementById('addPlan'))?.value || 'shared';
    const expiryDate = (document.getElementById('bulkExpiry') || document.getElementById('addExpiry'))?.value || null;
    const profile = document.getElementById('addProfile')?.value.trim() || '';

    if (!platformId || !raw) {
        result.textContent = '[X] Select a platform and paste accounts';
        result.className = 'add-result error';
        return;
    }

    const accounts = raw.split('\n').map(line => line.trim()).filter(Boolean).map((line, index) => {
        const [credentialsPart, profilePart] = line.trim().split('|').map(part => part.trim());
        const itemProfile = profilePart || profile;
        if (deliveryType === 'link') {
            const link = credentialsPart.trim();
            if (!/^https?:\/\//i.test(link)) return null;
            return {
                email: `link_${Date.now()}_${index}@getotts.local`,
                password: 'activation-link',
                plan_type: planType,
                expiry_date: expiryDate || null,
                auth_data: {
                    ...(itemProfile ? { profile: itemProfile } : {}),
                    link,
                    delivery_type: 'activation_link'
                },
                notes: [
                    itemProfile ? `Profile: ${itemProfile}` : '',
                    `Link: ${link}`,
                    'Delivery Type: activation_link'
                ].filter(Boolean).join('\n')
            };
        }
        if (!credentialsPart.includes(':')) return null;
        const [email, ...rest] = credentialsPart.split(':');
        const password = rest.join(':').trim();
        if (!email.trim() || !password) return null;
        return {
            email: email.trim(),
            password,
            plan_type: planType,
            expiry_date: expiryDate || null,
            auth_data: itemProfile ? { profile: itemProfile } : {}
        };
    }).filter(Boolean);

    if (!accounts.length) {
        result.textContent = deliveryType === 'link'
            ? '[X] No valid links found. Paste one https:// link per line'
            : '[X] No valid accounts found. Use format: email:password';
        result.className = 'add-result error';
        return;
    }

    result.textContent = deliveryType === 'link' ? ' Importing activation links to cloud...' : ' Importing bulk accounts to cloud...';
    result.className = 'add-result info';

    try {
        // Find platform slug by querying platforms if we only have platform_id or vice versa
        let platform_slug = platformId;
        if (typeof PRODUCTS !== 'undefined' && Array.isArray(PRODUCTS)) {
            const pr = PRODUCTS.find(p => p.id === platformId || p.platform_id === platformId);
            if (pr && pr.slug) platform_slug = pr.slug;
        }

        const res = await adminFetch(`${API_BASE}/admin/inventory/bulk-add`, {
            method: 'POST',
            body: JSON.stringify({
                platform_slug: platform_slug,
                plan_type: planType,
                expiry_date: expiryDate || null,
                accounts: accounts
            })
        });
        const data = await res.json();
        if (data.success || res.ok) {
            AdminStore.addInventoryBulk(accounts.map(a => ({
                platform: platformName,
                platform_id: platformId,
                email: a.email,
                password: a.password,
                plan_type: planType,
                expiry_date: expiryDate || null,
                auth_data: a.auth_data || {},
                notes: a.notes || '',
                __skipBackendSync: true
            })));

            result.textContent = deliveryType === 'link'
                ? `[OK] Successfully imported ${accounts.length} activation links to cloud!`
                : `[OK] Successfully bulk-imported ${accounts.length} accounts to cloud!`;
            result.className = 'add-result success';
            document.getElementById('bulkAccounts').value = '';
            loadStats();
            if (typeof loadInventory === 'function') loadInventory();
        } else {
            result.textContent = '[X] Cloud Import Failed: ' + (extractApiError(null, data) || 'Error');
            result.className = 'add-result error';
        }
    } catch (e) {
        result.textContent = '[X] Network error during bulk import';
        result.className = 'add-result error';
    }
}

window.addInventory = addInventory;
window.bulkAddInventory = bulkAddInventory;
window.setInventoryAddMode = setInventoryAddMode;


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
    if (document.getElementById('setGeminiKey')) document.getElementById('setGeminiKey').value = s.gemini_api_key || '';
    if (document.getElementById('setSupportAiInstructions')) document.getElementById('setSupportAiInstructions').value = s.support_ai_global_instructions || '';
}

function saveSettings() {
    const previousSettings = AdminStore.getSettings();
    const settings = {
        site_name: document.getElementById('setSiteName').value,
        support_email: document.getElementById('setSupportEmail').value,
        whatsapp: document.getElementById('setWhatsApp').value,
        admin_notify_number: document.getElementById('setAdminNotifyNumber')?.value || '',
        instagram: document.getElementById('setInstagram').value,
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
        gemini_api_key: document.getElementById('setGeminiKey')?.value || '',
        support_ai_global_instructions: document.getElementById('setSupportAiInstructions')?.value || '',
        product_support_ai_notes: previousSettings.product_support_ai_notes || {},
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
              if (data.success && data.settings) AdminStore.saveSettings(data.settings);
              if (!data.success) console.warn('[Settings] Sync response:', data);
          })
          .catch(e => console.warn('[Settings] Backend sync failed:', e));
    } catch(e) {}

    const result = document.getElementById('settingsResult');
    result.textContent = '[OK] Settings saved & synced to cloud!';
    result.className = 'add-result success';
    setTimeout(() => result.textContent = '', 3000);
}

/* ================================================
   PLATFORMS DROPDOWN
   ================================================ */
function loadPlatformDropdowns() {
    const allProds = AdminStore.getProducts();
    const opts = allProds.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    const placeholder = '<option value="">Select platform</option>';

    ['addPlatform', 'bulkPlatform'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            const current = el.value;
            el.innerHTML = placeholder + opts;
            if (current && Array.from(el.options).some(option => option.value === current)) {
                el.value = current;
            }
        }
    });
    syncBulkInventoryControls();
    autoSelectInventoryDeliveryType();
}

window.addEventListener('catalogUpdated', () => {
    loadPlatformDropdowns();
});

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
        'order_created': ' New order created',
        'order_updated': ' Order updated',
        'inventory_added': ' Inventory added',
        'inventory_bulk_added': ' Bulk inventory added',
        'inventory_updated': ' Inventory updated',
        'inventory_deleted': ' Inventory deleted',
        'product_updated': ' Product updated',
        'coupon_created': ' Coupon created',
        'coupon_updated': ' Coupon updated',
        'coupon_deleted': ' Coupon deleted',
        'settings_updated': ' Settings saved',
    };
    return map[action] || action;
}

/* ================================================
   MODALS
   ================================================ */
window.openModal = function(id) {
    const el = document.getElementById(id);
    if (el) {
        el.classList.add('is-open');
        el.classList.add('active');
        el.removeAttribute('aria-hidden');
        el.style.display = 'flex';
        el.style.opacity = '1';
        el.style.visibility = 'visible';
        el.style.pointerEvents = 'auto';
    }
};

window.closeModal = function(id) {
    const el = document.getElementById(id);
    if (el) {
        el.classList.remove('is-open');
        el.classList.remove('active');
        el.setAttribute('aria-hidden', 'true');
        el.style.display = 'none';
        el.style.opacity = '0';
        el.style.pointerEvents = 'none';
    }
};


// Close modal on overlay click
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.remove('is-open');
        e.target.setAttribute('aria-hidden', 'true');
        e.target.style.display = 'none';
    }
});

/* ================================================
   HELPERS
   ================================================ */
function formatDate(dateStr) {
    if (!dateStr) return '--';
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

function setAdminButtonBusy(button, busy, busyLabel) {
    if (!button) return () => {};
    if (!button.dataset.originalHtml) button.dataset.originalHtml = button.innerHTML;
    button.disabled = !!busy;
    button.classList.toggle('is-busy', !!busy);
    if (busy && busyLabel) button.innerHTML = busyLabel;
    if (!busy) button.innerHTML = button.dataset.originalHtml || button.innerHTML;
    if (!busy) delete button.dataset.originalHtml;
    if (window.lucide) lucide.createIcons();
    return () => setAdminButtonBusy(button, false);
}

/* ================================================
   WHATSAPP MONITOR -- Auto-Verify Integration
   ================================================ */

const WA_MONITOR = (window.GETOTTS_CONFIG && window.GETOTTS_CONFIG.WA_MONITOR_URL) || 'http://localhost:3100';
const WA_MONITOR_SAME_ORIGIN = (() => {
    try {
        return new URL(WA_MONITOR, window.location.origin).origin === window.location.origin;
    } catch {
        return false;
    }
})();

function waMonitorFetch(path, options = {}) {
    const url = `${WA_MONITOR}${path}`;
    if (WA_MONITOR_SAME_ORIGIN) {
        const sameOriginOptions = { ...options };
        delete sameOriginOptions.credentials;
        return adminFetch(url, sameOriginOptions);
    }
    return fetch(url, { ...options, credentials: 'omit' });
}

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
    loadWaMarketingCustomers();
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
        const qrRes = await waMonitorFetch('/qr', { signal: AbortSignal.timeout(5000) });
        const qrData = await qrRes.json();

        const pill = document.getElementById('waStatusPill');
        if (pill) {
            const dot = pill.querySelector('.status-dot');
            const text = pill.querySelector('.status-text');
            if (qrData.status === 'connected') {
                if (dot) { dot.className = 'status-dot online'; }
                if (text) { text.textContent = 'WhatsApp: Online'; }
            } else {
                if (dot) { dot.className = 'status-dot offline'; }
                if (text) { text.textContent = 'WhatsApp: Offline'; }
            }
        }

        if (qrData.status === 'connected') {
            // [OK] Connected!
            if (badge) {
                badge.className = 'pill pill-paid';
                badge.textContent = ' Connected';
            }
            if (setupCard) setupCard.style.borderColor = '#25D366';

            const info = qrData.info || {};
            setupContent.innerHTML = `
                <div style="display:flex;align-items:center;gap:20px;padding:8px">
                    <div style="width:60px;height:60px;border-radius:16px;background:#25D366;display:flex;align-items:center;justify-content:center;flex-shrink:0">
                        <svg viewBox="0 0 24 24" fill="white" style="width:32px;height:32px"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    </div>
                    <div style="flex:1">
                        <div style="font-size:1.1rem;font-weight:700;color:var(--gray-800)">WhatsApp Connected [OK]</div>
                        <div style="font-size:.85rem;color:var(--gray-500);margin-top:4px">
                             ${info.phone || 'Phone'}   ${info.name || 'Admin'}   ${info.platform || 'web'}
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
            //  QR Code -- need to scan
            if (badge) {
                badge.className = 'pill pill-pending';
                badge.textContent = ' Scan QR';
            }
            if (setupCard) setupCard.style.borderColor = '#f59e0b';

            setupContent.innerHTML = `
                <div style="text-align:center;padding:16px">
                    <p style="font-size:.9rem;color:var(--gray-700);font-weight:600;margin-bottom:12px">
                        Scan this QR code with your WhatsApp
                    </p>
                    <img src="${qrData.qr}" alt="WhatsApp QR Code" style="width:260px;height:260px;border-radius:12px;border:3px solid var(--gray-100);margin:0 auto;display:block">
                    <p style="font-size:.78rem;color:var(--gray-400);margin-top:12px">
                        Open WhatsApp on your phone  Settings  Linked Devices  Link a Device
                    </p>
                </div>
            `;

            // Keep polling for QR updates
            if (!_waStatusInterval) {
                _waStatusInterval = setInterval(checkWaMonitorStatus, 3000);
            }
            return;

        } else {
            //  Waiting for QR
            if (badge) {
                badge.className = 'pill pill-pending';
                badge.textContent = ' Initializing...';
            }
            setupContent.innerHTML = `
                <div style="text-align:center;padding:20px">
                    <div style="font-size:2rem;margin-bottom:12px"></div>
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
            badge.textContent = ' Offline';
        }
        if (setupCard) setupCard.style.borderColor = '#ef4444';

        setupContent.innerHTML = `
            <div style="text-align:center;padding:20px">
                <div style="font-size:2rem;margin-bottom:12px"></div>
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
            const res = await waMonitorFetch('/status', { signal: AbortSignal.timeout(3000) });
            const data = await res.json();
            const badge = document.getElementById('waConnectionBadge');
            if (data.connected) {
                if (badge) { badge.className = 'pill pill-paid'; badge.textContent = ' Connected'; }
            } else {
                if (badge) { badge.className = 'pill pill-failed'; badge.textContent = ' Disconnected'; }
                checkWaMonitorStatus(); // Try to get QR
            }
        } catch {
            const badge = document.getElementById('waConnectionBadge');
            if (badge) { badge.className = 'pill pill-failed'; badge.textContent = ' Offline'; }
        }
    }, 10000);
}

/**
 * Toggle auto-verify on the monitor service
 */
async function toggleAutoVerify(enabled) {
    try {
        await waMonitorFetch('/auto-verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled }),
        });
        showToast(enabled ? ' Auto-verify enabled!' : ' Auto-verify disabled -- manual mode');
    } catch {
        showToast('[X] Could not reach WhatsApp monitor');
    }
}

/**
 * Disconnect WhatsApp session
 */
async function disconnectWa() {
    if (!confirm('Disconnect WhatsApp? You will need to scan the QR code again.')) return;
    try {
        await waMonitorFetch('/logout', { method: 'POST' });
        showToast('WhatsApp disconnected');
        setTimeout(checkWaMonitorStatus, 2000);
    } catch {
        showToast('[X] Failed to disconnect');
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
        showToast('[X] Phone and order number required');
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
        const res = await waMonitorFetch('/send-order-update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const data = await res.json();
        if (data.success) {
            resultDiv.innerHTML = `
                <div style="background:rgba(37,211,102,.06);border:1px solid rgba(37,211,102,.2);border-radius:12px;padding:16px;margin-top:8px">
                    <p style="font-weight:600;color:#25D366;margin-bottom:4px">[OK] Message sent directly via WhatsApp!</p>
                    <p style="font-size:.82rem;color:var(--gray-500)">Delivered to ${phone}</p>
                </div>
            `;
            showToast('[OK] Sent directly via WhatsApp!');
            loadWaLiveMessages();
            return;
        }
    } catch {}

    // Fallback: use wa.me link via backend
    sendWaOrderUpdate();
}

const WA_TEMPLATE_MESSAGES = {
    coupon: 'Special offer is live now. Use coupon code GET5 at checkout and save on your next subscription.',
    renewal: 'Your plan can be renewed before it expires. Reply here if you want us to help renew it quickly.',
    support: 'Just checking in. If your account, login, delivery, or payment needs help, reply here and we will assist.',
    custom: ''
};

let waMarketingCustomers = [];

function cleanWaPhone(value) {
    let phone = String(value || '').replace(/\D/g, '');
    if (phone.length === 10) phone = '91' + phone;
    return phone;
}

function applyWaTemplate(scope) {
    const templateEl = document.getElementById(scope === 'broadcast' ? 'waBroadcastTemplate' : 'waDirectTemplate');
    const messageEl = document.getElementById(scope === 'broadcast' ? 'waBroadcastMessage' : 'waDirectMessage');
    if (!templateEl || !messageEl) return;
    const value = WA_TEMPLATE_MESSAGES[templateEl.value] || '';
    if (!messageEl.value.trim() || confirm('Replace the current WhatsApp message with this template?')) {
        messageEl.value = value;
    }
}
window.applyWaTemplate = applyWaTemplate;

async function loadWaMarketingCustomers() {
    const directSelect = document.getElementById('waDirectCustomer');
    const summary = document.getElementById('waBroadcastSummary');
    if (!directSelect && !summary) return;

    const segment = document.getElementById('waBroadcastSegment')?.value || 'all';
    const limit = Number(document.getElementById('waBroadcastLimit')?.value || 300);

    try {
        const customerRes = await adminFetch(`${API_BASE}/admin/customers`, { timeoutMs: 12000 });
        const customerData = await customerRes.json().catch(() => ({}));
        const customers = customerData.customers || [];
        waMarketingCustomers = customers.filter(c => cleanWaPhone(customerPhone(c)));
        if (directSelect) {
            const current = directSelect.value;
            directSelect.innerHTML = '<option value="">Choose customer...</option>' + waMarketingCustomers.slice(0, 500).map(c => {
                const label = customerName(c) || customerEmail(c) || customerPhone(c) || c.id;
                return `<option value="${escapeAttr(c.id)}" data-phone="${escapeAttr(cleanWaPhone(customerPhone(c)))}">${escapeHtml(label)} - ${escapeHtml(cleanWaPhone(customerPhone(c)))}</option>`;
            }).join('');
            if (current) directSelect.value = current;
        }

        const countRes = await adminFetch(`${API_BASE}/admin/whatsapp/recipients?segment=${encodeURIComponent(segment)}&limit=${encodeURIComponent(limit)}`, { timeoutMs: 12000 });
        const countData = await countRes.json().catch(() => ({}));
        if (summary && countData.success) {
            const sample = (countData.recipients || []).slice(0, 4).map(r => escapeHtml(r.name || r.phone)).join(', ');
            summary.innerHTML = `<strong>${countData.count || 0}</strong> reachable customers selected${sample ? ` <span>Sample: ${sample}</span>` : ''}`;
        }
    } catch (e) {
        if (summary) summary.textContent = 'Could not load WhatsApp recipients.';
    }
}
window.loadWaMarketingCustomers = loadWaMarketingCustomers;

function fillWaDirectPhoneFromCustomer() {
    const select = document.getElementById('waDirectCustomer');
    const phone = select?.selectedOptions?.[0]?.dataset?.phone || '';
    const input = document.getElementById('waDirectPhone');
    if (input && phone) input.value = phone;
}
window.fillWaDirectPhoneFromCustomer = fillWaDirectPhoneFromCustomer;

function waDirectPayload() {
    return {
        customer_id: document.getElementById('waDirectCustomer')?.value || null,
        phone: cleanWaPhone(document.getElementById('waDirectPhone')?.value || ''),
        template: document.getElementById('waDirectTemplate')?.value || 'custom',
        campaign_name: document.getElementById('waDirectCampaign')?.value.trim() || '',
        message: document.getElementById('waDirectMessage')?.value.trim() || '',
        include_footer: true
    };
}

function waBroadcastPayload(dryRun = true) {
    return {
        segment: document.getElementById('waBroadcastSegment')?.value || 'all',
        template: document.getElementById('waBroadcastTemplate')?.value || 'custom',
        campaign_name: document.getElementById('waBroadcastCampaign')?.value.trim() || '',
        message: document.getElementById('waBroadcastMessage')?.value.trim() || '',
        include_footer: true,
        dry_run: dryRun,
        limit: Number(document.getElementById('waBroadcastLimit')?.value || 300)
    };
}

function renderWaPreview(target, data) {
    const el = document.getElementById(target);
    if (!el) return;
    const message = data.sample_message || data.message || '';
    const count = data.count !== undefined ? `<div class="wa-preview-meta">${data.count} reachable recipients</div>` : '';
    el.innerHTML = `
        ${count}
        <pre>${escapeHtml(message || 'No preview available')}</pre>
    `;
}

async function previewWaDirectMessage() {
    const result = document.getElementById('waDirectResult');
    const payload = waDirectPayload();
    if (!payload.message) return showToast('Write a WhatsApp message first');
    try {
        const res = await adminFetch(`${API_BASE}/admin/whatsapp/preview`, {
            method: 'POST',
            body: JSON.stringify({ ...payload, segment: 'all', dry_run: true, limit: 1 })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.success === false) throw new Error(extractApiError(null, data));
        renderWaPreview('waDirectResult', { sample_message: data.sample_message });
    } catch (e) {
        if (result) result.innerHTML = `<div class="wa-error">${escapeHtml(e.message || 'Preview failed')}</div>`;
    }
}
window.previewWaDirectMessage = previewWaDirectMessage;

async function sendWaDirectCustomerMessage() {
    const result = document.getElementById('waDirectResult');
    const payload = waDirectPayload();
    if (!payload.customer_id && !payload.phone) return showToast('Choose a customer or enter a phone number');
    if (!payload.message) return showToast('Write a WhatsApp message first');
    if (!confirm('Send this WhatsApp message now?')) return;
    try {
        if (result) result.innerHTML = '<div class="wa-preview-meta">Sending...</div>';
        const res = await adminFetch(`${API_BASE}/admin/whatsapp/send`, {
            method: 'POST',
            body: JSON.stringify(payload),
            timeoutMs: 30000
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.success === false) throw new Error(extractApiError(null, data));
        if (result) result.innerHTML = `<div class="wa-success">Sent to ${escapeHtml(data.phone || payload.phone)}</div><pre>${escapeHtml(data.message || payload.message)}</pre>`;
        showToast('WhatsApp message sent');
        loadWaLiveMessages();
    } catch (e) {
        if (result) result.innerHTML = `<div class="wa-error">${escapeHtml(e.message || 'Send failed')}</div>`;
    }
}
window.sendWaDirectCustomerMessage = sendWaDirectCustomerMessage;

async function previewWaBroadcast() {
    const result = document.getElementById('waBroadcastResult');
    const payload = waBroadcastPayload(true);
    if (!payload.message) return showToast('Write a broadcast message first');
    try {
        const res = await adminFetch(`${API_BASE}/admin/whatsapp/preview`, {
            method: 'POST',
            body: JSON.stringify(payload),
            timeoutMs: 20000
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.success === false) throw new Error(extractApiError(null, data));
        renderWaPreview('waBroadcastResult', data);
        loadWaMarketingCustomers();
    } catch (e) {
        if (result) result.innerHTML = `<div class="wa-error">${escapeHtml(e.message || 'Preview failed')}</div>`;
    }
}
window.previewWaBroadcast = previewWaBroadcast;

async function sendWaBroadcast() {
    const result = document.getElementById('waBroadcastResult');
    const payload = waBroadcastPayload(false);
    if (!payload.message) return showToast('Write a broadcast message first');
    const phrase = prompt('This sends WhatsApp messages to the selected customers. Type SEND BROADCAST to continue.');
    if (phrase !== 'SEND BROADCAST') {
        showToast('Broadcast cancelled');
        return;
    }
    payload.confirm_text = phrase;
    try {
        if (result) result.innerHTML = '<div class="wa-preview-meta">Sending broadcast. Keep this tab open...</div>';
        const res = await adminFetch(`${API_BASE}/admin/whatsapp/broadcast`, {
            method: 'POST',
            body: JSON.stringify(payload),
            timeoutMs: 300000
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.success === false) throw new Error(extractApiError(null, data));
        if (result) {
            result.innerHTML = `
                <div class="wa-success">Broadcast complete: ${data.sent || 0} sent, ${data.failed || 0} failed</div>
                <pre>${escapeHtml(JSON.stringify({ sent_sample: data.sent_sample || [], failed_sample: data.failed_sample || [] }, null, 2))}</pre>
            `;
        }
        showToast(`Broadcast sent to ${data.sent || 0} customers`);
        loadWaLiveMessages();
    } catch (e) {
        if (result) result.innerHTML = `<div class="wa-error">${escapeHtml(e.message || 'Broadcast failed')}</div>`;
    }
}
window.sendWaBroadcast = sendWaBroadcast;

/**
 * Load live messages from the WA monitor
 */
async function loadWaLiveMessages() {
    const container = document.getElementById('waMessageLog');
    if (!container) return;

    try {
        const res = await waMonitorFetch('/messages?limit=30', { signal: AbortSignal.timeout(3000) });
        const data = await res.json();

        if (!data.success || !data.messages.length) {
            // Fall back to backend message log
            loadWaMessageLog();
            return;
        }

        const typeEmoji = {
            incoming: '', outgoing: '', login_code: '',
            order_update: '',
        };

        container.innerHTML = data.messages.map(m => {
            const emoji = typeEmoji[m.type] || '';
            const time = m.timestamp ? formatTimeAgo(m.timestamp) : '';
            const verified = m.auto_verified ? '  <span style="color:#25D366;font-weight:600">[OK] Auto-verified</span>' : '';
            return `
                <div class="wa-log-item" style="${m.type === 'login_code' ? 'background:rgba(37,211,102,.06);border-left:3px solid #25D366' : ''}">
                    <div class="wa-log-emoji">${emoji}</div>
                    <div class="wa-log-info">
                        <div class="wa-log-title">
                            <strong>${m.type?.replace(/_/g, ' ').toUpperCase()}</strong>
                            <span style="color:var(--gray-400)">${m.type === 'outgoing' ? '' : ''} ${m.from || m.name || ''}</span>
                        </div>
                        <div class="wa-log-meta">
                            ${m.body?.substring(0, 60) || '--'}  ${time}${verified}
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
   WHATSAPP HUB -- Fallback Admin Functions
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
                            <span> ${phoneDisplay}</span>
                            <span> ${nameDisplay}</span>
                            <span class="wa-pending-timer"> ${timeStr}</span>
                        </div>
                    </div>
                    <div class="wa-pending-actions">
                        <button class="btn btn-sm" style="background:#25D366;color:white;padding:8px 16px;border-radius:8px;font-weight:600;border:none;cursor:pointer" onclick="verifyWaCode('${s.code}', '${s.phone || ''}', '${s.name || ''}')">
                            [OK] Verify
                        </button>
                        <button class="btn btn-sm" style="background:#ef4444;color:white;padding:8px 16px;border-radius:8px;font-weight:600;border:none;cursor:pointer" onclick="rejectWaCode('${s.code}')">
                             Reject
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
 * Verify a WhatsApp login code -- logs the customer in.
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
                            [OK] Confirm
                        </button>
                        <button class="btn btn-sm" style="background:#ef4444;color:white;padding:6px 12px;border-radius:8px;font-weight:600;border:none;cursor:pointer;font-size:.8rem"
                            onclick="rejectWaCode('${code}')"></button>
                    </div>
                    <div style="font-size:.72rem;color:var(--gray-500);margin-top:6px;line-height:1.35;">
                        Phone was not detected from WhatsApp. Enter the sender phone, or use "Verify without phone" to log them in and collect email next.
                    </div>
                    <button class="btn btn-sm" style="margin-top:8px;background:#0f172a;color:white;padding:8px 12px;border-radius:8px;font-weight:700;border:none;cursor:pointer"
                        onclick="verifyWaCodeWithoutPhone('${code}', '${name || ''}')">
                        Verify without phone
                    </button>
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
            showToast(`[OK] Code ${code} verified! Customer logged in.`);
            // Animate removal
            if (item) {
                item.style.background = 'rgba(37, 211, 102, 0.08)';
                item.innerHTML = `
                    <div style="display:flex;align-items:center;gap:8px;padding:8px">
                        <span style="font-size:1.4rem">[OK]</span>
                        <div>
                            <strong>${code}</strong> -- Verified!
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
            showToast('[X] Verification failed: ' + (extractApiError(null, data) || 'Unknown error'));
            if (item) item.style.opacity = '1';
        }
    } catch (err) {
        console.error('[WA-Admin]', err);
        showToast('[X] Network error during verification');
        if (item) item.style.opacity = '1';
    }
}

async function verifyWaCodeWithoutPhone(code, name) {
    const item = document.getElementById(`wa-item-${code}`);
    if (item) item.style.opacity = '0.5';

    try {
        const res = await fetch(`${API_BASE}/admin/wa-auth/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, phone: '', name }),
        });
        const data = await res.json();

        if (data.success) {
            showToast(`[OK] Code ${code} verified without phone. Customer logged in.`);
            if (item) {
                item.style.background = 'rgba(37, 211, 102, 0.08)';
                item.innerHTML = `
                    <div style="display:flex;align-items:center;gap:8px;padding:8px">
                        <span style="font-size:1.4rem">[OK]</span>
                        <div>
                            <strong>${code}</strong> -- Verified!
                            <div style="font-size:.8rem;color:var(--gray-400)">Phone not captured; customer can add details after login.</div>
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
            showToast('[X] Verification failed: ' + (extractApiError(null, data) || 'Unknown error'));
            if (item) item.style.opacity = '1';
        }
    } catch (err) {
        console.error('[WA-Admin]', err);
        showToast('[X] Network error during verification');
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
        const res = await adminFetch(`${API_BASE}/admin/wa-auth/reject`, {
            method: 'POST',
            body: JSON.stringify({ code }),
        });
        const data = await res.json();

        if (data.success) {
            showToast(` Code ${code} rejected.`);
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
        showToast('[X] Failed to reject code');
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
        showToast('[X] Phone number is required');
        return;
    }
    if (!orderNumber) {
        showToast('[X] Order number is required');
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
            showToast('[X] Please enter a custom message');
            return;
        }
    }

    try {
        const res = await adminFetch(`${API_BASE}/admin/wa-auth/send-order-update`, {
            method: 'POST',
            body: JSON.stringify(body),
        });
        const data = await res.json();

        if (data.success) {
            resultDiv.innerHTML = `
                <div style="background:rgba(37,211,102,.06);border:1px solid rgba(37,211,102,.2);border-radius:12px;padding:16px;margin-top:8px">
                    <p style="font-weight:600;color:#25D366;margin-bottom:8px">[OK] Message ready!</p>
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
            showToast('[OK] WhatsApp link generated!');
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
            processing: '',
            on_the_way: '',
            delivered: '[OK]',
            credentials: '',
            invoice: '',
            renewal_reminder: '',
            custom: '',
            status: '',
        };

        container.innerHTML = data.messages.map(m => {
            const emoji = typeEmoji[m.type] || '';
            const time = m.sent_at ? formatTimeAgo(m.sent_at) : '';
            return `
                <div class="wa-log-item">
                    <div class="wa-log-emoji">${emoji}</div>
                    <div class="wa-log-info">
                        <div class="wa-log-title">
                            <strong>${m.type?.replace(/_/g, ' ').toUpperCase()}</strong>
                            <span style="color:var(--gray-400)"> ${m.phone}</span>
                        </div>
                        <div class="wa-log-meta">
                            Order: ${m.order_number || '--'}  ${time}
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
    setTableLoading(body, 5, 'Loading vouchers...');

    try {
        const res = await adminFetch(`${API_BASE}/vouchers/admin/list`, { timeoutMs: 12000, cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.success === false) {
            throw new Error(extractApiError(null, data) || `Voucher list failed (${res.status})`);
        }

        if (!data.success || !data.vouchers || data.vouchers.length === 0) {
            body.innerHTML = '<tr><td colspan="5" class="empty-state">No vouchers found</td></tr>';
            document.getElementById('statActiveVouchers').textContent = '0';
            loadWalletStats();
            return;
        }

        const activeCount = data.vouchers.filter(v => v.status === 'active').length;
        document.getElementById('statActiveVouchers').textContent = activeCount;

        body.innerHTML = data.vouchers.map(v => {
            const currency = (v.currency || (String(v.code || '').toUpperCase().startsWith('USD-') ? 'USD' : 'INR')).toUpperCase();
            return `
            <tr>
                <td><code style="font-weight:700; color:var(--gray-900)">${v.code}</code></td>
                <td><span class="money-dual"><strong>${singleCurrencyMoney(v.amount, currency)}</strong><small>${currency} wallet</small></span></td>
                <td><span class="pill pill-${v.status}">${v.status}</span></td>
                <td>${formatDate(v.created_at)}</td>
                <td class="action-cell">
                    ${v.status === 'active' ? `
                        <button class="action-btn red" onclick="revokeVoucher('${v.id}')" title="Revoke Voucher">
                            <i data-lucide="x-circle"></i>
                        </button>
                    ` : '--'}
                </td>
            </tr>
        `}).join('');

        if (window.lucide) lucide.createIcons();

        // Also update total wallet credits stat from customers
        loadWalletStats();
    } catch (err) {
        body.innerHTML = `<tr><td colspan="5" class="empty-state">Error loading vouchers: ${escapeHtml(extractApiError(err, null))}</td></tr>`;
        showToast('[X] Voucher load failed: ' + extractApiError(err, null));
    }
}

async function loadWalletStats() {
    // Already handled by loadStats if calling /admin/stats
    // But we can re-call loadStats to be sure it's fresh
    await loadStats();
}

async function showVoucherCreateModal() {
    document.getElementById('vchCode').value = '';
    document.getElementById('vchAmount').value = '';
    document.getElementById('vchCurrency').value = 'INR';
    document.getElementById('vchLimit').value = '1';
    document.getElementById('vchExpiry').value = '';
    openModal('voucherModal');
}

async function saveVoucher() {
    const code = document.getElementById('vchCode').value.trim();
    const amount = document.getElementById('vchAmount').value;
    const currency = document.getElementById('vchCurrency')?.value || 'INR';
    const limit = document.getElementById('vchLimit').value;
    const expiry = document.getElementById('vchExpiry').value;

    if (!amount || isNaN(amount)) {
        showToast('[X] Please enter a valid amount');
        return;
    }

    const btn = document.querySelector('#voucherModal .modal-footer .btn-primary');
    const releaseBtn = setAdminButtonBusy(btn, true, '<i data-lucide="loader-2"></i> Creating...');
    showToast('Creating voucher...');
    try {
        const res = await adminFetch(`${API_BASE}/vouchers/admin/create`, {
            method: 'POST',
            body: JSON.stringify({
                code: code || null,
                amount: parseFloat(amount),
                currency,
                usage_limit: parseInt(limit),
                expiry_date: expiry || null
            })
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success) {
            showToast('[OK] Voucher created!');
            closeModal('voucherModal');
            loadAdminVouchers();
        } else {
            showToast('[X] Failed: ' + (extractApiError(null, data) || `HTTP ${res.status}`));
        }
    } catch (e) {
        showToast('[X] Network error: ' + (e?.message || 'Unable to create voucher'));
    } finally {
        releaseBtn();
    }
}

async function showBulkGenerateModal() {
    document.getElementById('bulkVchCount').value = '10';
    document.getElementById('bulkVchAmount').value = '100';
    document.getElementById('bulkVchCurrency').value = 'INR';
    document.getElementById('bulkVchPrefix').value = 'VCH';
    document.getElementById('bulkVchExpiry').value = '';
    openModal('bulkVoucherModal');
}

async function generateBulkVouchers() {
    const count = document.getElementById('bulkVchCount').value;
    const amount = document.getElementById('bulkVchAmount').value;
    const currency = document.getElementById('bulkVchCurrency')?.value || 'INR';
    const prefix = document.getElementById('bulkVchPrefix').value.trim();
    const expiry = document.getElementById('bulkVchExpiry').value;

    if (!count || !amount || isNaN(count) || isNaN(amount)) {
        showToast('[X] Please fill all required fields');
        return;
    }

    const btn = document.querySelector('#bulkVoucherModal .modal-footer .btn-primary');
    const releaseBtn = setAdminButtonBusy(btn, true, '<i data-lucide="loader-2"></i> Generating...');
    showToast('Generating vouchers...');
    try {
        const res = await adminFetch(`${API_BASE}/vouchers/admin/bulk-generate`, {
            method: 'POST',
            body: JSON.stringify({
                count: parseInt(count),
                amount: parseFloat(amount),
                currency,
                prefix,
                expiry_date: expiry || null
            })
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success) {
            showToast(`[OK] Successfully generated ${data.count} vouchers!`);
            closeModal('bulkVoucherModal');
            loadAdminVouchers();
        } else {
            showToast('[X] Generation failed: ' + (extractApiError(null, data) || `HTTP ${res.status}`));
        }
    } catch (e) {
        showToast('[X] Network error: ' + (e?.message || 'Unable to generate vouchers'));
    } finally {
        releaseBtn();
    }
}

async function revokeVoucher(id) {
    if (!confirm("Revoke this voucher? It will no longer be redeemable.")) return;
    try {
        const res = await adminFetch(`${API_BASE}/vouchers/admin/revoke/${id}`, { method: 'POST' });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success) {
            showToast('Voucher revoked ');
            loadAdminVouchers();
        } else {
            showToast('[X] Error: ' + (extractApiError(null, data) || `HTTP ${res.status}`));
        }
    } catch (e) {
        showToast('Error revoking voucher');
    }
}

function customerLookupValue(c) {
    return [
        c?.id,
        customerEmail(c),
        customerPhone(c),
        customerName(c)
    ].map(v => String(v || '').trim().toLowerCase()).filter(Boolean);
}

async function resolveAdminCustomerId(input) {
    const needle = String(input || '').trim();
    const lowerNeedle = needle.toLowerCase();
    if (!needle) throw new Error('Enter customer ID, email, phone, or name');

    const local = (adminCustomersCache || []).find(c => customerLookupValue(c).includes(lowerNeedle));
    if (local?.id) return local.id;

    const params = new URLSearchParams({ limit: '500', offset: '0', search: needle });
    const res = await adminFetch(`${API_BASE}/admin/customers?${params.toString()}`, { timeoutMs: 12000 });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) {
        throw new Error(extractApiError(null, data) || `Customer search failed (${res.status})`);
    }

    const customers = data.customers || [];
    const exact = customers.find(c => customerLookupValue(c).includes(lowerNeedle));
    const found = exact || (customers.length === 1 ? customers[0] : null);
    if (!found?.id) throw new Error('Customer not found. Paste the customer ID or exact email.');
    return found.id;
}

async function adminAdjustWallet() {
    const customer = document.getElementById('adjCustomer').value.trim();
    const amount = document.getElementById('adjAmount').value;
    const currency = document.getElementById('adjCurrency')?.value || 'INR';
    const type = document.getElementById('adjType').value;
    const reason = document.getElementById('adjReason').value.trim();

    if (!customer || !amount || !reason) {
        showToast('[X] Please fill all fields');
        return;
    }

    if (!confirm(`Are you sure you want to ${type} ${singleCurrencyMoney(amount, currency)} in this customer's ${currency} wallet?`)) return;

    const btn = document.querySelector('#tab-vouchers button[onclick="adminAdjustWallet()"]');
    const releaseBtn = setAdminButtonBusy(btn, true, '<i data-lucide="loader-2"></i> Adjusting...');
    try {
        const customerId = await resolveAdminCustomerId(customer);

        const res = await adminFetch(`${API_BASE}/vouchers/admin/adjust`, {
            method: 'POST',
            body: JSON.stringify({
                customer_id: customerId,
                amount: parseFloat(amount),
                currency,
                type,
                reason
            })
        });

        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success) {
            showToast(`[OK] ${currency} wallet adjusted! New balance: ${singleCurrencyMoney(data.new_balance, currency)}`);
            document.getElementById('adjAmount').value = '';
            document.getElementById('adjReason').value = '';
            clearTabCache('customers');
            loadWalletStats();
            if (typeof loadCustomers === 'function') loadCustomers({ force: true });
        } else {
            showToast('[X] Error: ' + (extractApiError(null, data) || `HTTP ${res.status}`));
        }
    } catch (e) {
        showToast('[X] Adjustment failed: ' + (e?.message || 'Unknown error'));
    } finally {
        releaseBtn();
    }
}

window.factoryResetAdmin = async function() {
    if (!confirm("[WARN] FACTORY RESET?\n\nThis will:\n1. Clear all local overrides in your browser\n2. Restore the original 14 products (Netflix, Prime, etc.)\n3. Sync the clean catalog to the cloud\n\nThis will solve duplicates and broken images. Continue?")) return;

    // 1. Clear local overrides
    localStorage.removeItem('getotts_admin_products');

    // 2. Prepare the clean fallback catalog
    const fallback = (typeof FALLBACK_PRODUCTS !== 'undefined') ? FALLBACK_PRODUCTS : [];
    if (fallback.length === 0) {
        showToast("[X] Error: Fallback catalog not found.");
        return;
    }

    showToast(" Cleaning local data...");

    // 3. Force Sync to Cloud
    try {
        const API = (window.GETOTTS_CONFIG && window.GETOTTS_CONFIG.API_BASE) || API_BASE;
        const resp = await adminFetch(`${API}/admin/catalog/migrate`, {
            method: 'POST',
            body: JSON.stringify({ products: fallback, confirm_full_replace: true })
        });

        if (resp.ok) {
            showToast("[OK] Factory Reset Complete! Reloading...");
            setTimeout(() => window.location.reload(), 2000);
        } else {
            throw new Error(await resp.text());
        }
    } catch (err) {
        console.error("[Reset Error]", err);
        showToast("[X] Reset failed during sync. Check console.");
    }
};

if (typeof showVoucherCreateModal !== 'undefined') window.showVoucherCreateModal = showVoucherCreateModal;
if (typeof saveVoucher !== 'undefined') window.saveVoucher = saveVoucher;
if (document.getElementById('bulkGenerateVouchers')) window.generateBulkVouchers = generateBulkVouchers;

/* ================================================
   AI MAGIC FEATURES
   ================================================ */
window.suggestKeywordsAI = async function() {
    const name = document.getElementById('wizName').value;
    const cat = document.getElementById('wizCategory').value;
    const btn = document.querySelector('[onclick="suggestKeywordsAI()"]');

    if (!name) { showToast('[X] Enter product name first'); return; }

    const oldText = btn.innerHTML;
    btn.innerHTML = 'Suggesting...';
    btn.disabled = true;

    try {
        const res = await adminFetch(`${API_BASE}/admin/ai/generate-keywords`, {
            method: 'POST',
            body: JSON.stringify({ product_name: name, category: cat })
        });
        const data = await res.json();
        if (data.success && data.keywords) {
            const current = document.getElementById('wizKeywords').value;
            const combined = [...new Set([...(current ? current.split(',').map(k=>k.trim()) : []), ...data.keywords])];
            document.getElementById('wizKeywords').value = combined.join(', ');
            showToast('[OK] Keywords suggested!');
        } else {
            showToast('[X] AI Error: ' + (data.detail || 'Failed to generate'));
        }
    } catch (e) {
        showToast('[X] Network error');
    } finally {
        btn.innerHTML = oldText;
        btn.disabled = false;
    }
};

window.generateProductAI = async function() {
    const name = document.getElementById('wizName').value;
    const cat = document.getElementById('wizCategory').value;
    const keywords = document.getElementById('wizKeywords').value.split(',').map(k => k.trim()).filter(k => k);
    const btn = document.getElementById('wizAiBtn');

    if (!name) { showToast('[X] Enter product name first'); return; }

    const oldText = btn.innerHTML;
    btn.innerHTML = '✨ Working Magic...';
    btn.disabled = true;

    try {
        const res = await adminFetch(`${API_BASE}/admin/ai/generate-product`, {
            method: 'POST',
            body: JSON.stringify({ product_name: name, category: cat, keywords: keywords })
        });
        const data = await res.json();

        if (data.success) {
            if (data.description) document.getElementById('wizDescription').value = data.description;
            if (data.slug && !window._wizSlugManual) document.getElementById('wizSlug').value = data.slug;

            if (data.features_shared) {
                window._wizardFeatures.shared = data.features_shared.split('\n').map(f => f.replace(/^[•\-\*]\s*/, '').trim()).filter(f => f);
                wizRenderFeatures();
            }
            if (data.features_personal) {
                window._wizardFeatures.personal = data.features_personal.split('\n').map(f => f.replace(/^[•\-\*]\s*/, '').trim()).filter(f => f);
                wizRenderFeatures();
            }

            if (data.faq && Array.isArray(data.faq)) {
                window._wizardFaqs = data.faq;
                wizRenderFaqs();
            }
            if (data.reviews && Array.isArray(data.reviews)) {
                window._wizardReviews = data.reviews;
                wizRenderReviews();
            }

            showToast('[OK] AI Magic applied! Description, features, FAQ, and reviews updated.');
        } else {
            showToast('[X] AI Error: ' + (data.detail || 'Generation failed'));
        }
    } catch (e) {
        showToast('[X] Network error');
    } finally {
        btn.innerHTML = oldText;
        btn.disabled = false;
    }
};
if (typeof revokeVoucher !== 'undefined') window.revokeVoucher = revokeVoucher;
if (typeof adminAdjustWallet !== 'undefined') window.adminAdjustWallet = adminAdjustWallet;
if (typeof showVoucherCreateModal !== 'undefined') window.showVoucherCreateModal = showVoucherCreateModal;
if (typeof saveVoucher !== 'undefined') window.saveVoucher = saveVoucher;
if (typeof showBulkGenerateModal !== 'undefined') window.showBulkGenerateModal = showBulkGenerateModal;
if (typeof generateBulkVouchers !== 'undefined') window.generateBulkVouchers = generateBulkVouchers;

// Legacy Telegram Hub buttons still exist in the template for older admin
// sessions. Keep them harmless instead of letting one missing handler break clicks.
window.refreshTgHub = window.refreshTgHub || function() {
    showToast('Telegram Hub is currently handled by WhatsApp/Email login flows.');
};
window.toggleTgAutoVerify = window.toggleTgAutoVerify || function() {
    showToast('Telegram auto-verify is not active on this build.');
};
