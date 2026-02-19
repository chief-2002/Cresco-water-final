// Global variables
let selectedSize = '';
let refillPrice = 0;
let bottlePrice = 0;
let totalWithBottle = 0;

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

// Select product from pricing table
function selectProduct(size, refill, emptyBottle, withBottle) {
    selectedSize = size;
    refillPrice = refill;
    bottlePrice = emptyBottle;
    totalWithBottle = withBottle;

    document.getElementById('selectedProduct').textContent = size;
    updatePrice();

    // Scroll to order form
    document.getElementById('order').scrollIntoView({ behavior: 'smooth' });
}

// Update price based on quantity and order type
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
}

// Select service from services section
function selectService(service) {
    let size = '';
    let refill = 0;
    let empty = 0;
    let withBottle = 0;

    switch (service) {
        case 'Water Refill':
            size = '20 LTRS';
            refill = 150;
            empty = 300;
            withBottle = 450;
            break;
        case 'Home Delivery':
            size = '20 LTRS';
            refill = 150;
            empty = 300;
            withBottle = 450;
            document.getElementById('specialRequests').value = 'Home delivery requested';
            break;
        case 'Event Catering':
            size = '20 LTRS';
            refill = 150;
            empty = 300;
            withBottle = 450;
            document.getElementById('specialRequests').value = 'Event catering: Please contact me for details';
            break;
        case 'Custom Branding':
            size = '500 ML';
            refill = 5;
            empty = 25;
            withBottle = 30;
            document.getElementById('specialRequests').value = 'Custom branding: Please provide options';
            break;
        case 'Dispenser Rental':
            size = 'Dispenser';
            refill = 0;
            empty = 500;
            withBottle = 500;
            document.querySelector('input[name="orderType"][value="withBottle"]').checked = true;
            document.getElementById('specialRequests').value = 'Dispenser rental requested';
            break;
        case 'Bulk Supply':
            size = '20 LTRS';
            refill = 150;
            empty = 300;
            withBottle = 450;
            document.getElementById('specialRequests').value = 'Bulk supply: Please contact me for quote';
            break;
        case 'Emergency Water':
            size = '20 LTRS';
            refill = 250; // Emergency price
            empty = 300;
            withBottle = 550;
            document.getElementById('specialRequests').value = '🚨 EMERGENCY ORDER - URGENT';
            document.getElementById('deliveryTime').value = 'ASAP - Within 1 hour';
            break;
        case 'Water Testing':
            size = 'Water Testing';
            refill = 500;
            empty = 0;
            withBottle = 500;
            document.querySelector('input[name="orderType"][value="refill"]').checked = true;
            document.getElementById('specialRequests').value = 'Water testing service requested';
            break;
        default:
            size = '20 LTRS';
            refill = 150;
            empty = 300;
            withBottle = 450;
    }

    selectProduct(size, refill, empty, withBottle);

    // Show success message
    showMessage('orderMessage', `✅ ${service} selected! Please complete the form below.`, 'success');
}

// Emergency order function
function emergencyOrder() {
    selectService('Emergency Water');

    // Highlight the form
    const orderForm = document.querySelector('.order-container');
    orderForm.style.animation = 'highlight 1s ease';
    setTimeout(() => {
        orderForm.style.animation = '';
    }, 1000);
}

// Open WhatsApp directly
function openWhatsApp() {
    const message = `Hello Cresco Water (Makutano Shop), I would like to make an order from your location next to Kinoru Dispensary.`;
    window.open(`https://wa.me/254758486402?text=${encodeURIComponent(message)}`, '_blank');
}

