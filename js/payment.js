// Global cart variable
let cart = [];

// --- Payment Method Elements (Add these) ---
const paymentOptions = document.querySelectorAll('input[name="paymentMethod"]');
const paymentInstructions = document.querySelectorAll('.payment-instructions');
const trxIdInput = document.getElementById('trxId');
const bankRefInput = document.getElementById('bankRef');
// Add elements for Send Money sub-selection
const sendMoneySubOptionBtns = document.querySelectorAll('.sub-option-btn');
const sendMoneyDetailsArea = document.getElementById('send-money-details-area');
const selectedSendMoneyNumberEl = document.getElementById('selected-send-money-number');
const sendMoneyTotalEl = document.getElementById('send-money-total');
const copyBtns = document.querySelectorAll('.copy-btn');
// Modal elements
const paymentModal = document.getElementById('payment-modal');
const paymentStatusMessage = document.getElementById('payment-status-message');

// Variable to store the selected Send Money sub-method
let selectedSendMoneySubMethod = null;

function clearCart() {
    localStorage.removeItem('cart');
    localStorage.removeItem('userInfo');
    cart = [];
    updateDisplay();
}

// Function to group cart items by game
function groupCartItemsByGame() {
    const gameGroups = {};
    
    cart.forEach(item => {
        // Use the game name as the key
        const gameName = item.game_name || item.item_name; // Might need refinement based on how game name is stored
        
        if (!gameGroups[gameName]) {
            gameGroups[gameName] = [];
        }
        
        gameGroups[gameName].push(item);
    });
    
    return gameGroups;
}

// Function to filter user info by game name (May need adjustment)
function filterUserInfoByGame(userInfo, gameName) {
    const gameUserInfo = {};
    
    // This logic might be too simplistic if keys don't contain gameName
    Object.entries(userInfo).forEach(([key, value]) => {
        // Let's display all userInfo for now, as grouping might be complex
        // if (key.includes(gameName)) { 
           gameUserInfo[key] = value;
        // }
    });
    
    return gameUserInfo;
}

// Function to remove an item from the cart
function removeItem(itemName) {
    cart = cart.filter(i => i.item_name !== itemName);
    localStorage.setItem('cart', JSON.stringify(cart));
    updateDisplay(); // Refresh the display
}

// Function to update quantity
function updateQuantity(itemName, change) {
    const existingItem = cart.find(i => i.item_name === itemName);
    if (existingItem) {
        existingItem.quantity += change;
        if (existingItem.quantity <= 0) {
            removeItem(itemName);
            return;
        }
        localStorage.setItem('cart', JSON.stringify(cart));
        updateDisplay(); // Refresh the display
    }
}

