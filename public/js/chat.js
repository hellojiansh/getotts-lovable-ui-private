class ChatWidget {
    constructor() {
        this.isOpen = false;
        this.messages = [];
        
        // Get token using consistent logic
        this.token = localStorage.getItem('GetOTTs_customer_token');
        if (!this.token) {
            try {
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.includes('-auth-token')) {
                        const session = JSON.parse(localStorage.getItem(key));
                        if (session && session.access_token) {
                            this.token = session.access_token;
                            break;
                        }
                    }
                }
            } catch(e) {}
        }

        this.unreadCount = 0;
        this.localReadIds = this.loadLocalReadIds();
        this.supabase = null;
        this.subscription = null;
        this.pollInterval = null;
        this.pollTimer = null;
        this.pollInFlight = false;
        this.lastHistoryLoadAt = 0;
        this.lastUnreadCheckAt = 0;
        this.chatDataStarted = false;
        this.idleStarter = null;
        this.activeOrderNumber = null;
        this.archiveMode = false;
        this.soundEnabled = localStorage.getItem('getotts_chat_sound') !== 'off';
        
        this.initDOM();
        if (this.token) this.scheduleIdleStartup();
    }

    apiBase() {
        if (window.GETOTTS_CONFIG && window.GETOTTS_CONFIG.API_BASE) {
            return window.GETOTTS_CONFIG.API_BASE;
        }
        const host = window.location.hostname;
        return (host === 'localhost' || host === '127.0.0.1')
            ? 'http://localhost:8000/api/v1'
            : 'https://api.getotts.com/api/v1';
    }

    initDOM() {
        // Create CSS link
        if (!document.getElementById('chatWidgetCSS')) {
            const link = document.createElement('link');
            link.id = 'chatWidgetCSS';
            link.rel = 'stylesheet';
            link.href = '/css/chat.css?v=20260518-chatui14';
            document.head.appendChild(link);
        }

        // Create HTML structure
        const container = document.createElement('div');
        container.id = 'chatWidgetContainer';
        container.innerHTML = `
            <div class="chat-panel" id="chatPanel" style="opacity:0;pointer-events:none;transform:translateY(20px);">
                <div class="chat-header">
                    <div class="chat-header-info">
                        <div class="chat-avatar"><img src="/assets/images/logo-upgraded-20260603-small.webp" alt="GetOTTs"></div>
                        <div class="chat-title">
                            <h3>GetOTTs Support</h3>
                            <div class="chat-status"><div class="status-dot"></div> Online</div>
                        </div>
                    </div>
                    <div class="chat-header-actions">
                        ${this.token ? `
                        <button class="chat-menu-btn" id="chatMenuBtn" type="button" title="Chat options" aria-label="Chat options">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1A2 2 0 1 1 7.1 4l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 .9-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1A2 2 0 1 1 19.9 7l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5.9h.1a2 2 0 1 1 0 4H21a1.7 1.7 0 0 0-1.6 1z"/></svg>
                        </button>
                        ` : ''}
                        <button class="chat-close" id="chatCloseBtn" title="Minimize chat">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/></svg>
                        </button>
                    </div>
                    ${this.token ? this.renderMenuMarkup() : ''}
                </div>
                
                <!-- Order context banner (hidden by default) -->
                <div class="chat-order-banner" id="chatOrderBanner" style="display:none;">
                    <div style="display:flex; align-items:center; justify-content:space-between;">
                        <div>
                            <span class="chat-order-label">Order chat</span>
                            <span class="chat-order-num" id="chatOrderNum"></span>
                        </div>
                    </div>
                </div>

                ${this.token ? `
                <div class="chat-messages" id="chatMessages">
                    <!-- Messages go here -->
                </div>
                <form class="chat-input-area" id="chatForm">
                    <input type="text" id="chatInput" placeholder="Type a message..." required autocomplete="off">
                    <button type="submit" class="chat-send-btn">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                    </button>
                </form>
                ` : `
                <div class="chat-login-prompt">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:16px;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    <h3>Need Help?</h3>
                    <p style="margin-top:8px;">Sign in to chat directly with our support team.</p>
                    <a href="/login" class="chat-login-btn">Sign In to Chat</a>
                </div>
                `}
            </div>
            
            <button class="chat-toggle-btn" id="chatToggleBtn">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" id="chatIconOpen"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" id="chatIconClose" style="display:none;"><path d="M18 6L6 18M6 6l12 12"/></svg>
                <div class="chat-badge" id="chatBadge">0</div>
            </button>
        `;
        document.body.appendChild(container);

        // Event Listeners
        document.getElementById('chatToggleBtn').addEventListener('click', () => this.toggle());
        document.getElementById('chatCloseBtn').addEventListener('click', () => this.toggle(false));
        
        if (this.token) {
            document.getElementById('chatMenuBtn')?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleMenu();
            });
            document.getElementById('chatNewBtn')?.addEventListener('click', () => {
                this.closeMenu();
                this.startNewChat();
            });
            document.getElementById('chatHistoryBtn')?.addEventListener('click', () => {
                this.closeMenu();
                this.toggleHistory();
            });
            document.getElementById('chatDownloadBtn')?.addEventListener('click', () => {
                this.closeMenu();
                this.downloadTranscript();
            });
            document.getElementById('chatSoundBtn')?.addEventListener('click', () => {
                this.soundEnabled = !this.soundEnabled;
                localStorage.setItem('getotts_chat_sound', this.soundEnabled ? 'on' : 'off');
                this.updateSoundButton();
            });
            document.addEventListener('click', (e) => {
                if (!container.contains(e.target)) this.closeMenu();
            });
            document.getElementById('chatForm').addEventListener('submit', (e) => {
                e.preventDefault();
                this.sendMessage();
            });
            // Persist composer draft across page navigations / panel close
            const inputEl = document.getElementById('chatInput');
            if (inputEl) {
                try { inputEl.value = localStorage.getItem('getotts_chat_draft') || ''; } catch {}
                inputEl.addEventListener('input', () => {
                    try { localStorage.setItem('getotts_chat_draft', inputEl.value || ''); } catch {}
                });
            }
            // Escape closes the panel when open
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.isOpen) {
                    this.toggle(false);
                    document.getElementById('chatToggleBtn')?.focus();
                }
            });
        }
    }

    renderMenuMarkup() {
        const customer = this.getCustomerProfile();
        const name = this.escapeHTML(customer.name || 'GetOTTs customer');
        const email = this.escapeHTML(customer.email || customer.phone || 'Logged in');
        return `
            <div class="chat-menu" id="chatMenu">
                <div class="chat-menu-profile">
                    <span class="chat-menu-icon">
                        <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/></svg>
                    </span>
                    <div>
                        <strong>${name}</strong>
                        <span>${email}</span>
                    </div>
                </div>
                <button type="button" class="chat-menu-item" id="chatNewBtn">
                    <span class="chat-menu-icon"><svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg></span>
                    <span><strong>Start new chat</strong><small> Clear the active thread</small></span>
                </button>
                <button type="button" class="chat-menu-item" id="chatHistoryBtn">
                    <span class="chat-menu-icon"><svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v6h6"/><path d="M12 7v5l3 2"/></svg></span>
                    <span><strong>Closed chats</strong><small> View old support chats</small></span>
                </button>
                <button type="button" class="chat-menu-item" id="chatDownloadBtn">
                    <span class="chat-menu-icon"><svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg></span>
                    <span><strong>Download transcript</strong><small> Save this chat text</small></span>
                </button>
                <button type="button" class="chat-menu-item" id="chatSoundBtn">
                    <span class="chat-menu-icon"><svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/></svg></span>
                    <span><strong>Notifications</strong><small id="chatSoundState"> Sound on</small></span>
                </button>
            </div>
        `;
    }

    getCustomerProfile() {
        try {
            return JSON.parse(localStorage.getItem('GetOTTs_customer') || '{}') || {};
        } catch (e) {
            return {};
        }
    }

    toggleMenu(forceState) {
        const menu = document.getElementById('chatMenu');
        const btn = document.getElementById('chatMenuBtn');
        if (!menu) return;
        const open = forceState !== undefined ? forceState : !menu.classList.contains('open');
        menu.classList.toggle('open', open);
        btn?.classList.toggle('active', open);
        if (open) this.updateSoundButton();
    }

    closeMenu() {
        this.toggleMenu(false);
    }

    updateSoundButton() {
        const state = document.getElementById('chatSoundState');
        if (state) state.textContent = this.soundEnabled ? ' Sound on' : ' Sound off';
    }

    toggle(forceState) {
        this.isOpen = forceState !== undefined ? forceState : !this.isOpen;
        const panel = document.getElementById('chatPanel');
        const iconOpen = document.getElementById('chatIconOpen');
        const iconClose = document.getElementById('chatIconClose');
        
        if (this.isOpen) {
            panel.classList.add('open');
            panel.removeAttribute('style');
            iconOpen.style.display = 'none';
            iconClose.style.display = 'block';
            this.unreadCount = 0;
            this.markVisibleAdminMessagesRead();
            this.updateBadge();
            if (this.token) {
                this.startChatData(true);
                setTimeout(() => document.getElementById('chatInput').focus(), 100);
                this.scrollToBottom();
            }
        } else {
            this.closeMenu();
            panel.classList.remove('open');
            panel.style.opacity = '0';
            panel.style.pointerEvents = 'none';
            panel.style.transform = 'translateY(20px)';
            iconOpen.style.display = 'block';
            iconClose.style.display = 'none';
        }
        this.reschedulePolling();
    }

    scheduleIdleStartup() {
        if (this.idleStarter) return;
        const start = () => this.startChatData(false);
        if ('requestIdleCallback' in window) {
            this.idleStarter = requestIdleCallback(start, { timeout: 12000 });
        } else {
            this.idleStarter = setTimeout(start, 12000);
        }
    }

    startChatData(immediate = false) {
        if (!this.token) return;
        if (this.chatDataStarted) {
            if (immediate) this.loadHistory();
            return;
        }
        this.chatDataStarted = true;
        if (immediate) {
            this.loadHistory();
            this.setupRealtime();
            return;
        }
        setTimeout(() => {
            this.loadUnreadCount();
            this.setupRealtime();
        }, 0);
    }

    getLocalReadKey() {
        const customer = JSON.parse(localStorage.getItem('GetOTTs_customer') || '{}');
        return `getotts_chat_read_${customer.id || customer.email || customer.phone || this.token || 'guest'}`;
    }

    loadLocalReadIds() {
        try {
            return new Set(JSON.parse(localStorage.getItem(this.getLocalReadKey()) || '[]'));
        } catch (e) {
            return new Set();
        }
    }

    saveLocalReadIds() {
        try {
            localStorage.setItem(this.getLocalReadKey(), JSON.stringify(Array.from(this.localReadIds).slice(-300)));
        } catch (e) {}
    }

    getMessageKey(msg) {
        return msg.id || `${msg.sender || 'unknown'}-${msg.created_at || ''}-${msg.message || ''}`;
    }

    isAdminMessage(msg) {
        return msg && (msg.sender === 'admin' || msg.sender === 'system');
    }

    isUnreadAdminMessage(msg) {
        return this.isAdminMessage(msg) && msg.is_read === false && !this.localReadIds.has(this.getMessageKey(msg));
    }

    markVisibleAdminMessagesRead() {
        let changed = false;
        this.messages.forEach(msg => {
            if (this.isAdminMessage(msg)) {
                this.localReadIds.add(this.getMessageKey(msg));
                msg.is_read = true;
                changed = true;
            }
        });
        if (changed) this.saveLocalReadIds();
        this.unreadCount = 0;
    }

    /**
     * Open the chat widget for a specific order.
     * Creates an order-linked chat session and opens the panel.
     */
    async openForOrder(orderNumber, initialMessage) {
        if (!this.token) {
            window.location.href = `/login?redirect=${encodeURIComponent(window.location.href)}`;
            return;
        }

        this.activeOrderNumber = orderNumber;
        this.archiveMode = false;
        this.updateModeUI();
        sessionStorage.setItem('getotts_chat_order', orderNumber);

        // Show order context banner
        const banner = document.getElementById('chatOrderBanner');
        const orderNum = document.getElementById('chatOrderNum');
        if (banner && orderNum) {
            orderNum.textContent = orderNumber;
            banner.style.display = 'block';
        }

        // Create/resume order session on backend
        const API_BASE = this.apiBase();
        try {
            const res = await fetch(`${API_BASE}/chat/order-session`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + this.token
                },
                body: JSON.stringify({
                    order_number: orderNumber,
                    initial_message: initialMessage || `Hi, I need help with my order ${orderNumber}`
                })
            });
            const data = await res.json();
            if (data.success) {
                // Reload history to show the new session
                await this.loadHistory();
            }
        } catch (e) {
            console.error('[CHAT] Failed to create order session:', e);
        }

        // Open the chat panel
        this.toggle(true);
    }

    clearOrderContext() {
        this.activeOrderNumber = null;
        this.archiveMode = false;
        this.updateModeUI();
        sessionStorage.removeItem('getotts_chat_order');
        const banner = document.getElementById('chatOrderBanner');
        if (banner) banner.style.display = 'none';
        this.messages = [];
        this.renderMessages();
        this.loadHistory();
        const input = document.getElementById('chatInput');
        if (input) input.placeholder = 'Type a message...';
    }

    async startNewChat() {
        if (!this.token) {
            this.toggle(true);
            return;
        }
        const closingOrder = this.activeOrderNumber;
        this.archiveMode = false;
        this.updateModeUI();
        try {
            const API_BASE = this.apiBase();
            await fetch(`${API_BASE}/chat/close`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + this.token
                },
                body: JSON.stringify({ order_number: closingOrder || null })
            });
        } catch (e) {
            console.warn('[CHAT] Could not close previous chat cleanly:', e);
        }
        this.activeOrderNumber = null;
        sessionStorage.removeItem('getotts_chat_order');
        this.messages = [];
        this.renderMessages();
        const banner = document.getElementById('chatOrderBanner');
        if (banner) banner.style.display = 'none';
        const input = document.getElementById('chatInput');
        if (input) {
            input.placeholder = 'Start a new support chat...';
            input.focus();
        }
        this.toggle(true);
    }

    async toggleHistory() {
        if (!this.token) return;
        this.archiveMode = !this.archiveMode;
        if (this.archiveMode) {
            this.activeOrderNumber = null;
            sessionStorage.removeItem('getotts_chat_order');
            const banner = document.getElementById('chatOrderBanner');
            if (banner) banner.style.display = 'none';
        }
        this.messages = [];
        this.updateModeUI();
        await this.loadHistory();
        this.toggle(true);
    }

    updateModeUI() {
        const historyBtn = document.getElementById('chatHistoryBtn');
        const form = document.getElementById('chatForm');
        const input = document.getElementById('chatInput');
        if (historyBtn) {
            historyBtn.title = this.archiveMode ? 'Return to active chat' : 'View closed chats';
            historyBtn.classList.toggle('active', this.archiveMode);
            const label = historyBtn.querySelector('strong');
            const small = historyBtn.querySelector('small');
            if (label) label.textContent = this.archiveMode ? 'Active chat' : 'Closed chats';
            if (small) small.textContent = this.archiveMode ? ' Back to current chat' : ' View old support chats';
        }
        if (form) form.style.display = this.archiveMode ? 'none' : 'flex';
        if (input && !this.archiveMode) {
            input.placeholder = this.activeOrderNumber ? 'Message admin about this order...' : 'Type a message...';
        }
    }

    async loadHistory() {
        if (!this.chatDataStarted) return;
        if (this.pollInFlight) return;
        this.pollInFlight = true;
        this.lastHistoryLoadAt = Date.now();
        const API_BASE = this.apiBase();
        try {
            const params = new URLSearchParams();
            if (this.archiveMode) {
                params.set('include_closed', 'true');
                params.set('closed_only', 'true');
                params.set('all_contexts', 'true');
            } else if (this.activeOrderNumber) {
                params.set('order_number', this.activeOrderNumber);
            }
            const qs = params.toString() ? `?${params.toString()}` : '';
            const res = await fetch(`${API_BASE}/chat/history${qs}`, {
                headers: { 'Authorization': 'Bearer ' + this.token }
            });
            const data = await res.json();
            if (data.success) {
                this.mergeMessages(data.messages);
            }
        } catch (e) {
            console.error('Failed to load chat history', e);
        } finally {
            this.pollInFlight = false;
        }
    }

    async loadUnreadCount() {
        if (!this.token || this.isOpen || this.archiveMode) return;
        if (this.pollInFlight) return;
        this.pollInFlight = true;
        this.lastUnreadCheckAt = Date.now();
        const API_BASE = this.apiBase();
        try {
            const res = await fetch(`${API_BASE}/chat/unread-count`, {
                headers: { 'Authorization': 'Bearer ' + this.token }
            });
            const data = await res.json();
            if (data.success) {
                const nextCount = Number(data.unread_count || 0);
                if (nextCount > this.unreadCount) this.playSound();
                this.unreadCount = nextCount;
                this.updateBadge();
            }
        } catch (e) {
            console.warn('Failed to load chat unread count', e);
        } finally {
            this.pollInFlight = false;
        }
    }

    /**
     * Safely merges new messages into the existing state, preventing duplicates.
     */
    mergeMessages(newMsgs) {
        if (!newMsgs || !newMsgs.length) {
            this.renderMessages();
            return;
        }

        if (!this.archiveMode) {
            const currentContextClosed = newMsgs.some(m => {
                const isClosed = (m.session_status || 'active') === 'closed';
                const sameOrder = this.activeOrderNumber && m.order_number === this.activeOrderNumber;
                const sameGeneral = !this.activeOrderNumber && !m.order_number;
                return isClosed && (sameOrder || sameGeneral);
            });
            if (currentContextClosed) {
                this.messages = [];
                this.activeOrderNumber = null;
                sessionStorage.removeItem('getotts_chat_order');
                const banner = document.getElementById('chatOrderBanner');
                if (banner) banner.style.display = 'none';
                this.updateModeUI();
            }
            newMsgs = newMsgs.filter(m => (m.session_status || 'active') === 'active');
            if (!newMsgs.length) {
                this.renderMessages();
                return;
            }
        }
        
        const oldLen = this.messages.length;
        const msgMap = new Map(this.messages.map(m => [m.id || `local-${m.message}-${m.created_at}`, m]));
        
        let changed = false;
        newMsgs.forEach(m => {
            const key = m.id || `local-${m.message}-${m.created_at}`;
            if (!msgMap.has(key)) {
                msgMap.set(key, m);
                changed = true;
            } else {
                // Update existing message (e.g. if status changed)
                const existing = msgMap.get(key);
                if (JSON.stringify(existing) !== JSON.stringify(m)) {
                    msgMap.set(key, m);
                    changed = true;
                }
            }
        });

        if (changed) {
            this.messages = Array.from(msgMap.values()).sort((a, b) => {
                return new Date(a.created_at || 0) - new Date(b.created_at || 0);
            });
            this.renderMessages();
            if (this.isOpen) {
                this.markVisibleAdminMessagesRead();
                this.updateBadge();
            }
            
            // Handle unread notifications for new admin messages
            if (!this.isOpen && this.messages.length > oldLen) {
                const added = this.messages.slice(oldLen);
                const adminMsgs = added.filter(m => this.isUnreadAdminMessage(m));
                if (adminMsgs.length > 0) {
                    this.unreadCount += adminMsgs.length;
                    this.updateBadge();
                    this.playSound();
                }
            }
        }
    }

    renderMessages() {
        const container = document.getElementById('chatMessages');
        if (!container) return;
        
        container.innerHTML = this.messages.map(msg => {
            const meta = [];
            if (this.archiveMode && msg.order_number) meta.push(`Order ${this.escapeHTML(msg.order_number)}`);
            if (this.archiveMode && (msg.session_status || 'active') === 'closed') meta.push('Closed');
            const metaHtml = meta.length ? `<div class="chat-meta">${meta.join(' · ')}</div>` : '';
            const timeHtml = msg.created_at ? `<div class="chat-time">${this.formatChatTime(msg.created_at)}</div>` : '';
            if (msg.sender === 'system') {
                const bubbleHtml = `${metaHtml}${this.formatSystemMessage(msg.message)}`;
                return `<div class="chat-row bot">
                    <div class="chat-avatar"></div>
                    <div class="chat-stack">
                        <div class="chat-bubble">${bubbleHtml}</div>
                        ${timeHtml}
                    </div>
                </div>`;
            }
            const isUser = msg.sender === 'user';
            const bubbleHtml = `${metaHtml}${this.escapeHTML(msg.message)}`;
            return `<div class="chat-row ${isUser ? 'user' : 'bot'}">
                ${isUser ? '' : '<div class="chat-avatar"></div>'}
                <div class="chat-stack">
                    <div class="chat-bubble">${bubbleHtml}</div>
                    ${timeHtml}
                </div>
            </div>`;
        }).join('');
        if (!this.messages.length) {
            container.innerHTML = `
                <div class="chat-empty">
                    <strong>${this.archiveMode ? 'No closed chats yet' : (this.activeOrderNumber ? 'Order support is ready' : 'How can we help?')}</strong>
                    <span>${this.archiveMode ? 'When an admin closes a chat, it will stay here for reference.' : (this.activeOrderNumber ? 'Send details about this order. Admin will see the order context.' : 'Start a fresh support chat. Admin will reply here.')}</span>
                </div>
            `;
        }
        this.scrollToBottom();
    }

    async sendMessage() {
        const input = document.getElementById('chatInput');
        const text = input.value.trim();
        if (this.archiveMode) return;
        if (!text) return;
        input.value = '';
        try { localStorage.removeItem('getotts_chat_draft'); } catch {}

        // Optimistic UI
        const tempMsg = { 
            sender: 'user', 
            message: text, 
            created_at: new Date().toISOString(),
            id: 'temp-' + Date.now() 
        };
        this.mergeMessages([tempMsg]);

        try {
            const API_BASE = this.apiBase();
            let endpoint = `${API_BASE}/chat/message`;
            if (this.activeOrderNumber) {
                endpoint = `${API_BASE}/chat/order-message?order_number=${encodeURIComponent(this.activeOrderNumber)}`;
            }

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + this.token
                },
                body: JSON.stringify({ message: text })
            });
            const data = await res.json();
            
            if (data.success) {
                // Replace temp message with real one from server
                this.messages = this.messages.filter(m => m.id !== tempMsg.id);
                this.mergeMessages([data.message]);
            } else {
                this.messages = this.messages.filter(m => m.id !== tempMsg.id);
                this.renderMessages();
                this.showSendError(data.detail || 'Message could not be sent. Please refresh and try again.');
            }
        } catch (e) {
            console.error('Failed to send message', e);
            this.messages = this.messages.filter(m => m.id !== tempMsg.id);
            this.renderMessages();
            this.showSendError('Message could not be sent. Please check your connection and try again.');
        }
    }

    showSendError(message) {
        const container = document.getElementById('chatMessages');
        if (!container) return;
        const el = document.createElement('div');
        el.className = 'chat-row bot';
        el.innerHTML = '<div class="chat-avatar"></div><div class="chat-stack"><div class="chat-bubble"></div></div>';
        el.querySelector('.chat-bubble').textContent = message;
        el.querySelector('.chat-bubble').style.cssText = 'background:#3b1721;color:#fecdd3;border:1px solid rgba(254,205,211,.22);';
        container.appendChild(el);
        this.scrollToBottom();
    }

    formatSystemMessage(message) {
        const raw = String(message || '')
            .replace(/ORDER CHAT SESSION OPENED/gi, 'Order support is ready')
            .replace(/[━─]{3,}/g, '')
            .replace(/[^\S\r\n]+/g, ' ')
            .trim();
        const lines = raw.split(/\n+/).map(line => line.trim()).filter(Boolean);
        if (lines.length <= 1) return this.escapeHTML(raw);
        const title = this.escapeHTML(lines.shift());
        const rows = lines.map(line => {
            const clean = line.replace(/^[^\w$#]+/, '').trim();
            return `<div class="chat-system-row">${this.escapeHTML(clean)}</div>`;
        }).join('');
        return `<strong>${title}</strong>${rows}`;
    }

    setupRealtime() {
        this.startPolling();
    }

    startPolling() {
        this.stopPolling();
        this.reschedulePolling();
        if (!this._visibilityListenerBound) {
            this._visibilityListenerBound = true;
            document.addEventListener('visibilitychange', () => this.reschedulePolling());
        }
    }

    stopPolling() {
        if (this.pollInterval) clearInterval(this.pollInterval);
        if (this.pollTimer) clearTimeout(this.pollTimer);
        this.pollInterval = null;
        this.pollTimer = null;
    }

    getPollDelay() {
        if (document.hidden) return 90000;
        if (this.archiveMode) return 60000;
        if (this.isOpen) return 1200;
        return 30000;
    }

    reschedulePolling() {
        if (!this.token) return;
        if (this.pollTimer) clearTimeout(this.pollTimer);
        const delay = this.getPollDelay();
        this.pollTimer = setTimeout(async () => {
            const minGap = this.isOpen ? 1000 : 28000;
            const lastLoad = this.isOpen ? this.lastHistoryLoadAt : this.lastUnreadCheckAt;
            if (Date.now() - lastLoad >= minGap) {
                if (!this.isOpen && !this.archiveMode) {
                    await this.loadUnreadCount();
                } else {
                await this.loadHistory();
                }
            }
            this.reschedulePolling();
        }, delay);
    }

    updateBadge() {
        const badge = document.getElementById('chatBadge');
        const toggle = document.getElementById('chatToggleBtn');
        badge.innerText = this.unreadCount;
        if (this.unreadCount > 0) {
            badge.classList.add('visible');
            if (toggle) toggle.classList.add('has-unread');
        } else {
            badge.classList.remove('visible');
            if (toggle) toggle.classList.remove('has-unread');
        }
    }

    playSound() {
        if (!this.soundEnabled) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = 740;
            gain.gain.value = 0.035;
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.08);
            osc.onended = () => ctx.close();
        } catch (e) {}
    }

    scrollToBottom() {
        const container = document.getElementById('chatMessages');
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    }

    formatChatTime(value) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        return date.toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    }

    downloadTranscript() {
        if (!this.messages.length) {
            this.showSendError('There is no chat transcript yet.');
            return;
        }
        const lines = this.messages.map(msg => {
            const sender = msg.sender === 'user' ? 'You' : (msg.sender === 'system' ? 'System' : 'Support');
            const time = this.formatChatTime(msg.created_at || new Date().toISOString());
            return `[${time}] ${sender}: ${String(msg.message || '').replace(/\s+/g, ' ').trim()}`;
        });
        const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `getotts-chat-${new Date().toISOString().slice(0, 10)}.txt`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    escapeHTML(str) {
        return String(str || '').replace(/[&<>'"]/g, 
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag] || tag)
        );
    }
}

// Initialize when DOM is ready
const initLiveChat = () => {
    if (!window.LiveChat) {
        window.LiveChat = new ChatWidget();
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLiveChat);
} else {
    initLiveChat();
}

