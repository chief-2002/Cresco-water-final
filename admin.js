// ============================================================
// Cresco Water - Admin / Staff Portal script
// Roles: admin (master), assistant (junior staff), dispatcher, delivery
// ============================================================

// ---------------- ROLE & RIDER CONFIG ----------------
// ⚠️ Change these passwords before going live!
const ROLE_PASSWORDS = {
    admin: 'cresco2024',
    assistant: 'assist2024',
    dispatcher: 'dispatch2024',
    delivery: 'rider2024'
};

// Delivery team riders (edit names to match your real team)
const RIDERS = ['John Mwenda', 'Peter Kirwa', 'Mary Wanja', 'Dennis Otieno'];

let currentRole = null;
let currentOrderId = null;
let currentMessageId = null;
let listenersSetup = false;

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

// ---------------- AUTH & ROLE SWITCHING ----------------
function login() {
    const role = document.getElementById('adminRole').value;
    const password = document.getElementById('adminPassword').value;

    if (ROLE_PASSWORDS[role] && password === ROLE_PASSWORDS[role]) {
        sessionStorage.setItem('crescoStaffRole', role);
        showDashboardForRole(role);
    } else {
        document.getElementById('loginError').textContent = 'Invalid role / password combination';
    }
}

function logout() {
    sessionStorage.removeItem('crescoStaffRole');
    currentRole = null;
    document.getElementById('loginSection').style.display = 'flex';
    document.getElementById('dashboardSection').style.display = 'none';
    document.getElementById('adminPassword').value = '';
    document.getElementById('loginError').textContent = '';
}

function showDashboardForRole(role) {
    currentRole = role;
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('dashboardSection').style.display = 'block';

    const panelIds = ['dispatcher-panel', 'delivery-panel', 'assistant-panel', 'admin-panel'];
    panelIds.forEach(id => { document.getElementById(id).style.display = 'none'; });

    const switcher = document.querySelector('.role-selector');

    if (role === 'admin') {
        // Admin sees the role switcher and all panels
        switcher.style.display = 'flex';
        switchRole('admin');
    } else {
        // Junior staff see only their own panel
        switcher.style.display = 'none';
        if (role === 'dispatcher') {
            document.getElementById('dispatcher-panel').style.display = 'block';
            loadDispatcherOrders();
        } else if (role === 'delivery') {
            document.getElementById('delivery-panel').style.display = 'block';
            loadDeliveryOrders();
        } else if (role === 'assistant') {
            document.getElementById('assistant-panel').style.display = 'block';
            loadAssistantOrders();
            loadAssistantMessages();
        }
    }

    setupRealtimeListeners();
}

function switchRole(role) {
    const panelMap = {
        dispatcher: 'dispatcher-panel',
        delivery: 'delivery-panel',
        assistant: 'assistant-panel',
        admin: 'admin-panel'
    };

    document.querySelectorAll('.role-btn').forEach(btn => {
        const btnRole = btn.getAttribute('data-role');
        btn.classList.toggle('primary', btnRole === role);
        btn.classList.toggle('secondary', btnRole !== role);
    });

    Object.values(panelMap).forEach(id => { document.getElementById(id).style.display = 'none'; });
    document.getElementById(panelMap[role]).style.display = 'block';

    if (role === 'dispatcher') loadDispatcherOrders();
    else if (role === 'delivery') loadDeliveryOrders();
    else if (role === 'assistant') { loadAssistantOrders(); loadAssistantMessages(); }
    else if (role === 'admin') { loadOrders(); loadMessages(); loadStats(); }
}

function setupRealtimeListeners() {
    if (listenersSetup) return;
    listenersSetup = true;

    db.collection('orders').onSnapshot(() => {
        refreshOrderViews();
    }, (error) => {
        console.error('Order listener error:', error);
    });

    db.collection('messages').onSnapshot(() => {
        loadMessages();
        loadAssistantMessages();
        loadStats();
    }, (error) => {
        console.error('Message listener error:', error);
    });
}

function refreshOrderViews() {
    loadOrders();
    loadStats();
    loadDispatcherOrders();
    loadDeliveryOrders();
    loadAssistantOrders();
}