// Function to update the display
function updateDisplay() {
    const userInfo = JSON.parse(localStorage.getItem('userInfo')) || {};
    const gameSectionsContainer = document.getElementById('game-sections');
    const totalAmountElement = document.getElementById('total-amount');
    gameSectionsContainer.innerHTML = ''; // Clear previous content
    
    let total = 0;
    cart.forEach(item => {
        const price = parseFloat(item.item_price.replace('৳', '').replace(',', ''));
        total += price * item.quantity;
    });

    // --- Display User Provided Game Info --- 
    const userInfoContainer = document.createElement('div');
    userInfoContainer.className = 'game-user-info-summary'; // New class for styling
    userInfoContainer.innerHTML = '<h3>Game Account Details</h3>';
    if (Object.keys(userInfo).length > 0) {
        const infoList = document.createElement('ul');
        Object.entries(userInfo).forEach(([key, value]) => {
             // Format key for display (e.g., 'userId' -> 'User ID')
             const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
             const listItem = document.createElement('li');
             listItem.innerHTML = `<strong>${formattedKey}:</strong> ${value}`;
             infoList.appendChild(listItem);
        });
        userInfoContainer.appendChild(infoList);
    } else {
        userInfoContainer.innerHTML += '<p>No specific game account details were required or provided.</p>';
    }
    gameSectionsContainer.appendChild(userInfoContainer);

    // --- Display Cart Items --- 
    const itemsContainer = document.createElement('div');
    itemsContainer.className = 'cart-items-summary'; // New class for styling
    itemsContainer.innerHTML = '<h3>Selected Items</h3>';

    if (cart.length === 0) {
        itemsContainer.innerHTML += `
            <div class="cart-empty-message">
                <i class="fas fa-shopping-cart"></i>
                <p>Your cart is empty</p>
            </div>
        `;
        // Disable place order button if cart is empty
        const placeOrderBtn = document.getElementById('place-order-btn');
        if(placeOrderBtn) placeOrderBtn.disabled = true;
        // Hide user details form if cart is empty
        const userDetailsForm = document.querySelector('.user-details-form');
        if (userDetailsForm) userDetailsForm.style.display = 'none';

    } else {
        const itemList = document.createElement('ul');
        itemList.className = 'order-items-list'; // Reusing class from previous attempt
        cart.forEach(item => {
            const price = parseFloat(item.item_price.replace('৳', '').replace(',', ''));
            const itemTotal = price * item.quantity;
            
            const itemElement = document.createElement('li');
            itemElement.className = 'cart-item-display'; // New class for list item
            itemElement.innerHTML = `
                <div class="item-info">
                    <span class="item-name">${item.item_name}</span>
                    <span class="item-price">৳ ${itemTotal.toFixed(2)}</span>
                </div>
                <div class="item-controls">
                    <button class="quantity-btn minus" onclick="updateQuantity('${item.item_name}', -1)">-</button>
                    <span class="quantity-display">${item.quantity}</span>
                    <button class="quantity-btn plus" onclick="updateQuantity('${item.item_name}', 1)">+</button>
                    <button class="remove-btn" onclick="removeItem('${item.item_name}')"><i class="fas fa-trash-alt"></i></button>
                </div>
            `;
            itemList.appendChild(itemElement);
        });
        itemsContainer.appendChild(itemList);

        // Ensure place order button is enabled and form is visible
        const placeOrderBtn = document.getElementById('place-order-btn');
        if(placeOrderBtn) placeOrderBtn.disabled = false;
        const userDetailsForm = document.querySelector('.user-details-form');
        if (userDetailsForm) userDetailsForm.style.display = 'block'; // Or remove style to default
    }
    gameSectionsContainer.appendChild(itemsContainer);
    
    // Update total amount
    totalAmountElement.textContent = `Total: ৳ ${total.toFixed(2)}`;
    if(sendMoneyTotalEl) {
        sendMoneyTotalEl.textContent = `৳ ${total.toFixed(2)}`; // Update total in instructions
    }
    
    // // Update cart count in header if it exists (Optional - might be handled elsewhere)
    // const cartCountElement = document.getElementById('cart-count');
    // if (cartCountElement) {
    //     cartCountElement.textContent = cart.reduce((sum, item) => sum + item.quantity, 0);
    // }
}

// --- Function to handle Copying --- (Add this)
async function copyToClipboard(element) {
    const textToCopy = element.textContent;
    const feedbackElement = element.closest('.copyable-number-container').querySelector('.copy-feedback');
    try {
        await navigator.clipboard.writeText(textToCopy);
        if(feedbackElement) feedbackElement.textContent = 'Copied!';
        setTimeout(() => { 
            if(feedbackElement) feedbackElement.textContent = ''; 
        }, 1500); // Clear feedback after 1.5 seconds
    } catch (err) {
        console.error('Failed to copy text: ', err);
        if(feedbackElement) feedbackElement.textContent = 'Copy failed';
         setTimeout(() => { 
            if(feedbackElement) feedbackElement.textContent = ''; 
        }, 1500);
    }
}

