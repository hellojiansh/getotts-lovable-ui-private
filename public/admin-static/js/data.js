/* ============================================
   GetOTTs — Product Data Layer v7 (Cached + Fallback)
   Primary: Fetches from Supabase API
   Fallback: Built-in catalog if API is down or empty
   Session-cached to reduce Supabase egress.
   ============================================ */

// Hardcoded fallback catalog — used when DB is empty or API unreachable
const FALLBACK_PRODUCTS = [
    // === STREAMING ===
    {
        id: 'netflix', name: 'Netflix', category: 'streaming',
        img: 'assets/images/netflix.webp', emoji: '🎬',
        description: 'Stream unlimited movies & TV shows', isHot: true,
        gradient: 'linear-gradient(135deg, #e50914, #b20710)',
        features: {
            shared: ['1 Profile Access', 'Full HD Streaming', 'All Content Library', 'Instant Delivery'],
            personal: ['Own Account', '4K + HDR + Dolby', 'All Profiles', 'On Your Number']
        },
        variants: [
            { sku: 'netflix-shared-1080p-1m',  accessType: 'shared',   quality: '1080p', duration: 1,  durationLabel: '1 Month',   price: 99,   originalPrice: 649,  stock: 23 },
            { sku: 'netflix-shared-1080p-3m',  accessType: 'shared',   quality: '1080p', duration: 3,  durationLabel: '3 Months',  price: 269,  originalPrice: 1947, stock: 15 },
            { sku: 'netflix-shared-1080p-6m',  accessType: 'shared',   quality: '1080p', duration: 6,  durationLabel: '6 Months',  price: 499,  originalPrice: 3894, stock: 10 },
            { sku: 'netflix-shared-1080p-12m', accessType: 'shared',   quality: '1080p', duration: 12, durationLabel: '1 Year',    price: 899,  originalPrice: 7788, stock: 5  },
            { sku: 'netflix-personal-4k-1m',   accessType: 'personal', quality: '4K',    duration: 1,  durationLabel: '1 Month',   price: 299,  originalPrice: 649,  stock: 10 },
            { sku: 'netflix-personal-4k-3m',   accessType: 'personal', quality: '4K',    duration: 3,  durationLabel: '3 Months',  price: 799,  originalPrice: 1947, stock: 8  },
            { sku: 'netflix-personal-4k-6m',   accessType: 'personal', quality: '4K',    duration: 6,  durationLabel: '6 Months',  price: 1399, originalPrice: 3894, stock: 5  },
            { sku: 'netflix-personal-4k-12m',  accessType: 'personal', quality: '4K',    duration: 12, durationLabel: '1 Year',    price: 2499, originalPrice: 7788, stock: 3  },
        ],
    },
    {
        id: 'hotstar', name: 'Disney+ Hotstar', category: 'streaming',
        img: 'assets/images/hotstar.webp', emoji: '⭐',
        description: 'Cricket, Marvel, Disney — all live', isHot: true,
        gradient: 'linear-gradient(135deg, #1f2c93, #09162a)',
        features: {
            shared: ['Super Plan Access', 'All Sports Live', 'Full Content Library', 'Instant Setup'],
            personal: ['Premium Plan', '4K Streaming', 'All Devices', 'On Your Number']
        },
        variants: [
            { sku: 'hotstar-shared-1m',    accessType: 'shared',   quality: null, duration: 1,  durationLabel: '1 Month',  price: 69,   originalPrice: 299,  stock: 50 },
            { sku: 'hotstar-shared-3m',    accessType: 'shared',   quality: null, duration: 3,  durationLabel: '3 Months', price: 179,  originalPrice: 897,  stock: 35 },
            { sku: 'hotstar-shared-12m',   accessType: 'shared',   quality: null, duration: 12, durationLabel: '1 Year',   price: 549,  originalPrice: 1499, stock: 20 },
            { sku: 'hotstar-personal-1m',  accessType: 'personal', quality: null, duration: 1,  durationLabel: '1 Month',  price: 199,  originalPrice: 299,  stock: 25 },
            { sku: 'hotstar-personal-12m', accessType: 'personal', quality: null, duration: 12, durationLabel: '1 Year',   price: 999,  originalPrice: 1499, stock: 10 },
        ],
    },
    {
        id: 'jiocinema', name: 'JioCinema Premium', category: 'streaming',
        img: 'assets/images/jiocinema.webp', emoji: '🎥',
        description: 'HBO, Peacock & live sports', isHot: false,
        gradient: 'linear-gradient(135deg, #e8197f, #b01468)',
        features: { shared: ['Premium Content', 'HBO Originals', 'Live Sports', 'Instant Access'] },
        variants: [
            { sku: 'jio-shared-1m',  accessType: 'shared', quality: null, duration: 1,  durationLabel: '1 Month',  price: 49,  originalPrice: 149, stock: 40 },
            { sku: 'jio-shared-3m',  accessType: 'shared', quality: null, duration: 3,  durationLabel: '3 Months', price: 129, originalPrice: 447, stock: 25 },
            { sku: 'jio-shared-12m', accessType: 'shared', quality: null, duration: 12, durationLabel: '1 Year',   price: 399, originalPrice: 999, stock: 15 },
        ],
    },
    {
        id: 'zee5', name: 'Zee5 Premium', category: 'streaming',
        img: 'assets/images/zee5.webp', emoji: '📺',
        description: 'Bollywood, originals & live TV', isHot: false,
        gradient: 'linear-gradient(135deg, #8232be, #5b1c91)',
        features: { shared: ['All Premium Content', 'Live TV Channels', 'Downloading', 'Ad-Free'] },
        variants: [
            { sku: 'zee5-shared-1m',  accessType: 'shared', quality: null, duration: 1,  durationLabel: '1 Month',  price: 49,  originalPrice: 149, stock: 35 },
            { sku: 'zee5-shared-3m',  accessType: 'shared', quality: null, duration: 3,  durationLabel: '3 Months', price: 119, originalPrice: 447, stock: 20 },
            { sku: 'zee5-shared-12m', accessType: 'shared', quality: null, duration: 12, durationLabel: '1 Year',   price: 349, originalPrice: 999, stock: 12 },
        ],
    },
    {
        id: 'sonyliv', name: 'SonyLIV Premium', category: 'streaming',
        img: 'assets/images/sonyliv.webp', emoji: '📡',
        description: 'KBC, UEFA & Sony originals', isHot: false,
        gradient: 'linear-gradient(135deg, #000000, #333333)',
        features: { shared: ['All Premium Content', 'Live Sports', 'Sony Originals', 'Ad-Free'] },
        variants: [
            { sku: 'sonyliv-shared-1m',  accessType: 'shared', quality: null, duration: 1,  durationLabel: '1 Month',  price: 59,  originalPrice: 299, stock: 30 },
            { sku: 'sonyliv-shared-6m',  accessType: 'shared', quality: null, duration: 6,  durationLabel: '6 Months', price: 299, originalPrice: 699, stock: 18 },
            { sku: 'sonyliv-shared-12m', accessType: 'shared', quality: null, duration: 12, durationLabel: '1 Year',   price: 499, originalPrice: 999, stock: 10 },
        ],
    },
    {
        id: 'apple-tv', name: 'Apple TV+', category: 'streaming',
        img: 'assets/images/appletv.webp', emoji: '🍎',
        description: 'Premium Apple originals', isHot: false,
        gradient: 'linear-gradient(135deg, #2d2d2d, #1a1a1a)',
        features: { shared: ['All Apple Originals', '4K HDR', 'Family Sharing', 'Instant Access'] },
        variants: [
            { sku: 'appletv-shared-1m',  accessType: 'shared', quality: null, duration: 1,  durationLabel: '1 Month',  price: 69,  originalPrice: 199, stock: 25 },
            { sku: 'appletv-shared-6m',  accessType: 'shared', quality: null, duration: 6,  durationLabel: '6 Months', price: 349, originalPrice: 1194,stock: 15 },
            { sku: 'appletv-shared-12m', accessType: 'shared', quality: null, duration: 12, durationLabel: '1 Year',   price: 599, originalPrice: 2388,stock: 8  },
        ],
    },
    // === MUSIC ===
    {
        id: 'spotify', name: 'Spotify Premium', category: 'music',
        img: 'assets/images/spotify.webp', emoji: '🎵',
        description: 'Ad-free music, offline downloads', isHot: true,
        gradient: 'linear-gradient(135deg, #1db954, #148a3c)',
        features: {
            shared: ['Ad-Free Listening', 'Offline Downloads', 'High Quality Audio', 'Instant Activation'],
            personal: ['Own Account', 'All Devices', 'Spotify Connect', 'On Your Number']
        },
        variants: [
            { sku: 'spotify-shared-1m',    accessType: 'shared',   quality: null, duration: 1,  durationLabel: '1 Month',  price: 59,   originalPrice: 119,  stock: 60 },
            { sku: 'spotify-shared-3m',    accessType: 'shared',   quality: null, duration: 3,  durationLabel: '3 Months', price: 149,  originalPrice: 357,  stock: 40 },
            { sku: 'spotify-shared-12m',   accessType: 'shared',   quality: null, duration: 12, durationLabel: '1 Year',   price: 499,  originalPrice: 1428, stock: 20 },
            { sku: 'spotify-personal-1m',  accessType: 'personal', quality: null, duration: 1,  durationLabel: '1 Month',  price: 99,   originalPrice: 119,  stock: 30 },
            { sku: 'spotify-personal-3m',  accessType: 'personal', quality: null, duration: 3,  durationLabel: '3 Months', price: 269,  originalPrice: 357,  stock: 20 },
            { sku: 'spotify-personal-12m', accessType: 'personal', quality: null, duration: 12, durationLabel: '1 Year',   price: 899,  originalPrice: 1428, stock: 10 },
        ],
    },
    {
        id: 'youtube-premium', name: 'YouTube Premium', category: 'music',
        img: 'assets/images/youtube.webp', emoji: '▶️',
        description: 'Ad-free YouTube + YouTube Music', isHot: false,
        gradient: 'linear-gradient(135deg, #ff0000, #cc0000)',
        features: {
            shared: ['No Ads on YouTube', 'YouTube Music', 'Background Play', 'Downloads'],
            personal: ['Own Account', 'All Features', 'YouTube Music Premium', 'On Your Number']
        },
        variants: [
            { sku: 'yt-shared-1m',    accessType: 'shared',   quality: null, duration: 1,  durationLabel: '1 Month',  price: 49,   originalPrice: 149,  stock: 40 },
            { sku: 'yt-shared-3m',    accessType: 'shared',   quality: null, duration: 3,  durationLabel: '3 Months', price: 129,  originalPrice: 447,  stock: 25 },
            { sku: 'yt-shared-12m',   accessType: 'shared',   quality: null, duration: 12, durationLabel: '1 Year',   price: 399,  originalPrice: 1788, stock: 15 },
            { sku: 'yt-personal-1m',  accessType: 'personal', quality: null, duration: 1,  durationLabel: '1 Month',  price: 129,  originalPrice: 189,  stock: 20 },
            { sku: 'yt-personal-12m', accessType: 'personal', quality: null, duration: 12, durationLabel: '1 Year',   price: 1199, originalPrice: 2268, stock: 8  },
        ],
    },
    // === AI TOOLS ===
    {
        id: 'chatgpt', name: 'ChatGPT Plus', category: 'ai',
        img: 'assets/images/chatgpt.webp', emoji: '🤖',
        description: 'GPT-4o, DALL-E, plugins & more', isHot: true,
        gradient: 'linear-gradient(135deg, #10a37f, #0d7a5f)',
        features: { shared: ['GPT-4o Access', 'DALL-E 3', 'Plugins & GPTs', 'Priority Speed'] },
        variants: [
            { sku: 'chatgpt-shared-1m',  accessType: 'shared', quality: null, duration: 1,  durationLabel: '1 Month',  price: 199, originalPrice: 1950, stock: 30 },
            { sku: 'chatgpt-shared-3m',  accessType: 'shared', quality: null, duration: 3,  durationLabel: '3 Months', price: 549, originalPrice: 5850, stock: 20 },
            { sku: 'chatgpt-shared-12m', accessType: 'shared', quality: null, duration: 12, durationLabel: '1 Year',   price: 1799,originalPrice: 23400,stock: 8  },
        ],
    },
    {
        id: 'midjourney', name: 'Midjourney', category: 'ai',
        img: 'assets/images/midjourney.png', emoji: '🎨',
        description: 'AI art & image generation', isHot: false,
        gradient: 'linear-gradient(135deg, #3a1c71, #d76d77)',
        features: { shared: ['Unlimited Generations', 'Fast Mode', 'Commercial License', 'Discord Access'] },
        variants: [
            { sku: 'midjourney-shared-1m',  accessType: 'shared', quality: null, duration: 1,  durationLabel: '1 Month',  price: 299,  originalPrice: 950,  stock: 15 },
            { sku: 'midjourney-shared-3m',  accessType: 'shared', quality: null, duration: 3,  durationLabel: '3 Months', price: 799,  originalPrice: 2850, stock: 10 },
        ],
    },
    {
        id: 'perplexity', name: 'Perplexity Pro', category: 'ai',
        img: 'assets/images/perplexity.png', emoji: '🔍',
        description: 'Advanced AI search engine', isHot: false,
        gradient: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
        features: { shared: ['Unlimited Pro Searches', 'GPT-4 + Claude', 'File Analysis', 'API Access'] },
        variants: [
            { sku: 'perplexity-shared-1m',  accessType: 'shared', quality: null, duration: 1,  durationLabel: '1 Month',  price: 199, originalPrice: 1700, stock: 20 },
            { sku: 'perplexity-shared-3m',  accessType: 'shared', quality: null, duration: 3,  durationLabel: '3 Months', price: 499, originalPrice: 5100, stock: 12 },
        ],
    },
    // === VPN ===
    {
        id: 'nordvpn', name: 'NordVPN', category: 'vpn',
        img: 'assets/images/nordvpn.webp', emoji: '🔒',
        description: 'Ultra-secure VPN, 6000+ servers', isHot: false,
        gradient: 'linear-gradient(135deg, #4687ff, #305cc3)',
        features: { shared: ['6000+ Servers', 'No-Log Policy', 'Kill Switch', '6 Devices'] },
        variants: [
            { sku: 'nordvpn-shared-1m',  accessType: 'shared', quality: null, duration: 1,  durationLabel: '1 Month',  price: 99,  originalPrice: 999, stock: 25 },
            { sku: 'nordvpn-shared-6m',  accessType: 'shared', quality: null, duration: 6,  durationLabel: '6 Months', price: 449, originalPrice: 5994,stock: 15 },
            { sku: 'nordvpn-shared-12m', accessType: 'shared', quality: null, duration: 12, durationLabel: '1 Year',   price: 799, originalPrice: 11988,stock: 10 },
        ],
    },
    // === GIFT CARDS ===
    {
        id: 'google-play', name: 'Google Play Gift Card', category: 'gift-cards',
        img: '', emoji: '🎁',
        description: 'Apps, games, movies & more', isHot: false,
        gradient: 'linear-gradient(135deg, #34a853, #0f9d58)',
        features: { shared: ['Instant Email Delivery', 'Use for Apps & Games', 'No Expiry', 'India Region'] },
        variants: [
            { sku: 'gplay-100', accessType: 'shared', quality: null, duration: 1, durationLabel: '₹100 Card', price: 85,  originalPrice: 100, stock: 50 },
            { sku: 'gplay-250', accessType: 'shared', quality: null, duration: 1, durationLabel: '₹250 Card', price: 215, originalPrice: 250, stock: 40 },
            { sku: 'gplay-500', accessType: 'shared', quality: null, duration: 1, durationLabel: '₹500 Card', price: 425, originalPrice: 500, stock: 30 },
        ],
    },
];

