/* ============================================
   GetOTTs - Product Data Layer v7 (Cached + Fallback)
   Primary: Fetches from Supabase API
   Fallback: Built-in catalog if API is down or empty
   Session-cached to reduce Supabase egress.
   ============================================ */

// Hardcoded fallback catalog - used when DB is empty or API unreachable
const FALLBACK_PRODUCTS = [
    // === STREAMING ===
    {
        id: 'netflix', slug: 'netflix-streaming-subscription', name: 'Netflix Premium', category: 'streaming',
        img: 'assets/images/brand-netflix.webp', emoji: '\u{1F3AC}',
        description: 'Stream unlimited movies & TV shows', isHot: true,
        gradient: 'linear-gradient(135deg, #e50914, #b20710)',
        features: {
            shared: ['Shared profile option', 'Private profile in shared account', 'Full HD streaming', 'Manual delivery support']
        },
        variants: [
            { sku: 'netflix-streaming-subscription-shared-profile-1m',  accessType: 'shared', quality: 'Shared Profile',  duration: 1, durationLabel: '1 Month', price: 99,  originalPrice: 699, price_usd: 2.00, original_price_usd: 25.00, stock: 10 },
            { sku: 'netflix-streaming-subscription-private-profile-1m', accessType: 'shared', quality: 'Private Profile', duration: 1, durationLabel: '1 Month', price: 159, originalPrice: 699, price_usd: 3.00, original_price_usd: 25.00, stock: 10 },
        ],
    },
    {
        id: 'prime-video-global', slug: 'prime-video-global', name: 'Prime Video (Global)', category: 'streaming',
        region_lock: 'all',
        img: 'assets/images/brand-prime.webp', emoji: '\u25B6',
        description: 'Premium Prime Video global plans with manual delivery support.', isHot: false,
        gradient: 'linear-gradient(135deg, #00a8e1, #0b3f6f)',
        features: {
            shared: ['Shared access', 'Manual delivery support', 'Replacement support'],
            personal: ['Private account', 'Manual delivery support', 'Replacement support']
        },
        variants: [
            { sku: 'prime-video-global-personal-1m', accessType: 'personal', quality: null, duration: 1, durationLabel: '1 Month', price: 59, originalPrice: 799, price_usd: 2.00, original_price_usd: 9.00, stock: 10 },
            { sku: 'prime-video-global-personal-3m', accessType: 'personal', quality: null, duration: 3, durationLabel: '3 Months', price: 189, originalPrice: 2299, price_usd: 4.00, original_price_usd: 27.00, stock: 10 },
            { sku: 'prime-video-global-personal-6m', accessType: 'personal', quality: null, duration: 6, durationLabel: '6 Months', price: 299, originalPrice: 4599, price_usd: 6.00, original_price_usd: 54.00, stock: 10 },
            { sku: 'prime-video-global-shared-1m', accessType: 'shared', quality: null, duration: 1, durationLabel: '1 Month', price: 199, originalPrice: 799, price_usd: 3.00, original_price_usd: 9.00, stock: 10 },
        ],
    },
    {
        id: 'hotstar', slug: 'disney-hotstar', name: 'Disney+ Hotstar', category: 'streaming',
        img: 'assets/images/brand-hotstar.webp', emoji: '\u2B50',
        description: 'Cricket, Marvel, Disney - all live', isHot: true,
        gradient: 'linear-gradient(135deg, #1f2c93, #09162a)',
        features: {
            shared: ['Super Plan Access', 'All Sports Live', 'Full Content Library', 'Instant Setup'],
            personal: ['Premium Plan', '4K Streaming', 'All Devices', 'On Your Number']
        },
        variants: [
            { sku: 'hotstar-shared-1m',    accessType: 'shared',   quality: '1080', duration: 1,  durationLabel: '1 Month',  price: 39,   originalPrice: 149,  stock: 1 },
            { sku: 'hotstar-shared-3m',    accessType: 'shared',   quality: null, duration: 3,  durationLabel: '3 Months', price: 179,  originalPrice: 897,  stock: 35 },
            { sku: 'hotstar-shared-12m',   accessType: 'shared',   quality: null, duration: 12, durationLabel: '1 Year',   price: 549,  originalPrice: 1499, stock: 20 },
            { sku: 'hotstar-personal-1m',  accessType: 'personal', quality: null, duration: 1,  durationLabel: '1 Month',  price: 199,  originalPrice: 299,  stock: 25 },
            { sku: 'hotstar-personal-12m', accessType: 'personal', quality: null, duration: 12, durationLabel: '1 Year',   price: 999,  originalPrice: 1499, stock: 10 },
        ],
    },
    {
        id: 'crunchyroll', name: 'Crunchyroll', category: 'streaming',
        img: 'assets/images/brand-crunchyroll.svg', emoji: 'Anime',
        description: 'Anime streaming with shared profile, private profile and on-mail access', isHot: false,
        gradient: 'linear-gradient(135deg, #ff8a00, #f15a24)',
        features: {
            shared: ['Shared profile option', 'Private profile in shared account', 'Anime streaming access', 'Manual delivery support'],
            personal: ['Own email / on-mail access', '1 month personal plan only', 'Anime streaming access', 'Manual setup support']
        },
        variants: [
            { sku: 'crunchyroll-shared-profile-1m',  accessType: 'shared',   quality: 'Shared Profile',  duration: 1, durationLabel: '1 Month',  price: 29, originalPrice: 99,  price_usd: 1.00, original_price_usd: 9.99,  stock: 30 },
            { sku: 'crunchyroll-shared-profile-2m',  accessType: 'shared',   quality: 'Shared Profile',  duration: 2, durationLabel: '2 Months', price: 49, originalPrice: 198, price_usd: 1.75, original_price_usd: 19.98, stock: 24 },
            { sku: 'crunchyroll-shared-profile-3m',  accessType: 'shared',   quality: 'Shared Profile',  duration: 3, durationLabel: '3 Months', price: 69, originalPrice: 297, price_usd: 2.50, original_price_usd: 29.97, stock: 18 },
            { sku: 'crunchyroll-private-profile-1m', accessType: 'shared',   quality: 'Private Profile', duration: 1, durationLabel: '1 Month',  price: 49, originalPrice: 99,  price_usd: 2.00, original_price_usd: 9.99,  stock: 24 },
            { sku: 'crunchyroll-private-profile-2m', accessType: 'shared',   quality: 'Private Profile', duration: 2, durationLabel: '2 Months', price: 89, originalPrice: 198, price_usd: 3.50, original_price_usd: 19.98, stock: 18 },
            { sku: 'crunchyroll-private-profile-3m', accessType: 'shared',   quality: 'Private Profile', duration: 3, durationLabel: '3 Months', price: 129, originalPrice: 297, price_usd: 5.00, original_price_usd: 29.97, stock: 12 },
            { sku: 'crunchyroll-on-mail-1m',         accessType: 'personal', quality: 'On Mail',         duration: 1, durationLabel: '1 Month',  price: 69, originalPrice: 99,  price_usd: 3.00, original_price_usd: 9.99,  stock: 10 },
        ],
    },
    {
        id: 'apple-music', name: 'Apple Music', category: 'music',
        img: 'assets/images/brand-apple-music.svg', emoji: 'Music',
        description: 'Apple Music access for 6 months', isHot: false,
        gradient: 'linear-gradient(135deg, #fb5a7c, #7c3aed)',
        features: { shared: ['Apple Music access', '6 months listening', 'Lossless and spatial audio where available', 'Manual delivery support'] },
        variants: [
            { sku: 'apple-music-shared-6m', accessType: 'shared', quality: null, duration: 6, durationLabel: '6 Months', price: 199, originalPrice: 599, stock: 20 },
        ],
    },
    {
        id: 'zee5', name: 'ZEE5 Premium', category: 'streaming',
        img: 'assets/images/brand-zee5.svg', emoji: 'ZEE5',
        description: 'Bollywood, originals & live TV', isHot: false,
        gradient: 'linear-gradient(135deg, #8232be, #5b1c91)',
        features: {
            shared: ['Shared profile options', 'Private profile upgrade', 'Manual delivery support', 'Replacement support'],
            personal: ['On-number activation', 'Auto-renews for 1 year', 'App may show 1 month', 'Full 1 year warranty']
        },
        variants: [
            { sku: 'zee5-shared-profile-1m',   accessType: 'shared',   quality: 'Shared Profile',  duration: 1,  durationLabel: '1 Month',          price: 49,  originalPrice: 149,  stock: 35 },
            { sku: 'zee5-shared-profile-3m',   accessType: 'shared',   quality: 'Shared Profile',  duration: 3,  durationLabel: '3 Months',         price: 119, originalPrice: 447,  stock: 24 },
            { sku: 'zee5-shared-profile-12m',  accessType: 'shared',   quality: 'Shared Profile',  duration: 12, durationLabel: '1 Year',           price: 349, originalPrice: 999,  stock: 18 },
            { sku: 'zee5-private-profile-1m',  accessType: 'shared',   quality: 'Private Profile', duration: 1,  durationLabel: '1 Month',          price: 59,  originalPrice: 199,  stock: 30 },
            { sku: 'zee5-private-profile-3m',  accessType: 'shared',   quality: 'Private Profile', duration: 3,  durationLabel: '3 Months',         price: 149, originalPrice: 597,  stock: 20 },
            { sku: 'zee5-private-profile-12m', accessType: 'shared',   quality: 'Private Profile', duration: 12, durationLabel: '1 Year',           price: 439, originalPrice: 1199, stock: 12 },
            { sku: 'zee5-on-number-12m',       accessType: 'personal', quality: 'On Number',       duration: 12, durationLabel: '1 Year Auto-Renew', price: 799, originalPrice: 1499, stock: 10 },
        ],
    },
    {
        id: 'sonyliv', name: 'SonyLIV Premium', category: 'streaming',
        img: 'assets/images/brand-sonyliv.svg', emoji: 'SonyLIV',
        description: 'KBC, UEFA & Sony originals', isHot: false,
        gradient: 'linear-gradient(135deg, #000000, #333333)',
        features: {
            shared: ['Shared profile option', 'Private profile in shared account', 'Manual delivery support', 'Replacement support'],
            personal: ['On-number activation', 'Private access on your number', 'Manual setup support', 'Replacement support']
        },
        variants: [
            { sku: 'sonyliv-shared-profile-1m',  accessType: 'shared',   quality: 'Shared Profile',  duration: 1, durationLabel: '1 Month', price: 19, originalPrice: 199, stock: 40 },
            { sku: 'sonyliv-private-profile-1m', accessType: 'shared',   quality: 'Private Profile', duration: 1, durationLabel: '1 Month', price: 39, originalPrice: 299, stock: 30 },
            { sku: 'sonyliv-on-number-1m',       accessType: 'personal', quality: 'On Number',       duration: 1, durationLabel: '1 Month', price: 59, originalPrice: 399, stock: 20 },
        ],
    },
    {
        id: 'apple-tv', name: 'Apple TV+', category: 'streaming',
        img: 'assets/images/appletv.webp', emoji: '\u{1F34E}',
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
        id: 'spotify', slug: 'spotify-premium', name: 'Spotify Premium', category: 'music',
        img: 'assets/images/brand-spotify.webp', emoji: '\u{1F3B5}',
        description: 'Ad-free music, offline downloads', isHot: true,
        gradient: 'linear-gradient(135deg, #1db954, #148a3c)',
        features: {
            shared: ['Ad-Free Listening', 'Offline Downloads', 'High Quality Audio', 'Instant Activation'],
            personal: ['Own Account', 'All Devices', 'Spotify Connect', 'On Your Number']
        },
        variants: [
            { sku: 'spotify-premium-personal-3m', accessType: 'personal', quality: null, duration: 3, durationLabel: '3 Months', price: 149, originalPrice: 719, stock: 10 },
            { sku: 'spotify-shared-1m',    accessType: 'shared',   quality: null, duration: 1,  durationLabel: '1 Month',  price: 59,   originalPrice: 119,  stock: 60 },
            { sku: 'spotify-shared-3m',    accessType: 'shared',   quality: null, duration: 3,  durationLabel: '3 Months', price: 149,  originalPrice: 357,  stock: 40 },
            { sku: 'spotify-shared-12m',   accessType: 'shared',   quality: null, duration: 12, durationLabel: '1 Year',   price: 499,  originalPrice: 1428, stock: 20 },
            { sku: 'spotify-personal-1m',  accessType: 'personal', quality: null, duration: 1,  durationLabel: '1 Month',  price: 99,   originalPrice: 119,  stock: 30 },
            { sku: 'spotify-personal-3m',  accessType: 'personal', quality: null, duration: 3,  durationLabel: '3 Months', price: 269,  originalPrice: 357,  stock: 20 },
            { sku: 'spotify-personal-12m', accessType: 'personal', quality: null, duration: 12, durationLabel: '1 Year',   price: 899,  originalPrice: 1428, stock: 10 },
        ],
    },
    {
        id: 'youtube-premium', slug: 'youtube-premium', name: 'YouTube Premium', category: 'music',
        img: 'assets/images/youtube.webp', emoji: '\u25B6\uFE0F',
        description: 'Ad-free YouTube + YouTube Music', isHot: false,
        gradient: 'linear-gradient(135deg, #ff0000, #cc0000)',
        features: {
            shared: ['No Ads on YouTube', 'YouTube Music', 'Background Play', 'Downloads'],
            personal: ['Own Account', 'All Features', 'YouTube Music Premium', 'On Your Number']
        },
        variants: [
            { sku: 'youtube-premium-personal-1m', accessType: 'personal', quality: null, duration: 1, durationLabel: '1 Month', price: 19, originalPrice: 149, stock: 10 },
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
        img: 'assets/images/chatgpt.webp', emoji: '\u{1F916}',
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
        id: 'gemini-ai-pro', slug: 'google-gemini', name: 'Gemini AI Pro 18 Months - Google One Premium with 5TB Storage & Advanced AI Features', category: 'ai',
        img: 'assets/images/brand-gemini.svg', emoji: '\u{1F916}',
        description: 'Gemini AI Pro with Google One Premium and 5TB storage, activated through an invite link.', isHot: false,
        region_lock: 'all',
        delivery_mode: 'automatic',
        auth_type: 'invite_link',
        gradient: 'linear-gradient(135deg, #4285f4, #a855f7)',
        features: { personal: ['Activation / invite link', 'No payment method required', 'Google One Premium access', '5TB cloud storage'] },
        variants: [
            { sku: 'c5f1c261-1c2a-4f96-ac6b-ab7bf2ab60f8-mpvhmlfz', accessType: 'personal', quality: null, duration: 18, durationLabel: '18 Months', price: 999, originalPrice: 34999, price_usd: 14.99, original_price_usd: 289.99, stock: 48 },
        ],
    },
    {
        id: 'canva-invite', slug: 'canva-invite', name: 'Canva Invite', category: 'ai',
        img: 'assets/images/canva.webp', emoji: 'Canva',
        description: 'Premium Canva invite access with automatic delivery.', isHot: true,
        region_lock: 'all',
        delivery_mode: 'automatic',
        auth_type: 'invite_link',
        gradient: 'linear-gradient(135deg, #00c4cc, #7d2ae8)',
        features: {
            shared: ['Invite link delivery', 'Affordable shared plan', 'Support included'],
            personal: ['Invite link delivery', 'Private plan', 'Support included']
        },
        variants: [
            { sku: 'canva-invite-personal-12m', accessType: 'personal', quality: null, duration: 12, durationLabel: '1 Year', price: 299, originalPrice: 4500, price_usd: 5.00, original_price_usd: 120.00, stock: 10 },
            { sku: 'canva-invite-shared-12m', accessType: 'shared', quality: null, duration: 12, durationLabel: '1 Year', price: 49, originalPrice: 4500, price_usd: 2.00, original_price_usd: 120.00, stock: 10 },
        ],
    },
    {
        id: 'midjourney', name: 'Midjourney', category: 'ai',
        img: 'assets/images/canva.webp', emoji: '\u{1F3A8}',
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
        img: 'assets/images/claude.webp', emoji: '\u{1F50D}',
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
        id: 'nordvpn', slug: 'nordvpn', name: 'NordVPN', category: 'vpn',
        img: 'assets/images/nordvpn.webp', emoji: '\u{1F512}',
        description: 'Ultra-secure VPN, 6000+ servers', isHot: false,
        gradient: 'linear-gradient(135deg, #4687ff, #305cc3)',
        features: { shared: ['6000+ Servers', 'No-Log Policy', 'Kill Switch', '6 Devices'] },
        variants: [
            { sku: 'nordvpn-personal-3m', accessType: 'personal', quality: null, duration: 3, durationLabel: '3 Months', price: 999, originalPrice: 1999, stock: 10 },
            { sku: 'nordvpn-shared-1m',  accessType: 'shared', quality: null, duration: 1,  durationLabel: '1 Month',  price: 99,  originalPrice: 999, stock: 25 },
            { sku: 'nordvpn-shared-6m',  accessType: 'shared', quality: null, duration: 6,  durationLabel: '6 Months', price: 449, originalPrice: 5994,stock: 15 },
            { sku: 'nordvpn-shared-12m', accessType: 'shared', quality: null, duration: 12, durationLabel: '1 Year',   price: 799, originalPrice: 11988,stock: 10 },
        ],
    },
    // === GIFT CARDS ===
    {
        id: 'google-play', name: 'Google Play Gift Card', category: 'gift-cards',
        img: 'assets/images/brand-google-play.svg', emoji: '\u{1F381}',
        description: 'Apps, games, movies & more', isHot: false,
        gradient: 'linear-gradient(135deg, #34a853, #0f9d58)',
        features: { shared: ['Instant Email Delivery', 'Use for Apps & Games', 'No Expiry', 'India Region'] },
        variants: [
            { sku: 'gplay-100', accessType: 'shared', quality: null, duration: 1, durationLabel: '\u20b9100 Card', price: 85,  originalPrice: 100, stock: 50 },
            { sku: 'gplay-250', accessType: 'shared', quality: null, duration: 1, durationLabel: '\u20b9250 Card', price: 215, originalPrice: 250, stock: 40 },
            { sku: 'gplay-500', accessType: 'shared', quality: null, duration: 1, durationLabel: '\u20b9500 Card', price: 425, originalPrice: 500, stock: 30 },
        ],
    },
];

// Live product array - starts with fallback, replaced by API data if available
let PRODUCTS = [...FALLBACK_PRODUCTS];

// Catalog loading state for UI feedback
let _catalogLoaded = false;
let _catalogError = null;
let _catalogSyncPromise = null;
let _catalogHydratedFromCache = false;
let _catalogRefreshScheduled = false;
let _lastCatalogDispatchSignature = '';
const CATALOG_CACHE_KEY = 'getotts_catalog_cache_v17_resilient_catalog';
const CATALOG_CACHE_MAX_AGE = 24 * 60 * 60 * 1000;
const GEO_CACHE_KEY = 'getotts_geo_cache_v1';
const GEO_CACHE_MAX_AGE = 30 * 60 * 1000;

function getCatalogDispatchSignature(products = []) {
    return products.map(product => [
        product?.id,
        product?.slug,
        product?.name,
        product?.img || product?.image || product?.logo || '',
        product?.isActive,
        product?.isHot,
        (Array.isArray(product?.variants) ? product.variants : []).map(variant => [
            variant?.sku,
            variant?.price,
            variant?.originalPrice || variant?.original_price || '',
            variant?.accessType || variant?.access_type || '',
            variant?.quality || '',
            variant?.duration || '',
            variant?.durationLabel || variant?.duration_label || ''
        ].join(':')).join('|')
    ].join('~')).join('||');
}

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

function keepOrRestoreUsableCatalog(reason) {
    const currentIsUsable = Array.isArray(PRODUCTS) && PRODUCTS.some(p => p && p.id && p.name && Array.isArray(p.variants) && p.variants.length > 0);
    if (currentIsUsable) {
        _catalogLoaded = true;
        _catalogError = reason || _catalogError;
        console.warn('[Catalog] Keeping current catalog:', reason || 'live catalog unavailable');
        return PRODUCTS;
    }

    const cached = readCachedCatalog();
    if (cached && cached.length > 0) {
        PRODUCTS = cached;
        _catalogLoaded = true;
        _catalogHydratedFromCache = true;
        _catalogError = reason || _catalogError;
        console.warn('[Catalog] Restored cached catalog:', reason || 'live catalog unavailable');
        return PRODUCTS;
    }

    PRODUCTS = [...FALLBACK_PRODUCTS];
    _catalogLoaded = true;
    _catalogHydratedFromCache = false;
    _catalogError = reason || _catalogError;
    console.warn('[Catalog] Using built-in fallback catalog:', reason || 'live catalog unavailable');
    return PRODUCTS;
}

function getottsCatalogHasLiveData() {
    return Boolean(_catalogLoaded && _catalogHydratedFromCache && Array.isArray(PRODUCTS) && PRODUCTS.length > 0);
}

function getottsCatalogIsResolved() {
    return Boolean(_catalogLoaded || _catalogError);
}

if (typeof window !== 'undefined') {
    window.getottsCatalogHasLiveData = getottsCatalogHasLiveData;
    window.getottsCatalogIsResolved = getottsCatalogIsResolved;
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
            // Empty API responses are unsafe for the storefront: Supabase/API outages
            // can look like an empty catalog. Keep the last good catalog or fallback.
            keepOrRestoreUsableCatalog('Live catalog returned empty');
        }

    } catch (err) {
        _catalogError = err;
        keepOrRestoreUsableCatalog(err);
    } finally {
        const nextSignature = getCatalogDispatchSignature(PRODUCTS);
        if (nextSignature !== _lastCatalogDispatchSignature) {
            _lastCatalogDispatchSignature = nextSignature;
            window.dispatchEvent(new CustomEvent('catalogUpdated', { detail: { products: PRODUCTS } }));
        }
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

function getVariantAccessType(variant) {
    return String(variant?.accessType || variant?.access_type || 'shared').trim().toLowerCase();
}

function getVariantAccessLabel(variantOrType, cardLabel = false) {
    const type = typeof variantOrType === 'string'
        ? variantOrType.trim().toLowerCase()
        : getVariantAccessType(variantOrType);
    if (type === 'personal' || type === 'private') return cardLabel ? 'Private' : 'Personal';
    if (type === 'family' || type === 'shared_family' || type === 'shared-family') return 'Family';
    if (type === 'mail' || type === 'email' || type === 'on_mail') return 'On Mail';
    if (type === 'number' || type === 'phone' || type === 'on_number') return 'On Number';
    if (type === 'link' || type === 'invite_link') return 'Invite Link';
    if (type === 'shared') return 'Shared';
    return type ? type.replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Shared';
}

function getVariantDurationMonths(variant) {
    const raw = variant?.duration_months ?? variant?.duration;
    const months = Number(raw);
    return Number.isFinite(months) && months > 0 ? months : null;
}

function formatDurationMonths(months) {
    const value = Number(months);
    if (!Number.isFinite(value) || value <= 0) return '';
    if (value % 12 === 0) {
        const years = value / 12;
        return years === 1 ? '1 Year' : `${years} Years`;
    }
    return value === 1 ? '1 Month' : `${value} Months`;
}

function getVariantDurationLabel(variant) {
    const months = getVariantDurationMonths(variant);
    const label = String(variant?.durationLabel || variant?.duration_label || '').trim();
    if (!months) return label || 'Plan';
    const labelMonths = /(\d+)\s*month/i.test(label) ? Number(label.match(/(\d+)\s*month/i)[1]) : null;
    const labelYears = /(\d+)\s*year/i.test(label) ? Number(label.match(/(\d+)\s*year/i)[1]) * 12 : null;
    const labelTotalMonths = labelMonths || labelYears;
    if (!label || (labelTotalMonths && labelTotalMonths !== months)) return formatDurationMonths(months);
    return label;
}

function getAccessTypes(product) {
    if (!product || !product.variants) return [];
    const types = [...new Set(product.variants.map(v => getVariantAccessType(v)))].filter(Boolean);
    return types.length ? types : ['shared'];
}

function getQualities(product, accessType) {
    if (!product || !product.variants) return [];
    return [...new Set(product.variants.filter(v => !accessType || getVariantAccessType(v) === accessType).map(v => v.quality))].filter(Boolean);
}

function getDurations(product, accessType, quality) {
    if (!product || !product.variants) return [];
    return product.variants
        .filter(v => (!accessType || getVariantAccessType(v) === accessType) && (!quality || v.quality === quality))
        .map(v => getVariantDurationMonths(v))
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
        (!accessType || getVariantAccessType(v) === accessType) &&
        (!quality || v.quality === quality) &&
        (!months || getVariantDurationMonths(v) == months)
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
                const currentTitle = (document.title || '').trim();
                const path = (window.location.pathname || '/').replace(/\/+$/, '') || '/';
                if (!currentTitle || currentTitle.includes('Premium OTT at Wholesale Prices')) {
                    document.title = path === '/'
                        ? `Buy OTT Subscriptions, AI Tools & VPN Deals - ${s.site_name}`
                        : `${s.site_name} - Premium Digital Subscriptions`;
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

function broadcastCurrencyChange(source) {
    try {
        window.dispatchEvent(new CustomEvent('getotts:currencychange', {
            detail: {
                source: source || 'geo',
                region: _currentRegion,
                currency: _currentCurrency
            }
        }));
    } catch (_) {}
}

function clearLegacyGeoCache() {
    try {
        sessionStorage.removeItem(GEO_CACHE_KEY);
        localStorage.removeItem(GEO_CACHE_KEY);
        sessionStorage.removeItem('getotts_region');
        localStorage.removeItem('getotts_region');
        sessionStorage.removeItem('getotts_currency');
        localStorage.removeItem('getotts_currency');
    } catch (_) {}
}

async function detectGeoAndCurrency(options) {
    options = options || {};
    if (options.force) _geoDetectPromise = null;
    clearLegacyGeoCache();
    const previousCurrency = _currentCurrency;
    const previousRegion = _currentRegion;
    // Always detect fresh from IP - ensures VPN/network changes are picked up immediately
    // Clear any stale storage from old implementations
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
        console.error('[GEO] All services failed - defaulting to INR');
    }

    if (countryCode === 'IN') {
        _currentRegion = 'IN';
        _currentCurrency = 'INR';
    } else {
        _currentRegion = 'GLOBAL';
        _currentCurrency = 'USD';
    }

    console.log('[GEO] Detected: ' + countryCode + ' | Currency: ' + _currentCurrency);
    if (_currentCurrency !== previousCurrency || _currentRegion !== previousRegion || options.force) {
        broadcastCurrencyChange('geo');
    }
}

function getCurrentRegion() {
    return _currentRegion;
}

function getCurrentCurrency() {
    return _currentCurrency;
}

function getGeoReadyPromise(options) {
    options = options || {};
    if (options.force) _geoDetectPromise = null;
    if (!_geoDetectPromise) {
        _geoDetectPromise = detectGeoAndCurrency(options);
    }
    return _geoDetectPromise;
}

window.getottsGeoReady = getGeoReadyPromise;

function getCurrencySymbol() {
    return _currentCurrency === 'USD' ? '$' : '\u20b9';
}

const INR_PER_USD = 85;

function getDualPriceText(valueInr, valueUsd) {
    var inr = parseFloat(valueInr) || 0;
    var usd = valueUsd !== undefined && valueUsd !== null && valueUsd !== ''
        ? parseFloat(valueUsd) || 0
        : inr / INR_PER_USD;
    return '\u20b9' + inr.toLocaleString('en-IN') + ' / $' + usd.toFixed(2);
}

function getDualVariantPrice(variant) {
    if (!variant) return '\u20b90 / $0.00';
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
        var inrOrig = parseFloat(variant.originalPrice || variant.original_price) || 0;
        if (inrOrig > 0) return (inrOrig / 85).toFixed(2);
        return null;
    }
    var inr = parseFloat(variant.originalPrice || variant.original_price) || 0;
    return inr > 0 ? inr : null;
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
        clearLegacyGeoCache();
        
        // Re-render storefront
        if (typeof renderAllProducts === 'function') renderAllProducts();
        if (typeof updateCartCount === 'function') updateCartCount();
        if (typeof initComboBuilder === 'function') initComboBuilder();
        
        // Re-render product detail page if on one
        if (typeof window._refreshProductPricing === 'function') window._refreshProductPricing();
        broadcastCurrencyChange('manual');
        
        console.log(`[Currency] Switched to ${currency}`);
    }
}

