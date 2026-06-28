/* ============================================
   GetOTTs ? Admin Local Data Store
   localStorage-based fallback for offline admin.
   Syncs to backend API when available.
   ============================================ */

// Nuclear Purge: If the database was wiped, we must clear the user's browser memory too
function performNuclearWipe() {
    console.log('[NUCLEAR WIPE] Wiping all local admin storage...');
    localStorage.removeItem('getotts_admin_products');
    localStorage.removeItem('getotts_admin_settings');
    localStorage.removeItem('getotts_catalog_cache');
    localStorage.removeItem('getotts_product_version');
}

const STORE_KEYS = {
    orders:    'getotts_admin_orders',
    inventory: 'getotts_admin_inventory',
    products:  'getotts_admin_products',
    customers: 'getotts_admin_customers',
    coupons:   'getotts_admin_coupons',
    settings:  'getotts_admin_settings',
    auditLog:  'getotts_admin_audit',
};

let API_BASE = (window.GETOTTS_CONFIG && window.GETOTTS_CONFIG.API_BASE) 
    ? window.GETOTTS_CONFIG.API_BASE 
    : (window.location.origin.includes('localhost') ? 'http://localhost:8000/api/v1' : 'https://api.getotts.com/api/v1');

function extractApiError(err, data) {
    if (data && data.detail) {
        if (typeof data.detail === 'string') return data.detail;
        if (Array.isArray(data.detail)) return data.detail.map(e => e.msg || JSON.stringify(e)).join(', ');
        return JSON.stringify(data.detail);
    }
    if (data && data.message) return data.message;
    if (err && err.message) {
        if (err.message.includes('Failed to fetch')) return 'Network error or timeout. Check connection.';
        return err.message;
    }
    return 'Unknown error occurred.';
}

