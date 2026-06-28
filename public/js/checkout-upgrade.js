/* ============================================================
   Checkout Upgrade JS — v1 (2026-06-28)
   - Mobile sticky order summary with expand/collapse
   - Stepper auto-advancement
   - Address autosave to localStorage
   - Quick-apply coupon suggestions
   Pure UI layer. Reads existing window.* state, does NOT replace
   checkout.js business logic.
   ============================================================ */
(function () {
    'use strict';
    if (!/checkout/i.test(location.pathname) && !document.body.classList.contains('ck-body')) return;

    var $ = function (s, r) { return (r || document).querySelector(s); };

    /* ---------- Mobile sticky summary ---------- */
    function mountMobileSummary() {
        if ($('#ck-mobile-summary')) return;
        var bar = document.createElement('div');
        bar.id = 'ck-mobile-summary';
        bar.innerHTML = ''
            + '<div class="ck-ms-inner">'
            +   '<div>'
            +     '<div class="ck-ms-label">Order Total</div>'
            +     '<div class="ck-ms-total" id="ckMsTotal">—</div>'
            +   '</div>'
            +   '<button type="button" class="ck-ms-toggle" id="ckMsToggle">'
            +     '<span id="ckMsToggleLabel">Details</span>'
            +     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>'
            +   '</button>'
            + '</div>'
            + '<div class="ck-ms-details" id="ckMsDetails"></div>';
        document.body.appendChild(bar);

        $('#ckMsToggle').addEventListener('click', function () {
            bar.classList.toggle('open');
            $('#ckMsToggleLabel').textContent = bar.classList.contains('open') ? 'Hide' : 'Details';
            syncDetails();
        });
        syncTotal();
        setInterval(syncTotal, 1200); // mirror checkout.js updates
    }

    function syncTotal() {
        var totalEl = document.querySelector('.ck-total-line span:last-child, #ckTotal, [data-ck-total]');
        if (totalEl) {
            var t = $('#ckMsTotal');
            if (t) t.textContent = totalEl.textContent.trim();
        }
    }

    function syncDetails() {
        var src = document.querySelector('.ck-summary, .ck-line-items');
        var dst = $('#ckMsDetails');
        if (!src || !dst) return;
        var lines = src.querySelectorAll('.ck-line, .ck-total-line');
        dst.innerHTML = '';
        lines.forEach(function (l) {
            var clone = document.createElement('div');
            clone.className = 'ck-ms-line' + (l.classList.contains('green') ? ' green' : '');
            clone.innerHTML = l.innerHTML;
            dst.appendChild(clone);
        });
    }

    /* ---------- Stepper auto-advance ---------- */
    function updateStepper(stage) {
        var steps = document.querySelectorAll('.ck-steps .ck-step');
        if (!steps.length) return;
        var idx = stage === 'payment' ? 1 : stage === 'done' ? 2 : 0;
        steps.forEach(function (s, i) {
            s.classList.toggle('active', i === idx);
            s.classList.toggle('done', i < idx);
        });
    }

    function watchStage() {
        // Listen for payment panel becoming visible
        var pay = document.querySelector('#ckPayment, .ck-payment-section, [data-ck-stage="payment"]');
        var done = document.querySelector('.ck-success, #ckSuccess, [data-ck-stage="success"]');
        var obs = new MutationObserver(function () {
            if (done && done.offsetParent) return updateStepper('done');
            if (pay && pay.offsetParent) return updateStepper('payment');
            updateStepper('details');
        });
        obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'hidden'] });
    }

    /* ---------- Address autosave ---------- */
    var FIELDS = ['name', 'email', 'phone', 'address', 'city', 'pincode', 'state', 'country'];
    function restoreAddress() {
        try {
            var raw = localStorage.getItem('go_ck_addr');
            if (!raw) return;
            var data = JSON.parse(raw);
            FIELDS.forEach(function (k) {
                var el = document.querySelector('input[name="' + k + '"], #ck' + k.charAt(0).toUpperCase() + k.slice(1));
                if (el && !el.value) el.value = data[k] || '';
            });
        } catch (_) {}
    }
    function saveAddress() {
        var data = {};
        FIELDS.forEach(function (k) {
            var el = document.querySelector('input[name="' + k + '"], #ck' + k.charAt(0).toUpperCase() + k.slice(1));
            if (el) data[k] = el.value;
        });
        try { localStorage.setItem('go_ck_addr', JSON.stringify(data)); } catch (_) {}
    }
    function wireAddressAutosave() {
        document.addEventListener('input', function (e) {
            if (e.target && e.target.matches && e.target.matches('input, textarea')) saveAddress();
        });
    }

    /* ---------- Suggested coupons ---------- */
    var SUGGESTIONS = ['WELCOME10', 'OTT50', 'FESTIVE15'];
    function mountCouponSuggest() {
        var couponRow = document.querySelector('.ck-coupon-row');
        if (!couponRow || couponRow.parentNode.querySelector('.ck-coupon-suggest')) return;
        var wrap = document.createElement('div');
        wrap.className = 'ck-coupon-suggest';
        wrap.innerHTML = '<span style="font-size:11px;color:rgba(15,23,42,.5);font-weight:600;align-self:center;">TRY:</span>';
        SUGGESTIONS.forEach(function (code) {
            var b = document.createElement('button');
            b.type = 'button';
            b.textContent = code;
            b.addEventListener('click', function () {
                var inp = couponRow.querySelector('input');
                if (inp) {
                    inp.value = code;
                    inp.dispatchEvent(new Event('input', { bubbles: true }));
                }
                var btn = couponRow.querySelector('button, .ck-apply-btn');
                if (btn) btn.click();
            });
            wrap.appendChild(b);
        });
        couponRow.insertAdjacentElement('afterend', wrap);
    }

    /* ---------- Trust row mount (once) ---------- */
    function mountTrustRow() {
        var summary = document.querySelector('.ck-summary');
        if (!summary || summary.querySelector('.ck-trust-row')) return;
        var row = document.createElement('div');
        row.className = 'ck-trust-row';
        row.innerHTML = ''
            + '<div class="ck-trust-item"><strong>SSL</strong>Secured</div>'
            + '<div class="ck-trust-item"><strong>Instant</strong>Delivery</div>'
            + '<div class="ck-trust-item"><strong>24×7</strong>Support</div>';
        summary.appendChild(row);
    }

    /* ---------- Bootstrap ---------- */
    function init() {
        mountMobileSummary();
        watchStage();
        wireAddressAutosave();
        restoreAddress();
        mountCouponSuggest();
        mountTrustRow();
        // Re-mount on dynamic content load
        setTimeout(mountCouponSuggest, 800);
        setTimeout(mountTrustRow, 800);
        setTimeout(syncDetails, 1200);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else { init(); }
})();