// Initial Sync
document.addEventListener('DOMContentLoaded', async () => {
    if (typeof updateCartCount === 'function') updateCartCount();
    if (typeof renderAllProducts === 'function' && !document.body?.classList.contains('home-page')) {
        renderAllProducts();
    }

    const refreshAfterPaint = async () => {
        try { await getGeoReadyPromise(); } catch (e) { console.warn('[GEO] Deferred detection failed:', e); }
        try { syncCatalogFromCloud(); } catch (e) { console.warn('[Catalog] Deferred sync start failed:', e); }
        try { syncGlobalSettings(); } catch (e) { console.warn('[Settings] Deferred sync start failed:', e); }
        if (typeof updateCartCount === 'function') updateCartCount();
        if (typeof renderAllProducts === 'function' && !document.body?.classList.contains('home-page')) {
            renderAllProducts();
        }
    };

    if (document.body?.classList.contains('home-page')) {
        const runHomeRefresh = () => setTimeout(refreshAfterPaint, 1800);
        ['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach(eventName => {
            window.addEventListener(eventName, refreshAfterPaint, { once: true, passive: true });
        });
        if (typeof requestIdleCallback === 'function') {
            requestIdleCallback(runHomeRefresh, { timeout: 3000 });
        } else {
            runHomeRefresh();
        }
    } else if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(refreshAfterPaint, { timeout: 3000 });
    } else {
        setTimeout(refreshAfterPaint, 1400);
    }
});
