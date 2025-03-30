require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { sendTelegramMessage } = require('./telegramBot');
const { getGrantToken, createPayment, executePayment, queryPayment, searchTransaction, refundPayment } = require('./bkashAPI');

const app = express();
const port = process.env.PORT || 3000;

// CORS configuration
const corsOrigin = process.env.CORS_ORIGIN || '*'; // Default to allow all
const corsOptions = {
    origin: corsOrigin,
    optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
};
app.use(cors(corsOptions)); 
app.use(express.json()); // Parse JSON request bodies

// Serve static files from the parent directory (where HTML files are)
app.use(express.static(path.join(__dirname, '..')));

// Store pending orders temporarily (in a production app, use a database)
const pendingOrders = new Map();

// --- Endpoint to handle initial order submission & send to Telegram (Manual Payments Only) ---
app.post('/api/send-order', (req, res) => {
    console.log('Received manual order data:', JSON.stringify(req.body, null, 2));
    const orderDetails = req.body;

    // Basic validation (ensure it's not empty)
    if (!orderDetails || !orderDetails.customerInfo || !orderDetails.items || !orderDetails.paymentMethod) {
        console.error('Invalid order data received.');
        return res.status(400).json({ success: false, message: 'Invalid order data.'});
    }
    
    // Ensure it's not a bKash payment (those use a different endpoint)
    if (orderDetails.paymentMethod === 'bKash' || orderDetails.paymentMethod === 'bKash Gateway') {
        console.warn(`Order received with bKash payment method via send-order endpoint`);
        return res.status(400).json({ 
            success: false, 
            message: `bKash payments should use the /api/bkash/create-payment endpoint` 
        });
    }

    // Send the formatted message to Telegram for manual payment methods
    sendTelegramMessage(orderDetails)
        .then(result => {
            if (result.success) {
                res.status(200).json({ success: true, message: 'Order received and notification sent for manual processing.' });
            } else {
                // Still return success to client but log the Telegram error
                console.error('Failed to send Telegram notification:', result.error);
                res.status(200).json({ 
                    success: true, 
                    message: 'Order received but there was an issue sending the notification. We will still process your order.' 
                });
            }
        })
        .catch(error => {
            console.error('Error in send-order process:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Internal server error while processing order.' 
            });
        });
});

// --- bKash Payment Routes ---

// Initiate bKash payment
app.post('/api/bkash/create-payment', async (req, res) => {
    try {
        console.log('Received bKash payment request:', JSON.stringify(req.body, null, 2));
        const orderDetails = req.body;

        // Basic validation
        if (!orderDetails || !orderDetails.customerInfo || !orderDetails.items || !orderDetails.totalAmount) {
            console.error('Invalid order data received for bKash payment.');
            return res.status(400).json({ success: false, message: 'Invalid order data.' });
        }

        // Get token from bKash
        console.log('Requesting bKash token...');
        const tokenData = await getGrantToken();
        
        // Check if token was received properly
        if (!tokenData || !tokenData.id_token) {
            console.error('Failed to get valid token from bKash:', tokenData);
            return res.status(500).json({ 
                success: false, 
                message: 'Failed to authenticate with bKash payment gateway.' 
            });
        }
        
        console.log('bKash token received successfully.');
        
        // Create a payment
        // Use absolute URL for callback including http/https protocol
        let protocol = req.protocol;
        if (process.env.NODE_ENV === 'production') {
            protocol = 'https'; // Force HTTPS in production
        }
        // Set callback URL to port 3000 where the API is running, specifying the port explicitly
        const callbackURL = `${protocol}://localhost:3000/api/bkash/callback`;
        console.log(`Setting bKash callback URL to: ${callbackURL}`);
        
        // Generate a unique invoice number with timestamp to avoid conflicts
        const merchantInvoiceNumber = 'INV' + Date.now();
        
        // Use the actual amount from the order
        const amount = orderDetails.totalAmount.toString();
        
        // Create payment data object with EXACT structure required by bKash API
        const paymentData = {
            mode: "0011",
            callbackURL: callbackURL,
            payerReference: orderDetails.customerInfo.phone || "",
            amount: amount,
            currency: "BDT",
            intent: "sale",
            merchantInvoiceNumber: merchantInvoiceNumber
        };
        
        console.log('Creating bKash payment with data:', JSON.stringify(paymentData, null, 2));
        
        // Call the bKash API to create the payment
        const payment = await createPayment(tokenData.id_token, paymentData);
        console.log('bKash payment creation response:', JSON.stringify(payment, null, 2));
        
        if (!payment || !payment.paymentID) {
            throw new Error('Invalid payment response from bKash: Missing paymentID');
        }
        
        // Store the paymentID with the order for later lookup
        orderDetails.paymentID = payment.paymentID;
        orderDetails.merchantInvoiceNumber = merchantInvoiceNumber;
        orderDetails.amount = amount;
        
        // Save order details for later use (keyed by invoice number)
        pendingOrders.set(merchantInvoiceNumber, orderDetails);
        console.log(`Stored order with merchantInvoiceNumber: ${merchantInvoiceNumber}, paymentID: ${payment.paymentID}`);
        
        // Also save a copy indexed by paymentID for better lookup
        pendingOrders.set(payment.paymentID, {...orderDetails});
        console.log(`Also stored order with paymentID: ${payment.paymentID}`);
        
        // Return the bKash checkout URL to the client
        res.status(200).json({
            success: true, 
            paymentID: payment.paymentID,
            bkashURL: payment.bkashURL,
            message: 'Payment initiated successfully.'
        });
    } catch (error) {
        console.error('Error initiating bKash payment:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to initiate bKash payment: ' + (error.message || 'Unknown error')
        });
    }
});

