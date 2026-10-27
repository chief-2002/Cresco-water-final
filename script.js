// ============================================================
// Cresco Water - Frontend script
// ============================================================

let selectedSize = '';
let refillPrice = 0;
let bottlePrice = 0;
let totalWithBottle = 0;

function selectProduct(size, refill, emptyBottle, withBottle) {
    selectedSize = size;
    refillPrice = refill;
    bottlePrice = emptyBottle;
    totalWithBottle = withBottle;

    document.getElementById('selectedProduct').textContent = size;
    updatePrice();
    document.getElementById('order').scrollIntoView({ behavior: 'smooth' });
}

function updatePrice() {
    if (!selectedSize) {
        document.getElementById('unitPrice').textContent = 'KSh 0';
        document.getElementById('totalPrice').textContent = 'KSh 0';
        return;
    }

    const totals = getOrderTotals();

    document.getElementById('unitPrice').textContent = `KSh ${totals.unitPrice}`;
    document.getElementById('totalPrice').textContent = `KSh ${totals.total}`;
    updateOrderSummary();
}

function getOrderTotals() {
    const quantity = parseInt(document.getElementById('quantity').value) || 1;
    const orderType = document.querySelector('input[name="orderType"]:checked').value;
    const unitPrice = orderType === 'refill' ? refillPrice : totalWithBottle;
    return {
        quantity: quantity,
        orderType: orderType,
        unitPrice: unitPrice,
        total: unitPrice * quantity
    };
}

function updateOrderSummary() {
    const summaryProduct = document.getElementById('summaryProduct');
    const summaryQuantity = document.getElementById('summaryQuantity');
    const summaryType = document.getElementById('summaryType');
    const summaryTotal = document.getElementById('summaryTotal');

    if (summaryProduct) {
        const totals = getOrderTotals();
        summaryProduct.textContent = selectedSize || 'None';
        summaryQuantity.textContent = totals.quantity;
        summaryType.textContent = totals.orderType === 'refill' ? 'Refill Only' : 'With New Bottle';
        summaryTotal.textContent = `KSh ${totals.total}`;
    }

    const cardSummaryTotal = document.getElementById('cardSummaryTotal');
    if (cardSummaryTotal && selectedSize) {
        cardSummaryTotal.textContent = `KSh ${getOrderTotals().total}`;
    }
}

function buildOrderData(paymentMethod, paymentStatus) {
    const totals = getOrderTotals();
    const addressSelect = document.getElementById('deliveryAddress');
    const address = addressSelect ? addressSelect.value : '';

    return {
        size: selectedSize,
        quantity: totals.quantity,
        orderType: totals.orderType === 'refill' ? 'Refill Only' : 'With New Bottle',
        unitPrice: totals.unitPrice,
        total: totals.total,
        customerName: document.getElementById('customerName').value.trim(),
        customerPhone: document.getElementById('customerPhone').value.trim(),
        customerEmail: document.getElementById('customerEmail').value.trim() || 'Not provided',
        deliveryAddress: address,
        addressDetails: document.getElementById('addressDetails').value.trim() || 'None',
        deliveryTime: document.getElementById('deliveryTime').value.trim() || 'Anytime',
        specialRequests: document.getElementById('specialRequests').value.trim() || 'None',
        paymentMethod: paymentMethod,
        paymentStatus: paymentStatus,
        status: 'pending',
        shopLocation: 'Makutano, Meru Town (Next to Kinoru Dispensary)',
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };
}

function selectService(service) {
    let size = '20 LTRS', refill = 150, empty = 300, withBottle = 450;
    if (service === 'Emergency Water') {
        refill = 250; withBottle = 550;
        document.getElementById('specialRequests').value = '🚨 EMERGENCY ORDER - URGENT';
    }
    selectProduct(size, refill, empty, withBottle);
    showMessage('orderMessage', `✅ ${service} selected! Please complete the form below.`, 'success');
}

function emergencyOrder() {
    selectService('Emergency Water');
}

function openWhatsApp() {
    window.open(`https://wa.me/254758486402?text=${encodeURIComponent('Hello Cresco Water, I would like to place an order from Makutano.')}`, '_blank');
}

