// ============================================
// Cresco Water - M-PESA STK Push Integration
// Production Ready • Makutano, Meru
// ============================================

const MPESA_CONFIG = {
    // ⚠️ IMPORTANT: Update this URL!
    // For local testing: 'http://localhost:3000'
    // For production (Render/Railway): 'https://your-app-name.onrender.com'
    apiBaseUrl: '',

    // Polling settings
    pollInterval: 5000,      // Check every 5 seconds
    maxPollAttempts: 12,      // For 60 seconds total

    // Enable simulation mode when backend has no credentials
    allowSimulation: true
};

// Global state for payment tracking
let paymentState = {
    checkoutRequestId: null,
    merchantRequestId: null,
    orderId: null,
    pollTimer: null,
    pollCount: 0,
    isProcessing: false,
    isSimulated: false
};

/**
 * Check if backend is configured for real M-PESA
 */
async function checkBackendStatus() {
    try {
        const response = await fetch(`${MPESA_CONFIG.apiBaseUrl}/api/mpesa/status`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) throw new Error('Backend not responding');

        const data = await response.json();
        return {
            configured: data.configured,
            environment: data.environment,
            message: data.message
        };
    } catch (error) {
        console.error('Backend status check failed:', error);
        return { configured: false, error: error.message };
    }
}

/**
 * Format phone number to 2547XXXXXXXX
 */
function formatPhoneNumber(phone) {
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('0')) {
        cleaned = '254' + cleaned.slice(1);
    } else if (!cleaned.startsWith('254')) {
        cleaned = '254' + cleaned;
    }
    return cleaned;
}

/**
 * Validate Kenyan Safaricom phone number
 */
function isValidSafaricomNumber(phone) {
    const formatted = formatPhoneNumber(phone);
    return /^2547[0-9]{8}$/.test(formatted);
}

/**
 * Show payment message in the UI
 */
function showPaymentMessage(text, type) {
    const element = document.getElementById('mpesaMessage');
    if (!element) return;

    element.innerHTML = text.replace(/\n/g, '<br>');
    element.className = `message ${type}`;
    element.style.display = 'block';

    if (type === 'info') {
        setTimeout(() => { element.style.display = 'none'; }, 10000);
    }
}

/**
 * Set payment button state
 */
function setPaymentButtonState(loading) {
    const btn = document.getElementById('mpesaPayBtn');
    if (!btn) return;

    if (loading) {
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        btn.disabled = true;
    } else {
        btn.innerHTML = '<i class="fas fa-mobile-alt"></i> Pay with M-PESA';
        btn.disabled = false;
    }
}

/**
 * Initiate M-PESA payment (with fallback to simulation)
 */
