/* ============================================
   GetOTTs — Frontend Configuration
   Central config for API URLs and environment.
   ============================================ */

const CONFIG = {
    // ---- API Backend URL ----
    API_BASE: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:8000/api/v1'
        : 'https://api.getotts.com/api/v1',

    TURNSTILE_SITE_KEY: 'YOUR_TURNSTILE_SITE_KEY',

    // ---- PayGate URL & Global API Key ----
    PAYGATE_FALLBACK: window.location.hostname === 'localhost'
        ? 'http://localhost:3000'
        : 'https://paygate.getotts.com',
    PAYGATE_API_KEY: 'YOUR_PAYGATE_PUBLIC_KEY',

    // ---- Supabase (Customer Auth) ----
    SUPABASE_URL: 'YOUR_SUPABASE_URL',
    SUPABASE_ANON_KEY: 'YOUR_SUPABASE_ANON_KEY',

    // ---- Environment ----
    IS_LOCAL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1',
    IS_PRODUCTION: window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1',

    // ---- Site Info ----
    SITE_NAME: 'GetOTTs',
    VERSION: '3.0.0',

    // ---- WhatsApp Monitor Service ----
    WA_MONITOR_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:3100'
        : 'https://wa.getotts.com',
    // ---- Site Contact ----
    ADMIN_WHATSAPP: '919088212294', // Change this to your international number
};

// Make it globally available
window.GETOTTS_CONFIG = CONFIG;
