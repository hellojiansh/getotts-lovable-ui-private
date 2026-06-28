/* ============================================================
   GetOTTs UI Upgrades — v1 (2026-06-28)
   Progressive enhancements layered on top of existing pages.
   No backend coupling; reads existing DOM + window.PRODUCTS.
   ============================================================ */
(function () {
    'use strict';

    const path = (location.pathname || '/').toLowerCase();
    const page = (() => {
        if (path === '/' || path.endsWith('/index.html')) return 'home';
        if (path.includes('product')) return 'product';
        if (path.includes('category')) return 'category';
        if (path.includes('checkout')) return 'checkout';
        if (path.includes('order')) return 'order';
        if (path.includes('dashboard')) return 'dashboard';
        if (path.includes('wallet')) return 'wallet';
        if (path.includes('login') || path.includes('register')) return 'auth';
        return 'other';
    })();
    document.documentElement.setAttribute('data-ug-page', page);
    if (page === 'product' && !document.body.classList.contains('product-page')) {
        document.body.classList.add('product-page');
    }

    /* ---------- 1. Scroll progress bar ---------- */
    function mountProgress() {
        const bar = document.createElement('div');
        bar.id = 'ug-progress';
        document.body.appendChild(bar);
        const onScroll = () => {
            const h = document.documentElement;
            const max = (h.scrollHeight - h.clientHeight) || 1;
            const pct = Math.min(100, Math.max(0, (h.scrollTop / max) * 100));
            bar.style.width = pct + '%';
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
    }

    /* ---------- 2. Scroll-to-top FAB ---------- */
    function mountScrollTop() {
        const btn = document.createElement('button');
        btn.id = 'ug-scrolltop';
        btn.type = 'button';
        btn.setAttribute('aria-label', 'Scroll to top');
        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>';
        btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
        document.body.appendChild(btn);
        const onScroll = () => btn.classList.toggle('show', window.scrollY > 480);
        window.addEventListener('scroll', onScroll, { passive: true });
    }

    /* ---------- 3. Mobile bottom tab bar ---------- */
    function mountTabBar() {
        if (document.getElementById('ug-tabbar')) return;
        const tabs = [
            { href: '/', label: 'Home', match: ['home'], icon: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>' },
            { href: '/category.html', label: 'Browse', match: ['category'], icon: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>' },
            { href: '/order.html', label: 'Orders', match: ['order'], icon: '<path d="M3 7h18"/><path d="M6 7v13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7"/><path d="M9 7V4h6v3"/>' },
            { href: '/dashboard.html', label: 'Account', match: ['dashboard','wallet','auth'], icon: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>' }
        ];
        const bar = document.createElement('nav');
        bar.id = 'ug-tabbar';
        bar.setAttribute('aria-label', 'Primary mobile navigation');
        const inner = document.createElement('div');
        inner.className = 'ug-inner';
        tabs.forEach(t => {
            const a = document.createElement('a');
            a.className = 'ug-tab' + (t.match.includes(page) ? ' active' : '');
            a.href = t.href;
            a.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${t.icon}</svg><span>${t.label}</span>`;
            inner.appendChild(a);
        });
        bar.appendChild(inner);
        document.body.appendChild(bar);
    }

    /* ---------- 4. Sticky buy bar (product mobile) ---------- */
    function mountBuyBar() {
        if (page !== 'product') return;
        const buyBtn = document.getElementById('buyNowBtn');
        if (!buyBtn) return;
        const bar = document.createElement('div');
        bar.id = 'ug-buybar';
        bar.innerHTML = `
            <div class="ug-bb-inner">
                <div class="ug-bb-price-row">
                    <span class="ug-bb-label">Total</span>
                    <span class="ug-bb-price" id="ugBbPrice">—</span>
                </div>
                <button type="button" class="ug-bb-btn" id="ugBbBtn">Buy Now</button>
            </div>`;
        document.body.appendChild(bar);
        const priceEl = document.getElementById('ugBbPrice');
        const sync = () => {
            const main = document.querySelector('#productContainer .product-price, #productContainer [class*="price"], .product-detail .price');
            if (main) {
                const cur = main.querySelector('.current, .now, strong, b') || main;
                const txt = (cur.textContent || '').trim().replace(/\s+/g, ' ');
                if (txt) priceEl.textContent = txt.split(/\s{2,}/)[0];
            }
        };
        document.getElementById('ugBbBtn').addEventListener('click', () => buyBtn.click());
        // Show when buyBtn scrolls out of view
        const io = new IntersectionObserver((entries) => {
            entries.forEach(e => bar.classList.toggle('show', !e.isIntersecting));
        }, { threshold: 0.01 });
        io.observe(buyBtn);
        sync();
        new MutationObserver(sync).observe(document.body, { subtree: true, childList: true, characterData: true });
    }

    /* ---------- 5. Category sort + view toggle ---------- */
    function mountCategoryTools() {
        if (page !== 'category') return;
        const toolbar = document.querySelector('.category-toolbar');
        if (!toolbar || toolbar.querySelector('.ug-toolbar-actions')) return;
        const actions = document.createElement('div');
        actions.className = 'ug-toolbar-actions';
        actions.innerHTML = `
            <div class="ug-sort-wrap">
                <select class="ug-sort" id="ugSort" aria-label="Sort products">
                    <option value="default">Recommended</option>
                    <option value="price-asc">Price: Low to High</option>
                    <option value="price-desc">Price: High to Low</option>
                    <option value="name-asc">Name: A → Z</option>
                </select>
            </div>
            <div class="ug-view-toggle" role="group" aria-label="View style">
                <button type="button" data-view="grid" class="active" aria-label="Grid view"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg></button>
                <button type="button" data-view="list" aria-label="List view"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg></button>
            </div>`;
        toolbar.appendChild(actions);

        const grids = () => document.querySelectorAll('.product-row');
        const numFromCard = (card) => {
            const t = (card.textContent || '').replace(/[, ]/g, '');
            const m = t.match(/[₹$€]\s*(\d+(?:\.\d+)?)/);
            return m ? parseFloat(m[1]) : Number.POSITIVE_INFINITY;
        };
        const nameFromCard = (card) => {
            const h = card.querySelector('h3, h4, .name, .product-title');
            return (h ? h.textContent : card.textContent || '').trim().toLowerCase();
        };
        document.getElementById('ugSort').addEventListener('change', (e) => {
            const mode = e.target.value;
            grids().forEach(g => {
                const cards = Array.from(g.children);
                if (!cards.length) return;
                cards.sort((a, b) => {
                    if (mode === 'price-asc') return numFromCard(a) - numFromCard(b);
                    if (mode === 'price-desc') return numFromCard(b) - numFromCard(a);
                    if (mode === 'name-asc') return nameFromCard(a).localeCompare(nameFromCard(b));
                    return (a.dataset.ugOrig || 0) - (b.dataset.ugOrig || 0);
                });
                if (mode === 'default') return;
                cards.forEach(c => g.appendChild(c));
            });
        });
        // Snapshot original order once
        const snapshot = () => grids().forEach(g => Array.from(g.children).forEach((c, i) => { if (!c.dataset.ugOrig) c.dataset.ugOrig = String(i); }));
        snapshot();
        new MutationObserver(snapshot).observe(document.querySelector('.category-body') || document.body, { subtree: true, childList: true });

        actions.querySelectorAll('.ug-view-toggle button').forEach(btn => {
            btn.addEventListener('click', () => {
                actions.querySelectorAll('.ug-view-toggle button').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const list = btn.dataset.view === 'list';
                grids().forEach(g => g.classList.toggle('ug-list-view', list));
            });
        });
    }

    /* ---------- 6. Confetti on order success ---------- */
    function mountConfetti() {
        if (page !== 'order') return;
        const trigger = () => {
            const txt = (document.body.textContent || '').toLowerCase();
            const looksSuccess = txt.includes('success') || txt.includes('paid') || txt.includes('thank') || txt.includes('delivered') || txt.includes('completed');
            if (!looksSuccess) return;
            if (document.querySelector('.ug-confetti')) return;
            const layer = document.createElement('div');
            layer.className = 'ug-confetti';
            const colors = ['#0b64ff', '#7c3aed', '#ec4899', '#10b981', '#f59e0b'];
            for (let i = 0; i < 70; i++) {
                const piece = document.createElement('i');
                piece.style.left = Math.random() * 100 + 'vw';
                piece.style.background = colors[i % colors.length];
                piece.style.animationDuration = (2.4 + Math.random() * 2.2) + 's';
                piece.style.animationDelay = (Math.random() * 0.6) + 's';
                piece.style.transform = `rotate(${Math.random() * 360}deg)`;
                layer.appendChild(piece);
            }
            document.body.appendChild(layer);
            setTimeout(() => layer.remove(), 6000);
        };
        setTimeout(trigger, 800);
    }

    /* ---------- 7. Image fade-in ---------- */
    function mountImageFade() {
        const obs = new MutationObserver(() => apply());
        const apply = () => {
            document.querySelectorAll('img:not(.ug-fade)').forEach(img => {
                if (img.closest('header, nav, .header, .footer, footer')) return;
                if (img.complete && img.naturalWidth > 0) return; // already loaded; skip to avoid flicker
                img.classList.add('ug-fade');
                if (img.complete) img.classList.add('ug-loaded');
                else img.addEventListener('load', () => img.classList.add('ug-loaded'), { once: true });
                img.addEventListener('error', () => img.classList.add('ug-loaded'), { once: true });
            });
        };
        apply();
        obs.observe(document.body, { subtree: true, childList: true });
    }

    /* ---------- 8. Header search autocomplete ---------- */
    function mountSearchSuggest() {
        const input = document.querySelector('input[type="search"], input#searchInput, input.search-input, input[name="q"], input[placeholder*="Search" i]');
        if (!input || input.dataset.ugSuggest) return;
        input.dataset.ugSuggest = '1';
        const wrap = input.parentElement;
        if (wrap && getComputedStyle(wrap).position === 'static') wrap.style.position = 'relative';
        const list = document.createElement('div');
        list.className = 'ug-suggest';
        (wrap || input).appendChild(list);

        const getProducts = () => {
            if (Array.isArray(window.PRODUCTS)) return window.PRODUCTS;
            if (typeof window.getAllProducts === 'function') {
                try { return window.getAllProducts() || []; } catch { return []; }
            }
            return [];
        };
        const productHref = (p) => {
            const slug = p.slug || p.id;
            return slug ? `/product.html?id=${encodeURIComponent(slug)}` : '#';
        };
        const render = (q) => {
            const items = getProducts()
                .filter(p => p && (p.isActive !== false))
                .filter(p => {
                    const hay = `${p.name || ''} ${p.id || ''} ${p.slug || ''} ${p.category || ''}`.toLowerCase();
                    return hay.includes(q);
                })
                .slice(0, 8);
            if (!items.length) {
                list.innerHTML = `<div class="ug-suggest-empty">No matches for "${q}"</div>`;
            } else {
                list.innerHTML = items.map(p => {
                    const img = p.image || p.thumbnail || `/assets/images/${p.slug || 'logo'}.png`;
                    return `<a href="${productHref(p)}"><img src="${img}" alt="" onerror="this.style.visibility='hidden'"><span>${(p.name || p.id || '').replace(/</g,'&lt;')}</span></a>`;
                }).join('');
            }
            list.classList.add('show');
        };
        let t;
        input.addEventListener('input', (e) => {
            const q = e.target.value.trim().toLowerCase();
            clearTimeout(t);
            if (q.length < 2) { list.classList.remove('show'); list.innerHTML = ''; return; }
            t = setTimeout(() => render(q), 90);
        });
        input.addEventListener('focus', () => { if (list.innerHTML) list.classList.add('show'); });
        document.addEventListener('click', (e) => {
            if (!list.contains(e.target) && e.target !== input) list.classList.remove('show');
        });
    }

    /* ---------- Boot ---------- */
    function boot() {
        try { mountProgress(); } catch (e) { console.warn('[upgrades] progress', e); }
        try { mountScrollTop(); } catch (e) { console.warn('[upgrades] scrolltop', e); }
        try { mountTabBar(); } catch (e) { console.warn('[upgrades] tabbar', e); }
        try { mountBuyBar(); } catch (e) { console.warn('[upgrades] buybar', e); }
        try { mountCategoryTools(); } catch (e) { console.warn('[upgrades] catTools', e); }
        try { mountConfetti(); } catch (e) { console.warn('[upgrades] confetti', e); }
        try { mountImageFade(); } catch (e) { console.warn('[upgrades] imgfade', e); }
        try { mountSearchSuggest(); } catch (e) { console.warn('[upgrades] suggest', e); }
        // Search suggest may need late init after header injection
        setTimeout(() => { try { mountSearchSuggest(); } catch {} }, 1200);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
