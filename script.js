// ============================================================
// Cresco Water - Frontend script
// ============================================================

const MPESA_BACKEND_URL = "https://your-backend-url.onrender.com";

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

    const quantity = parseInt(document.getElementById('quantity').value) || 1;
    const orderType = document.querySelector('input[name="orderType"]:checked').value;

    let unitPrice = orderType === 'refill' ? refillPrice : totalWithBottle;
    let total = unitPrice * quantity;

    document.getElementById('unitPrice').textContent = `KSh ${unitPrice}`;
    document.getElementById('totalPrice').textContent = `KSh ${total}`;
    updateOrderSummary();
}

function updateOrderSummary() {
    const summaryProduct = document.getElementById('summaryProduct');
    const summaryQuantity = document.getElementById('summaryQuantity');
    const summaryType = document.getElementById('summaryType');
    const summaryTotal = document.getElementById('summaryTotal');

    if (!summaryProduct) return;

    const quantity = parseInt(document.getElementById('quantity').value) || 1;
    const orderType = document.querySelector('input[name="orderType"]:checked')?.value || 'refill';
    let unitPrice = orderType === 'refill' ? refillPrice : totalWithBottle;
    let total = unitPrice * quantity;

    summaryProduct.textContent = selectedSize || 'None';
    summaryQuantity.textContent = quantity;
    summaryType.textContent = orderType === 'refill' ? 'Refill Only' : 'With New Bottle';
    summaryTotal.textContent = `KSh ${total}`;
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
    const cashButtons = document.getElementById('cashButtons');

    if (paymentMethod === 'M-PESA') {
        if (mpesaSection) mpesaSection.style.display = 'block';
        if (cashButtons) cashButtons.style.display = 'none';
        updateOrderSummary();
    } else {
        if (mpesaSection) mpesaSection.style.display = 'none';
        if (cashButtons) cashButtons.style.display = 'flex';
    }
}

function normalizePhone(phone) {
    let p = String(phone).replace(/\D/g, '');
    if (p.startsWith('0')) p = '254' + p.slice(1);
    return p;
}