const AdminStore = {
    // ---- Generic CRUD ----
    _get(key) {
        try { return JSON.parse(localStorage.getItem(key) || '[]'); }
        catch { return []; }
    },
    _set(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
    },
    _getObj(key, fallback = {}) {
        try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
        catch { return fallback; }
    },

    // ---- UUID Generator ----
    uuid() {
        return 'xxxx-xxxx-xxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));
    },

    // ========== ORDERS ==========
    getOrders(filter = '', search = '') {
        let orders = this._get(STORE_KEYS.orders);
        if (filter) orders = orders.filter(o => o.payment_status === filter || o.delivery_status === filter);
        if (search) {
            const s = search.toLowerCase();
            orders = orders.filter(o => 
                (o.order_number || '').toLowerCase().includes(s) ||
                (o.customer_email || '').toLowerCase().includes(s) ||
                (o.customer_phone || '').toLowerCase().includes(s) ||
                (o.product_name || '').toLowerCase().includes(s)
            );
        }
        return orders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    },

    addOrder(order) {
        const orders = this._get(STORE_KEYS.orders);
        order.id = order.id || this.uuid();
        order.order_number = order.order_number || 'GO-' + Date.now().toString(36).toUpperCase();
        order.created_at = order.created_at || new Date().toISOString();
        order.payment_status = order.payment_status || 'pending';
        order.delivery_status = order.delivery_status || 'pending';
        orders.push(order);
        this._set(STORE_KEYS.orders, orders);
        this.log('order_created', 'order', order.id, { order_number: order.order_number });
        return order;
    },

    updateOrder(id, updates) {
        const orders = this._get(STORE_KEYS.orders);
        const idx = orders.findIndex(o => o.id === id);
        if (idx === -1) return null;
        Object.assign(orders[idx], updates, { updated_at: new Date().toISOString() });
        this._set(STORE_KEYS.orders, orders);
        this.log('order_updated', 'order', id, updates);
        return orders[idx];
    },

    getOrderById(id) {
        return this._get(STORE_KEYS.orders).find(o => o.id === id) || null;
    },

    // ========== INVENTORY ==========
    getInventory(filter = '') {
        let inv = this._get(STORE_KEYS.inventory);
        if (filter) inv = inv.filter(i => i.status === filter);
        return inv.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    },

    addInventoryItem(item) {
        const inv = this._get(STORE_KEYS.inventory);
        item.id = item.id || this.uuid();
        item.status = item.status || 'available';
        item.created_at = item.created_at || new Date().toISOString();
        inv.push(item);
        this._set(STORE_KEYS.inventory, inv);
        this.log('inventory_added', 'inventory', item.id, { platform: item.platform, email: item.email });
        
        if (true) {
            fetch(`${API_BASE}/admin/inventory`, {
                credentials: \'include\',
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: item.id,
                    platform_id: item.platform_id,
                    plan_type: item.plan_type,
                    email: item.email,
                    password: item.password
                })
            }).catch(console.warn);
        }

        return item;
    },

    addInventoryBulk(items) {
        const inv = this._get(STORE_KEYS.inventory);
        items.forEach(item => {
            item.id = item.id || this.uuid();
            item.status = item.status || 'available';
            item.created_at = item.created_at || new Date().toISOString();
            inv.push(item);
        });
        this._set(STORE_KEYS.inventory, inv);
        this.log('inventory_bulk_added', 'inventory', null, { count: items.length });

        if (items.length > 0) {
            fetch(`${API_BASE}/admin/inventory/bulk-add`, {
                credentials: \'include\',
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    platform_id: items[0].platform_id,
                    plan_type: items[0].plan_type,
                    accounts: items.map(i => ({ id: i.id, email: i.email, password: i.password }))
                })
            }).catch(console.warn);
        }

        return items;
    },

    updateInventoryItem(id, updates) {
        const inv = this._get(STORE_KEYS.inventory);
        const idx = inv.findIndex(i => i.id === id);
        if (idx === -1) return null;
        Object.assign(inv[idx], updates, { updated_at: new Date().toISOString() });
        this._set(STORE_KEYS.inventory, inv);
        this.log('inventory_updated', 'inventory', id, updates);

        if (true) {
            fetch(`${API_BASE}/admin/inventory/${id}`, {
                credentials: \'include\',
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            }).catch(console.warn);
        }

        return inv[idx];
    },

    deleteInventoryItem(id) {
        let inv = this._get(STORE_KEYS.inventory);
        inv = inv.filter(i => i.id !== id);
        this._set(STORE_KEYS.inventory, inv);
        this.log('inventory_deleted', 'inventory', id);

        if (true) {
            fetch(`${API_BASE}/admin/inventory/${id}`, {
                credentials: \'include\', method: 'DELETE' }).catch(console.warn);
        }
    },

    getAvailableCount(platformId, planType) {
        const inv = this._get(STORE_KEYS.inventory);
        return inv.filter(i => 
            i.platform_id === platformId && 
            i.plan_type === planType && 
            i.status === 'available'
        ).length;
    },

    /** Get stock count for a specific platform by slug or ID */
    getStockByPlatform(platformSlugOrId, planType = 'shared') {
        if (!platformSlugOrId) return 0;
        const inv = this._get(STORE_KEYS.inventory);
        return inv.filter(i => 
            (i.platform_id === platformSlugOrId || (i.platform && i.platform.toLowerCase() === platformSlugOrId.toLowerCase())) && 
            i.plan_type === planType && 
            i.status === 'available'
        ).length;
    },

    // ========== PRODUCTS ==========
    getProducts() {
        const overrides = this._getObj(STORE_KEYS.products, {});
        
        // Build a merged product list from API + fallback to ensure nothing is lost
        let mergedProducts = [];
        const seenSlugs = new Set();
        
        // First, add all products from the live PRODUCTS array (API or fallback)
        if (typeof PRODUCTS !== 'undefined' && Array.isArray(PRODUCTS)) {
            for (const p of PRODUCTS) {
                const slug = p.slug || p.id;
                seenSlugs.add(slug);
                if (p.id) seenSlugs.add(p.id);
                const ov = overrides[p.id] || overrides[slug] || null;
                if (ov && ov._deleted) continue;
                mergedProducts.push({ ...p, ...(ov || {}) });
            }
        }
        
        // FALLBACK_PRODUCTS injection RESTORED for system stability
        if (typeof FALLBACK_PRODUCTS !== 'undefined' && Array.isArray(FALLBACK_PRODUCTS)) {
            for (const fp of FALLBACK_PRODUCTS) {
                if (!seenSlugs.has(fp.id)) {
                    seenSlugs.add(fp.id);
                    const ov = overrides[fp.id] || null;
                    if (ov && ov._deleted) continue;
                    mergedProducts.push({ ...fp, ...(ov || {}) });
                }
            }
        }
        
        // Finally, add custom products created in admin (not in any catalog)
        const allKnownIds = new Set(mergedProducts.map(p => p.id));
        const allKnownSlugs = new Set(mergedProducts.map(p => p.slug).filter(Boolean));
        for (const [id, ov] of Object.entries(overrides)) {
            if (!allKnownIds.has(id) && !allKnownSlugs.has(id) && !(ov.planTypes || ov.prices) && !ov._deleted) {
                mergedProducts.push({
                    id, name: ov.name || 'New Product', category: ov.category || 'other',
                    img: ov.img || '', emoji: ov.emoji || '??', description: ov.description || '',
                    isHot: ov.isHot || false, gradient: ov.gradient || '',
                    features: ov.features || { shared: [] }, variants: ov.variants || [],
                    delivery_mode: ov.delivery_mode || 'automatic',
                    auth_type: ov.auth_type || 'email_password',
                    region_lock: ov.region_lock || 'all',
                    isActive: ov.isActive !== false
                });
            }
        }
        
        return mergedProducts;
    },

    updateProduct(id, updates) {
        const overrides = this._getObj(STORE_KEYS.products, {});
        overrides[id] = { ...(overrides[id] || {}), ...updates };
        this._set(STORE_KEYS.products, overrides);
        // Broadcast version stamp for cross-tab sync with storefront
        localStorage.setItem('getotts_product_version', Date.now().toString());
        this.log('product_updated', 'product', id, updates);
        // NOTE: Do NOT auto-sync here ? partial syncs can wipe products from DB.
        // Admin must use "Force DB Migration" to push changes to production.
        console.log('[AdminStore] Product updated locally. Use Force DB Migration to push to live site.');
    },

    deleteProduct(id) {
        const overrides = this._getObj(STORE_KEYS.products, {});
        const baseIds = (typeof PRODUCTS !== 'undefined') ? new Set(PRODUCTS.map(p => p.id)) : new Set();
        const baseSlugs = (typeof PRODUCTS !== 'undefined') ? new Set(PRODUCTS.map(p => p.slug).filter(Boolean)) : new Set();

        if (baseIds.has(id) || baseSlugs.has(id)) {
            // Base product: soft-delete via _deleted flag (can't remove from hardcoded array)
            overrides[id] = { ...(overrides[id] || {}), _deleted: true };
        } else {
            // Custom product: hard-delete from localStorage
            delete overrides[id];
        }

        this._set(STORE_KEYS.products, overrides);
        localStorage.setItem('getotts_product_version', Date.now().toString());
        this.log('product_deleted', 'product', id);
        // NOTE: Do NOT auto-sync here ? partial syncs can wipe products from DB.
        // Admin must use "Force DB Migration" to push changes to production.
        console.log('[AdminStore] Product deleted locally. Use Force DB Migration to push to live site.');
    },

    // Push entirely new catalog to PostgreSQL backend so it replaces the storefront globally
    async syncCatalogToBackend() {
        const products = this.getProducts();
        
        // Apply per-variant delivery overrides from _variantOverrides
        const overrides = this._getObj(STORE_KEYS.products, {});
        for (const p of products) {
            const ov = overrides[p.id] || overrides[p.slug] || {};
            if (ov._variantOverrides && Array.isArray(ov._variantOverrides) && p.variants) {
                for (const vo of ov._variantOverrides) {
                    const variant = p.variants.find(v => v.sku === vo.sku);
                    if (variant) {
                        variant.delivery_mode = vo.delivery_mode;  // null = inherit
                        variant.auth_type = vo.auth_type;          // null = inherit
                        // Pricing overrides
                        if (vo.price !== undefined) variant.price = vo.price;
                        if (vo.originalPrice !== undefined) variant.originalPrice = vo.originalPrice;
                        if (vo.price_usd !== undefined) variant.price_usd = vo.price_usd;
                        if (vo.original_price_usd !== undefined) variant.original_price_usd = vo.original_price_usd;
                        if (vo.stock !== undefined) variant.stock = vo.stock;
                    }
                }
            }
        }
        
        try {
            const res = await fetch(`${API_BASE}/admin/catalog/migrate`, {
                credentials: 'include',
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ products, confirm_full_replace: true })
            });
            const data = await res.json();
            if (data.success) {
                console.log('[Sync] Entire Catalog synced to backend Database ?');
            } else {
                console.warn('[Sync] Backend sync failed:', data);
            }
        } catch (err) {
            console.warn('[Sync] Could not sync to backend:', err.message);
        }
    },

    // ========== CUSTOMERS ==========
    getCustomers(search = '') {
        let customers = this._get(STORE_KEYS.customers);
        if (search) {
            const q = search.toLowerCase();
            customers = customers.filter(c =>
                (c.name || '').toLowerCase().includes(q) ||
                (c.email || '').toLowerCase().includes(q) ||
                (c.phone || '').includes(q)
            );
        }
        return customers.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    },

    addCustomer(customer) {
        const customers = this._get(STORE_KEYS.customers);
        customer.id = customer.id || this.uuid();
        customer.wallet_balance = customer.wallet_balance || 0;
        customer.total_orders = customer.total_orders || 0;
        customer.total_spent = customer.total_spent || 0;
        customer.created_at = customer.created_at || new Date().toISOString();
        customers.push(customer);
        this._set(STORE_KEYS.customers, customers);
        return customer;
    },

    updateCustomer(id, updates) {
        const customers = this._get(STORE_KEYS.customers);
        const idx = customers.findIndex(c => c.id === id);
        if (idx === -1) return null;
        Object.assign(customers[idx], updates);
        this._set(STORE_KEYS.customers, customers);
        return customers[idx];
    },

    // ========== COUPONS ==========
    getCoupons() {
        let coupons = this._get(STORE_KEYS.coupons);
        // Seed default coupons if empty
        if (!coupons.length) {
            coupons = [
                { id: this.uuid(), code: 'FIRST30', discount_percent: 30, discount_amount: null, min_order: 49, max_uses: 10000, used_count: 0, is_active: true, expires_at: null, created_at: new Date().toISOString() },
                { id: this.uuid(), code: 'COMBO15', discount_percent: 15, discount_amount: null, min_order: 200, max_uses: 5000, used_count: 0, is_active: true, expires_at: null, created_at: new Date().toISOString() },
                { id: this.uuid(), code: 'WELCOME10', discount_percent: 10, discount_amount: null, min_order: 0, max_uses: 10000, used_count: 0, is_active: true, expires_at: null, created_at: new Date().toISOString() },
            ];
            this._set(STORE_KEYS.coupons, coupons);
        }
        return coupons;
    },

    addCoupon(coupon) {
        const coupons = this._get(STORE_KEYS.coupons);
        coupon.id = coupon.id || this.uuid();
        coupon.used_count = 0;
        coupon.is_active = true;
        coupon.created_at = new Date().toISOString();
        coupons.push(coupon);
        this._set(STORE_KEYS.coupons, coupons);
        this.log('coupon_created', 'coupon', coupon.id, { code: coupon.code });
        this.syncCouponsToBackend(coupons);
        return coupon;
    },

    updateCoupon(id, updates) {
        const coupons = this._get(STORE_KEYS.coupons);
        const idx = coupons.findIndex(c => c.id === id);
        if (idx === -1) return null;
        Object.assign(coupons[idx], updates);
        this._set(STORE_KEYS.coupons, coupons);
        this.log('coupon_updated', 'coupon', id, updates);
        this.syncCouponsToBackend(coupons);
        return coupons[idx];
    },

    deleteCoupon(id) {
        let coupons = this._get(STORE_KEYS.coupons);
        coupons = coupons.filter(c => c.id !== id);
        this._set(STORE_KEYS.coupons, coupons);
        this.log('coupon_deleted', 'coupon', id);
        this.syncCouponsToBackend(coupons);
    },

    async syncCouponsToBackend(coupons) {
        try {
            fetch(`${API_BASE}/admin/coupons/migrate`, {
                credentials: \'include\',
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ coupons: coupons })
            });
        } catch (err) {
            console.warn('[Sync] Could not sync coupons:', err);
        }
    },

    // ========== SETTINGS ==========
    getSettings() {
        return this._getObj(STORE_KEYS.settings, {
            site_name: 'GetOTTs',
            support_email: 'support@getotts.com',
            whatsapp: '919088212294',
            instagram: '@getotts',
            telegram: '@getottschannel',
            paygate_url: 'https://paygate.getotts.com',
            paygate_api_key: '',
            default_upi: '',
            currency: 'INR',
            combo_discount_2: 10,
            combo_discount_5: 15,
            combo_discount_7: 20,
            combo_discount_10: 25,
            smtp_host: 'smtp.forwardemail.net',
            smtp_port: '587',
            smtp_user: 'support@getotts.com',
            smtp_password: '',
            smtp_from_name: 'GetOTTs',
            auto_deliver: true,
            delivery_method: 'email',
        });
    },

    // Seeds API key on first run ? won't overwrite if admin already set values
    bootstrapDefaults() {
        const s = this._getObj(STORE_KEYS.settings, {});
        let changed = false;
        // Ensure paygate_url is set to the current production PayGate host.
        if (!s.paygate_url || s.paygate_url.includes('localhost')) {
            s.paygate_url = (window.GETOTTS_CONFIG && window.GETOTTS_CONFIG.PAYGATE_FALLBACK) || 'https://paygate.getotts.com';
            changed = true;
        }
        if (changed) this._set(STORE_KEYS.settings, s);
    },

    saveSettings(settings) {
        this._set(STORE_KEYS.settings, settings);
        this.log('settings_updated', 'settings', null, settings);
    },

    // ========== STATS ==========
    getStats() {
        const orders = this._get(STORE_KEYS.orders);
        const inv = this._get(STORE_KEYS.inventory);
        const customers = this._get(STORE_KEYS.customers);

        const paidOrders = orders.filter(o => o.payment_status === 'paid');
        const totalRevenue = paidOrders.reduce((sum, o) => sum + (parseFloat(o.amount) || 0), 0);

        return {
            total_revenue: totalRevenue,
            total_orders: orders.length,
            paid_orders: paidOrders.length,
            pending_orders: orders.filter(o => o.payment_status === 'pending').length,
            delivered_orders: orders.filter(o => o.delivery_status === 'delivered').length,
            available_inventory: inv.filter(i => i.status === 'available').length,
            total_inventory: inv.length,
            total_customers: customers.length,
        };
    },

    // ========== AUDIT LOG ==========
    log(action, entity, entityId, details = {}) {
        const logs = this._get(STORE_KEYS.auditLog);
        logs.push({
            id: this.uuid(),
            action,
            entity,
            entity_id: entityId,
            details,
            admin: 'admin',
            created_at: new Date().toISOString(),
        });
        // Keep last 500 entries
        if (logs.length > 500) logs.splice(0, logs.length - 500);
        this._set(STORE_KEYS.auditLog, logs);
    },

    getAuditLog(limit = 50) {
        return this._get(STORE_KEYS.auditLog)
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, limit);
    },
};
window.AdminStore = AdminStore;

