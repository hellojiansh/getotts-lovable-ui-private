/* ============================================
   GetOTTs — Admin Live Site Editor
   Enables drag-and-drop reordering & inline text
   editing on the storefront when admin is logged in.
   ============================================ */

(function() {
    'use strict';

    const EDITOR_KEY = 'getotts_site_edits';
    const LAYOUT_KEY = 'getotts_site_layout';
    let editorActive = false;
    let dragSrcEl = null;

    // ---- Check if admin is logged in ----
    function isAdminLoggedIn() {
        return !!localStorage.getItem('admin_token');
    }

    // ---- Save/Load edits from localStorage + sync to backend ----
    function getSavedEdits() {
        try { return JSON.parse(localStorage.getItem(EDITOR_KEY) || '{}'); }
        catch { return {}; }
    }

    function saveEdits(edits) {
        localStorage.setItem(EDITOR_KEY, JSON.stringify(edits));
        syncEditsToBackend(edits);
    }

    function getSavedLayout() {
        try { return JSON.parse(localStorage.getItem(LAYOUT_KEY) || '{}'); }
        catch { return {}; }
    }

    function saveLayout(layout) {
        localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
        syncLayoutToBackend(layout);
    }

    // ---- Sync to backend so other browsers see changes ----
    async function syncEditsToBackend(edits) {
        const API = (window.GETOTTS_CONFIG && window.GETOTTS_CONFIG.API_BASE) || '';
        if (!API) return;
        try {
            await fetch(`${API}/admin/site-edits`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ edits, type: 'text_edits' })
            });
            console.log('[SiteEditor] Text edits synced to backend ✅');
        } catch(e) { console.warn('[SiteEditor] Sync failed:', e.message); }
    }

    async function syncLayoutToBackend(layout) {
        const API = (window.GETOTTS_CONFIG && window.GETOTTS_CONFIG.API_BASE) || '';
        if (!API) return;
        try {
            await fetch(`${API}/admin/site-edits`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ edits: layout, type: 'layout' })
            });
            console.log('[SiteEditor] Layout synced to backend ✅');
        } catch(e) { console.warn('[SiteEditor] Layout sync failed:', e.message); }
    }

    // ---- Load edits from backend (for non-admin visitors) ----
    async function loadEditsFromBackend() {
        const API = (window.GETOTTS_CONFIG && window.GETOTTS_CONFIG.API_BASE) || '';
        if (!API) return;
        try {
            const res = await fetch(`${API}/admin/site-edits`);
            const data = await res.json();
            if (data.success) {
                if (data.text_edits) applyTextEdits(data.text_edits);
                if (data.layout) applyLayout(data.layout);
            }
        } catch(e) { /* silent fail for visitors */ }
    }

    // ---- Apply saved text edits ----
    function applyTextEdits(edits) {
        if (!edits || typeof edits !== 'object') return;
        Object.entries(edits).forEach(([selector, content]) => {
            const el = document.querySelector(selector);
            if (el) el.innerHTML = content;
        });
    }

    // ---- Apply saved layout order ----
    function applyLayout(layout) {
        if (!layout || typeof layout !== 'object') return;
        Object.entries(layout).forEach(([containerSel, childOrder]) => {
            const container = document.querySelector(containerSel);
            if (!container || !Array.isArray(childOrder)) return;
            childOrder.forEach(childId => {
                const child = container.querySelector(`[data-id="${childId}"], [data-edit-id="${childId}"]`) || document.getElementById(childId);
                if (child) container.appendChild(child);
            });
        });
    }

    // ---- Generate unique selector for an element ----
    function getSelector(el) {
        if (el.id) return '#' + el.id;
        if (el.dataset.editId) return `[data-edit-id="${el.dataset.editId}"]`;

        // Build a path
        const path = [];
        let current = el;
        while (current && current !== document.body) {
            let selector = current.tagName.toLowerCase();
            if (current.id) {
                path.unshift('#' + current.id);
                break;
            }
            const parent = current.parentElement;
            if (parent) {
                const siblings = Array.from(parent.children).filter(c => c.tagName === current.tagName);
                if (siblings.length > 1) {
                    const idx = siblings.indexOf(current) + 1;
                    selector += `:nth-of-type(${idx})`;
                }
            }
            path.unshift(selector);
            current = current.parentElement;
        }
        return path.join(' > ');
    }

    // ---- Make elements editable ----
    function enableInlineEditing() {
        // Select all text-containing elements
        const editables = document.querySelectorAll(
            'h1, h2, h3, h4, h5, h6, p, span, a, li, td, th, label, ' +
            '.stat strong, .hero-text h1, .hero-text p, .section-title, ' +
            '.card-title, .feature-title, .review-text, .review-name'
        );

        editables.forEach(el => {
            // Skip script/style/nav links
            if (el.closest('script, style, nav, .site-editor-toolbar')) return;
            if (el.children.length > 3) return; // skip containers with many children

            el.setAttribute('contenteditable', 'true');
            el.style.outline = 'none';
            el.style.cursor = 'text';

            // Highlight on hover
            el.addEventListener('mouseenter', () => {
                if (!editorActive) return;
                el.style.outline = '2px dashed rgba(99,102,241,0.5)';
                el.style.borderRadius = '4px';
            });
            el.addEventListener('mouseleave', () => {
                el.style.outline = 'none';
            });

            // Save on blur
            el.addEventListener('blur', () => {
                const selector = getSelector(el);
                const edits = getSavedEdits();
                edits[selector] = el.innerHTML;
                saveEdits(edits);
                showSaveIndicator();
            });
        });
    }

    // ---- Make sections draggable using SortableJS ----
    let sortableInstances = [];

    function enableDragDrop() {
        // Clean up old instances
        sortableInstances.forEach(s => s.destroy());
        sortableInstances = [];

        if (typeof Sortable === 'undefined') {
            console.warn('[SiteEditor] SortableJS not loaded');
            return;
        }

        // 1. Make product cards within rows draggable
        const productRows = document.querySelectorAll(
            '.product-row, .trust-grid, .review-grid, .reviews-grid, .how-steps-grid'
        );

        productRows.forEach(container => {
            // Add drag handles to children
            Array.from(container.children).forEach((child, i) => {
                if (!child.dataset.editId) {
                    child.dataset.editId = `item-${i}-${container.id || container.className.split(' ')[0]}`;
                }
                // Add visual drag handle if not present
                if (!child.querySelector('.drag-handle')) {
                    const handle = document.createElement('div');
                    handle.className = 'drag-handle';
                    handle.innerHTML = '⠿';
                    Object.assign(handle.style, {
                        position: 'absolute', top: '8px', left: '8px',
                        background: 'rgba(99,102,241,0.85)', color: '#fff',
                        width: '28px', height: '28px', borderRadius: '6px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'grab', zIndex: '50', fontSize: '14px', fontWeight: 'bold',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.2)', userSelect: 'none',
                    });
                    child.style.position = 'relative';
                    child.prepend(handle);
                }
            });

            const instance = new Sortable(container, {
                handle: '.drag-handle',
                animation: 200,
                ghostClass: 'sortable-ghost',
                chosenClass: 'sortable-chosen',
                dragClass: 'sortable-drag',
                onEnd: () => {
                    // Save new order
                    const containerSel = getSelector(container);
                    const layout = getSavedLayout();
                    layout[containerSel] = Array.from(container.children).map(c => c.dataset.id || c.dataset.editId || c.id);
                    saveLayout(layout);
                    showSaveIndicator();
                }
            });
            sortableInstances.push(instance);
        });

        // 2. Make top-level page sections draggable
        const mainSections = document.querySelectorAll(
            'section.hero, section.payment-strip, section.catalog-section, ' +
            'section.reviews-section, section.faq-section, section.how-section, ' +
            'section.policy-bar, section.trust-section'
        );
        const sectionsParent = mainSections.length > 0 ? mainSections[0].parentElement : null;

        if (sectionsParent && mainSections.length > 1) {
            // Add drag handles to sections
            mainSections.forEach((section, i) => {
                if (!section.dataset.editId) {
                    section.dataset.editId = `section-${i}-${section.id || section.className.split(' ')[0]}`;
                }
                if (!section.querySelector('.section-drag-handle')) {
                    const handle = document.createElement('div');
                    handle.className = 'section-drag-handle';
                    handle.innerHTML = '☰ Drag to reorder section';
                    Object.assign(handle.style, {
                        position: 'absolute', top: '0', left: '50%', transform: 'translateX(-50%)',
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff',
                        padding: '4px 16px', borderRadius: '0 0 8px 8px',
                        cursor: 'grab', zIndex: '50', fontSize: '0.75rem', fontWeight: '600',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.2)', userSelect: 'none',
                        letterSpacing: '0.5px',
                    });
                    section.style.position = 'relative';
                    section.prepend(handle);
                }
            });

            const sectionInstance = new Sortable(sectionsParent, {
                handle: '.section-drag-handle',
                animation: 300,
                ghostClass: 'sortable-ghost',
                chosenClass: 'sortable-chosen',
                filter: 'script, style, link, footer, nav, header',
                onEnd: () => {
                    const layout = getSavedLayout();
                    layout['__page_sections'] = Array.from(
                        sectionsParent.querySelectorAll(':scope > section')
                    ).map(s => s.dataset.id || s.dataset.editId || s.id);
                    saveLayout(layout);
                    showSaveIndicator();
                }
            });
            sortableInstances.push(sectionInstance);
        }

        // Add CSS for drag states
        if (!document.getElementById('sortableStyles')) {
            const style = document.createElement('style');
            style.id = 'sortableStyles';
            style.textContent = `
                .sortable-ghost { opacity: 0.3; }
                .sortable-chosen { box-shadow: 0 0 0 3px #6366f1 !important; }
                .sortable-drag { opacity: 0.9; transform: rotate(1deg); }
                .drag-handle:hover { background: rgba(99,102,241,1) !important; transform: scale(1.1); }
                .section-drag-handle:hover { background: linear-gradient(135deg, #4f46e5, #7c3aed) !important; }
            `;
            document.head.appendChild(style);
        }
    }

    // ---- Show save indicator ----
    function showSaveIndicator() {
        let indicator = document.getElementById('editorSaveIndicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'editorSaveIndicator';
            Object.assign(indicator.style, {
                position: 'fixed', bottom: '80px', right: '20px',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                color: '#fff', padding: '10px 20px', borderRadius: '8px',
                fontFamily: 'Inter, sans-serif', fontSize: '0.85rem', fontWeight: '600',
                zIndex: '99999', boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                transition: 'opacity 0.3s, transform 0.3s', transform: 'translateY(10px)', opacity: '0',
            });
            document.body.appendChild(indicator);
        }
        indicator.textContent = '✅ Changes saved & syncing...';
        indicator.style.opacity = '1';
        indicator.style.transform = 'translateY(0)';
        setTimeout(() => {
            indicator.style.opacity = '0';
            indicator.style.transform = 'translateY(10px)';
        }, 2500);
    }

    // ---- Disable editing ----
    function disableEditing() {
        document.querySelectorAll('[contenteditable="true"]').forEach(el => {
            el.removeAttribute('contenteditable');
            el.style.cursor = '';
            el.style.outline = '';
        });
        document.querySelectorAll('[draggable="true"]').forEach(el => {
            el.removeAttribute('draggable');
            el.style.cursor = '';
        });
        // Destroy SortableJS instances and remove drag handles
        sortableInstances.forEach(s => s.destroy());
        sortableInstances = [];
        document.querySelectorAll('.drag-handle, .section-drag-handle').forEach(h => h.remove());
    }

    // ---- Create Editor Toolbar ----
    function createToolbar() {
        const toolbar = document.createElement('div');
        toolbar.className = 'site-editor-toolbar';
        toolbar.id = 'siteEditorToolbar';
        toolbar.innerHTML = `
            <div style="display:flex; align-items:center; gap:12px; padding:10px 20px; 
                        background:linear-gradient(135deg, #1e1b4b, #312e81); 
                        color:#fff; font-family:Inter,sans-serif; font-size:0.85rem;
                        box-shadow:0 -4px 20px rgba(0,0,0,0.3); position:fixed; bottom:0; left:0; right:0; z-index:99998;">
                <span style="display:flex;align-items:center;gap:6px;font-weight:700;">
                    <span style="font-size:1.1rem;">🎨</span> Admin Editor
                </span>
                <span style="color:rgba(255,255,255,0.5);">|</span>
                <button id="editorToggleEdit" style="background:rgba(255,255,255,0.15);border:none;color:#fff;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:0.8rem;font-family:inherit;transition:background 0.2s;">
                    ✏️ Edit Text
                </button>
                <button id="editorToggleDrag" style="background:rgba(255,255,255,0.15);border:none;color:#fff;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:0.8rem;font-family:inherit;transition:background 0.2s;">
                    🔀 Drag & Drop
                </button>
                <button id="editorResetAll" style="background:rgba(239,68,68,0.3);border:none;color:#fca5a5;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:0.8rem;font-family:inherit;transition:background 0.2s;">
                    🔄 Reset All
                </button>
                <button id="editorSaveAll" style="background:linear-gradient(135deg,#10b981,#059669);border:none;color:#fff;padding:8px 20px;border-radius:6px;cursor:pointer;font-size:0.85rem;font-weight:700;font-family:inherit;transition:all 0.2s;box-shadow:0 2px 8px rgba(16,185,129,0.4);">
                    💾 Save All to Cloud
                </button>
                <span style="flex:1;"></span>
                <button id="editorGoAdmin" style="background:rgba(255,255,255,0.15);border:none;color:#fff;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:0.8rem;font-family:inherit;">
                    ⚙️ Admin Panel
                </button>
                <span id="editorStatus" style="color:rgba(255,255,255,0.6);font-size:0.75rem;">Ready</span>
            </div>
        `;
        document.body.appendChild(toolbar);
        document.body.style.paddingBottom = '50px';

        let editMode = false;
        let dragMode = false;

        document.getElementById('editorToggleEdit').addEventListener('click', (e) => {
            editMode = !editMode;
            editorActive = editMode;
            e.target.style.background = editMode ? 'rgba(99,102,241,0.6)' : 'rgba(255,255,255,0.15)';
            if (editMode) {
                enableInlineEditing();
                document.getElementById('editorStatus').textContent = '✏️ Click any text to edit';
            } else {
                disableEditing();
                document.getElementById('editorStatus').textContent = 'Ready';
            }
        });

        document.getElementById('editorToggleDrag').addEventListener('click', (e) => {
            dragMode = !dragMode;
            e.target.style.background = dragMode ? 'rgba(99,102,241,0.6)' : 'rgba(255,255,255,0.15)';
            if (dragMode) {
                enableDragDrop();
                document.getElementById('editorStatus').textContent = '🔀 Drag items to reorder';
            } else {
                disableEditing();
                document.getElementById('editorStatus').textContent = 'Ready';
            }
        });

        document.getElementById('editorResetAll').addEventListener('click', () => {
            if (confirm('Reset all editor changes? This cannot be undone.')) {
                localStorage.removeItem(EDITOR_KEY);
                localStorage.removeItem(LAYOUT_KEY);
                location.reload();
            }
        });

        document.getElementById('editorGoAdmin').addEventListener('click', () => {
            window.location.href = '/admin';
        });

        // SAVE ALL — syncs text edits, layout, and catalog to the backend
        document.getElementById('editorSaveAll').addEventListener('click', async () => {
            const btn = document.getElementById('editorSaveAll');
            const status = document.getElementById('editorStatus');
            btn.textContent = '⏳ Saving...';
            btn.style.background = 'rgba(255,255,255,0.2)';
            status.textContent = '☁️ Syncing to cloud...';

            const API = (window.GETOTTS_CONFIG && window.GETOTTS_CONFIG.API_BASE) || '';
            let saved = 0;
            let errors = [];

            // 1) Sync text edits
            try {
                const edits = getSavedEdits();
                if (Object.keys(edits).length > 0) {
                    await fetch(`${API}/admin/site-edits`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ edits, type: 'text_edits' })
                    });
                    saved++;
                }
            } catch(e) { errors.push('text edits'); }

            // 2) Sync layout order
            try {
                const layout = getSavedLayout();
                if (Object.keys(layout).length > 0) {
                    await fetch(`${API}/admin/site-edits`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ edits: layout, type: 'layout' })
                    });
                    saved++;
                }
            } catch(e) { errors.push('layout'); }

            // 3) Sync product catalog
            try {
                const products = typeof getAllProducts === 'function' ? getAllProducts() : [];
                if (products.length > 0) {
                    const res = await fetch(`${API}/admin/catalog/migrate`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ products, confirm_full_replace: true })
                    });
                    const data = await res.json();
                    if (data.success) saved++;
                }
            } catch(e) { errors.push('catalog'); }

            // 4) Sync settings
            try {
                const settings = JSON.parse(localStorage.getItem('getotts_admin_settings') || '{}');
                if (Object.keys(settings).length > 0) {
                    await fetch(`${API}/admin/settings/save`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ settings })
                    });
                    saved++;
                }
            } catch(e) { errors.push('settings'); }

            // Show result
            if (errors.length === 0) {
                btn.textContent = '✅ Saved!';
                btn.style.background = 'linear-gradient(135deg,#10b981,#059669)';
                status.textContent = `✅ ${saved} items synced to cloud`;
                showSaveIndicator();
            } else {
                btn.textContent = '⚠️ Partial Save';
                btn.style.background = 'rgba(234,179,8,0.5)';
                status.textContent = `⚠️ Failed: ${errors.join(', ')}`;
            }

            setTimeout(() => {
                btn.textContent = '💾 Save All to Cloud';
                btn.style.background = 'linear-gradient(135deg,#10b981,#059669)';
            }, 3000);
        });
    }

    // ---- Init ----
    let editsApplied = false;

    function applyAllEdits() {
        // Apply from localStorage (instant, same-browser)
        const savedEdits = getSavedEdits();
        if (Object.keys(savedEdits).length > 0) {
            applyTextEdits(savedEdits);
        }
        const savedLayout = getSavedLayout();
        if (Object.keys(savedLayout).length > 0) {
            applyLayout(savedLayout);
        }

        // Apply from backend (cross-browser, the real fix)
        loadEditsFromBackend();
        editsApplied = true;
    }

    window.addEventListener('DOMContentLoaded', () => {
        // Show editor toolbar only if admin is logged in
        // And we're NOT on the admin page itself
        if (isAdminLoggedIn() && !window.location.pathname.includes('admin')) {
            createToolbar();
        }
    });

    // Apply edits AFTER products finish rendering (fired by app.js)
    window.addEventListener('productsRendered', () => {
        console.log('[SiteEditor] Products rendered — applying saved edits');
        applyAllEdits();
    });

    // Fallback: if 'productsRendered' never fires (e.g. on non-product pages),
    // apply edits after a short delay
    setTimeout(() => {
        if (!editsApplied) {
            console.log('[SiteEditor] Fallback — applying edits after timeout');
            applyAllEdits();
        }
    }, 3000);
})();
