const botToken = '8168860159:AAH0_8SZtmxCSwnoogOD13kcRCZrvX-5A5o';
const chatId = '582783091'; // Replace with your chat ID

function sendOrderToBot() {
    const userInfo = JSON.parse(localStorage.getItem('userInfo')) || {};
    const cart = JSON.parse(localStorage.getItem('cart')) || [];

    let message = "New Order Received!\n\n";

    message += "\nOrder Details:\n";
    let total = 0;
    cart.forEach(item => {
        const price = parseFloat(item.item_price.replace('৳', '').replace(',', ''));
        const itemTotal = price * item.quantity;
        total += itemTotal;
        message += `${item.item_name} - Quantity: ${item.quantity} - Price: ৳${itemTotal.toFixed(2)}\n`;
    });

    message += `\nTotal: ৳${total.toFixed(2)}`;

    const url = `https://api.telegram.org/bot${botToken}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(message)}`;

    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data.ok) {
                alert('Order placed successfully! Details sent to Telegram bot.');
            } else {
                alert('Failed to send order to Telegram bot.');
            }
        })
        .catch(error => {
            console.error('Error sending order to Telegram bot:', error);
            alert('An error occurred while sending the order to Telegram bot.');
        });
}