// ---------------- SHARED UI HELPERS ----------------
function getPaymentStatusBadge(order) {
    const paymentMethod = order.paymentMethod || 'Cash on Delivery';
    const paymentStatus = order.paymentStatus;

    // Cash on Delivery
    if (paymentMethod === 'Cash on Delivery') {
        if (paymentStatus === 'collected') {
            return `<span class="payment-badge paid" title="Cash collected on delivery">💰 Cash Collected</span>`;
        }
        return `<span class="payment-badge cod" title="Cash on Delivery">💵 COD</span>`;
    }

    // M-PESA
    if (paymentMethod === 'M-PESA') {
        const receipt = order.mpesaPayment?.receiptNumber || order.mpesaReceipt || '';
        if (paymentStatus === 'verified') {
            return `<span class="payment-badge paid" title="Verified by dispatcher">✔ M-PESA Verified${receipt ? ' (' + receipt + ')' : ''}</span>`;
        }
        if (paymentStatus === 'paid') {
            return `<span class="payment-badge paid" title="Receipt: ${receipt}">✅ M-PESA Paid${receipt ? ' (' + receipt + ')' : ''}</span>`;
        }
        if (paymentStatus === 'awaiting_payment' || paymentStatus === 'pending') {
            return `<span class="payment-badge pending" title="Awaiting customer payment">⏳ M-PESA Pending</span>`;
        }
        if (paymentStatus === 'failed') {
            return `<span class="payment-badge failed" title="Payment failed">❌ M-PESA Failed</span>`;
        }
    }

    // Bank Card
    if (paymentMethod === 'Bank Card') {
        const last4 = order.cardPayment?.last4 || '';
        if (paymentStatus === 'paid' || paymentStatus === 'verified') {
            return `<span class="payment-badge paid" title="Card payment approved">💳 Card Paid${last4 ? ' (···· ' + last4 + ')' : ''}</span>`;
        }
        if (paymentStatus === 'awaiting_card_payment') {
            return `<span class="payment-badge pending" title="Card payment processing">⏳ Card Processing</span>`;
        }
        if (paymentStatus === 'card_failed') {
            return `<span class="payment-badge failed" title="Card payment declined">❌ Card Declined</span>`;
        }
    }

    return `<span class="payment-badge cod">💵 ${paymentMethod}</span>`;
}

function buildStepperHtml(status) {
    const steps = [
        { label: 'Placed', icon: 'fa-clipboard-list' },
        { label: 'Confirmed', icon: 'fa-check-circle' },
        { label: 'Dispatched', icon: 'fa-shipping-fast' },
        { label: 'Delivered', icon: 'fa-box-open' }
    ];

    let currentIndex = 0;
    if (status === 'confirmed') currentIndex = 1;
    else if (status === 'dispatched') currentIndex = 2;
    else if (status === 'completed') currentIndex = 3;

    let html = '<div class="stepper">';
    steps.forEach((step, i) => {
        let cls = '';
        let icon = `<i class="fas ${step.icon}"></i>`;
        if (status === 'cancelled' && i === 0) {
            cls = 'cancelled';
            icon = '<i class="fas fa-times"></i>';
        } else if (i < currentIndex || (i === currentIndex && status === 'completed')) {
            cls = 'done';
            icon = '<i class="fas fa-check"></i>';
        } else if (i === currentIndex) {
            cls = 'active';
        }
        html += `<div class="step ${cls}"><span class="step-dot">${icon}</span><small>${step.label}</small></div>`;
    });
    html += '</div>';
    return html;
}

