/* ============================================
   GetOTTs v4 - Premium White + Gold Design
   Variant-aware Product Cards + Cart + Animations
   ============================================ */

const REVIEWS = [
    { name: 'Rahul V.', initial: 'R', platform: 'Netflix', stars: 5, text: 'Amazing service! Got my credentials within seconds. Highly recommended.' },
    { name: 'Ankita P.', initial: 'A', platform: 'Spotify', stars: 5, text: 'Best prices in India. Support is very responsive on WhatsApp.' },
    { name: 'Manoj S.', initial: 'M', platform: 'ChatGPT', stars: 5, text: 'Finally a trusted site for AI tool subscriptions. Works perfectly.' }
];

const HEALTH_DATA = [
    { name: 'Netflix', icon: 'clapperboard', status: 'online' },
    { name: 'Prime Video', icon: 'package', status: 'online' },
    { name: 'Spotify', icon: 'music-2', status: 'online' },
    { name: 'ChatGPT', icon: 'bot', status: 'online' }
];

const LIVE_PURCHASES = [
    { name: 'Aman', city: 'Delhi', product: 'Netflix Premium', time: '2m ago' },
    { name: 'Priya', city: 'Mumbai', product: 'Spotify Premium', time: '5m ago' },
    { name: 'Suresh', city: 'Bangalore', product: 'ChatGPT Plus', time: '8m ago' },
    { name: 'Neha', city: 'Pune', product: 'Amazon Prime', time: '12m ago' }
];

const TOP_DEALS_CACHE = {
    india: { products: null, promise: null, failed: false, loadedAt: 0 },
    global: { products: null, promise: null, failed: false, loadedAt: 0 }
};

const BOOT_TOP_DEAL_ORDER = {
    india: [
        'netflix-streaming-subscription',
        'google-gemini',
        'spotify-premium',
        'disney-hotstar',
        'amazon-prime-streaming',
        'canva-invite'
    ],
    global: [
        'netflix-streaming-subscription',
        'spotify-premium',
        'prime-video-global',
        'google-gemini',
        'canva-invite',
        'crunchyroll'
    ]
};

const PRODUCT_RENDER_STATE = {
    hotDeals: '',
    allProducts: '',
    categories: {},
    catalog: ''
};

let _lucideIconFrame = 0;

function scheduleStoreIcons(root = document) {
    if (!window.lucide || !window.lucide.createIcons) return;
    if (_lucideIconFrame) return;
    _lucideIconFrame = requestAnimationFrame(() => {
        _lucideIconFrame = 0;
        try {
            window.lucide.createIcons({ attrs: { 'stroke-width': 2 } });
        } catch (_) {
            window.lucide.createIcons();
        }
    });
}

function getProductsRenderSignature(products = []) {
    return products.map(product => {
        const variants = Array.isArray(product.variants) ? product.variants : [];
        return [
            product.id,
            product.slug,
            product.name,
            product.img || product.image || product.logo || '',
            product.isActive,
            product.isHot,
            product.featuredPosition || product.featured_position || '',
            variants.map(v => [
                v.sku,
                v.price,
                v.originalPrice || v.original_price || '',
                typeof getVariantAccessType === 'function' ? getVariantAccessType(v) : (v.accessType || v.access_type || ''),
                v.quality || '',
                typeof getVariantDurationMonths === 'function' ? getVariantDurationMonths(v) : (v.duration || v.duration_months || ''),
                typeof getVariantDurationLabel === 'function' ? getVariantDurationLabel(v) : (v.durationLabel || v.duration_label || '')
            ].join(':')).join('|')
        ].join('~');
    }).join('||');
}

function setGridHtmlIfChanged(grid, html, signature, stateKey) {
    if (!grid) return false;
    if (PRODUCT_RENDER_STATE[stateKey] === signature && grid.dataset.renderSignature === signature) {
        return false;
    }
    grid.innerHTML = html;
    grid.dataset.renderSignature = signature;
    PRODUCT_RENDER_STATE[stateKey] = signature;
    requestAnimationFrame(() => grid.classList.add('products-ready'));
    return true;
}

function getMarketingCurrency() {
    return typeof getCurrentCurrency === 'function' ? getCurrentCurrency() : (window._currentCurrency || 'INR');
}

function trackStorefrontEvent(eventName, product, variant, extra = {}) {
    if (typeof window.getottsTrack !== 'function') return;
    const value = variant
        ? (typeof getVariantPrice === 'function' ? getVariantPrice(variant) : parseFloat(variant.price || 0))
        : parseFloat(extra.value || 0);
    const params = Object.assign({
        content_name: product?.name || extra.content_name || '',
        content_ids: [variant?.sku || product?.slug || product?.id || extra.content_id || ''].filter(Boolean),
        content_type: 'product',
        currency: getMarketingCurrency()
    }, extra);
    if (Number.isFinite(value) && value > 0) params.value = value;
    window.getottsTrack(eventName, params);
}

function getStoreApiBase() {
    return (window.GETOTTS_CONFIG && window.GETOTTS_CONFIG.API_BASE) || '/api/v1';
}

function getTopDealsMarket() {
    const currency = typeof getCurrentCurrency === 'function' ? getCurrentCurrency() : (window._currentCurrency || 'INR');
    return currency === 'USD' ? 'global' : 'india';
}

function resetTopDealsCache(market = null) {
    const markets = market ? [market] : ['india', 'global'];
    markets.forEach(name => {
        TOP_DEALS_CACHE[name] = { products: null, promise: null, failed: false, loadedAt: 0 };
    });
}

async function fetchMarketTopDeals(market = getTopDealsMarket(), force = false) {
    market = market === 'global' ? 'global' : 'india';
    const cache = TOP_DEALS_CACHE[market];
    if (!force && cache.products && Date.now() - cache.loadedAt < 2 * 60 * 1000) {
        return cache.products;
    }
    if (cache.promise && !force) return cache.promise;

    cache.promise = (async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2800);
        try {
            const url = `${getStoreApiBase()}/public/top-deals?market=${encodeURIComponent(market)}&limit=6&v=20260602-fastdefaults1`;
            const res = await fetch(url, {
                signal: controller.signal,
                cache: 'no-store',
                headers: { 'Cache-Control': 'no-cache' }
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success || !Array.isArray(data.products) || data.products.length === 0) {
                throw new Error(data.detail || data.message || 'Top Deals unavailable');
            }
            cache.products = data.products;
            cache.failed = false;
            cache.loadedAt = Date.now();
            return cache.products;
        } finally {
            clearTimeout(timeoutId);
            cache.promise = null;
        }
    })().catch(error => {
        cache.failed = true;
        console.warn('[TopDeals] API fallback:', error);
        throw error;
    });

    return cache.promise;
}

