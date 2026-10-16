const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// ============================================
// CRESCO WATER M-PESA CONFIGURATION
// Makutano, Meru • Next to Kinoru Dispensary
// ============================================

const MPESA_CONFIG = {
    consumerKey: process.env.MPESA_CONSUMER_KEY || 'SZyf0xn7msoqU4ZuhZyv2YXF48E1OWCE4G6YZt5EztHSNRjs',
    consumerSecret: process.env.MPESA_CONSUMER_SECRET || 'nGtUncPh35iCtiPq92H42UX2HgDzWkAi4iJMF1RVARyJ0NTvVa62fuGAdJsFPU7b',
    passkey: process.env.MPESA_PASSKEY || 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919',
    shortcode: process.env.MPESA_SHORTCODE || '174379',
    callbackUrl: process.env.MPESA_CALLBACK_URL || 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
    environment: process.env.MPESA_ENV || 'sandbox'
};

const BASE_URL = MPESA_CONFIG.environment === 'production' 
    ? 'https://api.safaricom.co.ke' 
    : 'https://sandbox.safaricom.co.ke';

// ============================================
// UTILITY FUNCTIONS
// ============================================

function hasCredentials() {
    return !!(MPESA_CONFIG.consumerKey && 
              MPESA_CONFIG.consumerSecret && 
              MPESA_CONFIG.passkey);
}

function formatPhoneNumber(phone) {
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('0')) {
        cleaned = '254' + cleaned.slice(1);
    } else if (!cleaned.startsWith('254')) {
        cleaned = '254' + cleaned;
    }
    return cleaned;
}

function isValidSafaricomNumber(phone) {
    const formatted = formatPhoneNumber(phone);
    return /^2547[0-9]{8}$/.test(formatted);
}

function generatePassword() {
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
    const password = Buffer.from(`${MPESA_CONFIG.shortcode}${MPESA_CONFIG.passkey}${timestamp}`).toString('base64');
    return { password, timestamp };
}

// ============================================
// AUTHENTICATION
// ============================================

async function getAccessToken() {
    if (!hasCredentials()) {
        throw new Error('M-PESA credentials not configured');
    }

    const auth = Buffer.from(`${MPESA_CONFIG.consumerKey}:${MPESA_CONFIG.consumerSecret}`).toString('base64');

    try {
        const response = await axios.get(`${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
            headers: { Authorization: `Basic ${auth}` },
            timeout: 15000
        });
        return response.data.access_token;
    } catch (error) {
        if (error.code === 'ECONNABORTED') {
            throw new Error('Connection to Safaricom API timed out');
        }
        if (error.response?.status === 401) {
            throw new Error('Invalid Consumer Key or Consumer Secret');
        }
        throw new Error('Failed to connect to Safaricom API: ' + (error.response?.data?.errorMessage || error.message));
    }
}

// ============================================
// STK PUSH - INITIATE PAYMENT
// ============================================

app.post('/api/mpesa/stkpush', async (req, res) => {
    try {
        const { phoneNumber, amount, accountReference, transactionDesc, orderId } = req.body;

        // Validation
        if (!phoneNumber || !amount) {
            return res.status(400).json({ 
                success: false, 
                message: 'Phone number and amount are required' 
            });
        }

        if (!isValidSafaricomNumber(phoneNumber)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid phone number. Use format: 0712345678 or 254712345678'
            });
        }

        const formattedPhone = formatPhoneNumber(phoneNumber);
        const accessToken = await getAccessToken();
        const { password, timestamp } = generatePassword();

        const stkPayload = {
            BusinessShortCode: MPESA_CONFIG.shortcode,
            Password: password,
            Timestamp: timestamp,
            TransactionType: 'CustomerPayBillOnline',
            Amount: Math.round(amount),
            PartyA: formattedPhone,
            PartyB: MPESA_CONFIG.shortcode,
            PhoneNumber: formattedPhone,
            CallBackURL: MPESA_CONFIG.callbackUrl || `${req.protocol}://${req.get('host')}/api/mpesa/callback`,
            AccountReference: accountReference || 'CrescoWater',
            TransactionDesc: transactionDesc || 'Water Refill Payment'
        };

        console.log('Initiating STK Push:', {
            phone: formattedPhone,
            amount: amount,
            orderId: orderId,
            timestamp: timestamp
        });

        const response = await axios.post(
            `${BASE_URL}/mpesa/stkpush/v1/processrequest`,
            stkPayload,
            {
                headers: { 
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                timeout: 20000
            }
        );

        console.log('STK Push Response:', response.data);

        res.json({
            success: true,
            message: 'STK Push initiated successfully',
            data: {
                checkoutRequestId: response.data.CheckoutRequestID,
                merchantRequestId: response.data.MerchantRequestID,
                responseCode: response.data.ResponseCode,
                responseDescription: response.data.ResponseDescription,
                customerMessage: response.data.CustomerMessage,
                orderId: orderId || null
            }
        });

    } catch (error) {
        console.error('STK Push Error:', error.message);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to initiate M-PESA payment',
            error: error.response?.data || null
        });
    }
});

