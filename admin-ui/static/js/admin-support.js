// Self-contained fetch wrapper for admin support - uses plain fetch with credentials
// (admin.js already overrides window.fetch to inject CSRF tokens)
const _supportFetch = async (endpoint, method = 'GET', body = null) => {
    const base = window.API_BASE
        || (window.GETOTTS_CONFIG && window.GETOTTS_CONFIG.API_BASE)
        || ((window.location.pathname.startsWith('/admin') || window.location.pathname.startsWith('/adminno881') || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
            ? `${window.location.origin}/api/v1`
            : 'https://api.getotts.com/api/v1');
    // endpoint comes as '/api/v1/admin/chat/sessions' — strip /api/v1 prefix since API_BASE already includes it
    const path = endpoint.replace(/^\/api\/v1/, '');
    
    // Add cache buster for GET requests
    const separator = path.includes('?') ? '&' : '?';
    const url = method === 'GET' 
        ? `${base}${path}${separator}t=${Date.now()}` 
        : `${base}${path}`;
        
    const options = { 
        method, 
        credentials: 'include',
        // Force fresh data at fetch level
        cache: 'no-store'
    };
    if (body) {
        options.headers = { 'Content-Type': 'application/json' };
        options.body = JSON.stringify(body);
    }
    const res = await fetch(url, options);
    const contentType = res.headers.get('content-type') || '';
    let payload = {};
    if (contentType.includes('application/json')) {
        payload = await res.json().catch(() => ({}));
    }
    if (!res.ok) {
        return {
            success: false,
            status: res.status,
            message: payload.message || payload.detail || `Support API unavailable (${res.status})`
        };
    }
    if (!contentType.includes('application/json')) {
        return { success: false, status: res.status, message: `Support API returned ${contentType || 'non-JSON response'}` };
    }
    return payload;
};

function supportParseMetadata(raw) {
    if (!raw) return {};
    if (typeof raw === 'object') return raw;
    try {
        return JSON.parse(raw);
    } catch (e) {
        return {};
    }
}

function supportOrderMoney(order = {}) {
    const meta = supportParseMetadata(order.metadata);
    const firstItem = Array.isArray(meta.items) && meta.items[0] && typeof meta.items[0] === 'object'
        ? meta.items[0]
        : {};
    const currency = String(order.currency || meta.wallet_currency || firstItem.currency || 'INR').toUpperCase() === 'USD' ? 'USD' : 'INR';
    const amount = Number(
        meta.server_price !== undefined && meta.server_price !== null && meta.server_price !== ''
            ? meta.server_price
            : (order.amount || 0)
    ) || 0;
    return currency === 'USD'
        ? `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

const ADMIN_SUPPORT = {
    activeCustomerId: null,
    sessions: [],
    tickets: [],
    pollingInterval: null,
    lastMessageCount: 0,
    _pollActive: false,
    presenceInterval: null,

    init() {
        console.log('[AdminSupport] Initializing...');
        // Polling starts only when the chat inbox is opened. Keeping it idle on
        // other admin tabs makes product/inventory pages feel much lighter.
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) this.stopPolling();
            else if (this.isInboxVisible()) this.startPolling();
        });
        
        // Setup Supabase Realtime if available
        this.setupRealtime();
        
        // Inject Ticket Reply Modal
        this.injectModals();
        console.log('[AdminSupport] Init complete');
    },

    setupRealtime() {
        if (window.supabase) {
            const config = window.GETOTTS_CONFIG;
            if (!config || !config.SUPABASE_URL) {
                console.warn('[AdminSupport] Supabase config missing');
                return;
            }

            // Prevent multiple subscriptions
            if (this._realtimeActive) return;

            try {
                this.supabaseClient = window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
                this.supabaseClient
                    .channel('admin_inbox_all')
                    .on('postgres_changes', { 
                        event: 'INSERT', 
                        schema: 'public', 
                        table: 'chat_messages'
                    }, payload => {
                        const msg = payload.new;
                        console.log('[AdminSupport] Realtime message from:', msg.sender);
                        this._realtimeEventsReceived = (this._realtimeEventsReceived || 0) + 1;
                        
                        // 1. Update the active chat if it matches
                        if (this.activeCustomerId === msg.customer_id) {
                            this.mergeMessages([msg]);
                        }
                        
                        // 2. Update the session in the Inbox list
                        const sessionIndex = this.sessions.findIndex(s => s.customer_id === msg.customer_id);
                        if (sessionIndex !== -1) {
                            const session = this.sessions[sessionIndex];
                            session.last_message = msg.message;
                            session.last_message_at = msg.created_at;
                            if (msg.sender === 'user' && this.activeCustomerId !== msg.customer_id) {
                                session.unread_count = (session.unread_count || 0) + 1;
                            }
                            // Move to top and re-render inbox
                            this.sessions.splice(sessionIndex, 1);
                            this.sessions.unshift(session);
                            this.renderInbox();
                        } else {
                            // New session? Trigger a full fetch of sessions
                            this.loadInbox();
                        }
                        
                        // Play sound for incoming user messages
                        if (msg.sender === 'user') {
                            this.playSound();
                        }
                    })
                    .subscribe();
                
                this._realtimeActive = true;
                console.log('[AdminSupport] Realtime channel subscribed (supplementary — polling stays active at 3s)');
                
                // IMPORTANT: Do NOT slow down polling here.
                // Supabase Realtime with anon key may not deliver events due to RLS policies.
                // Polling at 3s remains the primary reliable mechanism.
                // Realtime is purely supplementary — if events come through, they provide instant updates.
            } catch (e) {
                console.warn('[AdminSupport] Realtime setup error:', e);
            }
        } else {
            console.log('[AdminSupport] Supabase library not loaded, falling back to pure polling');
        }
    },

    playSound() {
        try {
            // Using a system-like beep if the file is missing, or trying the standard path
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3');
            audio.volume = 0.5;
            audio.play().catch(() => {});
        } catch (e) {}
    },

    startPolling() {
        if (this.pollingInterval) clearInterval(this.pollingInterval);
        if (!this.isInboxVisible()) return;
        this._pollActive = true;
        console.log('[AdminSupport] Polling started (visible inbox)');
        // Run immediately, then at a modest interval while inbox is visible.
        this.pollData();
        this.pollingInterval = setInterval(() => {
            this.pollData();
        }, this.activeCustomerId ? 5000 : 9000);
    },

    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
            this._pollActive = false;
            console.log('[AdminSupport] Polling stopped');
        }
    },

    async sendPresence() {
        try {
            await _supportFetch('/api/v1/admin/chat/presence', 'POST', { context: 'admin-support' });
        } catch (e) {
            console.warn('[AdminSupport] Presence heartbeat failed:', e.message);
        }
    },

    startPresenceHeartbeat() {
        if (this.presenceInterval) clearInterval(this.presenceInterval);
        this.sendPresence();
        this.presenceInterval = setInterval(() => {
            if (!document.hidden) this.sendPresence();
        }, 30000);
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) this.sendPresence();
        });
    },

    /**
     * Safely merges new messages into the existing active chat state.
     */
    mergeMessages(newMsgs) {
        if (!newMsgs || !newMsgs.length || !this.activeCustomerId) return;
        
        // Initialize messages if needed
        if (!this.messages) this.messages = [];
        
        const oldLen = this.messages.length;
        const msgMap = new Map(this.messages.map(m => [m.id || `temp-${m.created_at}`, m]));
        
        let changed = false;
        newMsgs.forEach(m => {
            const key = m.id || `temp-${m.created_at}`;
            if (!msgMap.has(key)) {
                msgMap.set(key, m);
                changed = true;
            } else {
                // Update existing message if content changed
                const existing = msgMap.get(key);
                if (existing.message !== m.message || existing.is_read !== m.is_read) {
                    msgMap.set(key, m);
                    changed = true;
                }
            }
        });

        if (changed) {
            this.messages = Array.from(msgMap.values()).sort((a, b) => {
                return new Date(a.created_at) - new Date(b.created_at);
            });
            this.lastMessageCount = this.messages.length;
            this.renderChatMessages(this.messages, this.activeOrderDetails);
        }
    },

    async pollData() {
        if (document.hidden || !this.isInboxVisible()) {
            this.stopPolling();
            return;
        }
        try {
            // Poll Inbox session list
            const res = await _supportFetch('/api/v1/admin/chat/sessions', 'GET');
            if (res.success) {
                const oldData = JSON.stringify(this.sessions);
                const newData = JSON.stringify(res.sessions);
                if (oldData !== newData) {
                    this.sessions = res.sessions;
                    this.renderInbox();
                }
            }

            // Poll active chat messages
            if (this.activeCustomerId) {
                const chatRes = await _supportFetch(`/api/v1/admin/chat/${this.activeCustomerId}`, 'GET');
                if (chatRes.success) {
                    this.activeOrderDetails = chatRes.order_details;
                    this.mergeMessages(chatRes.messages);
                }
            }
        } catch(e) {
            console.warn('[AdminSupport] Poll error:', e.message);
        }
    },

    injectModals() {
        if (document.getElementById('adminTicketViewModal')) return;
        
        const html = `
        <div class="modal-overlay admin-ticket-overlay" id="adminTicketOverlay" onclick="ADMIN_SUPPORT.closeTicketModal()"></div>
        <div class="modal-center admin-ticket-modal" id="adminTicketViewModal">
            <div class="modal-header admin-ticket-modal-header">
                <div>
                    <h3 id="adminViewTicketTitle" style="margin:0 0 4px 0;">Ticket</h3>
                    <div style="display:flex; gap:12px; align-items:center;">
                        <span id="adminViewTicketStatus" style="font-size: 0.8rem; padding: 4px 8px; border-radius: 10px; background: var(--gray-100);">Status</span>
                        <select id="adminTicketStatusUpdate" onchange="ADMIN_SUPPORT.updateTicketStatus(this.value)" style="font-size:0.8rem; padding:2px 4px;">
                            <option value="open">Open</option>
                            <option value="in_progress">In Progress</option>
                            <option value="resolved">Resolved</option>
                            <option value="closed">Closed</option>
                        </select>
                    </div>
                </div>
                <button class="modal-close" onclick="ADMIN_SUPPORT.closeTicketModal()">&times;</button>
            </div>
            <div class="modal-body admin-ticket-messages" id="adminTicketMessagesContainer">
                <!-- Messages -->
            </div>
            <div class="admin-ticket-reply-shell">
                <form id="adminTicketReplyForm" onsubmit="ADMIN_SUPPORT.replyTicket(event)" class="admin-ticket-reply-form">
                    <input type="hidden" id="adminReplyTicketId">
                    <input type="text" id="adminReplyMessage" required class="form-input" placeholder="Type a reply to the customer..." style="flex: 1;">
                    <button type="submit" class="btn btn-primary">Reply & Notify</button>
                </form>
            </div>
        </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
    },

    // --- INBOX (CHAT) ---

    async loadInbox() {
        // Ensure polling is active
        if (!this._pollActive) this.startPolling();
        this.startPresenceHeartbeat();
        
        try {
            const res = await _supportFetch('/api/v1/admin/chat/sessions', 'GET');
            if (res.success) {
                this.sessions = res.sessions;
                this.renderInbox();
            }
        } catch (e) {
            console.error(e);
            document.getElementById('inboxSessionList').innerHTML = '<div class="empty-state">Failed to load sessions</div>';
        }
    },

    isInboxVisible() {
        const inbox = document.getElementById('tab-inbox');
        return !!(inbox && inbox.classList.contains('active') && !document.hidden);
    },

    renderInbox() {
        const list = document.getElementById('inboxSessionList');
        if (!this.sessions.length) {
            list.innerHTML = '<div class="empty-state">No active chats</div>';
            return;
        }

        // Sort: active sessions first, then by last message time
        const sorted = [...this.sessions].sort((a, b) => {
            if (a.session_status === 'active' && b.session_status !== 'active') return -1;
            if (a.session_status !== 'active' && b.session_status === 'active') return 1;
            return new Date(b.last_message_at) - new Date(a.last_message_at);
        });

        list.innerHTML = sorted.map(s => {
            const isClosed = s.session_status === 'closed';
            const od = s.order_details;
            const caseHistory = (s.order_history || [])
                .filter(item => item.order_number && item.order_number !== s.order_number)
                .slice(0, 2)
                .map(item => `<span style="background:#f8fafc; color:#64748b; font-size:0.65rem; font-weight:700; padding:2px 7px; border-radius:999px; border:1px solid #e2e8f0;">${this.escapeHTML(item.order_number)}</span>`)
                .join('');
            const orderBadge = od ? `
                <div style="display:flex; align-items:center; gap:6px; margin-top:4px;">
                    <span style="background:#eef2ff; color:#4338ca; font-size:0.7rem; font-weight:700; padding:2px 8px; border-radius:6px;">📦 ${s.order_number}</span>
                    <span style="font-size:0.7rem; color:var(--gray-500);">${od.product_name || ''}</span>
                    ${od.delivery_status ? `<span style="font-size:0.65rem; padding:1px 6px; border-radius:4px; font-weight:700; background:${od.delivery_status === 'delivered' ? '#dcfce7' : od.delivery_status === 'action_required' ? '#fff7ed' : '#f1f5f9'}; color:${od.delivery_status === 'delivered' ? '#15803d' : od.delivery_status === 'action_required' ? '#9a3412' : '#64748b'};">${od.delivery_status.toUpperCase()}</span>` : ''}
                </div>
            ` : '';

            return `
            <div onclick="ADMIN_SUPPORT.openChat('${s.customer_id}', '${this.escapeHTML(s.customer_name)}', '${this.escapeHTML(s.customer_contact)}')"
                 style="padding:16px; border-bottom:1px solid var(--gray-100); cursor:pointer; background:${this.activeCustomerId === s.customer_id ? 'var(--blue-50)' : isClosed ? '#fafafa' : 'white'}; display:flex; gap:12px; align-items:flex-start; ${isClosed ? 'opacity:0.6;' : ''}">
                <div style="width:40px; height:40px; border-radius:50%; background:${s.unread_count > 0 ? 'var(--primary)' : 'var(--gray-200)'}; flex-shrink:0; display:flex; align-items:center; justify-content:center; color:${s.unread_count > 0 ? 'white' : 'var(--gray-600)'};">
                    <i data-lucide="user"></i>
                </div>
                <div style="flex:1; min-width:0;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
                        <strong style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${this.escapeHTML(s.customer_name)}</strong>
                        <div style="display:flex; align-items:center; gap:6px;">
                            ${isClosed ? '<span style="font-size:0.65rem; background:#f1f5f9; color:#64748b; padding:2px 6px; border-radius:4px; font-weight:700;">CLOSED</span>' : ''}
                            ${s.unread_count > 0 ? `<span style="background:#ef4444; color:white; font-size:10px; padding:2px 6px; border-radius:10px;">${s.unread_count}</span>` : ''}
                        </div>
                    </div>
                    <div style="font-size:0.8rem; color:var(--gray-500); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                        ${this.escapeHTML(s.last_message).substring(0, 60)}
                    </div>
                    ${orderBadge}
                    ${caseHistory ? `<div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:6px;">${caseHistory}</div>` : ''}
                </div>
            </div>
        `}).join('');
        
        if (window.lucide) lucide.createIcons();
    },

    async openChat(customerId, name, contact) {
        console.log('[AdminSupport] Opening chat for:', customerId, name);
        this.activeCustomerId = customerId;
        
        const container = document.getElementById('inboxChatMessages');
        const replyInput = document.getElementById('inboxReplyInput');
        const replyBtn = document.getElementById('inboxReplyBtn');
        
        // Update UI
        document.getElementById('inboxActiveName').innerText = name || 'User';
        document.getElementById('inboxActiveContact').innerText = contact || '';
        container.innerHTML = '<div class="empty-state">Loading history...</div>';
        
        if (replyInput) {
            replyInput.disabled = false;
            replyInput.placeholder = `Reply to ${name}...`;
        }
        if (replyBtn) replyBtn.disabled = false;
        
        // Highlight active session
        this.renderInbox();

        // Show/hide close button
        const closeBtnContainer = document.getElementById('inboxCloseContainer');
        if (closeBtnContainer) closeBtnContainer.style.display = 'flex';

        try {
            // Use cache busting for history
            const ts = new Date().getTime();
            const res = await _supportFetch(`/api/v1/admin/chat/${customerId}?t=${ts}`, 'GET');
            if (res.success) {
                // IMPORTANT: Reset messages before merging new customer's history
                this.messages = [];
                this.activeOrderDetails = res.order_details;
                this.mergeMessages(res.messages);
            }
        } catch (e) {
            console.error('[AdminSupport] History error:', e);
            container.innerHTML = '<div class="empty-state">Failed to load messages</div>';
        }
    },

    renderChatMessages(msgs, orderDetails) {
        const container = document.getElementById('inboxChatMessages');
        
        // Show order context card if available
        orderDetails = orderDetails || {};
        const orderKeys = Object.keys(orderDetails);
        let orderContextHtml = '';
        
        if (orderKeys.length > 0) {
            const activeOrderNumber = [...msgs].reverse().find(m => m.order_number && (m.session_status || 'active') === 'active')?.order_number;
            const selectedOrderNumber = activeOrderNumber || [...msgs].reverse().find(m => m.order_number)?.order_number || orderKeys[0];
            const od = orderDetails[selectedOrderNumber] || orderDetails[orderKeys[0]];
            orderContextHtml = `
                <div style="background:linear-gradient(135deg,#eef2ff,#e0e7ff); border:1px solid #c7d2fe; border-radius:12px; padding:14px 16px; margin-bottom:8px;">
                    <div style="font-size:0.75rem; font-weight:800; color:#4338ca; margin-bottom:8px; text-transform:uppercase; letter-spacing:0.05em;">📦 Linked Order Details</div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; font-size:0.8rem;">
                        <div><span style="color:#6366f1;">Order:</span> <strong>${od.order_number}</strong></div>
                        <div><span style="color:#6366f1;">Product:</span> <strong>${od.product_name || '—'}</strong></div>
                        <div><span style="color:#6366f1;">Amount:</span> <strong>${supportOrderMoney(od)}</strong></div>
                        <div><span style="color:#6366f1;">Payment:</span> <strong>${(od.payment_status || '—').toUpperCase()}</strong></div>
                        <div><span style="color:#6366f1;">Delivery:</span> <strong>${(od.delivery_status || '—').toUpperCase()}</strong></div>
                        <div><span style="color:#6366f1;">Mode:</span> <strong>${od.delivery_mode || '—'}</strong></div>
                    </div>
                    ${od.credentials_delivered ? `
                        <div style="margin-top:8px; padding-top:8px; border-top:1px solid #c7d2fe; font-size:0.75rem;">
                            <span style="color:#4338ca; font-weight:700;">Credentials:</span>
                            <code style="background:white; padding:2px 6px; border-radius:4px; font-size:0.75rem;">${JSON.stringify(od.credentials_delivered)}</code>
                        </div>
                    ` : ''}
                </div>
            `;
        }

        container.innerHTML = orderContextHtml + msgs.map(m => {
            const caseMeta = [];
            if (m.order_number) caseMeta.push(`Case ${this.escapeHTML(m.order_number)}`);
            if ((m.session_status || 'active') === 'closed') caseMeta.push('Closed');
            const caseHtml = caseMeta.length ? `<div style="font-size:0.68rem; font-weight:800; color:${m.sender === 'admin' ? 'rgba(255,255,255,0.72)' : '#64748b'}; margin-bottom:5px; text-transform:uppercase; letter-spacing:0.04em;">${caseMeta.join(' · ')}</div>` : '';
            // System messages
            if (m.sender === 'system') {
                return `<div style="background:#f0f4ff; color:#4338ca; padding:12px; border-radius:10px; font-size:0.8rem; white-space:pre-line; border:1px dashed #c7d2fe; align-self:center; text-align:center; max-width:90%;">
                    ${caseHtml}
                    ${this.escapeHTML(m.message)}
                </div>`;
            }
            return `
            <div style="background: ${m.sender === 'admin' ? '#1a1a2e' : 'white'}; color: ${m.sender === 'admin' ? 'white' : '#1a1a2e'}; padding: 12px 16px; border-radius: 12px; max-width: 80%; align-self: ${m.sender === 'admin' ? 'flex-end' : 'flex-start'}; box-shadow: 0 2px 8px rgba(0,0,0,0.05); border: ${m.sender === 'user' ? '1px solid #eaeaea' : 'none'};">
                ${caseHtml}
                <div style="line-height: 1.4;">${this.escapeHTML(m.message)}</div>
                <div style="font-size:0.7rem; opacity:0.6; margin-top:4px; text-align:right;">${new Date(m.created_at).toLocaleTimeString()}</div>
            </div>
        `}).join('');
        container.scrollTop = container.scrollHeight;
        
        // Clear unread badge locally
        const session = this.sessions.find(s => s.customer_id === this.activeCustomerId);
        if (session && session.unread_count > 0) {
            session.unread_count = 0;
            // Need to render inbox to clear the badge visually
            // But only if we changed it, to avoid infinite loop of rendering
            // Actually, wait, if we renderInbox here it will re-render list
            // Let's just do it quietly if possible.
        }
    },

    async sendReply(e) {
        e.preventDefault();
        if (!this.activeCustomerId) return;
        
        const input = document.getElementById('inboxReplyInput');
        const message = input.value.trim();
        if (!message) return;

        input.value = '';
        
        // Optimistic UI
        const tempMsg = {
            id: 'temp-' + Date.now(),
            sender: 'admin',
            message: message,
            created_at: new Date().toISOString()
        };
        this.mergeMessages([tempMsg]);

        try {
            const res = await _supportFetch(`/api/v1/admin/chat/${this.activeCustomerId}/reply`, 'POST', { message });
            if (res.success) {
                // Remove temp and add real one
                this.messages = this.messages.filter(m => m.id !== tempMsg.id);
                this.mergeMessages([res.message]);
            }
        } catch (err) {
            console.error('[AdminSupport] Reply error:', err);
            showToast("Failed to send", "error");
            this.messages = this.messages.filter(m => m.id !== tempMsg.id);
            this.renderChatMessages(this.messages, this.activeOrderDetails);
        }
    },

    async closeChat() {
        if (!this.activeCustomerId) return;
        
        if (!confirm('Close this chat session? The customer can start a new one if needed.')) return;

        try {
            await _supportFetch(`/api/v1/admin/chat/${this.activeCustomerId}/close`, 'POST');
            showToast("Chat session closed", "success");
            // Refresh
            this.loadInbox();
            this.activeCustomerId = null;
            document.getElementById('inboxChatMessages').innerHTML = '<div class="empty-state" style="padding:40px;">Select a chat from the left to view messages</div>';
            document.getElementById('inboxActiveName').innerText = 'Select a chat';
            document.getElementById('inboxActiveContact').innerText = '';
        } catch (err) {
            showToast("Failed to close session", "error");
        }
    },

    // --- TICKETS ---

    async loadTickets() {
        const statusFilter = document.getElementById('adminTicketStatusFilter');
        const status = statusFilter ? statusFilter.value : '';
        this.renderTicketsState('Loading tickets...');
        try {
            const res = await _supportFetch(`/api/v1/admin/tickets${status ? '?status='+status : ''}`, 'GET');
            if (res.success) {
                this.tickets = Array.isArray(res.tickets) ? res.tickets : [];
                this.renderAdminTickets();
                return;
            }
            this.tickets = [];
            const message = res.status === 401
                ? 'Admin session expired. Please refresh and login again.'
                : (res.message || res.detail || 'Failed to load tickets.');
            this.renderTicketsState(message);
        } catch (e) {
            console.error(e);
            this.tickets = [];
            this.renderTicketsState('Network error while loading tickets.');
        }
    },

    renderTicketsState(message) {
        const tbody = document.getElementById('adminTicketsBody');
        if (!tbody) return;
        tbody.innerHTML = `<tr><td colspan="7" class="empty-state">${this.escapeHTML(message)}</td></tr>`;
    },

    renderAdminTickets() {
        const tbody = document.getElementById('adminTicketsBody');
        if (!tbody) return;
        if (!this.tickets.length) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No tickets found</td></tr>';
            return;
        }

        const getStatusColor = (status) => {
            if (status === 'open') return 'background: #fee2e2; color: #ef4444;';
            if (status === 'in_progress') return 'background: #fef3c7; color: #f59e0b;';
            if (status === 'resolved') return 'background: #dcfce7; color: #10b981;';
            return 'background: var(--gray-100); color: var(--gray-600);';
        };

        tbody.innerHTML = this.tickets.map(t => `
            <tr>
                <td style="font-family:monospace;">${t.ticket_number}</td>
                <td>
                    <div style="font-weight:600;">${this.escapeHTML(t.customers?.name || 'Unknown')}</div>
                    <div style="font-size:0.8rem; color:var(--gray-500);">${this.escapeHTML(t.customers?.email || t.customers?.phone || '')}</div>
                </td>
                <td style="font-weight:600;">${this.escapeHTML(t.subject)}</td>
                <td>${t.category}</td>
                <td>
                    <span style="padding: 4px 10px; border-radius: 12px; font-size: 0.75rem; font-weight: 700; ${getStatusColor(t.status)}">
                        ${t.status.toUpperCase().replace('_', ' ')}
                    </span>
                </td>
                <td style="font-size:0.85rem; color:var(--gray-500);">${new Date(t.created_at).toLocaleDateString()}</td>
                <td>
                    <button class="btn btn-outline btn-sm" onclick="ADMIN_SUPPORT.openTicketModal('${t.id}')">Manage</button>
                </td>
            </tr>
        `).join('');
    },

    openTicketModal(ticketId) {
        const ticket = this.tickets.find(t => t.id === ticketId);
        if (!ticket) return;

        document.getElementById('adminViewTicketTitle').innerText = `[${ticket.ticket_number}] ${ticket.subject}`;
        document.getElementById('adminViewTicketStatus').innerText = ticket.status.toUpperCase();
        document.getElementById('adminTicketStatusUpdate').value = ticket.status;
        document.getElementById('adminReplyTicketId').value = ticket.id;

        const messages = Array.isArray(ticket.ticket_messages) ? ticket.ticket_messages : [];
            const msgsHtml = messages.length ? messages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)).map(m => `
            <div class="admin-ticket-message ${m.sender === 'admin' ? 'is-admin' : 'is-user'}">
                <div style="font-size: 0.75rem; opacity: 0.7; margin-bottom: 6px;">${m.sender === 'admin' ? 'You' : (ticket.customers?.name || 'Customer')}</div>
                <div style="line-height: 1.5;">${this.escapeHTML(m.message).replace(/\n/g, '<br>')}</div>
            </div>
        `).join('') : '<div class="empty-state">No messages yet</div>';

        document.getElementById('adminTicketMessagesContainer').innerHTML = msgsHtml;

        document.getElementById('adminTicketOverlay').style.display = 'block';
        document.getElementById('adminTicketViewModal').style.display = 'flex';
        
        setTimeout(() => {
            const container = document.getElementById('adminTicketMessagesContainer');
            container.scrollTop = container.scrollHeight;
        }, 50);
    },

    closeTicketModal() {
        document.getElementById('adminTicketOverlay').style.display = 'none';
        document.getElementById('adminTicketViewModal').style.display = 'none';
    },

    async replyTicket(e) {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        const ticketId = document.getElementById('adminReplyTicketId').value;
        const message = document.getElementById('adminReplyMessage').value;
        
        btn.disabled = true;
        btn.innerText = 'Sending...';

        try {
            const res = await _supportFetch(`/api/v1/admin/tickets/${ticketId}/reply`, 'POST', { message });
            if (res.success) {
                document.getElementById('adminReplyMessage').value = '';
                showToast("Reply sent to customer via Email", "success");
                await this.loadTickets();
                this.openTicketModal(ticketId);
            } else {
                showToast(res.message || res.detail || "Failed to reply", "error");
            }
        } catch (err) {
            showToast("Network error", "error");
        } finally {
            btn.disabled = false;
            btn.innerText = 'Reply & Notify';
        }
    },

    async updateTicketStatus(status) {
        const ticketId = document.getElementById('adminReplyTicketId').value;
        try {
            const res = await _supportFetch(`/api/v1/admin/tickets/${ticketId}/status`, 'PUT', { status });
            if (res.success) {
                showToast("Status updated", "success");
                document.getElementById('adminViewTicketStatus').innerText = status.toUpperCase();
                this.loadTickets();
            } else {
                showToast(res.message || res.detail || "Failed to update status", "error");
            }
        } catch (err) {
            showToast("Failed to update status", "error");
        }
    },

    escapeHTML(str) {
        if (!str) return '';
        return String(str).replace(/[&<>'"]/g, 
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag] || tag)
        );
    }
};

window.ADMIN_SUPPORT = ADMIN_SUPPORT;

document.addEventListener('DOMContentLoaded', () => {
    window.ADMIN_SUPPORT = ADMIN_SUPPORT;
    ADMIN_SUPPORT.init();
});
