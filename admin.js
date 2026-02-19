// Global variables
let currentOrderId = null;
let currentMessageId = null;

// Helper function to safely format date
function formatDate(timestamp) {
    try {
        if (timestamp && typeof timestamp.toDate === 'function') {
            return timestamp.toDate();
        } else if (timestamp && typeof timestamp === 'string') {
            return new Date(timestamp);
        } else if (timestamp && typeof timestamp === 'number') {
            return new Date(timestamp);
        } else {
            return new Date();
        }
    } catch (error) {
        console.error('Date parsing error:', error);
        return new Date();
    }
}

// Login function
function login() {
    const password = document.getElementById('adminPassword').value;

    if (password === 'cresco2024') {
        document.getElementById('loginSection').style.display = 'none';
        document.getElementById('dashboardSection').style.display = 'block';
        loadDashboard();
    } else {
        document.getElementById('loginError').textContent = 'Invalid password';
    }
}

// Logout function
function logout() {
    document.getElementById('loginSection').style.display = 'flex';
    document.getElementById('dashboardSection').style.display = 'none';
    document.getElementById('adminPassword').value = '';
}

// Load dashboard data
async function loadDashboard() {
    console.log('Loading dashboard...');
    await loadOrders();
    await loadMessages();
    await loadStats();

    // Set up real-time listeners
    setupRealtimeListeners();
}

function setupRealtimeListeners() {
    console.log('Setting up real-time listeners...');

    // Listen for order changes
    db.collection('orders').onSnapshot((snapshot) => {
        console.log('Orders updated, total:', snapshot.size);
        loadOrders();
        loadStats();
    }, (error) => {
        console.error('Order listener error:', error);
    });

    // Listen for message changes
    db.collection('messages').onSnapshot((snapshot) => {
        console.log('Messages updated, total:', snapshot.size);
        loadMessages();
        loadStats();
    }, (error) => {
        console.error('Message listener error:', error);
    });
}

// Load orders
async function loadOrders() {
    const ordersList = document.getElementById('ordersList');
    ordersList.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Loading orders...</div>';

    try {
        console.log('Fetching orders from Firebase...');

        const snapshot = await db.collection('orders')
            .orderBy('timestamp', 'desc')
            .get();

        console.log('Orders found:', snapshot.size);

        if (snapshot.empty) {
            ordersList.innerHTML = '<div class="loading">No orders found</div>';
            return;
        }

        let html = '';
        snapshot.forEach(doc => {
            const order = doc.data();
            const date = formatDate(order.timestamp);

            html += `
                <div class="order-card" onclick="showOrderDetails('${doc.id}')">
                    <div class="order-header">
                        <div>
                            <strong>#${doc.id.slice(-6)}</strong>
                            <span class="order-status-badge status-${order.status || 'pending'}">${order.status || 'pending'}</span>
                        </div>
                        <span>${date.toLocaleDateString()} ${date.toLocaleTimeString()}</span>
                    </div>
                    <div><i class="fas fa-user"></i> ${order.customerName || 'N/A'}</div>
                    <div><i class="fas fa-phone"></i> ${order.customerPhone || 'N/A'}</div>
                    <div><i class="fas fa-tag"></i> ${order.size || 'N/A'} x${order.quantity || 0}</div>
                    <div><i class="fas fa-money-bill"></i> KSh ${order.total || 0}</div>
                    <div><small><i class="fas fa-map-marker-alt"></i> ${order.shopLocation || 'Makutano Shop'}</small></div>
                </div>
            `;
        });

        ordersList.innerHTML = html;

    } catch (error) {
        console.error('Error loading orders:', error);
        ordersList.innerHTML = `<div class="loading">
            Error: ${error.message}<br>
            <button onclick="loadOrders()" class="btn" style="margin-top:10px;">Retry</button>
        </div>`;
    }
}

