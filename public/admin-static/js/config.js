/* ============================================
   GetOTTs — Frontend Configuration
   Central config for API URLs and environment.
   ============================================ */

const IS_LOCAL_HOST = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const IS_ADMIN_PAGE = window.location.pathname.startsWith('/admin') || window.location.pathname.startsWith('/adminno881');
const SAME_ORIGIN_API_BASE = `${window.location.origin}/api/v1`;

const CONFIG = {
    // ---- API Backend URL ----
    API_BASE: IS_ADMIN_PAGE || IS_LOCAL_HOST
        ? SAME_ORIGIN_API_BASE
        : 'https://api.getotts.com/api/v1',

    TURNSTILE_SITE_KEY: 'YOUR_TURNSTILE_SITE_KEY',

    // ---- PayGate URL & Global API Key ----
    PAYGATE_FALLBACK: IS_LOCAL_HOST
        ? 'http://localhost:3000'
        : 'https://paygate.getotts.com',
    PAYGATE_API_KEY: 'YOUR_PAYGATE_PUBLIC_KEY',

    // ---- Supabase (Customer Auth) ----
    SUPABASE_URL: 'YOUR_SUPABASE_URL',
    SUPABASE_ANON_KEY: 'YOUR_SUPABASE_ANON_KEY',

    // ---- Environment ----
    IS_LOCAL: IS_LOCAL_HOST,
    IS_PRODUCTION: !IS_LOCAL_HOST,

    // ---- Site Info ----
    SITE_NAME: 'GetOTTs',
    VERSION: '3.0.0',

    // ---- WhatsApp Monitor Service ----
    WA_MONITOR_URL: IS_ADMIN_PAGE
        ? `${window.location.origin}/api/v1/wa-monitor`
        : IS_LOCAL_HOST
        ? 'http://localhost:3100'
        : 'https://wa.getotts.com',
};

// Make it globally available
window.GETOTTS_CONFIG = CONFIG;

