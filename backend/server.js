require('dotenv').config();
const express = require('express');
const cors = require('cors');
const https = require('https'); // Use https module for Telegram API call

const app = express();
const port = process.env.PORT || 3000;

// Middleware
// Enable CORS for requests from your frontend origin
// SECURITY: For production, replace '*' with your actual frontend URL
const corsOptions = {
    origin: process.env.CORS_ORIGIN || '*'
};
app.use(cors(corsOptions)); 
app.use(express.json()); // Parse JSON request bodies

// --- Telegram Bot Configuration --- 
const botToken = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

if (!botToken || !chatId) {
    console.error('Error: Telegram Bot Token or Chat ID not found in .env file.');
    process.exit(1); // Stop the server if config is missing
}

// --- Helper function to send message to Telegram --- 
function sendTelegramMessage(message) {
    const encodedMessage = encodeURIComponent(message);
    const telegramApiUrl = `https://api.telegram.org/bot${botToken}/sendMessage?chat_id=${chatId}&text=${encodedMessage}&parse_mode=Markdown`;

    https.get(telegramApiUrl, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            try {
                const response = JSON.parse(data);
                if (response.ok) {
                    console.log('Message successfully sent to Telegram.');
                } else {
                    console.error('Error sending message to Telegram:', response.description);
                }
            } catch (e) {
                 console.error('Error parsing Telegram API response:', e, 'Response data:', data);
            }
        });
    }).on('error', (err) => {
        console.error('Error calling Telegram API:', err.message);
    });
}

// --- API Endpoint to receive order data --- 
app.post('/api/send-order', (req, res) => {
    console.log('Received order data:', JSON.stringify(req.body, null, 2));
    const orderDetails = req.body;

    // --- Format the message for Telegram --- 
    // (Using Markdown for basic formatting)
    let message = `*🛍️ New Order Received!*\n\n`;
    
    // Customer Info
    message += `*Customer:*\n`;
    message += `  - Name: ${orderDetails.customerInfo?.name || 'N/A'}\n`;
    message += `  - Email: ${orderDetails.customerInfo?.email || 'N/A'}\n`;
    message += `  - Phone: ${orderDetails.customerInfo?.phone || 'N/A'}\n\n`;

    // Game Info
    if (orderDetails.gameSpecificInfo && Object.keys(orderDetails.gameSpecificInfo).length > 0) {
        message += `*Game Account Details:*\n`;
        for (const [key, value] of Object.entries(orderDetails.gameSpecificInfo)) {
            const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            message += `  - ${formattedKey}: ${value}\n`;
        }
        message += `\n`;
    }

    // Items
    message += `*Items:*\n`;
    if (orderDetails.items && orderDetails.items.length > 0) {
        orderDetails.items.forEach(item => {
             const price = parseFloat(item.item_price?.replace('৳', '').replace(',', '') || 0);
             const itemTotal = (price * (item.quantity || 1)).toFixed(2);
             message += `  - ${item.item_name || 'Unknown Item'} (x${item.quantity || 1}) - ৳ ${itemTotal}\n`;
        });
    } else {
        message += `  (No items listed)\n`;
    }
    message += `\n`;

    // Total
    message += `*Total Amount:* ${orderDetails.total || 'N/A'}\n\n`;

    // Payment Info
    message += `*Payment Method:* ${orderDetails.paymentMethod || 'N/A'}\n`;
    if (orderDetails.paymentMethod === 'Send Money' && orderDetails.paymentDetails) {
        message += `  - Type: ${orderDetails.paymentDetails.sendMoneyType || 'N/A'}\n`;
        message += `  - TrxID: ${orderDetails.paymentDetails.transactionId || 'N/A'}\n`;
    } else if (orderDetails.paymentMethod === 'Bank Transfer' && orderDetails.paymentDetails) {
        message += `  - Reference: ${orderDetails.paymentDetails.bankReference || 'N/A'}\n`;
    }

    // Send the formatted message to Telegram
    sendTelegramMessage(message);

    // Send response back to the frontend
    res.status(200).json({ success: true, message: 'Order received and sent to Telegram.' });
});

// Basic root route
app.get('/', (req, res) => {
    res.send('Gameshop Backend is running!');
});

// Start the server
app.listen(port, () => {
    console.log(`Backend server listening at http://localhost:${port}`);
}); 