// ============================================================
// DISPATCHER WORKFLOW
// pending: verify payment -> confirmed
// confirmed: assign rider -> dispatched
// ============================================================
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
            const status = order.status || 'pending';
            if (status === 'completed' || status === 'cancelled') return;

            const method = order.paymentMethod || 'Cash on Delivery';
            const paymentStatus = order.paymentStatus;
            let actionButtons = '';

            if (status === 'pending') {
                if (method === 'Cash on Delivery') {
                    actionButtons = `
                        <button class="btn action-btn confirm" onclick="confirmCodOrder('${doc.id}')"><i class="fas fa-check"></i> Confirm Order (COD)</button>
                    `;
                } else if (paymentStatus === 'paid') {
                    actionButtons = `
                        <button class="btn action-btn verify" onclick="verifyPaymentAndConfirm('${doc.id}')"><i class="fas fa-shield-alt"></i> Verify ${method === 'M-PESA' ? 'M-PESA' : 'Card'} Payment & Confirm</button>
                    `;
                } else {
                    actionButtons = `
                        <span class="payment-badge pending"><i class="fas fa-hourglass-half"></i> Waiting for customer payment (${method})</span>
                    `;
                }
            } else if (status === 'confirmed') {
                const riderOptions = RIDERS.map(r => `<option value="${r}">${r}</option>`).join('');
                actionButtons = `
                    <select class="rider-select" id="rider-${doc.id}">
                        <option value="" disabled selected>Assign rider...</option>
                        ${riderOptions}
                    </select>
                    <button class="btn action-btn dispatch" onclick="dispatchOrder('${doc.id}')"><i class="fas fa-motorcycle"></i> Dispatch</button>
                `;
            } else if (status === 'dispatched') {
                actionButtons = `
                    <span class="payment-badge paid"><i class="fas fa-motorcycle"></i> Out for delivery with ${order.assignedRider || 'rider'}</span>
                `;
            }

            html += `
                <div class="order-card">
                    <div class="order-header">
                        <div>
                            <strong>#${doc.id.slice(-6)}</strong>
                            <span class="order-status-badge status-${status}">${status}</span>
                            ${getPaymentStatusBadge(order)}
                        </div>
                        <span>${order.customerName} (${order.customerPhone})</span>
                    </div>
                    <div><i class="fas fa-tag"></i> ${order.size} x${order.quantity} (KSh ${order.total}) — ${method}</div>
                    <div><i class="fas fa-map-marker-alt"></i> ${order.deliveryAddress}${order.addressDetails && order.addressDetails !== 'None' ? ' — ' + order.addressDetails : ''}</div>
                    <div class="order-actions">
                        ${actionButtons}
                        <button class="btn action-btn view" onclick="showOrderDetails('${doc.id}')">View Details</button>
                    </div>
                </div>
            `;
        });
        list.innerHTML = html || '<div class="loading">No active orders pending dispatch verification.</div>';
    } catch (e) {
        list.innerHTML = `<div class="loading">Error loading dispatcher queue: ${e.message}</div>`;
    }
}