// Place order
async function placeOrder() {
    // Validate inputs
    if (!selectedSize) {
        showMessage('orderMessage', 'Please select a product from the pricing table', 'error');
        return;
    }

    const name = document.getElementById('customerName').value.trim();
    const phone = document.getElementById('customerPhone').value.trim();
    const address = document.getElementById('deliveryAddress').value.trim();

    if (!name || !phone || !address) {
        showMessage('orderMessage', 'Please fill in all required fields', 'error');
        return;
    }

    // Get order details
    const quantity = parseInt(document.getElementById('quantity').value) || 1;
    const orderType = document.querySelector('input[name="orderType"]:checked').value;
    const payment = document.querySelector('input[name="payment"]:checked').value;
    const unitPrice = orderType === 'refill' ? refillPrice : totalWithBottle;
    const total = unitPrice * quantity;
    const specialRequests = document.getElementById('specialRequests').value.trim() || 'None';

    // Create order object
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
        specialRequests: specialRequests,
        paymentMethod: payment,
        status: 'pending',
        shopLocation: 'Makutano, Meru Town (Next to Kinoru Dispensary)',
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };

    // Disable button and show loading
    const btn = event.target;
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Placing Order...';
    btn.disabled = true;

    try {
        // Save to Firebase
        const docRef = await db.collection('orders').add(orderData);

        showMessage('orderMessage', `✅ Order placed successfully! Order ID: ${docRef.id}`, 'success');

        // Clear form but keep product selected
        document.getElementById('customerName').value = '';
        document.getElementById('customerPhone').value = '';
        document.getElementById('customerEmail').value = '';
        document.getElementById('deliveryAddress').value = '';
        document.getElementById('deliveryTime').value = '';
        document.getElementById('specialRequests').value = '';
        document.getElementById('quantity').value = '1';
        updatePrice();

        console.log('Order saved with ID:', docRef.id);

    } catch (error) {
        console.error('Error placing order:', error);
        showMessage('orderMessage', '❌ Error placing order. Please try again. Error: ' + error.message, 'error');
    } finally {
        // Restore button
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// Order via WhatsApp
function orderViaWhatsApp() {
    if (!selectedSize) {
        showMessage('orderMessage', 'Please select a product from the pricing table', 'error');
        return;
    }

    const name = document.getElementById('customerName').value.trim();
    const phone = document.getElementById('customerPhone').value.trim();
    const address = document.getElementById('deliveryAddress').value.trim();
    const quantity = parseInt(document.getElementById('quantity').value) || 1;
    const orderType = document.querySelector('input[name="orderType"]:checked').value;
    const deliveryTime = document.getElementById('deliveryTime').value.trim() || 'Anytime';
    const specialRequests = document.getElementById('specialRequests').value.trim() || 'None';

    let message = `Hello Cresco Water (Makutano Shop),%0A%0A`;
    message += `I would like to place an order from your shop next to Kinoru Dispensary:%0A`;
    message += `*Product:* ${selectedSize}%0A`;
    message += `*Quantity:* ${quantity}%0A`;
    message += `*Type:* ${orderType === 'refill' ? 'Refill Only' : 'With New Bottle'}%0A`;
    if (name) message += `*Name:* ${name}%0A`;
    if (phone) message += `*Phone:* ${phone}%0A`;
    if (address) message += `*Delivery Address:* ${address}%0A`;
    message += `*Delivery Time:* ${deliveryTime}%0A`;
    if (specialRequests !== 'None') message += `*Special Requests:* ${specialRequests}%0A`;
    message += `%0A*Shop Location:* Makutano, Meru Town (Next to Kinoru Dispensary, Kinoru Stadium Road)`;

    window.open(`https://wa.me/254758486402?text=${message}`, '_blank');
}

// Contact via WhatsApp
function contactViaWhatsApp() {
    const name = document.getElementById('contactName').value.trim();
    const email = document.getElementById('contactEmail').value.trim();
    const message = document.getElementById('contactMessage').value.trim();

    let waMessage = `Hello Cresco Water (Makutano Shop),%0A%0A`;
    if (name) waMessage += `*Name:* ${name}%0A`;
    if (email) waMessage += `*Email:* ${email}%0A`;
    waMessage += `*Message:* ${message || 'I have a question about your services'}%0A%0A`;
    waMessage += `*Your Location:* Makutano, Meru`;

    window.open(`https://wa.me/254758486402?text=${waMessage}`, '_blank');
}

// Send contact message
async function sendMessage() {
    const name = document.getElementById('contactName').value.trim();
    const email = document.getElementById('contactEmail').value.trim();
    const message = document.getElementById('contactMessage').value.trim();

    if (!name || !email || !message) {
        showMessage('contactMessageStatus', 'Please fill in all fields', 'error');
        return;
    }

    const btn = event.target;
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
    btn.disabled = true;

    try {
        // Save to Firebase
        await db.collection('messages').add({
            name,
            email,
            message,
            location: 'Makutano, Meru',
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            read: false,
            replied: false
        });

        showMessage('contactMessageStatus', '✅ Message sent successfully!', 'success');

        // Clear form
        document.getElementById('contactName').value = '';
        document.getElementById('contactEmail').value = '';
        document.getElementById('contactMessage').value = '';

    } catch (error) {
        console.error('Error sending message:', error);
        showMessage('contactMessageStatus', '❌ Error sending message. Please try again. Error: ' + error.message, 'error');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// Get directions function
function getDirections() {
    window.open('https://www.google.com/maps/dir/?api=1&destination=Kinoru+Dispensary+Meru', '_blank');
}

// Show message helper
function showMessage(elementId, text, type) {
    const element = document.getElementById(elementId);
    element.textContent = text;
    element.className = `message ${type}`;
    element.style.display = 'block';

    // Auto hide after 5 seconds
    setTimeout(() => {
        element.style.display = 'none';
    }, 5000);
}

// Initialize
document.addEventListener('DOMContentLoaded', function () {
    console.log('Customer page loaded - Makutano, Meru location');

    // Add event listener for order type change
    document.querySelectorAll('input[name="orderType"]').forEach(radio => {
        radio.addEventListener('change', updatePrice);
    });

    // Add event listener for quantity change
    document.getElementById('quantity').addEventListener('input', updatePrice);
    document.getElementById('quantity').addEventListener('change', updatePrice);
});