async function initiateMpesaPayment(orderDetails) {
    const { phoneNumber, amount, accountReference, description, orderId } = orderDetails;

    // Validate inputs
    if (!phoneNumber || !amount || amount <= 0) {
        showPaymentMessage('❌ Please enter a valid phone number and amount', 'error');
        return null;
    }

    const formattedPhone = formatPhoneNumber(phoneNumber);

    if (!isValidSafaricomNumber(phoneNumber)) {
        showPaymentMessage('❌ Please enter a valid Safaricom number (e.g., 0712345678)', 'error');
        return null;
    }

    setPaymentButtonState(true);
    showPaymentMessage('⏳ Checking payment system...', 'info');

    try {
        // First, check if backend has real credentials
        const backendStatus = await checkBackendStatus();

        let response;
        let isSimulated = false;

        if (!backendStatus.configured && MPESA_CONFIG.allowSimulation) {
            // Backend has no credentials - use simulation mode
            console.log('M-PESA not configured on backend. Using simulation mode.');
            showPaymentMessage(
                '⚠️ M-PESA is in DEMO mode.<br>' +
                'Real payments are not configured yet.<br>' +
                'Simulating payment...',
                'warning'
            );

            response = await fetch(`${MPESA_CONFIG.apiBaseUrl}/api/mpesa/simulate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phoneNumber: formattedPhone,
                    amount: amount,
                    orderId: orderId
                })
            });

            isSimulated = true;

        } else if (!backendStatus.configured) {
            showPaymentMessage(
                '❌ M-PESA is not configured.<br>' +
                'Please contact the administrator to set up M-PESA payments.',
                'error'
            );
            setPaymentButtonState(false);
            return null;

        } else {
            // Backend has credentials - use REAL M-PESA API
            showPaymentMessage(
                '⏳ Connecting to M-PESA...<br>' +
                'Please wait while we initiate your payment.',
                'info'
            );

            response = await fetch(`${MPESA_CONFIG.apiBaseUrl}/api/mpesa/stkpush`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phoneNumber: formattedPhone,
                    amount: amount,
                    accountReference: accountReference || `Cresco-${orderId?.slice(-6) || 'Order'}`,
                    transactionDesc: description || 'Cresco Water Payment',
                    orderId: orderId
                })
            });
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Server error: ${response.status}`);
        }

        const result = await response.json();

        if (result.success) {
            // Store payment state
            paymentState.checkoutRequestId = result.data.checkoutRequestId;
            paymentState.merchantRequestId = result.data.merchantRequestId;
            paymentState.orderId = orderId;
            paymentState.isProcessing = true;
            paymentState.pollCount = 0;
            paymentState.isSimulated = isSimulated || result.simulated;

            if (paymentState.isSimulated) {
                showPaymentMessage(
                    `✅ DEMO Payment Simulated!<br><br>` +
                    `📱 Phone: ${formattedPhone}<br>` +
                    `💰 Amount: KSh ${amount}<br>` +
                    `🆔 Checkout ID: ${result.data.checkoutRequestId}<br><br>` +
                    `<small>This is a simulation. Real M-PESA is not configured yet.</small>`,
                    'success'
                );

                // Auto-complete simulated payment after 3 seconds
                setTimeout(() => {
                    completeSimulatedPayment(orderId, amount, formattedPhone);
                }, 3000);

            } else {
                showPaymentMessage(
                    `✅ STK Push sent!<br><br>` +
                    `📱 Check your phone (${formattedPhone})<br>` +
                    `💰 Amount: KSh ${amount}<br>` +
                    `⏳ Enter your M-PESA PIN to complete payment`,
                    'success'
                );

                // Start polling for real payment status
                startPaymentPolling();
            }

            // Save payment info to Firebase order
            await savePaymentToOrder(orderId, {
                checkoutRequestId: result.data.checkoutRequestId,
                merchantRequestId: result.data.merchantRequestId,
                amount: amount,
                phoneNumber: formattedPhone,
                status: 'pending',
                simulated: paymentState.isSimulated,
                initiatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            return result.data;

        } else {
            throw new Error(result.message || 'Payment initiation failed');
        }

    } catch (error) {
        console.error('M-PESA Payment Error:', error);

        let errorMsg = error.message;

        // User-friendly error messages
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            errorMsg = 'Cannot connect to payment server.<br>' +
                      'Please make sure the backend server is running (npm start)<br>' +
                      'and the API URL is correct in mpesa.js';
        } else if (error.message.includes('ECONNREFUSED')) {
            errorMsg = 'Payment server is not running.<br>Please start the server with: node server.js';
        } else if (error.message.includes('CORS')) {
            errorMsg = 'CORS error. The backend server may not be configured correctly.';
        } else if (error.message.includes('Invalid Consumer Key')) {
            errorMsg = 'Invalid M-PESA credentials.<br>Please check your Consumer Key and Consumer Secret in the .env file.';
        }

        showPaymentMessage('❌ ' + errorMsg, 'error');
        setPaymentButtonState(false);
        return null;
    }
}

/**
 * Complete a simulated payment (for demo/testing)
 */
async function completeSimulatedPayment(orderId, amount, phoneNumber) {
    const receiptNumber = 'SIM' + Math.random().toString(36).substr(2, 8).toUpperCase();

    showPaymentMessage(
        `✅ DEMO Payment Completed!<br><br>` +
        `🧾 Receipt: ${receiptNumber}<br>` +
        `💰 Amount: KSh ${amount}<br>` +
        `📱 Phone: ${phoneNumber}<br><br>` +
        `<small>In production, this would be a real M-PESA transaction.</small>`,
        'success'
    );

    // Update order in Firebase
    await updateOrderPaymentStatus(orderId, {
        status: 'completed',
        receiptNumber: receiptNumber,
        resultCode: '0',
        resultDesc: 'Simulated success',
        completedAt: firebase.firestore.FieldValue.serverTimestamp(),
        simulated: true
    });

    setPaymentButtonState(false);
    paymentState.isProcessing = false;
}

/**
 * Poll for payment status
 */
function startPaymentPolling() {
    if (paymentState.pollTimer) {
        clearInterval(paymentState.pollTimer);
    }

    paymentState.pollTimer = setInterval(async () => {
        paymentState.pollCount++;

        if (paymentState.pollCount > MPESA_CONFIG.maxPollAttempts) {
            clearInterval(paymentState.pollTimer);
            paymentState.isProcessing = false;
            showPaymentMessage(
                '⏰ Payment check timed out.<br>' +
                'Please check your M-PESA messages.<br>' +
                'If payment was successful, your order will be updated.',
                'warning'
            );
            setPaymentButtonState(false);
            return;
        }

        try {
            const response = await fetch(`${MPESA_CONFIG.apiBaseUrl}/api/mpesa/query`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    checkoutRequestId: paymentState.checkoutRequestId
                })
            });

            if (!response.ok) {
                console.log('Poll attempt', paymentState.pollCount, '- status check failed');
                return;
            }

            const result = await response.json();

            if (result.success && result.data) {
                const { ResultCode, ResultDesc } = result.data;

                // Payment successful
                if (ResultCode === '0') {
                    clearInterval(paymentState.pollTimer);
                    paymentState.isProcessing = false;

                    const receiptNumber = result.data.CallbackMetadata?.Item?.find(
                        i => i.Name === 'MpesaReceiptNumber'
                    )?.Value;

                    showPaymentMessage(
                        `✅ Payment Successful!<br><br>` +
                        `🧾 Receipt: ${receiptNumber || 'N/A'}<br>` +
                        `💰 Amount: KSh ${result.data.CallbackMetadata?.Item?.find(i => i.Name === 'Amount')?.Value || 'N/A'}`,
                        'success'
                    );

                    await updateOrderPaymentStatus(paymentState.orderId, {
                        status: 'completed',
                        receiptNumber: receiptNumber,
                        resultCode: ResultCode,
                        resultDesc: ResultDesc,
                        completedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });

                    setPaymentButtonState(false);
                    return;
                }

                // Payment cancelled by user
                if (ResultCode === '1032') {
                    clearInterval(paymentState.pollTimer);
                    paymentState.isProcessing = false;
                    showPaymentMessage('❌ Payment cancelled by user. You can try again.', 'error');
                    setPaymentButtonState(false);
                    return;
                }

                // Other errors
                if (ResultCode && ResultCode !== '') {
                    clearInterval(paymentState.pollTimer);
                    paymentState.isProcessing = false;
                    showPaymentMessage(`❌ Payment failed: ${ResultDesc}`, 'error');
                    setPaymentButtonState(false);
                    return;
                }
            }

        } catch (error) {
            console.error('Polling error:', error);
        }
    }, MPESA_CONFIG.pollInterval);
}