async function placeOrder() {
    if (!selectedSize) {
        showMessage('orderMessage', 'Please select a product from the pricing table', 'error');
        return;
    }

    const name = document.getElementById('customerName').value.trim();
    const phone = document.getElementById('customerPhone').value.trim();
    const addressSelect = document.getElementById('deliveryAddress');
    const address = addressSelect ? addressSelect.value : '';

    if (!name || !phone || !address) {
        showMessage('orderMessage', 'Please fill in all required fields and select a Makutano landmark', 'error');
        return;
    }

    const quantity = parseInt(document.getElementById('quantity').value) || 1;
    const orderType = document.querySelector('input[name="orderType"]:checked').value;
    const unitPrice = orderType === 'refill' ? refillPrice : totalWithBottle;
    const total = unitPrice * quantity;

    const orderData = {
        size: selectedSize,
        quantity: quantity,
        orderType: orderType === 'refill' ? 'Refill Only' : 'With New Bottle',
        unitPrice: unitPrice,
        total: total,
        customerName: name,
        customerPhone: phone,
        customerEmail: document.getElementById('customerEmail').value.trim() || 'Not provided',
        deliveryAddress: address,
        deliveryTime: document.getElementById('deliveryTime').value.trim() || 'Anytime',
        specialRequests: document.getElementById('specialRequests').value.trim() || 'None',
        paymentMethod: 'Cash on Delivery',
        status: 'pending',
        shopLocation: 'Makutano, Meru Town (Next to Kinoru Dispensary)',
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };

    const btn = event.target;
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Placing Order...';

    try {
        const docRef = await db.collection('orders').add(orderData);
        showMessage('orderMessage', `✅ Order placed successfully! ID: #${docRef.id.slice(-6)}. Awaiting dispatcher verification.`, 'success');
        clearOrderForm();
    } catch (error) {
        showMessage('orderMessage', '❌ Error placing order: ' + error.message, 'error');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

async function handleMpesaPaymentFromForm() {
    if (!selectedSize) {
        showMessage('mpesaMessage', 'Please select a product first', 'error');
        return;
    }

    const name = document.getElementById('customerName').value.trim();
    const phone = document.getElementById('mpesaPhone').value.trim() || document.getElementById('customerPhone').value.trim();
    const addressSelect = document.getElementById('deliveryAddress');
    const address = addressSelect ? addressSelect.value : '';

    if (!name || !phone || !address) {
        showMessage('mpesaMessage', 'Please fill in your name, landmark, and phone number', 'error');
        return;
    }

    const quantity = parseInt(document.getElementById('quantity').value) || 1;
    const orderType = document.querySelector('input[name="orderType"]:checked').value;
    const unitPrice = orderType === 'refill' ? refillPrice : totalWithBottle;
    const total = unitPrice * quantity;

    const orderData = {
        size: selectedSize,
        quantity: quantity,
        orderType: orderType === 'refill' ? 'Refill Only' : 'With New Bottle',
        unitPrice: unitPrice,
        total: total,
        customerName: name,
        customerPhone: phone,
        customerEmail: document.getElementById('customerEmail').value.trim() || 'Not provided',
        deliveryAddress: address,
        deliveryTime: document.getElementById('deliveryTime').value.trim() || 'Anytime',
        specialRequests: document.getElementById('specialRequests').value.trim() || 'None',
        paymentMethod: 'M-PESA',
        status: 'pending',
        shopLocation: 'Makutano, Meru Town (Next to Kinoru Dispensary)',
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };

    const btn = document.getElementById('mpesaPayBtn');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing M-Pesa...';

    let docRef;
    try {
        docRef = await db.collection('orders').add({
            ...orderData,
            paymentStatus: 'awaiting_payment'
        });

        const res = await fetch(`${MPESA_BACKEND_URL}/api/mpesa/stkpush`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phoneNumber: normalizePhone(phone),
                amount: total,
                orderId: docRef.id
            })
        });
        const data = await res.json();
        if (!res.ok) {
            await db.collection('orders').doc(docRef.id).update({ paymentStatus: 'prompt_failed' });
            showMessage('mpesaMessage', '❌ Could not send payment prompt: ' + (data.message || 'Unknown error'), 'error');
            btn.innerHTML = originalText;
            btn.disabled = false;
            return;
        }

        const checkoutRequestId = data.data.checkoutRequestId;
        showMessage('mpesaMessage', '📱 STK Push sent! Check your phone and enter your M-Pesa PIN.', 'success');

        for (let i = 0; i < 24; i++) {
            await new Promise(r => setTimeout(r, 5000));
            const statusRes = await fetch(`${MPESA_BACKEND_URL}/api/mpesa/query`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ checkoutRequestId })
            });
            const statusJson = await statusRes.json();
            if (statusJson.success && statusJson.data.ResultCode === '0') {
                const receipt = statusJson.data.CallbackMetadata?.Item?.find(i => i.Name === 'MpesaReceiptNumber')?.Value || 'Paid';
                await db.collection('orders').doc(docRef.id).update({
                    paymentStatus: 'paid',
                    status: 'confirmed',
                    mpesaReceipt: receipt
                });
                showMessage('mpesaMessage', `✅ Payment Successful! Receipt: ${receipt}. Order confirmed!`, 'success');
                clearOrderForm();
                btn.innerHTML = originalText;
                btn.disabled = false;
                return;
            }
        }
        showMessage('mpesaMessage', '⏳ Payment polling timed out. Please check your messages.', 'error');
    } catch (e) {
        showMessage('mpesaMessage', '❌ Error: ' + e.message, 'error');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// ============================================================
// 🆕 CUSTOMER ORDER TRACKING & DELIVERY CONFIRMATION
// ============================================================
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

        let html = '<h4 style="color:#015d71; margin-bottom:10px;">Your Order Status:</h4>';
        snapshot.forEach(doc => {
            const order = doc.data();
            const isDeliveredOrDispatched = order.status === 'dispatched' || order.status === 'confirmed';
            const isCompleted = order.status === 'completed';

            html += `
                <div style="background:#f8f9fa; padding:15px; border-radius:12px; margin-bottom:10px; border-left:5px solid #2fa1c1;">
                    <p><strong>Order ID:</strong> #${doc.id.slice(-6)}</p>
                    <p><strong>Product:</strong> ${order.size} x${order.quantity} (KSh ${order.total})</p>
                    <p><strong>Status:</strong> <span class="order-status-badge status-${order.status}" style="padding:2px 8px; border-radius:10px; font-weight:600;">${order.status}</span></p>
                    <p><strong>Landmark:</strong> ${order.deliveryAddress}</p>
                    
                    ${isDeliveredOrDispatched && !isCompleted ? `
                        <button class="btn primary" style="margin-top:10px; padding:8px 16px; font-size:0.9rem;" onclick="customerConfirmReceived('${doc.id}')">
                            <i class="fas fa-check-circle"></i> I Have Received My Order
                        </button>
                    ` : ''}

                    ${isCompleted ? `
                        <p style="color: #155724; font-weight: bold; margin-top: 8px;"><i class="fas fa-check-double"></i> Order completed & received. Thank you!</p>
                    ` : ''}
                </div>
            `;
        });
        resultDiv.innerHTML = html;
    } catch (error) {
        resultDiv.innerHTML = `<p class="message error" style="display:block;">Error looking up order: ${error.message}</p>`;
    }
}

async function customerConfirmReceived(orderId) {
    try {
        await db.collection('orders').doc(orderId).update({
            status: 'completed',
            customerConfirmedDelivery: true,
            completedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        alert('🎉 Thank you for confirming! Your order is now marked as completed.');
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
    document.getElementById('deliveryTime').value = '';
    document.getElementById('specialRequests').value = '';
    document.getElementById('quantity').value = '1';
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
    window.open(`https://wa.me/254758486402?text=${encodeURIComponent(`Hello Cresco Water, order: ${selectedSize}, Name:${name}, Phone: ${phone}, Landmark:${address}`)}`, '_blank');
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
    setTimeout(() => { element.style.display = 'none'; }, 6000);
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('input[name="orderType"]').forEach(radio => {
        radio.addEventListener('change', updatePrice);
    });
    const qtyInput = document.getElementById('quantity');
    if (qtyInput) {
        qtyInput.addEventListener('input', updatePrice);
    }
});