// Execute a bKash payment
app.post('/api/bkash/execute-payment', async (req, res) => {
    try {
        const { paymentID } = req.body;
        
        if (!paymentID) {
            return res.status(400).json({ success: false, message: 'Payment ID is required' });
        }
        
        console.log(`Executing bKash payment for paymentID: ${paymentID}`);
        
        // Get the order details from pendingOrders
        const orderDetails = pendingOrders.get(paymentID);
        if (!orderDetails) {
            return res.status(404).json({ success: false, message: 'Order not found for this payment ID' });
        }
        
        // Get token from bKash
        const tokenData = await getGrantToken();
        if (!tokenData || !tokenData.id_token) {
            return res.status(500).json({ 
                success: false, 
                message: 'Failed to authenticate with bKash payment gateway'
            });
        }
        
        // Execute the payment
        const paymentResult = await executePayment(tokenData.id_token, paymentID);
        console.log('Payment execution result:', JSON.stringify(paymentResult, null, 2));
        
        if (paymentResult.transactionStatus === 'Completed') {
            // Payment successful, update order details with transaction info
            orderDetails.payment = {
                trxID: paymentResult.trxID,
                amount: paymentResult.amount,
                paymentTime: new Date(),
                status: paymentResult.transactionStatus,
                paymentMethod: 'bKash',
                paymentDetails: paymentResult
            };
            
            // Also set top-level fields for compatibility with some functions
            orderDetails.transactionId = paymentResult.trxID;
            orderDetails.paymentStatus = paymentResult.transactionStatus;
            
            // Send notification to Telegram
            try {
                console.log('Sending successful bKash payment to Telegram:', JSON.stringify({
                    customerName: orderDetails.customerInfo.name,
                    amount: paymentResult.amount,
                    trxID: paymentResult.trxID,
                    status: paymentResult.transactionStatus
                }));
                
                const telegramResult = await sendTelegramMessage(orderDetails);
                if (!telegramResult.success) {
                    console.error('Failed to send bKash order to Telegram:', telegramResult.error);
                }
            } catch (telegramError) {
                console.error('Error sending Telegram notification:', telegramError);
            }
            
            // Remove from pending orders
            pendingOrders.delete(paymentID);
            if (orderDetails.merchantInvoiceNumber) {
                pendingOrders.delete(orderDetails.merchantInvoiceNumber);
            }
            
            // Return success to client
            return res.status(200).json({
                success: true,
                transactionStatus: paymentResult.transactionStatus,
                trxID: paymentResult.trxID,
                amount: paymentResult.amount,
                message: 'Payment completed successfully'
            });
        } else {
            // Payment not completed
            return res.status(200).json({
                success: false,
                transactionStatus: paymentResult.transactionStatus,
                message: `Payment status: ${paymentResult.transactionStatus}`
            });
        }
    } catch (error) {
        console.error('Error executing bKash payment:', error);
        return res.status(500).json({
            success: false,
            message: 'Error executing payment: ' + (error.message || 'Unknown error')
        });
    }
});