function togglePaymentMethod() {
    const paymentMethod = document.querySelector('input[name="payment"]:checked').value;
    const mpesaSection = document.getElementById('mpesaSection');
    const cardSection = document.getElementById('cardSection');
    const cashButtons = document.getElementById('cashButtons');

    if (mpesaSection) mpesaSection.style.display = paymentMethod === 'M-PESA' ? 'block' : 'none';
    if (cardSection) cardSection.style.display = paymentMethod === 'Bank Card' ? 'block' : 'none';
    if (cashButtons) cashButtons.style.display = paymentMethod === 'Cash on Delivery' ? 'flex' : 'none';

    updateOrderSummary();
}

function normalizePhone(phone) {
    let p = String(phone).replace(/\D/g, '');
    if (p.startsWith('0')) p = '254' + p.slice(1);
    return p;
}

function validateOrderBasics(messageElementId) {
    if (!selectedSize) {
        showMessage(messageElementId, 'Please select a product from the pricing table', 'error');
        return false;
    }

    const name = document.getElementById('customerName').value.trim();
    const phone = document.getElementById('customerPhone').value.trim();
    const addressSelect = document.getElementById('deliveryAddress');
    const address = addressSelect ? addressSelect.value : '';

    if (!name || !phone || !address) {
        showMessage(messageElementId, 'Please fill in your name, phone number and choose a delivery location', 'error');
        return false;
    }
    return true;
}

// ============================================================
// CASH ON DELIVERY ORDER
// ============================================================
async function placeOrder() {
    if (!validateOrderBasics('orderMessage')) return;

    const orderData = buildOrderData('Cash on Delivery', 'cod');

    const btn = event.target;
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Placing Order...';

    try {
        const docRef = await db.collection('orders').add(orderData);
        showMessage('orderMessage', `✅ Order #${docRef.id.slice(-6)} placed! Track it below with your phone number. Pay KSh ${orderData.total} in cash on delivery.`, 'success');
        clearOrderForm();
    } catch (error) {
        showMessage('orderMessage', '❌ Error placing order: ' + error.message, 'error');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// ============================================================
// M-PESA PAYMENT ORDER (uses mpesa.js initiateMpesaPayment)
// ============================================================
async function handleMpesaPaymentFromForm() {
    if (!validateOrderBasics('mpesaMessage')) return;

    const mpesaPhone = document.getElementById('mpesaPhone').value.trim() || document.getElementById('customerPhone').value.trim();
    const orderData = buildOrderData('M-PESA', 'awaiting_payment');
    orderData.customerPhone = mpesaPhone;

    const btn = document.getElementById('mpesaPayBtn');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating order...';

    let docRef;
    try {
        docRef = await db.collection('orders').add(orderData);
    } catch (error) {
        showMessage('mpesaMessage', '❌ Error saving order: ' + error.message, 'error');
        btn.innerHTML = originalText;
        btn.disabled = false;
        return;
    }

    // Initiate STK push (real or simulated, handled by mpesa.js)
    await initiateMpesaPayment({
        phoneNumber: mpesaPhone,
        amount: orderData.total,
        accountReference: `Cresco-${docRef.id.slice(-6)}`,
        description: `Cresco Water - ${orderData.size} x${orderData.quantity}`,
        orderId: docRef.id
    });

    btn.innerHTML = originalText;
    btn.disabled = false;

    if (paymentState.isSimulated || paymentState.checkoutRequestId) {
        clearOrderForm();
    }
}

// ============================================================
// BANK CARD PAYMENT ORDER
// NOTE: The backend runs a SANDBOX card processor.
// For production, swap the /api/payments/card/process endpoint
// in server.js with your real gateway (Stripe / Pesapal / DPO).
// ============================================================
function luhnCheck(cardNumber) {
    const digits = cardNumber.replace(/\D/g, '');
    if (digits.length < 13 || digits.length > 19) return false;
    let sum = 0;
    let shouldDouble = false;
    for (let i = digits.length - 1; i >= 0; i--) {
        let digit = parseInt(digits.charAt(i), 10);
        if (shouldDouble) {
            digit *= 2;
            if (digit > 9) digit -= 9;
        }
        sum += digit;
        shouldDouble = !shouldDouble;
    }
    return (sum % 10) === 0;
}

async function handleCardPaymentFromForm() {
    if (!validateOrderBasics('cardMessage')) return;

    const cardName = document.getElementById('cardName').value.trim();
    const cardNumber = document.getElementById('cardNumber').value.trim();
    const cardExpiry = document.getElementById('cardExpiry').value.trim();
    const cardCvv = document.getElementById('cardCvv').value.trim();

    if (!cardName) {
        showMessage('cardMessage', 'Please enter the name on the card', 'error');
        return;
    }
    if (!luhnCheck(cardNumber)) {
        showMessage('cardMessage', '❌ Invalid card number. Please check and try again.', 'error');
        return;
    }
    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(cardExpiry)) {
        showMessage('cardMessage', '❌ Expiry must be in MM/YY format', 'error');
        return;
    }
    if (!/^\d{3,4}$/.test(cardCvv)) {
        showMessage('cardMessage', '❌ Invalid CVV', 'error');
        return;
    }

    const orderData = buildOrderData('Bank Card', 'awaiting_card_payment');

    const btn = document.getElementById('cardPayBtn');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing Card...';

    let docRef;
    try {
        docRef = await db.collection('orders').add(orderData);
    } catch (error) {
        showMessage('cardMessage', '❌ Error saving order: ' + error.message, 'error');
        btn.innerHTML = originalText;
        btn.disabled = false;
        return;
    }

    try {
        const response = await fetch(`${MPESA_API_BASE}/api/payments/card/process`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                cardNumber: cardNumber.replace(/\s/g, ''),
                cardName: cardName,
                cardExpiry: cardExpiry,
                cardCvv: cardCvv,
                amount: orderData.total,
                orderId: docRef.id,
                description: `Cresco Water - ${orderData.size} x${orderData.quantity}`
            })
        });

        const result = await response.json();

        if (response.ok && result.success) {
            await db.collection('orders').doc(docRef.id).update({
                paymentStatus: 'paid',
                status: 'confirmed',
                cardPayment: {
                    transactionId: result.transactionId,
                    last4: result.last4,
                    brand: result.brand,
                    processedAt: firebase.firestore.FieldValue.serverTimestamp()
                }
            });
            showMessage('cardMessage', `✅ Payment approved! Order #${docRef.id.slice(-6)} confirmed. Track it below with your phone number.`, 'success');
            clearOrderForm();
        } else {
            await db.collection('orders').doc(docRef.id).update({ paymentStatus: 'card_failed' });
            showMessage('cardMessage', '❌ Card payment failed: ' + (result.message || 'Unknown error'), 'error');
        }
    } catch (error) {
        console.error('Card payment error:', error);
        showMessage('cardMessage', '❌ Could not reach payment server. Is the backend running and MPESA_API_BASE set correctly?', 'error');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// ============================================================
// ALIBABA-STYLE CUSTOMER ORDER TRACKING
// - Status banner (current state headline)
// - Horizontal stepper with real timestamps
// - Order summary header (product, total, payment, location)
// - Detailed vertical shipment timeline (every event + date/time)
// - Customer receipt confirmation
// ============================================================

// Convert a Firestore timestamp to a JS Date (or null)
function toDate(ts) {
    if (ts && typeof ts.toDate === 'function') return ts.toDate();
    if (ts instanceof Date) return ts;
    if (typeof ts === 'number') return new Date(ts);
    return null;
}

function fmtDateTime(ts) {
    const d = toDate(ts);
    if (!d) return '';
    const date = d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
    const time = d.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });
    return `${date} · ${time}`;
}