// Load messages
async function loadMessages() {
    const messagesList = document.getElementById('messagesList');
    messagesList.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Loading messages...</div>';

    try {
        console.log('Fetching messages from Firebase...');

        const snapshot = await db.collection('messages')
            .orderBy('timestamp', 'desc')
            .get();

        console.log('Messages found:', snapshot.size);

        if (snapshot.empty) {
            messagesList.innerHTML = '<div class="loading">No messages found</div>';
            return;
        }

        let html = '';
        snapshot.forEach(doc => {
            const msg = doc.data();
            const date = formatDate(msg.timestamp);
            const readStatus = msg.read ? 'read' : 'unread';

            html += `
                <div class="message-card ${readStatus}" onclick="showMessageDetails('${doc.id}')">
                    <div class="message-header">
                        <div>
                            <strong>${msg.name || 'N/A'}</strong>
                            <span class="message-status status-${readStatus}">${readStatus}</span>
                        </div>
                        <span>${date.toLocaleDateString()} ${date.toLocaleTimeString()}</span>
                    </div>
                    <div><i class="fas fa-envelope"></i> ${msg.email || 'N/A'}</div>
                    <div><i class="fas fa-map-marker-alt"></i> ${msg.location || 'Makutano, Meru'}</div>
                    <div class="message-preview">${(msg.message || '').substring(0, 100)}${msg.message && msg.message.length > 100 ? '...' : ''}</div>
                </div>
            `;
        });

        messagesList.innerHTML = html;

    } catch (error) {
        console.error('Error loading messages:', error);
        messagesList.innerHTML = `<div class="loading">Error: ${error.message}<br><button onclick="loadMessages()" class="btn" style="margin-top:10px;">Retry</button></div>`;
    }
}

