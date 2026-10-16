// Global variables
let currentOrderId = null;
let currentMessageId = null;

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

function logout() {
    document.getElementById('loginSection').style.display = 'flex';
    document.getElementById('dashboardSection').style.display = 'none';
    document.getElementById('adminPassword').value = '';
}

function switchRole(role) {
    document.querySelectorAll('.role-btn').forEach(btn => {
        btn.classList.remove('primary');
        btn.classList.add('secondary');
    });
    document.getElementById('dispatcher-panel').style.display = 'none';
    document.getElementById('delivery-panel').style.display = 'none';
    document.getElementById('admin-panel').style.display = 'none';

    event.currentTarget.classList.remove('secondary');
    event.currentTarget.classList.add('primary');

    if (role === 'dispatcher') {
        document.getElementById('dispatcher-panel').style.display = 'block';
        loadDispatcherOrders();
    } else if (role === 'delivery') {
        document.getElementById('delivery-panel').style.display = 'block';
        loadDeliveryOrders();
    } else if (role === 'admin') {
        document.getElementById('admin-panel').style.display = 'block';
        loadDashboard();
    }
}

async function loadDashboard() {
    await loadOrders();
    await loadMessages();
    await loadStats();
    loadDispatcherOrders();
    loadDeliveryOrders();
    setupRealtimeListeners();
}

function setupRealtimeListeners() {
    db.collection('orders').onSnapshot(() => {
        loadOrders();
        loadStats();
        loadDispatcherOrders();
        loadDeliveryOrders();
    }, (error) => {
        console.error('Order listener error:', error);
    });

    db.collection('messages').onSnapshot(() => {
        loadMessages();
        loadStats();
    }, (error) => {
        console.error('Message listener error:', error);
    });
}

function getPaymentStatusBadge(order) {
    const paymentMethod = order.paymentMethod || 'Cash on Delivery';
    const paymentStatus = order.paymentStatus || (paymentMethod === 'Cash on Delivery' ? 'cod' : 'pending');

    if (paymentMethod === 'Cash on Delivery') {
        return `<span class="payment-badge cod" title="Cash on Delivery">💵 COD</span>`;
    }

    if (paymentMethod === 'M-PESA') {
        if (paymentStatus === 'paid') {
            const receipt = order.mpesaPayment?.receiptNumber || order.mpesaReceipt || '';
            return `<span class="payment-badge paid" title="Receipt: ${receipt}">✅ M-PESA Paid${receipt ? ' (' + receipt + ')' : ''}</span>`;
        } else if (paymentStatus === 'pending' || paymentStatus === 'awaiting_payment') {
            return `<span class="payment-badge pending" title="Awaiting payment">⏳ M-PESA Pending</span>`;
        } else if (paymentStatus === 'failed') {
            return `<span class="payment-badge failed" title="Payment failed">❌ M-PESA Failed</span>`;
        }
    }

    return `<span class="payment-badge cod">💵 ${paymentMethod}</span>`;
}

// Load Dispatcher Orders (Pending & Confirmed verification)
async function loadDispatcherOrders() {
    const list = document.getElementById('dispatcherOrdersList');
    if (!list) return;
    list.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Loading orders for dispatcher...</div>';

    try {
        const snapshot = await db.collection('orders').orderBy('timestamp', 'desc').get();
        if (snapshot.empty) {
            list.innerHTML = '<div class="loading">No orders found</div>';
            return;
        }

        let html = '';
        snapshot.forEach(doc => {
            const order = doc.data();
            if (order.status === 'completed' || order.status === 'cancelled') return;

            html += `
                <div class="order-card">
                    <div class="order-header">
                        <div>
                            <strong>#${doc.id.slice(-6)}</strong>
                            <span class="order-status-badge status-${order.status || 'pending'}">${order.status || 'pending'}</span>
                            ${getPaymentStatusBadge(order)}
                        </div>
                        <span>${order.customerName} (${order.customerPhone})</span>
                    </div>
                    <div><i class="fas fa-tag"></i> ${order.size} x${order.quantity} (KSh ${order.total})</div>
                    <div><i class="fas fa-map-marker-alt"></i> ${order.deliveryAddress}</div>
                    <div style="margin-top: 10px; display: flex; gap: 10px;">
                        ${order.status === 'pending' ? `<button class="btn" style="background:#2fa1c1; padding:5px 10px;" onclick="setOrderStatus('${doc.id}', 'confirmed')">✓ Confirm Order & Payment</button>` : ''}
                        ${order.status === 'confirmed' ? `<button class="btn" style="background:#ffc107; color:#000; padding:5px 10px;" onclick="setOrderStatus('${doc.id}', 'dispatched')">🚀 Dispatch to Rider</button>` : ''}
                        <button class="btn" style="background:#17a2b8; padding:5px 10px;" onclick="showOrderDetails('${doc.id}')">View Details</button>
                    </div>
                </div>
            `;
        });
        list.innerHTML = html || '<div class="loading">No active orders pending dispatch verification.</div>';
    } catch (e) {
        list.innerHTML = `<div class="loading">Error loading dispatcher queue: ${e.message}</div>`;
    }
}