// ============================================
// QUERY PAYMENT STATUS
// ============================================

app.post('/api/mpesa/query', async (req, res) => {
    try {
        const { checkoutRequestId } = req.body;

        if (!checkoutRequestId) {
            return res.status(400).json({ 
                success: false, 
                message: 'CheckoutRequestID is required' 
            });
        }

        const accessToken = await getAccessToken();
        const { password, timestamp } = generatePassword();

        const queryPayload = {
            BusinessShortCode: MPESA_CONFIG.shortcode,
            Password: password,
            Timestamp: timestamp,
            CheckoutRequestID: checkoutRequestId
        };

        const response = await axios.post(
            `${BASE_URL}/mpesa/stkpushquery/v1/query`,
            queryPayload,
            {
                headers: { 
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                timeout: 15000
            }
        );

        res.json({
            success: true,
            data: response.data
        });

    } catch (error) {
        console.error('Query Error:', error.message);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to query payment status',
            error: error.response?.data || null
        });
    }
});

// ============================================
// M-PESA CALLBACK - PAYMENT RESULT
// ============================================

app.post('/api/mpesa/callback', (req, res) => {
    console.log('\n========== M-PESA CALLBACK RECEIVED ==========');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Body:', JSON.stringify(req.body, null, 2));
    console.log('==============================================\n');

    const { Body } = req.body;

    if (Body && Body.stkCallback) {
        const callback = Body.stkCallback;
        const resultCode = callback.ResultCode;
        const resultDesc = callback.ResultDesc;

        console.log('Payment Result:', {
            merchantRequestId: callback.MerchantRequestID,
            checkoutRequestId: callback.CheckoutRequestID,
            resultCode: resultCode,
            resultDesc: resultDesc
        });

        if (resultCode === 0 && callback.CallbackMetadata) {
            const metadata = {};
            callback.CallbackMetadata.Item.forEach(item => {
                metadata[item.Name] = item.Value;
            });

            console.log('Transaction Details:', {
                amount: metadata.Amount,
                receiptNumber: metadata.MpesaReceiptNumber,
                transactionDate: metadata.TransactionDate,
                phoneNumber: metadata.PhoneNumber
            });
        }
    }

    res.json({ ResultCode: 0, ResultDesc: 'Success' });
});

// ============================================
// SIMULATION MODE (Fallback for testing)
// ============================================

app.post('/api/mpesa/simulate', async (req, res) => {
    const { phoneNumber, amount, orderId } = req.body;

    const simulatedCheckoutId = 'ws_SIM_' + Date.now();

    await new Promise(resolve => setTimeout(resolve, 2000));

    res.json({
        success: true,
        simulated: true,
        message: 'SIMULATED: Payment successful (demo mode)',
        data: {
            checkoutRequestId: simulatedCheckoutId,
            merchantRequestId: 'MREQ_SIM_' + Date.now(),
            responseCode: '0',
            responseDescription: 'Success',
            customerMessage: 'SIMULATED: Check your phone and enter PIN',
            orderId: orderId || null
        }
    });
});

// ============================================
// HEALTH & STATUS ENDPOINTS
// ============================================

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        service: 'Cresco Water M-PESA API',
        environment: MPESA_CONFIG.environment,
        credentialsConfigured: hasCredentials(),
        timestamp: new Date().toISOString()
    });
});

app.get('/api/mpesa/status', (req, res) => {
    res.json({
        configured: hasCredentials(),
        environment: MPESA_CONFIG.environment,
        shortcode: MPESA_CONFIG.shortcode ? '****' + MPESA_CONFIG.shortcode.slice(-4) : null,
        callbackUrl: MPESA_CONFIG.callbackUrl || 'Not set',
        message: hasCredentials() 
            ? 'M-PESA is configured and ready' 
            : 'M-PESA is NOT configured. Set credentials in .env file'
    });
});

// ============================================
// START SERVER
// ============================================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`\n╔══════════════════════════════════════════════════════════╗`);
    console.log(`║     CRESCO WATER M-PESA SERVER                         ║`);
    console.log(`║     Makutano, Meru • Next to Kinoru Dispensary         ║`);
    console.log(`╚══════════════════════════════════════════════════════════╝`);
    console.log(`\n🚀 Server running on port ${PORT}`);
    console.log(`📍 Environment: ${MPESA_CONFIG.environment}`);
    console.log(`🔑 Credentials: ${hasCredentials() ? '✅ CONFIGURED' : '❌ NOT CONFIGURED'}`);
    console.log(`💳 Shortcode: ${MPESA_CONFIG.shortcode}`);
    console.log(`🔗 Callback URL: ${MPESA_CONFIG.callbackUrl || 'Auto-detected'}`);

    if (!hasCredentials()) {
        console.log(`\n⚠️  WARNING: M-PESA credentials not found!`);
        console.log(`   The server will run in SIMULATION mode.`);
    } else {
        console.log(`\n✅ M-PESA is ready for transactions!`);
    }
});

module.exports = app;