function fmtTimeOnly(ts) {
    const d = toDate(ts);
    if (!d) return '';
    return d.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });
}

// Headline banner for the current status
function getStatusBanner(order) {
    const status = order.status || 'pending';
    const deliveryTime = order.deliveryTime && order.deliveryTime !== 'Anytime' ? order.deliveryTime : null;

    switch (status) {
        case 'confirmed':
            return { cls: 'confirmed', icon: 'fa-clipboard-check', text: 'Order confirmed — we are preparing your delivery', est: deliveryTime || 'Being packed now' };
        case 'dispatched':
            return { cls: 'dispatched', icon: 'fa-motorcycle', text: `Out for delivery${order.assignedRider ? ' with ' + order.assignedRider : ''}`, est: deliveryTime ? 'Expected: ' + deliveryTime : 'Arriving shortly' };
        case 'completed':
            return { cls: 'completed', icon: 'fa-check-double', text: 'Delivered — thank you for choosing Cresco Water!', est: '' };
        case 'cancelled':
            return { cls: 'cancelled', icon: 'fa-times-circle', text: 'This order was cancelled — contact us for help', est: '' };
        case 'pending':
        default:
            return { cls: 'pending', icon: 'fa-hourglass-half', text: 'Order received — awaiting payment verification & confirmation', est: 'Usually confirms within minutes' };
    }
}