// Load Delivery Guy Orders (Confirmed/Dispatched)
async function loadDeliveryOrders() {
    const list = document.getElementById('deliveryOrdersList');
    if (!list) return;
    list.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Loading delivery route...</div>';

    try {
        const snapshot = await db.collection('orders').orderBy('timestamp', 'desc').get();
        if (snapshot.empty) {
            list.innerHTML = '<div class="loading">No deliveries assigned</div>';
            return;
        }

        let html = '';
        snapshot.forEach(doc => {
            const order = doc.data();
            if (order.status !== 'confirmed' && order.status !== 'dispatched') return;

            html += `
                <div class="order-card" style="border-left-color: #25D366;">
                    <div class="order-header">
                        <div>
                            <strong>#${doc.id.slice(-6)}</strong>
                            <span class="order-status-badge status-${order.status}">${order.status}</span>
                            ${getPaymentStatusBadge(order)}
                        </div>
                        <span><strong>${order.customerName}</strong> - <a href="tel:${order.customerPhone}">${order.customerPhone}</a></span>
                    </div>
                    <div><i class="fas fa-tag"></i> ${order.size} x${order.quantity} | <strong>Total: KSh ${order.total}</strong></div>
                    <div><i class="fas fa-map-marker-alt"></i> <strong>Location:</strong> ${order.deliveryAddress}</div>
                    <div style="margin-top: 10px; display: flex; gap: 10px;">
                        <button class="btn whatsapp" onclick="window.open('https://wa.me/254${order.customerPhone.slice(-9)}?text=Hello%20${order.customerName},%20your%20Cresco%20Water%20delivery%20is%20on%20the%20way%20to%20${encodeURIComponent(order.deliveryAddress)}!')"><i class="fab fa-whatsapp"></i> Call/Chat Customer</button>
                        <button class="btn" style="background:#28a745; padding:8px 15px;" onclick="setOrderStatus('${doc.id}', 'completed')">✓ Confirm Delivery & Cash Collected</button>
                    </div>
                </div>
            `;
        });
        list.innerHTML = html || '<div class="loading">No active orders currently out for delivery.</div>';
    } catch (e) {
        list.innerHTML = `<div class="loading">Error loading delivery queue: ${e.message}</div>`;
    }
}

async function setOrderStatus(orderId, status) {
    try {
        await db.collection('orders').doc(orderId).update({ status: status });
        alert(`✅ Order status updated to '${status}' successfully!`);
        loadDispatcherOrders();
        loadDeliveryOrders();
        loadOrders();
        loadStats();
    } catch (error) {
        alert('Error updating status: ' + error.message);
    }
}

async function loadOrders() {
    const ordersList = document.getElementById('ordersList');
    if (!ordersList) return;
    ordersList.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Loading orders...</div>';

    try {
        const snapshot = await db.collection('orders').orderBy('timestamp', 'desc').get();
        if (snapshot.empty) {
            ordersList.innerHTML = '<div class="loading">No orders found</div>';
            return;
        }

        let html = '';
        snapshot.forEach(doc => {
            const order = doc.data();
            const date = formatDate(order.timestamp);
            const paymentBadge = getPaymentStatusBadge(order);

            html += `
                <div class="order-card" onclick="showOrderDetails('${doc.id}')">
                    <div class="order-header">
                        <div>
                            <strong>#${doc.id.slice(-6)}</strong>
                            <span class="order-status-badge status-${order.status || 'pending'}">${order.status || 'pending'}</span>
                            ${paymentBadge}
                        </div>
                        <span>${date.toLocaleDateString()} ${date.toLocaleTimeString()}</span>
                    </div>
                    <div><i class="fas fa-user"></i> ${order.customerName || 'N/A'}</div>
                    <div><i class="fas fa-phone"></i> ${order.customerPhone || 'N/A'}</div>
                    <div><i class="fas fa-tag"></i> ${order.size || 'N/A'} x${order.quantity || 0}</div>
                    <div><i class="fas fa-money-bill"></i> KSh ${order.total || 0}</div>
                    <div><small><i class="fas fa-map-marker-alt"></i> ${order.deliveryAddress || 'Makutano Shop'}</small></div>
                </div>
            `;
        });
        ordersList.innerHTML = html;
    } catch (error) {
        ordersList.innerHTML = `<div class="loading">Error: ${error.message}</div>`;
    }
}

