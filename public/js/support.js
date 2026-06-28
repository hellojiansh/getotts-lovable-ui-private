const SUPPORT_UI = {
    tickets: [],

    apiBase() {
        return (window.GETOTTS_CONFIG && window.GETOTTS_CONFIG.API_BASE) || 'https://api.getotts.com/api/v1';
    },

    init() {
        // Hook into dashboard tab switching
        const originalSwitchTab = window.switchTab;
        if (originalSwitchTab) {
            window.switchTab = (tabId) => {
                originalSwitchTab(tabId);
                if (tabId === 'support') {
                    this.loadTickets();
                }
            };
        }
    },

    async loadTickets() {
        const token = localStorage.getItem('GetOTTs_customer_token');
        if (!token) {
            const container = document.getElementById('ticketsList');
            if (container) container.innerHTML = '<div class="empty-state" style="padding:40px;"><p>Please login to view support tickets.</p></div>';
            return;
        }

        const container = document.getElementById('ticketsList');
        if (!container) return;
        container.innerHTML = '<div class="empty-state"><p>Loading tickets...</p></div>';

        const API_BASE = this.apiBase();

        try {
            const res = await fetch(`${API_BASE}/tickets`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (res.status === 401) {
                container.innerHTML = '<div class="empty-state" style="padding:40px;"><p>Session expired. Please re-login.</p></div>';
                return;
            }
            
            const data = await res.json();
            
            if (data.success) {
                this.tickets = data.tickets || [];
                this.renderTickets();
            } else {
                container.innerHTML = `<div class="empty-state" style="padding:40px;"><i data-lucide="life-buoy"></i><p>No support tickets yet.</p></div>`;
                if (window.lucide) lucide.createIcons();
            }
        } catch (e) {
            console.error('[SUPPORT] loadTickets error:', e);
            container.innerHTML = `<div class="empty-state" style="padding:40px;"><i data-lucide="life-buoy"></i><p>No support tickets yet.</p></div>`;
            if (window.lucide) lucide.createIcons();
        }
    },

    renderTickets() {
        const container = document.getElementById('ticketsList');
        if (!this.tickets || this.tickets.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="padding: 40px;">
                    <i data-lucide="life-buoy"></i>
                    <p>No support tickets found.</p>
                </div>
            `;
            if (window.lucide) lucide.createIcons();
            return;
        }

        const getStatusColor = (status) => {
            if (status === 'open') return 'background: #fee2e2; color: #ef4444;';
            if (status === 'in_progress') return 'background: #fef3c7; color: #f59e0b;';
            return 'background: #dcfce7; color: #10b981;';
        };

        container.innerHTML = `
            <table style="width: 100%; border-collapse: collapse; text-align: left;">
                <thead>
                    <tr style="border-bottom: 1px solid var(--gray-200); color: var(--gray-500); font-size: 0.85rem;">
                        <th style="padding: 16px;">Ticket ID</th>
                        <th style="padding: 16px;">Subject</th>
                        <th style="padding: 16px;">Category</th>
                        <th style="padding: 16px;">Status</th>
                        <th style="padding: 16px;">Action</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.tickets.map(t => `
                        <tr style="border-bottom: 1px solid var(--gray-100);">
                            <td style="padding: 16px; font-family: monospace; color: var(--gray-600);">${t.ticket_number}</td>
                            <td style="padding: 16px; font-weight: 600;">${this.escapeHTML(t.subject)}</td>
                            <td style="padding: 16px; color: var(--gray-500);">${t.category}</td>
                            <td style="padding: 16px;">
                                <span style="padding: 4px 10px; border-radius: 12px; font-size: 0.75rem; font-weight: 700; ${getStatusColor(t.status)}">
                                    ${t.status.toUpperCase().replace('_', ' ')}
                                </span>
                            </td>
                            <td style="padding: 16px;">
                                <button class="btn btn-outline btn-sm" onclick="SUPPORT_UI.openViewModal('${t.id}')">View</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },

    openCreateModal() {
        const overlay = document.getElementById('ticketCreateOverlay');
        const modal = document.getElementById('ticketCreateModal');
        if (overlay && modal) {
            overlay.style.display = 'block';
            modal.style.display = 'block';
            setTimeout(() => {
                overlay.classList.add('active');
                modal.classList.add('active');
            }, 10);
        }
    },

    closeCreateModal() {
        const overlay = document.getElementById('ticketCreateOverlay');
        const modal = document.getElementById('ticketCreateModal');
        if (overlay && modal) {
            overlay.classList.remove('active');
            modal.classList.remove('active');
            setTimeout(() => {
                overlay.style.display = 'none';
                modal.style.display = 'none';
            }, 300);
        }
    },

    async createTicket(e) {
        e.preventDefault();
        const token = localStorage.getItem('GetOTTs_customer_token');
        const btn = e.target.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.innerText = 'Submitting...';

        const payload = {
            category: document.getElementById('ticketCategory').value,
            subject: document.getElementById('ticketSubject').value,
            message: document.getElementById('ticketMessage').value
        };

        try {
            const res = await fetch(`${this.apiBase()}/tickets`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            
            if (data.success) {
                showToast("Success", "Ticket created successfully", "success");
                this.closeCreateModal();
                document.getElementById('ticketCreateForm').reset();
                this.loadTickets();
            } else {
                showToast("Error", data.detail || "Failed to create ticket", "error");
            }
        } catch (err) {
            showToast("Error", "Network error", "error");
        } finally {
            btn.disabled = false;
            btn.innerText = 'Submit Ticket';
        }
    },

    openViewModal(ticketId) {
        const ticket = this.tickets.find(t => t.id === ticketId);
        if (!ticket) return;

        document.getElementById('viewTicketTitle').innerText = `[${ticket.ticket_number}] ${ticket.subject}`;
        document.getElementById('viewTicketStatus').innerText = ticket.status.toUpperCase();
        document.getElementById('replyTicketId').value = ticket.id;

        const msgsHtml = ticket.ticket_messages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)).map(m => `
            <div style="background: ${m.sender === 'user' ? '#1a1a2e' : 'white'}; color: ${m.sender === 'user' ? 'white' : '#1a1a2e'}; padding: 16px; border-radius: 12px; max-width: 85%; align-self: ${m.sender === 'user' ? 'flex-end' : 'flex-start'}; box-shadow: 0 2px 8px rgba(0,0,0,0.05); border: ${m.sender === 'admin' ? '1px solid #eaeaea' : 'none'};">
                <div style="font-size: 0.75rem; opacity: 0.7; margin-bottom: 6px;">${m.sender === 'user' ? 'You' : 'Support Team'}</div>
                <div style="line-height: 1.5;">${this.escapeHTML(m.message).replace(/\n/g, '<br>')}</div>
            </div>
        `).join('');

        document.getElementById('ticketMessagesContainer').innerHTML = msgsHtml;

        const overlay = document.getElementById('ticketViewOverlay');
        const modal = document.getElementById('ticketViewModal');
        if (overlay && modal) {
            overlay.style.display = 'block';
            modal.style.display = 'flex';
            setTimeout(() => {
                overlay.classList.add('active');
                modal.classList.add('active');
            }, 10);
        }
        
        // Scroll to bottom
        setTimeout(() => {
            const container = document.getElementById('ticketMessagesContainer');
            container.scrollTop = container.scrollHeight;
        }, 50);
    },

    closeViewModal() {
        const overlay = document.getElementById('ticketViewOverlay');
        const modal = document.getElementById('ticketViewModal');
        if (overlay && modal) {
            overlay.classList.remove('active');
            modal.classList.remove('active');
            setTimeout(() => {
                overlay.style.display = 'none';
                modal.style.display = 'none';
            }, 300);
        }
    },

    async replyTicket(e) {
        e.preventDefault();
        const token = localStorage.getItem('GetOTTs_customer_token');
        const btn = e.target.querySelector('button[type="submit"]');
        const ticketId = document.getElementById('replyTicketId').value;
        const msgInput = document.getElementById('replyMessage');
        const message = msgInput.value;
        
        btn.disabled = true;

        try {
            const res = await fetch(`${this.apiBase()}/tickets/${ticketId}/reply`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ message })
            });
            const data = await res.json();
            
            if (data.success) {
                msgInput.value = '';
                // Optimistically add message
                const ticket = this.tickets.find(t => t.id === ticketId);
                if (ticket) {
                    ticket.ticket_messages.push(data.message);
                    this.openViewModal(ticketId); // Re-render
                }
            } else {
                showToast("Error", data.detail || "Failed to send reply", "error");
            }
        } catch (err) {
            showToast("Error", "Network error", "error");
        } finally {
            btn.disabled = false;
        }
    },

    escapeHTML(str) {
        return str.replace(/[&<>'"]/g, 
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

// Add showToast fallback just in case Toast isn't available
function showToast(title, msg, type) {
    if (typeof Toast !== 'undefined') {
        if (type === 'success') Toast.success(title, msg);
        else if (type === 'error') Toast.error(title, msg);
        else Toast.info(title, msg);
    } else {
        alert(`${title}: ${msg}`);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    SUPPORT_UI.init();
});