// Horizontal stepper with timestamps under each stage
function buildOrderStepsHtml(order) {
    const status = order.status || 'pending';
    const steps = [
        { label: 'Order Placed', icon: 'fa-clipboard-list', at: order.timestamp },
        { label: 'Confirmed', icon: 'fa-check-circle', at: order.confirmedAt || (order.status === 'confirmed' && order.cardPayment?.processedAt ? order.cardPayment.processedAt : null) },
        { label: 'Dispatched', icon: 'fa-shipping-fast', at: order.dispatchedAt },
        { label: 'Delivered', icon: 'fa-box-open', at: order.deliveredAt || order.completedAt }
    ];

    let currentIndex = 0;
    if (status === 'confirmed') currentIndex = 1;
    else if (status === 'dispatched') currentIndex = 2;
    else if (status === 'completed') currentIndex = 3;

    let html = '<div class="order-steps">';
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
        const time = cls === 'done' || (cls === 'active' && step.at) ? fmtTimeOnly(step.at) : '';
        html += `
            <div class="order-step ${cls}">
                <span class="step-dot">${icon}</span>
                <span class="step-label">${step.label}</span>
                ${time ? `<span class="step-time">${time}</span>` : ''}
            </div>
        `;
    });
    html += '</div>';
    return html;
}

// Detailed vertical shipment timeline (the Alibaba-style event log)
function buildShipmentEvents(order) {
    const status = order.status || 'pending';
    const method = order.paymentMethod || 'Cash on Delivery';
    const mp = order.mpesaPayment || {};
    const cp = order.cardPayment || {};
    const directions = order.addressDetails && order.addressDetails !== 'None' ? order.addressDetails : null;
    const events = [];

    // --- Event 1: Order placed
    events.push({
        icon: 'fa-clipboard-list',
        title: 'Order placed',
        desc: `${order.size} × ${order.quantity} (${order.orderType || 'Refill Only'}) · KSh ${order.total} · ${method}`,
        at: order.timestamp,
        state: 'done'
    });

    // --- Event 2: Payment
    if (method === 'M-PESA') {
        if (mp.completedAt || order.paymentStatus === 'paid' || order.paymentStatus === 'verified') {
            events.push({
                icon: 'fa-mobile-alt',
                title: 'M-PESA payment received',
                desc: `KSh ${order.total}${mp.receiptNumber ? ' · Receipt <strong>' + mp.receiptNumber + '</strong>' : ''}${mp.simulated ? ' · DEMO payment' : ''}`,
                at: mp.completedAt,
                state: 'done'
            });
        } else if (order.paymentStatus === 'failed') {
            events.push({ icon: 'fa-mobile-alt', title: 'M-PESA payment failed', desc: 'Please try paying again or choose another method', at: null, state: 'cancelled' });
        } else {
            events.push({ icon: 'fa-hourglass-half', title: 'Awaiting M-PESA payment', desc: 'Enter your M-PESA PIN when prompted on your phone', at: null, state: 'pending' });
        }
    } else if (method === 'Bank Card') {
        if (cp.processedAt || order.paymentStatus === 'paid' || order.paymentStatus === 'verified') {
            events.push({
                icon: 'fa-credit-card',
                title: `Card payment approved${cp.brand ? ' (' + cp.brand + ')' : ''}`,
                desc: `KSh ${order.total}${cp.last4 ? ' · Card ···· ' + cp.last4 : ''}${cp.transactionId ? ' · Ref ' + cp.transactionId : ''}`,
                at: cp.processedAt,
                state: 'done'
            });
        } else if (order.paymentStatus === 'card_failed') {
            events.push({ icon: 'fa-credit-card', title: 'Card payment declined', desc: 'Please try another card or payment method', at: null, state: 'cancelled' });
        } else {
            events.push({ icon: 'fa-hourglass-half', title: 'Processing card payment', desc: 'Waiting for your bank to approve', at: null, state: 'pending' });
        }
    } else {
        // Cash on Delivery
        if (order.paymentStatus === 'collected') {
            events.push({ icon: 'fa-money-bill-wave', title: 'Cash collected on delivery', desc: `KSh ${order.total} received by ${order.deliveredBy === 'delivery' ? 'the rider' : 'our team'}`, at: order.deliveredAt || order.completedAt, state: 'done' });
        } else {
            events.push({ icon: 'fa-money-bill', title: 'Cash on Delivery', desc: `KSh ${order.total} to be paid to the rider on delivery`, at: null, state: status === 'dispatched' ? 'active' : 'pending' });
        }
    }

    // --- Event 3: Order confirmed by dispatcher
    if (order.confirmedAt) {
        events.push({
            icon: 'fa-clipboard-check',
            title: 'Order confirmed',
            desc: `Verified & confirmed by our dispatch team${order.confirmedBy ? ' (' + order.confirmedBy + ')' : ''}`,
            at: order.confirmedAt,
            state: 'done'
        });
    } else {
        events.push({ icon: 'fa-clipboard-check', title: 'Order confirmation', desc: 'Waiting for the dispatcher to verify & confirm', at: null, state: 'pending' });
    }

    // --- Event 4: Dispatched / rider pickup
    if (order.dispatchedAt) {
        events.push({
            icon: 'fa-shipping-fast',
            title: `Picked up${order.assignedRider ? ' by ' + order.assignedRider : ''}`,
            desc: `Heading to ${order.deliveryAddress}${directions ? ' — ' + directions : ''}`,
            at: order.dispatchedAt,
            state: 'done'
        });
    } else if (status === 'confirmed') {
        events.push({ icon: 'fa-shipping-fast', title: 'Assigning a rider', desc: 'A rider will be assigned shortly', at: null, state: 'active' });
    } else {
        events.push({ icon: 'fa-shipping-fast', title: 'Dispatch', desc: 'Your order will be assigned to a rider', at: null, state: 'pending' });
    }

    // --- Event 5: Delivered
    if (order.deliveredAt || status === 'completed') {
        events.push({
            icon: 'fa-box-open',
            title: 'Delivered',
            desc: `Handed over at ${order.deliveryAddress}${order.deliveredBy ? ' · recorded by ' + order.deliveredBy : ''}`,
            at: order.deliveredAt || order.completedAt,
            state: 'done'
        });
    } else if (status === 'dispatched') {
        events.push({ icon: 'fa-motorcycle', title: 'Out for delivery', desc: 'The rider is on the way — keep your phone nearby', at: null, state: 'active' });
    } else {
        events.push({ icon: 'fa-box-open', title: 'Delivery', desc: 'Your order will be delivered to your location', at: null, state: 'pending' });
    }

    // --- Event 6: Customer receipt confirmation
    if (order.customerConfirmedDelivery) {
        events.push({
            icon: 'fa-user-check',
            title: 'You confirmed receipt',
            desc: 'Thank you! Your confirmation was recorded.',
            at: order.completedAt,
            state: 'done'
        });
    }

    return events;
}