async function loadMessages() {
    const messagesList = document.getElementById('messagesList');
    if (!messagesList) return;
    messagesList.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Loading messages...</div>';

    try {
        const snapshot = await db.collection('messages').orderBy('timestamp', 'desc').get();
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
                        <span>${date.toLocaleDateString()}</span>
                    </div>
                    <div><i class="fas fa-envelope"></i> ${msg.email || 'N/A'}</div>
                    <div class="message-preview">${(msg.message || '').substring(0, 100)}...</div>
                </div>
            `;
        });
        messagesList.innerHTML = html;
    } catch (error) {
        messagesList.innerHTML = `<div class="loading">Error: ${error.message}</div>`;
    }
}

async function loadStats() {
    try {
        const ordersSnapshot = await db.collection('orders').get();
        const messagesSnapshot = await db.collection('messages').get();

        document.getElementById('totalOrders').textContent = ordersSnapshot.size;
        document.getElementById('pendingOrders').textContent = ordersSnapshot.docs.filter(d => d.data().status === 'pending').length;
        document.getElementById('completedOrders').textContent = ordersSnapshot.docs.filter(d => d.data().status === 'completed').length;
        document.getElementById('unreadMessages').textContent = messagesSnapshot.docs.filter(d => !d.data().read).length;
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

async function showOrderDetails(orderId) {
    currentOrderId = orderId;
    try {
        const doc = await db.collection('orders').doc(orderId).get();
        if (!doc.exists) return;

        const order = doc.data();
        const date = formatDate(order.timestamp);
        const paymentBadge = getPaymentStatusBadge(order);

        document.getElementById('orderDetails').innerHTML = `
            <p><strong>Order ID:</strong> ${orderId}</p>
            <p><strong>Customer:</strong> ${order.customerName}</p>
            <p><strong>Phone:</strong> ${order.customerPhone}</p>
            <p><strong>Product:</strong> ${order.size} x${order.quantity}</p>
            <p><strong>Total:</strong> KSh ${order.total}</p>
            <p><strong>Payment Method:</strong> ${order.paymentMethod} ${paymentBadge}</p>
            <p><strong>Delivery Address/Landmark:</strong> ${order.deliveryAddress}</p>
            <p><strong>Time:</strong> ${date.toLocaleString()}</p>
            <p><strong>Current Status:</strong> <span class="order-status-badge status-${order.status}">${order.status}</span></p>
        `;

        document.getElementById('updateStatus').value = order.status || 'pending';
        document.getElementById('orderModal').style.display = 'block';
    } catch (e) {
        alert('Error: ' + e.message);
    }
}

async function showMessageDetails(messageId) {
    currentMessageId = messageId;
    try {
        const doc = await db.collection('messages').doc(messageId).get();
        if (!doc.exists) return;
        const msg = doc.data();

        document.getElementById('messageDetails').innerHTML = `
            <p><strong>From:</strong> ${msg.name}</p>
            <p><strong>Email:</strong> ${msg.email}</p>
            <p><strong>Message:</strong> ${msg.message}</p>
        `;
        document.getElementById('messageModal').style.display = 'block';
        if (!msg.read) {
            await db.collection('messages').doc(messageId).update({ read: true });
            loadMessages();
        }
    } catch (e) {
        alert('Error: ' + e.message);
    }
}

async function updateOrderStatus() {
    if (!currentOrderId) return;
    const newStatus = document.getElementById('updateStatus').value;
    await setOrderStatus(currentOrderId, newStatus);
    closeModal('orderModal');
}

async function markOrderCompleted() {
    if (!currentOrderId) return;
    await setOrderStatus(currentOrderId, 'completed');
    closeModal('orderModal');
}

function whatsappCustomer() {
    if (!currentOrderId) return;
    db.collection('orders').doc(currentOrderId).get().then(doc => {
        if (!doc.exists) return;
        const order = doc.data();
        const phone = order.customerPhone ? order.customerPhone.replace(/[^0-9]/g, '') : '254758486402';
        window.open(`https://wa.me/254${phone.slice(-9)}?text=Hello%20${order.customerName},%20regarding%20your%20Cresco%20Water%20order...`, '_blank');
    });
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    event.target.classList.add('active');
    document.getElementById(tab + 'Tab').classList.add('active');
    if (tab === 'orders') loadOrders();
    else loadMessages();
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('adminPassword').addEventListener('keypress', e => {
        if (e.key === 'Enter') login();
    });
});