document.addEventListener('DOMContentLoaded', async () => {
    scheduleStoreIcons();

    // Header scroll effect
    const header = document.getElementById('header');
    let scrollTicking = false;
    const syncHeaderScroll = () => {
        if (header) header.classList.toggle('scrolled', window.scrollY > 20);
        scrollTicking = false;
    };
    window.addEventListener('scroll', () => {
        if (!scrollTicking) {
            window.requestAnimationFrame(syncHeaderScroll);
            scrollTicking = true;
        }
    }, { passive: true });
    syncHeaderScroll();

    // Update login/dashboard button immediately
    try { initHeader(); } catch(e) { console.warn('[INIT] initHeader error:', e); }

    // Listen before the background catalog refresh so updates never get missed.
    window.addEventListener('catalogUpdated', () => {
        const nextSignature = getProductsRenderSignature(getAllProducts());
        if (PRODUCT_RENDER_STATE.catalog === nextSignature) {
            console.log('[Storefront] Catalog sync returned same products. Keeping current grids.');
            return;
        }
        PRODUCT_RENDER_STATE.catalog = nextSignature;
        console.log('[Storefront] Catalog updated from background sync. Re-rendering changed grids...');
        // NOTE: Do NOT call renderNavigation() here.
        // The static HTML nav is the source of truth for categories.
        // This prevents the "glitch" where nav links randomly disappear.
        resetTopDealsCache();
        renderAllProducts();
        initComboBuilder();
        if (typeof updateCartCount === 'function') updateCartCount();
    });

    window.addEventListener('getotts:currencychange', () => {
        PRODUCT_RENDER_STATE.hotDeals = '';
        PRODUCT_RENDER_STATE.allProducts = '';
        PRODUCT_RENDER_STATE.categories = {};
        resetTopDealsCache();
        renderAllProducts();
        initComboBuilder();
        if (typeof updateCartCount === 'function') updateCartCount();
    });

    try { renderAllProducts(); } catch(e) { console.warn('[INIT] renderAllProducts error:', e); }
    try { initPlanSwitch(); } catch(e) {}
    try { initComboBuilder(); } catch(e) {}
    try { initStatusGrid(); } catch(e) {}
    try { initReviews(); } catch(e) {}
    try { initFAQ(); } catch(e) {}
    try { initSearch(); } catch(e) {}
    // try { initToast(); } catch(e) {}
    try { initLazyVideos(); } catch(e) {}
    try { initScrollAnimations(); } catch(e) {}

    // Initialize 3D Tilt effect for SaaS aesthetic
    try { initTiltEffect(); } catch(e) {}

    // Handle category scroll from URL (Search Redirection)
    const urlParams = new URLSearchParams(window.location.search);
    const catParam = urlParams.get('cat');
    if (catParam) {
        setTimeout(() => {
            const el = document.getElementById(catParam);
            if (el) el.scrollIntoView({ behavior: 'smooth' });
        }, 600);
    }

    // Refresh the live catalog in the background after the first product paint.
    try {
        if (typeof syncCatalogFromCloud === 'function') {
            const refresh = () => syncCatalogFromCloud().catch(e => console.warn('[INIT] Catalog sync error:', e));
            if (document.body?.classList.contains('home-page')) {
                ['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach(eventName => {
                    window.addEventListener(eventName, refresh, { once: true, passive: true });
                });
                setTimeout(refresh, 9500);
            } else if (typeof requestIdleCallback === 'function') {
                requestIdleCallback(refresh, { timeout: 3000 });
            } else {
                setTimeout(refresh, 1200);
            }
        }
    } catch(e) { console.warn('[INIT] Catalog sync error:', e); }
});

/** 
 * Dynamically render navigation links based on categories in the catalog
 */
function renderNavigation() {
    const nav = document.getElementById('mainNav');
    if (!nav) return;

    // Preserve the Search Box and other static links (About, etc.)
    const searchBox = document.getElementById('mobileSearchBox');
    
    // Core categories that MUST always be present
    const coreCats = ['streaming', 'music', 'ai-tools', 'vpn', 'gift-cards'];
    
    const allActive = getAllProducts();
    const dynamicCats = [...new Set(allActive.map(p => p.category))].filter(Boolean);
    
    // Combine core and dynamic, then deduplicate
    const combined = [...new Set([...coreCats, ...dynamicCats])];
    
    // Strict sorting based on user request
    const sortedCats = combined.sort((a, b) => {
        const order = ['streaming', 'music', 'ai', 'ai-tools', 'vpn', 'gift-cards'];
        const ia = order.indexOf(a);
        const ib = order.indexOf(b);
        if (ia !== -1 && ib !== -1) return ia - ib;
        if (ia !== -1) return -1;
        if (ib !== -1) return 1;
        return a.localeCompare(b);
    });

    let navHtml = searchBox ? searchBox.outerHTML : '';
    navHtml += getMobileProfileNavHtml();
    
    sortedCats.forEach(cat => {
        if (cat === 'ai') return; // Skip 'ai' if 'ai-tools' exists to avoid duplicates
        const label = cat === 'ai-tools' ? 'AI Tools' : cat.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        const icon = cat === 'gift-cards' ? '<i data-lucide="gift" class="nav-inline-icon"></i> ' : '';
        navHtml += `<a href="/category/${cat}" class="main-nav-link">${icon}${label}</a>`;
    });
    
    navHtml += `<a href="/about" class="main-nav-link">About</a>`;
    
    nav.innerHTML = navHtml;
    scheduleStoreIcons(nav);
}

function getMobileProfileNavHtml(session = getStoredCustomerSession()) {
    const href = session && session.isLoggedIn ? '/dashboard' : '/login';
    const label = session && session.isLoggedIn ? 'Profile' : 'Sign In';
    return `<a href="${href}" class="main-nav-link mobile-profile-nav" id="mobileProfileNav"><i data-lucide="user" class="nav-inline-icon"></i>${label}</a>`;
}

function ensureMobileProfileNav(nav, session = getStoredCustomerSession()) {
    if (!nav) return;
    const template = document.createElement('template');
    template.innerHTML = getMobileProfileNavHtml(session).trim();
    const profileLink = template.content.firstElementChild;
    const existing = nav.querySelector('#mobileProfileNav');

    if (existing) {
        existing.replaceWith(profileLink);
        return;
    }

    const searchBox = nav.querySelector('#mobileSearchBox');
    if (searchBox && searchBox.nextSibling) {
        nav.insertBefore(profileLink, searchBox.nextSibling);
    } else if (searchBox) {
        nav.appendChild(profileLink);
    } else {
        nav.prepend(profileLink);
    }
}

/* ================================================
   ANTI-GRAVITY 3D TILT EFFECT
   ================================================ */
function initTiltEffect() {
    // The storefront uses dense product grids; per-mousemove tilt caused avoidable
    // layout work on modest phones/laptops. Keep hover polish in CSS only.
    document.querySelectorAll('.tilt-card').forEach(card => {
        card.style.willChange = 'auto';
    });
}

/* ================================================
   RENDER PRODUCTS BY CATEGORY
   ================================================ */
// Global: tracks selected variant per product card
const cardSelections = {};

function getOptimizedImageSrc(src) {
    if (!src || src.startsWith('http') || src.startsWith('data:image') || src.endsWith('.webp')) return src;
    const webpMap = {
        'netflix.png': 'netflix.webp',
        'brand-netflix.png': 'brand-netflix.webp',
        'prime.png': 'prime.webp',
        'brand-prime.png': 'brand-prime.webp',
        'hotstar.png': 'hotstar.webp',
        'brand-hotstar.png': 'brand-hotstar.webp',
        'zee5.png': 'brand-zee5.svg',
        'sonyliv.png': 'brand-sonyliv.svg',
        'applemusic.png': 'brand-apple-music.svg',
        'apple-music.png': 'brand-apple-music.svg',
        'appletv.png': 'appletv.webp',
        'spotify.png': 'spotify.webp',
        'brand-spotify.png': 'brand-spotify.webp',
        'youtube.png': 'youtube.webp',
        'chatgpt.png': 'chatgpt.webp',
        'claude.png': 'claude.webp',
        'canva.png': 'canva.webp',
        'nordvpn.png': 'nordvpn.webp',
        'logo-upgraded-20260603.png': 'logo-upgraded-20260603-small.webp'
    };
    return src.replace(/([^/\\]+\.png)$/i, file => webpMap[file.toLowerCase()] || file);
}