function buildShipmentTimelineHtml(order) {
    const events = buildShipmentEvents(order);
    let html = '<div class="track-section-title">Shipment Details</div><ul class="shipment-timeline">';
    events.forEach(ev => {
        html += `
            <li class="tl-item ${ev.state}">
                <span class="tl-icon"><i class="fas ${ev.icon}"></i></span>
                <div class="tl-title">${ev.title}</div>
                <div class="tl-desc">${ev.desc}</div>
                ${ev.at ? `<div class="tl-time"><i class="far fa-clock"></i> ${fmtDateTime(ev.at)}</div>` : ''}
            </li>
        `;
    });
    html += '</ul>';
    return html;
}

// Payment badge shown in the tracking card header
function getTrackPayBadge(order) {
    const method = order.paymentMethod || 'Cash on Delivery';
    const ps = order.paymentStatus;
    if (method === 'Cash on Delivery') {
        return ps === 'collected'
            ? '<span class="track-pay-badge paid">💰 Cash Collected</span>'
            : '<span class="track-pay-badge">💵 Cash on Delivery</span>';
    }
    if (method === 'M-PESA') {
        if (ps === 'verified') return '<span class="track-pay-badge paid">✔ M-PESA Verified</span>';
        if (ps === 'paid') return '<span class="track-pay-badge paid">✅ M-PESA Paid</span>';
        if (ps === 'failed') return '<span class="track-pay-badge failed">❌ M-PESA Failed</span>';
        return '<span class="track-pay-badge pending">⏳ M-PESA Pending</span>';
    }
    if (method === 'Bank Card') {
        if (ps === 'paid' || ps === 'verified') return '<span class="track-pay-badge paid">💳 Card Paid</span>';
        if (ps === 'card_failed') return '<span class="track-pay-badge failed">❌ Card Declined</span>';
        return '<span class="track-pay-badge pending">⏳ Card Processing</span>';
    }
    return `<span class="track-pay-badge">${method}</span>`;
}

