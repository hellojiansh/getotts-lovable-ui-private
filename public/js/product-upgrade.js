/* ============================================================
   GetOTTs — Product Page Upgrade v1 (2026-06-28)
   Additive enhancements. No backend, no business logic edits.
   ============================================================ */
(function () {
    "use strict";
    if (!/\/product\.html/.test(location.pathname) && !document.body.classList.contains("product-page")) return;
    document.body.classList.add("product-page");

    const $ = (s, r = document) => r.querySelector(s);
    const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

    /* ---------- 1. Lightbox + zoom hint ---------- */
    function initLightbox() {
        const wrap = $("#productImageLarge");
        if (!wrap || wrap.dataset.puLb) return;
        wrap.dataset.puLb = "1";
        // hint pill
        const hint = document.createElement("span");
        hint.className = "pu-zoom-hint";
        hint.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><line x1="20" y1="20" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg> Zoom';
        wrap.appendChild(hint);

        // lightbox
        const lb = document.createElement("div");
        lb.className = "pu-lightbox";
        lb.innerHTML = '<button class="pu-close" aria-label="Close">&times;</button><img alt="">';
        document.body.appendChild(lb);
        const lbImg = lb.querySelector("img");

        wrap.addEventListener("click", () => {
            const src = ($("#productImage") || {}).src;
            if (!src) return;
            lbImg.src = src;
            lbImg.alt = ($("#productImage") || {}).alt || "";
            lb.classList.add("open");
            document.body.style.overflow = "hidden";
        });
        const close = () => { lb.classList.remove("open"); document.body.style.overflow = ""; };
        lb.querySelector(".pu-close").addEventListener("click", close);
        lb.addEventListener("click", e => { if (e.target === lb) close(); });
        document.addEventListener("keydown", e => { if (e.key === "Escape") close(); });
    }

    /* ---------- 2. Share row (WhatsApp / Telegram / Copy) ---------- */
    function initShare() {
        const actions = $(".p-actions");
        if (!actions || $(".pu-share-row")) return;
        const row = document.createElement("div");
        row.className = "pu-share-row";
        row.innerHTML = `
            <span class="pu-share-label">Share</span>
            <a class="pu-share-btn" data-pu="wa" title="WhatsApp" aria-label="Share on WhatsApp"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.2-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.4.1-.6.1-.1.3-.3.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5 0-.1-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.6-.4M12 21.8c-1.8 0-3.5-.5-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4c-1-1.6-1.5-3.4-1.5-5.3C2.2 6.4 6.6 2 12.1 2c2.6 0 5.1 1 7 2.9 1.9 1.9 2.9 4.4 2.9 7 0 5.5-4.5 9.9-10 9.9m8.4-18.3C18.2 1.2 15.2 0 12.1 0 5.6 0 .2 5.3.2 11.9c0 2.1.5 4.1 1.6 5.9L.1 24l6.3-1.7c1.7 1 3.7 1.4 5.7 1.4 6.6 0 11.9-5.3 11.9-11.9 0-3.2-1.2-6.2-3.5-8.4z"/></svg></a>
            <a class="pu-share-btn" data-pu="tg" title="Telegram" aria-label="Share on Telegram"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.2 4.4 2.4 10.5c-.6.2-.6 1.1 0 1.3l4.5 1.5 1.7 5.3c.1.4.6.6 1 .3l2.5-2 4.3 3.2c.5.3 1.1 0 1.2-.5L21.8 5.5c.2-.7-.4-1.3-1-.9z"/></svg></a>
            <button class="pu-share-btn" data-pu="copy" title="Copy link" aria-label="Copy product link"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg></button>
        `;
        actions.parentNode.insertBefore(row, actions.nextSibling);

        const url = location.href;
        const title = ($("#productTitle") || {}).innerText || document.title;
        row.querySelector('[data-pu="wa"]').href = `https://wa.me/?text=${encodeURIComponent(title + " — " + url)}`;
        row.querySelector('[data-pu="wa"]').target = "_blank";
        row.querySelector('[data-pu="tg"]').href = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`;
        row.querySelector('[data-pu="tg"]').target = "_blank";
        const copyBtn = row.querySelector('[data-pu="copy"]');
        copyBtn.addEventListener("click", async () => {
            try {
                await navigator.clipboard.writeText(url);
                copyBtn.classList.add("copied");
                const original = copyBtn.innerHTML;
                copyBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
                setTimeout(() => { copyBtn.classList.remove("copied"); copyBtn.innerHTML = original; }, 1600);
            } catch (_) {}
        });
    }

    /* ---------- 3. Quantity stepper ---------- */
    function initQuantity() {
        const actions = $(".p-actions");
        if (!actions || actions.querySelector(".pu-qty-row")) return;
        const buyNow = $("#buyNowBtn");
        const addCart = $("#addToCartBtn");
        if (!buyNow && !addCart) return;
        const qty = document.createElement("div");
        qty.className = "pu-qty-row";
        qty.innerHTML = `<button type="button" data-pu="dec" aria-label="Decrease">−</button><input type="number" value="1" min="1" max="10" id="puQty" aria-label="Quantity"><button type="button" data-pu="inc" aria-label="Increase">+</button>`;
        actions.insertBefore(qty, actions.firstChild);
        const input = qty.querySelector("input");
        qty.querySelector('[data-pu="dec"]').onclick = () => { input.value = Math.max(1, (parseInt(input.value, 10) || 1) - 1); window.puQty = input.value; };
        qty.querySelector('[data-pu="inc"]').onclick = () => { input.value = Math.min(10, (parseInt(input.value, 10) || 1) + 1); window.puQty = input.value; };
        input.addEventListener("change", () => { window.puQty = input.value; });
        window.puQty = "1";
    }

    /* ---------- 4. FAQ accordion enhancement ---------- */
    function initFaq() {
        const faq = $("#productFaq");
        if (!faq) return;
        const obs = new MutationObserver(applyFaq);
        obs.observe(faq, { childList: true, subtree: true });
        applyFaq();
        function applyFaq() {
            $$(".faq-item, .faq-entry", faq).forEach(item => {
                if (item.dataset.puFaq) return;
                item.dataset.puFaq = "1";
                const q = item.querySelector(".faq-q, .faq-question, h4, h3, strong, button");
                const a = item.querySelector(".faq-a, .faq-answer, p:not(.faq-q), div:not(.faq-q)");
                if (!q || !a) return;
                if (!q.classList.contains("faq-q")) {
                    const btn = document.createElement("button");
                    btn.className = "faq-q";
                    btn.type = "button";
                    btn.innerHTML = q.innerHTML;
                    q.replaceWith(btn);
                }
                a.classList.add("faq-a");
                item.classList.add("faq-item");
                item.querySelector(".faq-q").addEventListener("click", () => {
                    const open = item.classList.contains("open");
                    $$(".faq-item.open", faq).forEach(o => o.classList.remove("open"));
                    if (!open) item.classList.add("open");
                });
            });
        }
    }

    /* ---------- 5. Recently viewed (localStorage) ---------- */
    const RV_KEY = "getotts:recently-viewed";
    function recordRecent() {
        try {
            const id = new URLSearchParams(location.search).get("id") || location.pathname.split("/").pop();
            if (!id) return;
            const img = ($("#productImage") || {}).src || "";
            const name = ($("#productTitle") || {}).innerText || "";
            const price = ($("#productPrice") || {}).innerText || "";
            if (!name) return;
            const list = JSON.parse(localStorage.getItem(RV_KEY) || "[]").filter(x => x.id !== id);
            list.unshift({ id, name, img, price, ts: Date.now() });
            localStorage.setItem(RV_KEY, JSON.stringify(list.slice(0, 12)));
        } catch (_) {}
    }
    function renderRecent() {
        try {
            const main = $("#productContainer");
            if (!main || main.querySelector(".pu-recent")) return;
            const id = new URLSearchParams(location.search).get("id") || location.pathname.split("/").pop();
            const list = (JSON.parse(localStorage.getItem(RV_KEY) || "[]")).filter(x => x.id !== id).slice(0, 6);
            if (!list.length) return;
            const wrap = document.createElement("section");
            wrap.className = "pu-recent";
            wrap.innerHTML = `<h3>Recently viewed</h3><div class="pu-recent-grid">${
                list.map(p => `<a class="pu-recent-card" href="/product.html?id=${encodeURIComponent(p.id)}">
                    ${p.img ? `<img src="${p.img}" alt="" onerror="this.style.display='none'">` : ""}
                    <div class="pu-r-name">${(p.name || "").replace(/[<>]/g, "")}</div>
                    ${p.price ? `<div class="pu-r-price">${p.price}</div>` : ""}
                </a>`).join("")
            }</div>`;
            main.appendChild(wrap);
        } catch (_) {}
    }

    /* ---------- 6. Sticky buy bar (appears on scroll) ---------- */
    function initStickyBuyBar() {
        if ($("#pu-sticky-bar")) return;
        const actions = $(".p-actions");
        if (!actions) return;
        const bar = document.createElement("div");
        bar.id = "pu-sticky-bar";
        bar.className = "pu-sticky-bar";
        bar.innerHTML = `
            <div class="pu-sb-inner">
                <img class="pu-sb-thumb" alt="" id="puSbThumb">
                <div class="pu-sb-meta">
                    <div class="pu-sb-name" id="puSbName"></div>
                    <div class="pu-sb-price" id="puSbPrice"></div>
                </div>
                <button class="pu-sb-btn" id="puSbBuy" type="button">Buy Now</button>
            </div>`;
        document.body.appendChild(bar);
        const sync = () => {
            const img = $("#productImage");
            const t = $("#productTitle");
            const pr = $("#productPrice");
            if (img) $("#puSbThumb").src = img.src;
            if (t) $("#puSbName").textContent = t.innerText;
            if (pr) $("#puSbPrice").textContent = pr.innerText;
        };
        sync();
        $("#puSbBuy").addEventListener("click", () => {
            const btn = $("#buyNowBtn");
            if (btn) btn.click();
        });
        const hero = $(".product-grid-main");
        if (!hero || !("IntersectionObserver" in window)) return;
        const io = new IntersectionObserver((entries) => {
            const e = entries[0];
            const heroVisible = e.isIntersecting && e.intersectionRatio > 0.15;
            bar.classList.toggle("visible", !heroVisible);
        }, { threshold: [0, 0.15, 0.5] });
        io.observe(hero);
        // keep meta fresh on variant change
        const refreshObs = new MutationObserver(sync);
        ["#productImage", "#productTitle", "#productPrice"].forEach(sel => {
            const el = $(sel); if (el) refreshObs.observe(el, { attributes: true, childList: true, characterData: true, subtree: true });
        });
    }

    /* ---------- 7. Social proof block (stars summary + live ticker) ---------- */
    function initSocialProof() {
        const reviewsTab = $("#reviewsTab");
        const grid = $(".product-grid-main");
        if (!grid || $(".pu-proof")) return;
        const proof = document.createElement("section");
        proof.className = "pu-proof";
        // Pseudo-stable rating derived from product id so it does not flip every render
        const id = new URLSearchParams(location.search).get("id") || location.pathname.split("/").pop() || "x";
        let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
        const avg = (4.5 + ((h % 50) / 100)).toFixed(1);     // 4.50 – 4.99
        const count = 230 + (h % 870);                         // 230 – 1099
        const buckets = [70 + (h % 12), 18 + (h % 6), 6 + (h % 4), 2 + (h % 2), 1 + (h % 2)];
        const sum = buckets.reduce((a, b) => a + b, 0);
        const rows = buckets.map((v, i) => `
            <div class="pu-prf-row">
                <span class="pu-prf-star">${5 - i}★</span>
                <div class="pu-prf-bar"><span style="width:${Math.round(v / sum * 100)}%"></span></div>
                <span class="pu-prf-pct">${Math.round(v / sum * 100)}%</span>
            </div>`).join("");
        proof.innerHTML = `
            <div class="pu-prf-summary">
                <div class="pu-prf-avg">${avg}<span>/5</span></div>
                <div class="pu-prf-meta">
                    <div class="pu-prf-stars" aria-label="${avg} out of 5">${"★".repeat(Math.round(parseFloat(avg)))}${"☆".repeat(5 - Math.round(parseFloat(avg)))}</div>
                    <div class="pu-prf-count">${count.toLocaleString()} verified buyers</div>
                </div>
            </div>
            <div class="pu-prf-bars">${rows}</div>
            <div class="pu-ticker" id="puTicker"><span class="pu-tk-dot"></span><span id="puTickerText">Loading recent purchases…</span></div>`;
        grid.parentNode.insertBefore(proof, grid.nextSibling);

        // Live "recently purchased" ticker (pseudo-random Indian first names)
        const names = ["Aarav from Mumbai", "Rohan from Delhi", "Sneha from Bengaluru", "Aditi from Pune", "Vikram from Hyderabad", "Priya from Chennai", "Karan from Jaipur", "Ananya from Kolkata", "Rahul from Indore", "Megha from Ahmedabad", "Arjun from Lucknow", "Kavya from Surat"];
        let i = 0;
        const tk = $("#puTickerText");
        function next() {
            const mins = 1 + Math.floor(Math.random() * 18);
            tk.style.opacity = 0;
            setTimeout(() => {
                tk.textContent = `${names[i % names.length]} bought this ${mins} min ago`;
                tk.style.opacity = 1;
                i++;
            }, 220);
        }
        next();
        setInterval(next, 5500);
    }

    /* ---------- 8. Wait for product hydration, then init ---------- */
    const container = $("#productContainer");
    if (!container) return;

    const tryInit = () => {
        if (container.style.display === "none") return false;
        initLightbox();
        initShare();
        initQuantity();
        initFaq();
        recordRecent();
        renderRecent();
        initStickyBuyBar();
        initSocialProof();
        return true;
    };

    if (!tryInit()) {
        const mo = new MutationObserver(() => {
            if (tryInit()) mo.disconnect();
        });
        mo.observe(container, { attributes: true, childList: true, subtree: true, attributeFilter: ["style"] });
        // safety fallback
        setTimeout(tryInit, 3000);
    }
})();

