require('dotenv').config();
const axios = require('axios');

// --- Telegram Bot Configuration --- 
const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
const telegramChatId = process.env.TELEGRAM_CHAT_ID;

if (!telegramBotToken || !telegramChatId) {
    console.warn('Warning: Telegram Bot Token or Chat ID not found in .env file. Telegram notifications will not be sent.');
}

// --- Helper function to send message to Telegram ---
function sendTelegramMessage(orderData) {
    // Determine if it's a bKash payment or manual payment
    const isBkashPayment = orderData.paymentMethod === 'bKash';
    
    // Construct message with appropriate title
    let message = isBkashPayment 
        ? `*🛍️ New Order Submitted (bKash Payment)*\n\n`
        : `*🛍️ New Order Submitted (Manual Payment)*\n\n`;
    
    message += `*Customer:*\n`;
    message += `  - Name: ${orderData.customerInfo?.name || 'N/A'}\n`;
    message += `  - Email: ${orderData.customerInfo?.email || 'N/A'}\n`;
    message += `  - Phone: ${orderData.customerInfo?.phone || 'N/A'}\n\n`;

    if (orderData.gameSpecificInfo && Object.keys(orderData.gameSpecificInfo).length > 0) {
         message += `*Game Account Details:*\n`;
         for (const [key, value] of Object.entries(orderData.gameSpecificInfo)) {
              const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
              message += `  - ${formattedKey}: ${value}\n`;
         }
         message += `\n`;
    }

    message += `*Items:*\n`;
    if (orderData.items && orderData.items.length > 0) {
         orderData.items.forEach(item => {
              const price = parseFloat(item.item_price?.replace('৳', '').replace(',', '') || 0);
              const itemTotal = (price * (item.quantity || 1)).toFixed(2);
              message += `  - ${item.item_name || 'Unknown Item'} (x${item.quantity || 1}) - ৳ ${itemTotal}\n`;
         });
     } else {
         message += `  (No items listed)\n`;
     }
    message += `\n`;

    message += `*Total Amount:* ${orderData.total || 'N/A'}\n\n`;
    message += `*Payment Method:* ${orderData.paymentMethod || 'N/A'}\n`;
    
    // Add details based on payment method
    if (isBkashPayment) {
        // Check for transaction info in payment object (where it actually gets stored)
        if (orderData.payment) {
            message += `*Payment Status:* ${orderData.payment.status || 'N/A'}\n`;
            message += `*Transaction ID:* ${orderData.payment.trxID || 'N/A'}\n`;
            message += `*Amount Paid:* ${orderData.payment.amount} BDT\n`;
            message += `*Payment Time:* ${orderData.payment.paymentTime ? new Date(orderData.payment.paymentTime).toLocaleString() : 'N/A'}\n`;
        } else {
            // Fallback to older structure for backward compatibility
            message += `*Payment Status:* ${orderData.paymentStatus || 'N/A'}\n`;
            message += `*Transaction ID:* ${orderData.transactionId || 'N/A'}\n`;
        }
        
        // Add callback status if available
        if (orderData.paymentDetails && orderData.paymentDetails.callbackStatus) {
            message += `*Callback Status:* ${orderData.paymentDetails.callbackStatus}\n`;
        }
        
        // Add additional payment details if available
        if (orderData.paymentDetails) {
            // If this was a test payment, show both actual and test amounts
            if (orderData.paymentDetails.isTestPayment) {
                message += `*Actual Order Amount:* ${orderData.paymentDetails.amount} ${orderData.paymentDetails.currency || 'BDT'}\n`;
                message += `*Test Payment Amount:* ${orderData.paymentDetails.testAmount} ${orderData.paymentDetails.currency || 'BDT'}\n`;
                message += `*Test Mode:* Yes (Test payment of ${orderData.paymentDetails.testAmount} BDT used)\n`;
            }
            
            if (orderData.paymentDetails.transactionTime && !orderData.payment) {
                message += `*Payment Time:* ${orderData.paymentDetails.transactionTime}\n`;
            }
        }
        
        // Add note if payment status is Initiated but likely successful
        const status = orderData.payment ? orderData.payment.status : orderData.paymentStatus;
        if (status && status.includes('Initiated')) {
            message += `\n⚠️ *Note:* Payment shows as '${status}' but was redirected with success status. Verify transaction ID with bKash if needed.\n`;
        }
    } else if (orderData.paymentMethod === 'Send Money' && orderData.paymentDetails) {
        message += `  - Type: ${orderData.paymentDetails.sendMoneyType || 'N/A'}\n`;
        message += `  - Submitted TrxID: ${orderData.paymentDetails.transactionId || 'N/A'}\n`;
    } else if (orderData.paymentMethod === 'Bank Transfer' && orderData.paymentDetails) {
        message += `  - Reference: ${orderData.paymentDetails.bankReference || 'N/A'}\n`;
    }

    // Add order reference for bKash payments
    if (isBkashPayment && orderData.merchantInvoiceNumber) {
        message += `\n*Order Reference:* ${orderData.merchantInvoiceNumber}\n`;
    }

    console.log("Sending Telegram message for order:", orderData.paymentMethod);

    if (!telegramBotToken || !telegramChatId) {
        console.log("Telegram credentials missing, skipping notification.");
        console.log("Message Content:\n", message); // Log locally if not sending
        return Promise.resolve({ success: false, error: 'Telegram credentials missing' }); // Return a resolved Promise instead of void
    }

    const encodedMessage = encodeURIComponent(message);
    const telegramApiUrl = `https://api.telegram.org/bot${telegramBotToken}/sendMessage?chat_id=${telegramChatId}&text=${encodedMessage}&parse_mode=Markdown`;

    return axios.get(telegramApiUrl)
        .then(response => {
            if (response.data && response.data.ok) {
                console.log('Message successfully sent to Telegram.');
                return { success: true };
            } else {
                console.error('Error sending message to Telegram:', response.data?.description);
                return { success: false, error: response.data?.description };
            }
        })
        .catch(error => {
            console.error('Error calling Telegram API:', error.response ? JSON.stringify(error.response.data) : error.message);
            return { success: false, error: error.message };
        });
}

module.exports = {
    sendTelegramMessage
}; 