// --- Function to handle Send Money Sub-option Selection --- (Add this)
function handleSendMoneySubSelection(event) {
    const selectedBtn = event.currentTarget;
    selectedSendMoneySubMethod = selectedBtn.dataset.method;
    const numberToShow = selectedBtn.dataset.number;

    // Update UI
    if(selectedSendMoneyNumberEl) selectedSendMoneyNumberEl.textContent = numberToShow;
    if(sendMoneyDetailsArea) sendMoneyDetailsArea.style.display = 'block'; // Show details area

    // Update button styles
    sendMoneySubOptionBtns.forEach(btn => btn.classList.remove('selected'));
    selectedBtn.classList.add('selected');
    
    // Optionally focus the TrxID input
    if(trxIdInput) trxIdInput.focus();
}

// --- Function to handle Payment Method Change (Updated) ---
function handlePaymentMethodChange() {
    paymentInstructions.forEach(instr => instr.style.display = 'none');
    sendMoneySubOptionBtns.forEach(btn => btn.classList.remove('selected')); // Deselect sub-options
    if(sendMoneyDetailsArea) sendMoneyDetailsArea.style.display = 'none'; // Hide details area
    selectedSendMoneySubMethod = null; // Reset sub-method selection
    
    const selectedOption = document.querySelector('input[name="paymentMethod"]:checked');
    
    if (selectedOption) {
        const instructionId = selectedOption.id + '-instructions';
        const instructionDiv = document.getElementById(instructionId);
        if (instructionDiv) {
            instructionDiv.style.display = 'block';
        }
        
        // Highlight parent .payment-option
        document.querySelectorAll('.payment-option').forEach(opt => opt.classList.remove('selected'));
        if(selectedOption.closest('.payment-option')){
           selectedOption.closest('.payment-option').classList.add('selected');
        }
    }
    
    // Enable/disable TrxID/Bank Ref REQUIRED status
    // Note: Actual visibility is handled within Send Money flow
    if(trxIdInput) trxIdInput.required = (selectedOption && selectedOption.value === 'Send Money');
    if(bankRefInput) bankRefInput.required = (selectedOption && selectedOption.value === 'Bank Transfer');
}

// Show payment modal
function showPaymentModal(message) {
    if (paymentStatusMessage) {
        paymentStatusMessage.textContent = message || 'Processing your payment...';
    }
    if (paymentModal) {
        paymentModal.style.display = 'block';
    }
}

// Hide payment modal
function hidePaymentModal() {
    if (paymentModal) {
        paymentModal.style.display = 'none';
    }
}