/**
 * Save payment details to Firebase order
 */
async function savePaymentToOrder(orderId, paymentData) {
    if (!orderId) return;

    try {
        await db.collection('orders').doc(orderId).update({
            mpesaPayment: paymentData
        });
    } catch (error) {
        console.error('Error saving payment to order:', error);
    }
}

/**
 * Update order payment status in Firebase
 */
async function updateOrderPaymentStatus(orderId, paymentStatus) {
    if (!orderId) return;

    try {
        await db.collection('orders').doc(orderId).update({
            'mpesaPayment.status': paymentStatus.status,
            'mpesaPayment.receiptNumber': paymentStatus.receiptNumber,
            'mpesaPayment.resultCode': paymentStatus.resultCode,
            'mpesaPayment.resultDesc': paymentStatus.resultDesc,
            'mpesaPayment.completedAt': paymentStatus.completedAt,
            'mpesaPayment.simulated': paymentStatus.simulated || false,
            paymentStatus: 'paid'
        });
    } catch (error) {
        console.error('Error updating payment status:', error);
    }
}

/**
 * Cancel ongoing payment
 */
function cancelPayment() {
    if (paymentState.pollTimer) {
        clearInterval(paymentState.pollTimer);
        paymentState.pollTimer = null;
    }
    paymentState.isProcessing = false;
    paymentState.pollCount = 0;
    setPaymentButtonState(false);
    showPaymentMessage('Payment cancelled by user.', 'error');
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { 
        initiateMpesaPayment, 
        cancelPayment, 
        checkBackendStatus,
        MPESA_CONFIG,
        formatPhoneNumber,
        isValidSafaricomNumber
    };
}
