/* ============================================
   GetOTTs v4 — Premium White + Gold Design
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

document.addEventListener('DOMContentLoaded', async () => {
    if (window.lucide) lucide.createIcons();

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
        console.log('[Storefront] Catalog updated from background sync. Re-rendering...');
        // NOTE: Do NOT call renderNavigation() here.
        // The static HTML nav is the source of truth for categories.
        // This prevents the "glitch" where nav links randomly disappear.
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
            syncCatalogFromCloud().catch(e => console.warn('[INIT] Catalog sync error:', e));
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
    if (window.lucide) lucide.createIcons();
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
        'prime.png': 'prime.webp',
        'hotstar.png': 'hotstar.webp',
        'jiocinema.png': 'jiocinema.webp',
        'zee5.png': 'zee5.webp',
        'sonyliv.png': 'sonyliv.webp',
        'appletv.png': 'appletv.webp',
        'spotify.png': 'spotify.webp',
        'youtube.png': 'youtube.webp',
        'chatgpt.png': 'chatgpt.webp',
        'claude.png': 'claude.webp',
        'canva.png': 'canva.webp',
        'nordvpn.png': 'nordvpn.webp'
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
        ['netflix', '/assets/images/brand-netflix.png'],
        ['amazon-prime', '/assets/images/brand-prime.png'],
        ['amazon prime', '/assets/images/brand-prime.png'],
        ['prime', '/assets/images/brand-prime.png'],
        ['hotstar', '/assets/images/brand-hotstar.png'],
        ['disney', '/assets/images/hotstar.webp'],
        ['spotify', '/assets/images/brand-spotify.png'],
        ['youtube', '/assets/images/youtube.webp'],
        ['nordvpn', '/assets/images/nordvpn.webp'],
        ['chatgpt', '/assets/images/chatgpt.webp'],
        ['canva', '/assets/images/canva.webp']
    ];
    const match = localLogos.find(([needle]) => key.includes(needle));
    return match ? match[1] : '';
}

function getCardImageSrc(product) {
    return getCatalogImageSrc(product) || getFallbackBrandImageSrc(product);
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

function formatStoreMoney(amount) {
    const value = Number(amount) || 0;
    const isUsd = typeof getCurrentCurrency === 'function' && getCurrentCurrency() === 'USD';
    return getCurrencySymbol() + value.toLocaleString(isUsd ? 'en-US' : 'en-IN', {
        minimumFractionDigits: isUsd ? 2 : 0,
        maximumFractionDigits: 2
    });
}

function renderAllProducts() {
    renderHotDeals();
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

    const allActive = getAllProducts().filter(p => p.isActive !== false && p.variants && p.variants.length > 0);
    if (allActive.length === 0) {
        grid.innerHTML = '<p style="text-align:center;color:#888;padding:2rem;">No products available right now.</p>';
        return;
    }
    grid.innerHTML = allActive.map((p, index) => renderProductCard(p, index)).join('');
    if (window.lucide) lucide.createIcons();
}

/**
 * Renders the "Trending Now / Hot Deals" section.
 * Selection criteria (priority order):
 *   1. Products with isHot = true (admin-controlled)
 *   2. Products with highest discount percentage (auto-curated)
 * Uses the SAME renderCategory card logic internally.
 */