// Live product array — starts with fallback, replaced by API data if available
let PRODUCTS = [...FALLBACK_PRODUCTS];

// Catalog loading state for UI feedback
let _catalogLoaded = false;
let _catalogError = null;
let _catalogSyncPromise = null;
let _catalogHydratedFromCache = false;
let _catalogRefreshScheduled = false;
const CATALOG_CACHE_KEY = 'getotts_catalog_cache_v16_delete_product';
const CATALOG_CACHE_MAX_AGE = 2 * 60 * 1000;

function readCachedCatalog() {
    try {
        const raw = sessionStorage.getItem(CATALOG_CACHE_KEY) || localStorage.getItem(CATALOG_CACHE_KEY);
        if (!raw) return null;
        const cached = JSON.parse(raw);
        if (!cached || !Array.isArray(cached.products)) return null;
        if (cached.savedAt && Date.now() - cached.savedAt > CATALOG_CACHE_MAX_AGE) return null;
        return cached.products.filter(p => p && p.id && p.name && Array.isArray(p.variants) && p.variants.length > 0);
    } catch (_) {
        return null;
    }
}

function writeCachedCatalog(products) {
    try {
        const payload = JSON.stringify({ savedAt: Date.now(), products: products || [] });
        sessionStorage.setItem(CATALOG_CACHE_KEY, payload);
        localStorage.setItem(CATALOG_CACHE_KEY, payload);
    } catch (_) {}
}