// Dispatcher confirms a Cash on Delivery order
async function confirmCodOrder(orderId) {
    try {
        await db.collection('orders').doc(orderId).update({
            status: 'confirmed',
            confirmedBy: currentRole || 'dispatcher',
            confirmedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        alert(`✅ COD order confirmed! Now assign a rider and dispatch.`);
        refreshOrderViews();
    } catch (error) {
        alert('Error confirming order: ' + error.message);
    }
}

// Dispatcher verifies M-PESA / card payment then confirms
async function verifyPaymentAndConfirm(orderId) {
    try {
        const doc = await db.collection('orders').doc(orderId).get();
        const order = doc.data() || {};
        const method = order.paymentMethod || 'M-PESA';
        const receipt = order.mpesaPayment?.receiptNumber || order.mpesaReceipt || order.cardPayment?.transactionId || '';
        const ok = confirm(`Verify ${method} payment of KSh ${order.total}${receipt ? ' (Ref: ' + receipt + ')' : ''} for ${order.customerName}?`);
        if (!ok) return;

        await db.collection('orders').doc(orderId).update({
            paymentStatus: 'verified',
            status: 'confirmed',
            confirmedBy: currentRole || 'dispatcher',
            confirmedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        alert(`✅ Payment verified & order confirmed! Now assign a rider and dispatch.`);
        refreshOrderViews();
    } catch (error) {
        alert('Error verifying payment: ' + error.message);
    }
}

// Dispatcher assigns rider and dispatches
async function dispatchOrder(orderId) {
    const riderSelect = document.getElementById('rider-' + orderId);
    const rider = riderSelect ? riderSelect.value : '';
    if (!rider) {
        alert('Please select a rider first');
        return;
    }
    try {
        await db.collection('orders').doc(orderId).update({
            status: 'dispatched',
            assignedRider: rider,
            dispatchedBy: currentRole || 'dispatcher',
            dispatchedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        alert(`🚀 Order dispatched to ${rider}!`);
        refreshOrderViews();
    } catch (error) {
        alert('Error dispatching order: ' + error.message);
    }
}

// ============================================================
// DELIVERY GUY WORKFLOW
// dispatched -> delivered (cash collected for COD)
// ============================================================
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
            const status = order.status;
            if (status !== 'confirmed' && status !== 'dispatched') return;

            const method = order.paymentMethod || 'Cash on Delivery';
            const isCod = method === 'Cash on Delivery';

            let actionButtons = '';
            if (status === 'confirmed') {
                actionButtons = `<span class="payment-badge pending"><i class="fas fa-hourglass-half"></i> Awaiting dispatcher to assign & dispatch</span>`;
            } else {
                if (isCod) {
                    actionButtons = `
                        <button class="btn action-btn deliver-cod" onclick="completeDelivery('${doc.id}', true)"><i class="fas fa-money-bill-wave"></i> ✓ Delivered — Cash Collected (KSh ${order.total})</button>
                    `;
                } else {
                    actionButtons = `
                        <button class="btn action-btn deliver" onclick="completeDelivery('${doc.id}', false)"><i class="fas fa-check"></i> ✓ Mark as Delivered (Prepaid)</button>
                    `;
                }
            }

            html += `
                <div class="order-card" style="border-left-color: #25D366;">
                    <div class="order-header">
                        <div>
                            <strong>#${doc.id.slice(-6)}</strong>
                            <span class="order-status-badge status-${status}">${status}</span>
                            ${getPaymentStatusBadge(order)}
                            ${order.assignedRider ? `<span class="payment-badge cod"><i class="fas fa-motorcycle"></i> ${order.assignedRider}</span>` : ''}
                        </div>
                        <span><strong>${order.customerName}</strong> - <a href="tel:${order.customerPhone}">${order.customerPhone}</a></span>
                    </div>
                    <div><i class="fas fa-tag"></i> ${order.size} x${order.quantity} | <strong>Total: KSh ${order.total}</strong> (${method})</div>
                    <div><i class="fas fa-map-marker-alt"></i> <strong>${order.deliveryAddress}</strong>${order.addressDetails && order.addressDetails !== 'None' ? ' — ' + order.addressDetails : ''}</div>
                    ${order.deliveryTime && order.deliveryTime !== 'Anytime' ? `<div><i class="fas fa-clock"></i> Preferred time: ${order.deliveryTime}</div>` : ''}
                    <div class="order-actions">
                        <button class="btn whatsapp action-btn" onclick="window.open('https://wa.me/254${String(order.customerPhone).replace(/\D/g, '').slice(-9)}?text=Hello%20${encodeURIComponent(order.customerName)},%20your%20Cresco%20Water%20delivery%20is%20on%20the%20way%20to%20${encodeURIComponent(order.deliveryAddress)}!')"><i class="fab fa-whatsapp"></i> Customer</button>
                        ${actionButtons}
                    </div>
                </div>
            `;
        });
        list.innerHTML = html || '<div class="loading">No active orders currently out for delivery.</div>';
    } catch (e) {
        list.innerHTML = `<div class="loading">Error loading delivery queue: ${e.message}</div>`;
    }
}

// Delivery guy confirms drop-off; cashCollected=true for COD orders
async function completeDelivery(orderId, cashCollected) {
    try {
        const updateData = {
            status: 'completed',
            deliveredBy: currentRole || 'delivery',
            deliveredAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        if (cashCollected) {
            updateData.paymentStatus = 'collected';
        }
        await db.collection('orders').doc(orderId).update(updateData);
        alert(cashCollected ? '✅ Delivery recorded & cash collected!' : '✅ Delivery recorded!');
        refreshOrderViews();
    } catch (error) {
        alert('Error completing delivery: ' + error.message);
    }
}

// ============================================================
// GENERIC ORDER / MESSAGE RENDERING (used by admin + assistant)
// ============================================================
async function renderOrdersInto(listId, statusFilter, searchTerm) {
    const list = document.getElementById(listId);
    if (!list) return;
    list.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Loading orders...</div>';

    try {
        const snapshot = await db.collection('orders').orderBy('timestamp', 'desc').get();
        if (snapshot.empty) {
            list.innerHTML = '<div class="loading">No orders found</div>';
            return;
        }

        let html = '';
        snapshot.forEach(doc => {
            const order = doc.data();
            const status = order.status || 'pending';
            const date = formatDate(order.timestamp);

            if (statusFilter && statusFilter !== 'all' && status !== statusFilter) return;
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                const name = (order.customerName || '').toLowerCase();
                const phone = (order.customerPhone || '').toLowerCase();
                if (!name.includes(term) && !phone.includes(term)) return;
            }

            html += `
                <div class="order-card" onclick="showOrderDetails('${doc.id}')">
                    <div class="order-header">
                        <div>
                            <strong>#${doc.id.slice(-6)}</strong>
                            <span class="order-status-badge status-${status}">${status}</span>
                            ${getPaymentStatusBadge(order)}
                            ${order.assignedRider ? `<span class="payment-badge cod"><i class="fas fa-motorcycle"></i> ${order.assignedRider}</span>` : ''}
                        </div>
                        <span>${date.toLocaleDateString()} ${date.toLocaleTimeString()}</span>
                    </div>
                    <div><i class="fas fa-user"></i> ${order.customerName || 'N/A'}</div>
                    <div><i class="fas fa-phone"></i> ${order.customerPhone || 'N/A'}</div>
                    <div><i class="fas fa-tag"></i> ${order.size || 'N/A'} x${order.quantity || 0}</div>
                    <div><i class="fas fa-money-bill"></i> KSh ${order.total || 0} (${order.paymentMethod || 'COD'})</div>
                    <div><small><i class="fas fa-map-marker-alt"></i> ${order.deliveryAddress || 'Makutano Shop'}</small></div>
                </div>
            `;
        });
        list.innerHTML = html || '<div class="loading">No orders match this filter.</div>';
    } catch (error) {
        list.innerHTML = `<div class="loading">Error: ${error.message}</div>`;
    }
}

async function renderMessagesInto(listId, msgFilter) {
    const list = document.getElementById(listId);
    if (!list) return;
    list.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Loading messages...</div>';

    try {
        const snapshot = await db.collection('messages').orderBy('timestamp', 'desc').get();
        if (snapshot.empty) {
            list.innerHTML = '<div class="loading">No messages found</div>';
            return;
        }

        let html = '';
        snapshot.forEach(doc => {
            const msg = doc.data();
            const readStatus = msg.read ? 'read' : 'unread';

            if (msgFilter === 'unread' && msg.read) return;
            if (msgFilter === 'read' && !msg.read) return;

            const date = formatDate(msg.timestamp);
            html += `
                <div class="message-card ${readStatus}" onclick="showMessageDetails('${doc.id}')">
                    <div class="message-header">
                        <div>
                            <strong>${msg.name || 'N/A'}</strong>
                            <span class="message-status status-${readStatus}">${readStatus}</span>
                            ${msg.replied ? '<span class="message-status status-read"><i class="fas fa-reply"></i> replied</span>' : ''}
                        </div>
                        <span>${date.toLocaleDateString()}</span>
                    </div>
                    <div><i class="fas fa-envelope"></i> ${msg.email || 'N/A'}</div>
                    <div class="message-preview">${(msg.message || '').substring(0, 100)}...</div>
                </div>
            `;
        });
        list.innerHTML = html || '<div class="loading">No messages match this filter.</div>';
    } catch (error) {
        list.innerHTML = `<div class="loading">Error: ${error.message}</div>`;
    }
}

// ---------------- ADMIN (MASTER) LOADERS ----------------
async function loadOrders() {
    const filter = document.getElementById('orderStatusFilter')?.value || 'all';
    const search = document.getElementById('orderSearch')?.value || '';
    await renderOrdersInto('ordersList', filter, search.trim());
}

function filterOrders() {
    loadOrders();
}

async function loadMessages() {
    const filter = document.getElementById('messageFilter')?.value || 'all';
    await renderMessagesInto('messagesList', filter);
}

function filterMessages() {
    loadMessages();
}

// ---------------- ASSISTANT LOADERS ----------------
async function loadAssistantOrders() {
    const filter = document.getElementById('assistantOrderStatusFilter')?.value || 'all';
    const search = document.getElementById('assistantOrderSearch')?.value || '';
    await renderOrdersInto('assistantOrdersList', filter, search.trim());
}

async function loadAssistantMessages() {
    const filter = document.getElementById('assistantMessageFilter')?.value || 'all';
    await renderMessagesInto('assistantMessagesList', filter);
}

function switchAssistantTab(tab, btn) {
    document.querySelectorAll('#assistant-panel .tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('#assistant-panel .tab-content').forEach(c => c.classList.remove('active'));
    if (btn) btn.classList.add('active');
    document.getElementById('assistant' + tab.charAt(0).toUpperCase() + tab.slice(1) + 'Tab').classList.add('active');
    if (tab === 'orders') loadAssistantOrders();
    else loadAssistantMessages();
}

// ---------------- STATS ----------------
async function loadStats() {
    try {
        const ordersSnapshot = await db.collection('orders').get();
        const messagesSnapshot = await db.collection('messages').get();

        const totalEl = document.getElementById('totalOrders');
        if (totalEl) {
            totalEl.textContent = ordersSnapshot.size;
            document.getElementById('pendingOrders').textContent = ordersSnapshot.docs.filter(d => d.data().status === 'pending').length;
            document.getElementById('completedOrders').textContent = ordersSnapshot.docs.filter(d => d.data().status === 'completed').length;
            document.getElementById('unreadMessages').textContent = messagesSnapshot.docs.filter(d => !d.data().read).length;
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// ---------------- ORDER DETAILS MODAL ----------------
async function showOrderDetails(orderId) {
    currentOrderId = orderId;
    try {
        const doc = await db.collection('orders').doc(orderId).get();
        if (!doc.exists) return;

        const order = doc.data();
        const date = formatDate(order.timestamp);
        const paymentBadge = getPaymentStatusBadge(order);
        const status = order.status || 'pending';

        document.getElementById('orderDetails').innerHTML = `
            ${buildStepperHtml(status)}
            <p><strong>Order ID:</strong> ${orderId}</p>
            <p><strong>Customer:</strong> ${order.customerName}</p>
            <p><strong>Phone:</strong> ${order.customerPhone}</p>
            <p><strong>Product:</strong> ${order.size} x${order.quantity}</p>
            <p><strong>Total:</strong> KSh ${order.total}</p>
            <p><strong>Payment Method:</strong> ${order.paymentMethod} ${paymentBadge}</p>
            ${order.mpesaPayment?.receiptNumber ? `<p><strong>M-PESA Receipt:</strong> ${order.mpesaPayment.receiptNumber}</p>` : ''}
            ${order.cardPayment?.transactionId ? `<p><strong>Card Transaction:</strong> ${order.cardPayment.transactionId}</p>` : ''}
            <p><strong>Delivery Location:</strong> ${order.deliveryAddress}</p>
            ${order.addressDetails && order.addressDetails !== 'None' ? `<p><strong>Directions:</strong> ${order.addressDetails}</p>` : ''}
            <p><strong>Delivery Time:</strong> ${order.deliveryTime || 'Anytime'}</p>
            <p><strong>Special Requests:</strong> ${order.specialRequests || 'None'}</p>
            <p><strong>Placed:</strong> ${date.toLocaleString()}</p>
            ${order.assignedRider ? `<p><strong>Rider:</strong> ${order.assignedRider}</p>` : ''}
            ${order.confirmedBy ? `<p><strong>Confirmed by:</strong> ${order.confirmedBy}</p>` : ''}
            ${order.deliveredBy ? `<p><strong>Delivered by:</strong> ${order.deliveredBy}</p>` : ''}
            ${order.customerConfirmedDelivery ? `<p style="color:#155724;"><strong><i class="fas fa-user-check"></i> Customer confirmed receipt</strong></p>` : ''}
            <p><strong>Current Status:</strong> <span class="order-status-badge status-${status}">${status}</span></p>
        `;

        document.getElementById('updateStatus').value = status;
        document.getElementById('orderModal').style.display = 'block';
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

async function setOrderStatus(orderId, status) {
    try {
        await db.collection('orders').doc(orderId).update({ status: status });
        alert(`✅ Order status updated to '${status}' successfully!`);
        refreshOrderViews();
    } catch (error) {
        alert('Error updating status: ' + error.message);
    }
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

// ---------------- MESSAGE MODAL ----------------
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
            ${msg.reply ? `<p style="background:#f0f9ff; padding:10px; border-radius:8px;"><strong>Our reply:</strong> ${msg.reply}<br><small>by ${msg.repliedBy || 'staff'}</small></p>` : ''}
        `;
        document.getElementById('messageModal').style.display = 'block';
        if (!msg.read) {
            await db.collection('messages').doc(messageId).update({ read: true });
            loadMessages();
            loadAssistantMessages();
        }
    } catch (e) {
        alert('Error: ' + e.message);
    }
}

async function markMessageRead() {
    if (!currentMessageId) return;
    try {
        await db.collection('messages').doc(currentMessageId).update({ read: true });
        loadMessages();
        loadAssistantMessages();
        closeModal('messageModal');
    } catch (e) {
        alert('Error: ' + e.message);
    }
}

async function markMessageUnread() {
    if (!currentMessageId) return;
    try {
        await db.collection('messages').doc(currentMessageId).update({ read: false });
        loadMessages();
        loadAssistantMessages();
        closeModal('messageModal');
    } catch (e) {
        alert('Error: ' + e.message);
    }
}

function replyWhatsApp() {
    if (!currentMessageId) return;
    db.collection('messages').doc(currentMessageId).get().then(doc => {
        if (!doc.exists) return;
        const msg = doc.data();
        const text = encodeURIComponent(`Hello ${msg.name}, regarding your message to Cresco Water: "${(msg.message || '').substring(0, 80)}..."`);
        window.open(`https://wa.me/254758486402?text=${text}`, '_blank');
    });
}

function replyEmail() {
    if (!currentMessageId) return;
    db.collection('messages').doc(currentMessageId).get().then(doc => {
        if (!doc.exists) return;
        const msg = doc.data();
        window.location.href = `mailto:${msg.email}?subject=${encodeURIComponent('Cresco Water - Response to your inquiry')}&body=${encodeURIComponent('Hello ' + msg.name + ',\n\nThank you for contacting Cresco Water.\n\n')}`;
    });
}

async function sendReply() {
    const text = document.getElementById('replyMessage').value.trim();
    if (!currentMessageId || !text) {
        alert('Please type a reply first');
        return;
    }
    try {
        await db.collection('messages').doc(currentMessageId).update({
            reply: text,
            replied: true,
            repliedBy: currentRole || 'staff',
            repliedAt: firebase.firestore.FieldValue.serverTimestamp(),
            read: true
        });
        document.getElementById('replyMessage').value = '';
        alert('✅ Reply saved!');
        loadMessages();
        loadAssistantMessages();
        closeModal('messageModal');
    } catch (e) {
        alert('Error saving reply: ' + e.message);
    }
}

// ---------------- MISC ----------------
function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function switchTab(tab) {
    document.querySelectorAll('#admin-panel .tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('#admin-panel .tab-content').forEach(content => content.classList.remove('active'));
    if (event && event.target) event.target.classList.add('active');
    document.getElementById(tab + 'Tab').classList.add('active');
    if (tab === 'orders') loadOrders();
    else loadMessages();
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('adminPassword').addEventListener('keypress', e => {
        if (e.key === 'Enter') login();
    });

    // Keep staff logged in across refreshes (per browser tab)
    const savedRole = sessionStorage.getItem('crescoStaffRole');
    if (savedRole && ROLE_PASSWORDS[savedRole]) {
        showDashboardForRole(savedRole);
    }
});