function renderHotDeals() {
    const grid = document.getElementById('hotDealsGrid');
    if (!grid) return;

    const referenceDealSlugs = [
        'netflix-streaming-subscription',
        'netflix',
        'amazon-prime-streaming',
        'prime-video',
        'disney-hotstar',
        'hotstar',
        'spotify-premium',
        'spotify',
        'youtube-premium',
        'nordvpn'
    ];
    const referenceDealOrder = [
        ['netflix-streaming-subscription', 'netflix'],
        ['amazon-prime-streaming', 'prime-video'],
        ['disney-hotstar', 'hotstar'],
        ['spotify-premium', 'spotify'],
        ['youtube-premium'],
        ['nordvpn']
    ];
    const productKey = (p) => String(p.slug || p.id || '').toLowerCase();
    const isVisibleForRegion = (p) => {
        if (typeof isProductVisibleForCurrentRegion === 'function') {
            return isProductVisibleForCurrentRegion(p);
        }
        const lock = (p.region_lock || 'all').toLowerCase();
        if (lock === 'india' && _currentCurrency === 'USD') return false;
        if (lock === 'international' && _currentCurrency === 'INR') return false;
        return true;
    };

    const baseActive = getAllProducts().filter(p =>
        p.isActive !== false &&
        p.variants &&
        p.variants.length > 0
    );
    const allActive = baseActive.filter(isVisibleForRegion);

    // 1. Homepage is intentionally curated to match the premium reference row.
    // The items still come from the live backend catalog so checkout SKUs remain trusted.
    const byKey = new Map(allActive.map(p => [productKey(p), p]));
    let hotProducts = referenceDealOrder
        .map(keys => keys.map(k => byKey.get(k)).find(Boolean))
        .filter(Boolean);

    // 2. If an admin removes one of the reference deals, fill from real hot catalog items.
    if (hotProducts.length < 6) {
        const hotIds = new Set(hotProducts.map(p => p.id));
        const fillers = allActive
            .filter(p => !hotIds.has(p.id) && p.isHot === true)
            .sort((a, b) => {
                const av = getDefaultVariant(a);
                const bv = getDefaultVariant(b);
                const ad = av && av.originalPrice ? (1 - av.price / av.originalPrice) : 0;
                const bd = bv && bv.originalPrice ? (1 - bv.price / bv.originalPrice) : 0;
                return bd - ad;
            })
            .slice(0, 6 - hotProducts.length);
        hotProducts = hotProducts.concat(fillers);
    }

    if (hotProducts.length < 6) {
        const hotIds = new Set(hotProducts.map(p => p.id));
        const crossRegionFillers = allActive
            .filter(p => !hotIds.has(p.id))
            .filter(p => !referenceDealSlugs.includes(productKey(p)) || p.isActive !== false)
            .sort((a, b) => {
                const av = getDefaultVariant(a);
                const bv = getDefaultVariant(b);
                const ad = av && av.originalPrice ? (1 - av.price / av.originalPrice) : 0;
                const bd = bv && bv.originalPrice ? (1 - bv.price / bv.originalPrice) : 0;
                return bd - ad;
            })
            .slice(0, 6 - hotProducts.length);
        hotProducts = hotProducts.concat(crossRegionFillers);
    }

    hotProducts = hotProducts.slice(0, 6);

    // 3. Hide section if no products qualify
    const section = document.getElementById('trendingSection');
    if (hotProducts.length === 0) {
        if (section) section.style.display = 'none';
        return;
    }
    if (section) section.style.display = 'block';

    // 4. Render homepage cards in the same detected currency as category/product pages.
    grid.innerHTML = hotProducts.map((p, index) => renderProductCard(p, index)).join('');

    if (window.lucide) lucide.createIcons();
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
        // Could update site name, social links, etc. dynamically here
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

    const items = getAllProducts().filter(p => p.category === category);

    grid.innerHTML = items.map((p, index) => renderProductCard(p, index)).join('');

    // Re-init lucide icons
    if (window.lucide) lucide.createIcons();
}