const _cachedCatalog = readCachedCatalog();
if (_cachedCatalog && _cachedCatalog.length > 0) {
    PRODUCTS = _cachedCatalog;
    _catalogLoaded = true;
    _catalogHydratedFromCache = true;
}

/**
 * Fetches the live catalog from the backend API.
 * ARCHITECT MODE: Database is the ONLY source of truth.
 * NO localStorage, NO fallback merging, NO stale cache.
 */
function scheduleCatalogRefresh() {
    if (_catalogRefreshScheduled) return;
    _catalogRefreshScheduled = true;
    const run = () => syncCatalogFromCloud({ force: true }).catch(e => console.warn('[Catalog] Deferred sync failed:', e));
    if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(run, { timeout: 3500 });
    } else {
        setTimeout(run, 1800);
    }
}

async function syncCatalogFromCloud(options = {}) {
    if (_catalogHydratedFromCache && !options.force) {
        scheduleCatalogRefresh();
        return Promise.resolve(PRODUCTS);
    }
    if (_catalogSyncPromise) return _catalogSyncPromise;

    _catalogSyncPromise = (async () => {
    try {
        const API_BASE = (window.GETOTTS_CONFIG && window.GETOTTS_CONFIG.API_BASE) || '/api/v1';
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const catalogUrl = API_BASE + '/public/catalog?v=20260604-deleteproduct1';
        const res = await fetch(catalogUrl, {
            signal: controller.signal,
            cache: 'no-store',
            headers: { 'Cache-Control': 'no-cache' }
        });
        clearTimeout(timeoutId);
        
        if (!res.ok) throw new Error(`API returned ${res.status}`);
        const data = await res.json();

        if (data.success && data.catalog && data.catalog.length > 0) {
            const validCatalog = data.catalog.filter(p => p && p.id && p.name && Array.isArray(p.variants) && p.variants.length > 0);
            // STRICT: Only use what the database returned. No fallback merge.
            PRODUCTS = validCatalog;
            writeCachedCatalog(PRODUCTS);
            _catalogHydratedFromCache = true;

            _catalogLoaded = true;
            _catalogError = null;
            console.log(`[Catalog] Loaded ${PRODUCTS.length} products from database (strict mode).`);
        } else {
            // DB is genuinely empty — show empty state, do NOT inject fallback
            PRODUCTS = [];
            writeCachedCatalog(PRODUCTS);
            _catalogHydratedFromCache = false;
            _catalogLoaded = true;
            _catalogError = null;
            console.log('[Catalog] Database is empty. No fallback injection.');
        }

    } catch (_catalogError) {
        console.warn('[Catalog] API unreachable, keeping current state:', _catalogError);
    } finally {
        // Notify UI to re-render
        window.dispatchEvent(new CustomEvent('catalogUpdated', { detail: { products: PRODUCTS } }));
    }
    })();

    try {
        return await _catalogSyncPromise;
    } finally {
        _catalogSyncPromise = null;
    }
}



