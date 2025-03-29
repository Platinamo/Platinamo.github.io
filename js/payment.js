// Global cart variable
let cart = [];

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
        const gameName = item.game_name || item.item_name;
        
        if (!gameGroups[gameName]) {
            gameGroups[gameName] = [];
        }
        
        gameGroups[gameName].push(item);
    });
    
    return gameGroups;
}

// Function to filter user info by game name
function filterUserInfoByGame(userInfo, gameName) {
    const gameUserInfo = {};
    
    Object.entries(userInfo).forEach(([key, value]) => {
        if (key.includes(gameName)) {
            gameUserInfo[key] = value;
        }
    });
    
    return gameUserInfo;
}

// Function to remove an item from the cart
function removeItem(itemName) {
    // Find the game this item belongs to before removing it
    const item = cart.find(i => i.item_name === itemName);
    const gameName = item ? (item.game_name || item.item_name) : null;
    
    // Remove the item from the cart
    cart = cart.filter(i => i.item_name !== itemName);
    localStorage.setItem('cart', JSON.stringify(cart));
    
    // Refresh the display
    updateDisplay();
}

// Function to update quantity
function updateQuantity(itemName, change) {
    const existingItem = cart.find(i => i.item_name === itemName);
    if (existingItem) {
        existingItem.quantity += change;
        if (existingItem.quantity <= 0) {
            // If quantity becomes zero or negative, remove the item
            removeItem(itemName);
            return;
        }
        localStorage.setItem('cart', JSON.stringify(cart));
        // Refresh the display
        updateDisplay();
    }
}

// Function to update the display
function updateDisplay() {
    const userInfo = JSON.parse(localStorage.getItem('userInfo')) || {};
    const gameSectionsContainer = document.getElementById('game-sections');
    gameSectionsContainer.innerHTML = '';
    
    // Group cart items by game
    const gameGroups = groupCartItemsByGame();
    
    // Calculate total
    let total = 0;
    cart.forEach(item => {
        const price = parseFloat(item.item_price.replace('৳', '').replace(',', ''));
        total += price * item.quantity;
    });
    
    // If cart is empty
    if (cart.length === 0) {
        gameSectionsContainer.innerHTML = `
            <div class="cart-empty-message">
                <i class="fas fa-shopping-cart"></i>
                <p>Your cart is empty</p>
            </div>
        `;
    } else {
        // Create a section for each game with its items and related user info
        Object.entries(gameGroups).forEach(([gameName, items]) => {
            const gameSection = document.createElement('div');
            gameSection.className = 'game-section';
            gameSection.style.animationDelay = `${Object.keys(gameGroups).indexOf(gameName) * 0.1}s`;
            
            // Game title
            gameSection.innerHTML = `
                <div class="game-title">
                    <i class="fas fa-gamepad"></i>
                    ${gameName}
                </div>
            `;
            
            // User info for this game
            const gameUserInfo = filterUserInfoByGame(userInfo, gameName);
            if (Object.keys(gameUserInfo).length > 0) {
                const userInfoContainer = document.createElement('div');
                userInfoContainer.className = 'user-info';
                
                Object.entries(gameUserInfo).forEach(([key, value]) => {
                    // Clean up field names by removing technical prefixes and brackets
                    let cleanKey = key.replace(/ppom\[fields\]\[/g, '').replace(/\]$/g, '');
                    const label = cleanKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    
                    userInfoContainer.innerHTML += `
                        <div class="info-row">
                            <div class="info-label">${label}:</div>
                            <div class="info-value">${value}</div>
                        </div>
                    `;
                });
                
                gameSection.appendChild(userInfoContainer);
            }
            
            // Items for this game
            const itemsContainer = document.createElement('div');
            itemsContainer.className = 'cart-items';
            
            items.forEach(item => {
                const price = parseFloat(item.item_price.replace('৳', '').replace(',', ''));
                const itemTotal = price * item.quantity;
                
                const itemElement = document.createElement('div');
                itemElement.className = 'cart-item';
                itemElement.innerHTML = `
                    <div class="item-details">
                        <div class="item-name">${item.item_name}</div>
                        <div class="item-price">৳ ${itemTotal.toFixed(2)}</div>
                        <div class="item-quantity">
                            <button class="quantity-btn" onclick="updateQuantity('${item.item_name}', -1)">-</button>
                            <span>Quantity: ${item.quantity}</span>
                            <button class="quantity-btn" onclick="updateQuantity('${item.item_name}', 1)">+</button>
                        </div>
                    </div>
                    <button class="remove-btn" onclick="removeItem('${item.item_name}')">Remove</button>
                `;
                
                itemsContainer.appendChild(itemElement);
            });
            
            gameSection.appendChild(itemsContainer);
            gameSectionsContainer.appendChild(gameSection);
        });
    }
    
    // Update total amount
    document.getElementById('total-amount').textContent = `Total: ৳ ${total.toFixed(2)}`;
    
    // Update cart count in header if it exists
    const cartCountElement = document.getElementById('cart-count');
    if (cartCountElement) {
        cartCountElement.textContent = cart.reduce((sum, item) => sum + item.quantity, 0);
    }
}

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    // Load cart from localStorage
    cart = JSON.parse(localStorage.getItem('cart')) || [];
    
    // Update the display
    updateDisplay();

    const placeOrderBtn = document.getElementById('place-order-btn');
    placeOrderBtn.addEventListener('click', sendOrderToBot);

    const clearCartBtn = document.getElementById('clear-cart-btn');
    clearCartBtn.addEventListener('click', clearCart);
});