// Full Alibaba-style tracking card for one order
function buildTrackingCard(order, docId) {
    const banner = getStatusBanner(order);
    const status = order.status || 'pending';
    const isDispatched = status === 'dispatched';
    const isCompleted = status === 'completed';
    const directions = order.addressDetails && order.addressDetails !== 'None' ? order.addressDetails : null;

    let footHtml = '';
    if (isDispatched) {
        footHtml = `
            <div class="track-foot">
                <button class="btn primary" style="margin:0; padding:10px 20px; font-size:0.95rem; display:block; width:100%;" onclick="customerConfirmReceived('${docId}')">
                    <i class="fas fa-check-circle"></i> I Have Received My Order
                </button>
            </div>
        `;
    } else if (isCompleted && order.customerConfirmedDelivery) {
        footHtml = `
            <div class="track-foot">
                <span class="received-note"><i class="fas fa-user-check"></i> You confirmed receipt of this order. Asante sana!</span>
            </div>
        `;
    } else if (status === 'cancelled') {
        footHtml = `
            <div class="track-foot">
                <button class="btn whatsapp" style="margin:0; padding:10px 20px; font-size:0.9rem;" onclick="window.open('https://wa.me/254758486402?text=${encodeURIComponent('Hello Cresco Water, I need help with my cancelled order ' + docId.slice(-6))}')">
                    <i class="fab fa-whatsapp"></i> Contact Us About This Order
                </button>
            </div>
        `;
    }

    return `
        <div class="track-card">
            <div class="track-head">
                <div class="th-left">
                    <div class="track-product-icon"><i class="fas fa-bottle-water"></i></div>
                    <div>
                        <div class="th-title">${order.size} × ${order.quantity} · #${docId.slice(-6)}</div>
                        <div class="th-sub"><i class="fas fa-map-marker-alt"></i> ${order.deliveryAddress}${directions ? ' — ' + directions : ''}</div>
                    </div>
                </div>
                <div class="th-right">
                    <div class="th-total">KSh ${order.total}</div>
                    ${getTrackPayBadge(order)}
                </div>
            </div>

            <div class="track-banner ${banner.cls}">
                <i class="fas ${banner.icon}"></i> ${banner.text}
                ${banner.est ? `<span class="tb-est"><i class="far fa-clock"></i> ${banner.est}</span>` : ''}
            </div>

            ${buildOrderStepsHtml(order)}

            <div class="track-body">
                ${buildShipmentTimelineHtml(order)}
            </div>

            ${footHtml}
        </div>
    `;
}

async function trackCustomerOrder() {
    const phone = document.getElementById('trackPhone').value.trim();
    const resultDiv = document.getElementById('trackingResult');

    if (!phone) {
        resultDiv.innerHTML = '<p class="message error" style="display:block;">Please enter your phone number to track orders.</p>';
        return;
    }

    resultDiv.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Searching for your orders...</p>';

    try {
        const snapshot = await db.collection('orders')
            .where('customerPhone', '==', phone)
            .get();

        if (snapshot.empty) {
            resultDiv.innerHTML = '<p class="message error" style="display:block;">No orders found for this phone number.</p>';
            return;
        }

        const docs = snapshot.docs.sort((a, b) => {
            const ta = a.data().timestamp?.toMillis ? a.data().timestamp.toMillis() : 0;
            const tb = b.data().timestamp?.toMillis ? b.data().timestamp.toMillis() : 0;
            return tb - ta;
        });

        let html = `<h4 style="color:#015d71; margin-bottom:12px;"><i class="fas fa-box"></i> ${docs.length} order${docs.length > 1 ? 's' : ''} found</h4>`;
        docs.forEach(doc => {
            html += buildTrackingCard(doc.data(), doc.id);
        });
        resultDiv.innerHTML = html;
    } catch (error) {
        resultDiv.innerHTML = `<p class="message error" style="display:block;">Error looking up order: ${error.message}</p>`;
    }
}

