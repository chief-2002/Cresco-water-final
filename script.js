// Global variables
let selectedSize = '';
let refillPrice = 0;
let bottlePrice = 0;
let totalWithBottle = 0;

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

// Place order - FIXED VERSION
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
        paymentMethod: payment,
        status: 'pending',
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };

    // Disable button and show loading
    const btn = event.target;
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Placing Order...';
    btn.disabled = true;

    try {
        // Save to Firebase ONLY - REMOVE EMAILJS FOR NOW
        const docRef = await db.collection('orders').add(orderData);

        // Show success message without email
        showMessage('orderMessage', `✅ Order placed successfully! Order ID: ${docRef.id}`, 'success');

        // Clear form but keep product selected
        document.getElementById('customerName').value = '';
        document.getElementById('customerPhone').value = '';
        document.getElementById('customerEmail').value = '';
        document.getElementById('deliveryAddress').value = '';
        document.getElementById('deliveryTime').value = '';
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

    let message = `Hello Cresco Water,%0A%0A`;
    message += `I would like to place an order:%0A`;
    message += `*Product:* ${selectedSize}%0A`;
    message += `*Quantity:* ${quantity}%0A`;
    message += `*Type:* ${orderType === 'refill' ? 'Refill Only' : 'With New Bottle'}%0A`;
    if (name) message += `*Name:* ${name}%0A`;
    if (phone) message += `*Phone:* ${phone}%0A`;
    if (address) message += `*Address:* ${address}%0A`;
    message += `*Delivery Time:* ${deliveryTime}%0A`;

    window.open(`https://wa.me/254758486402?text=${message}`, '_blank');
}

// Contact via WhatsApp
function contactViaWhatsApp() {
    const name = document.getElementById('contactName').value.trim();
    const email = document.getElementById('contactEmail').value.trim();
    const message = document.getElementById('contactMessage').value.trim();

    let waMessage = `Hello Cresco Water,%0A%0A`;
    if (name) waMessage += `*Name:* ${name}%0A`;
    if (email) waMessage += `*Email:* ${email}%0A`;
    waMessage += `*Message:* ${message || 'I have a question'}`;

    window.open(`https://wa.me/254758486402?text=${waMessage}`, '_blank');
}

// Open WhatsApp directly
function openWhatsApp() {
    window.open(`https://wa.me/254758486402?text=Hello%20Cresco%20Water%2C%20I%20would%20like%20to%20make%20an%20order.`, '_blank');
}

// Send contact message - FIXED VERSION
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
        // Save to Firebase ONLY - REMOVE EMAILJS FOR NOW
        await db.collection('messages').add({
            name,
            email,
            message,
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
    console.log('Customer page loaded');

    // Add event listener for order type change
    document.querySelectorAll('input[name="orderType"]').forEach(radio => {
        radio.addEventListener('change', updatePrice);
    });

    // Add event listener for quantity change
    document.getElementById('quantity').addEventListener('input', updatePrice);
    document.getElementById('quantity').addEventListener('change', updatePrice);
});
// Select service from services section
function selectService(service) {
    // Map service to appropriate size/defaults
    let size = '';
    let refillPrice = 0;
    let emptyBottle = 0;
    let totalWithBottle = 0;

    switch (service) {
        case 'Water Refill':
            size = '20 LTRS';
            refillPrice = 150;
            emptyBottle = 300;
            totalWithBottle = 450;
            break;
        case 'Home Delivery':
            size = '20 LTRS';
            refillPrice = 150;
            emptyBottle = 300;
            totalWithBottle = 450;
            break;
        case 'Event Catering':
        case 'Bulk Supply':
            // For custom services, pre-fill order form with note
            document.getElementById('specialRequests').value = `Service: ${service}. Please contact me for details.`;
            size = '20 LTRS';
            refillPrice = 150;
            emptyBottle = 300;
            totalWithBottle = 450;
            break;
        case 'Custom Branding':
            size = '500 ML';
            refillPrice = 5;
            emptyBottle = 25;
            totalWithBottle = 30;
            document.getElementById('specialRequests').value = 'Interested in custom branding. Please provide options.';
            break;
        case 'Dispenser Rental':
            size = 'Dispenser';
            refillPrice = 0;
            emptyBottle = 500;
            totalWithBottle = 500;
            document.querySelector('input[name="orderType"][value="withBottle"]').checked = true;
            break;
        case 'Water Testing':
            size = 'Water Testing';
            refillPrice = 500;
            emptyBottle = 0;
            totalWithBottle = 500;
            document.querySelector('input[name="orderType"][value="refill"]').checked = true;
            break;
        default:
            size = '20 LTRS';
            refillPrice = 150;
            emptyBottle = 300;
            totalWithBottle = 450;
    }

    // Call selectProduct with the appropriate values
    selectProduct(size, refillPrice, emptyBottle, totalWithBottle);

    // Add service note to special requests if not already set
    const specialRequests = document.getElementById('specialRequests');
    if (!specialRequests.value.includes(service)) {
        if (specialRequests.value) {
            specialRequests.value += `\nService: ${service}`;
        } else {
            specialRequests.value = `Service: ${service}`;
        }
    }

    // Show success message
    showMessage('orderMessage', `✅ ${service} selected! Please complete the form below.`, 'success');
}

// Emergency order function
function emergencyOrder() {
    selectService('Emergency Water');
    document.getElementById('specialRequests').value = '🚨 EMERGENCY ORDER - URGENT';
    document.getElementById('deliveryTime').value = 'ASAP - Within 1 hour';

    // Scroll to order form
    document.getElementById('order').scrollIntoView({ behavior: 'smooth' });

    // Highlight the form
    const orderForm = document.querySelector('.order-container');
    orderForm.style.animation = 'highlight 1s ease';
    setTimeout(() => {
        orderForm.style.animation = '';
    }, 1000);
}

// Add highlight animation to CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes highlight {
        0% { box-shadow: 0 0 0 0 rgba(255, 68, 68, 0.7); }
        50% { box-shadow: 0 0 30px 10px rgba(255, 68, 68, 0.7); }
        100% { box-shadow: 0 0 0 0 rgba(255, 68, 68, 0); }
    }
`;
document.head.appendChild(style);