/* ================================================
   HELPER FUNCTIONS
   ================================================ */

function getEffectiveRegionLock(product) {
    const explicit = String(product?.region_lock || 'all').toLowerCase();
    const key = `${product?.slug || ''} ${product?.id || ''} ${product?.name || ''} ${product?.description || ''}`.toLowerCase();

    // Amazon Prime "All Benefits" includes India shopping/delivery benefits, so
    // keep it India-only even if an old catalog row is still marked as "all".
    if (
        key.includes('amazon-prime-streaming') ||
        (key.includes('amazon prime') && (key.includes('all benefits') || key.includes('shopping')))
    ) {
        return 'india';
    }

    return explicit;
}

function isProductVisibleForCurrentRegion(product) {
    const lock = getEffectiveRegionLock(product);
    if (lock === 'india' && _currentCurrency === 'USD') return false;
    if (lock === 'international' && _currentCurrency === 'INR') return false;
    return true;
}

if (typeof window !== 'undefined') {
    window.getEffectiveRegionLock = getEffectiveRegionLock;
    window.isProductVisibleForCurrentRegion = isProductVisibleForCurrentRegion;
}

/** Get all active products from the live catalog, filtered by region lock */
function getAllProducts() {
    const isAdminSurface = typeof window !== 'undefined' && /admin/.test(window.location.pathname);
    return PRODUCTS.filter(p => p.isActive !== false && (isAdminSurface || isProductVisibleForCurrentRegion(p)));
}

