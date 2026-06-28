(function () {
    'use strict';

    var STYLE_ID = 'getotts-mobile-menu-style';
    var OPEN_ATTR = 'data-mobile-menu';
    var lastToggleAt = 0;

    function els() {
        return {
            button: document.getElementById('mobileToggle'),
            nav: document.getElementById('mainNav')
        };
    }

    function isOpen() {
        return document.body && document.body.getAttribute(OPEN_ATTR) === 'open';
    }

    function ensureStyle() {
        if (document.getElementById(STYLE_ID)) return;
        var style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = [
            '@media(max-width:991px){',
            'html body #mobileToggle.mobile-toggle{display:inline-flex!important;align-items:center!important;justify-content:center!important;pointer-events:auto!important;touch-action:manipulation!important;position:relative!important;z-index:2147483000!important}',
            'html body #mainNav.main-nav{display:none!important}',
            'html body[' + OPEN_ATTR + '="open"] #mainNav.main-nav{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;align-items:stretch!important;gap:8px!important;position:fixed!important;top:62px!important;left:12px!important;right:12px!important;width:auto!important;max-height:calc(100dvh - 82px)!important;padding:12px!important;overflow:auto!important;border-radius:16px!important;border:1px solid rgba(125,178,255,.24)!important;background:#050b16!important;box-shadow:0 18px 55px rgba(0,0,0,.55)!important;z-index:2147482500!important;opacity:1!important;visibility:visible!important;pointer-events:auto!important;transform:none!important}',
            'html body[' + OPEN_ATTR + '="open"] #header.header{overflow:visible!important;contain:none!important}',
            'html body[' + OPEN_ATTR + '="open"] #mainNav.main-nav .main-nav-link{display:flex!important;align-items:center!important;justify-content:flex-start!important;min-height:42px!important;width:100%!important;padding:10px 12px!important;border-radius:12px!important;border:1px solid rgba(125,178,255,.14)!important;background:rgba(255,255,255,.045)!important;color:#eef6ff!important;font-size:.86rem!important;font-weight:800!important;text-align:left!important}',
            'html body[' + OPEN_ATTR + '="open"] #mainNav.main-nav .main-nav-link:hover,html body[' + OPEN_ATTR + '="open"] #mainNav.main-nav .main-nav-link.active{background:rgba(35,127,255,.18)!important;border-color:rgba(35,127,255,.38)!important;color:#fff!important}',
            'html body[' + OPEN_ATTR + '="open"] #mainNav.main-nav .main-nav-link:after{display:none!important}',
            'html body[' + OPEN_ATTR + '="open"] #mainNav.main-nav .mobile-search-box,html body[' + OPEN_ATTR + '="open"] #mainNav.main-nav .mobile-profile-nav{display:flex!important;grid-column:1/-1!important}',
            'html body[' + OPEN_ATTR + '="open"] #mainNav.main-nav .mobile-search-box{align-items:center!important;gap:10px!important;min-height:42px!important;margin:0!important;padding:0 12px!important;border-radius:12px!important;border:1px solid rgba(125,178,255,.18)!important;background:rgba(255,255,255,.08)!important}',
            'html body[' + OPEN_ATTR + '="open"] #mainNav.main-nav .mobile-search-box input{width:100%!important;min-width:0!important;color:#fff!important;background:transparent!important}',
            'html body[' + OPEN_ATTR + '="open"] #mobileToggle.mobile-toggle{border-color:rgba(255,196,87,.85)!important;box-shadow:0 0 0 2px rgba(255,196,87,.12)!important}',
            '}'
        ].join('');
        document.head.appendChild(style);
    }

    function applyInline(open) {
        var current = els();
        var header = document.getElementById('header');
        if (!current.nav) return;
        if (open) {
            current.nav.style.setProperty('display', 'grid', 'important');
            current.nav.style.setProperty('visibility', 'visible', 'important');
            current.nav.style.setProperty('opacity', '1', 'important');
            current.nav.style.setProperty('pointer-events', 'auto', 'important');
            if (header) {
                header.style.setProperty('overflow', 'visible', 'important');
                header.style.setProperty('contain', 'none', 'important');
            }
        } else {
            current.nav.style.removeProperty('display');
            current.nav.style.removeProperty('visibility');
            current.nav.style.removeProperty('opacity');
            current.nav.style.removeProperty('pointer-events');
            if (header) {
                header.style.removeProperty('overflow');
                header.style.removeProperty('contain');
            }
        }
    }

    function setOpen(open) {
        var current = els();
        if (!document.body || !current.button || !current.nav) return;
        if (open) {
            document.body.setAttribute(OPEN_ATTR, 'open');
            current.nav.classList.add('open');
            current.button.classList.add('active');
            current.button.dataset.menuActive = 'true';
            current.button.setAttribute('aria-expanded', 'true');
        } else {
            document.body.removeAttribute(OPEN_ATTR);
            current.nav.classList.remove('open');
            current.button.classList.remove('active');
            current.button.dataset.menuActive = 'false';
            current.button.setAttribute('aria-expanded', 'false');
        }
        applyInline(open);
    }

    function toggleMenu(event) {
        var target = event && event.target && event.target.closest ? event.target.closest('#mobileToggle') : null;
        if (!target) return;
        if (event) {
            event.preventDefault();
            event.stopPropagation();
            if (event.stopImmediatePropagation) event.stopImmediatePropagation();
        }
        var now = Date.now();
        if (now - lastToggleAt < 420) return;
        lastToggleAt = now;
        setOpen(!isOpen());
    }

    function closeFromOutside(event) {
        if (!isOpen() || !event || !event.target || !event.target.closest) return;
        if (event.target.closest('#mobileToggle') || event.target.closest('#mainNav')) return;
        setOpen(false);
    }

    function closeFromLink(event) {
        if (!isOpen() || !event || !event.target || !event.target.closest) return;
        if (event.target.closest('#mainNav a')) setOpen(false);
    }

    function onKey(event) {
        if (!event) return;
        var current = els();
        if (event.key === 'Escape' && isOpen()) {
            setOpen(false);
            return;
        }
        if (!current.button || document.activeElement !== current.button) return;
        if (event.key !== 'Enter' && event.key !== ' ') return;
        toggleMenu(event);
    }

    function init() {
        ensureStyle();
        var current = els();
        if (!current.button || !current.nav) return;
        current.button.type = 'button';
        current.button.setAttribute('aria-controls', 'mainNav');
        current.button.setAttribute('aria-expanded', isOpen() ? 'true' : 'false');
        current.button.dataset.mobileMenuController = 'standalone';
        applyInline(isOpen());
    }

    document.addEventListener('pointerup', toggleMenu, true);
    document.addEventListener('touchend', toggleMenu, true);
    document.addEventListener('click', toggleMenu, true);
    document.addEventListener('pointerdown', closeFromOutside, true);
    document.addEventListener('click', closeFromLink, false);
    document.addEventListener('keydown', onKey, true);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }

    window.GetOTTsMobileMenu = {
        close: function () { setOpen(false); },
        open: function () { setOpen(true); },
        refresh: init,
        toggle: function () { setOpen(!isOpen()); }
    };
})();
