/**
 * Admin Chat Application
 * Handles real-time polling, session management, and messaging.
 */

const app = {
    sessions: [],
    activeCustomerId: null,
    messages: [],
    isPolling: false,
    pollInterval: null,
    messageMap: new Map(), // To prevent duplicates
    unreadTotal: 0,
    isTabActive: true,
    lastMessageId: null,
    presenceInterval: null,

    init() {
        console.log("[AdminChat] Initializing...");
        this.loadSessions();
        this.startPolling();
        this.startPresenceHeartbeat();
        this.setupEventListeners();
        
        // Tab visibility check for notifications
        document.addEventListener('visibilitychange', () => {
            this.isTabActive = !document.hidden;
            if (this.isTabActive) {
                this.updateTitle(0); // Reset count when coming back
            }
        });
    },

    setupEventListeners() {
        const searchInput = document.getElementById('sessionSearch');
        if (searchInput) {
            searchInput.addEventListener('input', () => this.filterSessions());
        }
    },

    getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
    },

    async _fetch(url, options = {}) {
        const timestamp = Date.now();
        const separator = url.includes('?') ? '&' : '?';
        const finalUrl = `${url}${separator}t=${timestamp}`;
        
        // CSRF Token - check meta tag first, then fallback to cookies
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || 
                          this.getCookie('admin_csrf_token') || 
                          this.getCookie('csrf_token');

        const defaultOptions = {
            credentials: 'include',
            headers: {
                'Cache-Control': 'no-store, no-cache, must-revalidate',
                'Pragma': 'no-cache',
                'Accept': 'application/json'
            },
            ...options
        };

        // Inject CSRF for mutating methods
        if (options.method && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(options.method.toUpperCase())) {
            if (csrfToken) {
                defaultOptions.headers['X-CSRF-Token'] = csrfToken;
            }
            if (!defaultOptions.headers['Content-Type']) {
                defaultOptions.headers['Content-Type'] = 'application/json';
            }
        }

        try {
            const response = await fetch(finalUrl, defaultOptions);
            if (response.status === 401) {
                window.location.href = '/adminno881/login';
                return null;
            }
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.detail || `HTTP error! status: ${response.status}`);
            }
            return data;
        } catch (error) {
            console.error(`[AdminChat] Fetch error (${url}):`, error);
            this.showStatusOverlay(true);
            return { success: false, detail: error.message };
        }
    },

    startPolling() {
        if (this.pollInterval) clearInterval(this.pollInterval);
        this.pollInterval = setInterval(() => {
            this.loadSessions();
            if (this.activeCustomerId) {
                this.loadMessages(this.activeCustomerId);
            }
        }, 2000);
    },

    async sendPresence() {
        await this._fetch('/api/v1/admin/chat/presence', {
            method: 'POST',
            body: JSON.stringify({ context: 'admin-chat' })
        });
    },

    startPresenceHeartbeat() {
        if (this.presenceInterval) clearInterval(this.presenceInterval);
        this.sendPresence();
        this.presenceInterval = setInterval(() => {
            if (!document.hidden) this.sendPresence();
        }, 30000);
    },

    async loadSessions() {
        const data = await this._fetch('/api/v1/admin/chat/sessions');
        if (!data || !data.success) return;

        this.showStatusOverlay(false);
        this.sessions = data.sessions;
        this.renderSessions();
        this.calculateUnread();
    },

    renderSessions() {
        const list = document.getElementById('sessionList');
        const searchTerm = document.getElementById('sessionSearch').value.toLowerCase();
        
        const filtered = this.sessions.filter(s => 
            s.customer_name.toLowerCase().includes(searchTerm) || 
            s.customer_email.toLowerCase().includes(searchTerm) ||
            s.customer_phone.toLowerCase().includes(searchTerm)
        );

        // Sort: Unread first, then by last message time
        filtered.sort((a, b) => {
            if (a.unread_count !== b.unread_count) return b.unread_count - a.unread_count;
            return new Date(b.last_message_at) - new Date(a.last_message_at);
        });

        if (filtered.length === 0) {
            list.innerHTML = '<div class="loading-state">No conversations found.</div>';
            return;
        }

        list.innerHTML = filtered.map(s => `
            <div class="session-item ${this.activeCustomerId === s.customer_id ? 'active' : ''}" 
                 onclick="app.selectSession('${s.customer_id}')">
                <div class="avatar">${s.customer_name.charAt(0).toUpperCase()}</div>
                <div class="info">
                    <div class="info-top">
                        <span class="name">${this.escapeHTML(s.customer_name)}</span>
                        <span class="time">${this.formatTime(s.last_message_at)}</span>
                    </div>
                    <div class="info-bottom">
                        <span class="preview">${this.escapeHTML(s.last_message || '')}</span>
                        ${s.unread_count > 0 ? `<span class="unread-badge">${s.unread_count}</span>` : ''}
                    </div>
                    ${this.renderCaseSummary(s)}
                </div>
            </div>
        `).join('');
    },

    selectSession(customerId) {
        this.activeCustomerId = customerId;
        const session = this.sessions.find(s => s.customer_id === customerId);
        
        document.getElementById('noChatSelected').style.display = 'none';
        document.getElementById('chatView').style.display = 'flex';
        
        document.getElementById('activeName').textContent = session.customer_name;
        document.getElementById('activeContact').textContent = session.customer_email || session.customer_phone || 'No contact info';
        document.getElementById('activeAvatar').textContent = session.customer_name.charAt(0).toUpperCase();

        const orderBadge = document.getElementById('orderBadge');
        if (session.order_number) {
            orderBadge.style.display = 'flex';
            document.getElementById('orderNumber').textContent = session.order_number;
        } else {
            orderBadge.style.display = 'none';
        }
        this.renderActiveOrderContext(session);

        // Clear local messages and map to force a full re-render for the new session
        this.messages = [];
        this.messageMap.clear();
        document.getElementById('messagesContainer').innerHTML = '';
        
        this.loadMessages(customerId, true);
        this.renderSessions(); // Update active state in sidebar
    },

    async loadMessages(customerId, forceScroll = false) {
        if (!customerId) return;
        
        const data = await this._fetch(`/api/v1/admin/chat/${customerId}`);
        if (!data || !data.success) return;

        const newMessages = data.messages;
        let hasNew = false;
        
        newMessages.forEach(msg => {
            if (!this.messageMap.has(msg.id)) {
                this.messageMap.set(msg.id, msg);
                this.messages.push(msg);
                hasNew = true;

                // Notify if it's a new user message and not the first load
                if (msg.sender === 'user' && !forceScroll) {
                    this.playNotification();
                    this.updateTitle(1);
                }
            }
        });

        if (hasNew) {
            this.messages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            this.renderMessages(forceScroll);
        }
    },

    renderMessages(forceScroll) {
        const container = document.getElementById('messagesContainer');
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;

        container.innerHTML = this.messages.map(msg => `
            <div class="message ${msg.sender}" id="msg-${msg.id}">
                ${this.renderMessageCaseMeta(msg)}
                <div>${msg.sender === 'system' ? this.formatSystemMessage(msg.message) : this.escapeHTML(msg.message || '').replace(/\n/g, '<br>')}</div>
                <span class="message-time">${this.formatTime(msg.created_at)}</span>
            </div>
        `).join('');

        if (forceScroll || isNearBottom) {
            container.scrollTop = container.scrollHeight;
        }
    },

    async sendReply(e) {
        e.preventDefault();
        const input = document.getElementById('replyInput');
        const btn = document.getElementById('sendBtn');
        const text = input.value.trim();

        if (!text || !this.activeCustomerId) return;

        input.disabled = true;
        btn.disabled = true;

        try {
            const data = await this._fetch(`/api/v1/admin/chat/${this.activeCustomerId}/reply`, {
                method: 'POST',
                body: JSON.stringify({ message: text })
            });

            if (data && data.success) {
                input.value = '';
                this.loadMessages(this.activeCustomerId, true);
            } else if (data) {
                alert("Failed to send message: " + (data.detail || "Unknown error"));
            }
        } catch (error) {
            console.error("[AdminChat] Send error:", error);
            alert("Network error while sending message.");
        } finally {
            input.disabled = false;
            btn.disabled = false;
            input.focus();
        }
    },

    async closeActiveChat() {
        if (!this.activeCustomerId) return;
        if (!confirm("Are you sure you want to resolve and close this chat session?")) return;

        try {
            const data = await this._fetch(`/api/v1/admin/chat/${this.activeCustomerId}/close`, {
                method: 'POST'
            });
            if (data && data.success) {
                this.activeCustomerId = null;
                document.getElementById('chatView').style.display = 'none';
                document.getElementById('noChatSelected').style.display = 'flex';
                this.loadSessions();
            }
        } catch (error) {
            console.error("[AdminChat] Close error:", error);
        }
    },

    filterSessions() {
        this.renderSessions();
    },

    calculateUnread() {
        const count = this.sessions.reduce((acc, s) => acc + (s.unread_count || 0), 0);
        if (count > 0 && count > this.unreadTotal) {
            this.updateTitle(count - this.unreadTotal);
        }
        this.unreadTotal = count;
    },

    updateTitle(increment) {
        if (increment === 0) {
            document.title = "Admin Chat — GetOTTs";
            return;
        }
        const current = parseInt(document.title.match(/\d+/) || 0);
        const next = current + increment;
        document.title = `(${next}) Admin Chat — GetOTTs`;
    },

    playNotification() {
        const sound = document.getElementById('notifSound');
        if (sound) {
            sound.currentTime = 0;
            sound.play().catch(e => console.warn("[AdminChat] Audio play blocked:", e));
        }
    },

    formatTime(dateStr) {
        const date = new Date(dateStr);
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();
        
        if (isToday) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else {
            return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        }
    },

    showStatusOverlay(show) {
        const overlay = document.getElementById('statusOverlay');
        if (overlay) overlay.style.display = show ? 'block' : 'none';
    },

    renderCaseSummary(session) {
        const active = session.order_number ? `
            <span class="case-chip active-case">Current ${this.escapeHTML(session.order_number)}</span>
        ` : '';
        const oldCases = (session.order_history || [])
            .filter(item => item.order_number && item.order_number !== session.order_number)
            .slice(0, 2)
            .map(item => `<span class="case-chip">${this.escapeHTML(item.order_number)}</span>`)
            .join('');
        const more = (session.order_history || []).length > 3
            ? `<span class="case-chip">+${session.order_history.length - 3} old</span>`
            : '';
        return (active || oldCases || more) ? `<div class="case-row">${active}${oldCases}${more}</div>` : '';
    },

    renderActiveOrderContext(session) {
        const card = document.getElementById('activeOrderContext');
        if (!card) return;
        const order = session.order_details;
        if (!order) {
            card.style.display = 'none';
            card.innerHTML = '';
            return;
        }
        card.style.display = 'grid';
        card.innerHTML = `
            <div><span>Order</span><strong>${this.escapeHTML(order.order_number || session.order_number || '-')}</strong></div>
            <div><span>Product</span><strong>${this.escapeHTML(order.product_name || 'Subscription')}</strong></div>
            <div><span>Amount</span><strong>Rs${Number(order.amount || 0).toFixed(2)}</strong></div>
            <div><span>Payment</span><strong>${this.escapeHTML(order.payment_status || '-')}</strong></div>
            <div><span>Delivery</span><strong>${this.escapeHTML(order.delivery_status || '-')}</strong></div>
            <div><span>Mode</span><strong>${this.escapeHTML(order.delivery_mode || '-')}</strong></div>
        `;
    },

    formatSystemMessage(message) {
        const raw = String(message || '')
            .replace(/ORDER CHAT SESSION OPENED/gi, 'Order support is ready')
            .replace(/[━─]{3,}/g, '')
            .replace(/[^\S\r\n]+/g, ' ')
            .trim();
        const lines = raw.split(/\n+/).map(line => line.trim()).filter(Boolean);
        if (lines.length <= 1) return this.escapeHTML(raw);
        const title = this.escapeHTML(lines.shift());
        const rows = lines.map(line => `<div class="system-row">${this.escapeHTML(line.replace(/^[^\w$#]+/, '').trim())}</div>`).join('');
        return `<strong>${title}</strong>${rows}`;
    },

    renderMessageCaseMeta(msg) {
        if (!msg.order_number && (msg.session_status || 'active') !== 'closed') return '';
        const parts = [];
        if (msg.order_number) parts.push(`Case ${this.escapeHTML(msg.order_number)}`);
        if ((msg.session_status || 'active') === 'closed') parts.push('Closed');
        return `<div class="message-case">${parts.join(' · ')}</div>`;
    },

    escapeHTML(str) {
        return String(str || '').replace(/[&<>'"]/g, tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag));
    }
};

// Start the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => app.init());