function getProductsByCategory(category) {
    return getAllProducts().filter(p => p.category === category);
}

function getProductById(id) {
    return getAllProducts().find(p => p.id === id);
}

function getDefaultVariant(product) {
    if (!product || !product.variants || product.variants.length === 0) {
        return { sku: (product ? product.id : 'unknown') + '-base', accessType: 'shared', quality: null, duration: 1, durationLabel: '1 Month', price: 99, originalPrice: 199, stock: 10 };
    }
    return product.variants[0];
}

function getAccessTypes(product) {
    if (!product || !product.variants) return [];
    const types = [...new Set(product.variants.map(v => v.accessType))].filter(Boolean);
    return types.length ? types : ['shared'];
}

function getQualities(product, accessType) {
    if (!product || !product.variants) return [];
    return [...new Set(product.variants.filter(v => !accessType || v.accessType === accessType).map(v => v.quality))].filter(Boolean);
}

function getDurations(product, accessType, quality) {
    if (!product || !product.variants) return [];
    return product.variants
        .filter(v => (!accessType || v.accessType === accessType) && (!quality || v.quality === quality))
        .map(v => v.duration)
        .filter((v, i, a) => a.indexOf(v) === i)
        .sort((a, b) => a - b);
}

function getVariant(sku) {
    for (const p of getAllProducts()) {
        if (p.variants) {
            const v = p.variants.find(vx => vx.sku === sku);
            if (v) return { product: p, variant: v };
        }
        // Fallback for custom products without defined variants that use the '-base' SKU
        if (sku === p.id + '-base') {
            return { product: p, variant: getDefaultVariant(p) };
        }
    }
    return null;
}