/** Render a single product card — shared by renderCategory and renderHotDeals */
function renderProductCard(p, index = 99) {
    try {
        // Skip products without variants (corrupted overrides)
        if (!p.variants || !p.variants.length) return '';

        // Region filtering: hide products that don't match the user's detected currency/region
        if (typeof isProductVisibleForCurrentRegion === 'function') {
            if (!isProductVisibleForCurrentRegion(p)) return '';
        } else {
            var lock = (p.region_lock || 'all').toLowerCase();
            if (lock === 'india' && _currentCurrency === 'USD') return '';       // India-only → hide from USD users
            if (lock === 'international' && _currentCurrency === 'INR') return ''; // International-only → hide from INR users
        }

        // Get the default variant for initial display
        const dv = getDefaultVariant(p);
        if (!dv) return '';

        const accessTypes = getAccessTypes(p);

        // Initialize card selection
        if (!cardSelections[p.id]) {
            cardSelections[p.id] = {
                accessType: dv.accessType,
                quality: dv.quality,
                duration: dv.duration,
            };
        }
        const sel = cardSelections[p.id];
        if (!accessTypes.includes(sel.accessType)) {
            sel.accessType = dv.accessType;
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
        const disc = cvOrigPrice > 0 ? Math.round((1 - cvPrice / cvOrigPrice) * 100) : 0;

        let accessHTML = '';
        if (accessTypes && accessTypes.length > 1) {
            accessHTML = `<div class="p-card-switch-block"><div class="p-card-switch-label">Plan</div><div class="v-selector v-access" data-pid="${p.id}" aria-label="Choose plan type">
                ${accessTypes.map(a => {
                    const label = a === 'personal' ? 'Private' : 'Shared';
                    const icon = a === 'personal' ? 'user' : 'users';
                    return `<button type="button" class="v-pill ${a === cv.accessType ? 'active' : ''}" data-val="${a}" onclick="changeAccess('${p.id}','${a}')" aria-pressed="${a === cv.accessType}"><i data-lucide="${icon}"></i>${label}</button>`;
                }).join('')}
            </div></div>`;
        }

        // Build quality selector (if applicable)
        const qualities = getQualities(p, sel.accessType);
        let qualityHTML = '';
        if (qualities && qualities.length > 1) {
            qualityHTML = `<div class="p-card-switch-block"><div class="p-card-switch-label">Quality</div><div class="v-selector v-quality" data-pid="${p.id}" aria-label="Choose quality">
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
        const imageLoading = index < 6 ? 'eager' : 'lazy';
        const imagePriority = index < 2 ? ' fetchpriority="high"' : '';
        const imgContent = cardImg
            ? `<img src="${cardImg}" alt="${p.name}" loading="${imageLoading}" decoding="async" width="96" height="96"${imagePriority}>`
            : `<span class="p-emoji-large">${p.emoji || '📦'}</span>`;

        // Savings amount
        const currentPrice = typeof getVariantPrice === 'function' ? getVariantPrice(cv) : (parseFloat(cv.price) || 0);
        const originalPrice = typeof getVariantOriginalPrice === 'function' ? getVariantOriginalPrice(cv) : (parseFloat(cv.originalPrice || cv.original_price) || 0);
        const savedAmt = Math.max(0, originalPrice - currentPrice);
        const planSpecifics = [cv.durationLabel, cv.accessType || sel.accessType || 'Shared']
            .filter(Boolean)
            .map(x => String(x).replace(/^\w/, c => c.toUpperCase()))
            .join(' - ');
        const hasOptionClass = optionHTML ? 'has-plan-options' : '';

        return `
        <div class="p-card ${hiddenClass} ${hasOptionClass} tilt-card trending-card" data-id="${p.id}" data-sku="${cv.sku}">
            <a href="/product/${p.slug || p.id}" class="p-card-image" style="display:block; text-decoration:none;">
                <div class="p-card-badges">
                    ${p.isHot ? '<span class="p-badge popular"><i data-lucide="star"></i> Most Popular</span>' : ''}
                    <span class="p-badge discount">${disc}% OFF</span>
                </div>
                ${imgContent}
            </a>
            <div class="p-card-body">
                <a href="/product/${p.slug || p.id}" style="text-decoration:none; display:block;"><div class="p-name">${p.name}</div></a>
                <div class="p-plan-line">${planSpecifics}</div>
                ${optionHTML}
                
                <ul class="p-features">
                    ${feats.slice(0, 3).map(f => `<li>${f}</li>`).join('')}
                </ul>
                
                <div class="p-bottom">
                    <div>
                        <div class="p-price-old">${displaySymbol}${displayOriginalPrice}</div>
                        <div class="p-price">${displaySymbol}${displayPrice}<small>/${cv.durationLabel.toLowerCase()}</small><span class="p-savings">Save ${displaySymbol}${_currentCurrency === 'USD' ? savedAmt.toFixed(2) : savedAmt.toLocaleString('en-IN')}</span></div>
                    </div>
                    <div class="p-buttons">
                        <button class="buy-btn" onclick="buyProduct('${cv.sku}')">Buy Now</button>
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
    renderAllProducts();
}

function changeQuality(pid, quality) {
    cardSelections[pid].quality = quality;
    const p = getAllProducts().find(x => x.id === pid);
    if (p) {
        const durs = getDurations(p, cardSelections[pid].accessType, quality);
        if (!durs.includes(cardSelections[pid].duration)) {
            cardSelections[pid].duration = durs[0];
        }
    }
    renderAllProducts();
}

function changeDuration(pid, duration) {
    cardSelections[pid].duration = duration;
    renderAllProducts();
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
    if (toastMsg) toastMsg.textContent = `${variant.durationLabel} added to cart`;
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
        if (window.lucide) lucide.createIcons();
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
                <span class="cart-item-emoji">${imgSrc ? `<img src="${imgSrc}" alt="${product.name}" style="width:32px;height:32px;border-radius:8px;object-fit:cover;">` : product.emoji}</span>
                <div class="cart-item-info">
                    <div class="cart-item-name">${product.name}</div>
                    <div class="cart-item-plan">${variant.accessType} &middot; ${variant.durationLabel}${variant.quality ? ' &middot; ' + variant.quality : ''}</div>
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
        return `
        <div class="cp-card" data-id="${p.id}" onclick="toggleCombo('${p.id}')">
            <span class="cp-emoji">${p.img ? `<img src="${p.img}" alt="${p.name}" style="width:28px;height:28px;border-radius:6px;object-fit:cover;">` : p.emoji}</span>
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
                subtotal += dv.price;
                rows.push(`<div class="ci-row"><span>${p.img ? '<img src="'+p.img+'" style="width:16px;height:16px;border-radius:4px;vertical-align:middle;margin-right:4px;">' : p.emoji} ${p.name}</span><span>${getCurrencySymbol()}${getFormattedPrice(dv)}</span></div>`);
            }
        }
    });

    const discPct = picked.size >= 10 ? 25 : picked.size >= 7 ? 20 : picked.size >= 5 ? 15 : 10;
    const discAmt = Math.round(subtotal * discPct / 100);
    const total = subtotal - discAmt;

    itemsEl.innerHTML = rows.join('');
    document.getElementById('comboSubtotal').textContent = `${getCurrencySymbol()}${subtotal}`;
    document.getElementById('comboDiscount').textContent = `-${getCurrencySymbol()}${discAmt} (${discPct}%)`;
    document.getElementById('comboTotal').textContent = `${getCurrencySymbol()}${total}`;

    totals.style.display = 'block';
    buyBtn.style.display = 'flex';

    if (window.lucide) lucide.createIcons();
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
    if (window.lucide) lucide.createIcons();
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

    input.addEventListener('input', e => {
        const q = e.target.value.toLowerCase().trim();
        if (q.length < 2) { dd.classList.remove('open'); return; }

        const matches = getAllProducts().filter(p =>
            p.name.toLowerCase().includes(q) || p.category.includes(q)
        ).slice(0, 5);

        if (!matches.length) {
            dd.innerHTML = '<div class="sd-item">No results</div>';
        } else {
            dd.innerHTML = matches.map(p => {
                const dv = getDefaultVariant(p);
                return `
                <div class="sd-item" data-cat="${p.category}">
                    <span class="sd-emoji">${p.img ? '<img src="'+p.img+'" style="width:20px;height:20px;border-radius:4px;">' : p.emoji}</span>
                    <span>${p.name}</span>
                    <span class="sd-price">From ${getCurrencySymbol()}${dv ? getFormattedPrice(dv) : '?'}</span>
                </div>
            `}).join('');
        }
        dd.classList.add('open');

        // Attach click handlers via event delegation
        dd.querySelectorAll('.sd-item[data-cat]').forEach(item => {
            item.addEventListener('click', function(ev) {
                ev.preventDefault();
                ev.stopPropagation();
                scrollToSection(this.dataset.cat);
            });
        });
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
        toggle.addEventListener('click', () => {
            nav.classList.toggle('open');
            toggle.setAttribute('aria-expanded', nav.classList.contains('open') ? 'true' : 'false');
        });
        // Close nav when a link is clicked
        nav.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => nav.classList.remove('open'));
        });
    }

    // ─── Update Login button if user is already logged in ───
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
        if (window.lucide) lucide.createIcons();
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
   SCROLL ANIMATIONS — Wow Factor
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