// Load statistics
async function loadStats() {
    try {
        const ordersSnapshot = await db.collection('orders').get();
        const messagesSnapshot = await db.collection('messages').get();

        const totalOrders = ordersSnapshot.size;
        const pendingOrders = ordersSnapshot.docs.filter(d => d.data().status === 'pending').length;
        const completedOrders = ordersSnapshot.docs.filter(d => d.data().status === 'completed').length;
        const unreadMessages = messagesSnapshot.docs.filter(d => !d.data().read).length;

        document.getElementById('totalOrders').textContent = totalOrders;
        document.getElementById('pendingOrders').textContent = pendingOrders;
        document.getElementById('completedOrders').textContent = completedOrders;
        document.getElementById('unreadMessages').textContent = unreadMessages;

    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Show order details
async function showOrderDetails(orderId) {
    currentOrderId = orderId;

    try {
        const doc = await db.collection('orders').doc(orderId).get();

        if (!doc.exists) {
            alert('Order not found');
            return;
        }

        const order = doc.data();
        const date = formatDate(order.timestamp);

        document.getElementById('orderDetails').innerHTML = `
            <p><strong>Order ID:</strong> ${orderId}</p>
            <p><strong>Customer:</strong> ${order.customerName || 'N/A'}</p>
            <p><strong>Phone:</strong> ${order.customerPhone || 'N/A'}</p>
            <p><strong>Email:</strong> ${order.customerEmail || 'N/A'}</p>
            <p><strong>Product:</strong> ${order.size || 'N/A'}</p>
            <p><strong>Quantity:</strong> ${order.quantity || 0}</p>
            <p><strong>Type:</strong> ${order.orderType || 'N/A'}</p>
            <p><strong>Unit Price:</strong> KSh ${order.unitPrice || 0}</p>
            <p><strong>Total:</strong> KSh ${order.total || 0}</p>
            <p><strong>Payment:</strong> ${order.paymentMethod || 'N/A'}</p>
            <p><strong>Address:</strong> ${order.deliveryAddress || 'N/A'}</p>
            <p><strong>Delivery Time:</strong> ${order.deliveryTime || 'Anytime'}</p>
            <p><strong>Special Requests:</strong> ${order.specialRequests || 'None'}</p>
            <p><strong>Shop Location:</strong> ${order.shopLocation || 'Makutano, Meru (Next to Kinoru Dispensary)'}</p>
            <p><strong>Date:</strong> ${date.toLocaleString()}</p>
            <p><strong>Status:</strong> <span class="order-status-badge status-${order.status || 'pending'}">${order.status || 'pending'}</span></p>
        `;

        document.getElementById('updateStatus').value = order.status || 'pending';
        document.getElementById('orderModal').style.display = 'block';

    } catch (error) {
        console.error('Error loading order:', error);
        alert('Error loading order details: ' + error.message);
    }
}

// Show message details
async function showMessageDetails(messageId) {
    currentMessageId = messageId;

    try {
        const doc = await db.collection('messages').doc(messageId).get();

        if (!doc.exists) {
            alert('Message not found');
            return;
        }

        const msg = doc.data();
        const date = formatDate(msg.timestamp);

        document.getElementById('messageDetails').innerHTML = `
            <p><strong>From:</strong> ${msg.name || 'N/A'}</p>
            <p><strong>Email:</strong> ${msg.email || 'N/A'}</p>
            <p><strong>Location:</strong> ${msg.location || 'Makutano, Meru'}</p>
            <p><strong>Date:</strong> ${date.toLocaleString()}</p>
            <p><strong>Status:</strong> ${msg.read ? 'Read' : 'Unread'}</p>
            <p><strong>Message:</strong></p>
            <div style="background:#f8f9fa; padding:1rem; border-radius:10px; margin:1rem 0;">
                ${msg.message || 'No message content'}
            </div>
        `;

        document.getElementById('messageModal').style.display = 'block';

        // Auto mark as read if unread
        if (!msg.read) {
            try {
                await db.collection('messages').doc(messageId).update({ read: true });
                loadMessages();
            } catch (error) {
                console.error('Error marking message as read:', error);
            }
        }

    } catch (error) {
        console.error('Error loading message:', error);
        alert('Error loading message details: ' + error.message);
    }
}

// Update order status
async function updateOrderStatus() {
    if (!currentOrderId) return;

    const newStatus = document.getElementById('updateStatus').value;

    try {
        await db.collection('orders').doc(currentOrderId).update({ status: newStatus });
        alert('✅ Order status updated');
        closeModal('orderModal');
        loadOrders();

    } catch (error) {
        console.error('Error updating status:', error);
        alert('Error updating status: ' + error.message);
    }
}

// Mark order as completed
async function markOrderCompleted() {
    if (!currentOrderId) return;

    try {
        await db.collection('orders').doc(currentOrderId).update({ status: 'completed' });
        alert('✅ Order marked as completed');
        closeModal('orderModal');
        loadOrders();

    } catch (error) {
        console.error('Error updating status:', error);
        alert('Error updating status: ' + error.message);
    }
}

// WhatsApp customer
async function whatsappCustomer() {
    if (!currentOrderId) return;

    try {
        const doc = await db.collection('orders').doc(currentOrderId).get();

        if (!doc.exists) return;

        const order = doc.data();
        const phone = order.customerPhone ? order.customerPhone.replace(/[^0-9]/g, '') : '254758486402';
        const message = `Hello ${order.customerName || 'Customer'}, your order #${currentOrderId.slice(-6)} is ${order.status || 'pending'}. Pickup from our Makutano shop (Next to Kinoru Dispensary). Thank you for choosing Cresco Water!`;

        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');

    } catch (error) {
        console.error('Error:', error);
        alert('Error opening WhatsApp');
    }
}

// Mark message as read
async function markMessageRead() {
    if (!currentMessageId) return;

    try {
        await db.collection('messages').doc(currentMessageId).update({ read: true });
        alert('✅ Message marked as read');
        loadMessages();

    } catch (error) {
        console.error('Error updating message:', error);
        alert('Error updating message: ' + error.message);
    }
}

// Mark message as unread
async function markMessageUnread() {
    if (!currentMessageId) return;

    try {
        await db.collection('messages').doc(currentMessageId).update({ read: false });
        alert('✅ Message marked as unread');
        loadMessages();

    } catch (error) {
        console.error('Error updating message:', error);
        alert('Error updating message: ' + error.message);
    }
}

// Reply via WhatsApp
async function replyWhatsApp() {
    if (!currentMessageId) return;

    try {
        const doc = await db.collection('messages').doc(currentMessageId).get();

        if (!doc.exists) return;

        const msg = doc.data();
        const replyMessage = document.getElementById('replyMessage').value.trim() ||
            `Hello ${msg.name || 'there'}, thank you for contacting Cresco Water (Makutano Shop). How can we help you?`;

        window.open(`https://wa.me/254758486402?text=${encodeURIComponent(replyMessage)}`, '_blank');

    } catch (error) {
        console.error('Error:', error);
        alert('Error opening WhatsApp');
    }
}

// Reply via Email
async function replyEmail() {
    alert('Email functionality coming soon. Please use WhatsApp for replies.');
}

// Send custom reply
async function sendReply() {
    alert('Email functionality coming soon. Please use WhatsApp for replies.');
}

// Filter orders
async function filterOrders() {
    const status = document.getElementById('orderStatusFilter').value;
    const search = document.getElementById('orderSearch').value.toLowerCase();

    try {
        let query = db.collection('orders').orderBy('timestamp', 'desc');

        if (status !== 'all') {
            query = query.where('status', '==', status);
        }

        const snapshot = await query.get();

        if (snapshot.empty) {
            document.getElementById('ordersList').innerHTML = '<div class="loading">No orders found</div>';
            return;
        }

        let html = '';
        snapshot.forEach(doc => {
            const order = doc.data();

            // Apply search filter
            if (search && !(order.customerName || '').toLowerCase().includes(search) &&
                !(order.customerPhone || '').includes(search)) {
                return;
            }

            const date = formatDate(order.timestamp);

            html += `
                <div class="order-card" onclick="showOrderDetails('${doc.id}')">
                    <div class="order-header">
                        <div>
                            <strong>#${doc.id.slice(-6)}</strong>
                            <span class="order-status-badge status-${order.status || 'pending'}">${order.status || 'pending'}</span>
                        </div>
                        <span>${date.toLocaleDateString()}</span>
                    </div>
                    <div>${order.customerName || 'N/A'}</div>
                    <div>${order.customerPhone || 'N/A'}</div>
                    <div>${order.size || 'N/A'} x${order.quantity || 0}</div>
                    <div>KSh ${order.total || 0}</div>
                </div>
            `;
        });

        document.getElementById('ordersList').innerHTML = html || '<div class="loading">No orders found</div>';

    } catch (error) {
        console.error('Error filtering orders:', error);
    }
}

// Filter messages
async function filterMessages() {
    const filter = document.getElementById('messageFilter').value;

    try {
        const snapshot = await db.collection('messages')
            .orderBy('timestamp', 'desc')
            .get();

        let html = '';
        snapshot.forEach(doc => {
            const msg = doc.data();
            const date = formatDate(msg.timestamp);

            if (filter === 'unread' && msg.read) return;
            if (filter === 'read' && !msg.read) return;

            const readStatus = msg.read ? 'read' : 'unread';

            html += `
                <div class="message-card ${readStatus}" onclick="showMessageDetails('${doc.id}')">
                    <div class="message-header">
                        <div>
                            <strong>${msg.name || 'N/A'}</strong>
                            <span class="message-status status-${readStatus}">${readStatus}</span>
                        </div>
                        <span>${date.toLocaleDateString()}</span>
                    </div>
                    <div>${msg.email || 'N/A'}</div>
                    <div class="message-preview">${(msg.message || '').substring(0, 100)}...</div>
                </div>
            `;
        });

        document.getElementById('messagesList').innerHTML = html || '<div class="loading">No messages found</div>';

    } catch (error) {
        console.error('Error filtering messages:', error);
    }
}

// Switch tabs
function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    event.target.classList.add('active');
    document.getElementById(tab + 'Tab').classList.add('active');

    // Reload data when switching tabs
    if (tab === 'orders') {
        loadOrders();
    } else {
        loadMessages();
    }
}

// Close modal
function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Initialize
document.addEventListener('DOMContentLoaded', function () {
    console.log('Admin page loaded - Makutano, Meru shop');

    // Enter key for login
    document.getElementById('adminPassword').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') login();
    });
});
