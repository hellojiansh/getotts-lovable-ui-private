(function () {
    const base = {
        none: '',
        check: '<path d="M20 6 9 17l-5-5"/>',
        x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
        plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
        search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
        user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.8-4 14.2-4 16 0"/>',
        users: '<path d="M16 21c0-2.2-2.7-4-6-4s-6 1.8-6 4"/><circle cx="10" cy="8" r="4"/><path d="M20 21c0-1.7-1.5-3.1-3.6-3.7"/><path d="M16 4.2a4 4 0 0 1 0 7.6"/>',
        bag: '<path d="M6 8h12l-1 12H7L6 8Z"/><path d="M9 8a3 3 0 0 1 6 0"/>',
        cart: '<circle cx="9" cy="20" r="1"/><circle cx="17" cy="20" r="1"/><path d="M3 4h2l2.5 12h10l2-8H7"/>',
        shield: '<path d="M12 3 20 6v6c0 5-3.4 8-8 9-4.6-1-8-4-8-9V6l8-3Z"/>',
        lock: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
        mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
        clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
        calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4"/><path d="M8 3v4"/><path d="M3 10h18"/>',
        arrowRight: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
        arrowLeft: '<path d="M19 12H5"/><path d="m11 6-6 6 6 6"/>',
        chevronRight: '<path d="m9 18 6-6-6-6"/>',
        chevronLeft: '<path d="m15 18-6-6 6-6"/>',
        zap: '<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/>',
        gift: '<rect x="3" y="8" width="18" height="13" rx="2"/><path d="M12 8v13"/><path d="M3 12h18"/><path d="M7.5 8a2.5 2.5 0 1 1 4.5-1.5V8"/><path d="M16.5 8A2.5 2.5 0 1 0 12 6.5V8"/>',
        heart: '<path d="M20.8 5.6a5.5 5.5 0 0 0-7.8 0L12 6.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 22l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z"/>',
        star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2 7.5 14 3 9.6l6.2-.9L12 3Z"/>',
        message: '<path d="M21 12a8 8 0 0 1-8 8H7l-4 3 1.3-5A8 8 0 1 1 21 12Z"/>',
        package: '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4 7.5 8 4.5 8-4.5"/><path d="M12 12v9"/>',
        card: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/>',
        music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
        tv: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M8 21h8"/><path d="M12 18v3"/>',
        bot: '<rect x="5" y="8" width="14" height="10" rx="3"/><path d="M12 8V4"/><circle cx="9" cy="13" r="1"/><circle cx="15" cy="13" r="1"/><path d="M9 17h6"/>',
        menu: '<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/>',
        home: '<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/>',
        eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
        copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 0 1 2-2h10"/>',
        trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v5"/><path d="M14 11v5"/>',
        edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"/>',
        circle: '<circle cx="12" cy="12" r="9"/>',
        triangle: '<path d="M12 3 22 20H2L12 3Z"/>',
        clapper: '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18"/><path d="m7 6 3 4"/><path d="m13 6 3 4"/>',
        smartphone: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
        wallet: '<path d="M3 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/><path d="M16 13h5"/><path d="M3 7l3-4h11v4"/>',
        link: '<path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1 1"/><path d="M14 11a5 5 0 0 0-7.1 0l-2 2a5 5 0 0 0 7.1 7.1l1-1"/>'
    };
    const map = {
        activity: '<path d="M22 12h-4l-3 8-6-16-3 8H2"/>',
        'alert-circle': base.circle + '<path d="M12 8v4"/><path d="M12 16h.01"/>',
        'alert-triangle': base.triangle + '<path d="M12 9v4"/><path d="M12 17h.01"/>',
        'arrow-left': base.arrowLeft, 'arrow-right': base.arrowRight,
        'badge-check': base.check + base.circle, 'badge-percent': '<path d="m8 16 8-8"/><circle cx="8" cy="8" r="1.5"/><circle cx="16" cy="16" r="1.5"/>' + base.circle,
        'book-open-check': '<path d="M2 4h7a4 4 0 0 1 4 4v13a4 4 0 0 0-4-4H2V4Z"/><path d="M22 4h-7a4 4 0 0 0-4 4"/><path d="m14 14 2 2 4-5"/>',
        bot: base.bot, calendar: base.calendar, 'calendar-clock': base.calendar + '<path d="M16 14v3l2 1"/>',
        camera: '<path d="M14 5 12.5 3h-5L6 5H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-6Z"/><circle cx="12" cy="13" r="4"/>',
        check: base.check, 'check-circle': base.circle + base.check, 'check-circle-2': base.circle + base.check, 'circle-check': base.circle + base.check,
        'chevron-left': base.chevronLeft, 'chevron-right': base.chevronRight, 'circle-help': base.circle + '<path d="M9.1 9a3 3 0 1 1 5.8 1c-.8 1.4-2.9 1.8-2.9 3"/><path d="M12 17h.01"/>',
        clapperboard: base.clapper, clock: base.clock, 'clock-3': base.clock, copy: base.copy, cpu: '<rect x="7" y="7" width="10" height="10" rx="2"/><path d="M9 1v4"/><path d="M15 1v4"/><path d="M9 19v4"/><path d="M15 19v4"/><path d="M1 9h4"/><path d="M1 15h4"/><path d="M19 9h4"/><path d="M19 15h4"/>',
        'credit-card': base.card, edit: base.edit, 'edit-3': base.edit, 'external-link': '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
        eye: base.eye, 'eye-off': base.eye + '<path d="M3 3 21 21"/>', gift: base.gift, hash: '<path d="M4 9h16"/><path d="M4 15h16"/><path d="M10 3 8 21"/><path d="m16 3-2 18"/>',
        headphones: '<path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1v-7h3v5Z"/><path d="M3 19a2 2 0 0 0 2 2h1v-7H3v5Z"/>',
        heart: base.heart, 'help-circle': base.circle + '<path d="M9.1 9a3 3 0 1 1 5.8 1c-.8 1.4-2.9 1.8-2.9 3"/><path d="M12 17h.01"/>',
        home: base.home, inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5 5h14l3 7v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6l3-7Z"/>',
        info: base.circle + '<path d="M12 16v-4"/><path d="M12 8h.01"/>', key: '<circle cx="7" cy="17" r="4"/><path d="M10 14 21 3"/><path d="m15 8 3 3"/>',
        'layers-3': '<path d="m12 2 10 5-10 5L2 7l10-5Z"/><path d="m2 12 10 5 10-5"/><path d="m2 17 10 5 10-5"/>',
        'layout-grid': '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
        'life-buoy': base.circle + '<circle cx="12" cy="12" r="4"/><path d="m4.9 4.9 4.3 4.3"/><path d="m14.8 14.8 4.3 4.3"/><path d="m19.1 4.9-4.3 4.3"/><path d="m9.2 14.8-4.3 4.3"/>',
        link: base.link, 'loader-2': '<path d="M21 12a9 9 0 1 1-6-8.5"/>', lock: base.lock, 'lock-keyhole': base.lock + '<circle cx="12" cy="15" r="1"/>',
        'log-out': '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
        mail: base.mail, 'mail-check': base.mail + '<path d="m9 12 2 2 4-4"/>', menu: base.menu,
        'message-circle': base.message, 'message-square': '<path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10Z"/>',
        music: base.music, 'music-2': base.music, package: base.package, 'package-check': base.package + base.check, 'package-open': base.package + '<path d="M12 12 4 7.5"/><path d="m12 12 8-4.5"/>',
        'play-circle': base.circle + '<path d="m10 8 6 4-6 4V8Z"/>', receipt: '<path d="M4 2v20l3-2 3 2 3-2 3 2 4-2V2H4Z"/><path d="M8 7h8"/><path d="M8 12h8"/>',
        'refresh-cw': '<path d="M21 12a9 9 0 0 1-15.5 6.2"/><path d="M3 12a9 9 0 0 1 15.5-6.2"/><path d="M18 2v4h-4"/><path d="M6 22v-4h4"/>',
        save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/>',
        'search-x': base.search + '<path d="m14 9-5 5"/><path d="m9 9 5 5"/>', send: '<path d="m22 2-7 20-4-9-9-4 20-7Z"/><path d="M22 2 11 13"/>',
        settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21H10v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3v-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1L7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6V3h4v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.1v4H21a1.7 1.7 0 0 0-1.6 1Z"/>',
        shield: base.shield, 'shield-alert': base.shield + '<path d="M12 8v4"/><path d="M12 16h.01"/>', 'shield-check': base.shield + base.check,
        'shopping-bag': base.bag, 'shopping-cart': base.cart, smartphone: base.smartphone, sparkles: '<path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/><path d="M5 3v4"/><path d="M3 5h4"/><path d="M19 17v4"/><path d="M17 19h4"/>',
        star: base.star, tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z"/><circle cx="7.5" cy="7.5" r=".5"/>',
        ticket: '<path d="M3 9V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3a3 3 0 0 0 0 6v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a3 3 0 0 0 0-6Z"/><path d="M13 5v14"/>',
        'trash-2': base.trash, 'trending-down': '<path d="m22 17-8.5-8.5-5 5L2 7"/><path d="M16 17h6v-6"/>', truck: '<path d="M10 17H5V6h11v11"/><path d="M16 9h3l3 4v4h-6V9Z"/><circle cx="7" cy="19" r="2"/><circle cx="18" cy="19" r="2"/>',
        tv: base.tv, 'tv-2': base.tv, 'undo-2': '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 1 1 0 10H9"/>', unlock: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 7.5-2"/>',
        user: base.user, 'user-check': base.user + base.check, 'user-plus': base.user + '<path d="M19 8v6"/><path d="M16 11h6"/>', users: base.users, wallet: base.wallet, x: base.x, 'x-circle': base.circle + base.x, zap: base.zap,
        'badge-dollar-sign': base.circle + '<path d="M12 7v10"/><path d="M15 9.5c-.6-.5-1.5-.8-2.7-.8-1.4 0-2.3.7-2.3 1.7 0 2.8 5 1.2 5 4 0 1-.9 1.8-2.6 1.8-1.1 0-2-.3-2.8-.9"/>'
    };
    function svg(name, attrs) {
        const body = map[name] || base.circle;
        return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${attrs || ''}>${body}</svg>`;
    }
    function createIcons() {
        document.querySelectorAll('[data-lucide]').forEach((el) => {
            if (el.tagName.toLowerCase() === 'svg') return;
            const name = el.getAttribute('data-lucide');
            const cls = el.getAttribute('class') || '';
            const style = el.getAttribute('style') || '';
            el.outerHTML = svg(name, `${cls ? `class="${cls}"` : ''} ${style ? `style="${style}"` : ''} data-lucide="${name}"`);
        });
    }
    window.lucide = { createIcons };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createIcons, { once: true });
    } else {
        createIcons();
    }
})();
