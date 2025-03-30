const dotenv = require('dotenv');
// Remove CommonJS require for node-fetch
// const fetch = require('node-fetch');

// Load environment variables
dotenv.config();

// bKash API credentials from environment variables
const bkashCredentials = {
  username: process.env.BKASH_USERNAME,
  password: process.env.BKASH_PASSWORD,
  app_key: process.env.BKASH_APP_KEY,
  app_secret: process.env.BKASH_APP_SECRET,
  baseURL: process.env.BKASH_API_URL
};

// Import fetch dynamically once at the module level and store the promise
const fetchPromise = import('node-fetch').then(module => module.default);

/**
 * Get grant token from bKash API
 * @returns {Promise<Object>} Grant token response object
 */
async function getGrantToken() {
  try {
    // Check if credentials are properly loaded
    if (!bkashCredentials.username || !bkashCredentials.password || 
        !bkashCredentials.app_key || !bkashCredentials.app_secret || !bkashCredentials.baseURL) {
      console.error('Missing bKash credentials in environment variables:', {
        username: !!bkashCredentials.username,
        password: !!bkashCredentials.password,
        app_key: !!bkashCredentials.app_key,
        app_secret: !!bkashCredentials.app_secret,
        baseURL: !!bkashCredentials.baseURL
      });
      throw new Error('Missing bKash API credentials');
    }

    const fetch = await fetchPromise;
    const url = `${bkashCredentials.baseURL}checkout/token/grant`;
    
    console.log(`Sending token request to: ${url}`);
    console.log('Using credentials:', {
      username: bkashCredentials.username,
      app_key: bkashCredentials.app_key,
      // Don't log sensitive data like password and app_secret
    });
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'username': bkashCredentials.username,
        'password': bkashCredentials.password
      },
      body: JSON.stringify({
        app_key: bkashCredentials.app_key,
        app_secret: bkashCredentials.app_secret
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('bKash token grant error response:', errorData);
      throw new Error(`bKash API Error: ${errorData.statusMessage || response.statusText || 'Failed to get grant token'}`);
    }

    const tokenData = await response.json();
    
    // Verify that we received the expected id_token
    if (!tokenData || !tokenData.id_token) {
      console.error('Invalid token response from bKash:', tokenData);
      throw new Error('Invalid token response from bKash');
    }
    
    console.log('Received valid token from bKash');
    return tokenData;
  } catch (error) {
    console.error('Error getting bKash grant token:', error.message);
    throw error;
  }
}

/**
 * Refresh token from bKash API
 * @param {string} refreshToken - The refresh token from previous grant token response
 * @returns {Promise<Object>} New token response object
 */
async function refreshToken(refreshToken) {
  try {
    const fetch = await fetchPromise;
    if (!refreshToken) {
      throw new Error('Refresh token is required');
    }

    const url = `${bkashCredentials.baseURL}checkout/token/refresh`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'username': bkashCredentials.username,
        'password': bkashCredentials.password
      },
      body: JSON.stringify({
        app_key: bkashCredentials.app_key,
        app_secret: bkashCredentials.app_secret,
        refresh_token: refreshToken
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`bKash API Error: ${errorData.statusMessage || 'Failed to refresh token'}`);
    }

    const tokenData = await response.json();
    return tokenData;
  } catch (error) {
    console.error('Error refreshing bKash token:', error.message);
    throw error;
  }
}

/**
 * Create a bKash payment
 * @param {string} idToken - Auth token from grant token or refresh token response
 * @param {Object} paymentData - Payment data object
 * @param {string} paymentData.amount - Amount to be paid
 * @param {string} paymentData.merchantInvoiceNumber - Unique invoice number
 * @param {string} paymentData.callbackURL - Base URL for payment callbacks
 * @param {string} [paymentData.payerReference] - Reference for the payer, can be wallet number
 * @param {string} [paymentData.merchantAssociationInfo] - TLV formatted data for aggregators (optional)
 * @returns {Promise<Object>} Payment creation response
 */
async function createPayment(idToken, paymentData) {
  try {
    const fetch = await fetchPromise;
    if (!idToken) {
      throw new Error('ID token is required');
    }

    // Validate required fields
    const requiredFields = ['amount', 'merchantInvoiceNumber', 'callbackURL'];
    for (const field of requiredFields) {
      if (!paymentData[field]) {
        throw new Error(`${field} is required for payment creation`);
      }
    }

    const url = `${bkashCredentials.baseURL}checkout/create`;
    
    // Prepare the request body with exact fields in the required format
    const requestBody = {
      mode: '0011', // For Checkout (URL based)
      payerReference: paymentData.payerReference || '',
      callbackURL: paymentData.callbackURL,
      amount: paymentData.amount,
      currency: 'BDT', // Currently only BDT is supported
      intent: 'sale',
      merchantInvoiceNumber: paymentData.merchantInvoiceNumber
    };

    // Add optional merchantAssociationInfo if provided
    if (paymentData.merchantAssociationInfo) {
      requestBody.merchantAssociationInfo = paymentData.merchantAssociationInfo;
    }

    console.log('Sending payment creation request to bKash with:', JSON.stringify(requestBody));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': idToken,
        'X-App-Key': bkashCredentials.app_key
      },
      body: JSON.stringify(requestBody)
    });

    // Get the full response whether successful or not
    const responseData = await response.json();
    console.log('bKash payment creation response:', JSON.stringify(responseData));

    if (!response.ok) {
      throw new Error(`bKash API Error: ${responseData.statusMessage || response.statusText || 'Failed to create payment'}`);
    }

    return responseData;
  } catch (error) {
    console.error('Error creating bKash payment:', error.message);
    throw error;
  }
}

