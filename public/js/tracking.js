(function () {
    'use strict';

    var GTM_ID = 'GTM-N5257L2M';
    var META_PIXEL_ID = '878611847969093';
    var gtmLoaded = false;
    var metaLoaded = false;
    var queuedPageView = false;

    window.dataLayer = window.dataLayer || [];

    if (!window.fbq) {
        var fbq = window.fbq = function () {
            fbq.callMethod ? fbq.callMethod.apply(fbq, arguments) : fbq.queue.push(arguments);
        };
        if (!window._fbq) window._fbq = fbq;
        fbq.push = fbq;
        fbq.loaded = true;
        fbq.version = '2.0';
        fbq.queue = [];
    }

    function appendScript(src) {
        if (!src || document.querySelector('script[src="' + src + '"]')) return;
        var script = document.createElement('script');
        script.async = true;
        script.src = src;
        (document.head || document.documentElement).appendChild(script);
    }

    function loadMetaPixel() {
        if (metaLoaded) return;
        metaLoaded = true;
        if (!window.fbq.__getottsPixelInit) {
            window.fbq('init', META_PIXEL_ID);
            window.fbq.__getottsPixelInit = true;
        }
        appendScript('https://connect.facebook.net/en_US/fbevents.js');

        if (!queuedPageView) {
            queuedPageView = true;
            window.fbq('track', 'PageView');
        }
    }

    function loadMarketingTags() {
        if (!gtmLoaded) {
            gtmLoaded = true;
            window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
            appendScript('https://www.googletagmanager.com/gtm.js?id=' + encodeURIComponent(GTM_ID));
        }
        loadMetaPixel();
    }

    function scheduleIdleLoad() {
        window.setTimeout(function () {
            if ('requestIdleCallback' in window) {
                window.requestIdleCallback(loadMarketingTags, { timeout: 2500 });
            } else {
                loadMarketingTags();
            }
        }, 2500);
    }

    function onFirstInteraction() {
        loadMarketingTags();
        ['pointerdown', 'keydown', 'touchstart', 'scroll'].forEach(function (eventName) {
            window.removeEventListener(eventName, onFirstInteraction, { passive: true });
        });
    }

    window.getottsLoadMarketingTags = loadMarketingTags;
    window.getottsTrack = function (eventName, params, options) {
        if (!eventName) return;
        loadMetaPixel();
        window.dataLayer.push({
            event: 'meta_' + String(eventName).replace(/[^a-zA-Z0-9_]/g, '_'),
            meta_event_name: eventName,
            meta_event_params: params || {}
        });
        window.fbq('track', eventName, params || {}, options || {});
    };

    ['pointerdown', 'keydown', 'touchstart', 'scroll'].forEach(function (eventName) {
        window.addEventListener(eventName, onFirstInteraction, { once: true, passive: true });
    });

    if (document.readyState === 'complete') scheduleIdleLoad();
    else window.addEventListener('load', scheduleIdleLoad, { once: true });
})();
