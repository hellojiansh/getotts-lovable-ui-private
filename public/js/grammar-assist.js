(function () {
    const existing = document.getElementById('grammarAssistBtn');
    if (existing) existing.remove();
    return;
    const SKIP_TYPES = new Set([
        'button', 'checkbox', 'color', 'date', 'datetime-local', 'email', 'file',
        'hidden', 'month', 'number', 'password', 'radio', 'range', 'reset',
        'submit', 'tel', 'time', 'url', 'week'
    ]);
    let activeField = null;
    let originalText = '';
    let isFixing = false;

    function apiBase() {
        if (window.GETOTTS_CONFIG && window.GETOTTS_CONFIG.API_BASE) {
            return window.GETOTTS_CONFIG.API_BASE;
        }
        const host = window.location.hostname;
        return (host === 'localhost' || host === '127.0.0.1')
            ? 'http://localhost:8000/api/v1'
            : 'https://api.getotts.com/api/v1';
    }

    function fieldText(field) {
        return field.isContentEditable ? field.innerText : field.value;
    }

    function setFieldText(field, text) {
        if (field.isContentEditable) {
            field.innerText = text;
        } else {
            field.value = text;
        }
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function isWritableField(el) {
        if (!el || el.disabled || el.readOnly) return false;
        if (el.closest && el.closest('#chatWidgetContainer')) return false;
        if (el.isContentEditable) return true;
        const tag = el.tagName;
        if (tag === 'TEXTAREA') return true;
        if (tag !== 'INPUT') return false;
        const type = (el.type || 'text').toLowerCase();
        if (SKIP_TYPES.has(type)) return false;
        if ((el.autocomplete || '').toLowerCase() === 'one-time-code') return false;
        if ((el.inputMode || '').toLowerCase() === 'numeric') return false;
        if (el.maxLength > 0 && el.maxLength <= 12) return false;
        return true;
    }

    function ensureButton() {
        ensureStyle();
        let btn = document.getElementById('grammarAssistBtn');
        if (btn) return btn;
        btn = document.createElement('button');
        btn.id = 'grammarAssistBtn';
        btn.type = 'button';
        btn.textContent = 'Fix';
        btn.title = 'Fix grammar and spelling';
        btn.setAttribute('aria-label', 'Fix grammar and spelling');
        btn.addEventListener('mousedown', event => event.preventDefault());
        btn.addEventListener('click', fixActiveField);
        document.body.appendChild(btn);
        return btn;
    }

    function ensureStyle() {
        if (document.getElementById('grammarAssistStyle')) return;
        const style = document.createElement('style');
        style.id = 'grammarAssistStyle';
        style.textContent = `
            #grammarAssistBtn {
                position: absolute;
                z-index: 10001;
                min-width: 48px;
                height: 30px;
                padding: 0 10px;
                border: 1px solid rgba(15, 23, 42, 0.12);
                border-radius: 999px;
                background: #111827;
                color: #fff;
                box-shadow: 0 10px 24px rgba(15, 23, 42, 0.18);
                cursor: pointer;
                font: 800 12px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                opacity: 0;
                pointer-events: none;
                transform: translateY(-4px);
                transition: opacity .16s ease, transform .16s ease;
            }
            #grammarAssistBtn.visible {
                opacity: 1;
                pointer-events: auto;
                transform: translateY(0);
            }
            #grammarAssistBtn:disabled {
                cursor: wait;
                opacity: .82;
            }
        `;
        document.head.appendChild(style);
    }

    function positionButton() {
        if (!activeField) return;
        const btn = ensureButton();
        const rect = activeField.getBoundingClientRect();
        btn.style.left = `${Math.min(window.innerWidth - 74, Math.max(10, rect.right - 56))}px`;
        btn.style.top = `${Math.max(10, rect.top + window.scrollY + 8)}px`;
    }

    function showButton(field) {
        activeField = field;
        originalText = fieldText(field);
        const btn = ensureButton();
        btn.classList.add('visible');
        btn.textContent = 'Fix';
        btn.disabled = false;
        positionButton();
    }

    function hideButtonSoon() {
        setTimeout(() => {
            const btn = ensureButton();
            if (document.activeElement !== activeField && !isFixing) {
                btn.classList.remove('visible');
                activeField = null;
            }
        }, 140);
    }

    async function fixActiveField() {
        if (!activeField || isFixing) return;
        const text = fieldText(activeField).trim();
        if (text.length < 3) return;
        const btn = ensureButton();
        isFixing = true;
        btn.disabled = true;
        btn.textContent = 'Fixing';
        try {
            const res = await fetch(`${apiBase()}/ai/fix-writing`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.detail || 'Could not fix writing');
            setFieldText(activeField, data.text || text);
            btn.textContent = 'Done';
            setTimeout(() => {
                if (btn.textContent === 'Done') {
                    btn.textContent = 'Fix';
                    btn.disabled = false;
                }
            }, 1100);
        } catch (err) {
            console.warn('[GRAMMAR] Writing fix failed:', err);
            btn.textContent = 'Retry';
            btn.disabled = false;
        } finally {
            isFixing = false;
        }
    }

    function initGrammarAssist() {
        document.addEventListener('focusin', event => {
            if (isWritableField(event.target)) showButton(event.target);
        });
        document.addEventListener('focusout', event => {
            if (event.target === activeField) hideButtonSoon();
        });
        document.addEventListener('input', event => {
            if (event.target === activeField && fieldText(activeField) !== originalText) {
                ensureButton().textContent = 'Fix';
            }
        });
        window.addEventListener('scroll', positionButton, true);
        window.addEventListener('resize', positionButton);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initGrammarAssist);
    } else {
        initGrammarAssist();
    }
})();