function findVariant(product, accessType, quality, months) {
    if (!product || !product.variants) return null;
    return product.variants.find(v =>
        (!accessType || v.accessType === accessType) &&
        (!quality || v.quality === quality) &&
        (!months || v.duration == months)
    ) || product.variants[0];
}

function getDiscountLevel(price) {
    if (price >= 1500) return 'mega';
    if (price >= 500) return 'super';
    return 'good';
}

try {
    const cachedSettings = JSON.parse(localStorage.getItem('getotts_public_settings') || '{}');
    if (cachedSettings && cachedSettings.product_featured_positions) {
        window.GETOTTS_SETTINGS = cachedSettings;
        window.GETOTTS_FEATURED_POSITIONS = cachedSettings.product_featured_positions;
    }
} catch (_) {}

/**
 * Sync global site settings from the API
 */
async function syncGlobalSettings() {
    try {
        const API = (window.GETOTTS_CONFIG && window.GETOTTS_CONFIG.API_BASE) || 'https://api.getotts.com/api/v1';
        const resp = await fetch(`${API}/public/settings`);
        const data = await resp.json();
        
        if (data.success && data.settings) {
            const s = data.settings;
            console.log('[Settings] Sync success:', s);
            window.GETOTTS_SETTINGS = s;
            window.GETOTTS_FEATURED_POSITIONS = s.product_featured_positions || {};
            try { localStorage.setItem('getotts_public_settings', JSON.stringify(s)); } catch (_) {}
            window.dispatchEvent(new CustomEvent('getotts:settingsUpdated', { detail: { settings: s } }));
            
            // Update global config
            if (window.GETOTTS_CONFIG) {
                if (s.site_name) window.GETOTTS_CONFIG.SITE_NAME = s.site_name;
                if (s.whatsapp) window.GETOTTS_CONFIG.WHATSAPP = s.whatsapp;
                if (s.upi_id) window.GETOTTS_CONFIG.UPI_ID = s.upi_id;
            }
            
            // Update UI elements
            if (s.site_name) {
                document.querySelectorAll('#siteLogoName, .footer-logo-name').forEach(el => el.textContent = s.site_name);
                if (!window.location.pathname.includes('product')) {
                    document.title = `${s.site_name} — Premium OTT at Wholesale Prices`;
                }
            }
            
            if (s.announcement) {
                const notice = document.getElementById('siteAnnouncement');
                if (notice) notice.innerHTML = s.announcement;
            }
            
            if (s.whatsapp) {
                document.querySelectorAll('a[href*="wa.me"], #heroWhatsAppLink').forEach(link => {
                    link.href = `https://wa.me/${s.whatsapp.replace(/\+/g, '')}`;
                });
            }
            
            return s;
        }
    } catch (err) {
        console.warn('[Settings] Sync failed, keeping defaults:', err);
    }
    return null;
}