// Handle bKash payment
async function handleBkashPayment(orderDetails) {
    try {
        showPaymentModal('Initiating bKash payment...');
        
        // Calculate total amount from cart
        const totalAmount = cart.reduce((sum, item) => {
            const price = parseFloat(item.item_price.replace('৳', '').replace(',', ''));
            return sum + (price * item.quantity);
        }, 0);
        
        // Add totalAmount to orderDetails
        orderDetails.totalAmount = totalAmount;
        
        // Normalize payment method to 'bKash' for backend compatibility
        orderDetails.paymentMethod = 'bKash';

        // Generate a unique invoice number
        const invoiceNumber = 'INV-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
        orderDetails.invoiceNumber = invoiceNumber;
        
        // Store original port for return handling
        localStorage.setItem('original_port', window.location.port);

        // Always use port 3000 for API calls
        const apiPort = '3000';
        const apiUrl = `http://localhost:${apiPort}/api/bkash/create-payment`;

        // Send request to backend to create bKash payment
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(orderDetails)
        });

        const data = await response.json();
        
        if (data.success && data.bkashURL) {
            // Store the payment ID in localStorage for when the user returns from bKash
            if (data.paymentID) {
                localStorage.setItem('bkash_payment_id', data.paymentID);
                localStorage.setItem('bkash_payment_time', new Date().toISOString());
            }
            
            // Update modal message
            showPaymentModal('Redirecting to bKash payment page...');
            
            // Redirect to bKash payment page
            window.location.href = data.bkashURL;
        } else {
            hidePaymentModal();
            alert('Failed to initiate bKash payment: ' + (data.message || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error initiating bKash payment:', error);
        hidePaymentModal();
        alert('Failed to connect to the payment server. Please try again.');
    }
}

// Check payment status by polling
async function checkPaymentStatus(paymentID, attempts = 0) {
    if (attempts > 10) {  // Limit number of attempts
        hidePaymentModal();
        alert('Payment verification is taking longer than expected. Please check your email for confirmation.');
        return;
    }
    
    try {
        showPaymentModal('Executing bKash payment...');
        
        // Always use port 3000 for API calls
        const apiPort = '3000';
        const apiUrl = `http://localhost:${apiPort}/api/bkash/execute-payment`;
        
        // Execute the payment by calling the backend
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ paymentID: paymentID })
        });
        
        const data = await response.json();
        console.log('Payment execution response:', data);
        
        if (response.ok) {
            if (data.success) {
                // Payment successful
                showPaymentModal('Payment completed! Processing your order...');
                
                // Clear cart and local storage
                localStorage.removeItem('cart');
                localStorage.removeItem('userInfo');
                localStorage.removeItem('bkash_payment_id');
                localStorage.removeItem('bkash_payment_time');
                
                setTimeout(() => {
                    hidePaymentModal();
                    // Redirect to success page with trxID
                    window.location.href = '/payment-success.html?paymentID=' + paymentID + 
                        (data.trxID ? '&trxID=' + data.trxID : '');
                }, 2000);
            } else {
                // Payment not successful but response was ok
                if (data.transactionStatus === 'Initiated' && attempts < 3) {
                    // If status is still "Initiated", try again after a delay
                    showPaymentModal('Payment processing... Please wait...');
                    setTimeout(() => checkPaymentStatus(paymentID, attempts + 1), 5000);
                } else {
                    // Other failed status
                    hidePaymentModal();
                    alert('Payment was not completed. Status: ' + (data.transactionStatus || 'Unknown'));
                    window.location.href = '/payment-failed.html?status=' + 
                        (data.transactionStatus || 'Failed') + '&paymentID=' + paymentID;
                }
            }
        } else {
            // Server error or problem with the request
            if (attempts < 3) {
                // Try again a few times
                showPaymentModal('Checking payment status...');
                setTimeout(() => checkPaymentStatus(paymentID, attempts + 1), 3000);
            } else {
                hidePaymentModal();
                alert('Failed to verify payment: ' + (data.message || 'Unknown error'));
            }
        }
    } catch (error) {
        console.error('Error executing bKash payment:', error);
        if (attempts < 3) {
            // Try again a few times in case of network error
            showPaymentModal('Retrying payment verification...');
            setTimeout(() => checkPaymentStatus(paymentID, attempts + 1), 3000);
        } else {
            hidePaymentModal();
            alert('Failed to connect to the payment server. Please contact support with your order details.');
        }
    }
}

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    // Load cart from localStorage
    cart = JSON.parse(localStorage.getItem('cart')) || [];
    
    // Initial display update
    updateDisplay();

    // --- Get Form Elements --- 
    const placeOrderBtn = document.getElementById('place-order-btn');
    const clearCartBtn = document.getElementById('clear-cart-btn');
    const userNameInput = document.getElementById('user-name');
    const userEmailInput = document.getElementById('user-email');
    const userPhoneInput = document.getElementById('user-phone');
    const totalAmountElement = document.getElementById('total-amount');
    // (Payment method elements already grabbed globally)

    // --- Add Event Listeners --- 

    // Add listener for payment method changes (Add this)
    paymentOptions.forEach(option => {
        option.addEventListener('change', handlePaymentMethodChange);
    });

    // Send Money Sub-option clicks (Add this)
    sendMoneySubOptionBtns.forEach(btn => {
        btn.addEventListener('click', handleSendMoneySubSelection);
    });

    // Copy Button clicks (Add this)
    copyBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
             const target = e.currentTarget.previousElementSibling; // The span with the number
             if (target && target.classList.contains('copy-target')) {
                copyToClipboard(target);
             }
        });
    });
    // Add listener to copy the number span itself
    if(selectedSendMoneyNumberEl) {
        selectedSendMoneyNumberEl.addEventListener('click', (e) => copyToClipboard(e.target));
    }

    // Initial call to set correct instruction visibility
    handlePaymentMethodChange(); 

    // Check for payment status in URL params (for when returning from bKash)
    const urlParams = new URLSearchParams(window.location.search);
    const paymentID = urlParams.get('paymentID');
    const status = urlParams.get('status');
    
    if (paymentID && status === 'success') {
        showPaymentModal('Verifying payment...');
        checkPaymentStatus(paymentID);
    } else if (paymentID) {
        // Just show the payment status page without executing
        window.location.href = '/payment-success.html?paymentID=' + paymentID;
    } else {
        // Check if there's a recent payment ID stored in localStorage (backup check)
        const storedPaymentID = localStorage.getItem('bkash_payment_id');
        const paymentTimeStr = localStorage.getItem('bkash_payment_time');
        
        if (storedPaymentID && paymentTimeStr) {
            // Only check if the payment attempt was recent (within the last 10 minutes)
            const paymentTime = new Date(paymentTimeStr);
            const currentTime = new Date();
            const minutesSincePayment = (currentTime - paymentTime) / (1000 * 60);
            
            if (minutesSincePayment < 10) {
                console.log(`Found recent bKash payment attempt (${minutesSincePayment.toFixed(1)} minutes ago). Checking status...`);
                showPaymentModal('Checking recent payment status...');
                checkPaymentStatus(storedPaymentID);
            } else {
                // Clear old payment data
                localStorage.removeItem('bkash_payment_id');
                localStorage.removeItem('bkash_payment_time');
            }
        }
    }

    if (placeOrderBtn) {
        placeOrderBtn.addEventListener('click', () => {
            const name = userNameInput.value.trim();
            const email = userEmailInput.value.trim();
            const phone = userPhoneInput.value.trim();
            const currentCart = JSON.parse(localStorage.getItem('cart')) || [];
            const currentTotal = totalAmountElement ? totalAmountElement.textContent : 'N/A';
            const userInfo = JSON.parse(localStorage.getItem('userInfo')) || {};

            const selectedPaymentMethodRadio = document.querySelector('input[name="paymentMethod"]:checked');
            
            if (!selectedPaymentMethodRadio) {
                alert('Please select a payment method.');
                return;
            }
            const paymentMethodValue = selectedPaymentMethodRadio.value;
            let paymentDetails = {};
            
            if (currentCart.length === 0) {
                alert('Your cart is empty. Please add items before placing an order.');
                return;
            }
            
            // --- User Details Validation ---
            if (!name || !email || !phone) {
                alert('Please fill in all your details (Name, Email, Phone).');
                if (!name) userNameInput.focus();
                else if (!email) userEmailInput.focus();
                else if (!phone) userPhoneInput.focus();
                return;
            }
            const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailPattern.test(email)) {
                alert('Please enter a valid email address.');
                userEmailInput.focus();
                return;
            }
            const phonePattern = /^[+]?[0-9\s\-()]+$/; // Allow more chars in phone
            if (!phonePattern.test(phone)) {
                alert('Please enter a valid phone number.');
                userPhoneInput.focus();
                return;
            }
            // --- End Validations ---

            // Construct order details
            const orderDetails = {
                customerInfo: { name: name, email: email, phone: phone },
                paymentMethod: paymentMethodValue, 
                gameSpecificInfo: userInfo,
                items: currentCart,
                total: currentTotal 
            };

            // For bKash payment
            if (paymentMethodValue === 'bKash Gateway') {
                handleBkashPayment(orderDetails);
                return;
            }

            // --- Only For Manual Payments --- 
            // Validate Send Money specific fields
            if (paymentMethodValue === 'Send Money') { 
                if (!selectedSendMoneySubMethod) {
                    alert('Please select bKash, Nagad, or Rocket within the Send Money option.');
                    return;
                }
                const trxId = trxIdInput.value.trim();
                if (!trxId) {
                    alert('Please enter the Transaction ID (TrxID) for Send Money.');
                    trxIdInput.focus();
                    return;
                }
                paymentDetails.sendMoneyType = selectedSendMoneySubMethod;
                paymentDetails.transactionId = trxId;
            }
            // Validate Bank Ref if Bank Transfer is selected
            else if (paymentMethodValue === 'Bank Transfer') {
                 const bankRef = bankRefInput.value.trim();
                 if (!bankRef) {
                     alert('Please enter the Bank Transfer reference or slip details.');
                     bankRefInput.focus();
                     return;
                 }
                 paymentDetails.bankReference = bankRef;
            }
            
            // Add payment details to order for manual methods
            orderDetails.paymentDetails = paymentDetails;

            console.log('--- Manual Order Details ---');
            console.log(JSON.stringify(orderDetails, null, 2));

            // --- Send Order Details to Backend API ---
            fetch('http://localhost:3000/api/send-order', { 
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(orderDetails),
            })
            .then(response => response.json())
            .then(data => {
                console.log('Backend response (manual order):', data);
                if (data.success) {
                    alert('Order submitted successfully! We will process it after payment confirmation.');
                    // Clear cart, fields, update UI
                    localStorage.removeItem('cart');
                    localStorage.removeItem('userInfo');
                    cart = [];
                    updateDisplay();
                    if(userNameInput) userNameInput.value = '';
                    if(userEmailInput) userEmailInput.value = '';
                    if(userPhoneInput) userPhoneInput.value = '';
                    paymentOptions.forEach(option => option.checked = false);
                    if(trxIdInput) trxIdInput.value = '';
                    if(bankRefInput) bankRefInput.value = '';
                    sendMoneySubOptionBtns.forEach(btn => btn.classList.remove('selected'));
                    handlePaymentMethodChange(); 
                    const userDetailsForm = document.querySelector('.user-details-form');
                    if (userDetailsForm) userDetailsForm.style.display = 'none';
                    const paymentForm = document.querySelector('.payment-method-selection');
                    if (paymentForm) paymentForm.style.display = 'none';
                    if(placeOrderBtn) placeOrderBtn.disabled = true;
                    if(clearCartBtn) clearCartBtn.disabled = true;
                    const gameSectionsContainer = document.getElementById('game-sections');
                    if(gameSectionsContainer){
                        gameSectionsContainer.innerHTML = '<p style="color: green; font-weight: bold;">Order Submitted! Processing after payment confirmation.</p>';
                    }
                } else {
                    alert('There was an issue submitting your order. Please try again. Error: ' + (data.message || 'Unknown error'));
                }
            })
            .catch((error) => {
                console.error('Error sending manual order to backend:', error);
                alert('Failed to connect to the server to submit your order. Please check your connection and try again.');
            });
            
        });
    }

    if (clearCartBtn) {
        clearCartBtn.addEventListener('click', () => {
             if (confirm('Are you sure you want to clear your cart?')) {
                  localStorage.removeItem('cart');
                  localStorage.removeItem('userInfo'); // Also clear user info if clearing cart
                  cart = [];
                  userInfo = {};
                  updateDisplay();
                   // Optionally clear forms too
                   if (userNameInput) userNameInput.value = '';
                   if (userEmailInput) userEmailInput.value = '';
                   if (userPhoneInput) userPhoneInput.value = '';
                   paymentOptions.forEach(option => option.checked = false);
                   if (trxIdInput) trxIdInput.value = '';
                   if (bankRefInput) bankRefInput.value = '';
                   sendMoneySubOptionBtns.forEach(btn => btn.classList.remove('selected'));
                   handlePaymentMethodChange();
                   // Ensure forms are visible again if they were hidden
                   const userDetailsForm = document.querySelector('.user-details-form');
                   if (userDetailsForm) userDetailsForm.style.display = ''; 
                   const paymentForm = document.querySelector('.payment-method-selection');
                   if (paymentForm) paymentForm.style.display = '';
                   if(placeOrderBtn) placeOrderBtn.disabled = false;
             }
         });
     }
});