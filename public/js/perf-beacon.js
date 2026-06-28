/* ============================================================
   GetOTTs — Performance Beacon (CLS / LCP / FCP / FOUC)
   v1 (2026-06-28). Zero deps. Logs to console + window.__perf
   and dispatches a "getotts:vitals" event you can hook to send
   to your VPS / analytics later.

   Console output is grouped per-page so layout jumps and slow
   LCPs are easy to spot in DevTools (look for [Perf] warnings).
   ============================================================ */
(function () {
    "use strict";
    if (window.__getottsPerf) return;
    window.__getottsPerf = true;

    /* ----- Sampling + bot guard (cost + abuse control) ----- */
    var host = location.hostname;
    var isLocal = host === "localhost" || host === "127.0.0.1" || host.endsWith(".local");
    var isBot = /bot|crawl|spider|headless|lighthouse|pagespeed|gtmetrix|preview/i.test(navigator.userAgent);
    // 100% sample locally, 10% in production. Bots never report.
    var SAMPLE_RATE = isLocal ? 1 : 0.1;
    var SHOULD_REPORT = !isBot && Math.random() < SAMPLE_RATE;
    function clip(s, n) { return (typeof s === "string" && s.length > n) ? s.slice(0, n) : s; }


    var page = location.pathname.replace(/\/+$/, "") || "/";
    var nav = (performance.getEntriesByType && performance.getEntriesByType("navigation")[0]) || {};
    var t0 = nav.startTime || 0;
    var vitals = {
        page: page,
        ts: Date.now(),
        ua: navigator.userAgent.slice(0, 120),
        viewport: window.innerWidth + "x" + window.innerHeight,
        dpr: window.devicePixelRatio || 1,
        fcp: null,    // First Contentful Paint
        lcp: null,    // Largest Contentful Paint (final)
        lcpEl: null,  // element selector / src
        cls: 0,       // Cumulative Layout Shift
        clsSources: [], // top shift offenders
        cssReady: null, // ms until .css-ready flipped (FOUC end)
        fouc: false,  // true if .fouc-timeout fallback fired
        ttfb: nav.responseStart ? Math.round(nav.responseStart - t0) : null,
        domReady: null,
        load: null
    };
    window.__perf = vitals;

    function selectorOf(el) {
        if (!el) return null;
        if (el.id) return "#" + el.id;
        var cls = (el.className && typeof el.className === "string") ? el.className.trim().split(/\s+/).slice(0,2).join(".") : "";
        return (el.tagName || "?").toLowerCase() + (cls ? "." + cls : "") + (el.src ? "[src=" + el.src.split("/").pop() + "]" : "");
    }

    function emit(label, value, extra) {
        var msg = "[Perf] " + label + ": " + (typeof value === "number" ? Math.round(value) + "ms" : value);
        var warn = (label === "LCP" && typeof value === "number" && value > 2500)
                || (label === "CLS" && typeof value === "number" && value > 0.1)
                || (label === "FOUC" && value === true);
        (warn ? console.warn : console.info)(msg, extra || "");
        try { window.dispatchEvent(new CustomEvent("getotts:vitals", { detail: { label: label, value: value, extra: extra, vitals: vitals } })); } catch (_) {}
    }

    /* ----- FCP & LCP via PerformanceObserver ----- */
    if ("PerformanceObserver" in window) {
        try {
            new PerformanceObserver(function (list) {
                list.getEntries().forEach(function (e) {
                    if (e.name === "first-contentful-paint") {
                        vitals.fcp = Math.round(e.startTime);
                        emit("FCP", vitals.fcp);
                    }
                });
            }).observe({ type: "paint", buffered: true });
        } catch (_) {}

        try {
            var lcpObs = new PerformanceObserver(function (list) {
                var entries = list.getEntries();
                var last = entries[entries.length - 1];
                vitals.lcp = Math.round(last.renderTime || last.loadTime || last.startTime);
                vitals.lcpEl = selectorOf(last.element) || last.url || null;
            });
            lcpObs.observe({ type: "largest-contentful-paint", buffered: true });
            // finalize LCP on first user interaction or page hide
            var finalizeLcp = function () {
                try { lcpObs.takeRecords(); lcpObs.disconnect(); } catch (_) {}
                if (vitals.lcp != null) emit("LCP", vitals.lcp, vitals.lcpEl);
            };
            ["keydown", "click", "visibilitychange"].forEach(function (ev) {
                addEventListener(ev, finalizeLcp, { once: true, capture: true });
            });
        } catch (_) {}

        /* ----- CLS (session-window v3, sum of largest window) ----- */
        try {
            var clsValue = 0, clsEntries = [];
            var sessionValue = 0, sessionEntries = [];
            new PerformanceObserver(function (list) {
                list.getEntries().forEach(function (entry) {
                    if (entry.hadRecentInput) return;
                    var first = sessionEntries[0];
                    var last = sessionEntries[sessionEntries.length - 1];
                    if (sessionEntries.length && (entry.startTime - last.startTime > 1000 || entry.startTime - first.startTime > 5000)) {
                        sessionValue = entry.value; sessionEntries = [entry];
                    } else {
                        sessionValue += entry.value; sessionEntries.push(entry);
                    }
                    if (sessionValue > clsValue) {
                        clsValue = sessionValue;
                        clsEntries = sessionEntries.slice();
                        vitals.cls = Math.round(clsValue * 10000) / 10000;
                        vitals.clsSources = clsEntries.slice(-3).map(function (en) {
                            var src = (en.sources && en.sources[0] && en.sources[0].node) ? selectorOf(en.sources[0].node) : "?";
                            return { at: Math.round(en.startTime) + "ms", shift: Math.round(en.value * 10000) / 10000, el: src };
                        });
                    }
                });
            }).observe({ type: "layout-shift", buffered: true });
        } catch (_) {}
    }

    /* ----- FOUC / .css-ready timing ----- */
    var d = document.documentElement;
    var cssReadyMark = function () {
        if (vitals.cssReady != null) return;
        vitals.cssReady = Math.round(performance.now());
        emit("CSS-ready", vitals.cssReady);
    };
    var checkCssReady = function () {
        if (d.classList.contains("fouc-timeout")) {
            vitals.fouc = true;
            cssReadyMark();
            emit("FOUC", true, "1.5s safety timeout fired — deferred CSS too slow");
            return true;
        }
        if (d.classList.contains("css-ready")) { cssReadyMark(); return true; }
        return false;
    };
    if (!checkCssReady()) {
        var mo = new MutationObserver(function () { if (checkCssReady()) mo.disconnect(); });
        mo.observe(d, { attributes: true, attributeFilter: ["class"] });
    }

    /* ----- DOM / Load + final report ----- */
    addEventListener("DOMContentLoaded", function () { vitals.domReady = Math.round(performance.now()); }, { once: true });
    addEventListener("load", function () {
        vitals.load = Math.round(performance.now());
        // give CLS a beat to settle, then print summary
        setTimeout(function () {
            console.groupCollapsed("%c[Perf] " + page + " — vitals summary", "color:#0b64ff;font-weight:700");
            console.table({
                FCP: vitals.fcp, LCP: vitals.lcp, CLS: vitals.cls,
                TTFB: vitals.ttfb, "CSS-ready": vitals.cssReady,
                DOM: vitals.domReady, Load: vitals.load, FOUC: vitals.fouc
            });
            if (vitals.lcpEl) console.info("LCP element:", vitals.lcpEl);
            if (vitals.clsSources.length) console.info("Top CLS shifts:", vitals.clsSources);
            console.groupEnd();
            try { window.dispatchEvent(new CustomEvent("getotts:vitals:summary", { detail: vitals })); } catch (_) {}
            sendBeacon(vitals);
        }, 600);
    });

    var beaconSent = false;
    function sendBeacon(payload) {
        if (beaconSent || !SHOULD_REPORT) return;
        beaconSent = true;
        try {
            // Trim large strings before sending to keep payload < ~2KB.
            var slim = {
                page: clip(payload.page, 200),
                fcp: payload.fcp, lcp: payload.lcp, cls: payload.cls, ttfb: payload.ttfb,
                cssReady: payload.cssReady, domReady: payload.domReady, load: payload.load,
                fouc: payload.fouc, viewport: payload.viewport, dpr: payload.dpr,
                ua: clip(payload.ua, 160),
                lcpEl: clip(payload.lcpEl, 200),
                clsSources: (payload.clsSources || []).slice(0, 3).map(function (s) {
                    return { at: s.at, shift: s.shift, el: clip(s.el, 200) };
                })
            };
            var body = JSON.stringify(slim);
            var url = "/api/public/perf";
            if (navigator.sendBeacon) {
                var blob = new Blob([body], { type: "application/json" });
                if (navigator.sendBeacon(url, blob)) return;
            }
            fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body, keepalive: true }).catch(function(){});
        } catch (_) {}
    }


    /* Page-hide also flushes (covers SPA-style nav) — single send guaranteed. */
    addEventListener("visibilitychange", function () {
        if (document.visibilityState === "hidden") {
            try { window.dispatchEvent(new CustomEvent("getotts:vitals:flush", { detail: vitals })); } catch (_) {}
            sendBeacon(vitals);
        }
    });
})();