// --- Geo & Currency Logic ---
let _currentRegion = 'IN';
let _currentCurrency = 'INR';
let _geoDetectPromise = null;

async function detectGeoAndCurrency() {
    if (typeof window !== 'undefined' && /admin/.test(window.location.pathname)) {
        _currentRegion = 'IN';
        _currentCurrency = 'INR';
        return;
    }
    // Always detect fresh from IP — ensures VPN/network changes are picked up immediately
    // Clear any stale storage from old implementations
    localStorage.removeItem('getotts_currency');
    localStorage.removeItem('getotts_region');
    localStorage.removeItem('getotts_geo_timestamp');
    localStorage.removeItem('getotts_currency_explicit');
    sessionStorage.removeItem('getotts_currency');
    sessionStorage.removeItem('getotts_region');

    // Compatible timeout helper (works on all browsers, unlike AbortSignal.timeout)
    function fetchWithTimeout(url, ms) {
        var controller = new AbortController();
        var timer = setTimeout(function() { controller.abort(); }, ms);
        return fetch(url, { signal: controller.signal }).finally(function() { clearTimeout(timer); });
    }

    let countryCode = 'IN'; // Default fallback = India
    let geoSuccess = false;

    // Service 1: Cloudflare Trace (Fastest, unblockable, works perfectly with VPNs)
    try {
        var resp = await fetchWithTimeout('https://1.1.1.1/cdn-cgi/trace', 3000);
        if (resp.ok) {
            var text = await resp.text();
            var match = text.match(/loc=([A-Z]{2})/);
            if (match && match[1]) {
                countryCode = match[1];
                geoSuccess = true;
            }
        }
    } catch (e1) {
        console.warn('[GEO] CF trace failed');
    }

    // Service 2: api.country.is (Fallback 1)
    if (!geoSuccess) {
        try {
            var resp2 = await fetchWithTimeout('https://api.country.is/', 3000);
            if (resp2.ok) {
                var data = await resp2.json();
                if (data.country) {
                    countryCode = data.country;
                    geoSuccess = true;
                }
            }
        } catch (e2) {
            console.warn('[GEO] api.country.is failed');
        }
    }

    // Service 3: ipapi.co (Fallback 2)
    if (!geoSuccess) {
        try {
            var resp3 = await fetchWithTimeout('https://ipapi.co/country/', 3000);
            if (resp3.ok) {
                var text = (await resp3.text()).trim();
                if (text && text.length === 2) {
                    countryCode = text;
                    geoSuccess = true;
                }
            }
        } catch (e3) {
            console.warn('[GEO] ipapi.co failed');
        }
    }

    if (!geoSuccess) {
        console.error('[GEO] All services failed — defaulting to INR');
    }

    if (countryCode === 'IN') {
        _currentRegion = 'IN';
        _currentCurrency = 'INR';
    } else {
        _currentRegion = 'GLOBAL';
        _currentCurrency = 'USD';
    }
    
    console.log('[GEO] Detected: ' + countryCode + ' | Currency: ' + _currentCurrency);
}

function getCurrentRegion() {
    return _currentRegion;
}

function getCurrentCurrency() {
    return _currentCurrency;
}

function getGeoReadyPromise() {
    if (!_geoDetectPromise) {
        _geoDetectPromise = detectGeoAndCurrency();
    }
    return _geoDetectPromise;
}

window.getottsGeoReady = getGeoReadyPromise;

function getCurrencySymbol() {
    return _currentCurrency === 'USD' ? '$' : '₹';
}

const INR_PER_USD = 85;

