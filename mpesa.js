// ============================================================
// Cresco Water Refilling Station - M-PESA Integration Script (mpesa.js)
// ============================================================

// Base URL for backend server (matches your live Render deployment)
const MPESA_API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:3000' 
    : 'https://cresco-water.onrender.com';

let paymentState = {
    checkoutRequestId: '',
    isSimulated: false,
    pollInterval: null
};

// Normalize phone number to 2547XXXXXXXX format
function normalizePhone(phone) {
    let p = String(phone || '').replace(/\D/g, '');
    if (p.startsWith('0')) {
        p = '254' + p.slice(1);
    } else if (p.startsWith('7') || p.startsWith('1')) {
        p = '254' + p;
    }
    return p;
}

// Initiate M-PESA STK Push payment with built-in timeout protection
async function initiateMpesaPayment(paymentData) {
    const formattedPhone = normalizePhone(paymentData.phoneNumber || paymentData.phone);
    const amount = Number(paymentData.amount);

    console.log('Initiating STK Push:', {
        phoneNumber: formattedPhone,
        amount: amount,
        orderId: paymentData.orderId,
        timestamp: new Date().toISOString()
    });

    showMessage('mpesaMessage', '⏳ Contacting payment server...', 'info');

    // Create a 15-second timeout controller so it never hangs infinitely
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
        const response = await fetch(`${MPESA_API_BASE}/api/mpesa/stkpush`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({
                phoneNumber: formattedPhone,
                phone: formattedPhone, // Fallback key for backend compatibility
                amount: amount,
                accountReference: paymentData.accountReference || 'CrescoWater',
                transactionDesc: paymentData.description || 'Water Refill Payment',
                orderId: paymentData.orderId
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        const result = await response.json();

        if (response.ok && result.success) {
            showMessage('mpesaMessage', '✅ STK Push sent! Please check your phone and enter your M-PESA PIN.', 'success');
            
            const checkoutId = result.data?.checkoutRequestId || result.checkoutRequestId || '';
            if (checkoutId) {
                paymentState.checkoutRequestId = checkoutId;
            }
            paymentState.isSimulated = result.simulated || false;
            
            // Safely update Firestore without blocking UI on failure
            if (paymentData.orderId && typeof db !== 'undefined') {
                try {
                    await db.collection('orders').doc(paymentData.orderId).update({
                        paymentStatus: 'awaiting_pin',
                        mpesaPayment: {
                            checkoutRequestId: checkoutId,
                            simulated: result.simulated || false,
                            initiatedAt: firebase.firestore.FieldValue.serverTimestamp()
                        }
                    });
                } catch (dbErr) {
                    console.warn('Non-fatal Firestore update warning:', dbErr);
                }
            }
        } else {
            showMessage('mpesaMessage', '❌ M-PESA Error: ' + (result.message || 'Unknown error'), 'error');
        }
    } catch (error) {
        clearTimeout(timeoutId);
        console.error('STK Push Error / Timeout:', error);
        
        if (error.name === 'AbortError') {
            showMessage('mpesaMessage', '❌ Request timed out. Ensure your backend server is running on port 3000.', 'error');
        } else {
            showMessage('mpesaMessage', '❌ Could not reach payment server. Check if backend is running.', 'error');
        }
    }
}

// Helper function for showing messages in UI
function showMessage(elementId, message, type) {
    const el = document.getElementById(elementId);
    if (el) {
        el.textContent = message;
        el.className = 'message ' + type;
        el.style.display = 'block';
    } else {
        console.log(`[${type.toUpperCase()}] ${message}`);
    }
}