function normalizeProductImageSrc(src) {
    if (!src) return '';
    const value = String(src).trim();
    if (!value) return '';
    if (value.startsWith('http') || value.startsWith('/') || value.startsWith('data:image')) {
        return getOptimizedImageSrc(value);
    }
    return getOptimizedImageSrc('/' + value.replace(/^\.?\//, ''));
}

function getCatalogImageSrc(product) {
    return normalizeProductImageSrc(
        product?.img ||
        product?.img_url ||
        product?.logo_url ||
        product?.product_img ||
        product?.platform?.logo_url
    );
}

function getFallbackBrandImageSrc(product) {
    const key = `${product?.slug || ''} ${product?.id || ''} ${product?.name || ''} ${product?.product_slug || ''} ${product?.product_name || ''}`.toLowerCase();
    const localLogos = [
        ['netflix', '/assets/images/brand-netflix.webp'],
        ['prime-video-global', '/assets/images/brand-prime.webp'],
        ['amazon-prime', '/assets/images/brand-prime.webp'],
        ['amazon prime', '/assets/images/brand-prime.webp'],
        ['prime', '/assets/images/brand-prime.webp'],
        ['hotstar', '/assets/images/brand-hotstar.webp'],
        ['disney', '/assets/images/hotstar.webp'],
        ['crunchyroll', '/assets/images/brand-crunchyroll.svg'],
        ['sonyliv', '/assets/images/brand-sonyliv.svg'],
        ['sony liv', '/assets/images/brand-sonyliv.svg'],
        ['sony-liv', '/assets/images/brand-sonyliv.svg'],
        ['zee5', '/assets/images/brand-zee5.svg'],
        ['apple music', '/assets/images/brand-apple-music.svg'],
        ['apple-music', '/assets/images/brand-apple-music.svg'],
        ['spotify', '/assets/images/brand-spotify.webp'],
        ['youtube', '/assets/images/youtube.webp'],
        ['nordvpn', '/assets/images/nordvpn.webp'],
        ['chatgpt', '/assets/images/chatgpt.webp'],
        ['gemini', '/assets/images/brand-gemini.svg'],
        ['google play', '/assets/images/brand-google-play.svg'],
        ['google-play', '/assets/images/brand-google-play.svg'],
        ['canva', '/assets/images/canva.webp']
    ];
    const match = localLogos.find(([needle]) => key.includes(needle));
    return match ? match[1] : '';
}

function getCardImageSrc(product) {
    const catalogSrc = getCatalogImageSrc(product);
    const fallbackSrc = getFallbackBrandImageSrc(product);
    if (fallbackSrc && /YOUR_SUPABASE_PROJECT_REF\.supabase\.co/i.test(catalogSrc)) {
        return fallbackSrc;
    }
    return catalogSrc || fallbackSrc;
}

function getProductLogoSrc(product) {
    return getCardImageSrc(product);
}

if (typeof window !== 'undefined') {
    window.getProductLogoSrc = getProductLogoSrc;
    window.getCatalogImageSrc = getCatalogImageSrc;
    window.getFallbackBrandImageSrc = getFallbackBrandImageSrc;
    window.normalizeProductImageSrc = normalizeProductImageSrc;
}

function findProductForTracking(productKey) {
    const key = String(productKey || '').trim().toLowerCase();
    if (!key || typeof getAllProducts !== 'function') return null;
    return getAllProducts().find(product => [product.slug, product.id, product.name]
        .map(value => String(value || '').trim().toLowerCase())
        .includes(key)) || null;
}

function trackProductOpen(productKey, source = 'card') {
    try {
        const key = String(productKey || '').trim();
        if (!key) return;
        const throttleKey = `getotts_product_open_${key.toLowerCase()}`;
        const last = Number(localStorage.getItem(throttleKey) || 0);
        if (last && Date.now() - last < 6 * 60 * 60 * 1000) return;
        localStorage.setItem(throttleKey, String(Date.now()));

        const product = findProductForTracking(key);
        const payload = {
            product_id: product?.id || key,
            product_slug: product?.slug || key,
            product_name: product?.name || '',
            market: getTopDealsMarket(),
            source
        };
        const body = JSON.stringify(payload);
        const url = `${getStoreApiBase()}/public/product-view`;
        if (navigator.sendBeacon) {
            navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
            return;
        }
        fetch(url, {
            method: 'POST',
            body,
            headers: { 'Content-Type': 'application/json' },
            keepalive: true
        }).catch(() => {});
    } catch (_) {}
}

if (typeof window !== 'undefined') {
    window.trackProductOpen = trackProductOpen;
}

function formatStoreMoney(amount) {
    const value = Number(amount) || 0;
    const isUsd = typeof getCurrentCurrency === 'function' && getCurrentCurrency() === 'USD';
    return getCurrencySymbol() + value.toLocaleString(isUsd ? 'en-US' : 'en-IN', {
        minimumFractionDigits: isUsd ? 2 : 0,
        maximumFractionDigits: 2
    });
}

let _homeFullProductRenderReady = false;
let _homeFullProductRenderScheduled = false;

function isHomeCatalogStartupStaged() {
    return document.body && document.body.classList.contains('home-page') && !_homeFullProductRenderReady;
}

function scheduleHomeFullProductRender() {
    if (_homeFullProductRenderScheduled) return;
    _homeFullProductRenderScheduled = true;

    const run = () => {
        if (_homeFullProductRenderReady) return;
        _homeFullProductRenderReady = true;
        renderAllProducts();
        if (typeof initComboBuilder === 'function') initComboBuilder();
    };

    ['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach(eventName => {
        window.addEventListener(eventName, run, { once: true, passive: true });
    });

    setTimeout(() => {
        if (typeof requestIdleCallback === 'function') {
            requestIdleCallback(run, { timeout: 2500 });
        } else {
            run();
        }
    }, 9500);
}

function renderAllProducts() {
    if (!PRODUCT_RENDER_STATE.catalog) {
        PRODUCT_RENDER_STATE.catalog = getProductsRenderSignature(getAllProducts());
    }
    const stageHomeCatalog = isHomeCatalogStartupStaged();
    renderHotDeals();
    if (stageHomeCatalog) {
        scheduleHomeFullProductRender();
        return;
    }
    renderAllProductsGrid();
    renderCategory('streamingGrid', 'streaming');
    renderCategory('musicGrid', 'music');
    renderCategory('aiGrid', 'ai');
    renderCategory('vpnGrid', 'vpn');
    renderCategory('giftCardsGrid', 'gift-cards');
    
    // Always restore admin edit buttons if edit mode is active (prevents disappearance after sync/saves)
    if (typeof window !== 'undefined' && window.editModeActive && typeof window.addEditButtons === 'function') {
        setTimeout(window.addEditButtons, 50);
    }
}

/** Render ALL active products into the allProductsGrid (homepage unified grid) */
function renderAllProductsGrid() {
    const grid = document.getElementById('allProductsGrid');
    if (!grid) return;

    if (shouldWaitForLiveCatalog()) {
        renderProductGridSkeleton(grid, 8);
        return;
    }

    const allActive = getAllProducts().filter(p => p.isActive !== false && p.variants && p.variants.length > 0);
    if (allActive.length === 0) {
        clearProductGridSkeleton(grid);
        grid.innerHTML = '<p style="text-align:center;color:#888;padding:2rem;">No products available right now.</p>';
        return;
    }
    clearProductGridSkeleton(grid);
    const signature = `all:${getMarketingCurrency()}:${getProductsRenderSignature(allActive)}`;
    const didRender = setGridHtmlIfChanged(grid, allActive.map((p, index) => renderProductCard(p, index)).join(''), signature, 'allProducts');
    if (didRender) scheduleStoreIcons(grid);
}

/**
 * Renders the admin-controlled "Top Deals" section.
 * Static HTML is just a reserved skeleton shell, so stale backup products
 * never override the featured products marked in the live catalog.
 */
function renderHotDeals() {
    const grid = document.getElementById('hotDealsGrid');
    if (!grid) return;

    const market = getTopDealsMarket();
    const cache = TOP_DEALS_CACHE[market];
    let hotProducts = [];
    if (!cache.products && !cache.failed) {
        if (shouldWaitForLiveCatalog()) {
            renderProductGridSkeleton(grid, 6);
            fetchMarketTopDeals(market)
                .then(() => renderHotDeals())
                .catch(() => renderHotDeals());
            return;
        }
        hotProducts = getFeaturedTopDealsFallback();
        fetchMarketTopDeals(market)
            .then(() => renderHotDeals())
            .catch(() => renderHotDeals());
    }

    if (!hotProducts.length) hotProducts = cache.products || [];
    if (!hotProducts.length && !shouldWaitForLiveCatalog()) {
        hotProducts = getFeaturedTopDealsFallback();
    }

    // 3. Hide section if no products qualify
    const section = document.getElementById('trendingSection');
    if (hotProducts.length === 0) {
        if (section) section.style.display = 'none';
        return;
    }
    if (section) section.style.display = 'block';

    // 4. Render homepage cards in the same detected currency as category/product pages.
    clearProductGridSkeleton(grid);
    const signature = `hot:${market}:${getMarketingCurrency()}:${getProductsRenderSignature(hotProducts)}`;
    const didRender = setGridHtmlIfChanged(grid, hotProducts.map((p, index) => renderProductCard(p, index)).join(''), signature, 'hotDeals');
    if (didRender) scheduleStoreIcons(grid);
}

function getFeaturedTopDealsFallback() {
    const market = getTopDealsMarket();
    const eligible = getAllProducts()
        .filter(p =>
            p.isActive !== false &&
            p.variants &&
            p.variants.length > 0
        );
    const bootOrder = BOOT_TOP_DEAL_ORDER[market] || BOOT_TOP_DEAL_ORDER.india;
    const bootProducts = bootOrder
        .map(key => findTopDealBootProduct(eligible, key))
        .filter(Boolean);
    const bootUsed = new Set(bootProducts.map(product => getTopDealProductKey(product)));

    const featured = eligible
        .filter(p =>
            !bootUsed.has(getTopDealProductKey(p)) &&
            p.isActive !== false &&
            isFeaturedDealProduct(p) &&
            p.variants &&
            p.variants.length > 0
        )
        .map((product, catalogIndex) => ({ product, catalogIndex }))
        .sort((a, b) => {
            const posA = getFeaturedDealPosition(a.product);
            const posB = getFeaturedDealPosition(b.product);
            if (posA !== posB) return posA - posB;
            return a.catalogIndex - b.catalogIndex;
        })
        .map(item => item.product);
    const pinned = bootProducts.concat(featured);
    if (pinned.length >= 6) return pinned.slice(0, 6);

    const used = new Set(pinned.map(product => getTopDealProductKey(product)));
    const fill = eligible
        .filter(product => !used.has(getTopDealProductKey(product)))
        .map((product, catalogIndex) => {
            const variant = getDefaultVariant(product) || product.variants[0] || {};
            const price = typeof getVariantPrice === 'function' ? getVariantPrice(variant) : Number(variant.price || 0);
            const original = typeof getVariantOriginalPrice === 'function'
                ? getVariantOriginalPrice(variant)
                : Number(variant.originalPrice || variant.original_price || price);
            const discount = Number.isFinite(original) && original > price && price > 0 ? Math.round((1 - price / original) * 100) : 0;
            return { product, catalogIndex, discount };
        })
        .sort((a, b) => (b.discount - a.discount) || (a.catalogIndex - b.catalogIndex))
        .map(item => item.product);

    return pinned.concat(fill).slice(0, 6);
}

function normalizeTopDealKey(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function getTopDealProductKey(product) {
    return normalizeTopDealKey(product?.slug || product?.id || product?.name);
}

function findTopDealBootProduct(products, wantedKey) {
    const normalizedWanted = normalizeTopDealKey(wantedKey);
    return products.find(product => {
        const keys = [product?.slug, product?.id, product?.name].map(normalizeTopDealKey);
        return keys.includes(normalizedWanted);
    });
}

function isFeaturedDealProduct(product) {
    const value = product?.isHot ?? product?.is_featured ?? product?.isFeatured ?? product?.featured ?? product?.hot;
    if (value === true || value === 1) return true;
    if (typeof value === 'string') {
        return ['true', '1', 'yes', 'featured', 'hot'].includes(value.trim().toLowerCase());
    }
    return false;
}

function getFeaturedDealPosition(product) {
    const raw = product?.featured_position ??
        product?.featuredPosition ??
        product?.featured_order ??
        product?.featuredOrder ??
        product?.hot_order ??
        product?.hotOrder;
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;

    const positions = window.GETOTTS_FEATURED_POSITIONS || window.GETOTTS_SETTINGS?.product_featured_positions || {};
    const keys = [product?.slug, product?.id, product?.name].filter(Boolean);
    for (const key of keys) {
        const mapped = Number(positions[key]);
        if (Number.isFinite(mapped) && mapped > 0) return mapped;
    }
    return Number.POSITIVE_INFINITY;
}

function shouldWaitForLiveCatalog() {
    const products = typeof getAllProducts === 'function' ? getAllProducts() : [];
    if (Array.isArray(products) && products.some(p => p && p.isActive !== false && Array.isArray(p.variants) && p.variants.length > 0)) {
        return false;
    }
    return typeof window.getottsCatalogHasLiveData === 'function' && !window.getottsCatalogHasLiveData();
}

function renderProductGridSkeleton(grid, count = 6) {
    if (!grid) return;
    if (grid.dataset.skeleton === 'live-catalog') return;
    grid.dataset.skeleton = 'live-catalog';
    grid.setAttribute('aria-busy', 'true');
    grid.innerHTML = Array.from({ length: count }, () => `
        <div class="p-card skeleton-card" aria-hidden="true">
            <div class="p-card-image skeleton-card-image">
                <span class="skeleton-block skeleton-logo"></span>
            </div>
            <div class="p-card-body">
                <span class="skeleton-block skeleton-title"></span>
                <span class="skeleton-block skeleton-line"></span>
                <span class="skeleton-block skeleton-line short"></span>
                <div class="skeleton-bottom">
                    <span class="skeleton-block skeleton-price"></span>
                    <span class="skeleton-block skeleton-button"></span>
                </div>
            </div>
        </div>
    `).join('');
}

function clearProductGridSkeleton(grid) {
    if (!grid) return;
    delete grid.dataset.skeleton;
    grid.removeAttribute('aria-busy');
}

/* ================================================
   REAL-TIME SYNC ENGINE
   Detects admin changes (stock, price, isHot, etc.)
   from other tabs or periodic localStorage updates
   and instantly re-renders the storefront.
   ================================================ */
let _lastProductHash = localStorage.getItem('getotts_admin_products') || '{}';
let _lastSettingsHash = localStorage.getItem('getotts_admin_settings') || '{}';

// Cross-tab sync: fires when admin panel (another tab) saves changes
window.addEventListener('storage', (e) => {
    if (e.key === 'getotts_admin_products' || e.key === 'getotts_product_version') {
        // Product data changed externally - re-render
        _lastProductHash = e.newValue || '{}';
        renderAllProducts();
        initComboBuilder();
    }
    if (e.key === 'getotts_cart') {
        try { cart = JSON.parse(e.newValue || '[]'); } catch(err) { cart = []; }
        updateCartCount();
        if (document.getElementById('cartDrawer') && document.getElementById('cartDrawer').classList.contains('open')) {
            renderCartDrawer();
        }
    }
    if (e.key === 'getotts_admin_settings') {
        _lastSettingsHash = e.newValue || '{}';
        try {
            const settings = JSON.parse(e.newValue || '{}');
            window.GETOTTS_FEATURED_POSITIONS = settings.product_featured_positions || window.GETOTTS_FEATURED_POSITIONS || {};
            renderHotDeals();
        } catch (_) {}
    }
    if (e.key === 'getotts_public_settings') {
        try {
            const settings = JSON.parse(e.newValue || '{}');
            window.GETOTTS_FEATURED_POSITIONS = settings.product_featured_positions || {};
            renderHotDeals();
        } catch (_) {}
    }
});

window.addEventListener('getotts:settingsUpdated', () => {
    if (document.body?.classList.contains('home-page')) {
        renderHotDeals();
    }
});

// Same-tab polling: catches localStorage changes made in the same window
// (e.g. admin panel embedded in same page, or automated stock deductions)
setInterval(() => {
    const currentProducts = localStorage.getItem('getotts_admin_products') || '{}';
    if (currentProducts !== _lastProductHash) {
        // Product data updated - sync storefront
        _lastProductHash = currentProducts;
        renderAllProducts();
        initComboBuilder();
    }
}, 15000); // Check every 15 seconds

// Light background sync from API. Keep it infrequent and only while the page is
// visible so customer pages do not keep creating background network traffic.
setInterval(async () => {
    if (typeof syncCatalogFromCloud === 'function' && document.visibilityState === 'visible') {
        await syncCatalogFromCloud();
    }
}, 300000);

function renderCategory(gridId, category) {
    const grid = document.getElementById(gridId);
    if (!grid) return;

    if (shouldWaitForLiveCatalog()) {
        renderProductGridSkeleton(grid, 6);
        return;
    }

    const items = getAllProducts().filter(p => p.category === category);

    clearProductGridSkeleton(grid);
    const signature = `${category}:${getMarketingCurrency()}:${getProductsRenderSignature(items)}`;
    if (PRODUCT_RENDER_STATE.categories[category] !== signature || grid.dataset.renderSignature !== signature) {
        grid.innerHTML = items.map((p, index) => renderProductCard(p, index)).join('');
        grid.dataset.renderSignature = signature;
        PRODUCT_RENDER_STATE.categories[category] = signature;
        requestAnimationFrame(() => grid.classList.add('products-ready'));
        scheduleStoreIcons(grid);
    }
}

/** Render a single product card - shared by renderCategory and renderHotDeals */
function renderProductCard(p, index = 99) {
    try {
        // Skip products without variants (corrupted overrides)
        if (!p.variants || !p.variants.length) return '';

        // Region filtering: hide products that don't match the user's detected currency/region
        if (typeof isProductVisibleForCurrentRegion === 'function') {
            if (!isProductVisibleForCurrentRegion(p)) return '';
        } else {
            var lock = (p.region_lock || 'all').toLowerCase();
            if (lock === 'india' && _currentCurrency === 'USD') return '';       // India-only: hide from USD users
            if (lock === 'international' && _currentCurrency === 'INR') return ''; // International-only: hide from INR users
        }

        // Get the default variant for initial display
        const dv = getDefaultVariant(p);
        if (!dv) return '';

        const accessTypes = getAccessTypes(p);

        // Initialize card selection
        if (!cardSelections[p.id]) {
            cardSelections[p.id] = {
                accessType: typeof getVariantAccessType === 'function' ? getVariantAccessType(dv) : (dv.accessType || dv.access_type),
                quality: dv.quality,
                duration: typeof getVariantDurationMonths === 'function' ? getVariantDurationMonths(dv) : (dv.duration || dv.duration_months),
            };
        }
        const sel = cardSelections[p.id];
        if (!accessTypes.includes(sel.accessType)) {
            sel.accessType = typeof getVariantAccessType === 'function' ? getVariantAccessType(dv) : (dv.accessType || dv.access_type);
        }
        const validQualities = getQualities(p, sel.accessType);
        if (validQualities.length && !validQualities.includes(sel.quality)) {
            sel.quality = validQualities[0];
        }
        if (!validQualities.length) {
            sel.quality = null;
        }
        const validDurations = getDurations(p, sel.accessType, sel.quality);
        if (validDurations.length && !validDurations.includes(sel.duration)) {
            sel.duration = validDurations[0];
        }

        // Find the current variant
        const cv = findVariant(p, sel.accessType, sel.quality, sel.duration) || dv;
        const displaySymbol = getCurrencySymbol();
        const displayPrice = getFormattedPrice(cv);
        const displayOriginalPrice = getFormattedOriginalPrice(cv);
        const cvPrice = typeof getVariantPrice === 'function' ? getVariantPrice(cv) : cv.price;
        const cvOrigPrice = typeof getVariantOriginalPrice === 'function' ? getVariantOriginalPrice(cv) : (cv.originalPrice || cv.price);
        const hasRealOriginalPrice = Number.isFinite(cvOrigPrice) && cvOrigPrice > cvPrice;
        const disc = hasRealOriginalPrice ? Math.round((1 - cvPrice / cvOrigPrice) * 100) : 0;

        let accessHTML = '';
        if (accessTypes && accessTypes.length > 1) {
            accessHTML = `<div class="p-card-switch-block"><div class="p-card-switch-label">Plan</div><div class="v-selector v-access" data-pid="${p.id}" aria-label="Choose plan type">
                ${accessTypes.map(a => {
                    const label = typeof getVariantAccessLabel === 'function' ? getVariantAccessLabel(a, true) : (a === 'personal' ? 'Private' : 'Shared');
                    const icon = a === 'personal' ? 'user' : (a === 'family' ? 'users-round' : 'users');
                    const activeType = typeof getVariantAccessType === 'function' ? getVariantAccessType(cv) : (cv.accessType || cv.access_type);
                    return `<button type="button" class="v-pill ${a === activeType ? 'active' : ''}" data-val="${a}" onclick="changeAccess('${p.id}','${a}')" aria-pressed="${a === activeType}"><i data-lucide="${icon}"></i>${label}</button>`;
                }).join('')}
            </div></div>`;
        }

        // Build quality selector (if applicable)
        const qualities = getQualities(p, sel.accessType);
        let qualityHTML = '';
        if (qualities && qualities.length > 1) {
            const qualityLabel = qualities.some(q => /profile|number|mail|access/i.test(String(q))) ? 'Access' : 'Quality';
            qualityHTML = `<div class="p-card-switch-block"><div class="p-card-switch-label">${qualityLabel}</div><div class="v-selector v-quality" data-pid="${p.id}" aria-label="Choose ${qualityLabel.toLowerCase()}">
                ${qualities.map(q => `<button type="button" class="v-pill ${q === sel.quality ? 'active' : ''}" data-val="${q}" onclick="changeQuality('${p.id}','${q}')" aria-pressed="${q === sel.quality}">${q}</button>`).join('')}
            </div></div>`;
        }

        // Build duration selector
        const durations = getDurations(p, sel.accessType, sel.quality);
        let durationHTML = '';
        if (durations.length > 1) {
            durationHTML = `<div class="p-card-switch-block"><div class="p-card-switch-label">Duration</div><div class="v-selector v-duration" data-pid="${p.id}">
                ${durations.map(d => {
                    const label = d >= 24 ? `${d/12}Y` : d >= 12 ? '1Y' : `${d}M`;
                    return `<button type="button" class="v-pill ${d === sel.duration ? 'active' : ''}" data-val="${d}" onclick="changeDuration('${p.id}',${d})" aria-pressed="${d === sel.duration}">${label}</button>`;
                }).join('')}
            </div></div>`;
        }
        const optionHTML = (accessHTML || qualityHTML || durationHTML)
            ? `<div class="p-card-options">${accessHTML}${qualityHTML}${durationHTML}</div>`
            : '';

        // Features based on access type (handle both old array and new object format)
        let feats = [];
        if (Array.isArray(p.features)) {
            feats = p.features;
        } else if (p.features && typeof p.features === 'object') {
            feats = p.features[sel.accessType] || p.features[Object.keys(p.features)[0]] || [];
        }

        // Hidden indicator for admin
        const hiddenClass = p.isActive === false ? 'admin-hidden' : '';

        // Product cards use real brand logos, with emoji fallback only when no logo is available.
        const cardImg = getProductLogoSrc(p);
        const trackKey = encodeURIComponent(p.slug || p.id || p.name || '');
        const imageLoading = index < 2 ? 'eager' : 'lazy';
        const imagePriority = index === 0 ? ' fetchpriority="high"' : '';
        const imgContent = cardImg
            ? `<img src="${cardImg}" alt="${p.name}" loading="${imageLoading}" decoding="async" width="96" height="96"${imagePriority}>`
            : `<span class="p-emoji-large">${p.emoji || '\u{1F4E6}'}</span>`;

        // Savings amount
        const currentPrice = typeof getVariantPrice === 'function' ? getVariantPrice(cv) : (parseFloat(cv.price) || 0);
        const originalPrice = typeof getVariantOriginalPrice === 'function' ? getVariantOriginalPrice(cv) : (parseFloat(cv.originalPrice || cv.original_price) || 0);
        const hasSavings = Number.isFinite(originalPrice) && originalPrice > currentPrice;
        const savedAmt = hasSavings ? originalPrice - currentPrice : 0;
        const accessLabel = typeof getVariantAccessLabel === 'function' ? getVariantAccessLabel(cv, true) : ((cv.accessType || cv.access_type || sel.accessType || 'Shared') === 'personal' ? 'Private' : 'Shared');
        const durationLabel = typeof getVariantDurationLabel === 'function' ? getVariantDurationLabel(cv) : (cv.durationLabel || cv.duration_label);
        const planSpecifics = [durationLabel, cv.quality, accessLabel]
            .filter(Boolean)
            .map(x => String(x).replace(/^\w/, c => c.toUpperCase()))
            .join(' - ');
        const badgeHTML = hasRealOriginalPrice && disc > 0
            ? `<span class="p-badge discount">${disc}% OFF</span>`
            : '';
        const topDealBadgeHTML = p.topDealBadge || p.top_deal_badge
            ? `<span class="p-badge popular"><i data-lucide="badge-percent"></i> ${String(p.topDealBadge || p.top_deal_badge).slice(0, 24)}</span>`
            : '';
        const originalPriceHTML = hasSavings && displayOriginalPrice
            ? `<div class="p-price-old">${displaySymbol}${displayOriginalPrice}</div>`
            : '';
        const savingsHTML = hasSavings
            ? `<span class="p-savings">Save ${displaySymbol}${_currentCurrency === 'USD' ? savedAmt.toFixed(2) : savedAmt.toLocaleString('en-IN')}</span>`
            : '';
        const hasOptionClass = optionHTML ? 'has-plan-options' : '';

        return `
        <div class="p-card ${hiddenClass} ${hasOptionClass} tilt-card trending-card" data-id="${p.id}" data-index="${index}" data-sku="${cv.sku}">
            <a href="/product/${p.slug || p.id}" class="p-card-image" style="display:block; text-decoration:none;" onclick="trackProductOpen(decodeURIComponent('${trackKey}'),'card')">
                <div class="p-card-badges">
                    ${topDealBadgeHTML || (p.isHot ? '<span class="p-badge popular"><i data-lucide="star"></i> Most Popular</span>' : '')}
                    ${badgeHTML}
                </div>
                ${imgContent}
            </a>
            <div class="p-card-body">
                <a href="/product/${p.slug || p.id}" style="text-decoration:none; display:block;" onclick="trackProductOpen(decodeURIComponent('${trackKey}'),'card')"><div class="p-name">${p.name}</div></a>
                <div class="p-plan-line">${planSpecifics}</div>
                ${optionHTML}
                
                <ul class="p-features">
                    ${feats.slice(0, 3).map(f => `<li>${f}</li>`).join('')}
                </ul>
                
                <div class="p-bottom">
                    <div>
                        ${originalPriceHTML}
                        <div class="p-price">${displaySymbol}${displayPrice}<small>/${String(durationLabel || 'plan').toLowerCase()}</small>${savingsHTML}</div>
                    </div>
                    <div class="p-buttons">
                        <button class="buy-btn" onclick="trackProductOpen(decodeURIComponent('${trackKey}'),'buy');buyProduct('${cv.sku}')">Buy Now</button>
                        <button class="cart-add-btn" onclick="addToCart('${cv.sku}')" title="Add to Cart">
                            <i data-lucide="shopping-cart"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>`;
    } catch(e) {
        console.warn('Error rendering product', p.id, e);
        return '';
    }
}


/* ================================================
   VARIANT CHANGERS
   ================================================ */
function changeAccess(pid, accessType) {
    if (!cardSelections[pid]) cardSelections[pid] = {};
    cardSelections[pid].accessType = accessType;
    // Reset quality to first available for this access type
    const p = getAllProducts().find(x => x.id === pid);
    if (p) {
        const quals = getQualities(p, accessType);
        cardSelections[pid].quality = quals && quals.length ? quals[0] : null;
        // Reset duration to first available
        const durs = getDurations(p, accessType, cardSelections[pid].quality);
        if (!durs.includes(cardSelections[pid].duration)) {
            cardSelections[pid].duration = durs[0];
        }
    }
    refreshProductCards(pid);
}

function changeQuality(pid, quality) {
    if (!cardSelections[pid]) cardSelections[pid] = {};
    cardSelections[pid].quality = quality;
    const p = getAllProducts().find(x => x.id === pid);
    if (p) {
        const durs = getDurations(p, cardSelections[pid].accessType, quality);
        if (!durs.includes(cardSelections[pid].duration)) {
            cardSelections[pid].duration = durs[0];
        }
    }
    refreshProductCards(pid);
}

function changeDuration(pid, duration) {
    if (!cardSelections[pid]) cardSelections[pid] = {};
    cardSelections[pid].duration = duration;
    refreshProductCards(pid);
}

function refreshProductCards(pid) {
    const p = getAllProducts().find(x => String(x.id) === String(pid));
    if (!p) {
        renderAllProducts();
        return;
    }

    const selector = `.p-card[data-id="${String(pid).replace(/"/g, '\\"')}"]`;
    const cards = Array.from(document.querySelectorAll(selector));
    if (!cards.length) {
        renderAllProducts();
        return;
    }

    cards.forEach(card => {
        const index = Number.parseInt(card.dataset.index || '99', 10);
        const template = document.createElement('template');
        template.innerHTML = renderProductCard(p, Number.isFinite(index) ? index : 99).trim();
        const nextCard = template.content.firstElementChild;
        if (!nextCard) return;
        nextCard.classList.add('variant-pulse');
        card.replaceWith(nextCard);
    });

    scheduleStoreIcons();
}

/* ================================================
   CART - SKU-based with proper stacking
   ================================================ */
let cart = JSON.parse(localStorage.getItem('getotts_cart') || '[]');

// Migrate old cart format if needed
if (cart.length && cart[0].id && !cart[0].sku) {
    cart = [];
    localStorage.setItem('getotts_cart', '[]');
}

function saveCart() {
    localStorage.setItem('getotts_cart', JSON.stringify(cart));
}

function cleanCartItems() {
    const cleaned = [];
    let changed = false;
    const seen = new Map();

    if (!Array.isArray(cart)) {
        cart = [];
        saveCart();
        return true;
    }

    cart.forEach(item => {
        const sku = item && typeof item.sku === 'string' ? item.sku.trim() : '';
        const qty = Math.max(1, Math.min(99, parseInt(item && item.qty, 10) || 1));
        const result = sku ? getVariant(sku) : null;
        if (!sku || !result) {
            changed = true;
            return;
        }
        if (qty !== item.qty || sku !== item.sku) changed = true;
        seen.set(sku, (seen.get(sku) || 0) + qty);
    });

    seen.forEach((qty, sku) => cleaned.push({ sku, qty }));
    if (cleaned.length !== cart.length) changed = true;
    cart = cleaned;
    if (changed) saveCart();
    return changed;
}

function addToCart(sku) {
    const result = getVariant(sku);
    if (!result) return;
    const { product, variant } = result;
    trackStorefrontEvent('AddToCart', product, variant, { quantity: 1 });

    cleanCartItems();
    const existing = cart.find(i => i.sku === sku);
    if (existing) {
        existing.qty += 1;
    } else {
        cart.push({ sku, qty: 1 });
    }

    saveCart();
    updateCartCount();
    openCart();

    const toastName = document.getElementById('toastName');
    const toastMsg = document.getElementById('toastMsg');
    const toast = document.getElementById('toast');
    if (toastName) toastName.textContent = product.name;
    if (toastMsg) toastMsg.textContent = `${typeof getVariantDurationLabel === 'function' ? getVariantDurationLabel(variant) : variant.durationLabel} added to cart`;
    if (toast) {
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }
}

function updateCartCount() {
    const badge = document.getElementById('cartBadge');
    cleanCartItems();
    let total = 0;
    let count = 0;

    cart.forEach(item => {
        count += item.qty;
        const result = getVariant(item.sku);
        if (result && result.variant) {
            total += (typeof getVariantPrice === 'function' ? getVariantPrice(result.variant) : result.variant.price) * item.qty;
        }
    });

    if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'flex' : 'none';
        if (count > 0) {
            badge.classList.remove('bounce');
            void badge.offsetWidth;
            badge.classList.add('bounce');
        }
    }

    document.querySelectorAll('#cartTotal, #drawerCartTotal, .cart-price').forEach(el => {
        el.textContent = formatStoreMoney(total);
    });
}

/* ================================================
   CART DRAWER
   ================================================ */
function openCart() {
    const drawer = document.getElementById('cartDrawer');
    const overlay = document.getElementById('cartOverlay');
    cleanCartItems();
    if (drawer) { drawer.classList.add('open'); renderCartDrawer(); }
    if (overlay) overlay.classList.add('open');
}

function closeCart() {
    const drawer = document.getElementById('cartDrawer');
    const overlay = document.getElementById('cartOverlay');
    if (drawer) drawer.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
}

function renderCartDrawer() {
    const body = document.getElementById('cartDrawerBody');
    const footer = document.getElementById('cartDrawerFooter');
    if (!body || !footer) return;
    cleanCartItems();

    if (cart.length === 0) {
        body.innerHTML = '<div class="cart-empty"><i data-lucide="shopping-cart"></i><p>Your cart is empty</p></div>';
        footer.style.display = 'none';
        scheduleStoreIcons(body);
        return;
    }

    let total = 0;
    body.innerHTML = cart.map((item, idx) => {
        const result = getVariant(item.sku);
        if (!result) return '';
        const { product, variant } = result;
        const lineTotal = (typeof getVariantPrice === 'function' ? getVariantPrice(variant) : variant.price) * item.qty;
        total += lineTotal;
        const imgSrc = getProductLogoSrc(product);

        return `
            <div class="cart-item">
                <span class="cart-item-emoji">${imgSrc ? `<img src="${imgSrc}" alt="${product.name}" class="cart-thumb-img" loading="lazy" decoding="async" width="40" height="40">` : product.emoji}</span>
                <div class="cart-item-info">
                    <div class="cart-item-name">${product.name}</div>
                    <div class="cart-item-plan">${typeof getVariantAccessLabel === 'function' ? getVariantAccessLabel(variant) : (variant.accessType || variant.access_type)} &middot; ${typeof getVariantDurationLabel === 'function' ? getVariantDurationLabel(variant) : (variant.durationLabel || variant.duration_label)}${variant.quality ? ' &middot; ' + variant.quality : ''}</div>
                </div>
                <div class="cart-item-qty">
                    <button class="qty-btn" onclick="changeQty(${idx}, -1)">-</button>
                    <span>${item.qty}</span>
                    <button class="qty-btn" onclick="changeQty(${idx}, 1)">+</button>
                </div>
                <span class="cart-item-price">${formatStoreMoney(lineTotal)}</span>
                <button class="cart-item-remove" onclick="removeFromCart(${idx})" title="Remove">&times;</button>
            </div>
        `;
    }).join('');

    const totalEl = document.getElementById('cartTotal') || document.getElementById('drawerCartTotal');
    if (totalEl) totalEl.textContent = formatStoreMoney(total);
    footer.style.display = 'block';
}

function changeQty(index, delta) {
    cart[index].qty += delta;
    if (cart[index].qty <= 0) {
        cart.splice(index, 1);
    }
    saveCart();
    updateCartCount();
    renderCartDrawer();
}

function removeFromCart(index) {
    cart.splice(index, 1);
    saveCart();
    updateCartCount();
    renderCartDrawer();
}

// Wire cart button
document.addEventListener('DOMContentLoaded', () => {
    updateCartCount();
    const cartBtn = document.getElementById('cartBtn');
    if (cartBtn) cartBtn.addEventListener('click', openCart);
});

function buyProduct(sku) {
    const result = getVariant(sku);
    if (result) {
        trackStorefrontEvent('InitiateCheckout', result.product, result.variant, { num_items: 1 });
    }
    if (!getStoredCustomerSession().isLoggedIn) {
        sessionStorage.setItem('postLoginRedirect', `/checkout?sku=${sku}`);
        window.location.href = `/login`;
        return;
    }
    sessionStorage.setItem('checkoutState', JSON.stringify({ sku: sku }));
    window.location.href = `/checkout`;
}

function buyCombo() {
    const selected = comboItems.filter(i => i.selected);
    if (selected.length === 0) {
        showToast('Please select at least one item');
        return;
    }
    const comboIds = selected.map(i => i.id).join(',');

    if (!getStoredCustomerSession().isLoggedIn) {
        sessionStorage.setItem('postLoginRedirect', `/checkout?combo=${comboIds}`);
        window.location.href = `/login`;
        return;
    }

    sessionStorage.setItem('checkoutState', JSON.stringify({ combo: comboIds }));
    window.location.href = `/checkout`;
}

function checkoutCart() {
    cleanCartItems();
    if (cart.length === 0) return;
    const skus = cart.map(i => `${i.sku}:${i.qty}`).join(',');
    let totalValue = 0;
    const contentIds = [];
    cart.forEach(item => {
        const result = getVariant(item.sku);
        if (!result) return;
        contentIds.push(item.sku);
        totalValue += (typeof getVariantPrice === 'function' ? getVariantPrice(result.variant) : parseFloat(result.variant.price || 0)) * item.qty;
    });
    if (typeof window.getottsTrack === 'function') {
        window.getottsTrack('InitiateCheckout', {
            content_ids: contentIds,
            content_type: 'product',
            currency: getMarketingCurrency(),
            value: totalValue,
            num_items: cart.reduce((sum, item) => sum + (parseInt(item.qty, 10) || 1), 0)
        });
    }

    if (!getStoredCustomerSession().isLoggedIn) {
        sessionStorage.setItem('postLoginRedirect', `/checkout?cart=${skus}`);
        window.location.href = `/login`;
        return;
    }

    closeCart();
    sessionStorage.setItem('checkoutState', JSON.stringify({ cart: skus }));
    window.location.href = `/checkout`;
}
/* ================================================
   COMBO BUILDER
   ================================================ */
let picked = new Set();

function initComboBuilder() {
    const picker = document.getElementById('comboPicker');
    if (!picker) return;

    const comboProducts = getAllProducts().filter(p => ['streaming', 'music', 'ai'].includes(p.category));

    picker.innerHTML = comboProducts.map(p => {
        const dv = getDefaultVariant(p);
        if (!dv) return '';
        const imgSrc = getProductLogoSrc(p);
        return `
        <div class="cp-card" data-id="${p.id}" onclick="toggleCombo('${p.id}')">
            <span class="cp-emoji">${imgSrc ? `<img src="${imgSrc}" alt="${p.name}" class="combo-picker-thumb-img" loading="lazy" decoding="async" width="32" height="32">` : p.emoji}</span>
            <span class="cp-name">${p.name}</span>
            <span class="cp-price">${getCurrencySymbol()}${getFormattedPrice(dv)}/mo</span>
        </div>`;
    }).join('');
}

function toggleCombo(id) {
    picked.has(id) ? picked.delete(id) : picked.add(id);

    document.querySelectorAll('.cp-card').forEach(c => {
        c.classList.toggle('picked', picked.has(c.dataset.id));
    });

    updateComboReceipt();
}

function updateComboReceipt() {
    const itemsEl = document.getElementById('comboItems');
    const totals = document.getElementById('comboTotals');
    const buyBtn = document.getElementById('comboBuy');

    if (picked.size < 3) {
        itemsEl.innerHTML = `<p class="combo-empty">Pick ${3 - picked.size} more platform${picked.size < 2 ? 's' : ''}</p>`;
        totals.style.display = 'none';
        buyBtn.style.display = 'none';
        return;
    }

    let subtotal = 0;
    let rows = [];
    picked.forEach(id => {
        const p = getAllProducts().find(x => x.id === id);
        if (p) {
            const dv = getDefaultVariant(p);
            if (dv) {
                subtotal += typeof getVariantPrice === 'function' ? getVariantPrice(dv) : (parseFloat(dv.price) || 0);
                const imgSrc = getProductLogoSrc(p);
                rows.push(`<div class="ci-row"><span>${imgSrc ? '<img src="'+imgSrc+'" class="combo-thumb-img" alt="'+p.name+'" loading="lazy" decoding="async" width="28" height="28">' : p.emoji} ${p.name}</span><span>${getCurrencySymbol()}${getFormattedPrice(dv)}</span></div>`);
            }
        }
    });

    const discPct = picked.size >= 10 ? 25 : picked.size >= 7 ? 20 : picked.size >= 5 ? 15 : 10;
    const discAmt = Math.round(subtotal * discPct / 100);
    const total = subtotal - discAmt;

    itemsEl.innerHTML = rows.join('');
    const money = typeof formatStoreMoney === 'function'
        ? formatStoreMoney
        : (value) => `${getCurrencySymbol()}${Number(value || 0).toFixed(getCurrentCurrency && getCurrentCurrency() === 'USD' ? 2 : 0)}`;
    document.getElementById('comboSubtotal').textContent = money(subtotal);
    document.getElementById('comboDiscount').textContent = `-${money(discAmt)} (${discPct}%)`;
    document.getElementById('comboTotal').textContent = money(total);

    totals.style.display = 'block';
    buyBtn.style.display = 'flex';

    scheduleStoreIcons();
}

/* ================================================
   STATUS GRID
   ================================================ */
function initStatusGrid() {
    const grid = document.getElementById('statusGrid');
    if (!grid) return;

    grid.innerHTML = HEALTH_DATA.map(h => {
        const label = h.status === 'online' ? 'Online' : h.status === 'checking' ? 'Checking' : 'Down';
        return `
        <div class="s-item">
            <span class="s-dot ${h.status}"></span>
            <span class="s-name"><i data-lucide="${h.icon || 'circle'}"></i> ${h.name}</span>
            <span class="s-status">${label}</span>
        </div>`;
    }).join('');
    scheduleStoreIcons();
}

/* ================================================
   REVIEWS
   ================================================ */
function initReviews() {
    const grid = document.getElementById('reviewGrid');
    if (!grid) return;

    grid.innerHTML = REVIEWS.map(r => `
        <div class="r-card">
            <div class="r-stars">${'&#9733;'.repeat(r.stars)}${'&#9734;'.repeat(5 - r.stars)}</div>
            <p class="r-text">"${r.text}"</p>
            <div class="r-author">
                <div class="r-avatar">${r.initial}</div>
                <div class="r-meta">
                    <strong>${r.name}</strong>
                    <span>${r.platform}</span>
                </div>
            </div>
        </div>
    `).join('');
}

/* ================================================
   FAQ
   ================================================ */
function initFAQ() {
    document.querySelectorAll('.faq-q').forEach(btn => {
        btn.addEventListener('click', () => {
            const item = btn.closest('.faq-item');
            const wasOpen = item.classList.contains('open');
            document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));
            if (!wasOpen) item.classList.add('open');
        });
    });
}