function getDualPriceText(valueInr, valueUsd) {
    var inr = parseFloat(valueInr) || 0;
    var usd = valueUsd !== undefined && valueUsd !== null && valueUsd !== ''
        ? parseFloat(valueUsd) || 0
        : inr / INR_PER_USD;
    return '₹' + inr.toLocaleString('en-IN') + ' / $' + usd.toFixed(2);
}

function getDualVariantPrice(variant) {
    if (!variant) return '₹0 / $0.00';
    return getDualPriceText(variant.price, variant.price_usd);
}

function getDualVariantOriginalPrice(variant) {
    if (!variant) return '';
    var inr = variant.originalPrice || variant.original_price;
    var usd = variant.original_price_usd;
    if (!inr && !usd) return '';
    return getDualPriceText(inr || 0, usd || null);
}

function getDualMoneyHTML(valueInr, valueUsd, className) {
    return '<span class="' + (className || 'money-dual') + '"><strong>' + getDualPriceText(valueInr, valueUsd).replace(' / ', '</strong><small>') + '</small></span>';
}

function getFormattedPrice(variant) {
    if (!variant) return '0';
    if (_currentCurrency === 'USD') {
        var usd = parseFloat(variant.price_usd) || 0;
        // USD/USDT pricing is maintained separately from INR pricing.
        // Do not auto-convert INR here; international customers can have
        // different sale prices.
        if (usd === 0 && variant.price) usd = parseFloat(variant.price) / INR_PER_USD;
        return usd.toFixed(2);
    }
    return variant.price || 0;
}

function getFormattedOriginalPrice(variant) {
    if (!variant) return null;
    if (_currentCurrency === 'USD') {
        var val = parseFloat(variant.original_price_usd);
        if (!isNaN(val) && val > 0) return val.toFixed(2);
        // fallback: convert INR original price
        var inrOrig = parseFloat(variant.originalPrice || variant.original_price) || 0;
        if (inrOrig > 0) return (inrOrig / 85).toFixed(2);
        return null;
    }
    return variant.originalPrice || variant.original_price || null;
}

/** Returns the numeric price for the current currency (for calculations, not display) */
function getVariantPrice(variant) {
    if (!variant) return 0;
    if (_currentCurrency === 'USD') {
        var usd = parseFloat(variant.price_usd) || 0;
        if (usd === 0 && variant.price) usd = parseFloat(variant.price) / INR_PER_USD;
        return usd;
    }
    return parseFloat(variant.price) || 0;
}

/** Returns the numeric original price for the current currency (for calculations) */
function getVariantOriginalPrice(variant) {
    if (!variant) return 0;
    if (_currentCurrency === 'USD') {
        var usd = parseFloat(variant.original_price_usd) || 0;
        if (usd === 0) {
            var inrOrig = parseFloat(variant.originalPrice || variant.original_price) || 0;
            if (inrOrig > 0) usd = inrOrig / 85;
        }
        return usd;
    }
    return parseFloat(variant.originalPrice || variant.original_price) || 0;
}

function changeStorefrontCurrency(currency) {
    if (currency === 'USD' || currency === 'INR') {
        _currentCurrency = currency;
        _currentRegion = currency === 'INR' ? 'IN' : 'GLOBAL';
        sessionStorage.setItem('getotts_region', _currentRegion);
        sessionStorage.setItem('getotts_currency', _currentCurrency);
        
        // Re-render storefront
        if (typeof renderAllProducts === 'function') renderAllProducts();
        if (typeof updateCartCount === 'function') updateCartCount();
        if (typeof initComboBuilder === 'function') initComboBuilder();
        
        // Re-render product detail page if on one
        if (typeof window._refreshProductPricing === 'function') window._refreshProductPricing();
        
        console.log(`[Currency] Switched to ${currency}`);
    }
}

// Initial Sync
document.addEventListener('DOMContentLoaded', async () => {
    // Start product/settings refresh immediately; do not block cards on geo lookup.
    syncCatalogFromCloud();
    syncGlobalSettings();

    if (!(typeof window !== 'undefined' && /admin/.test(window.location.pathname))) {
        await getGeoReadyPromise();
    }
    
    // Update cart UI now that currency is known
    if (typeof updateCartCount === 'function') updateCartCount();
    if (typeof renderAllProducts === 'function') renderAllProducts();
});