/**
 * Execute a payment after user authorizes it in bKash app/page
 * @param {string} idToken - Auth token from grant token or refresh token response
 * @param {string} paymentID - Payment ID received from createPayment response
 * @returns {Promise<Object>} Payment execution response
 */
async function executePayment(idToken, paymentID) {
  try {
    const fetch = await fetchPromise;
    if (!idToken) {
      throw new Error('ID token is required');
    }

    if (!paymentID) {
      throw new Error('Payment ID is required');
    }

    const url = `${bkashCredentials.baseURL}checkout/execute`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': idToken,
        'X-App-Key': bkashCredentials.app_key
      },
      body: JSON.stringify({
        paymentID: paymentID
      })
    });

    const responseData = await response.json();
    console.log('bKash payment execution response:', JSON.stringify(responseData));

    if (!response.ok) {
      throw new Error(`bKash API Error: ${responseData.statusMessage || response.statusText || 'Failed to execute payment'}`);
    }

    return responseData;
  } catch (error) {
    console.error('Error executing bKash payment:', error.message);
    throw error;
  }
}

/**
 * Query payment status from bKash API
 * @param {string} idToken - Auth token from grant token or refresh token response
 * @param {string} paymentID - Payment ID received from createPayment response
 * @returns {Promise<Object>} Payment status response
 */
async function queryPayment(idToken, paymentID) {
  try {
    const fetch = await fetchPromise;
    if (!idToken) {
      throw new Error('ID token is required');
    }

    if (!paymentID) {
      throw new Error('Payment ID is required');
    }

    const url = `${bkashCredentials.baseURL}checkout/payment/status`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': idToken,
        'X-App-Key': bkashCredentials.app_key
      },
      body: JSON.stringify({
        paymentID: paymentID
      })
    });

    const responseData = await response.json();
    console.log('bKash payment status query response:', JSON.stringify(responseData));

    if (!response.ok) {
      throw new Error(`bKash API Error: ${responseData.statusMessage || response.statusText || 'Failed to query payment status'}`);
    }

    return responseData;
  } catch (error) {
    console.error('Error querying bKash payment status:', error.message);
    throw error;
  }
}

/**
 * Search a transaction by transaction ID or payment ID
 * @param {string} idToken - Auth token from grant token or refresh token response
 * @param {Object} searchParams - Search parameters
 * @param {string} [searchParams.trxID] - Transaction ID (if available)
 * @param {string} [searchParams.paymentID] - Payment ID (if trxID not available)
 * @returns {Promise<Object>} Search transaction response
 */
async function searchTransaction(idToken, searchParams) {
  try {
    const fetch = await fetchPromise;
    if (!idToken) {
      throw new Error('ID token is required');
    }

    if (!searchParams.trxID && !searchParams.paymentID) {
      throw new Error('Either trxID or paymentID is required for searching a transaction');
    }

    const url = `${bkashCredentials.baseURL}checkout/payment/search`;
    
    // Prepare the request body with either trxID or paymentID
    const requestBody = {};
    if (searchParams.trxID) {
      requestBody.trxID = searchParams.trxID;
    } else {
      requestBody.paymentID = searchParams.paymentID;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': idToken,
        'X-App-Key': bkashCredentials.app_key
      },
      body: JSON.stringify(requestBody)
    });

    const responseData = await response.json();
    console.log('bKash transaction search response:', JSON.stringify(responseData));

    if (!response.ok) {
      throw new Error(`bKash API Error: ${responseData.statusMessage || response.statusText || 'Failed to search transaction'}`);
    }

    return responseData;
  } catch (error) {
    console.error('Error searching bKash transaction:', error.message);
    throw error;
  }
}

/**
 * Refund a payment
 * @param {string} idToken - Auth token from grant token or refresh token response
 * @param {Object} refundData - Refund data object
 * @param {string} refundData.paymentID - Payment ID received from createPayment response
 * @param {string} refundData.amount - Amount to refund (can be partial)
 * @param {string} refundData.trxID - Transaction ID of the payment
 * @param {string} refundData.sku - Stock Keeping Unit
 * @param {string} refundData.reason - Reason for refund
 * @returns {Promise<Object>} Refund response
 */
async function refundPayment(idToken, refundData) {
  try {
    const fetch = await fetchPromise;
    if (!idToken) {
      throw new Error('ID token is required');
    }

    // Validate required fields
    const requiredFields = ['paymentID', 'amount', 'trxID', 'reason'];
    for (const field of requiredFields) {
      if (!refundData[field]) {
        throw new Error(`${field} is required for refund`);
      }
    }

    const url = `${bkashCredentials.baseURL}checkout/payment/refund`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': idToken,
        'X-App-Key': bkashCredentials.app_key
      },
      body: JSON.stringify(refundData)
    });

    const responseData = await response.json();
    console.log('bKash refund response:', JSON.stringify(responseData));

    if (!response.ok) {
      throw new Error(`bKash API Error: ${responseData.statusMessage || response.statusText || 'Failed to refund payment'}`);
    }

    return responseData;
  } catch (error) {
    console.error('Error refunding bKash payment:', error.message);
    throw error;
  }
}

// Export functions
module.exports = {
  getGrantToken,
  refreshToken,
  createPayment,
  executePayment,
  queryPayment,
  searchTransaction,
  refundPayment
}; 