/* ================================================
   SEARCH
   ================================================ */
function initSearch() {
    // Setup for both desktop and mobile search
    setupSearchInput('searchInput', 'searchDropdown');
    setupSearchInput('mobileSearchInput', 'mobileSearchDropdown');
    setupSearchInput('mobileHeaderSearchInput', 'mobileHeaderSearchDropdown');
}

function setupSearchInput(inputId, dropdownId) {
    const input = document.getElementById(inputId);
    const dd = document.getElementById(dropdownId);
    if (!input || !dd) return;
    let currentMatches = [];

    const getSearchProductUrl = (product) => {
        const slug = product.slug || product.id || String(product.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        return `/product/${encodeURIComponent(slug)}`;
    };

    const openProduct = (url) => {
        if (!url) return;
        window.location.href = url;
    };

    input.addEventListener('input', e => {
        const q = e.target.value.toLowerCase().trim();
        if (q.length < 2) {
            currentMatches = [];
            dd.classList.remove('open');
            return;
        }

        currentMatches = getAllProducts().filter(p =>
            p.name.toLowerCase().includes(q) || p.category.includes(q)
        ).slice(0, 5);

        if (!currentMatches.length) {
            dd.innerHTML = '<div class="sd-item">No results</div>';
        } else {
            dd.innerHTML = currentMatches.map(p => {
                const dv = getDefaultVariant(p);
                const url = getSearchProductUrl(p);
                const imgSrc = getProductLogoSrc(p);
                return `
                <button type="button" class="sd-item" data-url="${url}" aria-label="Open ${p.name}">
                    <span class="sd-emoji">${imgSrc ? '<img src="'+imgSrc+'" class="search-thumb-img" alt="'+p.name+'" loading="lazy" decoding="async" width="32" height="32">' : p.emoji}</span>
                    <span>${p.name}</span>
                    <span class="sd-price">From ${getCurrencySymbol()}${dv ? getFormattedPrice(dv) : '?'}</span>
                </button>
            `}).join('');
        }
        dd.classList.add('open');

        // Attach click handlers via event delegation
        dd.querySelectorAll('.sd-item[data-url]').forEach(item => {
            item.addEventListener('click', function(ev) {
                ev.preventDefault();
                ev.stopPropagation();
                openProduct(this.dataset.url);
            });
        });
    });

    input.addEventListener('keydown', e => {
        if (e.key !== 'Enter') return;
        if (!currentMatches.length) return;
        e.preventDefault();
        openProduct(getSearchProductUrl(currentMatches[0]));
    });

    document.addEventListener('click', e => {
        if (!e.target.closest('#' + inputId) && !e.target.closest('#' + dropdownId)) {
            dd.classList.remove('open');
        }
    });
}

function scrollToSection(cat) {
    const map = { streaming: 'streaming', music: 'music', ai: 'ai-tools', vpn: 'vpn', 'gift-cards': 'gift-cards' };
    const sectionId = map[cat] || cat;
    const el = document.getElementById(sectionId);
    
    if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
    } else {
        // Not on home page? Redirect to home with cat param
        window.location.href = `/?cat=${sectionId}`;
        return;
    }

    // Close all search dropdowns
    document.querySelectorAll('.search-dropdown').forEach(d => d.classList.remove('open'));
    document.querySelectorAll('#searchInput, #mobileSearchInput, #mobileHeaderSearchInput').forEach(i => i.value = '');

    // Close mobile nav if open
    const nav = document.getElementById('mainNav');
    if (nav) nav.classList.remove('open');
}