async function customerConfirmReceived(orderId) {
    try {
        const doc = await db.collection('orders').doc(orderId).get();
        const order = doc.data() || {};
        const updateData = {
            status: 'completed',
            customerConfirmedDelivery: true,
            completedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        // If it was cash on delivery, the customer confirming also means cash was handed over
        if (order.paymentMethod === 'Cash on Delivery') {
            updateData.paymentStatus = 'collected';
        }
        await db.collection('orders').doc(orderId).update(updateData);
        alert('🎉 Thank you for confirming! Your order is now marked as delivered.');
        trackCustomerOrder(); // Refresh the status view
    } catch (error) {
        alert('Error updating order: ' + error.message);
    }
}

function clearOrderForm() {
    document.getElementById('customerName').value = '';
    document.getElementById('customerPhone').value = '';
    document.getElementById('customerEmail').value = '';
    const addr = document.getElementById('deliveryAddress');
    if (addr) addr.selectedIndex = 0;
    const addrDetails = document.getElementById('addressDetails');
    if (addrDetails) addrDetails.value = '';
    document.getElementById('deliveryTime').value = '';
    document.getElementById('specialRequests').value = '';
    document.getElementById('quantity').value = '1';
    const cardName = document.getElementById('cardName');
    const cardNumber = document.getElementById('cardNumber');
    const cardExpiry = document.getElementById('cardExpiry');
    const cardCvv = document.getElementById('cardCvv');
    if (cardName) cardName.value = '';
    if (cardNumber) cardNumber.value = '';
    if (cardExpiry) cardExpiry.value = '';
    if (cardCvv) cardCvv.value = '';
    updatePrice();
}

function orderViaWhatsApp() {
    if (!selectedSize) {
        showMessage('orderMessage', 'Please select a product first', 'error');
        return;
    }
    const name = document.getElementById('customerName').value.trim();
    const phone = document.getElementById('customerPhone').value.trim();
    const address = document.getElementById('deliveryAddress').value;
    const details = document.getElementById('addressDetails').value.trim();
    window.open(`https://wa.me/254758486402?text=${encodeURIComponent(`Hello Cresco Water, order: ${selectedSize}, Name:${name}, Phone: ${phone}, Location:${address}${details ? ', Directions: ' + details : ''}`)}`, '_blank');
}

function contactViaWhatsApp() {
    window.open(`https://wa.me/254758486402?text=${encodeURIComponent('Hello Cresco Water, I have an inquiry.')}`, '_blank');
}

async function sendMessage() {
    const name = document.getElementById('contactName').value.trim();
    const email = document.getElementById('contactEmail').value.trim();
    const message = document.getElementById('contactMessage').value.trim();

    if (!name || !email || !message) {
        showMessage('contactMessageStatus', 'Please fill in all fields', 'error');
        return;
    }

    try {
        await db.collection('messages').add({
            name, email, message,
            location: 'Makutano, Meru',
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            read: false,
            replied: false
        });
        showMessage('contactMessageStatus', '✅ Message sent successfully!', 'success');
    } catch (error) {
        showMessage('contactMessageStatus', '❌ Error sending message: ' + error.message, 'error');
    }
}

function showMessage(elementId, text, type) {
    const element = document.getElementById(elementId);
    if (!element) return;
    element.textContent = text;
    element.className = `message ${type}`;
    element.style.display = 'block';
    setTimeout(() => { element.style.display = 'none'; }, 8000);
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('input[name="orderType"]').forEach(radio => {
        radio.addEventListener('change', updatePrice);
    });
    const qtyInput = document.getElementById('quantity');
    if (qtyInput) {
        qtyInput.addEventListener('input', updatePrice);
    }

    // Auto-format card number with spaces (e.g. 4242 4242 4242 4242)
    const cardNumberInput = document.getElementById('cardNumber');
    if (cardNumberInput) {
        cardNumberInput.addEventListener('input', () => {
            const digits = cardNumberInput.value.replace(/\D/g, '').slice(0, 16);
            cardNumberInput.value = digits.replace(/(\d{4})(?=\d)/g, '$1 ');
        });
    }

    // Auto-format card expiry as MM/YY
    const cardExpiryInput = document.getElementById('cardExpiry');
    if (cardExpiryInput) {
        cardExpiryInput.addEventListener('input', () => {
            let digits = cardExpiryInput.value.replace(/\D/g, '').slice(0, 4);
            if (digits.length > 2) {
                digits = digits.slice(0, 2) + '/' + digits.slice(2);
            }
            cardExpiryInput.value = digits;
        });
    }
});