// bKash callback handler (bKash will redirect here)
app.get('/api/bkash/callback', async (req, res) => {
    try {
        const status = req.query.status;
        const paymentID = req.query.paymentID;
        
        console.log(`Received bKash callback with status: ${status}, paymentID: ${paymentID}`);
        
        if (!paymentID) {
            return res.redirect('/payment-failed.html?error=Missing_PaymentID');
        }
        
        // For callback, redirect the user back to the frontend with the paymentID
        // The frontend will then call the execute-payment endpoint with this paymentID
        if (status === 'success' || status === 'Success') {
            return res.redirect(`/payment-success.html?paymentID=${paymentID}&status=${status}`);
        } else {
            return res.redirect(`/payment-failed.html?status=${status}&paymentID=${paymentID}`);
        }
    } catch (error) {
        console.error('Error processing bKash callback:', error);
        return res.redirect(`/payment-failed.html?error=Server_Error`);
    }
});

// bKash Payment Status Endpoint - more detailed than the callback, with additional verification
app.get('/api/bkash/payment-status/:paymentID', async (req, res) => {
  try {
    const paymentID = req.params.paymentID;
    const allowInitiated = req.query.allowInitiated === 'true';
    
    if (!paymentID) {
      return res.status(400).json({ success: false, message: 'Payment ID is required' });
    }
    
    // Check if we have this payment in our pending orders
    const pendingOrder = pendingOrders.get(paymentID);
    
    // Get token from bKash
    const tokenData = await getGrantToken();
    if (!tokenData || !tokenData.id_token) {
      console.error('Failed to get valid token from bKash for status check');
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to authenticate with bKash payment gateway'
      });
    }
    
    // Query payment status from bKash
    try {
      const paymentStatus = await queryPayment(tokenData.id_token, paymentID);
      
      // Determine if the payment is successful
      const isCompleted = paymentStatus.transactionStatus === 'Completed';
      const isInitiatedButAllowed = allowInitiated && paymentStatus.transactionStatus === 'Initiated';
      const isSuccessful = isCompleted || isInitiatedButAllowed;
      
      // If we have a pending order, add that information to response
      const responseData = {
        success: true,
        paymentID: paymentID,
        status: paymentStatus.transactionStatus,
        amount: paymentStatus.amount,
        customerMsisdn: paymentStatus.customerMsisdn,
        trxID: paymentStatus.trxID,
        isSuccessful: isSuccessful,
        paymentDetails: paymentStatus
      };
      
      if (pendingOrder) {
        responseData.orderDetails = {
          customerName: pendingOrder.customerInfo?.name,
          items: pendingOrder.items,
          total: pendingOrder.totalAmount || pendingOrder.total
        };
      }
      
      return res.json(responseData);
    } catch (statusError) {
      console.error('Error querying payment status from bKash:', statusError);
      
      // Try to use the searchTransaction as a fallback
      try {
        console.log('Attempting to search transaction as fallback...');
        const searchResult = await searchTransaction(tokenData.id_token, { paymentID });
        
        // If we have a pending order, add that information to response
        const responseData = {
          success: true,
          paymentID: paymentID,
          status: searchResult.transactionStatus || 'Unknown',
          amount: searchResult.amount,
          customerMsisdn: searchResult.customerMsisdn,
          trxID: searchResult.trxID,
          isSuccessful: searchResult.transactionStatus === 'Completed',
          paymentDetails: searchResult,
          fromSearchAPI: true
        };
        
        if (pendingOrder) {
          responseData.orderDetails = {
            customerName: pendingOrder.customerInfo?.name,
            items: pendingOrder.items,
            total: pendingOrder.totalAmount || pendingOrder.total
          };
        }
        
        return res.json(responseData);
      } catch (searchError) {
        console.error('Error searching transaction:', searchError);
        return res.status(500).json({ 
          success: false, 
          message: 'Failed to retrieve payment status from bKash',
          error: statusError.message
        });
      }
    }
  } catch (error) {
    console.error('Error checking payment status:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error while checking payment status',
      error: error.message
    });
  }
});

// Basic GET route for checking if server is running
app.get('/', (req, res) => {
  res.send('Gameshop Backend is running! (Supports Manual and bKash Payments)');
});

// Start the server
app.listen(port, () => {
  console.log(`Backend server listening at http://localhost:${port}`);
  
  // Print all registered routes for debugging
  console.log('Registered API routes:');
  app._router.stack.forEach(function(r){
    if (r.route && r.route.path){
      console.log(`${Object.keys(r.route.methods)[0].toUpperCase()} ${r.route.path}`);
    }
  });
}); 