/* ================================================
   TOAST NOTIFICATIONS
   ================================================ */
function initToast() {
    const toast = document.getElementById('toast');
    let idx = 0;

    function show() {
        const p = LIVE_PURCHASES[idx % LIVE_PURCHASES.length];
        document.getElementById('toastName').textContent = `${p.name} from ${p.city}`;
        document.getElementById('toastMsg').textContent = `bought ${p.product} \u00B7 ${p.time}`;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 4000);
        idx++;
    }

    setTimeout(() => { show(); setInterval(show, 18000); }, 6000);
}

/* ================================================
   HEADER
   ================================================ */
function getStoredCustomerSession() {
    let token = localStorage.getItem('GetOTTs_customer_token') || '';
    let customer = null;

    try {
        customer = JSON.parse(localStorage.getItem('GetOTTs_customer') || 'null');
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
                if (token && !customer && sessionUser) {
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
        isLoggedIn: !!(token || customer?.id || customer?.phone || customer?.email),
        token,
        customer: customer || {}
    };
}

function initHeader() {
    const header = document.getElementById('header');
    const toggle = document.getElementById('mobileToggle');
    const nav = document.getElementById('mainNav');
    const session = getStoredCustomerSession();

    ensureMobileProfileNav(nav, session);

    if (toggle && nav) {
        toggle.setAttribute('aria-controls', 'mainNav');
        toggle.setAttribute('aria-expanded', nav.classList.contains('open') ? 'true' : 'false');
    }

    // Update Login button if user is already logged in
    if (session.isLoggedIn) {
        const customer = session.customer || {};
        const loginBtn = document.getElementById('loginBtn');
        const signupBtn = document.querySelector('.header-signup');
        if (loginBtn) {
            const rawName = customer.name || customer.email || customer.phone || 'Dashboard';
            const name = String(rawName).split('@')[0].split(' ')[0] || 'Dashboard';
            loginBtn.href = '/dashboard';
            loginBtn.classList.add('is-logged-in');
            loginBtn.dataset.label = name;
            loginBtn.innerHTML = `<i data-lucide="user" class="login-icon"></i><span class="login-text">${name}</span>`;
            loginBtn.title = 'Profile';
            loginBtn.setAttribute('aria-label', 'Profile');
        }
        if (signupBtn) {
            signupBtn.style.display = 'none';
            signupBtn.setAttribute('aria-hidden', 'true');
            signupBtn.tabIndex = -1;
        }
        scheduleStoreIcons();
    }
}

/* ================================================
   LAZY LOAD VIDEOS (Supabase CDN)
   Loads video src only when section scrolls into view
   ================================================ */
function initLazyVideos() {
    const lazyVideos = [].slice.call(document.querySelectorAll("video.lazy-video"));
    if ("IntersectionObserver" in window) {
        let lazyVideoObserver = new IntersectionObserver(function(entries, observer) {
            entries.forEach(function(video) {
                if (video.isIntersecting) {
                    for (let source in video.target.children) {
                        let videoSource = video.target.children[source];
                        if (typeof videoSource.tagName === "string" && videoSource.tagName === "SOURCE") {
                            videoSource.src = videoSource.dataset.src;
                        }
                    }
                    video.target.load();
                    lazyVideoObserver.unobserve(video.target);
                }
            });
        }, { rootMargin: '200px' });
        lazyVideos.forEach(function(lazyVideo) {
            lazyVideoObserver.observe(lazyVideo);
        });
    }
}

/* ================================================
   SCROLL ANIMATIONS - Wow Factor
   Uses IntersectionObserver for performant
   scroll-triggered fade-in/slide-up animations
   ================================================ */
function initScrollAnimations() {
    // We removed animate-on-scroll from product grids so they don't stay hidden when loaded dynamically.
    // Also animate trust cards, section headers, combo cards
    document.querySelectorAll('.trust-card, .combo-header, .r-card, .faq-item, .s-item').forEach(el => {
        el.classList.add('animate-on-scroll');
    });

    // Create the observer
    if ('IntersectionObserver' in window) {
        const animObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    animObserver.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.08,
            rootMargin: '0px 0px -40px 0px'
        });

        // Observe all animate-on-scroll elements
        document.querySelectorAll('.animate-on-scroll').forEach(el => {
            animObserver.observe(el);
            // Fallback: immediately make it visible if it's high up
            if (el.getBoundingClientRect().top < window.innerHeight) {
                el.classList.add('visible');
            }
        });
    } else {
        // Fallback: just show everything
        document.querySelectorAll('.animate-on-scroll, .product-row, .section-top').forEach(el => {
            el.classList.add('visible');
        });
    }
}
